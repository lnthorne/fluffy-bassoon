/**
 * WebSocket Integration Service for Mobile Controller
 * 
 * Connects WebSocket events to context state updates for real-time synchronization.
 * Handles event subscription and state updates with mobile-specific optimizations.
 * 
 * Requirements: 4.3, 5.2, 5.3
 */

import { useEffect, useRef, useCallback } from 'react';
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

/**
 * WebSocket event handler interface for mobile controller
 */
export interface WebSocketEventHandlers {
  onQueueUpdate?: (event: QueueUpdateEvent) => void;
  onPlaybackUpdate?: (event: PlaybackUpdateEvent) => void;
  onTrackAdded?: (event: TrackAddedEvent) => void;
  onTrackFinished?: (event: TrackFinishedEvent) => void;
  onInitialState?: (event: InitialStateEvent) => void;
  onConnectionStatusChange?: (status: string) => void;
  onError?: (error: string) => void;
}

/**
 * WebSocket Integration Hook for Mobile Controller
 * 
 * Handles event subscription and provides real-time updates for:
 * - Queue changes for live queue display
 * - Playback updates for now playing section  
 * - Track added events for user feedback
 * 
 * Requirements: 4.3, 5.2, 5.3
 */
export function useWebSocketIntegration(
  wsService: WebSocketService | null,
  handlers: WebSocketEventHandlers
) {
  // Track event handlers for cleanup
  const eventHandlersRef = useRef<Map<string, EventHandler>>(new Map());
  const hasInitializedRef = useRef(false);

  /**
   * Handle initial state event - Mobile Controller specific
   * Requirements: 4.3, 5.2, 5.3
   */
  const handleInitialState = useCallback((event: InitialStateEvent) => {
    console.log('Mobile Controller: Received initial state:', event.data);
    
    try {
      if (handlers.onInitialState) {
        handlers.onInitialState(event);
      }
      
      // Also trigger individual handlers for initial data
      if (event.data.queue && handlers.onQueueUpdate) {
        const queueEvent: QueueUpdateEvent = {
          type: 'queue_updated',
          timestamp: event.timestamp,
          sequenceNumber: event.sequenceNumber,
          data: event.data.queue,
        };
        handlers.onQueueUpdate(queueEvent);
      }
      
      if (event.data.playback && handlers.onPlaybackUpdate) {
        const playbackEvent: PlaybackUpdateEvent = {
          type: 'playback_updated',
          timestamp: event.timestamp,
          sequenceNumber: event.sequenceNumber,
          data: event.data.playback,
        };
        handlers.onPlaybackUpdate(playbackEvent);
      }
      
    } catch (error) {
      console.error('Mobile Controller: Error handling initial state:', error);
      if (handlers.onError) {
        handlers.onError('Failed to process initial state');
      }
    }
  }, [handlers]);

  /**
   * Handle queue update events for live queue display
   * Requirements: 4.3, 5.2
   */
  const handleQueueUpdate = useCallback((event: QueueUpdateEvent) => {
    console.log('Mobile Controller: Queue updated:', event.data);
    
    try {
      if (handlers.onQueueUpdate) {
        handlers.onQueueUpdate(event);
      }
    } catch (error) {
      console.error('Mobile Controller: Error handling queue update:', error);
      if (handlers.onError) {
        handlers.onError('Failed to update queue display');
      }
    }
  }, [handlers]);

  /**
   * Handle playback update events for now playing section
   * Requirements: 4.3, 5.3
   */
  const handlePlaybackUpdate = useCallback((event: PlaybackUpdateEvent) => {
    console.log('Mobile Controller: Playback updated:', event.data);
    
    try {
      if (handlers.onPlaybackUpdate) {
        handlers.onPlaybackUpdate(event);
      }
    } catch (error) {
      console.error('Mobile Controller: Error handling playback update:', error);
      if (handlers.onError) {
        handlers.onError('Failed to update playback status');
      }
    }
  }, [handlers]);

  /**
   * Handle track added events for user feedback
   * Requirements: 4.3, 5.2, 5.3
   */
  const handleTrackAdded = useCallback((event: TrackAddedEvent) => {
    console.log('Mobile Controller: Track added:', event.data);
    
    try {
      if (handlers.onTrackAdded) {
        handlers.onTrackAdded(event);
      }
      
      // Also update queue display if handler exists
      if (handlers.onQueueUpdate) {
        // Trigger a queue refresh to show the new track
        // The actual queue data will come from the next queue_updated event
        console.log('Mobile Controller: Track added, queue will be updated via queue_updated event');
      }
    } catch (error) {
      console.error('Mobile Controller: Error handling track added:', error);
      if (handlers.onError) {
        handlers.onError('Failed to process track addition');
      }
    }
  }, [handlers]);

  /**
   * Handle track finished events
   * Requirements: 4.3, 5.2, 5.3
   */
  const handleTrackFinished = useCallback((event: TrackFinishedEvent) => {
    console.log('Mobile Controller: Track finished:', event.data);
    
    try {
      if (handlers.onTrackFinished) {
        handlers.onTrackFinished(event);
      }
      
      // Handle error cases with user feedback
      if (event.data.reason === 'error' && handlers.onError) {
        handlers.onError('Track playback failed, skipping to next');
      }
    } catch (error) {
      console.error('Mobile Controller: Error handling track finished:', error);
      if (handlers.onError) {
        handlers.onError('Failed to process track completion');
      }
    }
  }, [handlers]);

  /**
   * Handle connection status events for mobile UI feedback
   * Requirements: 5.2, 5.3
   */
  const handleConnectionStatus = useCallback((event: WebSocketEvent) => {
    console.log('Mobile Controller: Connection status changed:', event.data);
    
    try {
      const { status } = event.data;
      
      if (handlers.onConnectionStatusChange) {
        handlers.onConnectionStatusChange(status);
      }
      
      // Provide user-friendly error messages for mobile
      if (status === 'error' && handlers.onError) {
        handlers.onError('Connection lost. Attempting to reconnect...');
      } else if (status === 'connected' && handlers.onError) {
        // Clear any previous error when reconnected
        handlers.onError('');
      }
    } catch (error) {
      console.error('Mobile Controller: Error handling connection status:', error);
    }
  }, [handlers]);

  /**
   * Handle heartbeat events for connection monitoring
   * Requirements: 5.2, 5.3
   */
  const handleHeartbeat = useCallback((_event: WebSocketEvent) => {
    // Update connection activity - mobile controllers can use this
    // to show connection health indicators
    if (handlers.onConnectionStatusChange) {
      handlers.onConnectionStatusChange('connected');
    }
  }, [handlers]);

  /**
   * Handle error events with mobile-friendly messages
   * Requirements: 5.2, 5.3
   */
  const handleError = useCallback((event: WebSocketEvent) => {
    console.error('Mobile Controller: WebSocket error event:', event.data);
    
    try {
      const errorMessage = event.data.message || 'Connection error occurred';
      
      if (handlers.onError) {
        // Provide mobile-friendly error messages
        let userFriendlyMessage = errorMessage;
        
        if (errorMessage.includes('network') || errorMessage.includes('timeout')) {
          userFriendlyMessage = 'Network connection issue. Please check your connection.';
        } else if (errorMessage.includes('server') || errorMessage.includes('unavailable')) {
          userFriendlyMessage = 'Server temporarily unavailable. Trying to reconnect...';
        } else if (errorMessage.includes('rate limit') || errorMessage.includes('too many')) {
          userFriendlyMessage = 'Too many requests. Please wait a moment.';
        }
        
        handlers.onError(userFriendlyMessage);
      }
    } catch (error) {
      console.error('Mobile Controller: Error handling WebSocket error event:', error);
    }
  }, [handlers]);

  /**
   * Initialize WebSocket integration for mobile controller
   * Requirements: 4.3, 5.2, 5.3
   */
  useEffect(() => {
    if (!wsService || hasInitializedRef.current) return;

    console.log('Mobile Controller: Initializing WebSocket integration');
    hasInitializedRef.current = true;

    // Create event handlers map
    const eventHandlerMap = new Map<string, EventHandler>([
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
    eventHandlerMap.forEach((handler, eventType) => {
      wsService.subscribe(eventType as any, handler);
    });

    // Store handlers for cleanup
    eventHandlersRef.current = eventHandlerMap;

    // Cleanup on unmount
    return () => {
      console.log('Mobile Controller: Cleaning up WebSocket integration');
      
      // Unsubscribe from all events
      eventHandlersRef.current.forEach((handler, eventType) => {
        wsService.unsubscribe(eventType as any, handler);
      });

      // Clear handlers
      eventHandlersRef.current.clear();
      hasInitializedRef.current = false;
    };
  }, [wsService, handleInitialState, handleQueueUpdate, handlePlaybackUpdate, 
      handleTrackAdded, handleTrackFinished, handleConnectionStatus, 
      handleHeartbeat, handleError]);

  return {
    // Return connection status and utility functions for mobile UI
    isConnected: wsService?.isConnected() ?? false,
    connectionStatus: wsService?.getConnectionStatus() ?? 'disconnected',
    
    // Manual connection control for mobile UI
    connect: () => wsService?.connect(),
    disconnect: () => wsService?.disconnect(),
  };
}

/**
 * Create WebSocket event handlers for common mobile controller patterns
 * 
 * This helper creates handlers that work with typical mobile controller
 * state management patterns (React Context, useState, etc.)
 */
export function createMobileControllerHandlers(callbacks: {
  updateQueue?: (currentTrack: any, upcomingTracks: readonly any[]) => void;
  updatePlayback?: (status: string, currentTrack: any, position: number, duration: number) => void;
  showTrackAddedFeedback?: (track: any, position: number, addedBy: string) => void;
  showError?: (message: string) => void;
  updateConnectionStatus?: (status: string) => void;
}): WebSocketEventHandlers {
  return {
    onQueueUpdate: (event) => {
      if (callbacks.updateQueue) {
        callbacks.updateQueue(
          event.data.currentTrack,
          event.data.upcomingTracks || []
        );
      }
    },
    
    onPlaybackUpdate: (event) => {
      if (callbacks.updatePlayback) {
        callbacks.updatePlayback(
          event.data.status,
          event.data.currentTrack,
          event.data.position,
          event.data.duration
        );
      }
    },
    
    onTrackAdded: (event) => {
      if (callbacks.showTrackAddedFeedback) {
        callbacks.showTrackAddedFeedback(
          event.data.track,
          event.data.queuePosition,
          event.data.addedBy.nickname
        );
      }
    },
    
    onError: (message) => {
      if (callbacks.showError) {
        callbacks.showError(message);
      }
    },
    
    onConnectionStatusChange: (status) => {
      if (callbacks.updateConnectionStatus) {
        callbacks.updateConnectionStatus(status);
      }
    },
  };
}