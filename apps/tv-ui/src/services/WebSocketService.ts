/**
 * WebSocket Service for TV Display Interface
 * 
 * Handles WebSocket communication with the Party Jukebox server for real-time updates.
 * Provides connection management, event subscription, and automatic reconnection
 * with exponential backoff.
 * 
 * Requirements: 5.5, 6.1, 6.2
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
    upcomingTracks: QueueItem[];
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
 * WebSocket service configuration
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
 * WebSocket Service class for real-time communication
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

  constructor(config: WebSocketServiceConfig) {
    this.config = {
      url: config.url,
      clientType: config.clientType ?? 'display',
      reconnectInterval: config.reconnectInterval ?? 1000, // 1 second base
      maxReconnectInterval: config.maxReconnectInterval ?? 30000, // 30 seconds max
      reconnectBackoffFactor: config.reconnectBackoffFactor ?? 2,
      maxReconnectAttempts: config.maxReconnectAttempts ?? 10,
      heartbeatInterval: config.heartbeatInterval ?? 30000, // 30 seconds
      connectionTimeout: config.connectionTimeout ?? 10000, // 10 seconds
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
  }

  /**
   * Connect to WebSocket server
   * Requirements: 5.5, 6.1
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
      
      // Set connection timeout
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
   * Requirements: 6.1
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
   * Requirements: 5.5, 6.1, 6.2
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
   * Requirements: 5.5, 6.1, 6.2
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
   * Requirements: 6.1, 6.2
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
    console.log('WebSocket connected');
    this.clearConnectionTimeout();
    this.setConnectionStatus('connected');
    this.resetReconnectConfig();
    this.startHeartbeat();
  }

  /**
   * Handle WebSocket message event
   * Requirements: 5.5, 6.1, 6.2
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
   * Handle WebSocket close event
   * Requirements: 6.1, 6.2
   */
  private handleSocketClose(event: CloseEvent): void {
    console.log('WebSocket disconnected:', event.code, event.reason);
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
      // Abnormal closure - attempt reconnection
      this.setConnectionStatus('error');
      this.scheduleReconnect();
    }
  }

  /**
   * Handle WebSocket error event
   * Requirements: 6.1, 6.2
   */
  private handleSocketError(event: Event): void {
    console.error('WebSocket error:', event);
    this.setConnectionStatus('error');
    
    // Don't schedule reconnect here - let close event handle it
  }

  /**
   * Handle connection timeout
   */
  private handleConnectionTimeout(): void {
    console.warn('WebSocket connection timeout');
    
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
   * Schedule reconnection with exponential backoff
   * Requirements: 6.2
   */
  private scheduleReconnect(): void {
    if (this.reconnectConfig.currentAttempt >= this.reconnectConfig.maxAttempts) {
      console.error('Max reconnection attempts reached - tripping circuit breaker');
      this.circuitBreakerTripped = true;
      this.setConnectionStatus('error');
      
      // Reset circuit breaker after 5 minutes
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
    const delay = Math.min(
      this.reconnectConfig.interval * Math.pow(this.reconnectConfig.backoffFactor, this.reconnectConfig.currentAttempt - 1),
      this.reconnectConfig.maxInterval
    );

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
   * Start heartbeat monitoring
   */
  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.lastHeartbeat = new Date();
    
    this.heartbeatIntervalId = window.setInterval(() => {
      const now = new Date();
      const timeSinceLastHeartbeat = now.getTime() - (this.lastHeartbeat?.getTime() || 0);
      
      // If no heartbeat received for 2x the interval, consider connection lost
      if (timeSinceLastHeartbeat > this.config.heartbeatInterval * 2) {
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
}

/**
 * Create WebSocket service instance with default configuration
 */
export function createWebSocketService(url: string, config?: Partial<WebSocketServiceConfig>): WebSocketService {
  return new WebSocketService({
    url,
    ...config,
  });
}