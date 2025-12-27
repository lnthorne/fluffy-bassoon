/**
 * API Service for TV Display Interface
 * 
 * Handles HTTP communication with the Party Jukebox server API.
 * Provides methods for playback control and queue state retrieval
 * with proper error handling and retry logic.
 * 
 * Requirements: 2.2, 2.3, 2.4, 6.3
 */

import { QueueState, QueueItem } from '@party-jukebox/shared';

/**
 * API response types matching server API
 */
export interface PlaybackStatusResponse {
  success: boolean;
  data?: {
    status: 'idle' | 'resolving' | 'playing' | 'paused' | 'error';
    currentTrack: QueueItem | null;
    position: number;
    duration: number;
    volume: number;
    error?: string;
  };
  error?: {
    code: string;
    message: string;
    details?: any;
    timestamp?: string;
  };
  timestamp: string;
}

export interface PlaybackActionResponse {
  success: boolean;
  data?: {
    action: string;
    newStatus: {
      status: 'idle' | 'resolving' | 'playing' | 'paused' | 'error';
      currentTrack: QueueItem | null;
      position: number;
      duration: number;
      volume: number;
    };
  };
  error?: {
    code: string;
    message: string;
    details?: any;
    timestamp?: string;
  };
  timestamp: string;
}

export interface QueueStateResponse {
  success: boolean;
  data?: {
    queue: QueueState;
  };
  error?: {
    code: string;
    message: string;
    details?: any;
    timestamp?: string;
  };
  timestamp: string;
}

/**
 * API Service configuration
 */
export interface APIServiceConfig {
  baseUrl: string;
  timeout?: number;
  maxRetries?: number;
  retryDelay?: number;
  maxRetryDelay?: number;
}

/**
 * Retry configuration for exponential backoff
 */
interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffFactor: number;
}

/**
 * API Service class for server communication
 */
export class APIService {
  private config: Required<APIServiceConfig>;
  private retryConfig: RetryConfig;

  constructor(config: APIServiceConfig) {
    this.config = {
      baseUrl: config.baseUrl.replace(/\/$/, ''), // Remove trailing slash
      timeout: config.timeout ?? 10000, // 10 seconds default
      maxRetries: config.maxRetries ?? 3,
      retryDelay: config.retryDelay ?? 1000, // 1 second base delay
      maxRetryDelay: config.maxRetryDelay ?? 30000, // 30 seconds max delay
    };

    this.retryConfig = {
      maxRetries: this.config.maxRetries,
      baseDelay: this.config.retryDelay,
      maxDelay: this.config.maxRetryDelay,
      backoffFactor: 2,
    };
  }

  /**
   * Get current playback status from server
   * Requirements: 2.2, 6.3
   */
  async getPlaybackStatus(): Promise<PlaybackStatusResponse> {
    return this.makeRequest<PlaybackStatusResponse>('/api/playback/status', {
      method: 'GET',
    });
  }

  /**
   * Skip to next track
   * Requirements: 2.3, 6.3
   */
  async skipTrack(): Promise<PlaybackActionResponse> {
    return this.makeRequest<PlaybackActionResponse>('/api/playback/skip', {
      method: 'POST',
    });
  }

  /**
   * Pause current playback
   * Requirements: 2.3, 6.3
   */
  async pausePlayback(): Promise<PlaybackActionResponse> {
    return this.makeRequest<PlaybackActionResponse>('/api/playback/pause', {
      method: 'POST',
    });
  }

  /**
   * Resume paused playback
   * Requirements: 2.3, 6.3
   */
  async resumePlayback(): Promise<PlaybackActionResponse> {
    return this.makeRequest<PlaybackActionResponse>('/api/playback/resume', {
      method: 'POST',
    });
  }

  /**
   * Get current queue state from server
   * Requirements: 2.4, 6.3
   */
  async getQueueState(): Promise<QueueStateResponse> {
    return this.makeRequest<QueueStateResponse>('/api/queue', {
      method: 'GET',
    });
  }

