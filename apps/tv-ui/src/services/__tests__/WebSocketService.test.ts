/**
 * WebSocketService Tests
 * 
 * Basic tests to verify WebSocketService functionality
 */

import { WebSocketService } from '../WebSocketService';

describe('WebSocketService', () => {
  let webSocketService: WebSocketService;

  beforeEach(() => {
    webSocketService = new WebSocketService({
      url: 'ws://localhost:3000/ws',
      clientType: 'display',
      reconnectInterval: 1000,
      maxReconnectAttempts: 3,
    });
  });

  describe('constructor', () => {
    it('should create WebSocketService instance with correct config', () => {
      expect(webSocketService).toBeInstanceOf(WebSocketService);
      
      const config = webSocketService.getConfig();
      expect(config.url).toBe('ws://localhost:3000/ws');
      expect(config.clientType).toBe('display');
      expect(config.reconnectInterval).toBe(1000);
      expect(config.maxReconnectAttempts).toBe(3);
    });

    it('should default to display client type', () => {
      const service = new WebSocketService({
        url: 'ws://localhost:3000/ws',
      });
      
      const config = service.getConfig();
      expect(config.clientType).toBe('display');
    });
  });

  describe('connection status', () => {
    it('should start with disconnected status', () => {
      expect(webSocketService.getConnectionStatus()).toBe('disconnected');
      expect(webSocketService.isConnected()).toBe(false);
    });
  });

  describe('event subscription', () => {
    it('should allow subscribing and unsubscribing to events', () => {
      const handler = jest.fn();
      
      // Subscribe
      webSocketService.subscribe('queue_updated', handler);
      
      // Unsubscribe
      webSocketService.unsubscribe('queue_updated', handler);
      
      // Should not throw errors
      expect(true).toBe(true);
    });
  });

  describe('updateConfig', () => {
    it('should update configuration correctly', () => {
      webSocketService.updateConfig({
        reconnectInterval: 2000,
        maxReconnectAttempts: 5,
      });

      const config = webSocketService.getConfig();
      expect(config.reconnectInterval).toBe(2000);
      expect(config.maxReconnectAttempts).toBe(5);
      expect(config.url).toBe('ws://localhost:3000/ws'); // Should remain unchanged
    });
  });
});