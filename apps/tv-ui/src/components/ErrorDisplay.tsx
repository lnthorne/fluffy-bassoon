/**
 * Error Display Component
 * 
 * Displays user-friendly error messages for API failures and connection issues.
 * Provides appropriate user feedback and guidance for different error types.
 * 
 * Requirements: 6.5
 */

import { useState } from 'react';

export interface ErrorInfo {
  type: 'network' | 'api' | 'websocket' | 'playback' | 'queue' | 'unknown';
  message: string;
  code?: string;
  details?: any;
  timestamp?: string;
  retryable?: boolean;
}

interface ErrorDisplayProps {
  error: ErrorInfo | null;
  onRetry?: () => void;
  onDismiss?: () => void;
  className?: string;
  compact?: boolean;
}

export function ErrorDisplay({ 
  error, 
  onRetry, 
  onDismiss, 
  className = '',
  compact = false 
}: ErrorDisplayProps) {
  const [isRetrying, setIsRetrying] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  if (!error) {
    return null;
  }

  // Get user-friendly error message and icon
  const getErrorDisplay = (error: ErrorInfo) => {
    switch (error.type) {
      case 'network':
        return {
          icon: '📡',
          title: 'Connection Problem',
          message: 'Unable to connect to the server. Please check your network connection.',
          color: 'red',
        };
      
      case 'api':
        return {
          icon: '⚠️',
          title: 'Server Error',
          message: error.message || 'The server encountered an error. Please try again.',
          color: 'orange',
        };
      
      case 'websocket':
        return {
          icon: '🔌',
          title: 'Real-time Connection Lost',
          message: 'Lost connection for live updates. Attempting to reconnect...',
          color: 'orange',
        };
      
      case 'playback':
        return {
          icon: '🎵',
          title: 'Playback Error',
          message: error.message || 'Unable to play the current track. Skipping to next...',
          color: 'red',
        };
      
      case 'queue':
        return {
          icon: '📋',
          title: 'Queue Error',
          message: error.message || 'Unable to update the music queue. Please refresh.',
          color: 'orange',
        };
      
      default:
        return {
          icon: '❌',
          title: 'Error',
          message: error.message || 'An unexpected error occurred.',
          color: 'red',
        };
    }
  };

  const errorDisplay = getErrorDisplay(error);

  // Handle retry action
  const handleRetry = async () => {
    if (!onRetry || isRetrying) return;

    setIsRetrying(true);
    try {
      await onRetry();
    } catch (retryError) {
      console.error('Retry failed:', retryError);
    } finally {
      setIsRetrying(false);
    }
  };

  // Get retry button text
  const getRetryText = () => {
    if (isRetrying) return 'Retrying...';
    
    switch (error.type) {
      case 'network':
        return 'Reconnect';
      case 'websocket':
        return 'Reconnect';
      default:
        return 'Try Again';
    }
  };

  // Determine if error should auto-dismiss
  const shouldAutoDismiss = error.type === 'playback' || error.type === 'websocket';

  return (
    <div 
      className={`error-display ${compact ? 'compact' : ''} ${className}`}
      role="alert"
      aria-live="assertive"
    >
      <div className="error-content">
        {/* Error icon and title */}
        <div className="error-header">
          <span 
            className="error-icon"
            style={{ color: errorDisplay.color }}
            aria-hidden="true"
          >
            {errorDisplay.icon}
          </span>
          
          {!compact && (
            <h3 className="error-title">
              {errorDisplay.title}
            </h3>
          )}
        </div>

        {/* Error message */}
        <div className="error-message">
          {errorDisplay.message}
        </div>

        {/* Error code (if available) */}
        {error.code && !compact && (
          <div className="error-code">
            Error Code: {error.code}
          </div>
        )}

        {/* Action buttons */}
        <div className="error-actions">
          {/* Retry button */}
          {onRetry && error.retryable !== false && (
            <button
              className="retry-button"
              onClick={handleRetry}
              disabled={isRetrying}
              aria-label={getRetryText()}
            >
              {isRetrying && (
                <span className="loading-spinner" aria-hidden="true">
                  🔄
                </span>
              )}
              {getRetryText()}
            </button>
          )}

          {/* Dismiss button */}
          {onDismiss && !shouldAutoDismiss && (
            <button
              className="dismiss-button"
              onClick={onDismiss}
              aria-label="Dismiss error"
            >
              Dismiss
            </button>
          )}

          {/* Details toggle (for non-compact mode) */}
          {!compact && (error.details || error.timestamp) && (
            <button
              className="details-toggle"
              onClick={() => setShowDetails(!showDetails)}
              aria-label={showDetails ? 'Hide details' : 'Show details'}
            >
              {showDetails ? 'Hide Details' : 'Show Details'}
            </button>
          )}
        </div>

        {/* Error details (expandable) */}
        {!compact && showDetails && (
          <div className="error-details">
            {error.timestamp && (
              <div className="detail-item">
                <strong>Time:</strong> {new Date(error.timestamp).toLocaleString()}
              </div>
            )}
            
            {error.code && (
              <div className="detail-item">
                <strong>Code:</strong> {error.code}
              </div>
            )}
            
            {error.details && (
              <div className="detail-item">
                <strong>Details:</strong>
                <pre className="detail-content">
                  {typeof error.details === 'string' 
                    ? error.details 
                    : JSON.stringify(error.details, null, 2)
                  }
                </pre>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Auto-dismiss indicator */}
      {shouldAutoDismiss && (
        <div className="auto-dismiss-notice">
          This message will disappear automatically
        </div>
      )}
    </div>
  );
}

/**
 * Hook for managing error state
 */
export function useErrorHandler() {
  const [error, setError] = useState<ErrorInfo | null>(null);

  const showError = (errorInfo: Partial<ErrorInfo> & { message: string }) => {
    setError({
      type: 'unknown',
      retryable: true,
      timestamp: new Date().toISOString(),
      ...errorInfo,
    });
  };

  const clearError = () => {
    setError(null);
  };

  const handleNetworkError = (message?: string) => {
    showError({
      type: 'network',
      message: message || 'Network connection failed',
      retryable: true,
    });
  };

  const handleAPIError = (message: string, code?: string, details?: any) => {
    showError({
      type: 'api',
      message,
      code,
      details,
      retryable: true,
    });
  };

  const handleWebSocketError = (message?: string) => {
    showError({
      type: 'websocket',
      message: message || 'Real-time connection lost',
      retryable: true,
    });
  };

  const handlePlaybackError = (message: string) => {
    showError({
      type: 'playback',
      message,
      retryable: false,
    });
  };

  const handleQueueError = (message: string) => {
    showError({
      type: 'queue',
      message,
      retryable: true,
    });
  };

  return {
    error,
    showError,
    clearError,
    handleNetworkError,
    handleAPIError,
    handleWebSocketError,
    handlePlaybackError,
    handleQueueError,
  };
}