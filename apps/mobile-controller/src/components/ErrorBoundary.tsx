import { Component, ErrorInfo, ReactNode } from 'react';
import './ErrorBoundary.css';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log the error to console for debugging
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    this.setState({
      error,
      errorInfo
    });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  handleRefresh = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className="error-boundary">
          <div className="error-boundary__container">
            <div className="error-boundary__icon">⚠️</div>
            
            <div className="error-boundary__content">
              <h1 className="error-boundary__title">Something went wrong</h1>
              <p className="error-boundary__message">
                The app encountered an unexpected error. You can try to recover or refresh the page.
              </p>
              
              {this.state.error && (
                <details className="error-boundary__details">
                  <summary>Error Details</summary>
                  <div className="error-boundary__error-info">
                    <strong>Error:</strong> {this.state.error.message}
                    {this.state.error.stack && (
                      <pre className="error-boundary__stack">
                        {this.state.error.stack}
                      </pre>
                    )}
                  </div>
                </details>
              )}
            </div>

            <div className="error-boundary__actions">
              <button
                onClick={this.handleReset}
                className="error-boundary__button error-boundary__button--primary"
              >
                Try Again
              </button>
              <button
                onClick={this.handleRefresh}
                className="error-boundary__button error-boundary__button--secondary"
              >
                Refresh Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}