  /**
   * Make HTTP request with retry logic and exponential backoff
   * Requirements: 6.3
   */
  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit,
    attempt: number = 1
  ): Promise<T> {
    const url = `${this.config.baseUrl}${endpoint}`;
    
    try {
      // Create AbortController for timeout handling
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

      // Only set Content-Type if we have a body
      const headers: Record<string, string> = {
        ...options.headers as Record<string, string>,
      };
      
      // Only add Content-Type for requests with a body
      if (options.body) {
        headers['Content-Type'] = 'application/json';
      }

      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers,
      });

      clearTimeout(timeoutId);

      // Parse response as JSON
      const data = await response.json();

      // Return data regardless of HTTP status - let caller handle success/error
      return data as T;

    } catch (error) {
      // Check if we should retry
      if (attempt < this.retryConfig.maxRetries && this.shouldRetry(error)) {
        const delay = this.calculateRetryDelay(attempt);
        console.warn(`API request failed (attempt ${attempt}/${this.retryConfig.maxRetries}), retrying in ${delay}ms:`, error);
        
        await this.sleep(delay);
        return this.makeRequest<T>(endpoint, options, attempt + 1);
      }

      // Max retries reached or non-retryable error
      console.error(`API request failed after ${attempt} attempts:`, error);
      
      // Return a standardized error response
      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: this.getErrorMessage(error),
          details: {
            attempt,
            maxRetries: this.retryConfig.maxRetries,
            url,
            originalError: error instanceof Error ? error.message : String(error),
          },
          timestamp: new Date().toISOString(),
        },
        timestamp: new Date().toISOString(),
      } as T;
    }
  }

  /**
   * Determine if an error should trigger a retry
   * Requirements: 6.3
   */
  private shouldRetry(error: unknown): boolean {
    // Retry on network errors, timeouts, and server errors (5xx)
    if (error instanceof Error) {
      // AbortError indicates timeout
      if (error.name === 'AbortError') {
        return true;
      }
      
      // Network errors (no response received)
      if (error.message.includes('fetch') || error.message.includes('network')) {
        return true;
      }
    }

    // For fetch Response objects, check status code
    if (error && typeof error === 'object' && 'status' in error) {
      const status = (error as any).status;
      // Retry on server errors (5xx) but not client errors (4xx)
      return status >= 500 && status < 600;
    }

    // Default to not retrying for unknown errors
    return false;
  }

  /**
   * Calculate retry delay with exponential backoff
   * Requirements: 6.3
   */
  private calculateRetryDelay(attempt: number): number {
    const delay = this.retryConfig.baseDelay * Math.pow(this.retryConfig.backoffFactor, attempt - 1);
    return Math.min(delay, this.retryConfig.maxDelay);
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Extract user-friendly error message from error object
   */
  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return 'Request timed out';
      }
      return error.message;
    }
    
    if (typeof error === 'string') {
      return error;
    }
    
    return 'Unknown network error occurred';
  }

  /**
   * Update service configuration
   */
  updateConfig(newConfig: Partial<APIServiceConfig>): void {
    this.config = {
      ...this.config,
      ...newConfig,
      baseUrl: (newConfig.baseUrl ?? this.config.baseUrl).replace(/\/$/, ''),
    };

    // Update retry configuration if relevant options changed
    if (newConfig.maxRetries !== undefined || newConfig.retryDelay !== undefined || newConfig.maxRetryDelay !== undefined) {
      this.retryConfig = {
        ...this.retryConfig,
        maxRetries: newConfig.maxRetries ?? this.config.maxRetries,
        baseDelay: newConfig.retryDelay ?? this.config.retryDelay,
        maxDelay: newConfig.maxRetryDelay ?? this.config.maxRetryDelay,
      };
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): APIServiceConfig {
    return { ...this.config };
  }
}

/**
 * Create API service instance with default configuration
 */
export function createAPIService(baseUrl: string, config?: Partial<APIServiceConfig>): APIService {
  return new APIService({
    baseUrl,
    ...config,
  });
}