/**
 * StreamResolver implementation using yt-dlp for YouTube stream resolution
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7
 */

import { spawn } from 'child_process';
import { Result } from '@party-jukebox/shared';
import { IStreamResolver } from '../../domain/playback/interfaces';
import { 
  ResolvedStream,
  ResolutionCache,
  YtDlpOptions
} from '../../domain/playback/types';
import { 
  ResolutionError
} from '../../domain/playback/errors';

/**
 * Default yt-dlp options for audio-only stream resolution
 * Requirements: 1.4, 1.6
 */
const DEFAULT_YTDLP_OPTIONS: YtDlpOptions = {
  format: 'bestaudio',
  extractAudio: true,
  audioFormat: 'opus',
  timeout: 30,
  retries: 3
};

/**
 * Cache expiration time in milliseconds (5 minutes)
 * Requirements: 6.1
 */
const CACHE_EXPIRATION_MS = 5 * 60 * 1000;

/**
 * YouTube URL validation pattern
 * Requirements: 1.1
 */
const YOUTUBE_URL_PATTERN = /^https:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)[a-zA-Z0-9_-]+/;

/**
 * StreamResolver implementation for YouTube URL resolution using yt-dlp
 * Handles caching, timeout, retry logic, and stream validation
 */
export class StreamResolver implements IStreamResolver {
  private readonly cache = new Map<string, ResolutionCache>();
  private readonly options: YtDlpOptions;

  constructor(options: Partial<YtDlpOptions> = {}) {
    this.options = { ...DEFAULT_YTDLP_OPTIONS, ...options };
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
    const cached = this.getCachedResolution(youtubeUrl);
    if (cached) {
      return {
        success: true,
        value: cached.resolvedStream
      };
    }

    try {
      // Resolve stream using yt-dlp
      const resolved = await this.runYtDlp(youtubeUrl);
      
      // Validate stream accessibility
      const isAccessible = await this.validateStream(resolved.streamUrl);
      if (!isAccessible) {
        return {
          success: false,
          error: 'STREAM_UNAVAILABLE'
        };
      }

      // Cache the result
      this.cacheResolution(youtubeUrl, resolved);

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
   * Validate YouTube URL format
   * Requirements: 1.1
   */
  private isValidYouTubeUrl(url: string): boolean {
    return typeof url === 'string' && YOUTUBE_URL_PATTERN.test(url);
  }

  /**
   * Get cached resolution if available and not expired
   * Requirements: 6.1
   */
  private getCachedResolution(url: string): ResolutionCache | null {
    const cached = this.cache.get(url);
    if (!cached) {
      return null;
    }

    // Check if cache entry has expired
    if (new Date() > cached.expiresAt) {
      this.cache.delete(url);
      return null;
    }

    return cached;
  }

  /**
   * Cache a resolved stream with expiration
   * Requirements: 6.1
   */
  private cacheResolution(url: string, resolved: ResolvedStream): void {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + CACHE_EXPIRATION_MS);

    const cacheEntry: ResolutionCache = {
      url,
      resolvedStream: resolved,
      timestamp: now,
      expiresAt
    };

    this.cache.set(url, cacheEntry);
  }

  /**
   * Run yt-dlp process to extract stream information
   * Requirements: 1.1, 1.2, 1.3, 1.4, 1.6, 1.7
   */
  private async runYtDlp(url: string): Promise<ResolvedStream> {
    return new Promise((resolve, reject) => {
      const args = [
        '--format', this.options.format,
        '--get-url',
        '--get-title',
        '--get-duration',
        '--get-format',
        '--no-playlist',
        '--no-warnings',
        '--quiet',
        url
      ];

      const process = spawn('yt-dlp', args, {
        timeout: this.options.timeout * 1000,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      process.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      process.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0) {
          try {
            const resolved = this.parseYtDlpOutput(stdout);
            resolve(resolved);
          } catch (error) {
            reject(new Error(`Failed to parse yt-dlp output: ${error}`));
          }
        } else {
          reject(new Error(`yt-dlp failed with code ${code}: ${stderr}`));
        }
      });

      process.on('error', (error) => {
        reject(error);
      });

      // Handle timeout
      process.on('timeout', () => {
        process.kill('SIGKILL');
        reject(new Error('yt-dlp process timed out'));
      });
    });
  }

  /**
   * Parse yt-dlp output to extract stream information
   * Requirements: 1.2, 1.3
   */
  private parseYtDlpOutput(output: string): ResolvedStream {
    const lines = output.trim().split('\n');
    
    if (lines.length < 4) {
      throw new Error('Incomplete yt-dlp output');
    }

    const [streamUrl, title, durationStr, format] = lines;

    // Parse duration (can be in various formats)
    const duration = this.parseDuration(durationStr);

    // Extract quality from format string
    const quality = this.extractQuality(format);

    return {
      streamUrl: streamUrl.trim(),
      title: title.trim(),
      duration,
      format: format.trim(),
      quality
    };
  }

  /**
   * Parse duration string to seconds
   * Requirements: 1.3
   */
  private parseDuration(durationStr: string): number {
    const duration = parseInt(durationStr, 10);
    return isNaN(duration) ? 0 : duration;
  }

  /**
   * Extract quality information from format string
   * Requirements: 1.3
   */
  private extractQuality(format: string): string {
    // Extract quality from format string (e.g., "251 - audio only (opus)")
    const match = format.match(/(\d+)\s*-\s*audio only/);
    return match ? `${match[1]}kbps` : 'unknown';
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