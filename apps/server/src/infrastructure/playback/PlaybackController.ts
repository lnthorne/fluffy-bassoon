/**
 * PlaybackController for MPV media player control
 * Implements play, pause, resume, stop operations via IPC
 * Requirements: 2.1, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8
 */

import { EventEmitter } from 'events';
import { Result } from '@party-jukebox/shared';
import { IPlaybackController, IIPCClient, IProcessManager } from '../../domain/playback/interfaces';
import { 
  PlaybackEvent, 
  PlaybackEventListener, 
  MPVCommand, 
  MPVResponse,
  MpvOptions 
} from '../../domain/playback/types';
import { PlaybackError } from '../../domain/playback/errors';

/**
 * PlaybackController implementation for controlling MPV via IPC
 * Requirements: 2.1, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8
 */
export class PlaybackController extends EventEmitter implements IPlaybackController {
  private ipcClient: IIPCClient;
  private processManager: IProcessManager;
  private isCurrentlyPlaying = false;
  private currentStreamUrl: string | null = null;
  private currentPosition = 0;
  private currentDuration = 0;
  private currentVolume = 50;
  private positionUpdateInterval: NodeJS.Timeout | null = null;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private readonly socketPath = '/tmp/mpv-socket';

  // Configuration for MPV process
  // Requirements: 2.1, 2.2, 2.8
  private readonly mpvOptions: MpvOptions = {
    socketPath: this.socketPath,
    audioOnly: true,
    volume: this.currentVolume,
    noVideo: true,
    quiet: true,
    inputIpcServer: this.socketPath
  };

  constructor(ipcClient: IIPCClient, processManager: IProcessManager) {
    super();
    this.ipcClient = ipcClient;
    this.processManager = processManager;
    
    // Set up IPC event handling
    this.setupIPCEventHandlers();
  }

  /**
   * Load and start playing a stream URL
   * Requirements: 2.1
   */
  async loadAndPlay(streamUrl: string): Promise<Result<void, PlaybackError>> {
    try {
      // Ensure MPV process is running and connected
      // Requirements: 2.1, 2.7, 2.8
      const setupResult = await this.ensureMpvReady();
      if (!setupResult.success) {
        return { success: false, error: setupResult.error };
      }

      // Stop current playback if any
      if (this.isCurrentlyPlaying) {
        await this.stop();
      }

      // Load the new stream
      const loadCommand: MPVCommand = {
        command: ['loadfile', streamUrl]
      };

      const loadResponse = await this.sendCommandWithRetry(loadCommand);
      if (loadResponse.error !== 'success') {
        console.error('Failed to load stream:', loadResponse.error);
        return { 
          success: false, 
          error: 'STREAM_UNAVAILABLE',
        };
      }

      // Start playback
      const playCommand: MPVCommand = {
        command: ['set_property', 'pause', 'no']
      };

      const playResponse = await this.sendCommandWithRetry(playCommand);
      if (playResponse.error !== 'success') {
        console.error('Failed to start playback:', playResponse.error);
        return { 
          success: false, 
          error: 'MPV_NOT_RESPONDING'
        };
      }

      // Update state
      this.currentStreamUrl = streamUrl;
      this.isCurrentlyPlaying = true;
      this.currentPosition = 0;

      // Start position tracking
      // Requirements: 2.6, 4.4
      this.startPositionTracking();

      // Get duration
      await this.updateDuration();

      // Emit track started event
      // Requirements: 2.4, 2.5
      this.emitEvent('track_started', {
        position: 0
      });

      return { success: true, value: undefined };

    } catch (error) {
      console.error('Load and play failed:', error);
      return { 
        success: false, 
        error: 'PROCESS_CRASHED'
      };
    }
  }

  /**
   * Pause current playback
   * Requirements: 2.3
   */
  async pause(): Promise<Result<void, PlaybackError>> {
    try {
      if (!this.isCurrentlyPlaying) {
        return { success: true, value: undefined };
      }

      const command: MPVCommand = {
        command: ['set_property', 'pause', 'yes']
      };

      const response = await this.sendCommandWithRetry(command);
      if (response.error !== 'success') {
        return { 
          success: false, 
          error: 'MPV_NOT_RESPONDING'
        };
      }

      this.isCurrentlyPlaying = false;
      this.stopPositionTracking();

      // Emit state change event
      // Requirements: 2.4, 2.5, 4.2
      this.emitEvent('state_changed', {
        state: {
          status: 'paused',
          currentTrack: null,
          position: this.currentPosition,
          duration: this.currentDuration,
          volume: this.currentVolume
        }
      });

      return { success: true, value: undefined };

    } catch (error) {
      console.error('Pause failed:', error);
      return { 
        success: false, 
        error: 'IPC_COMMUNICATION_FAILED'
      };
    }
  }

