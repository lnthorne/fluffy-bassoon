/**
 * API Types and Interfaces
 * 
 * Common types and interfaces for the REST API infrastructure.
 * Provides consistent request/response patterns and error handling.
 * 
 * Requirements: 2.6, 2.7, 7.3, 10.1
 */

import { FastifyRequest, FastifyReply, RouteGenericInterface } from 'fastify';
import { Track, User, QueueItem, QueueState, SearchResult } from '@party-jukebox/shared';

// Temporary interface until SearchService compilation issues are resolved
interface PaginatedSearchResults {
  results: SearchResult[];
  pagination: {
    currentPage: number;
    totalResults: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
    nextPageToken?: string;
    prevPageToken?: string;
    resultsPerPage: number;
  };
}

/**
 * Standard API error response format
 */
export interface APIError {
  code: string;
  message: string;
  details?: any;
  timestamp?: string;
}

/**
 * Standard API success response format
 */
export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: APIError;
  timestamp: string;
}

/**
 * Request validation error details
 */
export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

/**
 * Rate limiting error response
 */
export interface RateLimitError extends APIError {
  code: 'RATE_LIMIT_EXCEEDED';
  retryAfter: number; // seconds until next request allowed
}

/**
 * API route handler function type
 */
export type APIRouteHandler<TRequest extends RouteGenericInterface = RouteGenericInterface, TResponse = any> = (
  request: FastifyRequest<TRequest>,
  reply: FastifyReply
) => Promise<APIResponse<TResponse>>;

/**
 * API middleware function type
 */
export type APIMiddleware = (
  request: FastifyRequest,
  reply: FastifyReply,
  done: (error?: Error) => void
) => void;

/**
 * Request size limits for different endpoints
 */
export const REQUEST_LIMITS = {
  DEFAULT: 1024 * 1024, // 1MB
  SEARCH: 1024, // 1KB for search queries
  QUEUE_ADD: 10 * 1024, // 10KB for track data
} as const;

/**
 * HTTP status codes used by the API
 */
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

/**
 * API error codes
 */
export const API_ERROR_CODES = {
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  INVALID_JSON: 'INVALID_JSON',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  INVALID_REQUEST: 'INVALID_REQUEST',
  MALFORMED_DATA: 'MALFORMED_DATA',
  INVALID_TRACK_DATA: 'INVALID_TRACK_DATA',
  INVALID_USER_DATA: 'INVALID_USER_DATA',
  QUEUE_OPERATION_FAILED: 'QUEUE_OPERATION_FAILED',
} as const;

/**
 * Queue API Request/Response Types
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5
 */

// Add track to queue request
export interface AddTrackRequest {
  track: {
    title: string;
    artist: string;
    videoId: string;
    duration: number;
    thumbnailUrl?: string;
  };
  user: {
    id?: string; // Optional device/user ID for rate limiting
    nickname: string;
  };
}

// Add track to queue response
export interface AddTrackResponse {
  success: boolean;
  data?: {
    queueItem: QueueItem;
    queuePosition: number;
  };
  error?: APIError & {
    retryAfter?: number; // For rate limiting
  };
  timestamp: string;
}

// Get queue state response
export interface QueueStateResponse {
  success: boolean;
  data?: {
    queue: QueueState;
  };
  error?: APIError;
  timestamp: string;
}

// Queue API route interfaces for Fastify typing
export interface AddTrackRouteInterface extends RouteGenericInterface {
  Body: AddTrackRequest;
  Reply: AddTrackResponse;
}

export interface QueueStateRouteInterface extends RouteGenericInterface {
  Reply: QueueStateResponse;
}

/**
 * Playback API Request/Response Types
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7
 */

// Playback status response
export interface PlaybackStatusResponse {
  success: boolean;
  data?: {
    status: 'idle' | 'resolving' | 'playing' | 'paused' | 'error';
    currentTrack: QueueItem | null;
    position: number; // seconds
    duration: number; // seconds
    volume: number; // 0-100
    error?: string;
  };
  error?: APIError;
  timestamp: string;
}

// Playback action response (skip, pause, resume)
export interface PlaybackActionResponse {
  success: boolean;
  data?: {
    action: string;
    newStatus: {
      status: 'idle' | 'resolving' | 'playing' | 'paused' | 'error';
      currentTrack: QueueItem | null;
      position: number;
      duration: number;
      volume: number;
    };
  };
  error?: APIError;
  timestamp: string;
}

// Playback API route interfaces for Fastify typing
export interface PlaybackStatusRouteInterface extends RouteGenericInterface {
  Reply: PlaybackStatusResponse;
}

export interface PlaybackActionRouteInterface extends RouteGenericInterface {
  Reply: PlaybackActionResponse;
}

/**
 * Search API Request/Response Types
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.7
 */

// Search request query parameters
export interface SearchRequest {
  q: string; // search query
  page?: number; // page number (default: 1)
  limit?: number; // results per page (default: 20, max: 50)
}

// Search response
export interface SearchResponse {
  success: boolean;
  data?: PaginatedSearchResults;
  error?: APIError;
  timestamp: string;
}

// Search API route interface for Fastify typing
export interface SearchRouteInterface extends RouteGenericInterface {
  Querystring: SearchRequest;
  Reply: SearchResponse;
}