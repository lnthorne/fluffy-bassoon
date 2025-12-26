/**
 * Playback Skip Race Condition Test
 * 
 * Test to reproduce the race condition bug where the API returns incorrect state
 * immediately after a skip operation.
 */

import Fastify, { FastifyInstance } from 'fastify';
import { registerAPIRoutes } from '../routes';
import { HTTPServerDependencies } from '../../HTTPServer';
import { 
  HTTP_STATUS, 
  PlaybackActionResponse
} from '../types';
import { QueueManager } from '../../../../application/QueueManager';
import { QueueService } from '../../../../application/QueueService';
import { RateLimiter } from '../../../../application/RateLimiter';
import { PlaybackOrchestrator } from '../../../../application/PlaybackOrchestrator';
import { IStreamResolver, IPlaybackController } from '../../../../domain/playback/interfaces';
import { PlaybackState, ResolvedStream } from '../../../../domain/playback/types';
import { TrackValidator, UserValidator } from '@party-jukebox/shared';

describe('Playback Skip Race Condition', () => {
  let fastify: FastifyInstance;
  let playbackOrchestrator: PlaybackOrchestrator;
  let queueService: QueueService;
  let mockStreamResolver: IStreamResolver;
  let mockPlaybackController: IPlaybackController;

  beforeEach(async () => {
    // Create real services
    const queueManager = new QueueManager();
    const rateLimiter = new RateLimiter();
    queueService = new QueueService(queueManager, rateLimiter);

    // Create mock stream resolver with realistic delay
    mockStreamResolver = {
      resolveStream: jest.fn().mockImplementation(async (_url: string) => {
        // Add a small delay to simulate real stream resolution
        await new Promise(resolve => setTimeout(resolve, 50));
        return {
          success: true,
          value: {
            streamUrl: 'http://example.com/stream.mp3',
            title: 'Test Track',
            duration: 180,
            format: 'mp3',
            quality: 'high'
          } as ResolvedStream
        };
      }),
      validateStream: jest.fn().mockResolvedValue(true),
      clearCache: jest.fn()
    };

    // Create mock playback controller with realistic delays
    mockPlaybackController = {
      loadAndPlay: jest.fn().mockImplementation(async () => {
        // Add a small delay to simulate real playback startup
        await new Promise(resolve => setTimeout(resolve, 30));
        return { success: true, value: undefined };
      }),
      pause: jest.fn().mockResolvedValue({ success: true, value: undefined }),
      resume: jest.fn().mockResolvedValue({ success: true, value: undefined }),
      stop: jest.fn().mockImplementation(async () => {
        // Add a small delay to simulate real stop operation
        await new Promise(resolve => setTimeout(resolve, 10));
        return { success: true, value: undefined };
      }),
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

    // Create real orchestrator
    playbackOrchestrator = new PlaybackOrchestrator(
      queueService,
      mockStreamResolver,
      mockPlaybackController
    );

    await playbackOrchestrator.start();

    // Create Fastify instance with API routes
    fastify = Fastify({ logger: false });
    
    await fastify.register(require('@fastify/cors'), {
      origin: true,
      credentials: false,
    });
    
    const dependencies: HTTPServerDependencies = {
      queueService,
      playbackOrchestrator,
    };
    
    await registerAPIRoutes(fastify, dependencies);
    await fastify.ready();
  });

  afterEach(async () => {
    await playbackOrchestrator.stop();
    await fastify.close();
  });

  it('should return correct state immediately after skip API call with real timing', async () => {
    // Add multiple tracks
    const tracks = [];
    const userResult = UserValidator.create({ id: 'user1', nickname: 'TestUser' });
    if (!userResult.success) throw new Error('Failed to create user');
    const user = userResult.value;
    
    for (let i = 1; i <= 3; i++) {
      const trackResult = TrackValidator.create({
        title: `Track ${i}`,
        artist: `Artist ${i}`,
        sourceUrl: `https://youtube.com/watch?v=track${i}`,
        duration: 180
      });
      if (!trackResult.success) throw new Error(`Failed to create track ${i}`);
      const track = trackResult.value;
      tracks.push(track);
      queueService.addTrackToQueue(track, user);
    }

    // Wait for orchestrator to start playing first track
    await new Promise(resolve => setTimeout(resolve, 2500));

    // Verify initial state via API
    let statusResponse = await fastify.inject({
      method: 'GET',
      url: '/api/playback/status',
    });

    expect(statusResponse.statusCode).toBe(HTTP_STATUS.OK);
    let statusBody = JSON.parse(statusResponse.body);
    console.log('Initial API status:', {
      status: statusBody.data.status,
      currentTrack: statusBody.data.currentTrack?.track.title
    });

    expect(statusBody.data.status).toBe('playing');
    expect(statusBody.data.currentTrack?.track.title).toBe('Track 1');

    // Call skip API
    const skipResponse = await fastify.inject({
      method: 'POST',
      url: '/api/playback/skip',
    });

    expect(skipResponse.statusCode).toBe(HTTP_STATUS.OK);
    const skipBody = JSON.parse(skipResponse.body) as PlaybackActionResponse;
    
    // The skip API should return the correct new state
    expect(skipBody.success).toBe(true);
    expect(skipBody.data?.action).toBe('skip');
    
    // Verify the race condition is fixed - API returns correct state immediately
    expect(skipBody.data?.newStatus.status).toBe('playing'); // Should be playing, not idle
    expect(skipBody.data?.newStatus.currentTrack?.track.title).toBe('Track 2'); // Should be Track 2

    // Also verify by calling status API immediately after
    statusResponse = await fastify.inject({
      method: 'GET',
      url: '/api/playback/status',
    });

    statusBody = JSON.parse(statusResponse.body);

    expect(statusBody.data.status).toBe('playing');
    expect(statusBody.data.currentTrack?.track.title).toBe('Track 2');

    // Verify queue state
    const queueResponse = await fastify.inject({
      method: 'GET',
      url: '/api/queue',
    });

    const queueBody = JSON.parse(queueResponse.body);

    expect(queueBody.data.queue.isEmpty).toBe(false);
    expect(queueBody.data.queue.totalLength).toBe(2); // Should have 2 tracks left
    expect(queueBody.data.queue.currentTrack?.track.title).toBe('Track 2');
  });

  it('should handle rapid skip calls without race conditions', async () => {
    // Add multiple tracks
    const userResult = UserValidator.create({ id: 'user1', nickname: 'TestUser' });
    if (!userResult.success) throw new Error('Failed to create user');
    const user = userResult.value;
    
    for (let i = 1; i <= 5; i++) {
      const trackResult = TrackValidator.create({
        title: `Track ${i}`,
        artist: `Artist ${i}`,
        sourceUrl: `https://youtube.com/watch?v=track${i}`,
        duration: 180
      });
      if (!trackResult.success) throw new Error(`Failed to create track ${i}`);
      const track = trackResult.value;
      queueService.addTrackToQueue(track, user);
    }

    // Wait for orchestrator to start playing first track
    await new Promise(resolve => setTimeout(resolve, 2500));

    // Make rapid skip calls
    console.log('Making rapid skip calls...');
    const skipPromises = [];
    for (let i = 0; i < 3; i++) {
      skipPromises.push(
        fastify.inject({
          method: 'POST',
          url: '/api/playback/skip',
        })
      );
    }

    const skipResponses = await Promise.all(skipPromises);
    
    // All skip calls should succeed
    skipResponses.forEach((response) => {
      expect(response.statusCode).toBe(HTTP_STATUS.OK);
    });

    // Final state should be consistent
    const finalStatusResponse = await fastify.inject({
      method: 'GET',
      url: '/api/playback/status',
    });

    const finalStatusBody = JSON.parse(finalStatusResponse.body);

    // Should be playing some track (not idle)
    expect(finalStatusBody.data.status).toBe('playing');
    expect(finalStatusBody.data.currentTrack).toBeTruthy();
  });

  it('should maintain correct queue state after skip with 3 songs', async () => {
    // Add 3 tracks to match user's scenario
    const userResult = UserValidator.create({ id: 'user1', nickname: 'TestUser' });
    if (!userResult.success) throw new Error('Failed to create user');
    const user = userResult.value;
    
    for (let i = 1; i <= 3; i++) {
      const trackResult = TrackValidator.create({
        title: `Song ${i}`,
        artist: `Artist ${i}`,
        sourceUrl: `https://youtube.com/watch?v=song${i}`,
        duration: 180
      });
      if (!trackResult.success) throw new Error(`Failed to create track ${i}`);
      const track = trackResult.value;
      queueService.addTrackToQueue(track, user);
    }

    // Wait for orchestrator to start playing first song
    await new Promise(resolve => setTimeout(resolve, 2500));

    // Verify initial state - should have 3 songs, playing Song 1
    let queueResponse = await fastify.inject({
      method: 'GET',
      url: '/api/queue',
    });
    let queueBody = JSON.parse(queueResponse.body);
    
    console.log('Initial queue state:', {
      isEmpty: queueBody.data.queue.isEmpty,
      totalLength: queueBody.data.queue.totalLength,
      currentTrack: queueBody.data.queue.currentTrack?.track.title,
      upcomingCount: queueBody.data.queue.upcomingTracks.length
    });

    expect(queueBody.data.queue.isEmpty).toBe(false);
    expect(queueBody.data.queue.totalLength).toBe(3);
    expect(queueBody.data.queue.currentTrack?.track.title).toBe('Song 1');
    expect(queueBody.data.queue.upcomingTracks.length).toBe(2);

    // Call skip API - should move to Song 2
    const skipResponse = await fastify.inject({
      method: 'POST',
      url: '/api/playback/skip',
    });

    expect(skipResponse.statusCode).toBe(HTTP_STATUS.OK);
    const skipBody = JSON.parse(skipResponse.body) as PlaybackActionResponse;
    expect(skipBody.success).toBe(true);
    expect(skipBody.data?.newStatus.currentTrack?.track.title).toBe('Song 2');

    // Check queue state immediately after skip
    queueResponse = await fastify.inject({
      method: 'GET',
      url: '/api/queue',
    });
    queueBody = JSON.parse(queueResponse.body);
    
    console.log('Queue state after skip:', {
      isEmpty: queueBody.data.queue.isEmpty,
      totalLength: queueBody.data.queue.totalLength,
      currentTrack: queueBody.data.queue.currentTrack?.track.title,
      upcomingCount: queueBody.data.queue.upcomingTracks.length
    });

    // This is where the bug occurs - queue should have 2 songs left (Song 2 + Song 3)
    // But user reports it shows as empty
    expect(queueBody.data.queue.isEmpty).toBe(false);
    expect(queueBody.data.queue.totalLength).toBe(2); // Should be 2 (Song 2 current + Song 3 upcoming)
    expect(queueBody.data.queue.currentTrack?.track.title).toBe('Song 2');
    expect(queueBody.data.queue.upcomingTracks.length).toBe(1); // Should have Song 3 upcoming
  });

  it('should not double-advance queue during skip operation', async () => {
    // Add 3 tracks
    const userResult = UserValidator.create({ id: 'user1', nickname: 'TestUser' });
    if (!userResult.success) throw new Error('Failed to create user');
    const user = userResult.value;
    
    for (let i = 1; i <= 3; i++) {
      const trackResult = TrackValidator.create({
        title: `Song ${i}`,
        artist: `Artist ${i}`,
        sourceUrl: `https://youtube.com/watch?v=song${i}`,
        duration: 180
      });
      if (!trackResult.success) throw new Error(`Failed to create track ${i}`);
      const track = trackResult.value;
      queueService.addTrackToQueue(track, user);
    }

    // Wait for orchestrator to start playing first song
    await new Promise(resolve => setTimeout(resolve, 2500));

    // Verify initial state
    let queueResponse = await fastify.inject({
      method: 'GET',
      url: '/api/queue',
    });
    let queueBody = JSON.parse(queueResponse.body);
    
    expect(queueBody.data.queue.totalLength).toBe(3);
    expect(queueBody.data.queue.currentTrack?.track.title).toBe('Song 1');

    // Call skip and immediately check queue state multiple times
    // This simulates the user's scenario where they skip and then check queue
    const skipResponse = await fastify.inject({
      method: 'POST',
      url: '/api/playback/skip',
    });

    expect(skipResponse.statusCode).toBe(HTTP_STATUS.OK);

    // Check queue state multiple times in quick succession
    // This might catch the race condition if the queue monitoring interval interferes
    for (let i = 0; i < 5; i++) {
      queueResponse = await fastify.inject({
        method: 'GET',
        url: '/api/queue',
      });
      queueBody = JSON.parse(queueResponse.body);
      
      console.log(`Queue check ${i + 1}:`, {
        isEmpty: queueBody.data.queue.isEmpty,
        totalLength: queueBody.data.queue.totalLength,
        currentTrack: queueBody.data.queue.currentTrack?.track.title,
        upcomingCount: queueBody.data.queue.upcomingTracks.length
      });

      // Queue should never be empty after skipping from 3 songs to song 2
      expect(queueBody.data.queue.isEmpty).toBe(false);
      expect(queueBody.data.queue.totalLength).toBeGreaterThan(0);
      
      // Small delay between checks
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Final verification - should have Song 2 current and Song 3 upcoming
    expect(queueBody.data.queue.totalLength).toBe(2);
    expect(queueBody.data.queue.currentTrack?.track.title).toBe('Song 2');
    expect(queueBody.data.queue.upcomingTracks.length).toBe(1);
  });
});