  /**
   * Resume paused playback
   * Requirements: 2.3
   */
  async resume(): Promise<Result<void, PlaybackError>> {
    try {
      if (this.isCurrentlyPlaying) {
        return { success: true, value: undefined };
      }

      const command: MPVCommand = {
        command: ['set_property', 'pause', 'no']
      };

      const response = await this.sendCommandWithRetry(command);
      if (response.error !== 'success') {
        return { 
          success: false, 
          error: 'MPV_NOT_RESPONDING'
        };
      }

      this.isCurrentlyPlaying = true;
      this.startPositionTracking();

      // Emit state change event
      // Requirements: 2.4, 2.5, 4.2
      this.emitEvent('state_changed', {
        state: {
          status: 'playing',
          currentTrack: null,
          position: this.currentPosition,
          duration: this.currentDuration,
          volume: this.currentVolume
        }
      });

      return { success: true, value: undefined };

    } catch (error) {
      console.error('Resume failed:', error);
      return { 
        success: false, 
        error: 'IPC_COMMUNICATION_FAILED'
      };
    }
  }

  /**
   * Stop current playback
   * Requirements: 2.3
   */
  async stop(): Promise<Result<void, PlaybackError>> {
    try {
      if (!this.currentStreamUrl) {
        return { success: true, value: undefined };
      }

      const command: MPVCommand = {
        command: ['stop']
      };

      const response = await this.sendCommandWithRetry(command);
      if (response.error !== 'success') {
        console.warn('Stop command failed, but continuing cleanup:', response.error);
      }

      // Reset state
      this.isCurrentlyPlaying = false;
      this.currentStreamUrl = null;
      this.currentPosition = 0;
      this.currentDuration = 0;
      this.stopPositionTracking();

      // Emit state change event
      // Requirements: 2.4, 2.5, 4.2
      this.emitEvent('state_changed', {
        state: {
          status: 'idle',
          currentTrack: null,
          position: 0,
          duration: 0,
          volume: this.currentVolume
        }
      });

      return { success: true, value: undefined };

    } catch (error) {
      console.error('Stop failed:', error);
      // Still reset state even if command failed
      this.isCurrentlyPlaying = false;
      this.currentStreamUrl = null;
      this.currentPosition = 0;
      this.currentDuration = 0;
      this.stopPositionTracking();
      
      return { 
        success: false, 
        error: 'IPC_COMMUNICATION_FAILED'
      };
    }
  }

  /**
   * Set playback volume (optional - for future admin functionality)
   * Requirements: 2.3
   */
  async setVolume(level: number): Promise<Result<void, PlaybackError>> {
    try {
      // Validate volume level
      const volume = Math.max(0, Math.min(100, level));

      const command: MPVCommand = {
        command: ['set_property', 'volume', volume.toString()]
      };

      const response = await this.sendCommandWithRetry(command);
      if (response.error !== 'success') {
        return { 
          success: false, 
          error: 'MPV_NOT_RESPONDING'
        };
      }

      this.currentVolume = volume;

      // Emit state change event
      // Requirements: 2.4, 2.5, 4.2
      this.emitEvent('state_changed', {
        state: {
          status: this.isCurrentlyPlaying ? 'playing' : 'idle',
          currentTrack: null,
          position: this.currentPosition,
          duration: this.currentDuration,
          volume: this.currentVolume
        }
      });

      return { success: true, value: undefined };

    } catch (error) {
      console.error('Set volume failed:', error);
      return { 
        success: false, 
        error: 'IPC_COMMUNICATION_FAILED'
      };
    }
  }

