/**
 * Unit tests for StreamResolver
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7
 */

import { StreamResolver } from '../StreamResolver';

// Mock fetch for stream validation
global.fetch = jest.fn();
const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

describe('StreamResolver', () => {
  let resolver: StreamResolver;

  beforeEach(() => {
    resolver = new StreamResolver();
    
    // Default fetch mock - stream is accessible
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200
    } as Response);
  });

  afterEach(() => {
    jest.clearAllMocks();
    resolver.clearCache();
  });

  describe('URL Validation', () => {
    it('should reject invalid URLs', async () => {
      const invalidUrls = [
        'https://example.com/video',
        'not-a-url',
        'https://vimeo.com/123456',
        ''
      ];

      for (const url of invalidUrls) {
        const result = await resolver.resolveStream(url);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toBe('INVALID_URL');
        }
      }
    });
  });

  describe('Stream Validation', () => {
    it('should validate accessible streams', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200
      } as Response);

      const isValid = await resolver.validateStream('https://example.com/audio.opus');
      expect(isValid).toBe(true);
    });

    it('should reject inaccessible streams', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404
      } as Response);

      const isValid = await resolver.validateStream('https://example.com/missing.opus');
      expect(isValid).toBe(false);
    });

    it('should handle network errors during validation', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const isValid = await resolver.validateStream('https://example.com/audio.opus');
      expect(isValid).toBe(false);
    });
  });

  describe('Cache Management', () => {
    it('should clear cache when requested', () => {
      // This is a synchronous operation, so we can test it directly
      expect(() => resolver.clearCache()).not.toThrow();
    });
  });
});