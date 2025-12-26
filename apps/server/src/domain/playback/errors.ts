/**
 * Error types for the Music Resolution & Playback system
 * Requirements: 5.1, 5.2, 5.5, 5.6, 5.7
 */

/**
 * Stream resolution error types
 * Requirements: 1.3, 1.6, 1.7, 5.1, 5.4
 */
export type ResolutionError = 
  | 'INVALID_URL'
  | 'EXTRACTION_FAILED'
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'UNSUPPORTED_SITE'
  | 'STREAM_UNAVAILABLE';

/**
 * Playback control error types
 * Requirements: 2.5, 2.7, 5.2, 5.3
 */
export type PlaybackError = 
  | 'STREAM_UNAVAILABLE'
  | 'MPV_NOT_RESPONDING'
  | 'AUDIO_DEVICE_ERROR'
  | 'INVALID_STREAM_FORMAT'
  | 'PROCESS_CRASHED'
  | 'IPC_COMMUNICATION_FAILED';

/**
 * Process management error types
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.7
 */
export type ProcessError = 
  | 'PROCESS_START_FAILED'
  | 'PROCESS_TIMEOUT'
  | 'RESOURCE_LIMIT_EXCEEDED'
  | 'DEPENDENCY_MISSING'
  | 'PROCESS_CRASHED'
  | 'ZOMBIE_PROCESS_DETECTED';

/**
 * Orchestration error types combining all error categories
 * Requirements: 3.3, 5.1, 5.2, 5.6
 */
export type OrchestrationError = ResolutionError | PlaybackError | ProcessError | 'QUEUE_EMPTY';

/**
 * Error details with context information
 * Consistent with existing error pattern from shared package
 */
export interface PlaybackErrorDetails {
  readonly code: string;
  readonly message: string;
  readonly context?: Record<string, unknown>;
  readonly suggestion?: string;
}

/**
 * Error factory for creating consistent playback error responses
 * Following the pattern established in the shared package
 */
export class PlaybackErrorFactory {
  static createResolutionError(error: ResolutionError, context?: Record<string, unknown>): PlaybackErrorDetails {
    const messages: Record<ResolutionError, string> = {
      INVALID_URL: 'The provided URL is not a valid YouTube URL',
      EXTRACTION_FAILED: 'Failed to extract stream information from YouTube',
      NETWORK_ERROR: 'Network error occurred while resolving stream',
      TIMEOUT: 'Stream resolution timed out after 30 seconds',
      UNSUPPORTED_SITE: 'The URL is from an unsupported site',
      STREAM_UNAVAILABLE: 'The requested stream is not available'
    };

    const suggestions: Record<ResolutionError, string> = {
      INVALID_URL: 'Please provide a valid YouTube URL',
      EXTRACTION_FAILED: 'The video may be private, deleted, or region-restricted',
      NETWORK_ERROR: 'Check your internet connection and try again',
      TIMEOUT: 'The video may be too long or the connection is slow',
      UNSUPPORTED_SITE: 'Only YouTube URLs are currently supported',
      STREAM_UNAVAILABLE: 'Try a different video or check if the video is still available'
    };

    return {
      code: error,
      message: messages[error],
      context,
      suggestion: suggestions[error]
    };
  }

  static createPlaybackError(error: PlaybackError, context?: Record<string, unknown>): PlaybackErrorDetails {
    const messages: Record<PlaybackError, string> = {
      STREAM_UNAVAILABLE: 'The audio stream is not available for playback',
      MPV_NOT_RESPONDING: 'The media player is not responding',
      AUDIO_DEVICE_ERROR: 'Audio device error occurred during playback',
      INVALID_STREAM_FORMAT: 'The stream format is not supported',
      PROCESS_CRASHED: 'The media player process crashed',
      IPC_COMMUNICATION_FAILED: 'Failed to communicate with the media player'
    };

    const suggestions: Record<PlaybackError, string> = {
      STREAM_UNAVAILABLE: 'The track will be skipped automatically',
      MPV_NOT_RESPONDING: 'The media player will be restarted automatically',
      AUDIO_DEVICE_ERROR: 'Check audio device connections and settings',
      INVALID_STREAM_FORMAT: 'The track will be skipped automatically',
      PROCESS_CRASHED: 'The media player will be restarted automatically',
      IPC_COMMUNICATION_FAILED: 'The media player will be restarted automatically'
    };

    return {
      code: error,
      message: messages[error],
      context,
      suggestion: suggestions[error]
    };
  }

  static createProcessError(error: ProcessError, context?: Record<string, unknown>): PlaybackErrorDetails {
    const messages: Record<ProcessError, string> = {
      PROCESS_START_FAILED: 'Failed to start external process',
      PROCESS_TIMEOUT: 'External process timed out',
      RESOURCE_LIMIT_EXCEEDED: 'System resource limits exceeded',
      DEPENDENCY_MISSING: 'Required external dependency is missing',
      PROCESS_CRASHED: 'External process crashed unexpectedly',
      ZOMBIE_PROCESS_DETECTED: 'Zombie process detected and cleaned up'
    };

    const suggestions: Record<ProcessError, string> = {
      PROCESS_START_FAILED: 'Check system resources and try again',
      PROCESS_TIMEOUT: 'The operation will be retried automatically',
      RESOURCE_LIMIT_EXCEEDED: 'System resources will be cleaned up automatically',
      DEPENDENCY_MISSING: 'Install the required dependencies (yt-dlp, mpv)',
      PROCESS_CRASHED: 'The process will be restarted automatically',
      ZOMBIE_PROCESS_DETECTED: 'Process cleanup completed successfully'
    };

    return {
      code: error,
      message: messages[error],
      context,
      suggestion: suggestions[error]
    };
  }

  static createOrchestrationError(error: OrchestrationError, context?: Record<string, unknown>): PlaybackErrorDetails {
    if (error === 'QUEUE_EMPTY') {
      return {
        code: error,
        message: 'No tracks available in the queue for playback',
        context,
        suggestion: 'Add tracks to the queue to start playback'
      };
    }

    // Delegate to specific error factories based on error type
    if (['INVALID_URL', 'EXTRACTION_FAILED', 'NETWORK_ERROR', 'TIMEOUT', 'UNSUPPORTED_SITE', 'STREAM_UNAVAILABLE'].includes(error)) {
      return this.createResolutionError(error as ResolutionError, context);
    }

    if (['STREAM_UNAVAILABLE', 'MPV_NOT_RESPONDING', 'AUDIO_DEVICE_ERROR', 'INVALID_STREAM_FORMAT', 'PROCESS_CRASHED', 'IPC_COMMUNICATION_FAILED'].includes(error)) {
      return this.createPlaybackError(error as PlaybackError, context);
    }

    // Must be a ProcessError
    return this.createProcessError(error as ProcessError, context);
  }
}