/**
 * Comprehensive error types for the Queue Management system
 */

// Import and re-export domain-specific errors
import type { TrackError } from './Track';
import type { UserError } from './User';
import type { QueueItemError } from './QueueItem';

export type { TrackError, UserError, QueueItemError };

/**
 * Queue operation error types
 */
export type QueueError = 
  | 'INVALID_TRACK'
  | 'INVALID_USER'
  | 'QUEUE_EMPTY'
  | 'DUPLICATE_TRACK';

/**
 * Rate limiting error types
 */
export type RateLimitError = 
  | 'RATE_LIMIT_EXCEEDED'
  | 'INVALID_USER';

/**
 * Service-level error types combining all error categories
 */
export type ServiceError = QueueError | RateLimitError;

/**
 * Error details with context information
 */
export interface ErrorDetails {
  code: string;
  message: string;
  context?: Record<string, unknown> | undefined;
  suggestion?: string | undefined;
}

/**
 * Error factory for creating consistent error responses
 */
export class ErrorFactory {
  static createTrackError(error: TrackError, context?: Record<string, unknown> | undefined): ErrorDetails {
    const messages: Record<TrackError, string> = {
      INVALID_TITLE: 'Track title must be a non-empty string',
      INVALID_ARTIST: 'Track artist must be a non-empty string',
      INVALID_SOURCE_URL: 'Source URL must be a valid YouTube URL',
      INVALID_DURATION: 'Duration must be a positive integer (seconds)'
    };

    return {
      code: error,
      message: messages[error],
      context: context || undefined,
      suggestion: 'Please check the track data and try again'
    };
  }

  static createUserError(error: UserError, context?: Record<string, unknown> | undefined): ErrorDetails {
    const messages: Record<UserError, string> = {
      INVALID_ID: 'User ID must be a non-empty string',
      INVALID_NICKNAME: 'User nickname must be a non-empty string'
    };

    return {
      code: error,
      message: messages[error],
      context: context || undefined,
      suggestion: 'Please provide valid user information'
    };
  }

  static createQueueError(error: QueueError, context?: Record<string, unknown> | undefined): ErrorDetails {
    const messages: Record<QueueError, string> = {
      INVALID_TRACK: 'Invalid track provided to queue operation',
      INVALID_USER: 'Invalid user provided to queue operation',
      QUEUE_EMPTY: 'Cannot perform operation on empty queue',
      DUPLICATE_TRACK: 'Track is already in the queue'
    };

    return {
      code: error,
      message: messages[error],
      context: context || undefined,
      suggestion: error === 'QUEUE_EMPTY' ? 'Add tracks to the queue first' : 'Please check your input and try again'
    };
  }

  static createRateLimitError(error: RateLimitError, timeRemaining?: number | undefined): ErrorDetails {
    const messages: Record<RateLimitError, string> = {
      RATE_LIMIT_EXCEEDED: `Rate limit exceeded. ${timeRemaining ? `Try again in ${Math.ceil(timeRemaining / 1000)} seconds.` : 'Please wait before adding more tracks.'}`,
      INVALID_USER: 'Invalid user for rate limiting check'
    };

    return {
      code: error,
      message: messages[error],
      context: timeRemaining ? { timeRemaining } : undefined,
      suggestion: error === 'RATE_LIMIT_EXCEEDED' ? 'Wait for the rate limit window to reset' : 'Please provide valid user information'
    };
  }
}