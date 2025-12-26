/**
 * YouTube Infrastructure Module
 * 
 * Exports YouTube Data API v3 adapter and related types for music search functionality.
 * 
 * Requirements: 1.1, 6.1, 6.2, 6.3
 */

export { YouTubeAdapter } from './YouTubeAdapter';
export { 
  loadYouTubeConfig, 
  createYouTubeConfig, 
  isYouTubeConfigured,
  YouTubeConfigError 
} from './config';
export type { 
  IYouTubeAdapter,
  YouTubeSearchResponse,
  YouTubeSearchItem,
  YouTubeVideoDetails,
  YouTubeVideoDetailsResponse,
  YouTubeError,
  YouTubeConfig
} from './types';