  /**
   * Get current playback position in seconds
   * Requirements: 2.6
   */
  async getPosition(): Promise<number> {
    try {
      const command: MPVCommand = {
        command: ['get_property', 'time-pos']
      };

      const response = await this.sendCommandWithRetry(command);
      if (response.error === 'success' && typeof response.data === 'number') {
        this.currentPosition = response.data;
        return response.data;
      }

      // Return cached position if command fails
      return this.currentPosition;

    } catch (error) {
      console.error('Get position failed:', error);
      return this.currentPosition;
    }
  }

  /**
   * Get total duration in seconds
   * Requirements: 2.6
   */
  async getDuration(): Promise<number> {
    try {
      const command: MPVCommand = {
        command: ['get_property', 'duration']
      };

      const response = await this.sendCommandWithRetry(command);
      if (response.error === 'success' && typeof response.data === 'number') {
        this.currentDuration = response.data;
        return response.data;
      }

      // Return cached duration if command fails
      return this.currentDuration;

    } catch (error) {
      console.error('Get duration failed:', error);
      return this.currentDuration;
    }
  }

  /**
   * Check if currently playing
   * Requirements: 4.1, 4.6
   */
  isPlaying(): boolean {
    return this.isCurrentlyPlaying;
  }

  /**
   * Add event listener for playback events
   * Requirements: 2.4, 2.5, 4.2, 4.4, 5.7
   */
  addEventListener(listener: PlaybackEventListener): void {
    this.on('playback_event', listener);
  }

  /**
   * Remove event listener
   */
  removeEventListener(listener: PlaybackEventListener): void {
    this.off('playback_event', listener);
  }

  /**
   * Ensure MPV process is running and IPC is connected
   * Requirements: 2.1, 2.7, 2.8
   */
  private async ensureMpvReady(): Promise<Result<void, PlaybackError>> {
    try {
      // Check if IPC is connected
      if (!this.ipcClient.isConnected()) {
        // Start MPV process if not running
        const startResult = await this.processManager.startMpv(this.mpvOptions);
        if (!startResult.success) {
          console.error('Failed to start MPV:', startResult.error);
          return { success: false, error: 'PROCESS_CRASHED' };
        }

        // Wait a moment for MPV to create the socket
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Connect IPC client
        try {
          await this.ipcClient.connect(this.socketPath);
        } catch (error) {
          console.error('Failed to connect IPC:', error);
          return { success: false, error: 'IPC_COMMUNICATION_FAILED' };
        }

        // Start health monitoring
        this.startHealthMonitoring();
      }

      return { success: true, value: undefined };

    } catch (error) {
      console.error('Ensure MPV ready failed:', error);
      return { success: false, error: 'PROCESS_CRASHED' };
    }
  }

  /**
   * Send command with retry logic for reliability
   * Requirements: 2.6, 2.7, 5.3
   */
  private async sendCommandWithRetry(command: MPVCommand, maxRetries = 2): Promise<MPVResponse> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Ensure connection is ready
        if (!this.ipcClient.isConnected()) {
          const setupResult = await this.ensureMpvReady();
          if (!setupResult.success) {
            throw new Error(`Setup failed: ${setupResult.error}`);
          }
        }

