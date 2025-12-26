/**
 * Integration test to verify all core types work together
 */

import { 
  TrackValidator, 
  UserValidator, 
  QueueItemValidator,
  QueueStateFactory,
  ErrorFactory
} from '../index';

describe('Core Types Integration', () => {
  test('can create a complete queue workflow', () => {
    // Create a valid track
    const trackResult = TrackValidator.create({
      title: 'Test Song',
      artist: 'Test Artist',
      videoId: 'dQw4w9WgXcQ',
      duration: 180
    });

    expect(trackResult.success).toBe(true);
    if (!trackResult.success) return;

    // Create a valid user
    const userResult = UserValidator.create({
      id: 'user123',
      nickname: 'TestUser'
    });

    expect(userResult.success).toBe(true);
    if (!userResult.success) return;

    // Create a queue item
    const queueItemResult = QueueItemValidator.create({
      track: trackResult.value,
      addedBy: userResult.value
    });

    expect(queueItemResult.success).toBe(true);
    if (!queueItemResult.success) return;

    // Create queue state
    const queueState = QueueStateFactory.create(queueItemResult.value, []);

    expect(queueState.currentTrack).toBe(queueItemResult.value);
    expect(queueState.upcomingTracks).toHaveLength(0);
    expect(queueState.totalLength).toBe(1);
    expect(queueState.isEmpty).toBe(false);
  });

  test('handles validation errors correctly', () => {
    // Test invalid track
    const invalidTrackResult = TrackValidator.create({
      title: '',
      artist: 'Test Artist',
      videoId: 'invalid-id',
      duration: -1
    });

    expect(invalidTrackResult.success).toBe(false);
    if (invalidTrackResult.success) return;

    const errorDetails = ErrorFactory.createTrackError(invalidTrackResult.error);
    expect(errorDetails.code).toBe(invalidTrackResult.error);
    expect(errorDetails.message).toBeTruthy();
    expect(errorDetails.suggestion).toBeTruthy();
  });

  test('creates empty queue state correctly', () => {
    const emptyState = QueueStateFactory.empty();

    expect(emptyState.currentTrack).toBeNull();
    expect(emptyState.upcomingTracks).toHaveLength(0);
    expect(emptyState.totalLength).toBe(0);
    expect(emptyState.isEmpty).toBe(true);
  });
});