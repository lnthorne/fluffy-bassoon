/**
 * YouTube Data API v3 Adapter
 * 
 * Infrastructure adapter for communicating with YouTube Data API v3.
 * Handles search requests, video details, API key management, and error handling.
 * 
 * Requirements: 1.1, 6.1, 6.2, 6.3
 */

import { 
  IYouTubeAdapter, 
  YouTubeSearchResponse, 
  YouTubeVideoDetails, 
  YouTubeVideoDetailsResponse,
  YouTubeError,
  YouTubeConfig 
} from './types';

/**
 * Custom error types for YouTube API operations
 * Requirements: 1.4, 6.3
 */
export class YouTubeAPIError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode?: number,
    public readonly originalError?: any
  ) {
    super(message);
    this.name = 'YouTubeAPIError';
  }
}

export class YouTubeQuotaExceededError extends YouTubeAPIError {
  constructor(message: string = 'YouTube API quota exceeded') {
    super(message, 'QUOTA_EXCEEDED', 403);
  }
}

export class YouTubeAuthenticationError extends YouTubeAPIError {
  constructor(message: string = 'YouTube API authentication failed') {
    super(message, 'AUTHENTICATION_ERROR', 401);
  }
}

export class YouTubeTimeoutError extends YouTubeAPIError {
  constructor(message: string = 'YouTube API request timed out') {
    super(message, 'TIMEOUT_ERROR');
  }
}

/**
 * YouTube Data API v3 Adapter Implementation
 * Requirements: 1.1, 6.1, 6.2, 6.3
 */
export class YouTubeAdapter implements IYouTubeAdapter {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly timeout: number;
  private readonly maxResults: number;

  constructor(config: YouTubeConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://www.googleapis.com/youtube/v3';
    this.timeout = config.timeout || 5000; // 5 seconds as per requirements
    this.maxResults = config.maxResults || 50; // YouTube API limit

    if (!this.apiKey) {
      throw new YouTubeAuthenticationError('YouTube API key is required');
    }
  }

  /**
   * Search for videos using YouTube Data API v3
   * Requirements: 1.1, 6.3
   */
  async searchVideos(
    query: string, 
    pageToken?: string, 
    maxResults: number = 20
  ): Promise<YouTubeSearchResponse> {
    if (!query?.trim()) {
      throw new YouTubeAPIError('Search query is required', 'INVALID_QUERY', 400);
    }

    // Validate and limit maxResults
    const limitedResults = Math.min(maxResults, this.maxResults);

    const params = new URLSearchParams({
      part: 'snippet',
      q: query.trim(),
      type: 'video',
      topicId: '/m/04rlf', // Music topic ID for better music relevance
      maxResults: limitedResults.toString(),
      key: this.apiKey,
      safeSearch: 'moderate',
      order: 'relevance'
    });

    if (pageToken) {
      params.append('pageToken', pageToken);
    }

    const url = `${this.baseUrl}/search?${params.toString()}`;

    try {
      const response = await this.makeRequest(url);
      
      if (!response.ok) {
        await this.handleErrorResponse(response);
      }

      const data = await response.json() as YouTubeSearchResponse;
      
      // Validate response structure
      if (!data.items || !Array.isArray(data.items)) {
        throw new YouTubeAPIError('Invalid YouTube API response format', 'INVALID_RESPONSE');
      }

      return data;
    } catch (error) {
      if (error instanceof YouTubeAPIError) {
        throw error;
      }
      
      // Handle network and other errors
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new YouTubeAPIError(
        `YouTube search request failed: ${errorMessage}`,
        'NETWORK_ERROR',
        undefined,
        error
      );
    }
  }

