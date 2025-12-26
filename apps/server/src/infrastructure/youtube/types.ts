/**
 * YouTube Data API v3 Types
 * 
 * Type definitions for YouTube API responses and adapter interfaces.
 * 
 * Requirements: 1.1, 1.2, 3.2, 6.1
 */

/**
 * YouTube Data API v3 Search Response
 * Requirements: 1.1, 3.2
 */
export interface YouTubeSearchResponse {
  kind: 'youtube#searchListResponse';
  etag: string;
  nextPageToken?: string;
  prevPageToken?: string;
  pageInfo: {
    totalResults: number;
    resultsPerPage: number;
  };
  items: YouTubeSearchItem[];
}

/**
 * Individual search result item
 * Requirements: 1.1, 1.2
 */
export interface YouTubeSearchItem {
  kind: 'youtube#searchResult';
  etag: string;
  id: {
    kind: 'youtube#video';
    videoId: string;
  };
  snippet: {
    publishedAt: string;
    channelId: string;
    title: string;
    description: string;
    thumbnails: {
      default: { url: string; width: number; height: number; };
      medium: { url: string; width: number; height: number; };
      high: { url: string; width: number; height: number; };
    };
    channelTitle: string;
  };
}

/**
 * YouTube Video Details Response
 * Requirements: 1.2
 */
export interface YouTubeVideoDetailsResponse {
  kind: 'youtube#videoListResponse';
  etag: string;
  items: YouTubeVideoDetails[];
}

/**
 * Individual video details
 * Requirements: 1.2
 */
export interface YouTubeVideoDetails {
  kind: 'youtube#video';
  id: string;
  snippet: {
    title: string;
    channelTitle: string;
  };
  contentDetails: {
    duration: string; // ISO 8601 format (e.g., "PT4M13S")
  };
}

/**
 * YouTube API Error Response
 * Requirements: 1.4, 6.3
 */
export interface YouTubeError {
  error: {
    code: number;
    message: string;
    errors: Array<{
      domain: string;
      reason: string;
      message: string;
    }>;
  };
}

/**
 * YouTube Adapter Configuration
 * Requirements: 6.1, 6.2
 */
export interface YouTubeConfig {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
  maxResults?: number;
}

/**
 * YouTube Adapter Interface
 * Requirements: 1.1, 6.1, 6.2, 6.3
 */
export interface IYouTubeAdapter {
  /**
   * Search for videos using YouTube Data API v3
   * Requirements: 1.1
   */
  searchVideos(query: string, pageToken?: string, maxResults?: number): Promise<YouTubeSearchResponse>;

  /**
   * Get detailed video information including duration
   * Requirements: 1.2
   */
  getVideoDetails(videoIds: string[]): Promise<YouTubeVideoDetails[]>;

  /**
   * Check if the adapter is properly configured
   * Requirements: 6.1, 6.2
   */
  isConfigured(): boolean;
}