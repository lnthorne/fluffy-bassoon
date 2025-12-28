import React from 'react';
import { useConnection } from '../contexts/ConnectionContext';
import './ConnectionError.css';

export interface ConnectionErrorProps {
  className?: string;
}

export const ConnectionError: React.FC<ConnectionErrorProps> = ({ className }) => {
  const { state, retryConnection } = useConnection();

  // Don't render if connected
  if (state.status.api.connected && state.status.websocket.connected) {
    return null;
  }

  const handleRetryConnection = () => {
    retryConnection();
  };

  const handleRefresh = () => {
    window.location.reload();
  };

  const getErrorMessage = () => {
    if (!state.status.api.connected && !state.status.websocket.connected) {
      return 'Unable to connect to the Party Jukebox server. Please check your connection and try again.';
    } else if (!state.status.api.connected) {
      return 'Lost connection to the server. Some features may not work properly.';
    } else if (!state.status.websocket.connected) {
      return 'Real-time updates are unavailable. You may not see live queue changes.';
    }
    return 'Connection issues detected.';
  };

  const getErrorType = () => {
    if (!state.status.api.connected && !state.status.websocket.connected) {
      return 'critical';
    } else if (!state.status.api.connected) {
      return 'warning';
    } else {
      return 'info';
    }
  };

  const errorType = getErrorType();
  const isCritical = errorType === 'critical';

  return (
    <div className={`connection-error connection-error--${errorType} ${className || ''}`}>
      <div className="connection-error__container">
        <div className="connection-error__icon">
          {isCritical ? '🚫' : '⚠️'}
        </div>
        
        <div className="connection-error__content">
          <h3 className="connection-error__title">
            {isCritical ? 'Connection Lost' : 'Connection Issues'}
          </h3>
          <p className="connection-error__message">
            {getErrorMessage()}
          </p>
          
          {/* Show specific error details if available */}
          {(state.status.api.lastError || state.status.websocket.lastError) && (
            <details className="connection-error__details">
              <summary>Technical Details</summary>
              <div className="connection-error__error-info">
                {state.status.api.lastError && (
                  <div>
                    <strong>API Error:</strong> {state.status.api.lastError}
                  </div>
                )}
                {state.status.websocket.lastError && (
                  <div>
                    <strong>WebSocket Error:</strong> {state.status.websocket.lastError}
                  </div>
                )}
                <div>
                  <strong>Server:</strong> {state.status.server.url}
                </div>
              </div>
            </details>
          )}
        </div>

        <div className="connection-error__actions">
          <button
            onClick={handleRetryConnection}
            className="connection-error__button connection-error__button--primary"
            disabled={state.status.api.retrying || state.status.websocket.reconnecting}
          >
            {state.status.api.retrying || state.status.websocket.reconnecting ? (
              <>
                <span className="connection-error__spinner">⟳</span>
                Retrying...
              </>
            ) : (
              'Retry Connection'
            )}
          </button>
          
          {isCritical && (
            <button
              onClick={handleRefresh}
              className="connection-error__button connection-error__button--secondary"
            >
              Refresh Page
            </button>
          )}
        </div>
      </div>
    </div>
  );
};