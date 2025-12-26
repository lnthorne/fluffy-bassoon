/**
 * WebSocket Server Unit Tests
 * 
 * Tests for WebSocket server infrastructure including connection handling,
 * client management, and message processing.
 * 
 * Requirements: 5.1, 5.4, 5.5
 */

import { WebSocketServer, WebSocketServerConfig } from '../WebSocketServer';
import { ClientManager } from '../ClientManager';
import { MessageHandler } from '../MessageHandler';
import { WebSocketConnection, ClientType } from '../types';

// Mock Fastify instance
const mockFastify = {
  register: jest.fn().mockResolvedValue(undefined),
} as any;

// Mock WebSocket
const mockWebSocket = {
  OPEN: 1,
  readyState: 1,
  send: jest.fn(),
  close: jest.fn(),
  terminate: jest.fn(),
  ping: jest.fn(),
  on: jest.fn(),
} as any;

describe('WebSocketServer', () => {
  let webSocketServer: WebSocketServer;
  let config: WebSocketServerConfig;

  beforeEach(() => {
    config = {
      heartbeatInterval: 1000,
      connectionTimeout: 5000,
      maxConnections: 10,
    };
    webSocketServer = new WebSocketServer(config);
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize WebSocket server with Fastify instance', async () => {
      await webSocketServer.initialize(mockFastify);

      expect(mockFastify.register).toHaveBeenCalledWith(expect.any(Function));
    });

    it('should initialize with dependencies', async () => {
      const dependencies = {};
      await webSocketServer.initialize(mockFastify, dependencies);

      expect(mockFastify.register).toHaveBeenCalled();
    });
  });

  describe('client ID generation', () => {
    it('should generate unique client IDs', () => {
      const server = new WebSocketServer(config);
      
      // Access private method through type assertion for testing
      const generateId = (server as any).generateClientId.bind(server);
      
      const id1 = generateId();
      const id2 = generateId();

      expect(id1).toMatch(/^client_[a-z0-9]+_[a-z0-9]+$/);
      expect(id2).toMatch(/^client_[a-z0-9]+_[a-z0-9]+$/);
      expect(id1).not.toBe(id2);
    });
  });

  describe('client type detection', () => {
    it('should detect display client from referer', () => {
      const server = new WebSocketServer(config);
      const detectType = (server as any).detectClientType.bind(server);

      const request = {
        headers: {
          referer: 'http://localhost:3000/display',
          'user-agent': 'Mozilla/5.0',
        },
      };

      const clientType = detectType(request);
      expect(clientType).toBe('display');
    });

    it('should detect display client from TV user agent', () => {
      const server = new WebSocketServer(config);
      const detectType = (server as any).detectClientType.bind(server);

      const request = {
        headers: {
          'user-agent': 'Smart TV Browser',
        },
      };

      const clientType = detectType(request);
      expect(clientType).toBe('display');
    });

    it('should default to controller for mobile browsers', () => {
      const server = new WebSocketServer(config);
      const detectType = (server as any).detectClientType.bind(server);

      const request = {
        headers: {
          'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
        },
      };

      const clientType = detectType(request);
      expect(clientType).toBe('controller');
    });
  });

  describe('connection statistics', () => {
    it('should return correct connection statistics', () => {
      const stats = webSocketServer.getConnectionStats();

      expect(stats).toEqual({
        totalConnections: 0,
        controllerConnections: 0,
        displayConnections: 0,
        maxConnections: 10,
      });
    });
  });

  describe('broadcasting', () => {
    it('should broadcast events to all clients', async () => {
      const event = {
        type: 'test_event' as any,
        timestamp: new Date(),
        sequenceNumber: 1,
        data: { message: 'test' },
      };

      // Mock client manager to return mock clients
      const mockClientManager = {
        getAllClients: jest.fn().mockReturnValue([
          { id: 'client1', socket: mockWebSocket },
          { id: 'client2', socket: mockWebSocket },
        ]),
      };

      (webSocketServer as any).clientManager = mockClientManager;

      await webSocketServer.broadcast(event);

      expect(mockWebSocket.send).toHaveBeenCalledTimes(2);
      expect(mockWebSocket.send).toHaveBeenCalledWith(JSON.stringify(event));
    });

    it('should broadcast to specific client type', async () => {
      const event = {
        type: 'test_event' as any,
        timestamp: new Date(),
        sequenceNumber: 1,
        data: { message: 'test' },
      };

      const mockClientManager = {
        getClientsByType: jest.fn().mockReturnValue([
          { id: 'display1', socket: mockWebSocket, clientType: 'display' },
        ]),
      };

      (webSocketServer as any).clientManager = mockClientManager;

      await webSocketServer.broadcastToType(event, 'display');

      expect(mockClientManager.getClientsByType).toHaveBeenCalledWith('display');
      expect(mockWebSocket.send).toHaveBeenCalledWith(JSON.stringify(event));
    });
  });

  describe('shutdown', () => {
    it('should shutdown gracefully', async () => {
      const mockClientManager = {
        getAllClients: jest.fn().mockReturnValue([
          { id: 'client1', socket: mockWebSocket },
        ]),
        clear: jest.fn(),
      };

      (webSocketServer as any).clientManager = mockClientManager;
      (webSocketServer as any).heartbeatTimer = setInterval(() => {}, 1000);

      await webSocketServer.shutdown();

      expect(mockWebSocket.close).toHaveBeenCalledWith(1001, 'Server shutting down');
      expect(mockClientManager.clear).toHaveBeenCalled();
    });
  });
});

