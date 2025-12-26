/**
 * YouTube Adapter Tests
 * 
 * Unit tests for YouTube Data API v3 adapter functionality.
 * Tests API key management, error handling, and response parsing.
 * 
 * Requirements: 1.1, 6.1, 6.2, 6.3
 */

import { YouTubeAdapter, YouTubeAPIError, YouTubeQuotaExceededError, YouTubeAuthenticationError, YouTubeTimeoutError } from '../YouTubeAdapter';
import { YouTubeConfig } from '../types';

// Mock fetch globally
global.fetch = jest.fn();
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

describe('YouTubeAdapter', () => {
  const validConfig: YouTubeConfig = {
    apiKey: 'test-api-key-12345678901234567890123456789',
    baseUrl: 'https://www.googleapis.com/youtube/v3',
    timeout: 5000,
    maxResults: 50
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Constructor', () => {
    it('should create adapter with valid config', () => {
      const adapter = new YouTubeAdapter(validConfig);
      expect(adapter.isConfigured()).toBe(true);
    });

    it('should throw error when API key is missing', () => {
      const invalidConfig = { ...validConfig, apiKey: '' };
      expect(() => new YouTubeAdapter(invalidConfig)).toThrow(YouTubeAuthenticationError);
    });

    it('should use default values for optional config', () => {
      const minimalConfig = { apiKey: 'test-key' };
      const adapter = new YouTubeAdapter(minimalConfig);
      expect(adapter.isConfigured()).toBe(true);
    });
  });

  describe('isConfigured', () => {
    it('should return true for valid API key', () => {
      const adapter = new YouTubeAdapter(validConfig);
      expect(adapter.isConfigured()).toBe(true);
    });

    it('should return false for empty API key', () => {
      const adapter = new YouTubeAdapter({ ...validConfig, apiKey: '   ' });
      expect(adapter.isConfigured()).toBe(false);
    });
  });

  describe('searchVideos', () => {
    let adapter: YouTubeAdapter;

    beforeEach(() => {
      adapter = new YouTubeAdapter(validConfig);
    });

    it('should make successful search request', async () => {
      const mockResponse = {
        kind: 'youtube#searchListResponse',
        etag: 'test-etag',
        items: [
          {
            kind: 'youtube#searchResult',
            etag: 'item-etag',
            id: { kind: 'youtube#video', videoId: 'test-video-id' },
            snippet: {
              publishedAt: '2023-01-01T00:00:00Z',
              channelId: 'test-channel',
              title: 'Test Video',
              description: 'Test description',
              thumbnails: {
                default: { url: 'http://example.com/thumb.jpg', width: 120, height: 90 },
                medium: { url: 'http://example.com/thumb.jpg', width: 320, height: 180 },
                high: { url: 'http://example.com/thumb.jpg', width: 480, height: 360 }
              },
              channelTitle: 'Test Channel'
            }
          }
        ],
        pageInfo: { totalResults: 1, resultsPerPage: 20 }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      } as Response);

      const result = await adapter.searchVideos('test query');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/search?'),
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Accept': 'application/json',
            'User-Agent': 'Party-Jukebox/1.0'
          })
        })
      );

      expect(result).toEqual(mockResponse);
    });

    it('should throw error for empty query', async () => {
      await expect(adapter.searchVideos('')).rejects.toThrow(YouTubeAPIError);
      await expect(adapter.searchVideos('   ')).rejects.toThrow(YouTubeAPIError);
    });

    it('should limit maxResults to API maximum', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: [], pageInfo: { totalResults: 0, resultsPerPage: 50 } })
      } as Response);

      await adapter.searchVideos('test', undefined, 100);

      const callUrl = (mockFetch.mock.calls[0][0] as string);
      expect(callUrl).toContain('maxResults=50');
    });

    it('should handle timeout errors', async () => {
      const abortError = new Error('Request timeout');
      abortError.name = 'AbortError';
      
      mockFetch.mockRejectedValueOnce(abortError);

      await expect(adapter.searchVideos('test query')).rejects.toThrow(YouTubeTimeoutError);
    });

    it('should handle 401 authentication errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({
          error: {
            code: 401,
            message: 'Invalid API key',
            errors: [{ domain: 'global', reason: 'authError', message: 'Invalid API key' }]
          }
        })
      } as Response);

      await expect(adapter.searchVideos('test')).rejects.toThrow(YouTubeAuthenticationError);
    });

    it('should handle 403 quota exceeded errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        json: async () => ({
          error: {
            code: 403,
            message: 'Quota exceeded',
            errors: [{ domain: 'youtube.quota', reason: 'quotaExceeded', message: 'Quota exceeded' }]
          }
        })
      } as Response);

      await expect(adapter.searchVideos('test')).rejects.toThrow(YouTubeQuotaExceededError);
    });

    it('should sanitize API key from error messages', async () => {
      const errorMessage = `Invalid API key: ${validConfig.apiKey}`;
      
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: async () => ({
          error: { code: 400, message: errorMessage, errors: [] }
        })
      } as Response);

      try {
        await adapter.searchVideos('test');
      } catch (error) {
        const apiError = error as YouTubeAPIError;
        expect(apiError.message).not.toContain(validConfig.apiKey);
        expect(apiError.message).toContain('[API_KEY_REDACTED]');
      }
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(adapter.searchVideos('test')).rejects.toThrow(YouTubeAPIError);
    });

    it('should validate response structure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ invalid: 'response' })
      } as Response);

      await expect(adapter.searchVideos('test')).rejects.toThrow(YouTubeAPIError);
    });
  });

  describe('getVideoDetails', () => {
    let adapter: YouTubeAdapter;

    beforeEach(() => {
      adapter = new YouTubeAdapter(validConfig);
    });

    it('should return empty array for empty video IDs', async () => {
      const result = await adapter.getVideoDetails([]);
      expect(result).toEqual([]);
    });

    it('should make successful video details request', async () => {
      const mockResponse = {
        kind: 'youtube#videoListResponse',
        etag: 'test-etag',
        items: [
          {
            kind: 'youtube#video',
            id: 'test-video-id',
            snippet: {
              title: 'Test Video',
              channelTitle: 'Test Channel'
            },
            contentDetails: {
              duration: 'PT4M13S'
            }
          }
        ]
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      } as Response);

      const result = await adapter.getVideoDetails(['test-video-id']);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/videos?'),
        expect.objectContaining({
          method: 'GET'
        })
      );

      expect(result).toEqual(mockResponse.items);
    });

    it('should chunk large video ID arrays', async () => {
      const videoIds = Array.from({ length: 75 }, (_, i) => `video-${i}`);
      
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ items: [] })
      } as Response);

      await adapter.getVideoDetails(videoIds);

      // Should make 2 requests (50 + 25)
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should handle video details API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => ({})
      } as Response);

      await expect(adapter.getVideoDetails(['test-id'])).rejects.toThrow(YouTubeAPIError);
    });

    it('should validate video details response structure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ invalid: 'response' })
      } as Response);

      await expect(adapter.getVideoDetails(['test-id'])).rejects.toThrow(YouTubeAPIError);
    });
  });

  describe('Error handling', () => {
    let adapter: YouTubeAdapter;

    beforeEach(() => {
      adapter = new YouTubeAdapter(validConfig);
    });

    it('should handle malformed JSON responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: async () => { throw new Error('Invalid JSON'); },
        headers: new Headers(),
        type: 'basic',
        url: 'test-url',
        redirected: false,
        body: null,
        bodyUsed: false,
        clone: jest.fn(),
        arrayBuffer: jest.fn(),
        blob: jest.fn(),
        formData: jest.fn(),
        text: jest.fn()
      } as Response);

      await expect(adapter.searchVideos('test')).rejects.toThrow(YouTubeAPIError);
    });

    it('should handle different HTTP status codes', async () => {
      const testCases = [
        { status: 404, expectedError: YouTubeAPIError },
        { status: 429, expectedError: YouTubeQuotaExceededError },
        { status: 500, expectedError: YouTubeAPIError },
        { status: 502, expectedError: YouTubeAPIError },
        { status: 503, expectedError: YouTubeAPIError }
      ];

      for (const testCase of testCases) {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: testCase.status,
          statusText: 'Error',
          json: async () => ({})
        } as Response);

        await expect(adapter.searchVideos('test')).rejects.toThrow(testCase.expectedError);
        mockFetch.mockClear();
      }
    });
  });
});