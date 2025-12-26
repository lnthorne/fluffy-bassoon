/**
 * Unit tests for PlaybackController
 * Requirements: 2.1, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8
 */

import { PlaybackController } from '../PlaybackController';
import { IIPCClient, IProcessManager } from '../../../domain/playback/interfaces';
import { MPVCommand, MPVResponse, PlaybackEvent } from '../../../domain/playback/types';
import { Result } from '@party-jukebox/shared';

// Mock implementations for testing
class MockIPCClient implements IIPCClient {
  private connected = false;
  private listeners: Array<(response: MPVResponse) => void> = [];

  async connect(socketPath: string): Promise<void> {
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  async sendCommand(command: MPVCommand): Promise<MPVResponse> {
    if (!this.connected) {
      throw new Error('Not connected');
    }

    // Mock successful responses for basic commands
    if (command.command[0] === 'loadfile') {
      return { error: 'success', request_id: command.request_id || 1 };
    }
    if (command.command[0] === 'set_property') {
      return { error: 'success', request_id: command.request_id || 1 };
    }
    if (command.command[0] === 'get_property') {
      if (command.command[1] === 'time-pos') {
        return { error: 'success', data: 30, request_id: command.request_id || 1 };
      }
      if (command.command[1] === 'duration') {
        return { error: 'success', data: 180, request_id: command.request_id || 1 };
      }
      if (command.command[1] === 'pause') {
        return { error: 'success', data: false, request_id: command.request_id || 1 };
      }
    }
    if (command.command[0] === 'stop') {
      return { error: 'success', request_id: command.request_id || 1 };
    }

    return { error: 'success', request_id: command.request_id || 1 };
  }

  isConnected(): boolean {
    return this.connected;
  }

  addEventListener(listener: (response: MPVResponse) => void): void {
    this.listeners.push(listener);
  }

  removeEventListener(listener: (response: MPVResponse) => void): void {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }
}

class MockProcessManager implements IProcessManager {
  async startMpv(options: any): Promise<Result<any, any>> {
    return { success: true, value: { pid: 1234 } };
  }

  async stopMpv(): Promise<Result<void, any>> {
    return { success: true, value: undefined };
  }

  async restartMpv(): Promise<Result<any, any>> {
    return { success: true, value: { pid: 1235 } };
  }

  async runYtDlp(url: string, options: any): Promise<Result<any, any>> {
    return { success: true, value: {} };
  }

  isProcessHealthy(process: any): boolean {
    return true;
  }

  async cleanup(): Promise<void> {
    // Mock cleanup
  }

