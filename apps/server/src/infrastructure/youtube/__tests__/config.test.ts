/**
 * YouTube Configuration Tests
 * 
 * Unit tests for YouTube configuration management and environment variable handling.
 * 
 * Requirements: 6.1, 6.2
 */

import { loadYouTubeConfig, createYouTubeConfig, isYouTubeConfigured, YouTubeConfigError } from '../config';

describe('YouTube Configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment variables
    process.env = { ...originalEnv };
    delete process.env.YOUTUBE_API_KEY;
    delete process.env.YOUTUBE_API_BASE_URL;
    delete process.env.YOUTUBE_API_TIMEOUT;
    delete process.env.YOUTUBE_SEARCH_MAX_RESULTS;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('loadYouTubeConfig', () => {
    it('should load config with valid API key', () => {
      process.env.YOUTUBE_API_KEY = 'test-api-key-12345678901234567890';

      const config = loadYouTubeConfig();

      expect(config.apiKey).toBe('test-api-key-12345678901234567890');
      expect(config.baseUrl).toBe('https://www.googleapis.com/youtube/v3');
      expect(config.timeout).toBe(5000);
      expect(config.maxResults).toBe(50);
    });

    it('should throw error when API key is missing', () => {
      expect(() => loadYouTubeConfig()).toThrow(YouTubeConfigError);
      expect(() => loadYouTubeConfig()).toThrow('YOUTUBE_API_KEY environment variable is required');
    });

    it('should throw error when API key is empty', () => {
      process.env.YOUTUBE_API_KEY = '   ';
      expect(() => loadYouTubeConfig()).toThrow(YouTubeConfigError);
    });

    it('should use custom environment variables', () => {
      process.env.YOUTUBE_API_KEY = 'custom-key';
      process.env.YOUTUBE_API_BASE_URL = 'https://custom.api.com/v3';
      process.env.YOUTUBE_API_TIMEOUT = '10000';
      process.env.YOUTUBE_SEARCH_MAX_RESULTS = '25';

      const config = loadYouTubeConfig();

      expect(config.apiKey).toBe('custom-key');
      expect(config.baseUrl).toBe('https://custom.api.com/v3');
      expect(config.timeout).toBe(10000);
      expect(config.maxResults).toBe(25);
    });

    it('should trim whitespace from API key', () => {
      process.env.YOUTUBE_API_KEY = '  test-key-with-spaces  ';

      const config = loadYouTubeConfig();

      expect(config.apiKey).toBe('test-key-with-spaces');
    });

    it('should handle invalid timeout values', () => {
      process.env.YOUTUBE_API_KEY = 'test-key';
      process.env.YOUTUBE_API_TIMEOUT = 'invalid';

      const config = loadYouTubeConfig();

      expect(config.timeout).toBe(NaN); // parseInt returns NaN for invalid strings
    });

    it('should handle invalid maxResults values', () => {
      process.env.YOUTUBE_API_KEY = 'test-key';
      process.env.YOUTUBE_SEARCH_MAX_RESULTS = 'invalid';

      const config = loadYouTubeConfig();

      expect(config.maxResults).toBe(NaN); // parseInt returns NaN for invalid strings
    });

    it('should clamp maxResults to valid range', () => {
      process.env.YOUTUBE_API_KEY = 'test-key';
      process.env.YOUTUBE_SEARCH_MAX_RESULTS = '100'; // Above API limit

      const config = loadYouTubeConfig();

      expect(config.maxResults).toBe(50); // Should be clamped to API limit
    });
  });

  describe('createYouTubeConfig', () => {
    beforeEach(() => {
      process.env.YOUTUBE_API_KEY = 'base-api-key';
    });

    it('should create config with base values', () => {
      const config = createYouTubeConfig();

      expect(config.apiKey).toBe('base-api-key');
      expect(config.baseUrl).toBe('https://www.googleapis.com/youtube/v3');
    });

    it('should override base config with provided values', () => {
      const overrides = {
        apiKey: 'override-key',
        timeout: 15000
      };

      const config = createYouTubeConfig(overrides);

      expect(config.apiKey).toBe('override-key');
      expect(config.timeout).toBe(15000);
      expect(config.baseUrl).toBe('https://www.googleapis.com/youtube/v3'); // Should keep base value
    });

    it('should throw error when base config is invalid', () => {
      delete process.env.YOUTUBE_API_KEY;

      expect(() => createYouTubeConfig()).toThrow(YouTubeConfigError);
    });
  });

  describe('isYouTubeConfigured', () => {
    it('should return true when properly configured', () => {
      process.env.YOUTUBE_API_KEY = 'valid-api-key';

      expect(isYouTubeConfigured()).toBe(true);
    });

    it('should return false when API key is missing', () => {
      expect(isYouTubeConfigured()).toBe(false);
    });

    it('should return false when API key is empty', () => {
      process.env.YOUTUBE_API_KEY = '';

      expect(isYouTubeConfigured()).toBe(false);
    });

    it('should handle configuration errors gracefully', () => {
      // Mock console.warn to avoid test output noise
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const result = isYouTubeConfigured();

      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith(
        'YouTube search disabled:',
        'YOUTUBE_API_KEY environment variable is required for search functionality'
      );

      consoleSpy.mockRestore();
    });

    it('should handle unexpected errors', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      // Temporarily override the environment to cause an unexpected error
      const originalEnv = process.env.YOUTUBE_API_KEY;
      process.env.YOUTUBE_API_KEY = 'valid-key';
      
      // Mock parseInt to throw an error
      const originalParseInt = global.parseInt;
      global.parseInt = jest.fn().mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      const result = isYouTubeConfigured();

      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith(
        'Unexpected error checking YouTube configuration:',
        expect.any(Error)
      );

      // Restore
      global.parseInt = originalParseInt;
      process.env.YOUTUBE_API_KEY = originalEnv;
      consoleSpy.mockRestore();
    });
  });
});