import { createContext, useContext, useReducer, useEffect, ReactNode, useCallback } from 'react';
import { ConnectionStatus } from '../types';
import { apiService, createWebSocketService, WebSocketService } from '../services';
import { useSession } from './SessionContext';

// Connection state interface
interface ConnectionContextState {
  status: ConnectionStatus;
  webSocketService: WebSocketService | null;
  isRetrying: boolean;
  retryCount: number;
  lastRetryAt: Date | null;
}

// Connection actions
type ConnectionAction =
  | { type: 'UPDATE_API_STATUS'; payload: { connected: boolean; lastError?: string; retrying: boolean } }
  | { type: 'UPDATE_WEBSOCKET_STATUS'; payload: { connected: boolean; reconnecting: boolean; lastError?: string } }
  | { type: 'UPDATE_SERVER_INFO'; payload: { url: string; version?: string; addresses: string[] } }
  | { type: 'SET_WEBSOCKET_SERVICE'; payload: WebSocketService }
  | { type: 'START_RETRY'; payload: { retryCount: number } }
  | { type: 'END_RETRY' }
  | { type: 'RESET_CONNECTION' };

// Connection context interface
interface ConnectionContextType {
  state: ConnectionContextState;
  connectWebSocket: () => Promise<void>;
  disconnectWebSocket: () => void;
  retryConnection: () => Promise<void>;
  testAPIConnection: () => Promise<boolean>;
  resetConnection: () => void;
}

// Initial state
const initialState: ConnectionContextState = {
  status: {
    api: {
      connected: false,
      retrying: false,
    },
    websocket: {
      connected: false,
      reconnecting: false,
    },
    server: {
      url: window.location.origin,
      addresses: [],
    },
  },
  webSocketService: null,
  isRetrying: false,
  retryCount: 0,
  lastRetryAt: null,
};

// Connection reducer
function connectionReducer(state: ConnectionContextState, action: ConnectionAction): ConnectionContextState {
  switch (action.type) {
    case 'UPDATE_API_STATUS':
      return {
        ...state,
        status: {
          ...state.status,
          api: {
            ...state.status.api,
            ...action.payload,
          },
        },
      };

    case 'UPDATE_WEBSOCKET_STATUS':
      return {
        ...state,
        status: {
          ...state.status,
          websocket: {
            ...state.status.websocket,
            ...action.payload,
          },
        },
      };

    case 'UPDATE_SERVER_INFO':
      return {
        ...state,
        status: {
          ...state.status,
          server: {
            ...state.status.server,
            ...action.payload,
          },
        },
      };

    case 'SET_WEBSOCKET_SERVICE':
      return {
        ...state,
        webSocketService: action.payload,
      };

    case 'START_RETRY':
      return {
        ...state,
        isRetrying: true,
        retryCount: action.payload.retryCount,
        lastRetryAt: new Date(),
      };

    case 'END_RETRY':
      return {
        ...state,
        isRetrying: false,
      };

    case 'RESET_CONNECTION':
      // Disconnect WebSocket if connected
      if (state.webSocketService) {
        state.webSocketService.disconnect();
      }
      
      return {
        ...initialState,
        status: {
          ...initialState.status,
          server: {
            ...state.status.server, // Keep server URL
          },
        },
      };

    default:
      return state;
  }
}

// Create context
const ConnectionContext = createContext<ConnectionContextType | undefined>(undefined);

// Connection provider props
interface ConnectionProviderProps {
  children: ReactNode;
  serverUrl?: string;
}

