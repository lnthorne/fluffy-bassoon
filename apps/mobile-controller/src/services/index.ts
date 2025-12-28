// Core services for mobile controller
export { APIService, apiService } from './APIService';
export type { AddTrackResponse, RateLimitInfo, APIServiceConfig } from './APIService';

export { StorageService, storageService } from './StorageService';
export type { UserSession, StorageServiceConfig } from './StorageService';

export { DeviceIdentityService, deviceIdentityService } from './DeviceIdentityService';
export type { DeviceIdentityConfig } from './DeviceIdentityService';

export { WebSocketService, createWebSocketService } from './WebSocketService';
export type { 
  WebSocketServiceConfig, 
  WebSocketEvent, 
  WebSocketEventType,
  QueueUpdateEvent,
  PlaybackUpdateEvent,
  TrackAddedEvent,
  TrackFinishedEvent,
  InitialStateEvent,
  ConnectionStatus,
  EventHandler
} from './WebSocketService';

export { useWebSocketIntegration, createMobileControllerHandlers } from './WebSocketIntegration';
export type { WebSocketEventHandlers } from './WebSocketIntegration';