describe('ClientManager', () => {
  let clientManager: ClientManager;
  let mockConnection: WebSocketConnection;

  beforeEach(() => {
    clientManager = new ClientManager();
    mockConnection = {
      id: 'test-client-1',
      socket: mockWebSocket,
      clientType: 'controller',
      connectedAt: new Date(),
      lastActivity: new Date(),
      isAlive: true,
    };
    jest.clearAllMocks();
  });

  describe('client management', () => {
    it('should add client successfully', () => {
      clientManager.addClient(mockConnection);

      expect(clientManager.getConnectionCount()).toBe(1);
      expect(clientManager.getClient('test-client-1')).toBe(mockConnection);
    });

    it('should remove client successfully', () => {
      clientManager.addClient(mockConnection);
      const removed = clientManager.removeClient('test-client-1');

      expect(removed).toBe(true);
      expect(clientManager.getConnectionCount()).toBe(0);
      expect(clientManager.getClient('test-client-1')).toBeNull();
    });

    it('should return false when removing non-existent client', () => {
      const removed = clientManager.removeClient('non-existent');
      expect(removed).toBe(false);
    });
  });

  describe('client filtering', () => {
    beforeEach(() => {
      const controllerClient: WebSocketConnection = {
        ...mockConnection,
        id: 'controller-1',
        clientType: 'controller',
      };

      const displayClient: WebSocketConnection = {
        ...mockConnection,
        id: 'display-1',
        clientType: 'display',
      };

      clientManager.addClient(controllerClient);
      clientManager.addClient(displayClient);
    });

    it('should get clients by type', () => {
      const controllers = clientManager.getClientsByType('controller');
      const displays = clientManager.getClientsByType('display');

      expect(controllers).toHaveLength(1);
      expect(controllers[0].clientType).toBe('controller');
      expect(displays).toHaveLength(1);
      expect(displays[0].clientType).toBe('display');
    });

    it('should get connection count by type', () => {
      expect(clientManager.getConnectionCountByType('controller')).toBe(1);
      expect(clientManager.getConnectionCountByType('display')).toBe(1);
    });
  });

  describe('activity tracking', () => {
    beforeEach(() => {
      clientManager.addClient(mockConnection);
    });

    it('should update client activity', () => {
      const originalActivity = mockConnection.lastActivity;
      
      // Wait a bit to ensure timestamp difference
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          const updated = clientManager.updateClientActivity('test-client-1');
          expect(updated).toBe(true);
          expect(mockConnection.lastActivity.getTime()).toBeGreaterThan(originalActivity.getTime());
          resolve();
        }, 10);
      });
    });

    it('should mark client as alive', () => {
      mockConnection.isAlive = false;
      const marked = clientManager.markClientAlive('test-client-1');
      
      expect(marked).toBe(true);
      expect(mockConnection.isAlive).toBe(true);
    });

    it('should mark client as not alive', () => {
      const marked = clientManager.markClientNotAlive('test-client-1');
      
      expect(marked).toBe(true);
      expect(mockConnection.isAlive).toBe(false);
    });
  });

  describe('cleanup', () => {
    it('should clean up inactive clients', () => {
      // Create an old connection
      const oldConnection: WebSocketConnection = {
        ...mockConnection,
        id: 'old-client',
        lastActivity: new Date(Date.now() - 70000), // 70 seconds ago
      };

      clientManager.addClient(mockConnection);
      clientManager.addClient(oldConnection);

      const removedCount = clientManager.cleanupInactiveClients(60000); // 60 second timeout

      expect(removedCount).toBe(1);
      expect(clientManager.getConnectionCount()).toBe(1);
      expect(clientManager.getClient('old-client')).toBeNull();
    });

    it('should get unresponsive clients', () => {
      mockConnection.isAlive = false;
      clientManager.addClient(mockConnection);

      const unresponsive = clientManager.getUnresponsiveClients();
      expect(unresponsive).toHaveLength(1);
      expect(unresponsive[0].id).toBe('test-client-1');
    });
  });

  describe('statistics', () => {
    it('should return correct client statistics', (done) => {
      // Wait a bit to ensure connection age is > 0
      setTimeout(() => {
        clientManager.addClient(mockConnection);

        const stats = clientManager.getClientStats();

        expect(stats.total).toBe(1);
        expect(stats.byType.controller).toBe(1);
        expect(stats.byType.display).toBe(0);
        expect(stats.oldestConnection).toBeInstanceOf(Date);
        expect(stats.newestConnection).toBeInstanceOf(Date);
        expect(stats.averageConnectionAge).toBeGreaterThanOrEqual(0);
        done();
      }, 10);
    });

    it('should return empty statistics when no clients', () => {
      const stats = clientManager.getClientStats();

      expect(stats.total).toBe(0);
      expect(stats.byType.controller).toBe(0);
      expect(stats.byType.display).toBe(0);
      expect(stats.oldestConnection).toBeNull();
      expect(stats.newestConnection).toBeNull();
      expect(stats.averageConnectionAge).toBe(0);
    });
  });
});

