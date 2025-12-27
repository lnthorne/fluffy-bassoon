/**
 * WebSocket Integration Service - SIMPLIFIED
 * 
 * Connects WebSocket events to context state updates for real-time synchronization.
 * Handles ONLY event subscription and state updates - NO connection management.
 * 
 * Requirements: 5.1, 5.2, 5.3
 */

import React, { useEffect, useRef, useCallback } from 'react';
import { 
  WebSocketService, 
  WebSocketEvent,
  QueueUpdateEvent,
  PlaybackUpdateEvent,
  TrackAddedEvent,
  TrackFinishedEvent,
  InitialStateEvent,
  EventHandler
} from './WebSocketService';
import { useConnection } from '../contexts/ConnectionContext';
import { usePlayback } from '../contexts/PlaybackContext';
import { useQueue } from '../contexts/QueueContext';

/**
 * WebSocket Integration Hook - SIMPLIFIED
 * 
 * ONLY handles event subscription and state updates.
 * Connection management is handled in App.tsx.
 * 
 * Requirements: 5.1, 5.2, 5.3
 */
export function useWebSocketIntegration(wsService: WebSocketService | null) {
  const { actions: connectionActions } = useConnection();
  const { actions: playbackActions } = usePlayback();
  const { actions: queueActions } = useQueue();
  
  // Track event handlers for cleanup
  const eventHandlersRef = useRef<Map<string, EventHandler>>(new Map());
  const hasInitializedRef = useRef(false);

  /**
   * Handle initial state event
   * Requirements: 5.1, 5.2, 5.3
   */
  const handleInitialState = useCallback((event: InitialStateEvent) => {
    console.log('Received initial state:', event.data);
    
    try {
      // Update queue state
      if (event.data.queue) {
        const { currentTrack, upcomingTracks } = event.data.queue;
        const allItems = currentTrack ? [currentTrack, ...upcomingTracks] : [...upcomingTracks];
        queueActions.setQueueItems(allItems);
      }
      
      // Update playback state
      if (event.data.playback) {
        playbackActions.setPlaybackStatus({
          status: event.data.playback.status,
          currentTrack: event.data.playback.currentTrack,
          position: event.data.playback.position,
          duration: event.data.playback.duration,
          volume: event.data.playback.volume,
          error: event.data.playback.error,
        });
      }
      
      // Update connection activity
      connectionActions.updateLastActivity();
      
    } catch (error) {
      console.error('Error handling initial state:', error);
      connectionActions.handleConnectionError('websocket', 'Failed to process initial state');
    }
  }, [playbackActions, queueActions, connectionActions]);

  /**
   * Handle queue update events
   * Requirements: 5.2
   */
  const handleQueueUpdate = useCallback((event: QueueUpdateEvent) => {
    console.log('Queue updated:', event.data);
    
    try {
      const { currentTrack, upcomingTracks } = event.data;
      
      // Combine current track and upcoming tracks
      const allItems = currentTrack ? [currentTrack, ...upcomingTracks] : [...upcomingTracks];
      queueActions.setQueueItems(allItems);
      
      // Update connection activity
      connectionActions.updateLastActivity();
      
    } catch (error) {
      console.error('Error handling queue update:', error);
      queueActions.setError('Failed to update queue');
    }
  }, [queueActions, connectionActions]);

  /**
   * Handle playback update events
   * Requirements: 5.1
   */
  const handlePlaybackUpdate = useCallback((event: PlaybackUpdateEvent) => {
    console.log('Playback updated:', event.data);
    
    try {
      playbackActions.setPlaybackStatus({
        status: event.data.status,
        currentTrack: event.data.currentTrack,
        position: event.data.position,
        duration: event.data.duration,
        volume: event.data.volume,
        error: event.data.error,
      });
      
      // Update connection activity
      connectionActions.updateLastActivity();
      
    } catch (error) {
      console.error('Error handling playback update:', error);
      playbackActions.setError('Failed to update playback status');
    }
  }, [playbackActions, connectionActions]);

  /**
   * Handle track added events
   * Requirements: 5.2
   */
  const handleTrackAdded = useCallback((event: TrackAddedEvent) => {
    console.log('Track added:', event.data);
    
    try {
      // Add the new track to the queue
      queueActions.addQueueItem(event.data.track);
      
      // Update connection activity
      connectionActions.updateLastActivity();
      
    } catch (error) {
      console.error('Error handling track added:', error);
      queueActions.setError('Failed to add track to queue');
    }
  }, [queueActions, connectionActions]);

  /**
   * Handle track finished events
   * Requirements: 5.1, 5.2
   */
  const handleTrackFinished = useCallback((event: TrackFinishedEvent) => {
    console.log('Track finished:', event.data);
    
    try {
      const { finishedTrack, nextTrack, reason } = event.data;
      
      // Remove the finished track from queue
      if (finishedTrack) {
        queueActions.removeQueueItem(finishedTrack.id);
      }
      
      // Update current track in playback context
      if (nextTrack) {
        playbackActions.setCurrentTrack(nextTrack);
        playbackActions.setPlaybackStatus({ status: 'playing' });
      } else {
        playbackActions.setCurrentTrack(null);
        playbackActions.setPlaybackStatus({ status: 'idle' });
      }
      
      // Handle error cases
      if (reason === 'error') {
        playbackActions.setError('Track playback failed, skipping to next');
      }
      
      // Update connection activity
      connectionActions.updateLastActivity();
      
    } catch (error) {
      console.error('Error handling track finished:', error);
      playbackActions.setError('Failed to process track completion');
    }
  }, [playbackActions, queueActions, connectionActions]);

  /**
   * Handle connection status events - SIMPLIFIED
   * Requirements: 5.5, 6.1, 6.2
   */
  const handleConnectionStatus = useCallback((event: WebSocketEvent) => {
    console.log('Connection status changed:', event.data);
    
    try {
      const { status } = event.data;
      
      // Just update the status, don't trigger any actions
      switch (status) {
        case 'connected':
          connectionActions.setWebSocketStatus({ 
            connected: true, 
            reconnecting: false, 
            error: undefined 
          });
          break;
          
        case 'connecting':
        case 'reconnecting':
          connectionActions.setWebSocketStatus({ 
            connected: false, 
            reconnecting: true 
          });
          break;
          
        case 'disconnected':
        case 'error':
          connectionActions.setWebSocketStatus({ 
            connected: false, 
            reconnecting: false,
            error: status === 'error' ? 'WebSocket connection lost' : undefined
          });
          break;
      }
      
    } catch (error) {
      console.error('Error handling connection status:', error);
    }
  }, [connectionActions]);

  /**
   * Handle heartbeat events
   * Requirements: 6.1, 6.2
   */
  const handleHeartbeat = useCallback((_event: WebSocketEvent) => {
    // Update last activity time
    connectionActions.updateLastActivity();
  }, [connectionActions]);

  /**
   * Handle error events - SIMPLIFIED
   * Requirements: 6.5
   */
  const handleError = useCallback((event: WebSocketEvent) => {
    console.error('WebSocket error event:', event.data);
    
    try {
      const errorMessage = event.data.message || 'WebSocket error occurred';
      // Just log the error, don't trigger connection actions that might cause loops
      console.error('WebSocket error:', errorMessage);
      
    } catch (error) {
      console.error('Error handling WebSocket error event:', error);
    }
  }, []);





  /**
   * Initialize WebSocket integration - SIMPLE APPROACH
   * ONLY subscribes to events - NO connection monitoring
   */
  useEffect(() => {
    if (!wsService || hasInitializedRef.current) return;

    console.log('Initializing WebSocket integration (events only)');
    hasInitializedRef.current = true;

    // Create event handlers inline to avoid dependency issues
    const handlers = new Map<string, EventHandler>([
      ['initial_state', handleInitialState as EventHandler],
      ['queue_updated', handleQueueUpdate as EventHandler],
      ['playback_updated', handlePlaybackUpdate as EventHandler],
      ['track_added', handleTrackAdded as EventHandler],
      ['track_finished', handleTrackFinished as EventHandler],
      ['connection_established', handleConnectionStatus],
      ['heartbeat', handleHeartbeat],
      ['error_occurred', handleError],
    ]);

    // Subscribe to events
    handlers.forEach((handler, eventType) => {
      wsService.subscribe(eventType as any, handler);
    });

    // Store handlers for cleanup
    eventHandlersRef.current = handlers;

    // Cleanup on unmount
    return () => {
      console.log('Cleaning up WebSocket integration');
      
      // Unsubscribe from all events
      eventHandlersRef.current.forEach((handler, eventType) => {
        wsService.unsubscribe(eventType as any, handler);
      });

      // Clear handlers
      eventHandlersRef.current.clear();
      hasInitializedRef.current = false;
    };
  }, [wsService]); // ONLY depend on wsService, not the callback functions

  return {
    // Simplified interface - connection is handled in App.tsx
    // No functions needed since everything is handled in the effect
  };
}

/**
 * WebSocket Integration Provider Component
 * 
 * Provides WebSocket integration as a higher-order component.
 * Automatically manages connection and event handling.
 */
export interface WebSocketIntegrationProviderProps {
  children: React.ReactNode;
  wsService: WebSocketService | null;
  autoConnect?: boolean;
}

export function WebSocketIntegrationProvider({ 
  children, 
  wsService
}: Omit<WebSocketIntegrationProviderProps, 'autoConnect'>) {
  useWebSocketIntegration(wsService);

  // Connection is now handled in App.tsx, not here
  // This provider just ensures the integration is set up

  return <>{children}</>;
}