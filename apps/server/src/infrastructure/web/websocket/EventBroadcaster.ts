/**
 * Event Broadcaster for Real-Time Updates
 * 
 * Manages real-time event distribution to WebSocket clients, converting backend
 * events to WebSocket messages and handling initial state synchronization.
 * 
 * Requirements: 5.2, 5.3, 5.7, 6.1, 6.2, 6.4, 6.6, 6.7
 */

import { EventEmitter } from 'events';
import { QueueItem, QueueState } from '@party-jukebox/shared';
import { PlaybackState, PlaybackEvent } from '../../../domain/playback/types';
import { IQueueService } from '../../../application/QueueService';
import { IPlaybackOrchestrator } from '../../../domain/playback/interfaces';
import { 
  WebSocketEvent, 
  QueueUpdateEvent, 
  PlaybackUpdateEvent, 
  TrackAddedEvent, 
  TrackFinishedEvent, 
  InitialStateEvent, 
  HeartbeatEvent,
  ClientFilter,
  ClientType,
  WebSocketConnection
} from './types';
import { ClientManager } from './ClientManager';

export interface EventBroadcasterConfig {
  heartbeatInterval: number; // milliseconds
  maxBroadcastTime: number; // milliseconds - requirement for <100ms delivery
  enableEventMetadata: boolean;
}

export interface EventBroadcasterDependencies {
  queueService: IQueueService;
  playbackOrchestrator: IPlaybackOrchestrator;
  clientManager: ClientManager;
}

/**
 * EventBroadcaster implementation for real-time WebSocket updates
 * Requirements: 5.2, 5.3, 5.7, 6.1, 6.2, 6.4, 6.6, 6.7
 */
export class EventBroadcaster extends EventEmitter {
  private config: EventBroadcasterConfig;
  private dependencies: EventBroadcasterDependencies;
  private sequenceNumber: number = 0;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private isInitialized: boolean = false;
  private lastPlaybackState: PlaybackState | null = null; // Track last broadcast state
  private lastBroadcastTime: number = 0; // Track when we last broadcast

  constructor(
    config: EventBroadcasterConfig,
    dependencies: EventBroadcasterDependencies
  ) {
    super();
    this.config = config;
    this.dependencies = dependencies;
  }

  /**
   * Initialize the EventBroadcaster and subscribe to system events
   * Requirements: 5.2, 5.3, 6.1, 6.2
   */
  initialize(): void {
    if (this.isInitialized) {
      return;
    }

    try {
      // Subscribe to backend service events
      this.subscribeToSystemEvents();

      // Start heartbeat broadcasting
      this.startHeartbeatBroadcasting();

      this.isInitialized = true;
      console.log('✅ EventBroadcaster initialized successfully');
      console.log(`   - Heartbeat interval: ${this.config.heartbeatInterval}ms`);
      console.log(`   - Max broadcast time: ${this.config.maxBroadcastTime}ms`);
    } catch (error) {
      console.error('Failed to initialize EventBroadcaster:', error);
      throw error;
    }
  }

  /**
   * Subscribe to system events from backend services
   * Requirements: 6.1, 6.2
   */
  private subscribeToSystemEvents(): void {
    // Subscribe to PlaybackOrchestrator events
    this.dependencies.playbackOrchestrator.addEventListener((event: PlaybackEvent) => {
      this.handlePlaybackEvent(event);
    });

    console.log('📡 Subscribed to PlaybackOrchestrator events');
    
    // Note: QueueService doesn't currently emit events directly
    // In a future iteration, we would subscribe to queue events here
    // For now, we'll handle queue updates through playback state changes
  }