        const response = await this.ipcClient.sendCommand(command);
        return response;

      } catch (error) {
        lastError = error as Error;
        console.warn(`Command attempt ${attempt + 1} failed:`, error);

        // If not the last attempt, try to recover
        if (attempt < maxRetries) {
          // Try to restart MPV and reconnect
          try {
            await this.recoverConnection();
          } catch (recoveryError) {
            console.error('Recovery failed:', recoveryError);
          }
        }
      }
    }

    // All retries failed
    throw lastError || new Error('Command failed after retries');
  }

  /**
   * Recover connection by restarting MPV process
   * Requirements: 2.7, 5.3, 7.2, 7.3
   */
  private async recoverConnection(): Promise<void> {
    try {
      console.log('Attempting to recover MPV connection...');

      // Disconnect IPC first
      if (this.ipcClient.isConnected()) {
        await this.ipcClient.disconnect();
      }

      // Restart MPV process
      const restartResult = await this.processManager.restartMpv();
      if (!restartResult.success) {
        throw new Error(`Failed to restart MPV: ${restartResult.error}`);
      }

      // Wait for socket to be ready
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Reconnect IPC
      await this.ipcClient.connect(this.socketPath);

      console.log('MPV connection recovered successfully');

    } catch (error) {
      console.error('Failed to recover MPV connection:', error);
      throw error;
    }
  }

  /**
   * Set up IPC event handlers for MPV responses
   * Requirements: 2.4, 2.5, 2.6
   */
  private setupIPCEventHandlers(): void {
    this.ipcClient.addEventListener((response: MPVResponse) => {
      // Handle MPV events (not command responses)
      if (response.request_id === undefined) {
        this.handleMpvEvent(response);
      }
    });
  }

  /**
   * Handle events from MPV (not command responses)
   * Requirements: 2.4, 2.5
   */
  private handleMpvEvent(response: MPVResponse): void {
    try {
      // Handle playback-finished event
      if (response.data && typeof response.data === 'object') {
        const eventData = response.data as any;
        
        if (eventData.event === 'playback-restart') {
          // Track started playing
          this.emitEvent('track_started', {
            position: 0
          });
        } else if (eventData.event === 'end-file') {
          // Track finished
          this.isCurrentlyPlaying = false;
          this.stopPositionTracking();
          
          this.emitEvent('track_finished', {
            position: this.currentPosition
          });
        } else if (eventData.event === 'file-loaded') {
          // File loaded successfully
          this.updateDuration();
        }
      }
    } catch (error) {
      console.error('Error handling MPV event:', error);
    }
  }

  /**
   * Start periodic position tracking
   * Requirements: 2.6, 4.4
   */
  private startPositionTracking(): void {
    if (this.positionUpdateInterval) {
      return;
    }

    this.positionUpdateInterval = setInterval(async () => {
      if (this.isCurrentlyPlaying) {
        try {
          const position = await this.getPosition();
          
          // Emit progress update
          // Requirements: 4.4, 5.7
          this.emitEvent('progress_update', {
            position,
            state: {
              status: 'playing',
              currentTrack: null,
              position,
              duration: this.currentDuration,
              volume: this.currentVolume
            }
          });
        } catch (error) {
          console.error('Position tracking error:', error);
        }
      }
    }, 1000); // Update every second
  }

  /**
   * Stop position tracking
   */
  private stopPositionTracking(): void {
    if (this.positionUpdateInterval) {
      clearInterval(this.positionUpdateInterval);
      this.positionUpdateInterval = null;
    }
  }

  /**
   * Start health monitoring for MPV process
   * Requirements: 2.7, 5.3, 7.2, 7.3
   */
  private startHealthMonitoring(): void {
    if (this.healthCheckInterval) {
      return;
    }

    this.healthCheckInterval = setInterval(async () => {
      try {
        // Simple health check - try to get a property
        const command: MPVCommand = {
          command: ['get_property', 'pause']
        };

        const response = await this.ipcClient.sendCommand(command);
        
        // If command fails, MPV might be unresponsive
        if (response.error !== 'success') {
          console.warn('MPV health check failed, attempting recovery');
          await this.recoverConnection();
        }
      } catch (error) {
        console.error('Health check failed:', error);
        // Emit error event
        this.emitEvent('error_occurred', {
          error: 'MPV_NOT_RESPONDING' as PlaybackError
        });
      }
    }, 30000); // Check every 30 seconds
  }

  /**
   * Update cached duration from MPV
   * Requirements: 2.6
   */
  private async updateDuration(): Promise<void> {
    try {
      await this.getDuration();
    } catch (error) {
      console.error('Failed to update duration:', error);
    }
  }

  /**
   * Emit a playback event
   * Requirements: 2.4, 2.5, 4.2, 4.4, 5.7
   */
  private emitEvent(type: PlaybackEvent['type'], data: PlaybackEvent['data']): void {
    const event: PlaybackEvent = {
      type,
      timestamp: new Date(),
      data
    };

    this.emit('playback_event', event);
  }

  /**
   * Cleanup resources when controller is destroyed
   * Requirements: 6.5, 7.4
   */
  async cleanup(): Promise<void> {
    try {
      // Stop tracking
      this.stopPositionTracking();
      
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
        this.healthCheckInterval = null;
      }

      // Stop playback
      await this.stop();

      // Disconnect IPC
      if (this.ipcClient.isConnected()) {
        await this.ipcClient.disconnect();
      }

      // Remove all listeners
      this.removeAllListeners();

    } catch (error) {
      console.error('PlaybackController cleanup failed:', error);
    }
  }
}