describe('MessageHandler', () => {
  let messageHandler: MessageHandler;
  let mockConnection: WebSocketConnection;

  beforeEach(() => {
    messageHandler = new MessageHandler();
    mockConnection = {
      id: 'test-client',
      socket: mockWebSocket,
      clientType: 'controller',
      connectedAt: new Date(),
      lastActivity: new Date(),
      isAlive: true,
    };
    jest.clearAllMocks();
  });

  describe('message validation', () => {
    it('should handle valid JSON messages', async () => {
      const validMessage = JSON.stringify({ type: 'ping' });
      const buffer = Buffer.from(validMessage, 'utf8');

      await messageHandler.handleMessage(mockConnection, buffer);

      expect(mockWebSocket.send).toHaveBeenCalled();
    });

    it('should handle invalid JSON gracefully', async () => {
      const invalidMessage = '{ invalid json';
      const buffer = Buffer.from(invalidMessage, 'utf8');

      await messageHandler.handleMessage(mockConnection, buffer);

      expect(mockWebSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('INVALID_JSON')
      );
    });

    it('should handle messages without type field', async () => {
      const messageWithoutType = JSON.stringify({ data: 'test' });
      const buffer = Buffer.from(messageWithoutType, 'utf8');

      await messageHandler.handleMessage(mockConnection, buffer);

      expect(mockWebSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('INVALID_MESSAGE_FORMAT')
      );
    });
  });

  describe('message processing', () => {
    it('should handle ping messages', async () => {
      const pingMessage = JSON.stringify({ type: 'ping', timestamp: new Date().toISOString() });
      const buffer = Buffer.from(pingMessage, 'utf8');

      await messageHandler.handleMessage(mockConnection, buffer);

      expect(mockWebSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"pong"')
      );
    });

    it('should handle client info requests', async () => {
      const clientInfoMessage = JSON.stringify({ type: 'client_info' });
      const buffer = Buffer.from(clientInfoMessage, 'utf8');

      await messageHandler.handleMessage(mockConnection, buffer);

      expect(mockWebSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"client_info_response"')
      );
    });

    it('should handle initial state requests', async () => {
      const stateMessage = JSON.stringify({ type: 'request_initial_state' });
      const buffer = Buffer.from(stateMessage, 'utf8');

      await messageHandler.handleMessage(mockConnection, buffer);

      expect(mockWebSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"initial_state"')
      );
    });

    it('should handle unknown message types', async () => {
      const unknownMessage = JSON.stringify({ type: 'unknown_type' });
      const buffer = Buffer.from(unknownMessage, 'utf8');

      await messageHandler.handleMessage(mockConnection, buffer);

      expect(mockWebSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('UNKNOWN_MESSAGE_TYPE')
      );
    });
  });

  describe('sequence numbers', () => {
    it('should increment sequence numbers', () => {
      const initialSeq = messageHandler.getCurrentSequenceNumber();
      
      // Access private method for testing
      const getNext = (messageHandler as any).getNextSequenceNumber.bind(messageHandler);
      const nextSeq = getNext();
      
      expect(nextSeq).toBe(initialSeq + 1);
    });

    it('should reset sequence numbers', () => {
      // Generate some sequence numbers
      (messageHandler as any).getNextSequenceNumber();
      (messageHandler as any).getNextSequenceNumber();
      
      messageHandler.resetSequenceNumber();
      
      expect(messageHandler.getCurrentSequenceNumber()).toBe(0);
    });
  });
});