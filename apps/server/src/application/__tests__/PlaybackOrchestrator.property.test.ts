/**
 * Property-based tests for PlaybackOrchestrator
 * Feature: music-playback
 */

import * as fc from 'fast-check';
import { PlaybackOrchestrator } from '../PlaybackOrchestrator';
import { QueueService } from '../QueueService';
import { QueueManager } from '../QueueManager';
import { RateLimiter } from '../RateLimiter';
import { TrackValidator, UserValidator } from '@party-jukebox/shared';
import { IStreamResolver, IPlaybackController } from '../../domain/playback/interfaces';
import { PlaybackState, ResolvedStream, PlaybackEvent } from '../../domain/playback/types';
import { ResolutionError, PlaybackError } from '../../domain/playback/errors';
import { Result } from '@party-jukebox/shared';

// Mock implementations for testing
class MockStreamResolver implements IStreamResolver {
  async resolveStream(youtubeUrl: string): Promise<Result<ResolvedStream, ResolutionError>> {
    await new Promise(resolve => setTimeout(resolve, 10));
    return {
      success: true,
      value: {
        streamUrl: `https://example.com/stream/${youtubeUrl.split('=')[1]}.opus`,
        title: `Mock Song for ${youtubeUrl}`,
        duration: 180,
        format: 'opus',
        quality: 'best'
      }
    };
  }

  async validateStream(streamUrl: string): Promise<boolean> {
    return true;
  }

  clearCache(): void {}
}

class MockPlaybackController implements IPlaybackController {
  private playing = false;
  private listeners: Array<(event: PlaybackEvent) => void> = [];

  async loadAndPlay(streamUrl: string): Promise<Result<void, PlaybackError>> {
    this.playing = true;
    this.emitEvent({
      type: 'track_started',
      timestamp: new Date(),
      data: { state: this.getCurrentState() }
    });
    return { success: true, value: undefined };
  }

  async pause(): Promise<Result<void, PlaybackError>> {
    this.playing = false;
    return { success: true, value: undefined };
  }

  async resume(): Promise<Result<void, PlaybackError>> {
    this.playing = true;
    return { success: true, value: undefined };
  }

  async stop(): Promise<Result<void, PlaybackError>> {
    this.playing = false;
    return { success: true, value: undefined };
  }

  async setVolume(level: number): Promise<Result<void, PlaybackError>> {
    return { success: true, value: undefined };
  }

  async getPosition(): Promise<number> {
    return 0;
  }

  async getDuration(): Promise<number> {
    return 180;
  }

  isPlaying(): boolean {
    return this.playing;
  }

  getCurrentState(): PlaybackState {
    return {
      status: this.playing ? 'playing' : 'idle',
      currentTrack: null,
      position: 0,
      duration: 180,
      volume: 50
    };
  }

  addEventListener(listener: (event: PlaybackEvent) => void): void {
    this.listeners.push(listener);
  }

