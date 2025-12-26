/**
 * WebSocket Types and Interfaces
 * 
 * Type definitions for WebSocket communication including connection objects,
 * event types, and message structures for real-time updates.
 * 
 * Requirements: 5.1, 5.2, 5.3, 6.1, 6.2, 6.4, 6.6, 6.7
 */

/**
 * Client type enumeration
 */
export type ClientType = 'controller' | 'display';

/**
 * WebSocket connection object representing a connected client
 * Requirements: 5.1, 5.4, 5.5
 */
export interface WebSocketConnection {
  id: string;
  socket: any; // Use any to be compatible with Fastify WebSocket
  clientType: ClientType;
  connectedAt: Date;
  lastActivity: Date;
  clientIP?: string;
  userAgent?: string;
  isAlive: boolean;
}

/**
 * WebSocket event types for real-time communication
 * Requirements: 5.2, 5.3, 6.1, 6.2
 */
export type WebSocketEventType = 
  | 'connection_established'
  | 'queue_updated'
  | 'playback_updated'
  | 'track_added'
  | 'track_finished'
  | 'error_occurred'
  | 'initial_state'
  | 'heartbeat'
  | 'client_message';

/**
 * Base WebSocket event structure
 * Requirements: 6.6, 6.7
 */
export interface WebSocketEvent {
  type: WebSocketEventType;
  timestamp: Date;
  sequenceNumber: number;
  data: any;
}

/**
 * Connection establishment event
 * Requirements: 5.1
 */
export interface ConnectionEstablishedEvent extends WebSocketEvent {
  type: 'connection_established';
  data: {
    clientId: string;
    clientType: ClientType;
    serverInfo: {
      version: string;
      capabilities: string[];
      heartbeatInterval: number;
    };
  };
}

/**
 * Queue update event
 * Requirements: 5.2, 6.1
 */
export interface QueueUpdateEvent extends WebSocketEvent {
  type: 'queue_updated';
  data: {
    currentTrack: any | null; // QueueItem from shared package
    upcomingTracks: any[]; // QueueItem[] from shared package
    totalLength: number;
    isEmpty: boolean;
  };
}

/**
 * Playback update event
 * Requirements: 5.3, 6.2
 */
export interface PlaybackUpdateEvent extends WebSocketEvent {
  type: 'playback_updated';
  data: {
    status: 'idle' | 'resolving' | 'playing' | 'paused' | 'error';
    currentTrack: any | null; // QueueItem from shared package
    position: number;
    duration: number;
    volume: number;
    error?: string;
  };
}

/**
 * Track added event
 * Requirements: 5.2, 6.1
 */
export interface TrackAddedEvent extends WebSocketEvent {
  type: 'track_added';
  data: {
    track: any; // QueueItem from shared package
    queuePosition: number;
    addedBy: {
      nickname: string;
    };
  };
}

/**
 * Track finished event
 * Requirements: 5.3, 6.2
 */
export interface TrackFinishedEvent extends WebSocketEvent {
  type: 'track_finished';
  data: {
    finishedTrack: any; // QueueItem from shared package
    nextTrack: any | null; // QueueItem from shared package
    reason: 'completed' | 'skipped' | 'error';
  };
}

/**
 * Error event
 * Requirements: 7.2, 7.6
 */
export interface ErrorEvent extends WebSocketEvent {
  type: 'error_occurred';
  data: {
    error: {
      code: string;
      message: string;
      timestamp: string;
      details?: any;
    };
  };
}

/**
 * Initial state synchronization event
 * Requirements: 6.4
 */
export interface InitialStateEvent extends WebSocketEvent {
  type: 'initial_state';
  data: {
    queue: {
      currentTrack: any | null;
      upcomingTracks: any[];
      totalLength: number;
      isEmpty: boolean;
    };
    playback: {
      status: 'idle' | 'resolving' | 'playing' | 'paused' | 'error';
      currentTrack: any | null;
      position: number;
      duration: number;
      volume: number;
      error?: string;
    };
    serverTime: string;
  };
}

/**
 * Heartbeat event for connection health monitoring
 * Requirements: 5.4, 5.5
 */
export interface HeartbeatEvent extends WebSocketEvent {
  type: 'heartbeat';
  data: {
    serverTime: string;
    clientCount: number;
  };
}

/**
 * Client message event for incoming messages from clients
 * Requirements: 5.1, 7.6
 */
export interface ClientMessageEvent extends WebSocketEvent {
  type: 'client_message';
  data: {
    messageType: string;
    payload: any;
    clientId: string;
    clientType: ClientType;
  };
}

/**
 * WebSocket message structure for incoming client messages
 * Requirements: 5.1, 7.6
 */
export interface IncomingWebSocketMessage {
  type: string;
  payload?: any;
  timestamp?: string;
}

/**
 * Client filtering options for event broadcasting
 * Requirements: 6.7
 */
export interface ClientFilter {
  clientType?: ClientType;
  excludeClientIds?: string[];
  includeClientIds?: string[];
}

/**
 * WebSocket server statistics
 * Requirements: 5.1
 */
export interface WebSocketStats {
  totalConnections: number;
  controllerConnections: number;
  displayConnections: number;
  maxConnections: number;
  uptime: number;
  messagesReceived: number;
  messagesSent: number;
  errorsOccurred: number;
}

/**
 * Event metadata for tracking and ordering
 * Requirements: 6.6, 6.7
 */
export interface EventMetadata {
  sequenceNumber: number;
  timestamp: Date;
  sourceComponent: string;
  targetClients?: ClientFilter;
}