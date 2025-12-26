/**
 * Client Manager for WebSocket Connections
 * 
 * Manages WebSocket client connections including registration, deregistration,
 * client type filtering, and inactive client cleanup with heartbeat monitoring.
 * 
 * Requirements: 5.6, 6.3, 6.5, 6.7
 */

import { WebSocketConnection, ClientType } from './types';

export class ClientManager {
  private clients: Map<string, WebSocketConnection> = new Map();
  private connectionsByType: Map<ClientType, Set<string>> = new Map();

  constructor() {
    // Initialize client type maps
    this.connectionsByType.set('controller', new Set());
    this.connectionsByType.set('display', new Set());
  }

  /**
   * Add a new client connection
   * Requirements: 5.6, 6.3
   */
  addClient(connection: WebSocketConnection): void {
    try {
      // Store client connection
      this.clients.set(connection.id, connection);

      // Add to type-specific tracking
      const typeSet = this.connectionsByType.get(connection.clientType);
      if (typeSet) {
        typeSet.add(connection.id);
      }

      console.log(`Client registered: ${connection.id} (${connection.clientType})`);
      console.log(`Total connections: ${this.clients.size}`);
    } catch (error) {
      console.error(`Error adding client ${connection.id}:`, error);
      throw error;
    }
  }

  /**
   * Remove a client connection
   * Requirements: 5.6, 6.5
   */
  removeClient(clientId: string): boolean {
    try {
      const connection = this.clients.get(clientId);
      if (!connection) {
        return false;
      }

      // Remove from main clients map
      this.clients.delete(clientId);

      // Remove from type-specific tracking
      const typeSet = this.connectionsByType.get(connection.clientType);
      if (typeSet) {
        typeSet.delete(clientId);
      }

      // Close socket if still open
      if (connection.socket && connection.socket.readyState === 1) { // 1 = OPEN
        connection.socket.close(1000, 'Client removed');
      }

      console.log(`Client removed: ${clientId} (${connection.clientType})`);
      console.log(`Total connections: ${this.clients.size}`);
      
      return true;
    } catch (error) {
      console.error(`Error removing client ${clientId}:`, error);
      return false;
    }
  }

  /**
   * Get a specific client connection
   * Requirements: 6.3
   */
  getClient(clientId: string): WebSocketConnection | null {
    return this.clients.get(clientId) || null;
  }

  /**
   * Get all connected clients
   * Requirements: 6.3, 6.7
   */
  getAllClients(): WebSocketConnection[] {
    return Array.from(this.clients.values());
  }

  /**
   * Get clients by type (controller or display)
   * Requirements: 6.3, 6.7
   */
  getClientsByType(clientType: ClientType): WebSocketConnection[] {
    const clientIds = this.connectionsByType.get(clientType);
    if (!clientIds) {
      return [];
    }

    const clients: WebSocketConnection[] = [];
    for (const clientId of clientIds) {
      const client = this.clients.get(clientId);
      if (client) {
        clients.push(client);
      }
    }

    return clients;
  }

  /**
   * Get connection count
   * Requirements: 5.6
   */
  getConnectionCount(): number {
    return this.clients.size;
  }

  /**
   * Get connection count by type
   * Requirements: 6.3
   */
  getConnectionCountByType(clientType: ClientType): number {
    const typeSet = this.connectionsByType.get(clientType);
    return typeSet ? typeSet.size : 0;
  }

  /**
   * Clean up inactive clients based on heartbeat monitoring
   * Requirements: 6.5, 6.7
   */
  cleanupInactiveClients(timeoutMs: number = 60000): number {
    const now = new Date();
    const inactiveClients: string[] = [];

    // Find inactive clients
    for (const [clientId, connection] of this.clients) {
      const inactiveTime = now.getTime() - connection.lastActivity.getTime();
      
      if (inactiveTime > timeoutMs) {
        inactiveClients.push(clientId);
      }
    }

    // Remove inactive clients
    let removedCount = 0;
    for (const clientId of inactiveClients) {
      if (this.removeClient(clientId)) {
        removedCount++;
      }
    }

    if (removedCount > 0) {
      console.log(`Cleaned up ${removedCount} inactive clients`);
    }

    return removedCount;
  }

  /**
   * Update client activity timestamp
   * Requirements: 6.5
   */
  updateClientActivity(clientId: string): boolean {
    const client = this.clients.get(clientId);
    if (client) {
      client.lastActivity = new Date();
      return true;
    }
    return false;
  }

  /**
   * Mark client as alive (for heartbeat monitoring)
   * Requirements: 6.5
   */
  markClientAlive(clientId: string): boolean {
    const client = this.clients.get(clientId);
    if (client) {
      client.isAlive = true;
      client.lastActivity = new Date();
      return true;
    }
    return false;
  }

