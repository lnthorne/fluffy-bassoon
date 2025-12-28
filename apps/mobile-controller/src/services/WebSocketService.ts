/**
 * WebSocket Service for Mobile Controller
 * 
 * Handles WebSocket communication with the Party Jukebox server for real-time updates.
 * Provides connection management, event subscription, and automatic reconnection
 * with exponential backoff. Adapted for mobile controller with controller-specific
 * configuration and mobile-optimized connection handling.
 * 
 * Requirements: 5.1, 5.4, 5.5
 */

import { QueueState, QueueItem } from '@party-jukebox/shared';

/**
 * WebSocket event types matching server implementation
 */
export type WebSocketEventType = 
  | 'connection_established'
  | 'queue_updated'
  | 'playback_updated'
  | 'track_added'
  | 'track_finished'
  | 'error_occurred'
  | 'initial_state'
  | 'heartbeat';

/**
 * WebSocket event data structures
 */
export interface WebSocketEvent {
  type: WebSocketEventType;
  timestamp: string;
  sequenceNumber: number;
  data: any;
}

export interface QueueUpdateEvent extends WebSocketEvent {
  type: 'queue_updated';
  data: {
    currentTrack: QueueItem | null;
    upcomingTracks: readonly QueueItem[];
    totalLength: number;
    isEmpty: boolean;
  };
}

export interface PlaybackUpdateEvent extends WebSocketEvent {
  type: 'playback_updated';
  data: {
    status: 'idle' | 'resolving' | 'playing' | 'paused' | 'error';
    currentTrack: QueueItem | null;
    position: number;
    duration: number;
    volume: number;
    error?: string;
  };
}

export interface TrackAddedEvent extends WebSocketEvent {
  type: 'track_added';
  data: {
    track: QueueItem;
    queuePosition: number;
    addedBy: {
      nickname: string;
    };
  };
}

export interface TrackFinishedEvent extends WebSocketEvent {
  type: 'track_finished';
  data: {
    finishedTrack: QueueItem;
    nextTrack: QueueItem | null;
    reason: 'completed' | 'skipped' | 'error';
  };
}

export interface InitialStateEvent extends WebSocketEvent {
  type: 'initial_state';
  data: {
    queue: QueueState;
    playback: {
      status: 'idle' | 'resolving' | 'playing' | 'paused' | 'error';
      currentTrack: QueueItem | null;
      position: number;
      duration: number;
      volume: number;
      error?: string;
    };
    serverTime: string;
  };
}

/**
 * Connection status enumeration
 */
export type ConnectionStatus = 
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'error';

/**
 * Event handler function type
 */
export type EventHandler<T extends WebSocketEvent = WebSocketEvent> = (event: T) => void;

/**
 * WebSocket service configuration - Mobile Controller optimized
 */
export interface WebSocketServiceConfig {
  url: string;
  clientType?: 'display' | 'controller';
  reconnectInterval?: number;
  maxReconnectInterval?: number;
  reconnectBackoffFactor?: number;
  maxReconnectAttempts?: number;
  heartbeatInterval?: number;
  connectionTimeout?: number;
  // Mobile-specific options
  backgroundReconnectDelay?: number;
  visibilityChangeReconnect?: boolean;
}

/**
 * Reconnection configuration
 */
interface ReconnectConfig {
  interval: number;
  maxInterval: number;
  backoffFactor: number;
  maxAttempts: number;
  currentAttempt: number;
}

/**
 * WebSocket Service class for real-time communication - Mobile Controller
 */
export class WebSocketService {
  private config: Required<WebSocketServiceConfig>;
  private socket: WebSocket | null = null;
  private connectionStatus: ConnectionStatus = 'disconnected';
  private eventHandlers: Map<WebSocketEventType, Set<EventHandler>> = new Map();
  private reconnectConfig: ReconnectConfig;
  private reconnectTimeoutId: number | null = null;
  private heartbeatIntervalId: number | null = null;
  private connectionTimeoutId: number | null = null;
  private lastHeartbeat: Date | null = null;
  private circuitBreakerTripped: boolean = false;
  private lastConnectionAttempt: Date | null = null;
  
