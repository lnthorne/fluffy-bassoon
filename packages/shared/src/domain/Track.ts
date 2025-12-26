/**
 * Track entity representing a music item with metadata
 * Requirements: 1.1, 1.3, 1.4
 */
export interface Track {
  readonly id: string;
  readonly title: string;
  readonly artist: string;
  readonly sourceUrl: string;
  readonly duration: number; // seconds
}

/**
 * Track creation data for validation
 */
export interface TrackCreateData {
  title: string;
  artist: string;
  sourceUrl: string;
  duration: number;
}

/**
 * Result type for operations that can fail
 */
export type Result<T, E> = 
  | { success: true; value: T }
  | { success: false; error: E };

/**
 * Track-related error types
 */
export type TrackError = 
  | 'INVALID_TITLE'
  | 'INVALID_ARTIST'
  | 'INVALID_SOURCE_URL'
  | 'INVALID_DURATION';

/**
 * Track validation and creation functions
 */
export class TrackValidator {
  private static readonly YOUTUBE_URL_PATTERN = /^https:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)[a-zA-Z0-9_-]+/;

  static validateTitle(title: string): boolean {
    return typeof title === 'string' && title.trim().length > 0;
  }

  static validateArtist(artist: string): boolean {
    return typeof artist === 'string' && artist.trim().length > 0;
  }

  static validateSourceUrl(url: string): boolean {
    return typeof url === 'string' && this.YOUTUBE_URL_PATTERN.test(url);
  }

  static validateDuration(duration: number): boolean {
    return typeof duration === 'number' && duration > 0 && Number.isInteger(duration);
  }

  static create(data: TrackCreateData): Result<Track, TrackError> {
    if (!this.validateTitle(data.title)) {
      return { success: false, error: 'INVALID_TITLE' };
    }

    if (!this.validateArtist(data.artist)) {
      return { success: false, error: 'INVALID_ARTIST' };
    }

    if (!this.validateSourceUrl(data.sourceUrl)) {
      return { success: false, error: 'INVALID_SOURCE_URL' };
    }

    if (!this.validateDuration(data.duration)) {
      return { success: false, error: 'INVALID_DURATION' };
    }

    const track: Track = {
      id: crypto.randomUUID(),
      title: data.title.trim(),
      artist: data.artist.trim(),
      sourceUrl: data.sourceUrl,
      duration: data.duration
    };

    return { success: true, value: track };
  }
}