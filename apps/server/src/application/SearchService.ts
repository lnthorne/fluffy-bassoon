/**
 * Search Service for YouTube music search functionality
 * 
 * Application service that orchestrates search operations by integrating with
 * YouTubeAdapter. Handles pagination, parameter validation, and result transformation.
 * 
 * Requirements: 1.1, 1.2, 1.5, 3.1, 3.4
 */

import { 
  SearchResult, 
  Result 
} from '@party-jukebox/shared';
import { IYouTubeAdapter, YouTubeSearchItem, YouTubeVideoDetails } from '../infrastructure/youtube/types';

/**
 * Paginated search results interface
 * Requirements: 3.2, 3.7
 */
export interface PaginatedSearchResults {
  results: SearchResult[];
  pagination: {
    currentPage: number;
    totalResults: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
    nextPageToken?: string;
    prevPageToken?: string;
    resultsPerPage: number;
  };
}

/**
 * Search parameters interface
 * Requirements: 1.5, 3.1, 3.4
 */
export interface SearchParams {
  query: string;
  page?: number;
  limit?: number;
  pageToken?: string;
}

/**
 * Search service error types
 * Requirements: 1.4, 3.5
 */
export type SearchError = 
  | 'INVALID_QUERY'
  | 'INVALID_PAGE'
  | 'INVALID_LIMIT'
  | 'YOUTUBE_API_ERROR'
  | 'SERVICE_UNAVAILABLE';

/**
 * Search Service Interface
 * Requirements: 1.1, 1.2, 1.5
 */
export interface ISearchService {
  search(params: SearchParams): Promise<Result<PaginatedSearchResults, SearchError>>;
}

/**
 * Search Service Implementation
 * Requirements: 1.1, 1.2, 1.5, 3.1, 3.4
 */
export class SearchService implements ISearchService {
  private readonly DEFAULT_PAGE = 1;
  private readonly DEFAULT_LIMIT = 20;
  private readonly MAX_LIMIT = 50; // YouTube API limit
  private readonly MIN_LIMIT = 1;
  private readonly MAX_QUERY_LENGTH = 100;

  constructor(
    private readonly youtubeAdapter: IYouTubeAdapter
  ) {}

  /**
   * Search for music videos with pagination support
   * Requirements: 1.1, 1.2, 1.5, 3.1, 3.4
   */
  async search(params: SearchParams): Promise<Result<PaginatedSearchResults, SearchError>> {
    try {
      // Validate search parameters
      const validationResult = this.validateSearchParams(params);
      if (!validationResult.success) {
        return validationResult as Result<PaginatedSearchResults, SearchError>;
      }

      const { query, page, limit } = validationResult.value;

      // Step 1: Search for videos using YouTube API
      const searchResponse = await this.youtubeAdapter.searchVideos(
        query, 
        params.pageToken, 
        limit
      );

      // Step 2: Get video details for duration information
      const videoIds = searchResponse.items.map(item => item.id.videoId);
      const videoDetails = videoIds.length > 0 
        ? await this.youtubeAdapter.getVideoDetails(videoIds)
        : [];

      // Step 3: Combine search results with video details
      const searchResults = this.combineSearchAndDetails(searchResponse.items, videoDetails);

      // Step 4: Transform to paginated results
      const paginatedResults = this.transformToPaginatedResults(
        searchResults, 
        searchResponse, 
        page
      );

      return { success: true, value: paginatedResults };

    } catch (error) {
      // Handle YouTube API errors
      if (error instanceof Error) {
        if (error.message.includes('quota') || error.message.includes('QUOTA')) {
          return { success: false, error: 'SERVICE_UNAVAILABLE' };
        }
        
        if (error.message.includes('unavailable') || error.message.includes('timeout')) {
          return { success: false, error: 'SERVICE_UNAVAILABLE' };
        }
      }

      return { success: false, error: 'YOUTUBE_API_ERROR' };
    }
  }

