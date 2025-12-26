/**
 * PlaybackOrchestrator - Central coordinator for music playback
 * Integrates queue management with stream resolution and playback control
 * Requirements: 3.1, 3.2, 3.4, 3.6, 4.1, 4.3
 */

import { EventEmitter } from 'events';
import { Result, QueueItem } from '@party-jukebox/shared';
import { IQueueService } from './QueueService';
import { IPlaybackOrchestrator, IStreamResolver, IPlaybackController } from '../domain/playback/interfaces';
import { 
  PlaybackState, 
  PlaybackEvent, 
  PlaybackEventListener 
} from '../domain/playback/types';
import { 
  OrchestrationError, 
  PlaybackError, 
  ResolutionError 
} from '../domain/playback/errors';

/**
 * PlaybackOrchestrator implementation
 * Coordinates queue system with stream resolution and playback
 * Requirements: 3.1, 3.2, 3.4, 3.6, 4.1, 4.3
 */
export class PlaybackOrchestrator extends EventEmitter implements IPlaybackOrchestrator {
  private readonly queueService: IQueueService;
  private readonly streamResolver: IStreamResolver;
  private readonly playbackController: IPlaybackController;
  
  private isRunning = false;
  private currentTrack: QueueItem | null = null;
  private currentState: PlaybackState;
  private queueMonitorInterval: NodeJS.Timeout | null = null;
  private isProcessingTrack = false;

  constructor(
    queueService: IQueueService,
    streamResolver: IStreamResolver,
    playbackController: IPlaybackController
  ) {
    super();
    this.queueService = queueService;
    this.streamResolver = streamResolver;
    this.playbackController = playbackController;
    
    // Initialize state
    this.currentState = {
      status: 'idle',
      currentTrack: null,
      position: 0,
      duration: 0,
      volume: 50
    };

    // Set up playback controller event handlers
    this.setupPlaybackEventHandlers();
  }

  /**
   * Start the orchestrator and begin monitoring queue
   * Requirements: 3.1, 3.6
   */
  async start(): Promise<Result<void, OrchestrationError>> {
    try {
      if (this.isRunning) {
        return { success: true, value: undefined };
      }

      console.log('Starting PlaybackOrchestrator...');
      this.isRunning = true;

      // Start monitoring queue for changes
      this.startQueueMonitoring();

      // Check if there's already a current track to play
      await this.checkAndStartPlayback();

      // Emit state change event
      this.emitStateChange();

      console.log('PlaybackOrchestrator started successfully');
      return { success: true, value: undefined };

    } catch (error) {
      console.error('Failed to start PlaybackOrchestrator:', error);
      this.isRunning = false;
      return { 
        success: false, 
        error: 'PROCESS_CRASHED'
      };
    }
  }

  /**
   * Stop the orchestrator and cleanup
   * Requirements: 3.4
   */
  async stop(): Promise<Result<void, OrchestrationError>> {
    try {
      console.log('Stopping PlaybackOrchestrator...');
      this.isRunning = false;

      // Stop queue monitoring first
      if (this.queueMonitorInterval) {
        clearInterval(this.queueMonitorInterval);
        this.queueMonitorInterval = null;
      }

      // Wait a bit to ensure any pending interval callbacks complete
      await new Promise(resolve => setTimeout(resolve, 10));

      // Stop current playback
      await this.playbackController.stop();

      // Reset state
      this.currentTrack = null;
      this.currentState = {
        status: 'idle',
        currentTrack: null,
        position: 0,
        duration: 0,
        volume: this.currentState.volume
      };

      // Emit final state change
      this.emitStateChange();

      console.log('PlaybackOrchestrator stopped successfully');
      return { success: true, value: undefined };

    } catch (error) {
      console.error('Failed to stop PlaybackOrchestrator:', error);
      return { 
        success: false, 
        error: 'PROCESS_CRASHED'
      };
    }
  }

  /**
   * Pause current playback
   * Requirements: 2.3, 4.5
   */
  async pause(): Promise<Result<void, OrchestrationError>> {
    try {
      if (!this.playbackController.isPlaying()) {
        return { success: true, value: undefined };
      }

      const result = await this.playbackController.pause();
      if (!result.success) {
        return { 
          success: false, 
          error: result.error
        };
      }

      // Update state
      this.currentState = {
        ...this.currentState,
        status: 'paused'
      };

      this.emitStateChange();
      return { success: true, value: undefined };

    } catch (error) {
      console.error('Failed to pause playback:', error);
      return { 
        success: false, 
        error: 'MPV_NOT_RESPONDING'
      };
    }
  }

