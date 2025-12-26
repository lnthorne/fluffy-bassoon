/**
 * YouTube Configuration Management
 * 
 * Handles YouTube API configuration from environment variables with proper
 * validation and error handling.
 * 
 * Requirements: 6.1, 6.2
 */

import { YouTubeConfig } from './types';

/**
 * Configuration error for YouTube setup issues
 * Requirements: 6.2
 */
export class YouTubeConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'YouTubeConfigError';
  }
}

/**
 * Load YouTube configuration from environment variables
 * Requirements: 6.1, 6.2
 */
export function loadYouTubeConfig(): YouTubeConfig {
  const apiKey = process.env.YOUTUBE_API_KEY;
  
  if (!apiKey || apiKey.trim().length === 0) {
    throw new YouTubeConfigError(
      'YOUTUBE_API_KEY environment variable is required for search functionality'
    );
  }

  // Validate API key format (YouTube API keys are typically 39 characters)
  if (apiKey.length < 30 || apiKey.length > 50) {
    console.warn('YouTube API key length is unusual. Please verify the key is correct.');
  }

  const config: YouTubeConfig = {
    apiKey: apiKey.trim(),
    baseUrl: process.env.YOUTUBE_API_BASE_URL || 'https://www.googleapis.com/youtube/v3',
    timeout: parseInt(process.env.YOUTUBE_API_TIMEOUT || '5000', 10),
    maxResults: parseInt(process.env.YOUTUBE_SEARCH_MAX_RESULTS || '50', 10)
  };

  // Validate timeout
  if (config.timeout! < 1000 || config.timeout! > 30000) {
    console.warn(`YouTube API timeout ${config.timeout}ms is outside recommended range (1000-30000ms)`);
  }

  // Validate maxResults
  if (config.maxResults! < 1 || config.maxResults! > 50) {
    console.warn(`YouTube max results ${config.maxResults} is outside valid range (1-50). Using 50.`);
    config.maxResults = 50;
  }

  return config;
}

/**
 * Create YouTube configuration with optional overrides
 * Requirements: 6.1
 */
export function createYouTubeConfig(overrides: Partial<YouTubeConfig> = {}): YouTubeConfig {
  const baseConfig = loadYouTubeConfig();
  return { ...baseConfig, ...overrides };
}

/**
 * Check if YouTube configuration is available
 * Requirements: 6.2
 */
export function isYouTubeConfigured(): boolean {
  try {
    loadYouTubeConfig();
    return true;
  } catch (error) {
    if (error instanceof YouTubeConfigError) {
      console.warn('YouTube search disabled:', error.message);
    } else {
      console.error('Unexpected error checking YouTube configuration:', error);
    }
    return false;
  }
}