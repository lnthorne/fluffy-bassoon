import React from 'react';
import './ErrorDisplay.css';

export interface ErrorDisplayProps {
  title?: string;
  message: string;
  type?: 'error' | 'warning' | 'info';
  icon?: string;
  onRetry?: () => void;
  onDismiss?: () => void;
  retryLabel?: string;
  dismissLabel?: string;
  isRetrying?: boolean;
  showDetails?: boolean;
  details?: string;
  className?: string;
}

export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({
  title,
  message,
  type = 'error',
  icon,
  onRetry,
  onDismiss,
  retryLabel = 'Try Again',
  dismissLabel = 'Dismiss',
  isRetrying = false,
  showDetails = false,
  details,
  className
}) => {
  const getDefaultIcon = () => {
    switch (type) {
      case 'warning':
        return '⚠️';
      case 'info':
        return 'ℹ️';
      case 'error':
      default:
        return '❌';
    }
  };

  const displayIcon = icon || getDefaultIcon();
  const displayTitle = title || (type === 'warning' ? 'Warning' : type === 'info' ? 'Information' : 'Error');

  return (
    <div className={`error-display error-display--${type} ${className || ''}`}>
      <div className="error-display__container">
        <div className="error-display__header">
          <div className="error-display__icon">{displayIcon}</div>
          <div className="error-display__title-section">
            <h3 className="error-display__title">{displayTitle}</h3>
            <p className="error-display__message">{message}</p>
          </div>
        </div>

        {showDetails && details && (
          <details className="error-display__details">
            <summary>Show Details</summary>
            <div className="error-display__details-content">
              <pre>{details}</pre>
            </div>
          </details>
        )}

        {(onRetry || onDismiss) && (
          <div className="error-display__actions">
            {onRetry && (
              <button
                onClick={onRetry}
                disabled={isRetrying}
                className="error-display__button error-display__button--primary"
              >
                {isRetrying ? (
                  <>
                    <span className="error-display__spinner">⟳</span>
                    Retrying...
                  </>
                ) : (
                  retryLabel
                )}
              </button>
            )}
            
            {onDismiss && (
              <button
                onClick={onDismiss}
                className="error-display__button error-display__button--secondary"
                disabled={isRetrying}
              >
                {dismissLabel}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};