/**
 * IPC Client for MPV Unix socket communication
 * Implements JSON command/response protocol with mpv
 * Requirements: 2.2, 2.6
 */

import { Socket } from 'net';
import { EventEmitter } from 'events';
import { IIPCClient } from '../../domain/playback/interfaces';
import { MPVCommand, MPVResponse, IPCEventListener } from '../../domain/playback/types';

/**
 * IPCClient implementation for communicating with MPV via Unix socket
 * Requirements: 2.2, 2.6
 */
export class IPCClient extends EventEmitter implements IIPCClient {
  private socket: Socket | null = null;
  private connected = false;
  private requestId = 0;
  private pendingRequests = new Map<number, {
    resolve: (response: MPVResponse) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }>();
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 3;
  private readonly requestTimeout = 5000; // 5 seconds
  private readonly reconnectDelay = 1000; // 1 second

  /**
   * Connect to MPV via Unix socket
   * Requirements: 2.2
   */
  async connect(socketPath: string): Promise<void> {
    if (this.connected) {
      return;
    }

    return new Promise((resolve, reject) => {
      this.socket = new Socket();
      
      // Set up connection timeout
      const connectionTimeout = setTimeout(() => {
        this.socket?.destroy();
        reject(new Error(`Connection timeout to socket: ${socketPath}`));
      }, 5000);

      this.socket.connect(socketPath, () => {
        clearTimeout(connectionTimeout);
        this.connected = true;
        this.reconnectAttempts = 0;
        this.emit('connected');
        resolve();
      });

      this.socket.on('error', (error) => {
        clearTimeout(connectionTimeout);
        this.connected = false;
        this.emit('error', error);
        
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.scheduleReconnect(socketPath);
        }
        
        reject(error);
      });

      this.socket.on('close', () => {
        this.connected = false;
        this.rejectPendingRequests(new Error('Socket closed'));
        this.emit('disconnected');
        
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.scheduleReconnect(socketPath);
        }
      });

      this.socket.on('data', (data) => {
        this.handleIncomingData(data);
      });
    });
  }

  /**
   * Disconnect from MPV
   * Requirements: 2.2
   */
  async disconnect(): Promise<void> {
    if (!this.socket) {
      return;
    }

    return new Promise((resolve) => {
      this.connected = false;
      this.rejectPendingRequests(new Error('Disconnecting'));
      
      if (this.socket) {
        this.socket.end(() => {
          this.socket = null;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Send command to MPV and get response
   * Requirements: 2.2, 2.6
   */
  async sendCommand(command: MPVCommand): Promise<MPVResponse> {
    if (!this.connected || !this.socket) {
      throw new Error('Not connected to MPV');
    }

    const requestId = command.request_id ?? ++this.requestId;
    const commandWithId: MPVCommand = {
      ...command,
      request_id: requestId
    };

    return new Promise((resolve, reject) => {
      // Set up timeout for this request
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error(`Request timeout for command: ${command.command.join(' ')}`));
      }, this.requestTimeout);

      // Store the request for response matching
      this.pendingRequests.set(requestId, {
        resolve,
        reject,
        timeout
      });

      // Send the command as JSON
      const jsonCommand = JSON.stringify(commandWithId) + '\n';
      
      if (!this.socket?.write(jsonCommand)) {
        clearTimeout(timeout);
        this.pendingRequests.delete(requestId);
        reject(new Error('Failed to write command to socket'));
      }
    });
  }

  /**
   * Check if connection is active
   * Requirements: 2.6, 2.7
   */
  isConnected(): boolean {
    return this.connected && this.socket !== null && !this.socket.destroyed;
  }

  /**
   * Add event listener for IPC events
   * Requirements: 2.6
   */
  addEventListener(listener: IPCEventListener): void {
    this.on('response', listener);
  }

  /**
   * Remove event listener
   */
  removeEventListener(listener: IPCEventListener): void {
    this.off('response', listener);
  }

  /**
   * Handle incoming data from MPV socket
   * Parse JSON responses and match them to pending requests
   */
  private handleIncomingData(data: Buffer): void {
    const lines = data.toString().split('\n').filter(line => line.trim());
    
    for (const line of lines) {
      try {
        const response: MPVResponse = JSON.parse(line);
        
        // Emit the response for general listeners
        this.emit('response', response);
        
        // Handle request/response matching
        if (response.request_id !== undefined) {
          const pending = this.pendingRequests.get(response.request_id);
          if (pending) {
            clearTimeout(pending.timeout);
            this.pendingRequests.delete(response.request_id);
            pending.resolve(response);
          }
        }
      } catch (error) {
        // Invalid JSON - emit as error but don't crash
        this.emit('error', new Error(`Invalid JSON response: ${line}`));
      }
    }
  }

  /**
   * Schedule reconnection attempt with exponential backoff
   */
  private scheduleReconnect(socketPath: string): void {
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    setTimeout(async () => {
      try {
        await this.connect(socketPath);
      } catch (error) {
        // Reconnection failed, will try again if under limit
        this.emit('error', new Error(`Reconnection attempt ${this.reconnectAttempts} failed: ${error}`));
      }
    }, delay);
  }

  /**
   * Reject all pending requests with the given error
   */
  private rejectPendingRequests(error: Error): void {
    for (const [requestId, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(error);
    }
    this.pendingRequests.clear();
  }
}