  /**
   * Handle playback events from PlaybackOrchestrator
   * Requirements: 5.3, 6.2
   */
  private async handlePlaybackEvent(event: PlaybackEvent): Promise<void> {
    try {
      console.log(`🎵 EventBroadcaster received event: ${event.type}`);
      
      switch (event.type) {
        case 'state_changed':
        case 'progress_update':
          if (event.data.state) {
            // Handle both state_changed and progress_update the same way
            // Only broadcast progress updates if there's meaningful change
            const state = event.data.state;
            if (state.status !== 'idle' || state.currentTrack || this.lastPlaybackState?.status !== 'idle') {
              console.log(`   → Broadcasting playback update for ${event.type}`);
              await this.broadcastPlaybackUpdate(state);
            } else {
              console.log(`   → Skipping ${event.type} - no meaningful change`);
            }
          }
          break;

        case 'track_started':
          if (event.data.track && event.data.state) {
            // Don't broadcast playback update here - it will be handled by state_changed event
            // Just broadcast queue update since current track changed
            console.log('   → Broadcasting queue update for track_started');
            await this.broadcastQueueUpdate();
          }
          break;

        case 'track_finished':
          if (event.data.track) {
            console.log('   → Broadcasting track finished');
            await this.broadcastTrackFinished(event.data.track, 'completed');
            // Broadcast updated queue state
            await this.broadcastQueueUpdate();
          }
          break;

        case 'track_failed':
          if (event.data.track && event.data.error) {
            console.log('   → Broadcasting track failed');
            await this.broadcastTrackFinished(event.data.track, 'error');
            // Broadcast updated queue state
            await this.broadcastQueueUpdate();
          }
          break;

        case 'error_occurred':
          if (event.data.error) {
            console.log('   → Broadcasting error occurred');
            await this.broadcastError(event.data.error, event.data.state);
          }
          break;
      }
    } catch (error) {
      console.error('Error handling playback event:', error);
    }
  }

  /**
   * Broadcast queue update to all connected clients
   * Requirements: 5.2, 6.1
   */
  async broadcastQueueUpdate(queueState?: QueueState): Promise<void> {
    try {
      const startTime = Date.now();
      
      // Get current queue state if not provided
      const currentQueueState = queueState || this.dependencies.queueService.getQueueState();

      const event: QueueUpdateEvent = {
        type: 'queue_updated',
        timestamp: new Date(),
        sequenceNumber: this.getNextSequenceNumber(),
        data: {
          currentTrack: currentQueueState.currentTrack,
          upcomingTracks: [...currentQueueState.upcomingTracks],
          totalLength: currentQueueState.totalLength,
          isEmpty: currentQueueState.isEmpty,
        },
      };

      await this.broadcastToAllClients(event);

      const broadcastTime = Date.now() - startTime;
      if (broadcastTime > this.config.maxBroadcastTime) {
        console.warn(`Queue update broadcast took ${broadcastTime}ms (exceeds ${this.config.maxBroadcastTime}ms limit)`);
      }

    } catch (error) {
      console.error('Error broadcasting queue update:', error);
    }
  }

  /**
   * Broadcast playback update to all connected clients
   * Requirements: 5.3, 6.2
   */
  async broadcastPlaybackUpdate(playbackState: PlaybackState): Promise<void> {
    try {
      const now = Date.now();
      
      // Skip broadcast if state hasn't meaningfully changed
      if (this.lastPlaybackState && this.isPlaybackStateEqual(this.lastPlaybackState, playbackState)) {
        console.log('   ⏭️  Skipping duplicate playback update - no meaningful change');
        return;
      }

      // Additional protection: prevent rapid-fire duplicates within 50ms
      if (now - this.lastBroadcastTime < 50) {
        console.log('   ⏭️  Skipping rapid duplicate playback update - too soon');
        return;
      }

      const startTime = Date.now();

      const event: PlaybackUpdateEvent = {
        type: 'playback_updated',
        timestamp: new Date(),
        sequenceNumber: this.getNextSequenceNumber(),
        data: {
          status: playbackState.status,
          currentTrack: playbackState.currentTrack,
          position: playbackState.position,
          duration: playbackState.duration,
          volume: playbackState.volume,
          error: playbackState.error,
        },
      };

      console.log(`   📡 Broadcasting playback_updated: ${playbackState.status}, track: ${playbackState.currentTrack?.track?.title || 'none'}, pos: ${playbackState.position.toFixed(1)}s`);
      await this.broadcastToAllClients(event);

      // Store the last broadcast state and time
      this.lastPlaybackState = { ...playbackState };
      this.lastBroadcastTime = now;

      const broadcastTime = Date.now() - startTime;
      if (broadcastTime > this.config.maxBroadcastTime) {
        console.warn(`Playback update broadcast took ${broadcastTime}ms (exceeds ${this.config.maxBroadcastTime}ms limit)`);
      }

    } catch (error) {
      console.error('Error broadcasting playback update:', error);
    }
  }

