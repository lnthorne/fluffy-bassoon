/**
 * Playback API Integration Tests
 * 
 * Tests for the playback API endpoints with PlaybackOrchestrator integration.
 * 
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7
 */

import Fastify, { FastifyInstance } from 'fastify';
import { registerAPIRoutes } from '../routes';
import { HTTPServerDependencies } from '../../HTTPServer';
import { 
  HTTP_STATUS, 
  API_ERROR_CODES,
  PlaybackStatusResponse,
  PlaybackActionResponse
} from '../types';
import { QueueManager } from '../../../../application/QueueManager';
import { QueueService } from '../../../../application/QueueService';
import { RateLimiter } from '../../../../application/RateLimiter';
import { IPlaybackOrchestrator } from '../../../../domain/playback/interfaces';
import { PlaybackState } from '../../../../domain/playback/types';

describe('Playback API Integration', () => {
  let fastify: FastifyInstance;
  let mockPlaybackOrchestrator: IPlaybackOrchestrator;
  let dependencies: HTTPServerDependencies;

  beforeEach(async () => {
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

    // Create minimal queue service for dependencies
    const queueManager = new QueueManager();
    const rateLimiter = new RateLimiter();
    const queueService = new QueueService(queueManager, rateLimiter);
    
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

  describe('GET /api/playback/status', () => {
    it('should return current playback status', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/playback/status',
      });

      expect(response.statusCode).toBe(HTTP_STATUS.OK);
      
      const body = JSON.parse(response.body) as PlaybackStatusResponse;
      expect(body.success).toBe(true);
      expect(body.data?.status).toBe('idle');
      expect(body.data?.currentTrack).toBeNull();
      expect(body.data?.position).toBe(0);
      expect(body.data?.duration).toBe(0);
      expect(body.data?.volume).toBe(50);
      expect(body.timestamp).toBeDefined();
      expect(mockPlaybackOrchestrator.getCurrentState).toHaveBeenCalled();
    });

    it('should handle orchestrator errors gracefully', async () => {
      // Mock getCurrentState to throw an error
      (mockPlaybackOrchestrator.getCurrentState as jest.Mock).mockImplementation(() => {
        throw new Error('Orchestrator error');
      });

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/playback/status',
      });

      expect(response.statusCode).toBe(HTTP_STATUS.INTERNAL_SERVER_ERROR);
      
      const body = JSON.parse(response.body) as PlaybackStatusResponse;
      expect(body.success).toBe(false);
      expect(body.error?.code).toBe(API_ERROR_CODES.INTERNAL_ERROR);
      expect(body.error?.message).toContain('Failed to retrieve playback status');
    });
  });

  describe('POST /api/playback/skip', () => {
    it('should successfully skip to next track', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/playback/skip',
      });

      expect(response.statusCode).toBe(HTTP_STATUS.OK);
      
      const body = JSON.parse(response.body) as PlaybackActionResponse;
      expect(body.success).toBe(true);
      expect(body.data?.action).toBe('skip');
      expect(body.data?.newStatus).toBeDefined();
      expect(body.data?.newStatus.status).toBe('idle');
      expect(body.timestamp).toBeDefined();
      expect(mockPlaybackOrchestrator.skip).toHaveBeenCalled();
      expect(mockPlaybackOrchestrator.getCurrentState).toHaveBeenCalled();
    });

    it('should handle skip failure', async () => {
      // Mock skip to return failure
      (mockPlaybackOrchestrator.skip as jest.Mock).mockResolvedValue({
        success: false,
        error: 'PROCESS_CRASHED'
      });

      const response = await fastify.inject({
        method: 'POST',
        url: '/api/playback/skip',
      });

      expect(response.statusCode).toBe(HTTP_STATUS.INTERNAL_SERVER_ERROR);
      
      const body = JSON.parse(response.body) as PlaybackActionResponse;
      expect(body.success).toBe(false);
      expect(body.error?.code).toBe(API_ERROR_CODES.INTERNAL_ERROR);
      expect(body.error?.message).toContain('Failed to skip track');
    });
  });

  describe('POST /api/playback/pause', () => {
    it('should successfully pause when playing', async () => {
      // Mock getCurrentState to return playing status
      (mockPlaybackOrchestrator.getCurrentState as jest.Mock).mockReturnValue({
        status: 'playing',
        currentTrack: null,
        position: 30,
        duration: 180,
        volume: 50,
      } as PlaybackState);

      const response = await fastify.inject({
        method: 'POST',
        url: '/api/playback/pause',
      });

      expect(response.statusCode).toBe(HTTP_STATUS.OK);
      
      const body = JSON.parse(response.body) as PlaybackActionResponse;
      expect(body.success).toBe(true);
      expect(body.data?.action).toBe('pause');
      expect(body.data?.newStatus).toBeDefined();
      expect(body.timestamp).toBeDefined();
      expect(mockPlaybackOrchestrator.pause).toHaveBeenCalled();
    });

    it('should reject pause when not playing', async () => {
      // Mock getCurrentState to return idle status
      (mockPlaybackOrchestrator.getCurrentState as jest.Mock).mockReturnValue({
        status: 'idle',
        currentTrack: null,
        position: 0,
        duration: 0,
        volume: 50,
      } as PlaybackState);

      const response = await fastify.inject({
        method: 'POST',
        url: '/api/playback/pause',
      });

      expect(response.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);
      
      const body = JSON.parse(response.body) as PlaybackActionResponse;
      expect(body.success).toBe(false);
      expect(body.error?.code).toBe(API_ERROR_CODES.INVALID_REQUEST);
      expect(body.error?.message).toContain('Cannot pause when not playing');
      expect(mockPlaybackOrchestrator.pause).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/playback/resume', () => {
    it('should successfully resume when paused', async () => {
      // Mock getCurrentState to return paused status
      (mockPlaybackOrchestrator.getCurrentState as jest.Mock).mockReturnValue({
        status: 'paused',
        currentTrack: null,
        position: 30,
        duration: 180,
        volume: 50,
      } as PlaybackState);

      const response = await fastify.inject({
        method: 'POST',
        url: '/api/playback/resume',
      });

      expect(response.statusCode).toBe(HTTP_STATUS.OK);
      
      const body = JSON.parse(response.body) as PlaybackActionResponse;
      expect(body.success).toBe(true);
      expect(body.data?.action).toBe('resume');
      expect(body.data?.newStatus).toBeDefined();
      expect(body.timestamp).toBeDefined();
      expect(mockPlaybackOrchestrator.resume).toHaveBeenCalled();
    });

    it('should reject resume when not paused', async () => {
      // Mock getCurrentState to return playing status
      (mockPlaybackOrchestrator.getCurrentState as jest.Mock).mockReturnValue({
        status: 'playing',
        currentTrack: null,
        position: 30,
        duration: 180,
        volume: 50,
      } as PlaybackState);

      const response = await fastify.inject({
        method: 'POST',
        url: '/api/playback/resume',
      });

      expect(response.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);
      
      const body = JSON.parse(response.body) as PlaybackActionResponse;
      expect(body.success).toBe(false);
      expect(body.error?.code).toBe(API_ERROR_CODES.INVALID_REQUEST);
      expect(body.error?.message).toContain('Cannot resume when not paused');
      expect(mockPlaybackOrchestrator.resume).not.toHaveBeenCalled();
    });
  });

  describe('Service Unavailable Fallback', () => {
    it('should return service unavailable when playback orchestrator is missing', async () => {
      const fallbackFastify = Fastify({ logger: false });
      await fallbackFastify.register(require('@fastify/cors'), {
        origin: true,
        credentials: false,
      });
      
      // Register routes without playback orchestrator
      await registerAPIRoutes(fallbackFastify, {
        queueService: dependencies.queueService,
        playbackOrchestrator: undefined as any,
      });
      await fallbackFastify.ready();

      const response = await fallbackFastify.inject({
        method: 'GET',
        url: '/api/playback/status',
      });

      expect(response.statusCode).toBe(HTTP_STATUS.SERVICE_UNAVAILABLE);
      
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error?.code).toBe(API_ERROR_CODES.SERVICE_UNAVAILABLE);
      expect(body.error?.message).toContain('Playback status service unavailable');

      await fallbackFastify.close();
    });
  });
});