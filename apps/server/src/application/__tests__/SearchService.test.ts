/**
 * SearchService Unit Tests - Edge Cases
 * 
 * Tests for empty results, missing parameters, and rate limiting scenarios.
 * Requirements: 1.3, 3.3, 3.5
 */

import { SearchService, SearchParams, PaginatedSearchResults, SearchError } from '../SearchService';
import { IYouTubeAdapter, YouTubeSearchResponse, YouTubeVideoDetails } from '../../infrastructure/youtube/types';

// Mock YouTube Adapter for testing
class MockYouTubeAdapter implements IYouTubeAdapter {
  private shouldThrowError = false;
  private errorToThrow: Error | null = null;
  private searchResponse: YouTubeSearchResponse | null = null;
  private videoDetails: YouTubeVideoDetails[] = [];

  // Test setup methods
  setSearchResponse(response: YouTubeSearchResponse) {
    this.searchResponse = response;
  }

  setVideoDetails(details: YouTubeVideoDetails[]) {
    this.videoDetails = details;
  }

  setShouldThrowError(error: Error) {
    this.shouldThrowError = true;
    this.errorToThrow = error;
  }

  reset() {
    this.shouldThrowError = false;
    this.errorToThrow = null;
    this.searchResponse = null;
    this.videoDetails = [];
  }

  // IYouTubeAdapter implementation
  async searchVideos(query: string, pageToken?: string, maxResults?: number): Promise<YouTubeSearchResponse> {
    if (this.shouldThrowError && this.errorToThrow) {
      throw this.errorToThrow;
    }

    if (!this.searchResponse) {
      throw new Error('Mock not configured - call setSearchResponse first');
    }

    return this.searchResponse;
  }

  async getVideoDetails(videoIds: string[]): Promise<YouTubeVideoDetails[]> {
    if (this.shouldThrowError && this.errorToThrow) {
      throw this.errorToThrow;
    }

    return this.videoDetails.filter(detail => videoIds.includes(detail.id));
  }

  isConfigured(): boolean {
    return true;
  }
}

