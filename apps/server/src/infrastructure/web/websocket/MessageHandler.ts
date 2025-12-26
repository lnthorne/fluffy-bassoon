/**
 * WebSocket Message Handler
 * 
 * Handles incoming WebSocket messages from clients, validates message format,
 * and processes different message types with appropriate error handling.
 * 
 * Requirements: 5.1, 7.6
 */

import { WebSocketConnection, IncomingWebSocketMessage, ClientMessageEvent } from './types';

export class MessageHandler {
  private messageSequence: number = 0;

  /**
   * Handle incoming message from WebSocket client
   * Requirements: 5.1, 7.6
   */
  async handleMessage(connection: WebSocketConnection, data: Buffer): Promise<void> {
    try {
      // Parse message data
      const messageText = data.toString('utf8');
      let message: IncomingWebSocketMessage;

      try {
        message = JSON.parse(messageText);
      } catch (parseError) {
        console.error(`Invalid JSON from client ${connection.id}:`, parseError);
        await this.sendErrorResponse(connection, 'INVALID_JSON', 'Message must be valid JSON');
        return;
      }

      // Validate message structure
      if (!this.isValidMessage(message)) {
        console.error(`Invalid message structure from client ${connection.id}:`, message);
        await this.sendErrorResponse(connection, 'INVALID_MESSAGE_FORMAT', 'Message must have a valid type field');
        return;
      }

      // Log message for debugging
      console.log(`📨 Message from ${connection.id} (${connection.clientType}): ${message.type}`);

      // Process message based on type
      await this.processMessage(connection, message);

    } catch (error) {
      console.error(`Error handling message from client ${connection.id}:`, error);
      await this.sendErrorResponse(connection, 'MESSAGE_PROCESSING_ERROR', 'Failed to process message');
    }
  }

  /**
   * Validate incoming message structure
   * Requirements: 7.6
   */
  private isValidMessage(message: any): message is IncomingWebSocketMessage {
    return (
      typeof message === 'object' &&
      message !== null &&
      typeof message.type === 'string' &&
      message.type.length > 0
    );
  }

  /**
   * Process message based on its type
   * Requirements: 5.1, 7.6
   */
  private async processMessage(connection: WebSocketConnection, message: IncomingWebSocketMessage): Promise<void> {
    switch (message.type) {
      case 'ping':
        await this.handlePingMessage(connection, message);
        break;

      case 'client_info':
        await this.handleClientInfoMessage(connection, message);
        break;

      case 'request_initial_state':
        await this.handleInitialStateRequest(connection, message);
        break;

      case 'heartbeat_response':
        await this.handleHeartbeatResponse(connection, message);
        break;

      default:
        console.warn(`Unknown message type from client ${connection.id}: ${message.type}`);
        await this.sendErrorResponse(
          connection, 
          'UNKNOWN_MESSAGE_TYPE', 
          `Message type '${message.type}' is not supported`
        );
        break;
    }
  }

  /**
   * Handle ping message from client
   * Requirements: 5.1
   */
  private async handlePingMessage(connection: WebSocketConnection, message: IncomingWebSocketMessage): Promise<void> {
    const pongResponse = {
      type: 'pong',
      timestamp: new Date(),
      sequenceNumber: this.getNextSequenceNumber(),
      data: {
        clientId: connection.id,
        serverTime: new Date().toISOString(),
        originalTimestamp: message.timestamp,
      },
    };

    await this.sendResponse(connection, pongResponse);
  }

  /**
   * Handle client info message
   * Requirements: 5.1
   */
  private async handleClientInfoMessage(connection: WebSocketConnection, message: IncomingWebSocketMessage): Promise<void> {
    const clientInfo = {
      type: 'client_info_response',
      timestamp: new Date(),
      sequenceNumber: this.getNextSequenceNumber(),
      data: {
        clientId: connection.id,
        clientType: connection.clientType,
        connectedAt: connection.connectedAt.toISOString(),
        lastActivity: connection.lastActivity.toISOString(),
        connectionAge: new Date().getTime() - connection.connectedAt.getTime(),
        serverTime: new Date().toISOString(),
      },
    };

    await this.sendResponse(connection, clientInfo);
  }

  /**
   * Handle request for initial state synchronization
   * Requirements: 5.1
   */
  private async handleInitialStateRequest(connection: WebSocketConnection, message: IncomingWebSocketMessage): Promise<void> {
    // For now, send a placeholder initial state
    // This will be enhanced when EventBroadcaster is implemented
    const initialState = {
      type: 'initial_state',
      timestamp: new Date(),
      sequenceNumber: this.getNextSequenceNumber(),
      data: {
        queue: {
          currentTrack: null,
          upcomingTracks: [],
          totalLength: 0,
          isEmpty: true,
        },
        playback: {
          status: 'idle' as const,
          currentTrack: null,
          position: 0,
          duration: 0,
          volume: 1.0,
        },
        serverTime: new Date().toISOString(),
      },
    };

    await this.sendResponse(connection, initialState);
  }

  /**
   * Handle heartbeat response from client
   * Requirements: 5.1
   */
  private async handleHeartbeatResponse(connection: WebSocketConnection, message: IncomingWebSocketMessage): Promise<void> {
    // Update client activity and mark as alive
    connection.lastActivity = new Date();
    connection.isAlive = true;

    // Log heartbeat for debugging
    console.log(`💓 Heartbeat received from ${connection.id}`);
  }

  /**
   * Send error response to client
   * Requirements: 7.6
   */
  private async sendErrorResponse(connection: WebSocketConnection, code: string, message: string): Promise<void> {
    const errorResponse = {
      type: 'error_occurred',
      timestamp: new Date(),
      sequenceNumber: this.getNextSequenceNumber(),
      data: {
        error: {
          code,
          message,
          timestamp: new Date().toISOString(),
        },
      },
    };

    await this.sendResponse(connection, errorResponse);
  }

  /**
   * Send response message to client
   * Requirements: 5.1
   */
  private async sendResponse(connection: WebSocketConnection, response: any): Promise<void> {
    try {
      if (connection.socket && connection.socket.readyState === 1) { // 1 = OPEN
        const messageText = JSON.stringify(response);
        connection.socket.send(messageText);
      } else {
        console.warn(`Cannot send response to client ${connection.id}: connection not open`);
      }
    } catch (error) {
      console.error(`Failed to send response to client ${connection.id}:`, error);
      throw error;
    }
  }

  /**
   * Get next sequence number for message ordering
   * Requirements: 6.6
   */
  private getNextSequenceNumber(): number {
    return ++this.messageSequence;
  }

  /**
   * Reset sequence number (for testing or restart scenarios)
   */
  resetSequenceNumber(): void {
    this.messageSequence = 0;
  }

  /**
   * Get current sequence number
   */
  getCurrentSequenceNumber(): number {
    return this.messageSequence;
  }
}