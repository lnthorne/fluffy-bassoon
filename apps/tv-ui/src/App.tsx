import { useEffect, useState } from 'react';
import { ConnectionProvider } from './contexts/ConnectionContext';
import { PlaybackProvider } from './contexts/PlaybackContext';
import { QueueProvider } from './contexts/QueueContext';
import { NowPlayingSection } from './components/NowPlayingSection';
import { PlaybackControls } from './components/PlaybackControls';
import { QueueDisplay } from './components/QueueDisplay';
import { JoinInstructions } from './components/JoinInstructions';
import { ConnectionStatusIndicator } from './components/ConnectionStatusIndicator';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useConnection } from './contexts/ConnectionContext';
import { APIService } from './services/APIService';
import { WebSocketService } from './services/WebSocketService';
import { useWebSocketIntegration } from './services/WebSocketIntegration';
import './components/components.css';

// Simple service instances (created once)
let globalAPIService: APIService | null = null;
let globalWebSocketService: WebSocketService | null = null;

function getAPIService(): APIService {
  if (!globalAPIService) {
    globalAPIService = new APIService({
      baseUrl: 'http://localhost:3000',
      timeout: 10000,
      maxRetries: 3,
      retryDelay: 1000,
      maxRetryDelay: 30000,
    });
  }
  return globalAPIService;
}

function getWebSocketService(): WebSocketService {
  if (!globalWebSocketService) {
    globalWebSocketService = new WebSocketService({
      url: 'ws://localhost:3000/ws',
      clientType: 'display',
      reconnectInterval: 1000,
      maxReconnectInterval: 30000,
      reconnectBackoffFactor: 2,
      maxReconnectAttempts: 10,
      heartbeatInterval: 30000,
      connectionTimeout: 10000,
    });
  }
  return globalWebSocketService;
}

function TVDisplayApp() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [apiService] = useState(() => getAPIService());
  const [wsService] = useState(() => getWebSocketService());
  
  // Initialize WebSocket integration for real-time updates
  useWebSocketIntegration(wsService);

  const { actions: connectionActions } = useConnection();
  
  // Initialize services on mount - simple approach
  useEffect(() => {
    let mounted = true;

    const initializeServices = async () => {
      try {
        console.log('Connecting WebSocket for real-time updates...');
        
        // Set API as connected optimistically (we'll only use it for control actions)
        connectionActions.setApiStatus({
          connected: true,
          reconnecting: false,
          error: undefined,
        });
        
        // Connect WebSocket for real-time updates
        await wsService.connect();
        
        if (mounted) {
          setIsInitialized(true);
          console.log('WebSocket connected successfully');
        }
      } catch (error) {
        console.error('Failed to connect WebSocket:', error);
        if (mounted) {
          setIsInitialized(true); // Still show UI even if WebSocket fails
        }
      }
    };

    // Small delay to ensure React has finished mounting
    const timeoutId = setTimeout(initializeServices, 100);

    // Cleanup on unmount
    return () => {
      mounted = false;
      clearTimeout(timeoutId);
      wsService.disconnect();
    };
  }, []); // Empty dependency array - only run once

  // Show loading state while initializing
  if (!isInitialized) {
    return (
      <div className="tv-display-app loading">
        <div className="loading-content">
          <h1>Party Jukebox</h1>
          <p>Connecting to server...</p>
          <div className="loading-spinner">🔄</div>
        </div>
      </div>
    );
  }

  return (
    <div className="tv-display-app">
      {/* Skip to main content link for accessibility */}
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      
      {/* Header */}
      <header className="app-header" role="banner">
        <div className="header-content">
          <h1 className="app-title">Party Jukebox</h1>
          <ConnectionStatusIndicator className="header-connection-status" />
        </div>
      </header>
      
      {/* Main content area */}
      <main id="main-content" className="main-content" role="main">
        <div className="content-layout">
          {/* Primary content section */}
          <section className="primary-content">
            <ErrorBoundary fallback={
              <div className="component-error">
                <h2>Now Playing section temporarily unavailable</h2>
                <p>Please refresh the page or try again later.</p>
              </div>
            }>
              <NowPlayingSection />
            </ErrorBoundary>
            
            <ErrorBoundary fallback={
              <div className="component-error">
                <h2>Playback controls temporarily unavailable</h2>
                <p>Please refresh the page to restore controls.</p>
              </div>
            }>
              <PlaybackControls apiService={apiService} />
            </ErrorBoundary>
          </section>
          
          {/* Sidebar content */}
          <aside className="sidebar-content" role="complementary" aria-label="Queue and join information">
            <ErrorBoundary fallback={
              <div className="component-error">
                <h3>Queue display unavailable</h3>
                <p>Refresh to restore queue view.</p>
              </div>
            }>
              <QueueDisplay maxVisible={5} />
            </ErrorBoundary>
            
            <ErrorBoundary fallback={
              <div className="component-error">
                <h3>Join instructions unavailable</h3>
                <p>Refresh to restore join information.</p>
              </div>
            }>
              <JoinInstructions />
            </ErrorBoundary>
          </aside>
        </div>
      </main>
      
      {/* Footer */}
      <footer className="app-footer" role="contentinfo">
        <div className="footer-content">
          <div className="server-info">
            <span className="server-status">
              Server: {window.location.hostname}:{window.location.port || '3000'}
            </span>
          </div>
          <div className="app-info">
            <span className="app-version">Party Jukebox TV Display</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ConnectionProvider>
        <PlaybackProvider>
          <QueueProvider>
            <TVDisplayApp />
          </QueueProvider>
        </PlaybackProvider>
      </ConnectionProvider>
    </ErrorBoundary>
  );
}

export default App;