  /**
   * Validate search parameters
   * Requirements: 1.5, 3.1, 3.4
   */
  private validateSearchParams(params: SearchParams): Result<{
    query: string;
    page: number;
    limit: number;
  }, SearchError> {
    // Validate query
    if (!params.query || typeof params.query !== 'string') {
      return { success: false, error: 'INVALID_QUERY' };
    }

    const trimmedQuery = params.query.trim();
    if (trimmedQuery.length === 0) {
      return { success: false, error: 'INVALID_QUERY' };
    }

    if (trimmedQuery.length > this.MAX_QUERY_LENGTH) {
      return { success: false, error: 'INVALID_QUERY' };
    }

    // Validate and set defaults for page
    let page = params.page ?? this.DEFAULT_PAGE;
    if (typeof page !== 'number' || page < 1 || !Number.isInteger(page)) {
      page = this.DEFAULT_PAGE;
    }

    // Validate and set defaults for limit
    let limit = params.limit ?? this.DEFAULT_LIMIT;
    if (typeof limit !== 'number' || limit < this.MIN_LIMIT || limit > this.MAX_LIMIT || !Number.isInteger(limit)) {
      limit = this.DEFAULT_LIMIT;
    }

    return {
      success: true,
      value: {
        query: trimmedQuery,
        page,
        limit
      }
    };
  }

  /**
   * Combine search results with video details to create SearchResult objects
   * Requirements: 1.1, 1.2
   */
  private combineSearchAndDetails(
    searchItems: YouTubeSearchItem[], 
    videoDetails: YouTubeVideoDetails[]
  ): SearchResult[] {
    const detailsMap = new Map<string, YouTubeVideoDetails>();
    videoDetails.forEach(detail => {
      detailsMap.set(detail.id, detail);
    });

    return searchItems
      .map(item => {
        const details = detailsMap.get(item.id.videoId);
        if (!details) {
          // Skip items without duration information
          return null;
        }

        const duration = this.parseDuration(details.contentDetails.duration);
        if (duration === 0) {
          // Skip items with invalid duration
          return null;
        }

        // Extract artist from channel title or use channel title as fallback
        const artist = this.extractArtist(item.snippet.channelTitle, item.snippet.title);

        const searchResult: SearchResult = {
          videoId: item.id.videoId,
          title: item.snippet.title,
          artist: artist,
          duration: duration,
          thumbnailUrl: item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default.url,
          channelTitle: item.snippet.channelTitle,
          publishedAt: item.snippet.publishedAt
        };

        return searchResult;
      })
      .filter((result): result is SearchResult => result !== null);
  }

  /**
   * Parse ISO 8601 duration format to seconds
   * Requirements: 1.2
   */
  private parseDuration(isoDuration: string): number {
    // Parse ISO 8601 duration (PT4M13S) to seconds
    // Handle various formats: PT1H2M3S, PT45S, PT2M, etc.
    const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    
    if (!match) {
      return 0;
    }

    const hours = parseInt(match[1] || '0', 10);
    const minutes = parseInt(match[2] || '0', 10);
    const seconds = parseInt(match[3] || '0', 10);

    return hours * 3600 + minutes * 60 + seconds;
  }

  /**
   * Extract artist name from channel title and video title
   * Requirements: 1.2
   */
  private extractArtist(channelTitle: string, videoTitle: string): string {
    // Simple heuristic: use channel title as artist
    // In the future, this could be enhanced with more sophisticated parsing
    // to extract artist names from video titles (e.g., "Artist - Song Title")
    
    // Check if video title contains " - " pattern which might indicate "Artist - Song"
    const dashIndex = videoTitle.indexOf(' - ');
    if (dashIndex > 0 && dashIndex < videoTitle.length / 2) {
      // If the part before the dash is reasonably short, use it as artist
      const potentialArtist = videoTitle.substring(0, dashIndex).trim();
      if (potentialArtist.length > 0 && potentialArtist.length < 50) {
        return potentialArtist;
      }
    }

    // Fallback to channel title
    return channelTitle;
  }

  /**
   * Transform search results to paginated format
   * Requirements: 3.2, 3.7
   */
  private transformToPaginatedResults(
    results: SearchResult[],
    searchResponse: any,
    currentPage: number
  ): PaginatedSearchResults {
    return {
      results,
      pagination: {
        currentPage,
        totalResults: searchResponse.pageInfo.totalResults,
        hasNextPage: Boolean(searchResponse.nextPageToken),
        hasPrevPage: Boolean(searchResponse.prevPageToken),
        nextPageToken: searchResponse.nextPageToken,
        prevPageToken: searchResponse.prevPageToken,
        resultsPerPage: results.length
      }
    };
  }
}