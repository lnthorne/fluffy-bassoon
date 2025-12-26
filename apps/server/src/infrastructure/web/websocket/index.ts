/**
 * WebSocket Infrastructure Exports
 * 
 * Central export point for all WebSocket infrastructure components including
 * the WebSocket server, client manager, message handler, and type definitions.
 * 
 * Requirements: 5.1, 5.4, 5.5, 6.3, 6.5, 6.7
 */

// Core WebSocket server
export { WebSocketServer } from './WebSocketServer';
export type { WebSocketServerConfig, WebSocketServerDependencies } from './WebSocketServer';

// Client management
export { ClientManager } from './ClientManager';

// Message handling
export { MessageHandler } from './MessageHandler';

// Type definitions
export type {
  ClientType,
  WebSocketConnection,
  WebSocketEvent,
  WebSocketEventType,
  ConnectionEstablishedEvent,
  QueueUpdateEvent,
  PlaybackUpdateEvent,
  TrackAddedEvent,
  TrackFinishedEvent,
  ErrorEvent,
  InitialStateEvent,
  HeartbeatEvent,
  ClientMessageEvent,
  IncomingWebSocketMessage,
  ClientFilter,
  WebSocketStats,
  EventMetadata,
} from './types';