  /**
   * Resume paused playback
   * Requirements: 2.3, 4.5
   */
  async resume(): Promise<Result<void, OrchestrationError>> {
    try {
      if (this.playbackController.isPlaying()) {
        return { success: true, value: undefined };
      }

      const result = await this.playbackController.resume();
      if (!result.success) {
        return { 
          success: false, 
          error: result.error
        };
      }

      // Update state
      this.currentState = {
        ...this.currentState,
        status: 'playing'
      };

      this.emitStateChange();
      return { success: true, value: undefined };

    } catch (error) {
      console.error('Failed to resume playback:', error);
      return { 
        success: false, 
        error: 'MPV_NOT_RESPONDING'
      };
    }
  }

  /**
   * Skip to next track
   * Requirements: 3.2, 3.3, 5.1, 5.2
   */
  async skip(): Promise<Result<void, OrchestrationError>> {
    try {
      console.log('Skipping to next track...');

      // Prevent concurrent skip operations
      if (this.isProcessingTrack) {
        console.log('Skip already in progress, ignoring duplicate request');
        return { success: true, value: undefined };
      }

      // Set processing flag to prevent queue monitoring and handleTrackFinished from interfering
      this.isProcessingTrack = true;

      try {
        // First, advance the queue to get the next track BEFORE stopping current playback
        // This prevents the race condition where stop() triggers end-file -> handleTrackFinished -> advanceToNextTrack
        const advanceResult = this.queueService.advanceToNextTrack();
        
        if (!advanceResult.success || !advanceResult.value) {
          console.log('No more tracks in queue');
          // Stop current playback since there's nothing to play next
          await this.playbackController.stop();
          this.handleEmptyQueue();
          this.isProcessingTrack = false;
          return { success: true, value: undefined };
        }

        const nextTrack = advanceResult.value;
        console.log(`Next track to play: ${nextTrack.track.title}`);

        // Now stop current playback (this may trigger end-file events, but we ignore them due to isProcessingTrack)
        await this.playbackController.stop();

        // Start playing the next track
        await this.startPlayingTrack(nextTrack, true); // Allow during processing

        // Keep processing flag true for a bit longer to ensure any delayed end-file events 
        // from the stop operation are ignored by handleTrackFinished
        setTimeout(() => {
          this.isProcessingTrack = false;
        }, 1000); // Wait 1 second before allowing handleTrackFinished to process events

        return { success: true, value: undefined };

      } catch (error) {
        // Reset processing flag on error
        this.isProcessingTrack = false;
        throw error;
      }

    } catch (error) {
      console.error('Failed to skip track:', error);
      this.isProcessingTrack = false;
      return { 
        success: false, 
        error: 'PROCESS_CRASHED'
      };
    }
  }

  /**
   * Set volume (optional - for future admin functionality)
   * Requirements: 2.3
   */
  async setVolume(level: number): Promise<Result<void, OrchestrationError>> {
    try {
      if (!this.playbackController.setVolume) {
        return { 
          success: false, 
          error: 'MPV_NOT_RESPONDING'
        };
      }

      const result = await this.playbackController.setVolume(level);
      if (!result.success) {
        return { 
          success: false, 
          error: result.error
        };
      }

      // Update state
      this.currentState = {
        ...this.currentState,
        volume: level
      };

      this.emitStateChange();
      return { success: true, value: undefined };

    } catch (error) {
      console.error('Failed to set volume:', error);
      return { 
        success: false, 
        error: 'MPV_NOT_RESPONDING'
      };
    }
  }

  /**
   * Get current playback state
   * Requirements: 4.1, 4.2, 4.3, 4.6
   */
  getCurrentState(): PlaybackState {
    return {
      ...this.currentState,
      currentTrack: this.currentTrack
    };
  }

  /**
   * Add event listener for orchestrator events
   * Requirements: 4.2, 4.4, 5.7
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
   * Set up event handlers for playback controller events
   * Requirements: 2.4, 2.5, 3.2, 4.2
   */
  private setupPlaybackEventHandlers(): void {
    this.playbackController.addEventListener((event: PlaybackEvent) => {
      switch (event.type) {
        case 'track_finished':
          this.handleTrackFinished();
          break;
        
        case 'track_failed':
          this.handleTrackFailed(event.data.error);
          break;
        
        case 'state_changed':
        case 'progress_update':
          this.handlePlaybackStateUpdate(event);
          break;
        
        case 'error_occurred':
          this.handlePlaybackError(event.data.error);
          break;
      }
    });
  }

  /**
   * Start monitoring queue for changes
   * Requirements: 3.1, 3.6
   */
  private startQueueMonitoring(): void {
    if (this.queueMonitorInterval) {
      return;
    }

    this.queueMonitorInterval = setInterval(async () => {
      // Check if we're still running before doing any work
      if (!this.isRunning) {
        return;
      }

      try {
        // Check if we should start playback when queue has tracks but we're idle
        if (!this.playbackController.isPlaying() && !this.isProcessingTrack) {
          await this.checkAndStartPlayback();
        }
      } catch (error) {
        // Only log if we're still running to avoid "Cannot log after tests are done"
        if (this.isRunning) {
          console.error('Error in queue monitoring:', error);
        }
      }
    }, 2000); // Check every 2 seconds
  }