  // Mobile-specific properties
  private isPageVisible: boolean = true;
  private visibilityChangeHandler: (() => void) | null = null;

  constructor(config: WebSocketServiceConfig) {
    this.config = {
      url: config.url,
      clientType: config.clientType ?? 'controller', // Default to controller for mobile
      reconnectInterval: config.reconnectInterval ?? 2000, // 2 seconds base (longer for mobile)
      maxReconnectInterval: config.maxReconnectInterval ?? 30000, // 30 seconds max
      reconnectBackoffFactor: config.reconnectBackoffFactor ?? 1.5, // Gentler backoff for mobile
      maxReconnectAttempts: config.maxReconnectAttempts ?? 15, // More attempts for mobile
      heartbeatInterval: config.heartbeatInterval ?? 45000, // 45 seconds (longer for mobile battery)
      connectionTimeout: config.connectionTimeout ?? 15000, // 15 seconds (longer for mobile networks)
      // Mobile-specific defaults
      backgroundReconnectDelay: config.backgroundReconnectDelay ?? 5000, // 5 seconds delay when backgrounded
      visibilityChangeReconnect: config.visibilityChangeReconnect ?? true,
    };

    this.reconnectConfig = {
      interval: this.config.reconnectInterval,
      maxInterval: this.config.maxReconnectInterval,
      backoffFactor: this.config.reconnectBackoffFactor,
      maxAttempts: this.config.maxReconnectAttempts,
      currentAttempt: 0,
    };

    // Initialize event handler maps
    this.initializeEventHandlers();
    
    // Set up mobile-specific visibility handling
    this.setupVisibilityHandling();
  }

  /**
   * Connect to WebSocket server with mobile-specific handling
   * Requirements: 5.1, 5.4, 5.5
   */
  async connect(): Promise<void> {
    // Circuit breaker: prevent rapid connection attempts
    const now = new Date();
    if (this.lastConnectionAttempt && (now.getTime() - this.lastConnectionAttempt.getTime()) < 1000) {
      console.warn('WebSocket connection attempt blocked by circuit breaker (< 1s since last attempt)');
      return;
    }
    this.lastConnectionAttempt = now;

    // Check if circuit breaker is tripped
    if (this.circuitBreakerTripped) {
      console.warn('WebSocket circuit breaker is tripped, connection blocked');
      return;
    }

    // Prevent multiple simultaneous connection attempts
    if (this.connectionStatus === 'connected' || this.connectionStatus === 'connecting') {
      console.log('WebSocket already connected or connecting, skipping connection attempt');
      return;
    }

    // Clear any existing reconnection timeout when manually connecting
    this.clearReconnectTimeout();

    this.setConnectionStatus('connecting');
    
    try {
      // Add client type as query parameter
      const url = new URL(this.config.url);
      url.searchParams.set('clientType', this.config.clientType);
      
      this.socket = new WebSocket(url.toString());
      
      // Set connection timeout (longer for mobile)
      this.connectionTimeoutId = window.setTimeout(() => {
        if (this.connectionStatus === 'connecting') {
          this.handleConnectionTimeout();
        }
      }, this.config.connectionTimeout);

      this.setupSocketEventHandlers();

      // Return promise that resolves when connection is established
      return new Promise((resolve, reject) => {
        const onOpen = () => {
          this.clearConnectionTimeout();
          this.setConnectionStatus('connected');
          this.resetReconnectConfig();
          this.startHeartbeat();
          resolve();
        };

        const onError = (_error: Event) => {
          this.clearConnectionTimeout();
          this.setConnectionStatus('error');
          reject(new Error('WebSocket connection failed'));
        };

        if (this.socket) {
          this.socket.addEventListener('open', onOpen, { once: true });
          this.socket.addEventListener('error', onError, { once: true });
        }
      });

    } catch (error) {
      this.clearConnectionTimeout();
      this.setConnectionStatus('error');
      throw error;
    }
  }

  /**
   * Disconnect from WebSocket server
   * Requirements: 5.1
   */
  disconnect(): void {
    this.clearReconnectTimeout();
    this.clearConnectionTimeout();
    this.stopHeartbeat();

    if (this.socket) {
      this.socket.close(1000, 'Client disconnect');
      this.socket = null;
    }

    this.setConnectionStatus('disconnected');
  }

