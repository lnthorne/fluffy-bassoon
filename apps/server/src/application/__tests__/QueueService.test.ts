/**
 * Property-based tests for QueueService
 * Feature: queue-management
 */

import * as fc from 'fast-check';
import { QueueService } from '../QueueService';
import { QueueManager } from '../QueueManager';
import { RateLimiter } from '../RateLimiter';
import { Track, TrackValidator, UserValidator } from '@party-jukebox/shared';

describe('QueueService Property Tests', () => {
  /**
   * Property 12: Input Validation and Error Handling
   * For any invalid inputs (null tracks, undefined users, empty user IDs), operations should be rejected 
   * with descriptive error messages without compromising queue integrity
   * Validates: Requirements 6.1, 6.2, 6.3
   */
  test('Property 12: Input Validation and Error Handling', () => {
    fc.assert(fc.property(
      // Generate test scenarios for orchestration behavior
      fc.oneof(
        // Rate limiting scenarios - valid inputs but rate limited
        fc.record({
          type: fc.constant('rate_limited'),
          track: fc.record({
            title: fc.string({ minLength: 1, maxLength: 100 }).filter((s: string) => s.trim().length > 0),
            artist: fc.string({ minLength: 1, maxLength: 100 }).filter((s: string) => s.trim().length > 0),
            sourceUrl: fc.constantFrom(
              'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
              'https://youtube.com/watch?v=abc123def456'
            ),
            duration: fc.integer({ min: 1, max: 7200 })
          }),
          user: fc.record({
            id: fc.string({ minLength: 1, maxLength: 50 }).filter((s: string) => s.trim().length > 0),
            nickname: fc.string({ minLength: 1, maxLength: 50 }).filter((s: string) => s.trim().length > 0)
          }),
          requestCount: fc.constant(5) // Already at rate limit
        }),
        // Invalid inputs that QueueManager should reject
        fc.record({
          type: fc.constant('invalid_input'),
          track: fc.oneof(
            fc.constant(null),
            fc.constant(undefined),
            fc.constant({}),
            fc.constant({ id: null }),
            fc.constant({ title: 'valid' }) // missing id property
          ),
          user: fc.oneof(
            fc.constant(null),
            fc.constant(undefined),
            fc.constant({}),
            fc.constant({ id: null }),
            fc.constant({ nickname: 'valid' }) // missing id property
          )
        }),
        // Valid orchestration scenario
        fc.record({
          type: fc.constant('valid'),
          track: fc.record({
            title: fc.string({ minLength: 1, maxLength: 100 }).filter((s: string) => s.trim().length > 0),
            artist: fc.string({ minLength: 1, maxLength: 100 }).filter((s: string) => s.trim().length > 0),
            sourceUrl: fc.constantFrom(
              'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
              'https://youtube.com/watch?v=abc123def456'
            ),
            duration: fc.integer({ min: 1, max: 7200 })
          }),
          user: fc.record({
            id: fc.string({ minLength: 1, maxLength: 50 }).filter((s: string) => s.trim().length > 0),
            nickname: fc.string({ minLength: 1, maxLength: 50 }).filter((s: string) => s.trim().length > 0)
          })
        })
      ),
      (testCase: any) => {
        const queueManager = new QueueManager();
        const rateLimiter = new RateLimiter();
        const queueService = new QueueService(queueManager, rateLimiter);
        
        // Capture initial queue state to verify integrity is maintained
        const initialState = queueService.getQueueState();
        const initialLength = initialState.totalLength;
        
        if (testCase.type === 'rate_limited') {
          // Set up rate limiting scenario
          const trackResult = TrackValidator.create(testCase.track);
          const userResult = UserValidator.create(testCase.user);
          
          if (!trackResult.success || !userResult.success) {
            return true; // Skip if validation fails
          }
          
          const track = trackResult.value;
          const user = userResult.value;
          
          // Exhaust the user's rate limit first
          for (let i = 0; i < 5; i++) {
            rateLimiter.recordRequest(user, `track-${i}`);
          }
          
          // Now attempt to add another track - should be rate limited
          const result = queueService.addTrackToQueue(track, user);
          
          if (result.success) {
            return false; // Should be rejected due to rate limiting
          }
          
          if (result.error !== 'RATE_LIMIT_EXCEEDED') {
            return false; // Should return rate limit error
          }
          
          // Queue should be unchanged
          const finalState = queueService.getQueueState();
          if (finalState.totalLength !== initialLength) {
            return false; // Queue should be unchanged after rate limit rejection
          }
          
          return true;
          
        } else if (testCase.type === 'invalid_input') {
          // Test that QueueService properly handles QueueManager errors
          const result = queueService.addTrackToQueue(testCase.track, testCase.user);
          
          if (result.success) {
            return false; // Invalid inputs should be rejected
          }
          
          // Should return either INVALID_TRACK or INVALID_USER (depends on what QueueManager returns)
          if (result.error !== 'INVALID_TRACK' && result.error !== 'INVALID_USER') {
            return false; // Should return appropriate validation error from QueueManager
          }
          
          // Queue should be unchanged
          const finalState = queueService.getQueueState();
          if (finalState.totalLength !== initialLength) {
            return false; // Queue should be unchanged after rejection
          }
          
          return true;
          
        } else if (testCase.type === 'valid') {
          // Test successful orchestration
          const trackResult = TrackValidator.create(testCase.track);
          const userResult = UserValidator.create(testCase.user);
          
          if (!trackResult.success || !userResult.success) {
            return true; // Skip if validation fails
          }
          
          const track = trackResult.value;
          const user = userResult.value;
          
          const result = queueService.addTrackToQueue(track, user);
          
          if (!result.success) {
            return false; // Valid inputs should succeed
          }
          
          // Verify orchestration worked correctly
          const finalState = queueService.getQueueState();
          if (finalState.totalLength !== initialLength + 1) {
            return false; // Queue should have grown by 1
          }
          
          // Verify rate limiter was updated
          const rateLimitInfo = queueService.getUserRateLimitInfo(user);
          if (rateLimitInfo.remainingRequests !== 4) {
            return false; // Should have 4 remaining requests after adding 1
          }
          
          return true;
        }
        
        return true; // Default case
      }
    ), { numRuns: 100 });
  });
});

