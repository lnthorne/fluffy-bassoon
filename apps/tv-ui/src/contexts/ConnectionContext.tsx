import { createContext, useContext, useReducer, ReactNode } from 'react';
import { ConnectionStatus, ServerInfo } from '../types';

// Extended connection state for TV UI
interface TVConnectionState {
  websocket: ConnectionStatus;
  api: ConnectionStatus;
  server: ServerInfo;
  isOnline: boolean;
  reconnectAttempts: number;
  maxReconnectAttempts: number;
  reconnectDelay: number;
  lastActivity?: Date;
}

// Action types for connection state updates
type ConnectionAction =
  | { type: 'SET_WEBSOCKET_STATUS'; payload: Partial<ConnectionStatus> }
  | { type: 'SET_API_STATUS'; payload: Partial<ConnectionStatus> }
  | { type: 'SET_SERVER_INFO'; payload: Partial<ServerInfo> }
  | { type: 'SET_ONLINE_STATUS'; payload: boolean }
  | { type: 'INCREMENT_RECONNECT_ATTEMPTS' }
  | { type: 'RESET_RECONNECT_ATTEMPTS' }
  | { type: 'SET_RECONNECT_DELAY'; payload: number }
  | { type: 'UPDATE_LAST_ACTIVITY' }
  | { type: 'CONNECTION_ERROR'; payload: { type: 'websocket' | 'api'; error: string } }
  | { type: 'CONNECTION_RECOVERED'; payload: 'websocket' | 'api' }
  | { type: 'RESET_STATE' };

// Initial state
const initialConnectionState: TVConnectionState = {
  websocket: {
    connected: false,
    reconnecting: false,
    error: undefined,
  },
  api: {
    connected: false,
    reconnecting: false,
    error: undefined,
  },
  server: {
    url: '',
    wsUrl: '',
    addresses: [],
    version: undefined,
  },
  isOnline: false,
  reconnectAttempts: 0,
  maxReconnectAttempts: 10,
  reconnectDelay: 1000, // Start with 1 second
  lastActivity: undefined,
};

// Reducer function
function connectionReducer(state: TVConnectionState, action: ConnectionAction): TVConnectionState {
  switch (action.type) {
    case 'SET_WEBSOCKET_STATUS':
      const newWebSocketStatus = { ...state.websocket, ...action.payload };
      return {
        ...state,
        websocket: newWebSocketStatus,
        isOnline: newWebSocketStatus.connected && state.api.connected,
        lastActivity: newWebSocketStatus.connected ? new Date() : state.lastActivity,
      };
    
    case 'SET_API_STATUS':
      const newApiStatus = { ...state.api, ...action.payload };
      return {
        ...state,
        api: newApiStatus,
        isOnline: state.websocket.connected && newApiStatus.connected,
        lastActivity: newApiStatus.connected ? new Date() : state.lastActivity,
      };
    
    case 'SET_SERVER_INFO':
      return {
        ...state,
        server: { ...state.server, ...action.payload },
      };
    
    case 'SET_ONLINE_STATUS':
      return {
        ...state,
        isOnline: action.payload,
      };
    
    case 'INCREMENT_RECONNECT_ATTEMPTS':
      return {
        ...state,
        reconnectAttempts: state.reconnectAttempts + 1,
        // Exponential backoff with max delay of 30 seconds
        reconnectDelay: Math.min(state.reconnectDelay * 2, 30000),
      };
    
    case 'RESET_RECONNECT_ATTEMPTS':
      return {
        ...state,
        reconnectAttempts: 0,
        reconnectDelay: 1000, // Reset to 1 second
      };
    
    case 'SET_RECONNECT_DELAY':
      return {
        ...state,
        reconnectDelay: action.payload,
      };
    
    case 'UPDATE_LAST_ACTIVITY':
      return {
        ...state,
        lastActivity: new Date(),
      };
    
    case 'CONNECTION_ERROR':
      const errorUpdate = action.payload.type === 'websocket' 
        ? { websocket: { ...state.websocket, connected: false, error: action.payload.error } }
        : { api: { ...state.api, connected: false, error: action.payload.error } };
      
      return {
        ...state,
        ...errorUpdate,
        isOnline: false,
      };
    
    case 'CONNECTION_RECOVERED':
      const recoveryUpdate = action.payload === 'websocket'
        ? { websocket: { ...state.websocket, connected: true, reconnecting: false, error: undefined } }
        : { api: { ...state.api, connected: true, reconnecting: false, error: undefined } };
      
      const isFullyOnline = action.payload === 'websocket' 
        ? state.api.connected 
        : state.websocket.connected;
      
      return {
        ...state,
        ...recoveryUpdate,
        isOnline: isFullyOnline,
        lastActivity: new Date(),
      };
    
    case 'RESET_STATE':
      return initialConnectionState;
    
    default:
      return state;
  }
}

