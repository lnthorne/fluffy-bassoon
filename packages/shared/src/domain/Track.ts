import { generateUUID } from '../utils/uuid';

/**
 * Track entity representing a music item with metadata
 * Requirements: 2.1, 2.4, 4.3
 */
export interface Track {
  readonly id: string;
  readonly title: string;
  readonly artist: string;
  readonly videoId: string;
  readonly duration: number; // seconds
  readonly thumbnailUrl?: string;
}

/**
 * Track creation data for validation
 */
export interface TrackCreateData {
  title: string;
  artist: string;
  videoId?: string;        // Preferred format
  sourceUrl?: string;      // Alternative: full YouTube URL
  duration: number;
  thumbnailUrl?: string;
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
  | 'INVALID_VIDEO_ID'
  | 'INVALID_DURATION';

/**
 * Utility functions for video ID handling
 */
export class VideoIdUtils {
  static constructYouTubeUrl(videoId: string): string {
    return `https://www.youtube.com/watch?v=${videoId}`;
  }

  static isValidVideoId(value: string): boolean {
    // YouTube video IDs are 11 characters, alphanumeric + underscore/hyphen
    return /^[a-zA-Z0-9_-]{11}$/.test(value);
  }

  static extractVideoIdFromUrl(url: string): string | null {
    // Helper function to extract video ID from YouTube URLs (for API flexibility)
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
    return match ? match[1] : null;
  }
}

/**
 * Track validation and creation functions
 */
export class TrackValidator {
  static validateTitle(title: string): boolean {
    return typeof title === 'string' && title.trim().length > 0;
  }

  static validateArtist(artist: string): boolean {
    return typeof artist === 'string' && artist.trim().length > 0;
  }

  static validateVideoId(videoId: string): boolean {
    return typeof videoId === 'string' && VideoIdUtils.isValidVideoId(videoId);
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

    // Handle both video ID and URL inputs for API flexibility
    let videoId: string | undefined = data.videoId;
    
    if (!videoId && data.sourceUrl) {
      const extractedId = VideoIdUtils.extractVideoIdFromUrl(data.sourceUrl);
      if (!extractedId) {
        return { success: false, error: 'INVALID_VIDEO_ID' };
      }
      videoId = extractedId;
    }

    if (!videoId || !this.validateVideoId(videoId)) {
      return { success: false, error: 'INVALID_VIDEO_ID' };
    }

    if (!this.validateDuration(data.duration)) {
      return { success: false, error: 'INVALID_DURATION' };
    }

    const track: Track = {
      id: generateUUID(),
      title: data.title.trim(),
      artist: data.artist.trim(),
      videoId: videoId,
      duration: data.duration,
      ...(data.thumbnailUrl && { thumbnailUrl: data.thumbnailUrl })
    };

    return { success: true, value: track };
  }
}

/**
 * Search result interface for creating tracks from search results
 */
export interface SearchResult {
  videoId: string;
  title: string;
  artist: string;
  duration: number;
  thumbnailUrl: string;
  channelTitle: string;
  publishedAt: string;
}

/**
 * Factory for creating tracks from various sources
 */
export class TrackFactory {
  static fromSearchResult(searchResult: SearchResult): TrackCreateData {
    return {
      title: searchResult.title,
      artist: searchResult.artist,
      videoId: searchResult.videoId,
      duration: searchResult.duration,
      thumbnailUrl: searchResult.thumbnailUrl
    };
  }

  static fromUserInput(input: TrackCreateData): TrackCreateData {
    // Handle both video ID and URL inputs for API flexibility
    let videoId: string | undefined = input.videoId;
    
    if (!videoId && input.sourceUrl) {
      const extractedId = VideoIdUtils.extractVideoIdFromUrl(input.sourceUrl);
      if (!extractedId) {
        throw new Error('Invalid YouTube URL format');
      }
      videoId = extractedId;
    }

    if (!videoId) {
      throw new Error('Video ID is required');
    }

    return {
      ...input,
      videoId: videoId
    };
  }
}