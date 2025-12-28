import React, { useState, useEffect, useRef } from 'react';
import {
  SessionProvider,
  QueueProvider,
  ConnectionProvider,
  RateLimitProvider,
  useSession,
  useConnection,
  useRateLimit,
  useQueue
} from './contexts';
import {
  SessionSetup,
  SessionManager,
  SearchInterface,
  QueueDisplay,
  AddTrackButton,
  RateLimitIndicator,
  ErrorBoundary,
  ConnectionError,
  ErrorDisplay
} from './components';
import { SearchResult, Track, QueueStateFactory } from '@party-jukebox/shared';
import { apiService } from './services';
import './App.css';

// Main app content component (needs to be inside providers)
const AppContent: React.FC = () => {
  const { state: sessionState } = useSession();
  const { state: connectionState, connectWebSocket, testAPIConnection } = useConnection();
  const { state: rateLimitState } = useRateLimit();
  const { state: queueState, updateQueue } = useQueue();
  const [showSessionSetup, setShowSessionSetup] = useState(true);
  const [selectedTrack, setSelectedTrack] = useState<SearchResult | null>(null);
  const [appError, setAppError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const eventHandlersSetup = useRef<boolean>(false);

  // Check if session is ready (has nickname and is not loading)
  const isSessionReady = sessionState.session && !sessionState.isLoading;

  // Initialize services and connections when session is ready
  useEffect(() => {
    const initializeApp = async () => {
      if (isSessionReady && !isInitialized) {
        try {
          console.log('Initializing mobile controller app...');
          
          // Test API connectivity first
          console.log('Testing API connection...');
          const apiConnected = await testAPIConnection();
          
          if (apiConnected) {
            console.log('API connection successful, checking WebSocket status...');
            
            // Only connect WebSocket if not already connected
            if (!connectionState.status.websocket.connected && !connectionState.status.websocket.reconnecting) {
              console.log('Initializing WebSocket connection...');
              await connectWebSocket();
              console.log('WebSocket initialization complete');
            } else {
              console.log('WebSocket already connected or connecting, skipping initialization');
            }
          } else {
            console.warn('API connection failed, WebSocket initialization skipped');
          }
          
          setIsInitialized(true);
          console.log('App initialization complete');
        } catch (error) {
          console.error('Failed to initialize app:', error);
          setAppError(`Failed to initialize app: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
    };

    initializeApp();
  }, [isSessionReady, isInitialized, connectionState.status.websocket.connected, connectionState.status.websocket.reconnecting, testAPIConnection, connectWebSocket]);

  // Subscribe to WebSocket events for real-time updates (only once per service instance)
  useEffect(() => {
    const webSocketService = connectionState.webSocketService;
    if (webSocketService && connectionState.status.websocket.connected && !eventHandlersSetup.current) {
      console.log('Setting up WebSocket event handlers...');
      
      // Define event handlers with stable references
      const handleQueueUpdate = (event: any) => {
        console.log('Received queue update:', event.data);
        if (event.data) {
          // Transform raw server data into proper QueueState using factory
          const queueState = QueueStateFactory.create(
            event.data.currentTrack,
            event.data.upcomingTracks || []
          );
          updateQueue(queueState);
        }
      };

      const handleInitialState = (event: any) => {
        console.log('Received initial state:', event.data);
        if (event.data && event.data.queue) {
          // Transform raw server data into proper QueueState using factory
          const queueState = QueueStateFactory.create(
            event.data.queue.currentTrack,
            event.data.queue.upcomingTracks || []
          );
          updateQueue(queueState);
        }
      };

      const handlePlaybackUpdate = (event: any) => {
        console.log('Received playback update:', event.data);
        if (event.data) {
          // Playback updates should not overwrite the entire queue state
          // They only contain currentTrack and playback position info
          // We should update playback status separately or merge with existing queue state
          console.log('Playback update - not updating queue state to avoid overwriting upcoming tracks');
        }
      };

      const handleTrackAdded = (event: any) => {
        console.log('Received track added event:', event.data);
        if (event.data) {
          // Show success feedback or update queue
          // This could trigger a toast notification or other user feedback
        }
      };

      const handleConnection = () => {
        console.log('WebSocket connection established');
        // Connection is already handled by ConnectionContext
      };

      const handleError = (event: any) => {
        console.error('WebSocket error:', event.data);
        // Error handling is already managed by ConnectionContext
      };

      // Subscribe to events
      webSocketService.subscribe('initial_state', handleInitialState);
      webSocketService.subscribe('queue_updated', handleQueueUpdate);
      webSocketService.subscribe('playback_updated', handlePlaybackUpdate);
      webSocketService.subscribe('track_added', handleTrackAdded);
      webSocketService.subscribe('connection_established', handleConnection);
      webSocketService.subscribe('error_occurred', handleError);

      eventHandlersSetup.current = true;
      console.log('WebSocket event handlers set up successfully');

      // Cleanup subscriptions
      return () => {
        console.log('Cleaning up WebSocket event handlers...');
        webSocketService.unsubscribe('initial_state', handleInitialState);
        webSocketService.unsubscribe('queue_updated', handleQueueUpdate);
        webSocketService.unsubscribe('playback_updated', handlePlaybackUpdate);
        webSocketService.unsubscribe('track_added', handleTrackAdded);
        webSocketService.unsubscribe('connection_established', handleConnection);
        webSocketService.unsubscribe('error_occurred', handleError);
        eventHandlersSetup.current = false;
      };
    }
  }, [connectionState.webSocketService, connectionState.status.websocket.connected, updateQueue]);

  // Cleanup on app unmount
  useEffect(() => {
    return () => {
      console.log('App unmounting, cleaning up connections...');
      // Cleanup is handled by individual context providers
    };
  }, []);

  // Handle session setup completion
  const handleSessionReady = () => {
    setShowSessionSetup(false);
  };

  // Handle track selection from search
  const handleTrackSelect = (track: SearchResult) => {
    setSelectedTrack(track);
  };

  // Handle track addition
  const handleTrackAdd = async (track: Track) => {
    try {
      // Convert UserSession to User
      const user = {
        id: sessionState.session!.deviceId,
        nickname: sessionState.session!.nickname
      };
      
      const result = await apiService.addTrack(track, user);
      setSelectedTrack(null);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to add track';
      return {
        success: false,
        error: errorMessage
      };
    }
  };

  // Clear app error
  const clearAppError = () => {
    setAppError(null);
  };

  // Show session setup if needed
  if (showSessionSetup && (!isSessionReady || sessionState.session?.nickname.startsWith('Guest-'))) {
    return (
      <ErrorBoundary>
        <SessionSetup onSessionReady={handleSessionReady} />
      </ErrorBoundary>
    );
  }

  // Show loading state if session is still loading or app is initializing
  if (sessionState.isLoading || !isInitialized) {
    return (
      <div className="app-loading">
        <div className="loading-spinner">⟳</div>
        <p>{sessionState.isLoading ? 'Loading session...' : 'Connecting to server...'}</p>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="app">
        {/* Header with session info and connection status */}
        <header className="app-header">
          <div className="app-header__content">
            <div className="app-header__title">
              <h1>Party Jukebox</h1>
              <div className="connection-status">
                <span className={`connection-dot ${connectionState.status.api.connected ? 'connected' : 'disconnected'}`} />
                <span className="connection-text">
                  {connectionState.status.api.connected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
            </div>
            
            <SessionManager />
          </div>
        </header>

        {/* Main content area */}
        <main className="app-main">
          {/* App-level error display */}
          {appError && (
            <ErrorDisplay
              title="Application Error"
              message={appError}
              type="error"
              onDismiss={clearAppError}
              onRetry={() => window.location.reload()}
              retryLabel="Refresh App"
            />
          )}

          {/* Connection error display */}
          <ConnectionError />

          {/* Session error display */}
          {sessionState.error && (
            <ErrorDisplay
              title="Session Error"
              message={sessionState.error}
              type="warning"
              onRetry={() => window.location.reload()}
              retryLabel="Refresh Session"
            />
          )}

          {/* Search section */}
          <section className="app-section search-section">
            <h2 className="section-title">Search Music</h2>
            <SearchInterface
              onTrackSelect={handleTrackSelect}
              disabled={!connectionState.status.api.connected}
            />
            
            {/* Selected track for adding */}
            {selectedTrack && (
              <div className="selected-track">
                <div className="selected-track__info">
                  <h3>Ready to add:</h3>
                  <div className="selected-track__details">
                    <strong>{selectedTrack.title}</strong>
                    <span>{selectedTrack.artist}</span>
                  </div>
                </div>
                <AddTrackButton
                  track={selectedTrack}
                  onAdd={handleTrackAdd}
                  disabled={!connectionState.status.api.connected}
                />
              </div>
            )}
          </section>

          {/* Rate limit indicator */}
          <section className="app-section rate-limit-section">
            <RateLimitIndicator 
              rateLimitInfo={rateLimitState.rateLimitInfo || {
                remainingRequests: 5,
                timeUntilReset: 0,
                maxRequests: 5,
                windowDuration: 600000,
                isLimited: false
              }}
            />
          </section>

          {/* Queue section */}
          <section className="app-section queue-section">
            <h2 className="section-title">Music Queue</h2>
            <QueueDisplay
              queueState={queueState.queueState}
              currentDeviceId={sessionState.session?.deviceId || ''}
              maxVisible={5}
              highlightUserTracks={true}
              showCurrentTrack={true}
            />
          </section>
        </main>
      </div>
    </ErrorBoundary>
  );
};

function App() {
  // Note: No client-side routing implemented as the mobile controller
  // is designed as a single-page application with conditional state rendering.
  // All functionality (session setup, search, queue) is accessible on one screen
  // to minimize navigation complexity on mobile devices (Requirement 7.4).
  
  return (
    <ErrorBoundary>
      <SessionProvider>
        <ConnectionProvider>
          <QueueProvider>
            <RateLimitProvider>
              <AppContent />
            </RateLimitProvider>
          </QueueProvider>
        </ConnectionProvider>
      </SessionProvider>
    </ErrorBoundary>
  );
}

export default App;