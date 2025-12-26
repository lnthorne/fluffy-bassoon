/**
 * WebSocket Server Infrastructure
 * 
 * Real-time communication server using Fastify WebSocket plugin for
 * bidirectional communication with controller and display clients.
 * 
 * Requirements: 5.1, 5.4, 5.5
 */

import { FastifyInstance, FastifyRequest } from 'fastify';
import { WebSocketConnection, WebSocketEvent, ClientType } from './types';
import { ClientManager } from './ClientManager';
import { MessageHandler } from './MessageHandler';

export interface WebSocketServerConfig {
  heartbeatInterval: number; // milliseconds
  connectionTimeout: number; // milliseconds
  maxConnections: number;
}

export interface WebSocketServerDependencies {
  // Future: EventBroadcaster will be added here
}

export class WebSocketServer {
  private fastify: FastifyInstance | null = null;
  private clientManager: ClientManager;
  private messageHandler: MessageHandler;
  private config: WebSocketServerConfig;
  private dependencies: WebSocketServerDependencies | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;

  constructor(config: WebSocketServerConfig) {
    this.config = config;
    this.clientManager = new ClientManager();
    this.messageHandler = new MessageHandler();
  }

  /**
   * Initialize WebSocket server with Fastify instance
   * Requirements: 5.1
   */
  async initialize(
    fastify: FastifyInstance, 
    dependencies?: WebSocketServerDependencies
  ): Promise<void> {
    try {
      this.fastify = fastify;
      this.dependencies = dependencies || null;

      // Register WebSocket route at /ws
      await this.fastify.register(async (fastifyInstance) => {
        fastifyInstance.get('/ws', { websocket: true }, this.handleWebSocketConnection.bind(this));
      });

      // Start heartbeat monitoring
      this.startHeartbeatMonitoring();

      console.log('✅ WebSocket server initialized at /ws endpoint');
      console.log(`   - Max connections: ${this.config.maxConnections}`);
      console.log(`   - Heartbeat interval: ${this.config.heartbeatInterval}ms`);
      console.log(`   - Connection timeout: ${this.config.connectionTimeout}ms`);
    } catch (error) {
      console.error('Failed to initialize WebSocket server:', error);
      throw error;
    }
  }

  /**
   * Handle new WebSocket connections
   * Requirements: 5.1, 5.4, 5.5
   */
  private async handleWebSocketConnection(
    connection: any,
    request: FastifyRequest
  ): Promise<void> {
    try {
      // Check connection limits
      if (this.clientManager.getConnectionCount() >= this.config.maxConnections) {
        console.warn('WebSocket connection rejected: Maximum connections reached');
        if (connection && connection.close) {
          connection.close(1013, 'Server overloaded');
        }
        return;
      }

      // Extract client information from request
      const clientIP = request.ip;
      const userAgent = request.headers['user-agent'] || 'Unknown';
      const clientType = this.detectClientType(request);

      // Create WebSocket connection object
      const wsConnection: WebSocketConnection = {
        id: this.generateClientId(),
        socket: connection, // Use connection directly, not connection.socket
        clientType,
        connectedAt: new Date(),
        lastActivity: new Date(),
        clientIP,
        userAgent,
        isAlive: true,
      };

      // Register client with manager
      this.clientManager.addClient(wsConnection);

      console.log(`📱 WebSocket client connected: ${wsConnection.id} (${clientType}) from ${clientIP}`);

      // Set up connection event handlers
      this.setupConnectionHandlers(wsConnection);

      // Send initial connection acknowledgment
      await this.sendConnectionAcknowledgment(wsConnection);

    } catch (error) {
      console.error('Error handling WebSocket connection:', error);
      if (connection && connection.close) {
        connection.close(1011, 'Internal server error');
      }
    }
  }

  /**
   * Set up event handlers for a WebSocket connection
   * Requirements: 5.4, 5.5
   */
  private setupConnectionHandlers(connection: WebSocketConnection): void {
    const { socket } = connection;

    // Ensure socket exists and has the required methods
    if (!socket || typeof socket.on !== 'function') {
      console.error('Invalid WebSocket connection object');
      return;
    }

    // Handle incoming messages
    socket.on('message', async (data: Buffer) => {
      try {
        connection.lastActivity = new Date();
        await this.messageHandler.handleMessage(connection, data);
      } catch (error) {
        console.error(`Error handling message from client ${connection.id}:`, error);
        await this.sendErrorMessage(connection, 'Message processing failed');
      }
    });

    // Handle pong responses (for heartbeat)
    socket.on('pong', () => {
      connection.isAlive = true;
      connection.lastActivity = new Date();
    });

    // Handle connection close
    socket.on('close', (code: number, reason: Buffer) => {
      console.log(`📱 WebSocket client disconnected: ${connection.id} (code: ${code}, reason: ${reason.toString()})`);
      this.clientManager.removeClient(connection.id);
    });

    // Handle connection errors
    socket.on('error', (error: Error) => {
      console.error(`WebSocket error for client ${connection.id}:`, error);
      this.clientManager.removeClient(connection.id);
    });
  }

  /**
   * Detect client type from request headers
   * Requirements: 5.1
   */
  private detectClientType(request: FastifyRequest): ClientType {
    const userAgent = request.headers['user-agent']?.toLowerCase() || '';
    const referer = request.headers.referer || '';

    // Check if request comes from display page
    if (referer.includes('/display')) {
      return 'display';
    }

    // Check user agent for TV/display indicators
    if (userAgent.includes('tv') || 
        userAgent.includes('chromecast') || 
        userAgent.includes('roku') ||
        userAgent.includes('smart')) {
      return 'display';
    }

    // Default to controller for mobile/desktop browsers
    return 'controller';
  }

