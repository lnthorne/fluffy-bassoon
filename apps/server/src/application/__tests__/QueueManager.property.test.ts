/**
 * Property-based tests for QueueManager
 * Feature: queue-management
 */

import * as fc from 'fast-check';
import { QueueManager } from '../QueueManager';
import { TrackValidator, UserValidator } from '@party-jukebox/shared';

describe('QueueManager Property Tests', () => {
  /**
   * Property 3: Queue Item Creation and Ordering
   * For any sequence of track additions by users, the queue should maintain insertion order 
   * and create queue items with correct track, user, and timestamp information
   * Validates: Requirements 2.1, 2.2, 2.4, 2.5
   */
  test('Property 3: Queue Item Creation and Ordering', () => {
    fc.assert(fc.property(
      // Generate a sequence of valid tracks and users
      fc.array(
        fc.record({
          track: fc.record({
            title: fc.string({ minLength: 1, maxLength: 100 }).filter((s: string) => s.trim().length > 0),
            artist: fc.string({ minLength: 1, maxLength: 100 }).filter((s: string) => s.trim().length > 0),
            sourceUrl: fc.constantFrom(
              'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
              'https://youtube.com/watch?v=abc123def456',
              'https://youtu.be/xyz789uvw012'
            ),
            duration: fc.integer({ min: 1, max: 7200 }) // 1 second to 2 hours
          }),
          user: fc.record({
            id: fc.string({ minLength: 1, maxLength: 50 }).filter((s: string) => s.trim().length > 0),
            nickname: fc.string({ minLength: 1, maxLength: 50 }).filter((s: string) => s.trim().length > 0)
          })
        }),
        { minLength: 1, maxLength: 10 } // Test with 1-10 tracks
      ),
      (trackUserPairs: Array<{ track: any; user: any }>) => {
        const queueManager = new QueueManager();
        const addedItems: any[] = [];
        const startTime = Date.now();
        
        // Add all tracks to the queue
        for (let i = 0; i < trackUserPairs.length; i++) {
          const { track: trackData, user: userData } = trackUserPairs[i];
          
          // Create valid track and user
          const trackResult = TrackValidator.create(trackData);
          const userResult = UserValidator.create(userData);
          
          if (!trackResult.success || !userResult.success) {
            return true; // Skip invalid data
          }
          
          const track = trackResult.value;
          const user = userResult.value;
          
          // Add track to queue
          const addResult = queueManager.addTrack(track, user);
          
          if (!addResult.success) {
            return false; // Should be able to add valid tracks
          }
          
          const queueItem = addResult.value;
          addedItems.push(queueItem);
          
          // Verify queue item properties (Requirements 2.1, 2.5)
          if (queueItem.track.id !== track.id) {
            return false; // Queue item should contain the correct track
          }
          
          if (queueItem.addedBy.id !== user.id) {
            return false; // Queue item should contain the correct user
          }
          
          if (!(queueItem.addedAt instanceof Date)) {
            return false; // Queue item should have a valid timestamp
          }
          
          if (queueItem.addedAt.getTime() < startTime) {
            return false; // Timestamp should be reasonable (not in the past)
          }
          
          // Verify queue length increases correctly (Requirements 2.2)
          const expectedLength = i + 1;
          if (queueManager.getQueueLength() !== expectedLength) {
            return false; // Queue length should increase with each addition
          }
        }
        
        // Verify ordering: first track should be current, rest should be upcoming (Requirements 2.2, 2.4)
        const currentTrack = queueManager.getCurrentTrack();
        const upcomingTracks = queueManager.getUpcomingTracks();
        
        if (addedItems.length === 0) {
          return true; // Empty case is valid
        }
        
        // First added item should be current track (Requirements 2.3)
        if (!currentTrack || currentTrack.id !== addedItems[0].id) {
          return false; // First track should become current
        }
        
        // Remaining items should be in upcoming tracks in order (Requirements 2.2, 2.4)
        if (upcomingTracks.length !== addedItems.length - 1) {
          return false; // Upcoming tracks should contain all but the first track
        }
        
        for (let i = 1; i < addedItems.length; i++) {
          const expectedItem = addedItems[i];
          const actualItem = upcomingTracks[i - 1];
          
          if (actualItem.id !== expectedItem.id) {
            return false; // Upcoming tracks should maintain insertion order
          }
        }
        
        // Verify queue state consistency (Requirements 5.1, 5.2, 5.3)
        const queueState = queueManager.getQueueState();
        
        if (queueState.totalLength !== addedItems.length) {
          return false; // Total length should match number of added items
        }
        
        if (queueState.isEmpty !== (addedItems.length === 0)) {
          return false; // isEmpty should reflect actual queue state
        }
        
        if (queueState.currentTrack?.id !== currentTrack?.id) {
          return false; // Queue state should match current track
        }
        
        if (queueState.upcomingTracks.length !== upcomingTracks.length) {
          return false; // Queue state should match upcoming tracks
        }
        
        // Verify timestamps are in chronological order (Requirements 2.5)
        for (let i = 1; i < addedItems.length; i++) {
          const prevTimestamp = addedItems[i - 1].addedAt.getTime();
          const currTimestamp = addedItems[i].addedAt.getTime();
          
          if (currTimestamp < prevTimestamp) {
            return false; // Timestamps should be in chronological order
          }
        }
        
        return true;
      }
    ), { numRuns: 100 });
  });

  /**
   * Property 4: Empty Queue First Track Handling
   * For any track added to an empty queue, that track should immediately become the current track ready to play
   * Validates: Requirements 2.3
   */
  test('Property 4: Empty Queue First Track Handling', () => {
    fc.assert(fc.property(
      // Generate a valid track and user
      fc.record({
        track: fc.record({
          title: fc.string({ minLength: 1, maxLength: 100 }).filter((s: string) => s.trim().length > 0),
          artist: fc.string({ minLength: 1, maxLength: 100 }).filter((s: string) => s.trim().length > 0),
          sourceUrl: fc.constantFrom(
            'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
            'https://youtube.com/watch?v=abc123def456',
            'https://youtu.be/xyz789uvw012'
          ),
          duration: fc.integer({ min: 1, max: 7200 }) // 1 second to 2 hours
        }),
        user: fc.record({
          id: fc.string({ minLength: 1, maxLength: 50 }).filter((s: string) => s.trim().length > 0),
          nickname: fc.string({ minLength: 1, maxLength: 50 }).filter((s: string) => s.trim().length > 0)
        })
      }),
      (trackUserData: { track: any; user: any }) => {
        const queueManager = new QueueManager();
        
        // Verify queue starts empty
        if (queueManager.getCurrentTrack() !== null) {
          return false; // Queue should start empty
        }
        
        if (queueManager.getQueueLength() !== 0) {
          return false; // Queue length should be 0 initially
        }
        
        if (!queueManager.getQueueState().isEmpty) {
          return false; // Queue state should indicate empty
        }
        
        // Create valid track and user
        const trackResult = TrackValidator.create(trackUserData.track);
        const userResult = UserValidator.create(trackUserData.user);
        
        if (!trackResult.success || !userResult.success) {
          return true; // Skip invalid data
        }
        
        const track = trackResult.value;
        const user = userResult.value;
        
        // Add track to empty queue
        const addResult = queueManager.addTrack(track, user);
        
        if (!addResult.success) {
          return false; // Should be able to add valid track to empty queue
        }
        
        const queueItem = addResult.value;
        
        // Verify the track immediately becomes current (Requirements 2.3)
        const currentTrack = queueManager.getCurrentTrack();
        if (!currentTrack) {
          return false; // Current track should not be null after adding to empty queue
        }
        
        if (currentTrack.id !== queueItem.id) {
          return false; // The added track should become the current track
        }
        
        if (currentTrack.track.id !== track.id) {
          return false; // Current track should contain the correct track data
        }
        
        if (currentTrack.addedBy.id !== user.id) {
          return false; // Current track should contain the correct user data
        }
        
        // Verify queue length is now 1
        if (queueManager.getQueueLength() !== 1) {
          return false; // Queue length should be 1 after adding first track
        }
        
        // Verify no upcoming tracks (since this is the first and only track)
        const upcomingTracks = queueManager.getUpcomingTracks();
        if (upcomingTracks.length !== 0) {
          return false; // Should be no upcoming tracks when only one track in queue
        }
        
        // Verify queue state consistency
        const queueState = queueManager.getQueueState();
        if (queueState.isEmpty) {
          return false; // Queue should no longer be empty
        }
        
        if (queueState.totalLength !== 1) {
          return false; // Total length should be 1
        }
        
        if (!queueState.currentTrack || queueState.currentTrack.id !== queueItem.id) {
          return false; // Queue state should reflect the current track
        }
        
        if (queueState.upcomingTracks.length !== 0) {
          return false; // Queue state should show no upcoming tracks
        }
        
        // Verify the track is "ready to play" (marked as current)
        // This is the core requirement: empty queue + add track = ready to play
        if (queueManager.getCurrentTrack()?.track.id !== track.id) {
          return false; // The track should be ready to play (current track)
        }
        
        return true;
      }
    ), { numRuns: 100 });
  });
});