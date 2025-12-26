/**
 * Queue API Integration Tests
 * 
 * Tests for the queue API endpoints with actual QueueService integration.
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5
 */

import Fastify, { FastifyInstance } from 'fastify';
import { registerAPIRoutes } from '../routes';
import { HTTPServerDependencies } from '../../HTTPServer';
import { 
  HTTP_STATUS, 
  API_ERROR_CODES,
  AddTrackRequest,
  AddTrackResponse,
  QueueStateResponse
} from '../types';
import { QueueManager } from '../../../../application/QueueManager';
import { QueueService, IQueueService } from '../../../../application/QueueService';
import { RateLimiter } from '../../../../application/RateLimiter';
import { IPlaybackOrchestrator } from '../../../../domain/playback/interfaces';
import { PlaybackState } from '../../../../domain/playback/types';

describe('Queue API Integration', () => {
  let fastify: FastifyInstance;
  let queueService: QueueService;
  let mockPlaybackOrchestrator: IPlaybackOrchestrator;
  let dependencies: HTTPServerDependencies;

  beforeEach(async () => {
    // Create real service instances for integration testing
    const queueManager = new QueueManager();
    const rateLimiter = new RateLimiter();
    queueService = new QueueService(queueManager, rateLimiter);
    
    // Create mock PlaybackOrchestrator
    mockPlaybackOrchestrator = {
      start: jest.fn().mockResolvedValue({ success: true, value: undefined }),
      stop: jest.fn().mockResolvedValue({ success: true, value: undefined }),
      pause: jest.fn().mockResolvedValue({ success: true, value: undefined }),
      resume: jest.fn().mockResolvedValue({ success: true, value: undefined }),
      skip: jest.fn().mockResolvedValue({ success: true, value: undefined }),
      setVolume: jest.fn().mockResolvedValue({ success: true, value: undefined }),
      getCurrentState: jest.fn().mockReturnValue({
        status: 'idle',
        currentTrack: null,
        position: 0,
        duration: 0,
        volume: 50,
      } as PlaybackState),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    };
    
    dependencies = {
      queueService,
      playbackOrchestrator: mockPlaybackOrchestrator,
    };

    fastify = Fastify({ logger: false });
    
    // Register CORS plugin (same as HTTPServer)
    await fastify.register(require('@fastify/cors'), {
      origin: true,
      credentials: false,
    });
    
    await registerAPIRoutes(fastify, dependencies);
    await fastify.ready();
  });

  afterEach(async () => {
    await fastify.close();
  });

  describe('GET /api/queue', () => {
    it('should return empty queue state initially', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/queue',
      });

      expect(response.statusCode).toBe(HTTP_STATUS.OK);
      
      const body = JSON.parse(response.body) as QueueStateResponse;
      expect(body.success).toBe(true);
      expect(body.data?.queue).toBeDefined();
      expect(body.data?.queue.isEmpty).toBe(true);
      expect(body.data?.queue.totalLength).toBe(0);
      expect(body.data?.queue.currentTrack).toBeNull();
      expect(body.data?.queue.upcomingTracks).toEqual([]);
      expect(body.timestamp).toBeDefined();
    });

    it('should return queue state with tracks after adding', async () => {
      // First add a track
      const addTrackPayload: AddTrackRequest = {
        track: {
          title: 'Test Song',
          artist: 'Test Artist',
          videoId: 'test1234567',
          duration: 180,
        },
        user: {
          nickname: 'TestUser',
        },
      };

      await fastify.inject({
        method: 'POST',
        url: '/api/queue/add',
        headers: {
          'content-type': 'application/json',
        },
        payload: JSON.stringify(addTrackPayload),
      });

      // Then get queue state
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/queue',
      });

      expect(response.statusCode).toBe(HTTP_STATUS.OK);
      
      const body = JSON.parse(response.body) as QueueStateResponse;
      expect(body.success).toBe(true);
      expect(body.data?.queue.isEmpty).toBe(false);
      expect(body.data?.queue.totalLength).toBe(1);
      expect(body.data?.queue.currentTrack).toBeDefined();
      expect(body.data?.queue.currentTrack?.track.title).toBe('Test Song');
    });
  });

  describe('POST /api/queue/add', () => {
    it('should successfully add a valid track to the queue', async () => {
      const payload: AddTrackRequest = {
        track: {
          title: 'Test Song',
          artist: 'Test Artist',
          videoId: 'test1234567',
          duration: 180,
        },
        user: {
          nickname: 'TestUser',
        },
      };

      const response = await fastify.inject({
        method: 'POST',
        url: '/api/queue/add',
        headers: {
          'content-type': 'application/json',
        },
        payload: JSON.stringify(payload),
      });

      expect(response.statusCode).toBe(HTTP_STATUS.CREATED);
      
      const body = JSON.parse(response.body) as AddTrackResponse;
      expect(body.success).toBe(true);
      expect(body.data?.queueItem).toBeDefined();
      expect(body.data?.queueItem.track.title).toBe('Test Song');
      expect(body.data?.queueItem.track.artist).toBe('Test Artist');
      expect(body.data?.queueItem.addedBy.nickname).toBe('TestUser');
      expect(body.data?.queuePosition).toBe(1);
      expect(body.timestamp).toBeDefined();
    });

    it('should reject track with invalid title', async () => {
      const payload: AddTrackRequest = {
        track: {
          title: '', // Invalid empty title
          artist: 'Test Artist',
          videoId: 'test1234567',
          duration: 180,
        },
        user: {
          nickname: 'TestUser',
        },
      };

      const response = await fastify.inject({
        method: 'POST',
        url: '/api/queue/add',
        headers: {
          'content-type': 'application/json',
        },
        payload: JSON.stringify(payload),
      });

      expect(response.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);
      
      const body = JSON.parse(response.body) as AddTrackResponse;
      expect(body.success).toBe(false);
      expect(body.error?.code).toBe(API_ERROR_CODES.INVALID_TRACK_DATA);
      expect(body.error?.message).toContain('Invalid track data');
    });

    it('should reject track with invalid video ID', async () => {
      const payload: AddTrackRequest = {
        track: {
          title: 'Test Song',
          artist: 'Test Artist',
          videoId: 'invalid-id', // Invalid video ID
          duration: 180,
        },
        user: {
          nickname: 'TestUser',
        },
      };

      const response = await fastify.inject({
        method: 'POST',
        url: '/api/queue/add',
        headers: {
          'content-type': 'application/json',
        },
        payload: JSON.stringify(payload),
      });

      expect(response.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);
      
      const body = JSON.parse(response.body) as AddTrackResponse;
      expect(body.success).toBe(false);
      expect(body.error?.code).toBe(API_ERROR_CODES.INVALID_TRACK_DATA);
    });

    it('should reject user with invalid nickname', async () => {
      const payload: AddTrackRequest = {
        track: {
          title: 'Test Song',
          artist: 'Test Artist',
          videoId: 'test1234567',
          duration: 180,
        },
        user: {
          nickname: '', // Invalid empty nickname
        },
      };

      const response = await fastify.inject({
        method: 'POST',
        url: '/api/queue/add',
        headers: {
          'content-type': 'application/json',
        },
        payload: JSON.stringify(payload),
      });

      expect(response.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);
      
      const body = JSON.parse(response.body) as AddTrackResponse;
      expect(body.success).toBe(false);
      expect(body.error?.code).toBe(API_ERROR_CODES.INVALID_USER_DATA);
      expect(body.error?.message).toContain('Invalid user data');
    });

    it('should enforce rate limiting after multiple requests', async () => {
      const userId = '12345678-1234-1234-1234-123456789012'; // Use proper UUID format
      const payload: AddTrackRequest = {
        track: {
          title: 'Test Song',
          artist: 'Test Artist',
          videoId: 'test1234567',
          duration: 180,
        },
        user: {
          nickname: 'TestUser',
        },
      };

      // Mock crypto.randomUUID to return consistent user ID
      const originalRandomUUID = global.crypto.randomUUID;
      global.crypto.randomUUID = jest.fn(() => userId) as any;

      // Add 5 tracks (the rate limit)
      for (let i = 0; i < 5; i++) {
        const response = await fastify.inject({
          method: 'POST',
          url: '/api/queue/add',
          headers: {
            'content-type': 'application/json',
          },
          payload: JSON.stringify({
            ...payload,
            track: { ...payload.track, title: `Test Song ${i + 1}` },
          }),
        });

        expect(response.statusCode).toBe(HTTP_STATUS.CREATED);
      }

      // The 6th request should be rate limited
      const rateLimitedResponse = await fastify.inject({
        method: 'POST',
        url: '/api/queue/add',
        headers: {
          'content-type': 'application/json',
        },
        payload: JSON.stringify({
          ...payload,
          track: { ...payload.track, title: 'Rate Limited Song' },
        }),
      });

      // Restore original function
      global.crypto.randomUUID = originalRandomUUID;

      expect(rateLimitedResponse.statusCode).toBe(HTTP_STATUS.TOO_MANY_REQUESTS);
      
      const body = JSON.parse(rateLimitedResponse.body) as AddTrackResponse;
      expect(body.success).toBe(false);
      expect(body.error?.code).toBe(API_ERROR_CODES.RATE_LIMIT_EXCEEDED);
      expect(body.error?.message).toContain('Rate limit exceeded');
      expect(body.error?.retryAfter).toBeDefined();
      expect(rateLimitedResponse.headers['retry-after']).toBeDefined();
    });

    it('should handle malformed JSON gracefully', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/queue/add',
        headers: {
          'content-type': 'application/json',
        },
        payload: '{ invalid json',
      });

      expect(response.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);
      
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error?.code).toBe(API_ERROR_CODES.INVALID_JSON);
    });
  });

  describe('Error Handling', () => {
    it('should handle internal service errors gracefully', async () => {
      // Create a mock service that throws errors
      const errorQueueService: IQueueService = {
        getQueueState: () => {
          throw new Error('Service error');
        },
        addTrackToQueue: () => {
          throw new Error('Service error');
        },
        advanceToNextTrack: () => {
          throw new Error('Service error');
        },
      };

      const errorDependencies = {
        queueService: errorQueueService,
        playbackOrchestrator: mockPlaybackOrchestrator,
      };

      const errorFastify = Fastify({ logger: false });
      await errorFastify.register(require('@fastify/cors'), {
        origin: true,
        credentials: false,
      });
      await registerAPIRoutes(errorFastify, errorDependencies);
      await errorFastify.ready();

      const response = await errorFastify.inject({
        method: 'GET',
        url: '/api/queue',
      });

      expect(response.statusCode).toBe(HTTP_STATUS.INTERNAL_SERVER_ERROR);
      
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error?.code).toBe(API_ERROR_CODES.INTERNAL_ERROR);

      await errorFastify.close();
    });
  });
});