// Context interface
interface ConnectionContextType {
  state: TVConnectionState;
  actions: {
    setWebSocketStatus: (status: Partial<ConnectionStatus>) => void;
    setApiStatus: (status: Partial<ConnectionStatus>) => void;
    setServerInfo: (info: Partial<ServerInfo>) => void;
    setOnlineStatus: (online: boolean) => void;
    incrementReconnectAttempts: () => void;
    resetReconnectAttempts: () => void;
    setReconnectDelay: (delay: number) => void;
    updateLastActivity: () => void;
    handleConnectionError: (type: 'websocket' | 'api', error: string) => void;
    handleConnectionRecovery: (type: 'websocket' | 'api') => void;
    resetState: () => void;
    // Helper methods
    shouldAttemptReconnect: () => boolean;
    getReconnectDelay: () => number;
    getConnectionHealth: () => 'healthy' | 'degraded' | 'offline';
    getPrimaryServerUrl: () => string;
  };
}

// Create context
const ConnectionContext = createContext<ConnectionContextType | undefined>(undefined);

// Provider component
interface ConnectionProviderProps {
  children: ReactNode;
  initialServerInfo?: Partial<ServerInfo>;
}

export function ConnectionProvider({ children, initialServerInfo }: ConnectionProviderProps) {
  const [state, dispatch] = useReducer(connectionReducer, {
    ...initialConnectionState,
    server: { ...initialConnectionState.server, ...initialServerInfo },
  });

  const actions = {
    setWebSocketStatus: (status: Partial<ConnectionStatus>) => {
      dispatch({ type: 'SET_WEBSOCKET_STATUS', payload: status });
    },
    
    setApiStatus: (status: Partial<ConnectionStatus>) => {
      dispatch({ type: 'SET_API_STATUS', payload: status });
    },
    
    setServerInfo: (info: Partial<ServerInfo>) => {
      dispatch({ type: 'SET_SERVER_INFO', payload: info });
    },
    
    setOnlineStatus: (online: boolean) => {
      dispatch({ type: 'SET_ONLINE_STATUS', payload: online });
    },
    
    incrementReconnectAttempts: () => {
      dispatch({ type: 'INCREMENT_RECONNECT_ATTEMPTS' });
    },
    
    resetReconnectAttempts: () => {
      dispatch({ type: 'RESET_RECONNECT_ATTEMPTS' });
    },
    
    setReconnectDelay: (delay: number) => {
      dispatch({ type: 'SET_RECONNECT_DELAY', payload: delay });
    },
    
    updateLastActivity: () => {
      dispatch({ type: 'UPDATE_LAST_ACTIVITY' });
    },
    
    handleConnectionError: (type: 'websocket' | 'api', error: string) => {
      dispatch({ type: 'CONNECTION_ERROR', payload: { type, error } });
    },
    
    handleConnectionRecovery: (type: 'websocket' | 'api') => {
      dispatch({ type: 'CONNECTION_RECOVERED', payload: type });
    },
    
    resetState: () => {
      dispatch({ type: 'RESET_STATE' });
    },
    
    // Helper methods
    shouldAttemptReconnect: () => {
      return state.reconnectAttempts < state.maxReconnectAttempts;
    },
    
    getReconnectDelay: () => {
      return state.reconnectDelay;
    },
    
    getConnectionHealth: () => {
      if (state.websocket.connected && state.api.connected) {
        return 'healthy';
      } else if (state.websocket.connected || state.api.connected) {
        return 'degraded';
      } else {
        return 'offline';
      }
    },
    
    getPrimaryServerUrl: () => {
      // Return the first available address or fallback to the configured URL
      return state.server.addresses.length > 0 
        ? `http://${state.server.addresses[0]}:3000`
        : state.server.url;
    },
  };

  return (
    <ConnectionContext.Provider value={{ state, actions }}>
      {children}
    </ConnectionContext.Provider>
  );
}

// Hook for using the context
export function useConnection() {
  const context = useContext(ConnectionContext);
  if (context === undefined) {
    throw new Error('useConnection must be used within a ConnectionProvider');
  }
  return context;
}