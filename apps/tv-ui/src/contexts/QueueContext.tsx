import { createContext, useContext, useReducer, ReactNode } from 'react';
import { QueueItem } from '@party-jukebox/shared';

// Queue state interface for TV UI
interface TVQueueState {
  items: QueueItem[];
  isEmpty: boolean;
  totalItems: number;
  isLoading: boolean;
  error?: string;
}

// Action types for queue state updates
type QueueAction =
  | { type: 'SET_QUEUE_ITEMS'; payload: QueueItem[] }
  | { type: 'ADD_QUEUE_ITEM'; payload: QueueItem }
  | { type: 'REMOVE_QUEUE_ITEM'; payload: string } // item ID
  | { type: 'UPDATE_QUEUE_ITEM'; payload: { id: string; updates: Partial<QueueItem> } }
  | { type: 'CLEAR_QUEUE' }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string }
  | { type: 'CLEAR_ERROR' }
  | { type: 'RESET_STATE' };

// Initial state
const initialQueueState: TVQueueState = {
  items: [],
  isEmpty: true,
  totalItems: 0,
  isLoading: false,
  error: undefined,
};

// Reducer function
function queueReducer(state: TVQueueState, action: QueueAction): TVQueueState {
  switch (action.type) {
    case 'SET_QUEUE_ITEMS':
      return {
        ...state,
        items: action.payload,
        isEmpty: action.payload.length === 0,
        totalItems: action.payload.length,
        error: undefined,
      };
    
    case 'ADD_QUEUE_ITEM':
      const newItems = [...state.items, action.payload];
      return {
        ...state,
        items: newItems,
        isEmpty: false,
        totalItems: newItems.length,
        error: undefined,
      };
    
    case 'REMOVE_QUEUE_ITEM':
      const filteredItems = state.items.filter(item => item.id !== action.payload);
      return {
        ...state,
        items: filteredItems,
        isEmpty: filteredItems.length === 0,
        totalItems: filteredItems.length,
      };
    
    case 'UPDATE_QUEUE_ITEM':
      const updatedItems = state.items.map(item =>
        item.id === action.payload.id
          ? { ...item, ...action.payload.updates }
          : item
      );
      return {
        ...state,
        items: updatedItems,
      };
    
    case 'CLEAR_QUEUE':
      return {
        ...state,
        items: [],
        isEmpty: true,
        totalItems: 0,
        error: undefined,
      };
    
    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.payload,
      };
    
    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload,
        isLoading: false,
      };
    
    case 'CLEAR_ERROR':
      return {
        ...state,
        error: undefined,
      };
    
    case 'RESET_STATE':
      return initialQueueState;
    
    default:
      return state;
  }
}

// Context interface
interface QueueContextType {
  state: TVQueueState;
  actions: {
    setQueueItems: (items: QueueItem[]) => void;
    addQueueItem: (item: QueueItem) => void;
    removeQueueItem: (itemId: string) => void;
    updateQueueItem: (itemId: string, updates: Partial<QueueItem>) => void;
    clearQueue: () => void;
    setLoading: (loading: boolean) => void;
    setError: (error: string) => void;
    clearError: () => void;
    resetState: () => void;
    // Helper methods
    getUpcomingTracks: (limit?: number) => QueueItem[];
    getQueuePosition: (itemId: string) => number;
  };
}

// Create context
const QueueContext = createContext<QueueContextType | undefined>(undefined);

// Provider component
interface QueueProviderProps {
  children: ReactNode;
}

export function QueueProvider({ children }: QueueProviderProps) {
  const [state, dispatch] = useReducer(queueReducer, initialQueueState);

  const actions = {
    setQueueItems: (items: QueueItem[]) => {
      dispatch({ type: 'SET_QUEUE_ITEMS', payload: items });
    },
    
    addQueueItem: (item: QueueItem) => {
      dispatch({ type: 'ADD_QUEUE_ITEM', payload: item });
    },
    
    removeQueueItem: (itemId: string) => {
      dispatch({ type: 'REMOVE_QUEUE_ITEM', payload: itemId });
    },
    
    updateQueueItem: (itemId: string, updates: Partial<QueueItem>) => {
      dispatch({ type: 'UPDATE_QUEUE_ITEM', payload: { id: itemId, updates } });
    },
    
    clearQueue: () => {
      dispatch({ type: 'CLEAR_QUEUE' });
    },
    
    setLoading: (loading: boolean) => {
      dispatch({ type: 'SET_LOADING', payload: loading });
    },
    
    setError: (error: string) => {
      dispatch({ type: 'SET_ERROR', payload: error });
    },
    
    clearError: () => {
      dispatch({ type: 'CLEAR_ERROR' });
    },
    
    resetState: () => {
      dispatch({ type: 'RESET_STATE' });
    },
    
    // Helper methods
    getUpcomingTracks: (limit?: number) => {
      return limit ? state.items.slice(0, limit) : state.items;
    },
    
    getQueuePosition: (itemId: string) => {
      return state.items.findIndex(item => item.id === itemId) + 1;
    },
  };

  return (
    <QueueContext.Provider value={{ state, actions }}>
      {children}
    </QueueContext.Provider>
  );
}

// Hook for using the context
export function useQueue() {
  const context = useContext(QueueContext);
  if (context === undefined) {
    throw new Error('useQueue must be used within a QueueProvider');
  }
  return context;
}