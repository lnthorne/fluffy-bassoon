/**
 * StreamResolver implementation using yt-dlp for YouTube stream resolution
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7
 */

import { Result } from '@party-jukebox/shared';
import { IStreamResolver, IProcessManager } from '../../domain/playback/interfaces';
import { 
  ResolvedStream,
  YtDlpOptions
} from '../../domain/playback/types';
import { 
  ResolutionError
} from '../../domain/playback/errors';
import { ResolutionCache } from './ResolutionCache';

/**
 * Default yt-dlp options for audio-only stream resolution
 * Requirements: 1.4, 1.6
 */
const DEFAULT_YTDLP_OPTIONS: YtDlpOptions = {
  format: 'bestaudio',
  extractAudio: true,
  audioFormat: 'opus',
  timeout: 30000, // 30 seconds in milliseconds
  retries: 3
};

/**
 * YouTube URL validation pattern
 * Requirements: 1.1
 */
const YOUTUBE_URL_PATTERN = /^https:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)[a-zA-Z0-9_-]+/;

/**
 * StreamResolver implementation for YouTube URL resolution using yt-dlp
 * Handles caching, timeout, retry logic, and stream validation
 * Uses ProcessManager for external process management
 */
export class StreamResolver implements IStreamResolver {
  private readonly cache: ResolutionCache;
  private readonly options: YtDlpOptions;
  private readonly processManager: IProcessManager;

  constructor(processManager: IProcessManager, options: Partial<YtDlpOptions> = {}) {
    this.processManager = processManager;
    this.options = { ...DEFAULT_YTDLP_OPTIONS, ...options };
    this.cache = new ResolutionCache();
  }

  /**
   * Resolve a YouTube URL to a playable stream
   * Requirements: 1.1, 1.2, 1.3, 1.5, 1.6, 6.1
   */
  async resolveStream(youtubeUrl: string): Promise<Result<ResolvedStream, ResolutionError>> {
    // Validate YouTube URL format
    if (!this.isValidYouTubeUrl(youtubeUrl)) {
      return {
        success: false,
        error: 'INVALID_URL'
      };
    }

    // Check cache first
    const cached = this.cache.get(youtubeUrl);
    if (cached) {
      return {
        success: true,
        value: cached
      };
    }

    try {
      // Use ProcessManager to resolve stream using yt-dlp
      const result = await this.processManager.runYtDlp(youtubeUrl, this.options);
      
      if (!result.success) {
        // Map ProcessError to ResolutionError
        return {
          success: false,
          error: this.mapProcessErrorToResolutionError(result.error)
        };
      }

      const resolved = result.value;
      
      // Validate stream accessibility
      const isAccessible = await this.validateStream(resolved.streamUrl);
      if (!isAccessible) {
        return {
          success: false,
          error: 'STREAM_UNAVAILABLE'
        };
      }

      // Cache the result
      this.cache.set(youtubeUrl, resolved);

      return {
        success: true,
        value: resolved
      };
    } catch (error) {
      return this.handleResolutionError(error);
    }
  }

  /**
   * Validate that a stream URL is accessible
   * Requirements: 1.5
   */
  async validateStream(streamUrl: string): Promise<boolean> {
    try {
      // Use HEAD request to check if stream is accessible without downloading
      const response = await fetch(streamUrl, { 
        method: 'HEAD',
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Clear the resolution cache
   * Requirements: 6.1
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics for monitoring
   * Requirements: 6.1
   */
  getCacheStats() {
    return this.cache.getStats();
  }

  /**
   * Shutdown the resolver and cleanup resources
   * Requirements: 6.1
   */
  shutdown(): void {
    this.cache.shutdown();
  }

  /**
   * Validate YouTube URL format
   * Requirements: 1.1
   */
  private isValidYouTubeUrl(url: string): boolean {
    return typeof url === 'string' && YOUTUBE_URL_PATTERN.test(url);
  }

  /**
   * Map ProcessError to ResolutionError
   * Requirements: 1.3, 1.6, 1.7, 5.1, 5.4
   */
  private mapProcessErrorToResolutionError(processError: string): ResolutionError {
    switch (processError) {
      case 'PROCESS_TIMEOUT':
        return 'TIMEOUT';
      case 'DEPENDENCY_MISSING':
        return 'EXTRACTION_FAILED';
      case 'PROCESS_CRASHED':
        return 'EXTRACTION_FAILED';
      case 'PROCESS_START_FAILED':
        return 'EXTRACTION_FAILED';
      case 'RESOURCE_LIMIT_EXCEEDED':
        return 'NETWORK_ERROR';
      case 'ZOMBIE_PROCESS_DETECTED':
        return 'EXTRACTION_FAILED';
      default:
        return 'EXTRACTION_FAILED';
    }
  }

  /**
   * Handle and categorize resolution errors
   * Requirements: 1.3, 1.6, 1.7, 5.1, 5.4
   */
  private handleResolutionError(error: unknown): Result<ResolvedStream, ResolutionError> {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Categorize error based on message content
    if (errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
      return { success: false, error: 'TIMEOUT' };
    }

    if (errorMessage.includes('network') || errorMessage.includes('connection')) {
      return { success: false, error: 'NETWORK_ERROR' };
    }

    if (errorMessage.includes('unsupported') || errorMessage.includes('not supported')) {
      return { success: false, error: 'UNSUPPORTED_SITE' };
    }

    if (errorMessage.includes('private') || errorMessage.includes('unavailable') || errorMessage.includes('deleted')) {
      return { success: false, error: 'STREAM_UNAVAILABLE' };
    }

    // Default to extraction failed for other errors
    return { success: false, error: 'EXTRACTION_FAILED' };
  }
}