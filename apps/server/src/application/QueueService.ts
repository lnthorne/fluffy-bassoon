import { 
  Track, 
  User, 
  QueueItem, 
  QueueState, 
  ServiceError, 
  Result,
  ErrorFactory
} from '@party-jukebox/shared';
import { IQueueManager } from './QueueManager';
import { IRateLimiter } from './RateLimiter';

/**
 * Queue service interface for high-level orchestration
 * Requirements: 3.1, 3.2, 6.1, 6.2
 */
export interface IQueueService {
  addTrackToQueue(track: Track, user: User): Result<QueueItem, ServiceError>;
  advanceToNextTrack(): Result<QueueItem | null, ServiceError>;
  getQueueState(): QueueState;
}

/**
 * Queue service implementation combining QueueManager and RateLimiter
 * Provides high-level orchestration for queue operations with rate limiting
 * Requirements: 3.1, 3.2, 6.1, 6.2
 */
export class QueueService implements IQueueService {
  constructor(
    private readonly queueManager: IQueueManager,
    private readonly rateLimiter: IRateLimiter
  ) {}

  /**
   * Add a track to the queue with rate limiting enforcement
   * Requirements: 3.1, 3.2, 6.1, 6.2
   */
  addTrackToQueue(track: Track, user: User): Result<QueueItem, ServiceError> {
    // Check rate limiting first - Requirements: 3.1, 3.2
    // Only check rate limiting if user appears to be a valid object
    if (user && typeof user === 'object' && typeof user.id === 'string') {
      if (!this.rateLimiter.canUserAddTrack(user)) {
        return { success: false, error: 'RATE_LIMIT_EXCEEDED' };
      }
    }

    // Delegate to QueueManager for validation and queue operations
    const queueResult = this.queueManager.addTrack(track, user);
    
    if (!queueResult.success) {
      // Return queue error as-is (already a ServiceError)
      return queueResult;
    }

    // Record the request for rate limiting tracking after successful addition
    // Requirements: 3.1, 3.5
    // Only record if we have valid user and track
    if (user && typeof user === 'object' && typeof user.id === 'string' && 
        track && typeof track === 'object' && typeof track.id === 'string') {
      this.rateLimiter.recordRequest(user, track.id);
    }

    return queueResult;
  }

  /**
   * Advance to the next track in the queue
   * Requirements: 4.1, 4.2, 4.3
   */
  advanceToNextTrack(): Result<QueueItem | null, ServiceError> {
    // Delegate to queue manager - no additional orchestration needed
    const result = this.queueManager.advanceQueue();
    
    // QueueError is already a ServiceError, so we can return directly
    return result;
  }

  /**
   * Get the current queue state
   * Requirements: 5.1, 5.2, 5.3
   */
  getQueueState(): QueueState {
    // Delegate to queue manager - no additional orchestration needed
    return this.queueManager.getQueueState();
  }

  /**
   * Get rate limiting information for a user
   * Additional utility method for service consumers
   */
  getUserRateLimitInfo(user: User): {
    canAddTrack: boolean;
    remainingRequests: number;
    timeUntilReset: number;
  } {
    return {
      canAddTrack: this.rateLimiter.canUserAddTrack(user),
      remainingRequests: this.rateLimiter.getRemainingRequests(user),
      timeUntilReset: this.rateLimiter.getTimeUntilReset(user)
    };
  }
}