  /**
   * Broadcast track added event to all connected clients
   * Requirements: 5.2, 6.1
   */
  async broadcastTrackAdded(track: QueueItem, queuePosition: number): Promise<void> {
    try {
      console.log('🔥 EventBroadcaster: Broadcasting track added event');
      console.log('   - Track:', track.track.title, 'by', track.track.artist);
      console.log('   - Queue Position:', queuePosition);
      console.log('   - Connected Clients:', this.dependencies.clientManager.getConnectionCount());

      const event: TrackAddedEvent = {
        type: 'track_added',
        timestamp: new Date(),
        sequenceNumber: this.getNextSequenceNumber(),
        data: {
          track,
          queuePosition,
          addedBy: {
            nickname: track.addedBy.nickname,
          },
        },
      };

      await this.broadcastToAllClients(event);
      console.log('   ✅ Track added event broadcast complete');

      // Also broadcast updated queue state
      await this.broadcastQueueUpdate();

    } catch (error) {
      console.error('❌ Error broadcasting track added:', error);
    }
  }

  /**
   * Broadcast track finished event to all connected clients
   * Requirements: 5.3, 6.2
   */
  async broadcastTrackFinished(
    finishedTrack: QueueItem, 
    reason: 'completed' | 'skipped' | 'error'
  ): Promise<void> {
    try {
      // Get the next track from current queue state
      const queueState = this.dependencies.queueService.getQueueState();
      const nextTrack = queueState.currentTrack;

      const event: TrackFinishedEvent = {
        type: 'track_finished',
        timestamp: new Date(),
        sequenceNumber: this.getNextSequenceNumber(),
        data: {
          finishedTrack,
          nextTrack,
          reason,
        },
      };

      await this.broadcastToAllClients(event);

    } catch (error) {
      console.error('Error broadcasting track finished:', error);
    }
  }

  /**
   * Broadcast error event to all connected clients
   * Requirements: 7.2, 7.6
   */
  async broadcastError(error: string, playbackState?: PlaybackState): Promise<void> {
    try {
      const event: WebSocketEvent = {
        type: 'error_occurred',
        timestamp: new Date(),
        sequenceNumber: this.getNextSequenceNumber(),
        data: {
          error: {
            code: 'PLAYBACK_ERROR',
            message: error,
            timestamp: new Date().toISOString(),
            details: playbackState ? { playbackState } : undefined,
          },
        },
      };

      await this.broadcastToAllClients(event);

    } catch (error) {
      console.error('Error broadcasting error:', error);
    }
  }

  /**
   * Send initial state synchronization to a newly connected client
   * Requirements: 6.4
   */
  async sendInitialState(clientId: string): Promise<void> {
    try {
      const client = this.dependencies.clientManager.getClient(clientId);
      if (!client) {
        console.warn(`Cannot send initial state: client ${clientId} not found`);
        return;
      }

      // Get current system state
      const queueState = this.dependencies.queueService.getQueueState();
      const playbackState = this.dependencies.playbackOrchestrator.getCurrentState();

      const event: InitialStateEvent = {
        type: 'initial_state',
        timestamp: new Date(),
        sequenceNumber: this.getNextSequenceNumber(),
        data: {
          queue: {
            currentTrack: queueState.currentTrack,
            upcomingTracks: [...queueState.upcomingTracks],
            totalLength: queueState.totalLength,
            isEmpty: queueState.isEmpty,
          },
          playback: {
            status: playbackState.status,
            currentTrack: playbackState.currentTrack,
            position: playbackState.position,
            duration: playbackState.duration,
            volume: playbackState.volume,
            error: playbackState.error,
          },
          serverTime: new Date().toISOString(),
        },
      };

      await this.sendToClient(client, event);
      console.log(`📤 Initial state sent to client ${clientId} (${client.clientType})`);

    } catch (error) {
      console.error(`Error sending initial state to client ${clientId}:`, error);
    }
  }