  /**
   * Check queue state and start playback if needed
   * Requirements: 3.1, 3.6
   */
  private async checkAndStartPlayback(): Promise<void> {
    try {
      if (this.isProcessingTrack) {
        return;
      }

      const queueState = this.queueService.getQueueState();
      
      // If queue is empty, handle empty state
      if (queueState.isEmpty) {
        this.handleEmptyQueue();
        return;
      }

      // If we have a current track and it's different from what we're tracking
      if (queueState.currentTrack && queueState.currentTrack !== this.currentTrack) {
        await this.startPlayingTrack(queueState.currentTrack);
      }
      // REMOVED: Auto-advance logic that was causing double-advancement
      // The queue monitoring should only start existing tracks, not advance the queue
      // Queue advancement should only happen through explicit operations (skip, track finished)
      // If there's no current track but queue has tracks, we should NOT auto-advance
      // This prevents the race condition where skip + monitoring both advance the queue

    } catch (error) {
      console.error('Error checking and starting playback:', error);
      this.handlePlaybackError('PROCESS_CRASHED');
    }
  }

  /**
   * Start playing a specific track
   * Requirements: 3.1, 1.1, 2.1
   */
  private async startPlayingTrack(track: QueueItem, allowDuringProcessing = false): Promise<void> {
    if (!allowDuringProcessing && (this.isProcessingTrack || !this.isRunning)) {
      return;
    }

    if (!this.isRunning) {
      return;
    }

    // Only set processing flag if not already set (e.g., during skip operations)
    const wasProcessing = this.isProcessingTrack;
    if (!wasProcessing) {
      this.isProcessingTrack = true;
    }
    
    this.currentTrack = track;

    try {
      if (this.isRunning) {
        console.log(`Starting playback for track: ${track.track.title}`);
      }

      // Update state to resolving
      this.currentState = {
        ...this.currentState,
        status: 'resolving',
        currentTrack: track,
        position: 0,
        duration: 0
      };
      this.emitStateChange();

      // Resolve stream URL
      const resolutionResult = await this.streamResolver.resolveStream(track.track.sourceUrl);
      
      if (!resolutionResult.success) {
        if (this.isRunning) {
          console.error(`Failed to resolve stream for track ${track.track.title}:`, resolutionResult.error);
        }
        await this.handleTrackResolutionFailure(resolutionResult.error);
        return;
      }

      const resolvedStream = resolutionResult.value;
      if (this.isRunning) {
        console.log(`Stream resolved for track: ${track.track.title}`);
      }

      // Update duration from resolved stream
      this.currentState = {
        ...this.currentState,
        duration: resolvedStream.duration
      };

      // Start playback
      const playbackResult = await this.playbackController.loadAndPlay(resolvedStream.streamUrl);
      
      if (!playbackResult.success) {
        if (this.isRunning) {
          console.error(`Failed to start playback for track ${track.track.title}:`, playbackResult.error);
        }
        await this.handleTrackPlaybackFailure(playbackResult.error);
        return;
      }

      // Update state to playing
      this.currentState = {
        ...this.currentState,
        status: 'playing'
      };
      this.emitStateChange();

      if (this.isRunning) {
        console.log(`Successfully started playback for track: ${track.track.title}`);
      }

    } catch (error) {
      if (this.isRunning) {
        console.error(`Error starting playback for track ${track.track.title}:`, error);
      }
      await this.handleTrackPlaybackFailure('PROCESS_CRASHED');
    } finally {
      // Only reset processing flag if we set it (not during skip operations)
      if (!wasProcessing) {
        this.isProcessingTrack = false;
      }
    }
  }

  /**
   * Handle track finished event from playback controller
   * Requirements: 3.2, 4.1
   */
  private async handleTrackFinished(): Promise<void> {
    try {
      // Don't auto-advance if we're in the middle of processing a track (e.g., during skip)
      if (this.isProcessingTrack) {
        console.log('Track finished during track processing (skip), ignoring auto-advance');
        return;
      }

      console.log('Track finished, advancing to next track');

      // Advance queue to next track
      const advanceResult = this.queueService.advanceToNextTrack();
      
      if (!advanceResult.success || !advanceResult.value) {
        console.log('No more tracks in queue');
        this.handleEmptyQueue();
        return;
      }

      // Start playing next track
      await this.startPlayingTrack(advanceResult.value);

    } catch (error) {
      console.error('Error handling track finished:', error);
      this.handlePlaybackError('PROCESS_CRASHED');
    }
  }