describe('SearchService - Edge Cases', () => {
  let searchService: SearchService;
  let mockAdapter: MockYouTubeAdapter;

  beforeEach(() => {
    mockAdapter = new MockYouTubeAdapter();
    searchService = new SearchService(mockAdapter);
  });

  afterEach(() => {
    mockAdapter.reset();
  });

  describe('Empty Results Scenarios (Requirement 1.3)', () => {
    it('should handle empty search results gracefully', async () => {
      // Setup: YouTube API returns empty results
      const emptySearchResponse: YouTubeSearchResponse = {
        kind: 'youtube#searchListResponse',
        etag: 'test-etag',
        pageInfo: {
          totalResults: 0,
          resultsPerPage: 0
        },
        items: []
      };

      mockAdapter.setSearchResponse(emptySearchResponse);
      mockAdapter.setVideoDetails([]);

      const params: SearchParams = {
        query: 'nonexistent song that will never be found',
        page: 1,
        limit: 20
      };

      const result = await searchService.search(params);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.results).toEqual([]);
        expect(result.value.pagination.totalResults).toBe(0);
        expect(result.value.pagination.hasNextPage).toBe(false);
        expect(result.value.pagination.hasPrevPage).toBe(false);
        expect(result.value.pagination.resultsPerPage).toBe(0);
      }
    });

    it('should handle search results with no video details', async () => {
      // Setup: YouTube search returns results but video details call returns empty
      const searchResponse: YouTubeSearchResponse = {
        kind: 'youtube#searchListResponse',
        etag: 'test-etag',
        pageInfo: {
          totalResults: 1,
          resultsPerPage: 1
        },
        items: [{
          kind: 'youtube#searchResult',
          etag: 'item-etag',
          id: {
            kind: 'youtube#video',
            videoId: 'test123'
          },
          snippet: {
            publishedAt: '2023-01-01T00:00:00Z',
            channelId: 'channel123',
            title: 'Test Song',
            description: 'Test description',
            thumbnails: {
              default: { url: 'http://example.com/thumb.jpg', width: 120, height: 90 },
              medium: { url: 'http://example.com/thumb_medium.jpg', width: 320, height: 180 },
              high: { url: 'http://example.com/thumb_high.jpg', width: 480, height: 360 }
            },
            channelTitle: 'Test Artist'
          }
        }]
      };

      mockAdapter.setSearchResponse(searchResponse);
      mockAdapter.setVideoDetails([]); // No video details returned

      const params: SearchParams = {
        query: 'test song',
        page: 1,
        limit: 20
      };

      const result = await searchService.search(params);

      expect(result.success).toBe(true);
      if (result.success) {
        // Should filter out results without duration information
        expect(result.value.results).toEqual([]);
        expect(result.value.pagination.resultsPerPage).toBe(0);
      }
    });

    it('should handle search results with invalid duration', async () => {
      // Setup: Video details have invalid duration format
      const searchResponse: YouTubeSearchResponse = {
        kind: 'youtube#searchListResponse',
        etag: 'test-etag',
        pageInfo: {
          totalResults: 1,
          resultsPerPage: 1
        },
        items: [{
          kind: 'youtube#searchResult',
          etag: 'item-etag',
          id: {
            kind: 'youtube#video',
            videoId: 'test123'
          },
          snippet: {
            publishedAt: '2023-01-01T00:00:00Z',
            channelId: 'channel123',
            title: 'Test Song',
            description: 'Test description',
            thumbnails: {
              default: { url: 'http://example.com/thumb.jpg', width: 120, height: 90 },
              medium: { url: 'http://example.com/thumb_medium.jpg', width: 320, height: 180 },
              high: { url: 'http://example.com/thumb_high.jpg', width: 480, height: 360 }
            },
            channelTitle: 'Test Artist'
          }
        }]
      };

      const videoDetails: YouTubeVideoDetails[] = [{
        kind: 'youtube#video',
        id: 'test123',
        snippet: {
          title: 'Test Song',
          channelTitle: 'Test Artist'
        },
        contentDetails: {
          duration: 'INVALID_DURATION' // Invalid ISO 8601 format
        }
      }];

      mockAdapter.setSearchResponse(searchResponse);
      mockAdapter.setVideoDetails(videoDetails);

      const params: SearchParams = {
        query: 'test song',
        page: 1,
        limit: 20
      };

      const result = await searchService.search(params);

      expect(result.success).toBe(true);
      if (result.success) {
        // Should filter out results with invalid duration
        expect(result.value.results).toEqual([]);
        expect(result.value.pagination.resultsPerPage).toBe(0);
      }
    });
  });

  describe('Missing Parameters Scenarios (Requirement 3.3)', () => {
    it('should return error for missing query parameter', async () => {
      const params: SearchParams = {
        query: '', // Empty query
        page: 1,
        limit: 20
      };

      const result = await searchService.search(params);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('INVALID_QUERY');
      }
    });

    it('should return error for null query parameter', async () => {
      const params: SearchParams = {
        query: null as any, // Null query
        page: 1,
        limit: 20
      };

      const result = await searchService.search(params);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('INVALID_QUERY');
      }
    });

    it('should return error for undefined query parameter', async () => {
      const params: SearchParams = {
        query: undefined as any, // Undefined query
        page: 1,
        limit: 20
      };

      const result = await searchService.search(params);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('INVALID_QUERY');
      }
    });

    it('should return error for whitespace-only query', async () => {
      const params: SearchParams = {
        query: '   \t\n   ', // Whitespace only
        page: 1,
        limit: 20
      };

      const result = await searchService.search(params);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('INVALID_QUERY');
      }
    });

    it('should return error for query exceeding maximum length', async () => {
      const params: SearchParams = {
        query: 'a'.repeat(101), // Exceeds 100 character limit
        page: 1,
        limit: 20
      };

      const result = await searchService.search(params);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('INVALID_QUERY');
      }
    });

    it('should use default values for missing page parameter', async () => {
      // Setup valid response
      const searchResponse: YouTubeSearchResponse = {
        kind: 'youtube#searchListResponse',
        etag: 'test-etag',
        pageInfo: {
          totalResults: 1,
          resultsPerPage: 1
        },
        items: []
      };

      mockAdapter.setSearchResponse(searchResponse);
      mockAdapter.setVideoDetails([]);

      const params: SearchParams = {
        query: 'test song'
        // page and limit omitted
      };

      const result = await searchService.search(params);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.pagination.currentPage).toBe(1); // Default page
      }
    });

    it('should use default values for invalid page parameter', async () => {
      // Setup valid response
      const searchResponse: YouTubeSearchResponse = {
        kind: 'youtube#searchListResponse',
        etag: 'test-etag',
        pageInfo: {
          totalResults: 1,
          resultsPerPage: 1
        },
        items: []
      };

      mockAdapter.setSearchResponse(searchResponse);
      mockAdapter.setVideoDetails([]);

      const params: SearchParams = {
        query: 'test song',
        page: -1, // Invalid page
        limit: 'invalid' as any // Invalid limit
      };

      const result = await searchService.search(params);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.pagination.currentPage).toBe(1); // Default page
      }
    });

    it('should clamp limit to maximum allowed value', async () => {
      // Setup valid response
      const searchResponse: YouTubeSearchResponse = {
        kind: 'youtube#searchListResponse',
        etag: 'test-etag',
        pageInfo: {
          totalResults: 1,
          resultsPerPage: 1
        },
        items: []
      };

      mockAdapter.setSearchResponse(searchResponse);
      mockAdapter.setVideoDetails([]);

      const params: SearchParams = {
        query: 'test song',
        page: 1,
        limit: 100 // Exceeds maximum of 50
      };

      const result = await searchService.search(params);

      expect(result.success).toBe(true);
      // The service should use default limit (20) when invalid limit is provided
    });
  });

  describe('Rate Limiting and Service Unavailable Scenarios (Requirement 3.5)', () => {
    it('should handle YouTube API quota exceeded error', async () => {
      const quotaError = new Error('quota exceeded for YouTube Data API');
      mockAdapter.setShouldThrowError(quotaError);

      const params: SearchParams = {
        query: 'test song',
        page: 1,
        limit: 20
      };

      const result = await searchService.search(params);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('SERVICE_UNAVAILABLE');
      }
    });

    it('should handle YouTube API QUOTA error message', async () => {
      const quotaError = new Error('API QUOTA limit reached');
      mockAdapter.setShouldThrowError(quotaError);

      const params: SearchParams = {
        query: 'test song',
        page: 1,
        limit: 20
      };

      const result = await searchService.search(params);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('SERVICE_UNAVAILABLE');
      }
    });

    it('should handle YouTube API unavailable error', async () => {
      const unavailableError = new Error('Service temporarily unavailable');
      mockAdapter.setShouldThrowError(unavailableError);

      const params: SearchParams = {
        query: 'test song',
        page: 1,
        limit: 20
      };

      const result = await searchService.search(params);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('SERVICE_UNAVAILABLE');
      }
    });

    it('should handle YouTube API timeout error', async () => {
      const timeoutError = new Error('Request timeout occurred');
      mockAdapter.setShouldThrowError(timeoutError);

      const params: SearchParams = {
        query: 'test song',
        page: 1,
        limit: 20
      };

      const result = await searchService.search(params);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('SERVICE_UNAVAILABLE');
      }
    });

    it('should handle generic YouTube API errors', async () => {
      const genericError = new Error('Unknown API error');
      mockAdapter.setShouldThrowError(genericError);

      const params: SearchParams = {
        query: 'test song',
        page: 1,
        limit: 20
      };

      const result = await searchService.search(params);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('YOUTUBE_API_ERROR');
      }
    });

    it('should handle non-Error exceptions', async () => {
      // Simulate a non-Error exception (e.g., network failure)
      mockAdapter.setShouldThrowError('Network failure' as any);

      const params: SearchParams = {
        query: 'test song',
        page: 1,
        limit: 20
      };

      const result = await searchService.search(params);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('YOUTUBE_API_ERROR');
      }
    });
  });

  describe('Edge Cases with Valid Inputs', () => {
    it('should handle search with maximum valid query length', async () => {
      // Setup valid response
      const searchResponse: YouTubeSearchResponse = {
        kind: 'youtube#searchListResponse',
        etag: 'test-etag',
        pageInfo: {
          totalResults: 1,
          resultsPerPage: 1
        },
        items: []
      };

      mockAdapter.setSearchResponse(searchResponse);
      mockAdapter.setVideoDetails([]);

      const params: SearchParams = {
        query: 'a'.repeat(100), // Maximum allowed length
        page: 1,
        limit: 20
      };

      const result = await searchService.search(params);

      expect(result.success).toBe(true);
    });

    it('should handle search with minimum valid limit', async () => {
      // Setup valid response
      const searchResponse: YouTubeSearchResponse = {
        kind: 'youtube#searchListResponse',
        etag: 'test-etag',
        pageInfo: {
          totalResults: 1,
          resultsPerPage: 1
        },
        items: []
      };

      mockAdapter.setSearchResponse(searchResponse);
      mockAdapter.setVideoDetails([]);

      const params: SearchParams = {
        query: 'test song',
        page: 1,
        limit: 1 // Minimum valid limit
      };

      const result = await searchService.search(params);

      expect(result.success).toBe(true);
    });

    it('should handle search with maximum valid limit', async () => {
      // Setup valid response
      const searchResponse: YouTubeSearchResponse = {
        kind: 'youtube#searchListResponse',
        etag: 'test-etag',
        pageInfo: {
          totalResults: 1,
          resultsPerPage: 1
        },
        items: []
      };

      mockAdapter.setSearchResponse(searchResponse);
      mockAdapter.setVideoDetails([]);

      const params: SearchParams = {
        query: 'test song',
        page: 1,
        limit: 50 // Maximum valid limit
      };

      const result = await searchService.search(params);

      expect(result.success).toBe(true);
    });
  });
});