  /**
   * Start heartbeat broadcasting to maintain connection health
   * Requirements: 5.4, 5.5, 5.6
   */
  private startHeartbeatBroadcasting(): void {
    if (this.heartbeatTimer) {
      return;
    }

    this.heartbeatTimer = setInterval(async () => {
      try {
        const event: HeartbeatEvent = {
          type: 'heartbeat',
          timestamp: new Date(),
          sequenceNumber: this.getNextSequenceNumber(),
          data: {
            serverTime: new Date().toISOString(),
            clientCount: this.dependencies.clientManager.getConnectionCount(),
          },
        };

        await this.broadcastToAllClients(event);
      } catch (error) {
        console.error('Error sending heartbeat:', error);
      }
    }, this.config.heartbeatInterval);
  }

  /**
   * Broadcast event to all connected clients
   * Requirements: 5.2, 5.3, 6.3
   */
  private async broadcastToAllClients(event: WebSocketEvent): Promise<void> {
    const clients = this.dependencies.clientManager.getAllClients();
    console.log(`📡 Broadcasting ${event.type} to ${clients.length} clients`);
    
    if (clients.length === 0) {
      console.log('⚠️  No clients connected to receive broadcast');
      return;
    }

    const promises = clients.map((client, index) => {
      console.log(`   - Sending to client ${index + 1}: ${client.id} (${client.clientType})`);
      return this.sendToClient(client, event);
    });
    
    try {
      const results = await Promise.allSettled(promises);
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      
      console.log(`   ✅ Broadcast complete: ${successful} successful, ${failed} failed`);
      
      if (failed > 0) {
        console.log('   ❌ Failed broadcasts:', results.filter(r => r.status === 'rejected').map(r => r.reason));
      }
    } catch (error) {
      console.error('❌ Error during broadcast to all clients:', error);
    }
  }

  /**
   * Broadcast event to clients of specific type
   * Requirements: 6.7
   */
  async broadcastToClientType(event: WebSocketEvent, clientType: ClientType): Promise<void> {
    const clients = this.dependencies.clientManager.getClientsByType(clientType);
    const promises = clients.map(client => this.sendToClient(client, event));
    
    try {
      await Promise.allSettled(promises);
    } catch (error) {
      console.error(`Error broadcasting to ${clientType} clients:`, error);
    }
  }

  /**
   * Broadcast event with client filtering
   * Requirements: 6.7
   */
  async broadcastWithFilter(event: WebSocketEvent, filter: ClientFilter): Promise<void> {
    let clients = this.dependencies.clientManager.getAllClients();

    // Apply client type filter
    if (filter.clientType) {
      clients = clients.filter(client => client.clientType === filter.clientType);
    }

    // Apply exclude filter
    if (filter.excludeClientIds && filter.excludeClientIds.length > 0) {
      const excludeSet = new Set(filter.excludeClientIds);
      clients = clients.filter(client => !excludeSet.has(client.id));
    }

    // Apply include filter
    if (filter.includeClientIds && filter.includeClientIds.length > 0) {
      const includeSet = new Set(filter.includeClientIds);
      clients = clients.filter(client => includeSet.has(client.id));
    }

    const promises = clients.map(client => this.sendToClient(client, event));
    
    try {
      await Promise.allSettled(promises);
    } catch (error) {
      console.error('Error broadcasting with filter:', error);
    }
  }

  /**
   * Send event to specific client
   * Requirements: 5.1, 5.4
   */
  private async sendToClient(client: WebSocketConnection, event: WebSocketEvent): Promise<void> {
    try {
      if (client.socket && client.socket.readyState === 1) { // 1 = OPEN
        const message = JSON.stringify(event);
        console.log(`   📤 Sending ${event.type} to client ${client.id}: ${message.substring(0, 100)}...`);
        client.socket.send(message);
        console.log(`   ✅ Message sent successfully to ${client.id}`);
      } else {
        console.log(`   ⚠️  Client ${client.id} socket not ready (readyState: ${client.socket?.readyState})`);
        // Remove client if socket is not open
        this.dependencies.clientManager.removeClient(client.id);
      }
    } catch (error) {
      console.error(`❌ Failed to send event to client ${client.id}:`, error);
      // Remove client if send fails
      this.dependencies.clientManager.removeClient(client.id);
    }
  }

