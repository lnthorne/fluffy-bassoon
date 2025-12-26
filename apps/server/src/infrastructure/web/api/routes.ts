/**
 * API Route Registration
 * 
 * Registers all API routes with the `/api` prefix and sets up the route structure
 * for queue operations, search, playback control, and status endpoints.
 * 
 * Requirements: 2.6, 2.7, 7.3, 10.1
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { 
  APIResponse, 
  APIError, 
  HTTP_STATUS, 
  API_ERROR_CODES,
  AddTrackRequest,
  AddTrackResponse,
  QueueStateResponse,
  AddTrackRouteInterface,
  QueueStateRouteInterface
} from './types';
import { registerAPIMiddleware } from './middleware';
import { HTTPServerDependencies } from '../HTTPServer';
import { TrackValidator, UserValidator } from '@party-jukebox/shared';

/**
 * Register all API routes with the Fastify instance
 * Sets up the `/api` prefix and route handlers with service dependencies
 */
export async function registerAPIRoutes(
  fastify: FastifyInstance, 
  dependencies?: HTTPServerDependencies | null
): Promise<void> {
  // Register API middleware for all routes under /api
  await fastify.register(async (apiInstance) => {
    // Apply middleware to all API routes
    registerAPIMiddleware(apiInstance);
    
    // API status/health endpoint
    apiInstance.get('/status', async (request: FastifyRequest, reply: FastifyReply) => {
      const response: APIResponse = {
        success: true,
        data: {
          status: 'operational',
          version: '1.0.0',
          timestamp: new Date().toISOString(),
          endpoints: {
            queue: '/api/queue',
            search: '/api/search',
            playback: '/api/playback',
          },
        },
        timestamp: new Date().toISOString(),
      };
      
      reply.code(HTTP_STATUS.OK).send(response);
    });
    
    // Queue operations (Task 4)
    if (dependencies?.queueService) {
      // GET /api/queue - Get current queue state
      apiInstance.get<QueueStateRouteInterface>('/queue', async (request, reply) => {
        return handleGetQueueState(request, reply, dependencies.queueService);
      });
      
      // POST /api/queue/add - Add track to queue
      apiInstance.post<AddTrackRouteInterface>('/queue/add', async (request, reply) => {
        return handleAddTrackToQueue(request, reply, dependencies.queueService);
      });
    } else {
      // Fallback handlers when services are not available
      apiInstance.get('/queue', createServiceUnavailableHandler('Queue state retrieval'));
      apiInstance.post('/queue/add', createServiceUnavailableHandler('Add track to queue'));
    }
    
    // Placeholder routes for future implementation
    // These will be implemented in subsequent tasks
    
    // Search operations (Task 5)
    apiInstance.get('/search', createPlaceholderHandler('YouTube search'));
    
    // Playback control (Task 6)
    apiInstance.get('/playback/status', createPlaceholderHandler('Playback status'));
    apiInstance.post('/playback/skip', createPlaceholderHandler('Skip track'));
    apiInstance.post('/playback/pause', createPlaceholderHandler('Pause playback'));
    apiInstance.post('/playback/resume', createPlaceholderHandler('Resume playback'));
    
  }, { prefix: '/api' });
}

/**
 * Create a placeholder handler for routes that will be implemented later
 */
function createPlaceholderHandler(operation: string) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const error: APIError = {
      code: API_ERROR_CODES.SERVICE_UNAVAILABLE,
      message: `${operation} not yet implemented`,
      details: {
        operation,
        implementationStatus: 'pending',
        expectedInTask: 'upcoming',
      },
      timestamp: new Date().toISOString(),
    };
    
    const response: APIResponse = {
      success: false,
      error,
      timestamp: new Date().toISOString(),
    };
    
    reply.code(HTTP_STATUS.SERVICE_UNAVAILABLE).send(response);
  };
}

/**
 * Create a service unavailable handler for when dependencies are missing
 */
function createServiceUnavailableHandler(operation: string) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const error: APIError = {
      code: API_ERROR_CODES.SERVICE_UNAVAILABLE,
      message: `${operation} service unavailable`,
      details: {
        operation,
        reason: 'Service dependencies not initialized',
      },
      timestamp: new Date().toISOString(),
    };
    
    const response: APIResponse = {
      success: false,
      error,
      timestamp: new Date().toISOString(),
    };
    
    reply.code(HTTP_STATUS.SERVICE_UNAVAILABLE).send(response);
  };
}

/**
 * Handle GET /api/queue - Get current queue state
 * Requirements: 2.1
 */