  removeEventListener(listener: (event: PlaybackEvent) => void): void {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  clearAllListeners(): void {
    this.listeners = [];
  }

  simulateTrackFinished(): void {
    this.playing = false;
    this.emitEvent({
      type: 'track_finished',
      timestamp: new Date(),
      data: { state: this.getCurrentState() }
    });
  }

  private emitEvent(event: PlaybackEvent): void {
    process.nextTick(() => {
      this.listeners.forEach(listener => {
        try {
          listener(event);
        } catch (error) {
          console.error('Error in event listener:', error);
        }
      });
    });
  }
}

describe('PlaybackOrchestrator Property Tests', () => {
  /**
   * Property 4: Queue Integration and Automation
   * For any queue state change (track added to empty queue, current track finished, queue becomes empty), 
   * the playback orchestrator should automatically start, advance, or stop playback as appropriate without manual intervention
   * Validates: Requirements 3.1, 3.2, 3.4, 3.6
   */
  test('Property 4: Queue Integration and Automation', async () => {
    await fc.assert(fc.asyncProperty(
      // Generate a simple track and user for testing
      fc.record({
        track: fc.record({
          title: fc.string({ minLength: 1, maxLength: 100 }).filter((s: string) => s.trim().length > 0),
          artist: fc.string({ minLength: 1, maxLength: 100 }).filter((s: string) => s.trim().length > 0),
          videoId: fc.constantFrom(
            'dQw4w9WgXcQ',
            'abc123def456',
            'xyz789uvw012'
          ),
          duration: fc.integer({ min: 1, max: 7200 })
        }),
        user: fc.record({
          id: fc.string({ minLength: 1, maxLength: 50 }).filter((s: string) => s.trim().length > 0),
          nickname: fc.string({ minLength: 1, maxLength: 50 }).filter((s: string) => s.trim().length > 0)
        })
      }),
      async (testData: any) => {
        // Set up components
        const queueManager = new QueueManager();
        const rateLimiter = new RateLimiter();
        const queueService = new QueueService(queueManager, rateLimiter);
        const mockStreamResolver = new MockStreamResolver();
        const mockPlaybackController = new MockPlaybackController();
        
        const orchestrator = new PlaybackOrchestrator(
          queueService,
          mockStreamResolver,
          mockPlaybackController
        );

        let orchestratorStarted = false;
        
        try {
          // Create valid track and user
          const trackResult = TrackValidator.create(testData.track);
          const userResult = UserValidator.create(testData.user);
          
          if (!trackResult.success || !userResult.success) {
            return true; // Skip invalid data
          }

          const track = trackResult.value;
          const user = userResult.value;

          // Add track to queue BEFORE starting orchestrator
          // This tests that the orchestrator detects existing tracks on startup
          const addResult = queueService.addTrackToQueue(track, user);
          if (!addResult.success) {
            return false; // Should be able to add valid track
          }

          // Start orchestrator - it should detect the track and start playback immediately
          const startResult = await orchestrator.start();
          if (!startResult.success) {
            return false; // Should be able to start orchestrator
          }
          orchestratorStarted = true;

          // Give a short time for the orchestrator to process the existing track
          await new Promise(resolve => setTimeout(resolve, 50));

          // Verify queue integration worked
          const queueState = queueService.getQueueState();
          const orchestratorState = orchestrator.getCurrentState();

          // Requirements 3.1, 3.6: Orchestrator should start playback when it finds tracks in queue
          if (queueState.isEmpty) {
            return false; // Queue should not be empty after adding track
          }

          if (!queueState.currentTrack) {
            return false; // Should have a current track
          }

          if (queueState.currentTrack.track.id !== track.id) {
            return false; // Current track should be the added track
          }

          // The orchestrator should have started playback (playing or resolving)
          if (orchestratorState.status !== 'playing' && orchestratorState.status !== 'resolving') {
            return false; // Should be playing or resolving the track
          }

          // Test track finished scenario (Requirements: 3.2, 3.4)
          if (orchestratorState.status === 'playing') {
            // Simulate track finishing
            mockPlaybackController.simulateTrackFinished();
            
            // Wait for orchestrator to process
            await new Promise(resolve => setTimeout(resolve, 50));
            
            // Since there's only one track, queue should become empty and playback should stop
            const finalQueueState = queueService.getQueueState();
            const finalOrchestratorState = orchestrator.getCurrentState();
            
            // Requirements 3.4: Queue becomes empty, playback should stop
            if (!finalQueueState.isEmpty) {
              return false; // Queue should be empty after last track finishes
            }
            
            if (finalOrchestratorState.status !== 'idle') {
              return false; // Orchestrator should be idle when queue is empty
            }
          }

          return true;

        } finally {
          // Cleanup - ensure orchestrator is fully stopped and cleaned up
          if (orchestratorStarted) {
            try {
              await orchestrator.stop();
              // Wait a bit to ensure all async operations complete
              await new Promise(resolve => setTimeout(resolve, 10));
            } catch (error) {
              // Ignore cleanup errors
            }
          }
          
          try {
            orchestrator.removeAllListeners();
            mockPlaybackController.clearAllListeners();
          } catch (error) {
            // Ignore cleanup errors
          }
        }
      }
    ), { numRuns: 5 }); // Reduced runs for faster execution
  }, 30000); // Increase timeout to 30 seconds
});