  /**
   * Generate unique client ID
   * Requirements: 5.1
   */
  private generateClientId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `client_${timestamp}_${random}`;
  }

  /**
   * Send connection acknowledgment to newly connected client
   * Requirements: 5.1
   */
  private async sendConnectionAcknowledgment(connection: WebSocketConnection): Promise<void> {
    const acknowledgment: WebSocketEvent = {
      type: 'connection_established',
      timestamp: new Date(),
      sequenceNumber: 0,
      data: {
        clientId: connection.id,
        clientType: connection.clientType,
        serverInfo: {
          version: '1.0.0',
          capabilities: ['queue_updates', 'playback_updates', 'heartbeat'],
          heartbeatInterval: this.config.heartbeatInterval,
        },
      },
    };

    await this.sendToClient(connection, acknowledgment);
  }

  /**
   * Send error message to client
   * Requirements: 5.5
   */
  private async sendErrorMessage(connection: WebSocketConnection, message: string): Promise<void> {
    const errorEvent: WebSocketEvent = {
      type: 'error_occurred',
      timestamp: new Date(),
      sequenceNumber: 0,
      data: {
        error: {
          code: 'WEBSOCKET_ERROR',
          message,
          timestamp: new Date().toISOString(),
        },
      },
    };

    await this.sendToClient(connection, errorEvent);
  }

  /**
   * Send message to specific client
   * Requirements: 5.1, 5.4
   */
  private async sendToClient(connection: WebSocketConnection, event: WebSocketEvent): Promise<void> {
    try {
      if (connection.socket && connection.socket.readyState === 1) { // 1 = OPEN
        const message = JSON.stringify(event);
        connection.socket.send(message);
      }
    } catch (error) {
      console.error(`Failed to send message to client ${connection.id}:`, error);
      this.clientManager.removeClient(connection.id);
    }
  }

  /**
   * Broadcast message to all connected clients
   * Requirements: 5.1
   */
  async broadcast(event: WebSocketEvent): Promise<void> {
    const clients = this.clientManager.getAllClients();
    const promises = clients.map(client => this.sendToClient(client, event));
    
    try {
      await Promise.allSettled(promises);
    } catch (error) {
      console.error('Error during broadcast:', error);
    }
  }

  /**
   * Broadcast message to clients of specific type
   * Requirements: 5.1
   */
  async broadcastToType(event: WebSocketEvent, clientType: ClientType): Promise<void> {
    const clients = this.clientManager.getClientsByType(clientType);
    const promises = clients.map(client => this.sendToClient(client, event));
    
    try {
      await Promise.allSettled(promises);
    } catch (error) {
      console.error(`Error broadcasting to ${clientType} clients:`, error);
    }
  }

  /**
   * Start heartbeat monitoring to detect inactive connections
   * Requirements: 5.4, 5.5
   */
  private startHeartbeatMonitoring(): void {
    this.heartbeatTimer = setInterval(() => {
      this.performHeartbeatCheck();
    }, this.config.heartbeatInterval);
  }

  /**
   * Perform heartbeat check on all connections
   * Requirements: 5.4, 5.5
   */
  private performHeartbeatCheck(): void {
    const clients = this.clientManager.getAllClients();
    const now = new Date();

    for (const client of clients) {
      // Check if client has been inactive too long
      const inactiveTime = now.getTime() - client.lastActivity.getTime();
      
      if (inactiveTime > this.config.connectionTimeout) {
        console.log(`Removing inactive client: ${client.id} (inactive for ${inactiveTime}ms)`);
        if (client.socket && typeof client.socket.terminate === 'function') {
          client.socket.terminate();
        }
        this.clientManager.removeClient(client.id);
        continue;
      }

      // Send ping to check if client is still alive
      if (client.socket && client.socket.readyState === 1) { // 1 = OPEN
        if (!client.isAlive) {
          // Client didn't respond to previous ping
          console.log(`Terminating unresponsive client: ${client.id}`);
          if (typeof client.socket.terminate === 'function') {
            client.socket.terminate();
          }
          this.clientManager.removeClient(client.id);
        } else {
          // Send ping and mark as not alive until pong is received
          client.isAlive = false;
          if (typeof client.socket.ping === 'function') {
            client.socket.ping();
          }
        }
      }
    }
  }

  /**
   * Get connected clients information
   * Requirements: 5.1
   */
  getConnectedClients(): WebSocketConnection[] {
    return this.clientManager.getAllClients();
  }

  /**
   * Get connection statistics
   * Requirements: 5.1
   */
  getConnectionStats(): {
    totalConnections: number;
    controllerConnections: number;
    displayConnections: number;
    maxConnections: number;
  } {
    const allClients = this.clientManager.getAllClients();
    const controllerClients = this.clientManager.getClientsByType('controller');
    const displayClients = this.clientManager.getClientsByType('display');

    return {
      totalConnections: allClients.length,
      controllerConnections: controllerClients.length,
      displayConnections: displayClients.length,
      maxConnections: this.config.maxConnections,
    };
  }

  /**
   * Shutdown WebSocket server gracefully
   * Requirements: 5.5
   */
  async shutdown(): Promise<void> {
    try {
      // Stop heartbeat monitoring
      if (this.heartbeatTimer) {
        clearInterval(this.heartbeatTimer);
        this.heartbeatTimer = null;
      }

      // Close all client connections gracefully
      const clients = this.clientManager.getAllClients();
      for (const client of clients) {
        if (client.socket && client.socket.readyState === 1) { // 1 = OPEN
          client.socket.close(1001, 'Server shutting down');
        }
      }

      // Clear client manager
      this.clientManager.clear();

      console.log('WebSocket server shut down gracefully');
    } catch (error) {
      console.error('Error during WebSocket server shutdown:', error);
      throw error;
    }
  }
}