  /**
   * Get detailed video information including duration
   * Requirements: 1.2, 6.3
   */
  async getVideoDetails(videoIds: string[]): Promise<YouTubeVideoDetails[]> {
    if (!videoIds || videoIds.length === 0) {
      return [];
    }

    // YouTube API allows up to 50 video IDs per request
    const chunks = this.chunkArray(videoIds, 50);
    const allDetails: YouTubeVideoDetails[] = [];

    for (const chunk of chunks) {
      const params = new URLSearchParams({
        part: 'snippet,contentDetails',
        id: chunk.join(','),
        key: this.apiKey
      });

      const url = `${this.baseUrl}/videos?${params.toString()}`;

      try {
        const response = await this.makeRequest(url);
        
        if (!response.ok) {
          await this.handleErrorResponse(response);
        }

        const data = await response.json() as YouTubeVideoDetailsResponse;
        
        // Validate response structure
        if (!data.items || !Array.isArray(data.items)) {
          throw new YouTubeAPIError('Invalid YouTube video details response format', 'INVALID_RESPONSE');
        }

        allDetails.push(...data.items);
      } catch (error) {
        if (error instanceof YouTubeAPIError) {
          throw error;
        }
        
        // Handle network and other errors
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        throw new YouTubeAPIError(
          `YouTube video details request failed: ${errorMessage}`,
          'NETWORK_ERROR',
          undefined,
          error
        );
      }
    }

    return allDetails;
  }

  /**
   * Check if the adapter is properly configured
   * Requirements: 6.1, 6.2
   */
  isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  /**
   * Make HTTP request with timeout and error handling
   * Requirements: 3.6, 6.3
   */
  private async makeRequest(url: string): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Party-Jukebox/1.0'
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error && error.name === 'AbortError') {
        throw new YouTubeTimeoutError(`Request timed out after ${this.timeout}ms`);
      }
      
      throw error;
    }
  }

  /**
   * Handle YouTube API error responses
   * Requirements: 1.4, 6.3, 6.4
   */
  private async handleErrorResponse(response: Response): Promise<never> {
    let errorData: YouTubeError | null = null;
    
    try {
      errorData = await response.json() as YouTubeError;
    } catch {
      // If we can't parse the error response, use status text
    }

    const statusCode = response.status;
    const errorMessage = errorData?.error?.message || response.statusText || 'Unknown error';
    
    // Sanitize error message to ensure API key is not exposed
    const sanitizedMessage = this.sanitizeErrorMessage(errorMessage);

    switch (statusCode) {
      case 400:
        throw new YouTubeAPIError(sanitizedMessage, 'BAD_REQUEST', statusCode, errorData);
      
      case 401:
        throw new YouTubeAuthenticationError('Invalid or missing YouTube API key');
      
      case 403:
        // Check if it's a quota error
        if (errorData?.error?.errors?.some(e => e.reason === 'quotaExceeded')) {
          throw new YouTubeQuotaExceededError('YouTube API quota exceeded. Please try again later.');
        }
        throw new YouTubeAPIError(sanitizedMessage, 'FORBIDDEN', statusCode, errorData);
      
      case 404:
        throw new YouTubeAPIError('YouTube API endpoint not found', 'NOT_FOUND', statusCode, errorData);
      
      case 429:
        throw new YouTubeQuotaExceededError('YouTube API rate limit exceeded. Please try again later.');
      
      case 500:
      case 502:
      case 503:
      case 504:
        throw new YouTubeAPIError('YouTube API is temporarily unavailable', 'SERVICE_UNAVAILABLE', statusCode, errorData);
      
      default:
        throw new YouTubeAPIError(sanitizedMessage, 'UNKNOWN_ERROR', statusCode, errorData);
    }
  }

  /**
   * Sanitize error messages to prevent API key exposure
   * Requirements: 6.4
   */
  private sanitizeErrorMessage(message: string): string {
    if (!message) return 'Unknown error';
    
    // Remove any potential API key from error messages
    // YouTube API keys are typically 39 characters long
    return message.replace(/[A-Za-z0-9_-]{35,45}/g, '[API_KEY_REDACTED]');
  }

  /**
   * Split array into chunks of specified size
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }
}