async function handleGetQueueState(
  request: FastifyRequest<QueueStateRouteInterface>,
  reply: FastifyReply,
  queueService: any
): Promise<void> {
  try {
    const queueState = queueService.getQueueState();
    
    const response: QueueStateResponse = {
      success: true,
      data: {
        queue: queueState,
      },
      timestamp: new Date().toISOString(),
    };
    
    reply.code(HTTP_STATUS.OK).send(response);
  } catch (error) {
    console.error('Error getting queue state:', error);
    
    const apiError: APIError = {
      code: API_ERROR_CODES.INTERNAL_ERROR,
      message: 'Failed to retrieve queue state',
      timestamp: new Date().toISOString(),
    };
    
    const response: QueueStateResponse = {
      success: false,
      error: apiError,
      timestamp: new Date().toISOString(),
    };
    
    reply.code(HTTP_STATUS.INTERNAL_SERVER_ERROR).send(response);
  }
}

/**
 * Handle POST /api/queue/add - Add track to queue
 * Requirements: 2.2, 2.3, 2.4, 2.5
 */
async function handleAddTrackToQueue(
  request: FastifyRequest<AddTrackRouteInterface>,
  reply: FastifyReply,
  queueService: any
): Promise<void> {
  try {
    const { track: trackData, user: userData } = request.body;
    
    // Validate track data
    const trackResult = TrackValidator.create(trackData);
    if (!trackResult.success) {
      const error: APIError = {
        code: API_ERROR_CODES.INVALID_TRACK_DATA,
        message: 'Invalid track data',
        details: { 
          field: 'track',
          error: trackResult.error,
          received: trackData 
        },
        timestamp: new Date().toISOString(),
      };
      
      const response: AddTrackResponse = {
        success: false,
        error,
        timestamp: new Date().toISOString(),
      };
      
      reply.code(HTTP_STATUS.BAD_REQUEST).send(response);
      return;
    }
    
    // Create user with generated ID (since we don't have authentication)
    const userResult = UserValidator.create({
      id: crypto.randomUUID(), // Generate unique ID for this session
      nickname: userData.nickname,
    });
    
    if (!userResult.success) {
      const error: APIError = {
        code: API_ERROR_CODES.INVALID_USER_DATA,
        message: 'Invalid user data',
        details: { 
          field: 'user',
          error: userResult.error,
          received: userData 
        },
        timestamp: new Date().toISOString(),
      };
      
      const response: AddTrackResponse = {
        success: false,
        error,
        timestamp: new Date().toISOString(),
      };
      
      reply.code(HTTP_STATUS.BAD_REQUEST).send(response);
      return;
    }
    
    // Add track to queue using QueueService
    const addResult = queueService.addTrackToQueue(trackResult.value, userResult.value);
    
    if (!addResult.success) {
      // Handle rate limiting
      if (addResult.error === 'RATE_LIMIT_EXCEEDED') {
        const rateLimitInfo = queueService.getUserRateLimitInfo(userResult.value);
        const retryAfter = Math.ceil(rateLimitInfo.timeUntilReset / 1000);
        
        const error: APIError = {
          code: API_ERROR_CODES.RATE_LIMIT_EXCEEDED,
          message: 'Rate limit exceeded. Please wait before adding another track.',
          details: {
            retryAfter,
            remainingRequests: rateLimitInfo.remainingRequests,
          },
          timestamp: new Date().toISOString(),
        };
        
        const response: AddTrackResponse = {
          success: false,
          error: {
            ...error,
            retryAfter,
          },
          timestamp: new Date().toISOString(),
        };
        
        reply
          .code(HTTP_STATUS.TOO_MANY_REQUESTS)
          .header('Retry-After', retryAfter.toString())
          .send(response);
        return;
      }
      
      // Handle other queue operation errors
      const error: APIError = {
        code: API_ERROR_CODES.QUEUE_OPERATION_FAILED,
        message: 'Failed to add track to queue',
        details: { 
          queueError: addResult.error 
        },
        timestamp: new Date().toISOString(),
      };
      
      const response: AddTrackResponse = {
        success: false,
        error,
        timestamp: new Date().toISOString(),
      };
      
      reply.code(HTTP_STATUS.BAD_REQUEST).send(response);
      return;
    }
    
    // Success - get queue position
    const queueState = queueService.getQueueState();
    const queuePosition = queueState.totalLength; // Position is the total length since we just added
    
    const response: AddTrackResponse = {
      success: true,
      data: {
        queueItem: addResult.value,
        queuePosition,
      },
      timestamp: new Date().toISOString(),
    };
    
    reply.code(HTTP_STATUS.CREATED).send(response);
    
  } catch (error) {
    console.error('Error adding track to queue:', error);
    
    const apiError: APIError = {
      code: API_ERROR_CODES.INTERNAL_ERROR,
      message: 'Internal server error while adding track',
      timestamp: new Date().toISOString(),
    };
    
    const response: AddTrackResponse = {
      success: false,
      error: apiError,
      timestamp: new Date().toISOString(),
    };
    
    reply.code(HTTP_STATUS.INTERNAL_SERVER_ERROR).send(response);
  }
}