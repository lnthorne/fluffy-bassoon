/**
 * Property-based tests for RateLimiter
 * Feature: queue-management
 */

import * as fc from 'fast-check';
import { RateLimiter } from '../RateLimiter';
import { UserValidator } from '@party-jukebox/shared';

describe('RateLimiter Property Tests', () => {
  /**
   * Property 5: Rate Limiting Enforcement
   * For any user, the rate limiter should allow exactly 5 requests within any 10-minute window 
   * and reject subsequent requests with time remaining information
   * Validates: Requirements 3.1, 3.2
   */
  test('Property 5: Rate Limiting Enforcement', () => {
    fc.assert(fc.property(
      // Generate a valid user
      fc.record({
        id: fc.string({ minLength: 1, maxLength: 50 }).filter((s: string) => s.trim().length > 0),
        nickname: fc.string({ minLength: 1, maxLength: 50 }).filter((s: string) => s.trim().length > 0)
      }),
      // Generate track IDs for requests
      fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 6, maxLength: 10 }),
      (userData: { id: string; nickname: string }, trackIds: string[]) => {
        // Create a valid user
        const userResult = UserValidator.create(userData);
        if (!userResult.success) return true; // Skip invalid users
        
        const user = userResult.value;
        const rateLimiter = new RateLimiter();
        
        // Test that exactly 5 requests are allowed
        let allowedRequests = 0;
        let firstRejection = false;
        
        for (let i = 0; i < trackIds.length; i++) {
          const canAdd = rateLimiter.canUserAddTrack(user);
          
          if (canAdd) {
            // Should be able to record the request
            rateLimiter.recordRequest(user, trackIds[i]);
            allowedRequests++;
            
            // After recording, check remaining requests
            const remaining = rateLimiter.getRemainingRequests(user);
            const expectedRemaining = Math.max(0, 5 - allowedRequests);
            
            if (remaining !== expectedRemaining) {
              return false; // Remaining requests calculation is wrong
            }
          } else {
            // This should be the 6th+ request
            if (allowedRequests !== 5) {
              return false; // Should have allowed exactly 5 requests before rejecting
            }
            
            if (!firstRejection) {
              firstRejection = true;
              
              // Check that time until reset is provided and reasonable
              const timeUntilReset = rateLimiter.getTimeUntilReset(user);
              if (timeUntilReset <= 0 || timeUntilReset > 10 * 60 * 1000) {
                return false; // Time until reset should be positive and <= 10 minutes
              }
              
              // Remaining requests should be 0
              const remaining = rateLimiter.getRemainingRequests(user);
              if (remaining !== 0) {
                return false; // Should have 0 remaining requests when rate limited
              }
            }
          }
          
          // If we've tested the rate limit behavior, we can break early
          if (firstRejection && i >= 6) {
            break;
          }
        }
        
        // Verify that exactly 5 requests were allowed
        return allowedRequests === 5 && (trackIds.length <= 5 || firstRejection);
      }
    ), { numRuns: 100 });
  });

  /**
   * Property 6: Rate Limit Window Reset
   * For any user who has made requests, their request count should reset to zero after 10 minutes 
   * have passed since their first request in the current window
   * Validates: Requirements 3.3, 3.5
   */
  test('Property 6: Rate Limit Window Reset', () => {
    fc.assert(fc.property(
      // Generate a valid user
      fc.record({
        id: fc.string({ minLength: 1, maxLength: 50 }).filter((s: string) => s.trim().length > 0),
        nickname: fc.string({ minLength: 1, maxLength: 50 }).filter((s: string) => s.trim().length > 0)
      }),
      // Generate number of requests (1-5 to stay within limit)
      fc.integer({ min: 1, max: 5 }),
      // Generate track IDs for requests
      fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 5, maxLength: 5 }),
      (userData: { id: string; nickname: string }, numRequests: number, trackIds: string[]) => {
        // Create a valid user
        const userResult = UserValidator.create(userData);
        if (!userResult.success) return true; // Skip invalid users
        
        const user = userResult.value;
        const rateLimiter = new RateLimiter();
        
        // Mock the current time to control the window behavior
        let mockTime = Date.now();
        
        // Store original Date constructor
        const OriginalDate = global.Date;
        
        // Create mock Date class
        const MockDate = function(this: any, ...args: any[]) {
          if (args.length === 0) {
            return new OriginalDate(mockTime);
          } else {
            return new (OriginalDate as any)(...args);
          }
        } as any;
        
        // Copy static methods
        MockDate.now = () => mockTime;
        MockDate.parse = OriginalDate.parse;
        MockDate.UTC = OriginalDate.UTC;
        MockDate.prototype = OriginalDate.prototype;
        
        global.Date = MockDate;
        
        try {
          // Make initial requests within the rate limit
          for (let i = 0; i < numRequests; i++) {
            const canAdd = rateLimiter.canUserAddTrack(user);
            if (!canAdd) return false; // Should be able to add within limit
            
            rateLimiter.recordRequest(user, trackIds[i]);
          }
          
          // Verify user has used up some requests
          const remainingBefore = rateLimiter.getRemainingRequests(user);
          const expectedRemaining = 5 - numRequests;
          if (remainingBefore !== expectedRemaining) {
            return false; // Remaining requests should match expected
          }
          
          // Verify time until reset is reasonable (should be close to 10 minutes)
          const timeUntilResetBefore = rateLimiter.getTimeUntilReset(user);
          if (timeUntilResetBefore <= 0 || timeUntilResetBefore > 10 * 60 * 1000) {
            return false; // Time should be positive and <= 10 minutes
          }
          
          // Advance time by exactly 10 minutes + 1ms to trigger window reset
          mockTime += (10 * 60 * 1000) + 1;
          
          // After window reset, user should be able to make requests again
          const canAddAfterReset = rateLimiter.canUserAddTrack(user);
          if (!canAddAfterReset) {
            return false; // Should be able to add after window reset
          }
          
          // Remaining requests should be back to 5
          const remainingAfterReset = rateLimiter.getRemainingRequests(user);
          if (remainingAfterReset !== 5) {
            return false; // Should have full 5 requests available after reset
          }
          
          // Time until reset should be 0 (no active window)
          const timeUntilResetAfter = rateLimiter.getTimeUntilReset(user);
          if (timeUntilResetAfter !== 0) {
            return false; // Should have no active window after reset
          }
          
          // Should be able to make a new request to start a new window
          rateLimiter.recordRequest(user, 'new-track-after-reset');
          const remainingAfterNewRequest = rateLimiter.getRemainingRequests(user);
          if (remainingAfterNewRequest !== 4) {
            return false; // Should have 4 remaining after making 1 new request
          }
          
          return true;
          
        } finally {
          // Restore original Date
          global.Date = OriginalDate;
        }
      }
    ), { numRuns: 100 });
  });

  /**
   * Property 7: User Rate Limit Independence
   * For any set of users making requests, each user's rate limit should be tracked independently 
   * without affecting other users' limits
   * Validates: Requirements 3.4
   */
  test('Property 7: User Rate Limit Independence', () => {
    fc.assert(fc.property(
      // Generate multiple users (2-4 users to keep it simple)
      fc.array(
        fc.record({
          id: fc.string({ minLength: 1, maxLength: 20 }).filter((s: string) => s.trim().length > 0),
          nickname: fc.string({ minLength: 1, maxLength: 20 }).filter((s: string) => s.trim().length > 0)
        }),
        { minLength: 2, maxLength: 4 }
      ).filter((users: any[]) => {
        // Ensure all user IDs are unique
        const ids = users.map(u => u.id);
        return new Set(ids).size === ids.length;
      }),
      // Generate number of requests per user (0-5 to avoid time-dependent blocking behavior)
      fc.array(fc.integer({ min: 0, max: 5 })),
      (usersData: { id: string; nickname: string }[], requestCounts: number[]) => {
        // Ensure we have request counts for each user
        if (requestCounts.length < usersData.length) {
          // Pad with zeros if needed
          while (requestCounts.length < usersData.length) {
            requestCounts.push(0);
          }
        }
        
        // Create valid users
        const users: any[] = [];
        for (const userData of usersData) {
          const userResult = UserValidator.create(userData);
          if (!userResult.success) return true; // Skip if any user is invalid
          users.push(userResult.value);
        }
        
        const rateLimiter = new RateLimiter();
        
        // Make requests for each user according to their request count
        for (let i = 0; i < users.length; i++) {
          const user = users[i];
          const requestCount = requestCounts[i];
          
          for (let j = 0; j < requestCount; j++) {
            const trackId = `track-${user.id}-${j}`;
            const canAdd = rateLimiter.canUserAddTrack(user);
            
            // All requests should be allowed since we're staying within the 5-request limit
            if (!canAdd) {
              return false; // Should be able to add within limit
            }
            rateLimiter.recordRequest(user, trackId);
          }
        }
        
        // Verify each user's state is independent by checking remaining requests
        for (let i = 0; i < users.length; i++) {
          const user = users[i];
          const requestCount = requestCounts[i];
          
          // Check remaining requests for this user
          const remaining = rateLimiter.getRemainingRequests(user);
          const expectedRemaining = 5 - requestCount;
          
          if (remaining !== expectedRemaining) {
            return false; // Each user should have independent remaining count
          }
          
          // User should still be able to add more tracks (since we stayed within limit)
          const canAdd = rateLimiter.canUserAddTrack(user);
          if (!canAdd && requestCount < 5) {
            return false; // User with < 5 requests should still be able to add
          }
        }
        
        // Test independence: one user making additional requests shouldn't affect others
        if (users.length >= 2) {
          const user1 = users[0];
          const user2 = users[1];
          
          // Record user2's state before user1 makes more requests
          const user2RemainingBefore = rateLimiter.getRemainingRequests(user2);
          const user2CanAddBefore = rateLimiter.canUserAddTrack(user2);
          
          // User1 makes additional requests (if they can)
          if (rateLimiter.canUserAddTrack(user1)) {
            rateLimiter.recordRequest(user1, 'independence-test');
          }
          
          // User2's state should be unchanged
          const user2RemainingAfter = rateLimiter.getRemainingRequests(user2);
          const user2CanAddAfter = rateLimiter.canUserAddTrack(user2);
          
          if (user2RemainingBefore !== user2RemainingAfter || user2CanAddBefore !== user2CanAddAfter) {
            return false; // User2 should not be affected by User1's actions
          }
        }
        
        return true;
      }
    ), { numRuns: 20 });
  });
});