// Connection provider component
export function ConnectionProvider({ children, serverUrl }: ConnectionProviderProps) {
  const [state, dispatch] = useReducer(connectionReducer, {
    ...initialState,
    status: {
      ...initialState.status,
      server: {
        ...initialState.status.server,
        url: serverUrl || window.location.origin,
      },
    },
  });
  const { state: sessionState } = useSession();

  // Test API connection
  const testAPIConnection = useCallback(async (): Promise<boolean> => {
    dispatch({ type: 'UPDATE_API_STATUS', payload: { connected: false, retrying: true } });
    
    try {
      // Test API by getting queue state
      await apiService.getQueueState();
      dispatch({ type: 'UPDATE_API_STATUS', payload: { connected: true, retrying: false } });
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      dispatch({ 
        type: 'UPDATE_API_STATUS', 
        payload: { 
          connected: false, 
          retrying: false, 
          lastError: errorMessage 
        } 
      });
      return false;
    }
  }, []);

  // Connect WebSocket
  const connectWebSocket = useCallback(async () => {
    if (!sessionState.session) {
      console.warn('Cannot connect WebSocket without active session');
      return;
    }

    dispatch({ type: 'UPDATE_WEBSOCKET_STATUS', payload: { connected: false, reconnecting: true } });

    try {
      // Create WebSocket service if not exists
      let wsService = state.webSocketService;
      if (!wsService) {
        wsService = createWebSocketService(
          state.status.server.url.replace(/^http/, 'ws') + '/ws',
          {
            clientType: 'controller',
            reconnectInterval: 1000,
            maxReconnectAttempts: 5,
          }
        );
        dispatch({ type: 'SET_WEBSOCKET_SERVICE', payload: wsService });
      }

      // Set up event handlers
      wsService.subscribe('connection_established', () => {
        dispatch({ type: 'UPDATE_WEBSOCKET_STATUS', payload: { connected: true, reconnecting: false } });
      });

      wsService.subscribe('error_occurred', (event) => {
        const errorMessage = event.data?.message || 'WebSocket error';
        dispatch({ 
          type: 'UPDATE_WEBSOCKET_STATUS', 
          payload: { 
            connected: false, 
            reconnecting: false, 
            lastError: errorMessage 
          } 
        });
      });

      // Connect
      await wsService.connect();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to connect WebSocket';
      dispatch({ 
        type: 'UPDATE_WEBSOCKET_STATUS', 
        payload: { 
          connected: false, 
          reconnecting: false, 
          lastError: errorMessage 
        } 
      });
    }
  }, [sessionState.session, state.webSocketService, state.status.server.url]);

  // Disconnect WebSocket
  const disconnectWebSocket = useCallback(() => {
    if (state.webSocketService) {
      state.webSocketService.disconnect();
      dispatch({ type: 'UPDATE_WEBSOCKET_STATUS', payload: { connected: false, reconnecting: false } });
    }
  }, [state.webSocketService]);

  // Retry connection with exponential backoff
  const retryConnection = useCallback(async () => {
    const maxRetries = 5;
    const baseDelay = 1000; // 1 second
    
    if (state.isRetrying || state.retryCount >= maxRetries) {
      return;
    }

    const retryCount = state.retryCount + 1;
    const delay = baseDelay * Math.pow(2, retryCount - 1); // Exponential backoff
    
    dispatch({ type: 'START_RETRY', payload: { retryCount } });

    // Wait for delay
    await new Promise(resolve => setTimeout(resolve, delay));

    try {
      // Test API connection first
      const apiConnected = await testAPIConnection();
      
      if (apiConnected) {
        // Try to connect WebSocket
        await connectWebSocket();
      }
      
      dispatch({ type: 'END_RETRY' });
    } catch (error) {
      dispatch({ type: 'END_RETRY' });
      
      // If we haven't reached max retries, schedule another retry
      if (retryCount < maxRetries) {
        setTimeout(() => retryConnection(), 1000);
      }
    }
  }, [state.isRetrying, state.retryCount, testAPIConnection, connectWebSocket]);

  // Reset connection
  const resetConnection = useCallback(() => {
    dispatch({ type: 'RESET_CONNECTION' });
  }, []);

  // Initialize connections when session is ready
  useEffect(() => {
    if (sessionState.session && !sessionState.isLoading) {
      // Test API connection
      testAPIConnection();
      
      // Connect WebSocket
      connectWebSocket();
    }
  }, [sessionState.session, sessionState.isLoading, testAPIConnection, connectWebSocket]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (state.webSocketService) {
        state.webSocketService.disconnect();
      }
    };
  }, [state.webSocketService]);

  // Monitor API connection health
  useEffect(() => {
    if (!state.status.api.connected && !state.status.api.retrying && !state.isRetrying) {
      // Auto-retry API connection if it's not connected and we're not already retrying
      const timer = setTimeout(() => {
        testAPIConnection();
      }, 5000); // Retry every 5 seconds

      return () => clearTimeout(timer);
    }
  }, [state.status.api.connected, state.status.api.retrying, state.isRetrying, testAPIConnection]);

  // Context value
  const contextValue: ConnectionContextType = {
    state,
    connectWebSocket,
    disconnectWebSocket,
    retryConnection,
    testAPIConnection,
    resetConnection,
  };

  return (
    <ConnectionContext.Provider value={contextValue}>
      {children}
    </ConnectionContext.Provider>
  );
}

// Hook to use connection context
export function useConnection(): ConnectionContextType {
  const context = useContext(ConnectionContext);
  if (context === undefined) {
    throw new Error('useConnection must be used within a ConnectionProvider');
  }
  return context;
}