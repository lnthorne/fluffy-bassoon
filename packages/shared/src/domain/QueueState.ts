import { QueueItem } from './QueueItem';

/**
 * Queue state representation for external consumers
 * Requirements: 5.1, 5.2, 5.3
 */
export interface QueueState {
  readonly currentTrack: QueueItem | null;
  readonly upcomingTracks: readonly QueueItem[];
  readonly totalLength: number;
  readonly isEmpty: boolean;
}

/**
 * Rate limiting data structures
 */
export interface UserRateData {
  readonly userId: string;
  readonly requests: readonly RequestRecord[];
  readonly windowStart: Date;
}

export interface RequestRecord {
  readonly timestamp: Date;
  readonly trackId: string;
}

/**
 * Event types for queue state changes
 */
export type QueueEvent = 
  | { type: 'TRACK_ADDED'; payload: { queueItem: QueueItem } }
  | { type: 'QUEUE_ADVANCED'; payload: { previousTrack: QueueItem | null; currentTrack: QueueItem | null } }
  | { type: 'QUEUE_CLEARED'; payload: {} }
  | { type: 'RATE_LIMIT_EXCEEDED'; payload: { userId: string; timeRemaining: number } };

/**
 * Queue state factory for creating consistent state objects
 */
export class QueueStateFactory {
  static create(
    currentTrack: QueueItem | null,
    upcomingTracks: QueueItem[]
  ): QueueState {
    return {
      currentTrack,
      upcomingTracks: Object.freeze([...upcomingTracks]),
      totalLength: (currentTrack ? 1 : 0) + upcomingTracks.length,
      isEmpty: currentTrack === null && upcomingTracks.length === 0
    };
  }

  static empty(): QueueState {
    return this.create(null, []);
  }
}