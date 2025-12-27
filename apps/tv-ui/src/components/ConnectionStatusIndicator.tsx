/**
 * Connection Status Indicator Component
 * 
 * Displays visual connection status for WebSocket and API connections.
 * Shows error messages for persistent connection issues and provides
 * user guidance for recovery.
 * 
 * Requirements: 6.1, 6.5
 */

import { useConnection } from '../contexts/ConnectionContext';

interface ConnectionStatusIndicatorProps {
  className?: string;
  showDetails?: boolean;
}

export function ConnectionStatusIndicator({ 
  className = '', 
  showDetails = false 
}: ConnectionStatusIndicatorProps) {
  const { state, actions } = useConnection();
  
  const connectionHealth = actions.getConnectionHealth();
  const hasErrors = state.websocket.error || state.api.error;
  const isReconnecting = state.websocket.reconnecting || state.api.reconnecting;
  
  // Don't show indicator when everything is healthy and no details requested
  if (connectionHealth === 'healthy' && !showDetails && !hasErrors) {
    return null;
  }

  // Get status icon and color based on connection health
  const getStatusDisplay = () => {
    if (isReconnecting) {
      return {
        icon: '🔄',
        color: 'orange',
        status: 'Reconnecting...',
        ariaLabel: 'Reconnecting to server',
      };
    }

    switch (connectionHealth) {
      case 'healthy':
        return {
          icon: '🟢',
          color: 'green',
          status: 'Connected',
          ariaLabel: 'Connected to server',
        };
      case 'degraded':
        return {
          icon: '🟡',
          color: 'orange',
          status: 'Partial Connection',
          ariaLabel: 'Partial connection to server',
        };
      case 'offline':
        return {
          icon: '🔴',
          color: 'red',
          status: 'Offline',
          ariaLabel: 'Disconnected from server',
        };
      default:
        return {
          icon: '⚪',
          color: 'gray',
          status: 'Unknown',
          ariaLabel: 'Unknown connection status',
        };
    }
  };

  const statusDisplay = getStatusDisplay();

  // Get detailed connection info
  const getConnectionDetails = () => {
    const details = [];
    
    if (state.websocket.connected) {
      details.push('WebSocket: Connected');
    } else if (state.websocket.reconnecting) {
      details.push('WebSocket: Reconnecting...');
    } else {
      details.push('WebSocket: Disconnected');
    }

    if (state.api.connected) {
      details.push('API: Connected');
    } else if (state.api.reconnecting) {
      details.push('API: Reconnecting...');
    } else {
      details.push('API: Disconnected');
    }

    return details;
  };

  // Get error messages
  const getErrorMessages = () => {
    const errors = [];
    
    if (state.websocket.error) {
      errors.push(`WebSocket: ${state.websocket.error}`);
    }
    
    if (state.api.error) {
      errors.push(`API: ${state.api.error}`);
    }
    
    return errors;
  };

  // Get user guidance based on connection state
  const getUserGuidance = () => {
    if (connectionHealth === 'offline') {
      if (state.reconnectAttempts >= state.maxReconnectAttempts) {
        return 'Connection failed. Please check your network and refresh the page.';
      } else {
        return 'Connection lost. Attempting to reconnect...';
      }
    }
    
    if (connectionHealth === 'degraded') {
      return 'Some features may be limited due to connection issues.';
    }
    
    if (hasErrors) {
      return 'Experiencing connection issues. Some features may not work properly.';
    }
    
    return null;
  };

  const connectionDetails = showDetails ? getConnectionDetails() : [];
  const errorMessages = getErrorMessages();
  const userGuidance = getUserGuidance();

  return (
    <div 
      className={`connection-status-indicator ${className}`}
      role="status"
      aria-live="polite"
      aria-label={statusDisplay.ariaLabel}
    >
      {/* Main status display */}
      <div className="status-main">
        <span 
          className="status-icon"
          style={{ color: statusDisplay.color }}
          aria-hidden="true"
        >
          {statusDisplay.icon}
        </span>
        <span className="status-text">
          {statusDisplay.status}
        </span>
      </div>

      {/* Connection details (if requested) */}
      {showDetails && connectionDetails.length > 0 && (
        <div className="connection-details">
          {connectionDetails.map((detail, index) => (
            <div key={index} className="connection-detail">
              {detail}
            </div>
          ))}
        </div>
      )}

      {/* Error messages */}
      {errorMessages.length > 0 && (
        <div className="error-messages" role="alert">
          {errorMessages.map((error, index) => (
            <div key={index} className="error-message">
              ⚠️ {error}
            </div>
          ))}
        </div>
      )}

      {/* User guidance */}
      {userGuidance && (
        <div className="user-guidance">
          💡 {userGuidance}
        </div>
      )}

      {/* Reconnection progress */}
      {isReconnecting && (
        <div className="reconnection-progress">
          <div className="progress-text">
            Attempt {state.reconnectAttempts} of {state.maxReconnectAttempts}
          </div>
          <div className="progress-bar">
            <div 
              className="progress-fill"
              style={{ 
                width: `${(state.reconnectAttempts / state.maxReconnectAttempts) * 100}%` 
              }}
            />
          </div>
        </div>
      )}

      {/* Last activity indicator */}
      {showDetails && state.lastActivity && (
        <div className="last-activity">
          Last activity: {state.lastActivity.toLocaleTimeString()}
        </div>
      )}
    </div>
  );
}