  /**
   * Get next sequence number for event ordering
   * Requirements: 6.6
   */
  private getNextSequenceNumber(): number {
    return ++this.sequenceNumber;
  }

  /**
   * Get current sequence number
   * Requirements: 6.6
   */
  getCurrentSequenceNumber(): number {
    return this.sequenceNumber;
  }

  /**
   * Get broadcasting statistics
   * Requirements: 5.2, 5.3
   */
  getBroadcastStats(): {
    sequenceNumber: number;
    connectedClients: number;
    heartbeatInterval: number;
    isInitialized: boolean;
  } {
    return {
      sequenceNumber: this.sequenceNumber,
      connectedClients: this.dependencies.clientManager.getConnectionCount(),
      heartbeatInterval: this.config.heartbeatInterval,
      isInitialized: this.isInitialized,
    };
  }

  /**
   * Shutdown the EventBroadcaster gracefully
   * Requirements: 5.5
   */
  async shutdown(): Promise<void> {
    try {
      // Stop heartbeat broadcasting
      if (this.heartbeatTimer) {
        clearInterval(this.heartbeatTimer);
        this.heartbeatTimer = null;
      }

      // Remove all event listeners
      this.removeAllListeners();

      this.isInitialized = false;
      console.log('EventBroadcaster shut down gracefully');
    } catch (error) {
      console.error('Error during EventBroadcaster shutdown:', error);
      throw error;
    }
  }

  /**
   * Check if two playback states are meaningfully equal
   * (ignores minor position changes during playback)
   */
  private isPlaybackStateEqual(state1: PlaybackState, state2: PlaybackState): boolean {
    // Always broadcast if status changed
    if (state1.status !== state2.status) {
      console.log(`   🔄 Status changed: ${state1.status} → ${state2.status}`);
      return false;
    }

    // Always broadcast if track changed (including null changes)
    const track1Id = state1.currentTrack?.id;
    const track2Id = state2.currentTrack?.id;
    if (track1Id !== track2Id) {
      console.log(`   🔄 Track changed: ${track1Id || 'null'} → ${track2Id || 'null'}`);
      return false;
    }

    // Always broadcast if volume changed
    if (state1.volume !== state2.volume) {
      console.log(`   🔄 Volume changed: ${state1.volume} → ${state2.volume}`);
      return false;
    }

    // Always broadcast if duration changed significantly
    if (Math.abs(state1.duration - state2.duration) > 1) {
      console.log(`   🔄 Duration changed: ${state1.duration} → ${state2.duration}`);
      return false;
    }

    // Always broadcast if error state changed
    if (state1.error !== state2.error) {
      console.log(`   🔄 Error changed: ${state1.error || 'none'} → ${state2.error || 'none'}`);
      return false;
    }

    // For position changes, broadcast every second when playing for smooth updates
    const positionDiff = Math.abs(state1.position - state2.position);
    if (state1.status === 'playing') {
      // When playing, broadcast position changes every ~1 second for smooth progress
      if (positionDiff >= 0.5) { // Allow updates every 0.5 seconds or more
        console.log(`   🔄 Position update while playing: ${state1.position.toFixed(1)} → ${state2.position.toFixed(1)}`);
        return false;
      }
    } else {
      // When not playing, position should be stable (allow 0.1s tolerance)
      if (positionDiff > 0.1) {
        console.log(`   🔄 Position changed while not playing: ${state1.position.toFixed(1)} → ${state2.position.toFixed(1)}`);
        return false;
      }
    }

    // States are considered equal
    return true;
  }

  /**
   * Force broadcast queue update (for external triggers like API calls)
   * Requirements: 5.2, 6.1
   */
  async triggerQueueUpdate(): Promise<void> {
    await this.broadcastQueueUpdate();
  }

  /**
   * Force broadcast playback update (for external triggers like API calls)
   * Requirements: 5.3, 6.2
   */
  async triggerPlaybackUpdate(): Promise<void> {
    const playbackState = this.dependencies.playbackOrchestrator.getCurrentState();
    await this.broadcastPlaybackUpdate(playbackState);
  }
}