  /**
   * Subscribe to WebSocket events
   * Requirements: 5.1, 5.4, 5.5
   */
  subscribe<T extends WebSocketEvent>(
    eventType: WebSocketEventType,
    handler: EventHandler<T>
  ): void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, new Set());
    }
    
    this.eventHandlers.get(eventType)!.add(handler as EventHandler);
  }

  /**
   * Unsubscribe from WebSocket events
   * Requirements: 5.1, 5.4, 5.5
   */
  unsubscribe<T extends WebSocketEvent>(
    eventType: WebSocketEventType,
    handler: EventHandler<T>
  ): void {
    const handlers = this.eventHandlers.get(eventType);
    if (handlers) {
      handlers.delete(handler as EventHandler);
    }
  }

  /**
   * Get current connection status
   * Requirements: 5.4, 5.5
   */
  getConnectionStatus(): ConnectionStatus {
    return this.connectionStatus;
  }

  /**
   * Check if currently connected
   */
  isConnected(): boolean {
    return this.connectionStatus === 'connected' && this.socket?.readyState === WebSocket.OPEN;
  }

  /**
   * Update service configuration
   */
  updateConfig(newConfig: Partial<WebSocketServiceConfig>): void {
    const wasConnected = this.isConnected();
    
    this.config = {
      ...this.config,
      ...newConfig,
    };

    // Update reconnect config if relevant options changed
    if (newConfig.reconnectInterval !== undefined || 
        newConfig.maxReconnectInterval !== undefined ||
        newConfig.reconnectBackoffFactor !== undefined ||
        newConfig.maxReconnectAttempts !== undefined) {
      this.reconnectConfig = {
        ...this.reconnectConfig,
        interval: newConfig.reconnectInterval ?? this.config.reconnectInterval,
        maxInterval: newConfig.maxReconnectInterval ?? this.config.maxReconnectInterval,
        backoffFactor: newConfig.reconnectBackoffFactor ?? this.config.reconnectBackoffFactor,
        maxAttempts: newConfig.maxReconnectAttempts ?? this.config.maxReconnectAttempts,
      };
    }

    // Reconnect if URL changed and we were connected
    if (newConfig.url && wasConnected) {
      this.disconnect();
      this.connect().catch(error => {
        console.error('Failed to reconnect after config update:', error);
      });
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): WebSocketServiceConfig {
    return { ...this.config };
  }

  /**
   * Mobile-specific: Setup page visibility handling
   * Requirements: 5.4, 5.5
   */
  private setupVisibilityHandling(): void {
    if (!this.config.visibilityChangeReconnect || typeof document === 'undefined') {
      return;
    }

    this.visibilityChangeHandler = () => {
      const isVisible = !document.hidden;
      
      if (isVisible && !this.isPageVisible) {
        // Page became visible - attempt reconnection if disconnected
        console.log('Page became visible, checking connection status');
        this.isPageVisible = true;
        
        if (this.connectionStatus === 'error' || this.connectionStatus === 'disconnected') {
          // Add a small delay to allow network to stabilize
          setTimeout(() => {
            if (this.connectionStatus === 'error' || this.connectionStatus === 'disconnected') {
              console.log('Attempting reconnection after page visibility change');
              this.connect().catch(error => {
                console.error('Failed to reconnect after visibility change:', error);
              });
            }
          }, 1000);
        }
      } else if (!isVisible && this.isPageVisible) {
        // Page became hidden
        console.log('Page became hidden');
        this.isPageVisible = false;
      }
    };

    document.addEventListener('visibilitychange', this.visibilityChangeHandler);
  }

  /**
   * Initialize event handler maps
   */
  private initializeEventHandlers(): void {
    const eventTypes: WebSocketEventType[] = [
      'connection_established',
      'queue_updated',
      'playback_updated',
      'track_added',
      'track_finished',
      'error_occurred',
      'initial_state',
      'heartbeat',
    ];

    eventTypes.forEach(eventType => {
      this.eventHandlers.set(eventType, new Set());
    });
  }

  /**
   * Setup WebSocket event handlers
   */
  private setupSocketEventHandlers(): void {
    if (!this.socket) return;

    this.socket.addEventListener('open', this.handleSocketOpen.bind(this));
    this.socket.addEventListener('message', this.handleSocketMessage.bind(this));
    this.socket.addEventListener('close', this.handleSocketClose.bind(this));
    this.socket.addEventListener('error', this.handleSocketError.bind(this));
  }

  /**
   * Handle WebSocket open event
   */
  private handleSocketOpen(_event: Event): void {
    console.log('WebSocket connected (mobile controller)');
    this.clearConnectionTimeout();
    this.setConnectionStatus('connected');
    this.resetReconnectConfig();
    this.startHeartbeat();
  }

  /**
   * Handle WebSocket message event
   * Requirements: 5.1, 5.4, 5.5
   */
  private handleSocketMessage(event: MessageEvent): void {
    try {
      const data = JSON.parse(event.data);
      
      // Validate event structure
      if (!data.type || !data.timestamp) {
        console.warn('Received invalid WebSocket event:', data);
        return;
      }

      const wsEvent: WebSocketEvent = {
        type: data.type,
        timestamp: data.timestamp,
        sequenceNumber: data.sequenceNumber || 0,
        data: data.data || {},
      };

      // Update last heartbeat time for heartbeat events
      if (wsEvent.type === 'heartbeat') {
        this.lastHeartbeat = new Date();
      }

      // Emit event to subscribers
      this.emitEvent(wsEvent);

    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  }

  /**
   * Handle WebSocket close event with mobile-specific logic
   * Requirements: 5.4, 5.5
   */
  private handleSocketClose(event: CloseEvent): void {
    console.log('WebSocket disconnected (mobile controller):', event.code, event.reason);
    this.stopHeartbeat();
    
    if (event.code === 1000) {
      // Normal closure
      this.setConnectionStatus('disconnected');
    } else if (event.code === 1013 || event.reason.includes('Maximum connections')) {
      // Server rejected connection due to limits - don't reconnect immediately
      console.warn('Connection rejected by server:', event.reason);
      this.setConnectionStatus('error');
      
      // Wait longer before attempting reconnection for server rejections
      this.reconnectConfig.currentAttempt += 2; // Skip ahead in backoff
      this.scheduleReconnect();
    } else {
      // Abnormal closure - attempt reconnection with mobile considerations
      this.setConnectionStatus('error');
      
      // If page is hidden, delay reconnection to save battery
      if (!this.isPageVisible) {
        console.log('Page is hidden, delaying reconnection');
        setTimeout(() => {
          if (this.connectionStatus === 'error') {
            this.scheduleReconnect();
          }
        }, this.config.backgroundReconnectDelay);
      } else {
        this.scheduleReconnect();
      }
    }
  }

  /**
   * Handle WebSocket error event
   * Requirements: 5.4, 5.5
   */
  private handleSocketError(event: Event): void {
    console.error('WebSocket error (mobile controller):', event);
    this.setConnectionStatus('error');
    
    // Don't schedule reconnect here - let close event handle it
  }

  /**
   * Handle connection timeout
   */
  private handleConnectionTimeout(): void {
    console.warn('WebSocket connection timeout (mobile controller)');
    
    if (this.socket) {
      this.socket.close();
    }
    
    this.setConnectionStatus('error');
    this.scheduleReconnect();
  }

  /**
   * Emit event to subscribers
   */
  private emitEvent(event: WebSocketEvent): void {
    const handlers = this.eventHandlers.get(event.type);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(event);
        } catch (error) {
          console.error(`Error in event handler for ${event.type}:`, error);
        }
      });
    }
  }

  /**
   * Set connection status and emit status change events
   */
  private setConnectionStatus(status: ConnectionStatus): void {
    if (this.connectionStatus !== status) {
      this.connectionStatus = status;
      
      // Emit connection status change event
      this.emitEvent({
        type: 'connection_established',
        timestamp: new Date().toISOString(),
        sequenceNumber: 0,
        data: {
          status,
          timestamp: new Date().toISOString(),
        },
      });
    }
  }

  /**
   * Schedule reconnection with exponential backoff - Mobile optimized
   * Requirements: 5.4, 5.5
   */
  private scheduleReconnect(): void {
    if (this.reconnectConfig.currentAttempt >= this.reconnectConfig.maxAttempts) {
      console.error('Max reconnection attempts reached - tripping circuit breaker');
      this.circuitBreakerTripped = true;
      this.setConnectionStatus('error');
      
      // Reset circuit breaker after 5 minutes (mobile-friendly)
      setTimeout(() => {
        console.log('Resetting WebSocket circuit breaker');
        this.circuitBreakerTripped = false;
        this.resetReconnectConfig();
      }, 300000); // 5 minutes
      
      return;
    }

    // Clear any existing reconnection timeout
    this.clearReconnectTimeout();

    this.reconnectConfig.currentAttempt++;
    let delay = Math.min(
      this.reconnectConfig.interval * Math.pow(this.reconnectConfig.backoffFactor, this.reconnectConfig.currentAttempt - 1),
      this.reconnectConfig.maxInterval
    );

    // Add extra delay if page is hidden to save battery
    if (!this.isPageVisible) {
      delay += this.config.backgroundReconnectDelay;
    }

    console.log(`Scheduling reconnection attempt ${this.reconnectConfig.currentAttempt} in ${delay}ms`);
    this.setConnectionStatus('reconnecting');

    this.reconnectTimeoutId = window.setTimeout(() => {
      // Check if we're still in a state that needs reconnection
      if (this.connectionStatus === 'reconnecting' || this.connectionStatus === 'error') {
        this.connect().catch(error => {
          console.error('Reconnection attempt failed:', error);
          // Only schedule another reconnect if we haven't exceeded max attempts
          if (this.reconnectConfig.currentAttempt < this.reconnectConfig.maxAttempts) {
            this.scheduleReconnect();
          }
        });
      }
    }, delay);
  }

  /**
   * Reset reconnection configuration
   */
  private resetReconnectConfig(): void {
    this.reconnectConfig.currentAttempt = 0;
    this.circuitBreakerTripped = false;
    this.clearReconnectTimeout();
  }

  /**
   * Clear reconnection timeout
   */
  private clearReconnectTimeout(): void {
    if (this.reconnectTimeoutId !== null) {
      clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = null;
    }
  }

  /**
   * Clear connection timeout
   */
  private clearConnectionTimeout(): void {
    if (this.connectionTimeoutId !== null) {
      clearTimeout(this.connectionTimeoutId);
      this.connectionTimeoutId = null;
    }
  }

  /**
   * Start heartbeat monitoring - Mobile optimized
   */
  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.lastHeartbeat = new Date();
    
    this.heartbeatIntervalId = window.setInterval(() => {
      const now = new Date();
      const timeSinceLastHeartbeat = now.getTime() - (this.lastHeartbeat?.getTime() || 0);
      
      // If no heartbeat received for 2x the interval, consider connection lost
      // But be more lenient on mobile due to network conditions
      const heartbeatTimeout = this.config.heartbeatInterval * (this.isPageVisible ? 2 : 3);
      
      if (timeSinceLastHeartbeat > heartbeatTimeout) {
        console.warn('Heartbeat timeout - connection may be lost');
        this.handleSocketClose(new CloseEvent('close', { code: 1006, reason: 'Heartbeat timeout' }));
      }
    }, this.config.heartbeatInterval);
  }

  /**
   * Stop heartbeat monitoring
   */
  private stopHeartbeat(): void {
    if (this.heartbeatIntervalId !== null) {
      clearInterval(this.heartbeatIntervalId);
      this.heartbeatIntervalId = null;
    }
    this.lastHeartbeat = null;
  }

  /**
   * Cleanup method for mobile controller
   */
  destroy(): void {
    // Remove visibility change listener
    if (this.visibilityChangeHandler && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.visibilityChangeHandler);
      this.visibilityChangeHandler = null;
    }

    // Disconnect and cleanup
    this.disconnect();
    
    // Clear all event handlers
    this.eventHandlers.clear();
  }
}

/**
 * Create WebSocket service instance with mobile controller defaults
 */
export function createWebSocketService(url: string, config?: Partial<WebSocketServiceConfig>): WebSocketService {
  return new WebSocketService({
    url,
    clientType: 'controller', // Default to controller for mobile
    ...config,
  });
}