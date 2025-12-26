/**
 * PlaybackOrchestrator Skip Bug Test
 * 
 * Test to reproduce the skip bug where queue becomes empty and status becomes idle
 * even though there are more tracks to play.
 */

import { PlaybackOrchestrator } from '../PlaybackOrchestrator';
import { QueueService } from '../QueueService';
import { QueueManager } from '../QueueManager';
import { RateLimiter } from '../RateLimiter';
import { IStreamResolver, IPlaybackController } from '../../domain/playback/interfaces';
import { PlaybackState, ResolvedStream, PlaybackEvent } from '../../domain/playback/types';
import { TrackValidator, UserValidator } from '@party-jukebox/shared';

describe('PlaybackOrchestrator Skip Bug', () => {
  let orchestrator: PlaybackOrchestrator;
  let queueService: QueueService;
  let mockStreamResolver: IStreamResolver;
  let mockPlaybackController: IPlaybackController;

  beforeEach(async () => {
    // Create real queue service
    const queueManager = new QueueManager();
    const rateLimiter = new RateLimiter();
    queueService = new QueueService(queueManager, rateLimiter);

    // Create mock stream resolver
    mockStreamResolver = {
      resolveStream: jest.fn().mockResolvedValue({
        success: true,
        value: {
          streamUrl: 'http://example.com/stream.mp3',
          title: 'Test Track',
          duration: 180,
          format: 'mp3',
          quality: 'high'
        } as ResolvedStream
      }),
      validateStream: jest.fn().mockResolvedValue(true),
      clearCache: jest.fn()
    };

    // Create mock playback controller
    mockPlaybackController = {
      loadAndPlay: jest.fn().mockResolvedValue({ success: true, value: undefined }),
      pause: jest.fn().mockResolvedValue({ success: true, value: undefined }),
      resume: jest.fn().mockResolvedValue({ success: true, value: undefined }),
      stop: jest.fn().mockResolvedValue({ success: true, value: undefined }),
      setVolume: jest.fn().mockResolvedValue({ success: true, value: undefined }),
      getPosition: jest.fn().mockResolvedValue(0),
      getDuration: jest.fn().mockResolvedValue(180),
      isPlaying: jest.fn().mockReturnValue(false),
      getCurrentState: jest.fn().mockReturnValue({
        status: 'idle',
        currentTrack: null,
        position: 0,
        duration: 0,
        volume: 50
      } as PlaybackState),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn()
    };

    // Create orchestrator
    orchestrator = new PlaybackOrchestrator(
      queueService,
      mockStreamResolver,
      mockPlaybackController
    );

    await orchestrator.start();
  });

  afterEach(async () => {
    await orchestrator.stop();
  });

  it('should maintain correct queue state and playback status after skip with multiple tracks', async () => {
    // Add multiple tracks to queue
    const track1Result = TrackValidator.create({
      title: 'Track 1',
      artist: 'Artist 1',
      sourceUrl: 'https://youtube.com/watch?v=track1',
      duration: 180
    });
    expect(track1Result.success).toBe(true);
    const track1 = (track1Result as any).value;

    const track2Result = TrackValidator.create({
      title: 'Track 2',
      artist: 'Artist 2',
      sourceUrl: 'https://youtube.com/watch?v=track2',
      duration: 200
    });
    expect(track2Result.success).toBe(true);
    const track2 = (track2Result as any).value;

    const track3Result = TrackValidator.create({
      title: 'Track 3',
      artist: 'Artist 3',
      sourceUrl: 'https://youtube.com/watch?v=track3',
      duration: 220
    });
    expect(track3Result.success).toBe(true);
    const track3 = (track3Result as any).value;

    const userResult = UserValidator.create({
      id: 'user1',
      nickname: 'TestUser'
    });
    expect(userResult.success).toBe(true);
    const user = (userResult as any).value;

    // Add tracks to queue
    queueService.addTrackToQueue(track1, user);
    queueService.addTrackToQueue(track2, user);
    queueService.addTrackToQueue(track3, user);

    // Wait for orchestrator to start playing first track (queue monitoring runs every 2 seconds)
    await new Promise(resolve => setTimeout(resolve, 2500));

    // Verify initial state
    let queueState = queueService.getQueueState();
    console.log('Initial queue state:', {
      isEmpty: queueState.isEmpty,
      totalLength: queueState.totalLength,
      currentTrack: queueState.currentTrack?.track.id,
      upcomingTracks: queueState.upcomingTracks.map(t => t.track.id)
    });

    expect(queueState.isEmpty).toBe(false);
    expect(queueState.totalLength).toBe(3);
    expect(queueState.currentTrack?.track.id).toBe(track1.id);
    expect(queueState.upcomingTracks).toHaveLength(2);

    let playbackState = orchestrator.getCurrentState();
    console.log('Initial playback state:', {
      status: playbackState.status,
      currentTrack: playbackState.currentTrack?.track.id
    });
    
    expect(playbackState.status).toBe('playing');
    expect(playbackState.currentTrack?.track.id).toBe(track1.id);

    // Skip to next track
    const skipResult = await orchestrator.skip();
    expect(skipResult.success).toBe(true);

    // Wait a bit for the skip to complete
    await new Promise(resolve => setTimeout(resolve, 500));

    // Check queue state after skip - THIS IS WHERE THE BUG OCCURS
    queueState = queueService.getQueueState();
    console.log('Queue state after skip:', {
      isEmpty: queueState.isEmpty,
      totalLength: queueState.totalLength,
      currentTrack: queueState.currentTrack?.track.id,
      upcomingTracks: queueState.upcomingTracks.map(t => t.track.id)
    });

    // Check playback state after skip - THIS IS WHERE THE BUG OCCURS
    playbackState = orchestrator.getCurrentState();
    console.log('Playback state after skip:', {
      status: playbackState.status,
      currentTrack: playbackState.currentTrack?.track.id
    });

    // These assertions should pass but might fail due to the bug
    expect(queueState.isEmpty).toBe(false); // Should still have tracks
    expect(queueState.totalLength).toBe(2); // Should have 2 tracks left
    expect(queueState.currentTrack?.track.id).toBe(track2.id); // Should be playing track2
    expect(queueState.upcomingTracks).toHaveLength(1); // Should have 1 upcoming track

    expect(playbackState.status).toBe('playing'); // Should be playing, not idle
    expect(playbackState.currentTrack?.track.id).toBe(track2.id); // Should be playing track2
  });

  it('should handle rapid skip operations correctly', async () => {
    // This test tries to reproduce the bug with rapid skips
    const tracks = [];
    const user = (UserValidator.create({ id: 'user1', nickname: 'TestUser' }) as any).value;
    
    // Add 5 tracks
    for (let i = 1; i <= 5; i++) {
      const trackResult = TrackValidator.create({
        title: `Track ${i}`,
        artist: `Artist ${i}`,
        sourceUrl: `https://youtube.com/watch?v=track${i}`,
        duration: 180 + i * 10
      });
      expect(trackResult.success).toBe(true);
      const track = (trackResult as any).value;
      tracks.push(track);
      queueService.addTrackToQueue(track, user);
    }

    // Wait for orchestrator to start playing
    await new Promise(resolve => setTimeout(resolve, 2500));

    // Verify initial state
    let queueState = queueService.getQueueState();
    expect(queueState.totalLength).toBe(5);
    expect(queueState.currentTrack?.track.id).toBe(tracks[0].id);

    // Perform rapid skips
    console.log('Performing rapid skips...');
    
    // Skip 1: Should go to track 2
    await orchestrator.skip();
    await new Promise(resolve => setTimeout(resolve, 1100)); // Wait for processing flag to reset
    
    queueState = queueService.getQueueState();
    let playbackState = orchestrator.getCurrentState();
    console.log('After skip 1:', {
      queueLength: queueState.totalLength,
      currentTrack: queueState.currentTrack?.track.title,
      status: playbackState.status
    });
    
    // Skip 2: Should go to track 3
    await orchestrator.skip();
    await new Promise(resolve => setTimeout(resolve, 1100)); // Wait longer than the processing timeout
    
    queueState = queueService.getQueueState();
    playbackState = orchestrator.getCurrentState();
    console.log('After skip 2:', {
      queueLength: queueState.totalLength,
      currentTrack: queueState.currentTrack?.track.title,
      status: playbackState.status
    });

    // Final verification - should still have tracks and be playing
    expect(queueState.isEmpty).toBe(false);
    expect(queueState.totalLength).toBe(3); // Should have 3 tracks left
    expect(playbackState.status).toBe('playing'); // Should still be playing
    expect(queueState.currentTrack?.track.id).toBe(tracks[2].id); // Should be on track 3
  });
});