describe('QueueService Integration Tests', () => {
  let queueService: QueueService;
  let queueManager: QueueManager;
  let rateLimiter: RateLimiter;

  beforeEach(() => {
    queueManager = new QueueManager();
    rateLimiter = new RateLimiter();
    queueService = new QueueService(queueManager, rateLimiter);
  });

  /**
   * Integration Test: QueueManager and RateLimiter Coordination
   * Test QueueManager and RateLimiter coordination
   * Requirements: 3.1, 3.2, 6.1, 6.2
   */
  describe('QueueManager and RateLimiter Coordination', () => {
    it('should coordinate rate limiting with queue operations', () => {
      // Create valid track and user
      const trackResult = TrackValidator.create({
        title: 'Test Song',
        artist: 'Test Artist',
        sourceUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        duration: 180
      });
      expect(trackResult.success).toBe(true);
      if (!trackResult.success) return;
      const track = trackResult.value;

      const userResult = UserValidator.create({
        id: 'user1',
        nickname: 'TestUser'
      });
      expect(userResult.success).toBe(true);
      if (!userResult.success) return;
      const user = userResult.value;

      // Add 5 tracks to reach the rate limit
      for (let i = 0; i < 5; i++) {
        const result = queueService.addTrackToQueue(track, user);
        expect(result.success).toBe(true);
        
        // Verify track was added to queue
        const queueState = queueService.getQueueState();
        expect(queueState.totalLength).toBe(i + 1);
        
        // Verify rate limiter state
        const rateLimitInfo = queueService.getUserRateLimitInfo(user);
        expect(rateLimitInfo.remainingRequests).toBe(5 - (i + 1));
      }

      // 6th track should be rejected due to rate limit, queue should be unchanged
      const initialQueueState = queueService.getQueueState();
      const result = queueService.addTrackToQueue(track, user);
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('RATE_LIMIT_EXCEEDED');
      }
      
      // Queue should be unchanged after rate limit rejection
      const finalQueueState = queueService.getQueueState();
      expect(finalQueueState.totalLength).toBe(initialQueueState.totalLength);
      expect(finalQueueState.currentTrack?.id).toBe(initialQueueState.currentTrack?.id);
      expect(finalQueueState.upcomingTracks.length).toBe(initialQueueState.upcomingTracks.length);
    });

    it('should allow different users to have independent rate limits', () => {
      // Create two different users
      const user1Result = UserValidator.create({
        id: 'user1',
        nickname: 'User One'
      });
      const user2Result = UserValidator.create({
        id: 'user2',
        nickname: 'User Two'
      });
      expect(user1Result.success && user2Result.success).toBe(true);
      if (!user1Result.success || !user2Result.success) return;
      
      const user1 = user1Result.value;
      const user2 = user2Result.value;

      const trackResult = TrackValidator.create({
        title: 'Test Song',
        artist: 'Test Artist',
        sourceUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        duration: 180
      });
      if (!trackResult.success) return;
      const track = trackResult.value;

      // User1 reaches their rate limit
      for (let i = 0; i < 5; i++) {
        const result = queueService.addTrackToQueue(track, user1);
        expect(result.success).toBe(true);
      }

      // User1 should be rate limited
      const user1Result6th = queueService.addTrackToQueue(track, user1);
      expect(user1Result6th.success).toBe(false);
      if (!user1Result6th.success) {
        expect(user1Result6th.error).toBe('RATE_LIMIT_EXCEEDED');
      }

      // User2 should still be able to add tracks
      const user2Result1st = queueService.addTrackToQueue(track, user2);
      expect(user2Result1st.success).toBe(true);

      // Verify rate limit info is independent
      const user1Info = queueService.getUserRateLimitInfo(user1);
      const user2Info = queueService.getUserRateLimitInfo(user2);
      
      expect(user1Info.canAddTrack).toBe(false);
      expect(user1Info.remainingRequests).toBe(0);
      expect(user2Info.canAddTrack).toBe(true);
      expect(user2Info.remainingRequests).toBe(4);
    });
  });

  /**
   * Integration Test: Error Propagation and Handling
   * Test error propagation and handling
   * Requirements: 3.1, 3.2, 6.1, 6.2
   */
  describe('Error Propagation and Handling', () => {
    it('should propagate queue manager errors correctly', () => {
      const userResult = UserValidator.create({
        id: 'user1',
        nickname: 'TestUser'
      });
      if (!userResult.success) return;
      const user = userResult.value;

      // Try to add invalid track (null)
      const result = queueService.addTrackToQueue(null as any, user);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('INVALID_TRACK');
      }

      // Queue should remain empty and functional
      const queueState = queueService.getQueueState();
      expect(queueState.isEmpty).toBe(true);
      expect(queueState.totalLength).toBe(0);
    });

    it('should propagate rate limiter errors correctly', () => {
      const trackResult = TrackValidator.create({
        title: 'Test Song',
        artist: 'Test Artist',
        sourceUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        duration: 180
      });
      if (!trackResult.success) return;
      const track = trackResult.value;

      // Try to add track with invalid user (null)
      const result = queueService.addTrackToQueue(track, null as any);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('INVALID_USER');
      }

      // Queue should remain empty and functional
      const queueState = queueService.getQueueState();
      expect(queueState.isEmpty).toBe(true);
      expect(queueState.totalLength).toBe(0);
    });

    it('should handle errors without corrupting service state', () => {
      const trackResult = TrackValidator.create({
        title: 'Valid Song',
        artist: 'Valid Artist',
        sourceUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        duration: 180
      });
      if (!trackResult.success) return;
      const track = trackResult.value;

      const userResult = UserValidator.create({
        id: 'user1',
        nickname: 'TestUser'
      });
      if (!userResult.success) return;
      const user = userResult.value;

      // Add a valid track first
      const validResult = queueService.addTrackToQueue(track, user);
      expect(validResult.success).toBe(true);

      // Try several invalid operations
      queueService.addTrackToQueue(null as any, user); // Invalid track
      queueService.addTrackToQueue(track, null as any); // Invalid user
      queueService.addTrackToQueue(undefined as any, user); // Undefined track

      // Service should still be functional
      const queueState = queueService.getQueueState();
      expect(queueState.totalLength).toBe(1); // Only the valid track should be in queue
      expect(queueState.currentTrack?.track.title).toBe('Valid Song');

      // Should still be able to add more valid tracks
      const anotherValidResult = queueService.addTrackToQueue(track, user);
      expect(anotherValidResult.success).toBe(true);

      const finalState = queueService.getQueueState();
      expect(finalState.totalLength).toBe(2);
    });
  });

  /**
   * Integration Test: Complete User Workflows
   * Test complete user workflows
   * Requirements: 3.1, 3.2, 6.1, 6.2
   */
  describe('Complete User Workflows', () => {
    it('should handle complete add-track-advance workflow', () => {
      // Create test data
      const track1Result = TrackValidator.create({
        title: 'First Song',
        artist: 'Artist 1',
        sourceUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        duration: 180
      });
      const track2Result = TrackValidator.create({
        title: 'Second Song',
        artist: 'Artist 2',
        sourceUrl: 'https://www.youtube.com/watch?v=abc123def456',
        duration: 200
      });
      const userResult = UserValidator.create({
        id: 'user1',
        nickname: 'TestUser'
      });

      if (!track1Result.success || !track2Result.success || !userResult.success) return;
      
      const track1 = track1Result.value;
      const track2 = track2Result.value;
      const user = userResult.value;

      // Initial state: empty queue
      let queueState = queueService.getQueueState();
      expect(queueState.isEmpty).toBe(true);

      // Add first track
      const add1Result = queueService.addTrackToQueue(track1, user);
      expect(add1Result.success).toBe(true);

      queueState = queueService.getQueueState();
      expect(queueState.totalLength).toBe(1);
      expect(queueState.currentTrack?.track.title).toBe('First Song');
      expect(queueState.upcomingTracks.length).toBe(0);

      // Add second track
      const add2Result = queueService.addTrackToQueue(track2, user);
      expect(add2Result.success).toBe(true);

      queueState = queueService.getQueueState();
      expect(queueState.totalLength).toBe(2);
      expect(queueState.currentTrack?.track.title).toBe('First Song');
      expect(queueState.upcomingTracks.length).toBe(1);
      expect(queueState.upcomingTracks[0].track.title).toBe('Second Song');

      // Advance to next track
      const advanceResult = queueService.advanceToNextTrack();
      expect(advanceResult.success).toBe(true);
      if (advanceResult.success) {
        expect(advanceResult.value?.track.title).toBe('Second Song');
      }

      queueState = queueService.getQueueState();
      expect(queueState.totalLength).toBe(1);
      expect(queueState.currentTrack?.track.title).toBe('Second Song');
      expect(queueState.upcomingTracks.length).toBe(0);

      // Advance again (should return null for empty queue)
      const advanceResult2 = queueService.advanceToNextTrack();
      expect(advanceResult2.success).toBe(true);
      if (advanceResult2.success) {
        expect(advanceResult2.value).toBe(null);
      }

      queueState = queueService.getQueueState();
      expect(queueState.isEmpty).toBe(true);
      expect(queueState.totalLength).toBe(0);
    });

    it('should handle rate limiting in realistic user workflow', () => {
      const userResult = UserValidator.create({
        id: 'party-guest',
        nickname: 'Party Guest'
      });
      if (!userResult.success) return;
      const user = userResult.value;

      // Create multiple tracks
      const tracks: Track[] = [];
      for (let i = 1; i <= 7; i++) {
        const trackResult = TrackValidator.create({
          title: `Song ${i}`,
          artist: `Artist ${i}`,
          sourceUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          duration: 180 + i * 10
        });
        if (trackResult.success) {
          tracks.push(trackResult.value);
        }
      }

      // User adds tracks until rate limited
      let successfulAdds = 0;
      let rateLimitHit = false;

      for (let i = 0; i < tracks.length; i++) {
        const result = queueService.addTrackToQueue(tracks[i], user);
        
        if (result.success) {
          successfulAdds++;
          
          // Verify queue state
          const queueState = queueService.getQueueState();
          expect(queueState.totalLength).toBe(successfulAdds);
          
          // Verify rate limit info
          const rateLimitInfo = queueService.getUserRateLimitInfo(user);
          expect(rateLimitInfo.remainingRequests).toBe(5 - successfulAdds);
          
        } else {
          expect(result.error).toBe('RATE_LIMIT_EXCEEDED');
          rateLimitHit = true;
          
          // Queue should not have changed
          const queueState = queueService.getQueueState();
          expect(queueState.totalLength).toBe(successfulAdds);
          
          // Rate limit info should show 0 remaining
          const rateLimitInfo = queueService.getUserRateLimitInfo(user);
          expect(rateLimitInfo.remainingRequests).toBe(0);
          expect(rateLimitInfo.canAddTrack).toBe(false);
          expect(rateLimitInfo.timeUntilReset).toBeGreaterThan(0);
          
          break;
        }
      }

      expect(successfulAdds).toBe(5);
      expect(rateLimitHit).toBe(true);

      // Verify final queue state
      const finalQueueState = queueService.getQueueState();
      expect(finalQueueState.totalLength).toBe(5);
      expect(finalQueueState.currentTrack?.track.title).toBe('Song 1');
      expect(finalQueueState.upcomingTracks.length).toBe(4);
    });
  });
});