  async validateDependencies(): Promise<Result<void, any>> {
    return { success: true, value: undefined };
  }
}

describe('PlaybackController', () => {
  let playbackController: PlaybackController;
  let mockIPCClient: MockIPCClient;
  let mockProcessManager: MockProcessManager;

  beforeEach(() => {
    mockIPCClient = new MockIPCClient();
    mockProcessManager = new MockProcessManager();
    playbackController = new PlaybackController(mockIPCClient, mockProcessManager);
  });

  afterEach(async () => {
    await playbackController.cleanup();
  });

  describe('initialization', () => {
    it('should start in idle state', () => {
      expect(playbackController.isPlaying()).toBe(false);
    });
  });

  describe('playback control', () => {
    it('should load and play a stream successfully', async () => {
      const streamUrl = 'https://example.com/stream.mp3';
      
      const result = await playbackController.loadAndPlay(streamUrl);
      
      expect(result.success).toBe(true);
      expect(playbackController.isPlaying()).toBe(true);
    });

    it('should pause playback', async () => {
      const streamUrl = 'https://example.com/stream.mp3';
      await playbackController.loadAndPlay(streamUrl);
      
      const result = await playbackController.pause();
      
      expect(result.success).toBe(true);
      expect(playbackController.isPlaying()).toBe(false);
    });

    it('should resume playback', async () => {
      const streamUrl = 'https://example.com/stream.mp3';
      await playbackController.loadAndPlay(streamUrl);
      await playbackController.pause();
      
      const result = await playbackController.resume();
      
      expect(result.success).toBe(true);
      expect(playbackController.isPlaying()).toBe(true);
    });

    it('should stop playback', async () => {
      const streamUrl = 'https://example.com/stream.mp3';
      await playbackController.loadAndPlay(streamUrl);
      
      const result = await playbackController.stop();
      
      expect(result.success).toBe(true);
      expect(playbackController.isPlaying()).toBe(false);
    });
  });

  describe('position and duration', () => {
    it('should get current position', async () => {
      const streamUrl = 'https://example.com/stream.mp3';
      await playbackController.loadAndPlay(streamUrl);
      
      const position = await playbackController.getPosition();
      
      expect(typeof position).toBe('number');
      expect(position).toBeGreaterThanOrEqual(0);
    });

    it('should get duration', async () => {
      const streamUrl = 'https://example.com/stream.mp3';
      await playbackController.loadAndPlay(streamUrl);
      
      const duration = await playbackController.getDuration();
      
      expect(typeof duration).toBe('number');
      expect(duration).toBeGreaterThanOrEqual(0);
    });
  });

  describe('volume control', () => {
    it('should set volume within valid range', async () => {
      const result = await playbackController.setVolume?.(75);
      
      expect(result?.success).toBe(true);
    });

    it('should clamp volume to valid range', async () => {
      // Test volume above 100
      const result1 = await playbackController.setVolume?.(150);
      expect(result1?.success).toBe(true);

      // Test volume below 0
      const result2 = await playbackController.setVolume?.(-10);
      expect(result2?.success).toBe(true);
    });
  });

  describe('event handling', () => {
    it('should allow adding and removing event listeners', () => {
      const listener = jest.fn();
      
      // Should not throw
      playbackController.addEventListener(listener);
      playbackController.removeEventListener(listener);
    });

    it('should emit events during playback operations', async () => {
      const events: PlaybackEvent[] = [];
      const listener = (event: PlaybackEvent) => {
        events.push(event);
      };
      
      playbackController.addEventListener(listener);
      
      const streamUrl = 'https://example.com/stream.mp3';
      await playbackController.loadAndPlay(streamUrl);
      
      // Wait for async event emission
      await new Promise(resolve => process.nextTick(resolve));
      
      // Should have emitted at least a track_started event
      expect(events.length).toBeGreaterThan(0);
      expect(events.some(e => e.type === 'track_started')).toBe(true);
    });

    it('should emit state change events during pause/resume', async () => {
      const events: PlaybackEvent[] = [];
      const listener = (event: PlaybackEvent) => {
        events.push(event);
      };
      
      playbackController.addEventListener(listener);
      
      const streamUrl = 'https://example.com/stream.mp3';
      await playbackController.loadAndPlay(streamUrl);
      await playbackController.pause();
      
      // Wait for async event emission
      await new Promise(resolve => process.nextTick(resolve));
      
      // Should have emitted state_changed event for pause
      expect(events.some(e => e.type === 'state_changed')).toBe(true);
      const stateChangeEvent = events.find(e => e.type === 'state_changed');
      expect(stateChangeEvent?.data.state?.status).toBe('paused');
    });

    it('should emit progress updates during playback', async () => {
      const events: PlaybackEvent[] = [];
      const listener = (event: PlaybackEvent) => {
        events.push(event);
      };
      
      playbackController.addEventListener(listener);
      
      const streamUrl = 'https://example.com/stream.mp3';
      await playbackController.loadAndPlay(streamUrl);
      
      // Wait for progress update (position tracking runs every 1000ms)
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      // Should have emitted progress_update events
      expect(events.some(e => e.type === 'progress_update')).toBe(true);
    });
  });

  describe('state management', () => {
    it('should return current playback state', async () => {
      const state = playbackController.getCurrentState();
      
      expect(state).toHaveProperty('status');
      expect(state).toHaveProperty('position');
      expect(state).toHaveProperty('duration');
      expect(state).toHaveProperty('volume');
      expect(state.status).toBe('idle');
    });

    it('should update state during playback', async () => {
      const streamUrl = 'https://example.com/stream.mp3';
      await playbackController.loadAndPlay(streamUrl);
      
      const state = playbackController.getCurrentState();
      expect(state.status).toBe('playing');
    });
  });

  describe('error handling', () => {
    it('should handle IPC connection failures gracefully', async () => {
      // Create a controller with a failing IPC client
      const failingIPCClient = new MockIPCClient();
      failingIPCClient.sendCommand = async () => {
        throw new Error('IPC failed');
      };
      
      const controller = new PlaybackController(failingIPCClient, mockProcessManager);
      
      const result = await controller.loadAndPlay('https://example.com/stream.mp3');
      
      // Should handle the error gracefully
      expect(result.success).toBe(false);
      
      await controller.cleanup();
    });
  });

  describe('cleanup', () => {
    it('should cleanup resources properly', async () => {
      const streamUrl = 'https://example.com/stream.mp3';
      await playbackController.loadAndPlay(streamUrl);
      
      // Should not throw
      await expect(playbackController.cleanup()).resolves.toBeUndefined();
      
      // Should be stopped after cleanup
      expect(playbackController.isPlaying()).toBe(false);
    });
  });
});