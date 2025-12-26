import { User, UserRateData, RequestRecord, RateLimitError, Result } from '@party-jukebox/shared';

/**
 * Rate limiter interface for enforcing user request limits
 * Requirements: 3.1, 3.2, 3.3, 3.5
 */
export interface IRateLimiter {
  canUserAddTrack(user: User): boolean;
  recordRequest(user: User, trackId: string): void;
  getTimeUntilReset(user: User): number;
  getRemainingRequests(user: User): number;
}

/**
 * Rate limiter implementation with 10-minute sliding window
 * Enforces 5 requests per 10 minutes per user
 */
export class RateLimiter implements IRateLimiter {
  private readonly REQUEST_LIMIT = 5;
  private readonly WINDOW_DURATION_MS = 10 * 60 * 1000; // 10 minutes in milliseconds
  private readonly userRateData = new Map<string, UserRateData>();

  /**
   * Check if user can add a track based on rate limiting rules
   * Requirements: 3.1, 3.2
   */
  canUserAddTrack(user: User): boolean {
    this.cleanupExpiredWindows();
    
    const rateData = this.getUserRateData(user.id);
    const validRequests = this.getValidRequestsInWindow(rateData);
    
    return validRequests.length < this.REQUEST_LIMIT;
  }

  /**
   * Record a request for the user and update their rate data
   * Requirements: 3.1, 3.5
   */
  recordRequest(user: User, trackId: string): void {
    const now = new Date();
    const existingData = this.getUserRateData(user.id);
    
    // Clean up old requests outside the current window
    const validRequests = this.getValidRequestsInWindow(existingData);
    
    // Add the new request
    const newRequest: RequestRecord = {
      timestamp: now,
      trackId
    };
    
    const updatedRequests = [...validRequests, newRequest];
    
    // Update or create rate data
    const updatedRateData: UserRateData = {
      userId: user.id,
      requests: updatedRequests,
      windowStart: updatedRequests.length > 0 ? updatedRequests[0].timestamp : now
    };
    
    this.userRateData.set(user.id, updatedRateData);
  }

  /**
   * Get time remaining until rate limit window resets (in milliseconds)
   * Requirements: 3.2, 3.3
   */
  getTimeUntilReset(user: User): number {
    const rateData = this.getUserRateData(user.id);
    const validRequests = this.getValidRequestsInWindow(rateData);
    
    if (validRequests.length === 0) {
      return 0; // No active window
    }
    
    const oldestRequest = validRequests[0];
    const windowEnd = new Date(oldestRequest.timestamp.getTime() + this.WINDOW_DURATION_MS);
    const now = new Date();
    
    return Math.max(0, windowEnd.getTime() - now.getTime());
  }

  /**
   * Get remaining requests available for the user
   * Requirements: 3.1, 3.4
   */
  getRemainingRequests(user: User): number {
    this.cleanupExpiredWindows();
    
    const rateData = this.getUserRateData(user.id);
    const validRequests = this.getValidRequestsInWindow(rateData);
    
    return Math.max(0, this.REQUEST_LIMIT - validRequests.length);
  }

  /**
   * Attempt to add a track with rate limiting validation
   * Returns success or rate limit error
   */
  checkRateLimit(user: User, trackId: string): Result<void, RateLimitError> {
    if (!this.canUserAddTrack(user)) {
      return { 
        success: false, 
        error: 'RATE_LIMIT_EXCEEDED'
      };
    }
    
    this.recordRequest(user, trackId);
    return { success: true, value: undefined };
  }

  /**
   * Get user rate data, creating empty data if none exists
   */
  private getUserRateData(userId: string): UserRateData {
    return this.userRateData.get(userId) || {
      userId,
      requests: [],
      windowStart: new Date()
    };
  }

  /**
   * Get requests that are still valid within the current 10-minute window
   */
  private getValidRequestsInWindow(rateData: UserRateData): RequestRecord[] {
    const now = new Date();
    const cutoffTime = new Date(now.getTime() - this.WINDOW_DURATION_MS);
    
    return rateData.requests.filter(request => 
      request.timestamp.getTime() > cutoffTime.getTime()
    );
  }

  /**
   * Clean up expired rate limiting windows for all users
   * Requirements: 3.3
   */
  private cleanupExpiredWindows(): void {
    const now = new Date();
    const cutoffTime = new Date(now.getTime() - this.WINDOW_DURATION_MS);
    
    for (const [userId, rateData] of this.userRateData.entries()) {
      const validRequests = rateData.requests.filter(request => 
        request.timestamp.getTime() > cutoffTime.getTime()
      );
      
      if (validRequests.length === 0) {
        // Remove user data if no valid requests remain
        this.userRateData.delete(userId);
      } else if (validRequests.length !== rateData.requests.length) {
        // Update with only valid requests
        const updatedRateData: UserRateData = {
          userId,
          requests: validRequests,
          windowStart: validRequests[0].timestamp
        };
        this.userRateData.set(userId, updatedRateData);
      }
    }
  }

  /**
   * Get current state for debugging/monitoring (not part of public interface)
   */
  getDebugState(): Map<string, UserRateData> {
    this.cleanupExpiredWindows();
    return new Map(this.userRateData);
  }
}