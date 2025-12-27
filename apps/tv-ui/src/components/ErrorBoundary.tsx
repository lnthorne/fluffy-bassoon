/**
 * Error Boundary Component
 * 
 * React error boundary to catch and handle component crashes gracefully.
 * Provides fallback UI and error reporting without breaking the entire interface.
 * 
 * Requirements: 6.5
 */

import { Component, ReactNode, ErrorInfo } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  resetKeys?: Array<string | number>;
  resetOnPropsChange?: boolean;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private resetTimeoutId: number | null = null;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
      errorId: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error details
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    // Update state with error info
    this.setState({
      errorInfo,
    });

    // Call optional error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Attempt automatic recovery after 5 seconds
    this.scheduleReset();
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    const { resetKeys, resetOnPropsChange } = this.props;
    const { hasError } = this.state;

    // Reset error state if resetKeys changed
    if (hasError && resetKeys && prevProps.resetKeys) {
      const hasResetKeyChanged = resetKeys.some((key, index) => 
        key !== prevProps.resetKeys![index]
      );
      
      if (hasResetKeyChanged) {
        this.resetErrorBoundary();
      }
    }

    // Reset error state if any props changed (when resetOnPropsChange is true)
    if (hasError && resetOnPropsChange && prevProps !== this.props) {
      this.resetErrorBoundary();
    }
  }

  componentWillUnmount() {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
    }
  }

  scheduleReset = () => {
    // Clear any existing timeout
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
    }

    // Schedule reset after 5 seconds
    this.resetTimeoutId = window.setTimeout(() => {
      console.log('ErrorBoundary: Attempting automatic recovery');
      this.resetErrorBoundary();
    }, 5000);
  };

  resetErrorBoundary = () => {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
      this.resetTimeoutId = null;
    }

    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
    });
  };

  render() {
    const { hasError, error, errorInfo, errorId } = this.state;
    const { children, fallback } = this.props;

    if (hasError) {
      // Custom fallback UI
      if (fallback) {
        return fallback;
      }

      // Default fallback UI
      return (
        <div className="error-boundary-fallback" role="alert">
          <div className="error-content">
            <div className="error-icon" aria-hidden="true">
              ⚠️
            </div>
            
            <h2 className="error-title">
              Something went wrong
            </h2>
            
            <p className="error-description">
              A component has crashed, but we're working to recover automatically.
            </p>

            <div className="error-actions">
              <button 
                className="retry-button"
                onClick={this.resetErrorBoundary}
                aria-label="Try to recover from error"
              >
                Try Again
              </button>
              
              <button 
                className="refresh-button"
                onClick={() => window.location.reload()}
                aria-label="Refresh the page"
              >
                Refresh Page
              </button>
            </div>

            {/* Error details (for debugging) */}
            <details className="error-details">
              <summary>Technical Details</summary>
              <div className="error-info">
                <div className="error-id">
                  <strong>Error ID:</strong> {errorId}
                </div>
                
                {error && (
                  <div className="error-message">
                    <strong>Error:</strong> {error.message}
                  </div>
                )}
                
                {error && error.stack && (
                  <div className="error-stack">
                    <strong>Stack Trace:</strong>
                    <pre>{error.stack}</pre>
                  </div>
                )}
                
                {errorInfo && errorInfo.componentStack && (
                  <div className="component-stack">
                    <strong>Component Stack:</strong>
                    <pre>{errorInfo.componentStack}</pre>
                  </div>
                )}
              </div>
            </details>

            <div className="recovery-notice">
              🔄 Automatic recovery will attempt in a few seconds...
            </div>
          </div>
        </div>
      );
    }

    return children;
  }
}

/**
 * Hook-based error boundary for functional components
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
}