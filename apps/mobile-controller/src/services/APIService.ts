import { Track, User, QueueState, SearchResult } from '@party-jukebox/shared';

export interface AddTrackResponse {
  success: boolean;
  queuePosition?: number;
  error?: string;
  rateLimitInfo?: RateLimitInfo;
}

export interface RateLimitInfo {
  remainingRequests: number;
  timeUntilReset: number; // milliseconds
  maxRequests: number;
  windowDuration: number; // milliseconds
  isLimited: boolean;
}

export interface APIServiceConfig {
  baseUrl: string;
  timeout: number;
  maxRetries: number;
  retryDelay: number;
}

export class APIService {
  private config: APIServiceConfig;

  constructor(config: Partial<APIServiceConfig> = {}) {
    this.config = {
      baseUrl: config.baseUrl || '/api',
      timeout: config.timeout || 5000,
      maxRetries: config.maxRetries || 3,
      retryDelay: config.retryDelay || 1000,
      ...config
    };
  }

  /**
   * Search for tracks using YouTube search
   */
  async search(query: string): Promise<SearchResult[]> {
    if (!query.trim()) {
      throw new Error('Search query cannot be empty');
    }

    const url = `${this.config.baseUrl}/search?q=${encodeURIComponent(query.trim())}`;
    
    try {
      const response = await this.fetchWithRetry(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Search failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      // Handle API response structure: { success: boolean, data?: { results: SearchResult[] }, error?: APIError }
      if (!data.success) {
        throw new Error(data.error?.message || 'Search failed');
      }
      
      // Return the results array from the nested data structure
      return data.data?.results || [];
    } catch (error) {
      console.error('Search error:', error);
      throw new Error(`Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Add a track to the queue
   */
  async addTrack(track: Track, user: User): Promise<AddTrackResponse> {
    const url = `${this.config.baseUrl}/queue/add`;
    
    try {
      const response = await this.fetchWithRetry(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          track,
          user
        }),
      });

      const data = await response.json();
      const rateLimitInfo = this.parseRateLimitInfo(response.headers);
      
      console.log('🔍 APIService - Response headers:', Object.fromEntries(response.headers.entries()));
      console.log('🔍 APIService - Parsed rate limit info:', rateLimitInfo);

      if (response.status === 429) {
        // Rate limited - parse additional info from response body
        const enhancedRateLimitInfo = {
          ...rateLimitInfo,
          isLimited: true,
          // Try to get more accurate timing from response body
          timeUntilReset: data.retryAfter ? data.retryAfter * 1000 : rateLimitInfo.timeUntilReset,
        };

        return {
          success: false,
          error: data.message || 'Rate limited - please wait before adding more tracks',
          rateLimitInfo: enhancedRateLimitInfo
        };
      }

      if (!response.ok) {
        return {
          success: false,
          error: data.message || `Failed to add track: ${response.status} ${response.statusText}`,
          rateLimitInfo
        };
      }

      return {
        success: true,
        queuePosition: data.position,
        rateLimitInfo
      };
    } catch (error) {
      console.error('Add track error:', error);
      return {
        success: false,
        error: `Failed to add track: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Get current queue state
   */
  async getQueueState(): Promise<QueueState> {
    const url = `${this.config.baseUrl}/queue`;
    
    try {
      const response = await this.fetchWithRetry(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to get queue state: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Get queue state error:', error);
      throw new Error(`Failed to get queue state: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Fetch with retry logic and timeout handling
   */
  private async fetchWithRetry(url: string, options: RequestInit, attempt = 1): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);

      // Don't retry on abort (timeout) or if we've exceeded max retries
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timeout');
      }

      if (attempt >= this.config.maxRetries) {
        throw error;
      }

      // Exponential backoff
      const delay = this.config.retryDelay * Math.pow(2, attempt - 1);
      await new Promise(resolve => setTimeout(resolve, delay));

      return this.fetchWithRetry(url, options, attempt + 1);
    }
  }

  /**
   * Parse rate limiting information from response headers
   */
  private parseRateLimitInfo(headers: Headers): RateLimitInfo {
    const remaining = parseInt(headers.get('X-RateLimit-Remaining') || '5', 10); // Default to 5 if no header
    const limit = parseInt(headers.get('X-RateLimit-Limit') || '5', 10); // Default to 5 if no header
    const reset = parseInt(headers.get('X-RateLimit-Reset') || '0', 10);
    const window = parseInt(headers.get('X-RateLimit-Window') || '600000', 10); // 10 minutes default
    
    // Handle different header formats
    const retryAfter = headers.get('Retry-After');
    let timeUntilReset = reset;
    
    if (retryAfter) {
      // Retry-After can be in seconds or HTTP date format
      const retryAfterNum = parseInt(retryAfter, 10);
      if (!isNaN(retryAfterNum)) {
        timeUntilReset = retryAfterNum * 1000; // Convert to milliseconds
      } else {
        // Try to parse as date
        const retryDate = new Date(retryAfter);
        if (!isNaN(retryDate.getTime())) {
          timeUntilReset = Math.max(0, retryDate.getTime() - Date.now());
        }
      }
    }

    // Determine if user is currently rate limited
    // User is limited if they have no remaining requests AND there's time until reset
    const isCurrentlyLimited = remaining <= 0 && timeUntilReset > 0;

    return {
      remainingRequests: Math.max(0, remaining),
      maxRequests: Math.max(1, limit),
      timeUntilReset: Math.max(0, timeUntilReset),
      windowDuration: Math.max(1000, window),
      isLimited: isCurrentlyLimited
    };
  }
}

// Default instance
export const apiService = new APIService();