  /**
   * Mark client as not alive (for heartbeat monitoring)
   * Requirements: 6.5
   */
  markClientNotAlive(clientId: string): boolean {
    const client = this.clients.get(clientId);
    if (client) {
      client.isAlive = false;
      return true;
    }
    return false;
  }

  /**
   * Get clients that haven't responded to heartbeat
   * Requirements: 6.5
   */
  getUnresponsiveClients(): WebSocketConnection[] {
    return Array.from(this.clients.values()).filter(client => !client.isAlive);
  }

  /**
   * Get client statistics
   * Requirements: 6.3, 6.7
   */
  getClientStats(): {
    total: number;
    byType: Record<ClientType, number>;
    oldestConnection: Date | null;
    newestConnection: Date | null;
    averageConnectionAge: number;
  } {
    const clients = Array.from(this.clients.values());
    const now = new Date();

    if (clients.length === 0) {
      return {
        total: 0,
        byType: { controller: 0, display: 0 },
        oldestConnection: null,
        newestConnection: null,
        averageConnectionAge: 0,
      };
    }

    // Calculate statistics
    const connectionTimes = clients.map(c => c.connectedAt.getTime());
    const oldestTime = Math.min(...connectionTimes);
    const newestTime = Math.max(...connectionTimes);
    
    const totalAge = clients.reduce((sum, client) => {
      return sum + (now.getTime() - client.connectedAt.getTime());
    }, 0);

    return {
      total: clients.length,
      byType: {
        controller: this.getConnectionCountByType('controller'),
        display: this.getConnectionCountByType('display'),
      },
      oldestConnection: new Date(oldestTime),
      newestConnection: new Date(newestTime),
      averageConnectionAge: totalAge / clients.length,
    };
  }

  /**
   * Filter clients based on criteria
   * Requirements: 6.7
   */
  filterClients(filter: {
    clientType?: ClientType;
    excludeClientIds?: string[];
    includeClientIds?: string[];
    minConnectionAge?: number;
    maxConnectionAge?: number;
  }): WebSocketConnection[] {
    let clients = Array.from(this.clients.values());

    // Filter by client type
    if (filter.clientType) {
      clients = clients.filter(client => client.clientType === filter.clientType);
    }

    // Exclude specific client IDs
    if (filter.excludeClientIds && filter.excludeClientIds.length > 0) {
      const excludeSet = new Set(filter.excludeClientIds);
      clients = clients.filter(client => !excludeSet.has(client.id));
    }

    // Include only specific client IDs
    if (filter.includeClientIds && filter.includeClientIds.length > 0) {
      const includeSet = new Set(filter.includeClientIds);
      clients = clients.filter(client => includeSet.has(client.id));
    }

    // Filter by connection age
    if (filter.minConnectionAge !== undefined || filter.maxConnectionAge !== undefined) {
      const now = new Date().getTime();
      clients = clients.filter(client => {
        const age = now - client.connectedAt.getTime();
        
        if (filter.minConnectionAge !== undefined && age < filter.minConnectionAge) {
          return false;
        }
        
        if (filter.maxConnectionAge !== undefined && age > filter.maxConnectionAge) {
          return false;
        }
        
        return true;
      });
    }

    return clients;
  }

  /**
   * Clear all clients (for shutdown)
   * Requirements: 6.5
   */
  clear(): void {
    // Close all connections
    for (const connection of this.clients.values()) {
      if (connection.socket && connection.socket.readyState === 1) { // 1 = OPEN
        connection.socket.close(1001, 'Server shutting down');
      }
    }

    // Clear all maps
    this.clients.clear();
    this.connectionsByType.get('controller')?.clear();
    this.connectionsByType.get('display')?.clear();

    console.log('All WebSocket clients cleared');
  }

  /**
   * Check if client exists and is connected
   * Requirements: 6.3
   */
  isClientConnected(clientId: string): boolean {
    const client = this.clients.get(clientId);
    return client !== undefined && client.socket.readyState === client.socket.OPEN;
  }

  /**
   * Get client connection info for debugging
   * Requirements: 6.3
   */
  getClientInfo(clientId: string): {
    id: string;
    clientType: ClientType;
    connectedAt: Date;
    lastActivity: Date;
    isAlive: boolean;
    connectionAge: number;
    clientIP?: string;
    userAgent?: string;
  } | null {
    const client = this.clients.get(clientId);
    if (!client) {
      return null;
    }

    return {
      id: client.id,
      clientType: client.clientType,
      connectedAt: client.connectedAt,
      lastActivity: client.lastActivity,
      isAlive: client.isAlive,
      connectionAge: new Date().getTime() - client.connectedAt.getTime(),
      clientIP: client.clientIP,
      userAgent: client.userAgent,
    };
  }
}