/**
 * Shared types and contracts for Party Jukebox Queue Management
 * 
 * This package contains the core domain types, validation logic, and error handling
 * for the Queue Management system. It provides a clean interface between the domain
 * logic and infrastructure concerns.
 */

// Domain entities and value objects
export type { Track, TrackCreateData, TrackError, SearchResult } from './domain/Track';
export { TrackValidator, VideoIdUtils, TrackFactory } from './domain/Track';

export type { User, UserCreateData, UserError } from './domain/User';
export { UserValidator } from './domain/User';

export type { QueueItem, QueueItemCreateData, QueueItemError } from './domain/QueueItem';
export { QueueItemValidator } from './domain/QueueItem';

// Queue state and events
export type { QueueState, UserRateData, RequestRecord, QueueEvent } from './domain/QueueState';
export { QueueStateFactory } from './domain/QueueState';

// Error types and utilities
export type { 
  QueueError, 
  RateLimitError, 
  ServiceError, 
  ErrorDetails 
} from './domain/errors';
export { ErrorFactory } from './domain/errors';

// Utility types
export type { Result } from './domain/Track';