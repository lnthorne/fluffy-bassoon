/**
 * Services Index
 * 
 * Exports all service classes and utilities for the TV Display Interface
 */

export { APIService, createAPIService } from './APIService';
export type { 
  APIServiceConfig,
  PlaybackStatusResponse,
  PlaybackActionResponse,
  QueueStateResponse 
} from './APIService';

export { WebSocketService, createWebSocketService } from './WebSocketService';
export type {
  WebSocketServiceConfig,
  WebSocketEventType,
  WebSocketEvent,
  QueueUpdateEvent,
  PlaybackUpdateEvent,
  TrackAddedEvent,
  TrackFinishedEvent,
  InitialStateEvent,
  ConnectionStatus,
  EventHandler
} from './WebSocketService';

export { useWebSocketIntegration, WebSocketIntegrationProvider } from './WebSocketIntegration';
export type { WebSocketIntegrationProviderProps } from './WebSocketIntegration';

export { ServiceManager, createServiceManager } from './ServiceManager';
export type { ServiceManagerConfig, ServiceHealth } from './ServiceManager';