/**
 * Unit tests for StreamResolver
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7
 */

import { StreamResolver } from '../StreamResolver';
import { IProcessManager } from '../../../domain/playback/interfaces';
import { ResolvedStream } from '../../../domain/playback/types';

// Mock fetch for stream validation
global.fetch = jest.fn();
const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

// Mock ProcessManager
const mockProcessManager: jest.Mocked<IProcessManager> = {
  startMpv: jest.fn(),
  stopMpv: jest.fn(),
  restartMpv: jest.fn(),
  runYtDlp: jest.fn(),
  isProcessHealthy: jest.fn(),
  cleanup: jest.fn(),
  validateDependencies: jest.fn()
};

describe('StreamResolver', () => {
  let resolver: StreamResolver;

  beforeEach(() => {
    resolver = new StreamResolver(mockProcessManager);
    
    // Default fetch mock - stream is accessible
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200
    } as Response);

    // Default ProcessManager mock - successful resolution
    const mockResolvedStream: ResolvedStream = {
      streamUrl: 'https://example.com/audio.opus',
      title: 'Test Song',
      duration: 180,
      format: 'opus',
      quality: 'medium'
    };

    mockProcessManager.runYtDlp.mockResolvedValue({
      success: true,
      value: mockResolvedStream
    });
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

      // Should not call ProcessManager for invalid URLs
      expect(mockProcessManager.runYtDlp).not.toHaveBeenCalled();
    });

    it('should accept valid YouTube URLs', async () => {
      const validUrls = [
        'https://youtube.com/watch?v=dQw4w9WgXcQ',
        'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        'https://youtu.be/dQw4w9WgXcQ'
      ];

      for (const url of validUrls) {
        const result = await resolver.resolveStream(url);
        expect(result.success).toBe(true);
      }

      expect(mockProcessManager.runYtDlp).toHaveBeenCalledTimes(validUrls.length);
    });
  });

  describe('Stream Resolution', () => {
    it('should resolve valid YouTube URLs successfully', async () => {
      const url = 'https://youtube.com/watch?v=dQw4w9WgXcQ';
      const result = await resolver.resolveStream(url);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.streamUrl).toBe('https://example.com/audio.opus');
        expect(result.value.title).toBe('Test Song');
        expect(result.value.duration).toBe(180);
        expect(result.value.format).toBe('opus');
        expect(result.value.quality).toBe('medium');
      }

      expect(mockProcessManager.runYtDlp).toHaveBeenCalledWith(url, expect.objectContaining({
        format: 'bestaudio',
        extractAudio: true,
        audioFormat: 'opus',
        timeout: 30000,
        retries: 3
      }));
    });

    it('should handle ProcessManager failures', async () => {
      mockProcessManager.runYtDlp.mockResolvedValue({
        success: false,
        error: 'PROCESS_TIMEOUT'
      });

      const result = await resolver.resolveStream('https://youtube.com/watch?v=test');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('TIMEOUT');
      }
    });

    it('should handle dependency missing errors', async () => {
      mockProcessManager.runYtDlp.mockResolvedValue({
        success: false,
        error: 'DEPENDENCY_MISSING'
      });

      const result = await resolver.resolveStream('https://youtube.com/watch?v=test');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('EXTRACTION_FAILED');
      }
    });

    it('should handle process crashes', async () => {
      mockProcessManager.runYtDlp.mockResolvedValue({
        success: false,
        error: 'PROCESS_CRASHED'
      });

      const result = await resolver.resolveStream('https://youtube.com/watch?v=test');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('EXTRACTION_FAILED');
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

    it('should reject streams when validation fails', async () => {
      // Mock stream validation to fail
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404
      } as Response);

      const result = await resolver.resolveStream('https://youtube.com/watch?v=test');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('STREAM_UNAVAILABLE');
      }
    });
  });

  describe('Cache Management', () => {
    it('should use cached results for repeated requests', async () => {
      const url = 'https://youtube.com/watch?v=dQw4w9WgXcQ';

      // First request
      const result1 = await resolver.resolveStream(url);
      expect(result1.success).toBe(true);

      // Second request should use cache
      const result2 = await resolver.resolveStream(url);
      expect(result2.success).toBe(true);

      // ProcessManager should only be called once
      expect(mockProcessManager.runYtDlp).toHaveBeenCalledTimes(1);
    });

    it('should clear cache when requested', () => {
      expect(() => resolver.clearCache()).not.toThrow();
    });

    it('should provide cache statistics', () => {
      const stats = resolver.getCacheStats();
      expect(stats).toBeDefined();
      expect(typeof stats.size).toBe('number');
      expect(typeof stats.hits).toBe('number');
      expect(typeof stats.misses).toBe('number');
    });
  });

  describe('Shutdown', () => {
    it('should shutdown cleanly', () => {
      expect(() => resolver.shutdown()).not.toThrow();
    });
  });
});