  /**
   * Handle track failed event from playback controller
   * Requirements: 3.3, 5.1, 5.2
   */
  private async handleTrackFailed(error?: PlaybackError): Promise<void> {
    console.error('Track failed during playback:', error);
    await this.handleTrackPlaybackFailure(error || 'PROCESS_CRASHED');
  }

  /**
   * Handle track resolution failure and skip to next
   * Requirements: 3.3, 5.1, 5.2
   */
  private async handleTrackResolutionFailure(error: ResolutionError): Promise<void> {
    console.error('Track resolution failed, skipping to next track:', error);

    // Log the error with track context
    if (this.currentTrack) {
      console.error(`Failed to resolve track: ${this.currentTrack.track.title} (${this.currentTrack.track.sourceUrl})`);
    }

    // Emit error event
    this.emitErrorEvent(error);

    // Skip to next track
    await this.skipToNextTrack();
  }

  /**
   * Handle track playback failure and skip to next
   * Requirements: 3.3, 5.1, 5.2
   */
  private async handleTrackPlaybackFailure(error: PlaybackError): Promise<void> {
    console.error('Track playback failed, skipping to next track:', error);

    // Log the error with track context
    if (this.currentTrack) {
      console.error(`Failed to play track: ${this.currentTrack.track.title}`);
    }

    // Emit error event
    this.emitErrorEvent(error);

    // Skip to next track
    await this.skipToNextTrack();
  }

  /**
   * Skip to next track after failure
   * Requirements: 3.3, 5.1, 5.2
   */
  private async skipToNextTrack(): Promise<void> {
    try {
      // Advance queue
      const advanceResult = this.queueService.advanceToNextTrack();
      
      if (!advanceResult.success || !advanceResult.value) {
        console.log('No more tracks in queue after skip');
        this.handleEmptyQueue();
        return;
      }

      // Start playing next track
      await this.startPlayingTrack(advanceResult.value);

    } catch (error) {
      console.error('Error skipping to next track:', error);
      this.handleEmptyQueue();
    }
  }

  /**
   * Handle empty queue state
   * Requirements: 3.4
   */
  private handleEmptyQueue(): void {
    if (this.isRunning) {
      console.log('Queue is empty, stopping playback');
    }

    this.currentTrack = null;
    this.currentState = {
      status: 'idle',
      currentTrack: null,
      position: 0,
      duration: 0,
      volume: this.currentState.volume
    };

    this.emitStateChange();
  }

  /**
   * Handle playback state updates from controller
   * Requirements: 4.2, 4.4
   */
  private handlePlaybackStateUpdate(event: PlaybackEvent): void {
    if (event.data.state) {
      // Update our state with controller state, but keep our track info
      this.currentState = {
        ...event.data.state,
        currentTrack: this.currentTrack
      };
      
      // Forward the event to our listeners
      this.emitEvent(event);
    }
  }

  /**
   * Handle playback errors
   * Requirements: 5.1, 5.2, 5.7
   */
  private handlePlaybackError(error?: PlaybackError): void {
    console.error('Playback error occurred:', error);
    
    this.currentState = {
      ...this.currentState,
      status: 'error',
      error: error || 'PROCESS_CRASHED'
    };

    this.emitErrorEvent(error || 'PROCESS_CRASHED');
  }

  /**
   * Emit state change event
   * Requirements: 4.2, 4.4, 5.7
   */
  private emitStateChange(): void {
    const event: PlaybackEvent = {
      type: 'state_changed',
      timestamp: new Date(),
      data: {
        state: this.getCurrentState()
      }
    };

    this.emitEvent(event);
  }

  /**
   * Emit error event
   * Requirements: 5.7
   */
  private emitErrorEvent(error: OrchestrationError): void {
    const event: PlaybackEvent = {
      type: 'error_occurred',
      timestamp: new Date(),
      data: {
        error: error as PlaybackError,
        state: this.getCurrentState()
      }
    };

    this.emitEvent(event);
  }

  /**
   * Emit a playback event to listeners
   * Requirements: 4.2, 4.4, 5.7
   */
  private emitEvent(event: PlaybackEvent): void {
    try {
      // Emit event asynchronously to ensure non-blocking delivery
      process.nextTick(() => {
        this.emit('playback_event', event);
      });
    } catch (error) {
      // Prevent event emission errors from crashing the system
      console.error('Failed to emit orchestrator event:', error);
    }
  }

  /**
   * Cleanup resources when orchestrator is destroyed
   * Requirements: 6.5, 7.4
   */
  async cleanup(): Promise<void> {
    try {
      await this.stop();
      this.removeAllListeners();
    } catch (error) {
      console.error('PlaybackOrchestrator cleanup failed:', error);
    }
  }
}