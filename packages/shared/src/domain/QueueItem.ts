import { generateUUID } from '../utils/uuid';
import { Track } from './Track';
import { User, Result } from './User';

/**
 * QueueItem entity representing a track in the queue with context
 * Requirements: 2.1, 2.5
 */
export interface QueueItem {
  readonly id: string;
  readonly track: Track;
  readonly addedBy: User;
  readonly addedAt: Date;
}

/**
 * QueueItem creation data
 */
export interface QueueItemCreateData {
  track: Track;
  addedBy: User;
  addedAt?: Date;
}

/**
 * QueueItem-related error types
 */
export type QueueItemError = 
  | 'INVALID_TRACK'
  | 'INVALID_USER'
  | 'INVALID_TIMESTAMP';

/**
 * QueueItem validation and creation functions
 */
export class QueueItemValidator {
  static validateTrack(track: Track): boolean {
    return track !== null && track !== undefined && typeof track.id === 'string';
  }

  static validateUser(user: User): boolean {
    return user !== null && user !== undefined && typeof user.id === 'string';
  }

  static validateTimestamp(timestamp: Date): boolean {
    return timestamp instanceof Date && !isNaN(timestamp.getTime());
  }

  static create(data: QueueItemCreateData): Result<QueueItem, QueueItemError> {
    if (!this.validateTrack(data.track)) {
      return { success: false, error: 'INVALID_TRACK' };
    }

    if (!this.validateUser(data.addedBy)) {
      return { success: false, error: 'INVALID_USER' };
    }

    const addedAt = data.addedAt || new Date();
    if (!this.validateTimestamp(addedAt)) {
      return { success: false, error: 'INVALID_TIMESTAMP' };
    }

    const queueItem: QueueItem = {
      id: generateUUID(),
      track: data.track,
      addedBy: data.addedBy,
      addedAt
    };

    return { success: true, value: queueItem };
  }
}