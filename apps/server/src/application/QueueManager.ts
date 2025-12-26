import { 
  Track, 
  User, 
  QueueItem, 
  QueueItemValidator, 
  QueueState, 
  QueueStateFactory, 
  QueueEvent, 
  QueueError, 
  Result 
} from '@party-jukebox/shared';

/**
 * Queue manager interface for core queue operations
 * Requirements: 2.2, 2.3, 4.1, 4.2, 5.1, 5.2, 5.3
 */
export interface IQueueManager {
  addTrack(track: Track, user: User): Result<QueueItem, QueueError>;
  advanceQueue(): Result<QueueItem | null, QueueError>;
  getCurrentTrack(): QueueItem | null;
  getUpcomingTracks(): QueueItem[];
  getQueueLength(): number;
  clearQueue(): void;
  getQueueState(): QueueState;
}

/**
 * Event listener interface for queue state changes
 */
export interface QueueEventListener {
  onQueueEvent(event: QueueEvent): void;
}

/**
 * Queue manager implementation handling all queue operations
 * Maintains queue state and emits events for state changes
 */
export class QueueManager implements IQueueManager {
  private currentTrack: QueueItem | null = null;
  private upcomingTracks: QueueItem[] = [];
  private eventListeners: QueueEventListener[] = [];

  /**
   * Add a track to the queue
   * Requirements: 2.1, 2.2, 2.5
   */
  addTrack(track: Track, user: User): Result<QueueItem, QueueError> {
    // Validate inputs
    if (!track || typeof track.id !== 'string') {
      return { success: false, error: 'INVALID_TRACK' };
    }

    if (!user || typeof user.id !== 'string') {
      return { success: false, error: 'INVALID_USER' };
    }

    // Create queue item
    const queueItemResult = QueueItemValidator.create({
      track,
      addedBy: user,
      addedAt: new Date()
    });

    if (!queueItemResult.success) {
      // Map QueueItem errors to Queue errors
      switch (queueItemResult.error) {
        case 'INVALID_TRACK':
          return { success: false, error: 'INVALID_TRACK' };
        case 'INVALID_USER':
          return { success: false, error: 'INVALID_USER' };
        default:
          return { success: false, error: 'INVALID_TRACK' };
      }
    }

    const queueItem = queueItemResult.value;

    // Handle empty queue case - first track becomes current
    // Requirements: 2.3
    if (this.currentTrack === null) {
      this.currentTrack = queueItem;
    } else {
      // Add to end of queue
      // Requirements: 2.2, 2.4
      this.upcomingTracks.push(queueItem);
    }

    // Emit event for track addition
    // Requirements: 5.4
    this.emitEvent({
      type: 'TRACK_ADDED',
      payload: { queueItem }
    });

    return { success: true, value: queueItem };
  }

  /**
   * Advance the queue to the next track
   * Requirements: 4.1, 4.2, 4.4
   */
  advanceQueue(): Result<QueueItem | null, QueueError> {
    const previousTrack = this.currentTrack;

    // Handle empty queue case
    // Requirements: 4.3, 5.5
    if (this.currentTrack === null) {
      return { success: true, value: null };
    }

    // Move to next track or set to null if queue is empty
    // Requirements: 4.1, 4.2
    if (this.upcomingTracks.length > 0) {
      this.currentTrack = this.upcomingTracks.shift()!;
    } else {
      this.currentTrack = null;
    }

    // Emit event for queue advancement
    // Requirements: 5.4
    this.emitEvent({
      type: 'QUEUE_ADVANCED',
      payload: { 
        previousTrack, 
        currentTrack: this.currentTrack 
      }
    });

    return { success: true, value: this.currentTrack };
  }

  /**
   * Get the currently playing track
   * Requirements: 5.2
   */
  getCurrentTrack(): QueueItem | null {
    return this.currentTrack;
  }

  /**
   * Get upcoming tracks in order
   * Requirements: 5.3
   */
  getUpcomingTracks(): QueueItem[] {
    // Return a copy to prevent external mutation
    return [...this.upcomingTracks];
  }

  /**
   * Get total queue length including current track
   * Requirements: 5.1
   */
  getQueueLength(): number {
    return (this.currentTrack ? 1 : 0) + this.upcomingTracks.length;
  }

  /**
   * Clear the entire queue
   * Requirements: 5.1, 5.2, 5.3
   */
  clearQueue(): void {
    this.currentTrack = null;
    this.upcomingTracks = [];

    // Emit event for queue clearing
    // Requirements: 5.4
    this.emitEvent({
      type: 'QUEUE_CLEARED',
      payload: {}
    });
  }

  /**
   * Get complete queue state
   * Requirements: 5.1, 5.2, 5.3
   */
  getQueueState(): QueueState {
    return QueueStateFactory.create(this.currentTrack, this.upcomingTracks);
  }

  /**
   * Add event listener for queue state changes
   * Requirements: 5.4
   */
  addEventListener(listener: QueueEventListener): void {
    this.eventListeners.push(listener);
  }

  /**
   * Remove event listener
   * Requirements: 5.4
   */
  removeEventListener(listener: QueueEventListener): void {
    const index = this.eventListeners.indexOf(listener);
    if (index >= 0) {
      this.eventListeners.splice(index, 1);
    }
  }

  /**
   * Emit event to all registered listeners
   * Requirements: 5.4
   */
  private emitEvent(event: QueueEvent): void {
    for (const listener of this.eventListeners) {
      try {
        listener.onQueueEvent(event);
      } catch (error) {
        // Log error but don't let listener failures break queue operations
        console.error('Queue event listener error:', error);
      }
    }
  }

  /**
   * Get debug information about current queue state
   * Not part of public interface - for testing and debugging
   */
  getDebugState(): { currentTrack: QueueItem | null; upcomingTracks: QueueItem[]; listenerCount: number } {
    return {
      currentTrack: this.currentTrack,
      upcomingTracks: [...this.upcomingTracks],
      listenerCount: this.eventListeners.length
    };
  }
}