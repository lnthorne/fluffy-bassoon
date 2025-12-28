import { createContext, useContext, useReducer, useEffect, ReactNode, useCallback } from 'react';
import { QueueState, Track } from '@party-jukebox/shared';
import { QueueContribution, RateLimitInfo } from '../types';
import { apiService } from '../services';
import { useSession } from './SessionContext';

// Queue state interface
interface QueueContextState {
  queueState: QueueState | null;
  userContributions: QueueContribution[];
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

// Queue actions
type QueueAction =
  | { type: 'LOAD_QUEUE_START' }
  | { type: 'LOAD_QUEUE_SUCCESS'; payload: QueueState }
  | { type: 'LOAD_QUEUE_ERROR'; payload: string }
  | { type: 'UPDATE_QUEUE'; payload: QueueState }
  | { type: 'ADD_TRACK_START' }
  | { type: 'ADD_TRACK_SUCCESS'; payload: { position: number } }
  | { type: 'ADD_TRACK_ERROR'; payload: string }
  | { type: 'UPDATE_USER_CONTRIBUTIONS'; payload: QueueContribution[] }
  | { type: 'CLEAR_ERROR' };

// Queue context interface
interface QueueContextType {
  state: QueueContextState;
  refreshQueue: () => Promise<void>;
  addTrack: (track: Track) => Promise<{ success: boolean; queuePosition?: number; error?: string; rateLimitInfo?: RateLimitInfo }>;
  updateQueue: (queueState: QueueState) => void;
  clearError: () => void;
}

// Initial state
const initialState: QueueContextState = {
  queueState: null,
  userContributions: [],
  isLoading: true,
  error: null,
  lastUpdated: null,
};

// Queue reducer
function queueReducer(state: QueueContextState, action: QueueAction): QueueContextState {
  switch (action.type) {
    case 'LOAD_QUEUE_START':
      return {
        ...state,
        isLoading: true,
        error: null,
      };

    case 'LOAD_QUEUE_SUCCESS':
      return {
        ...state,
        queueState: action.payload,
        isLoading: false,
        error: null,
        lastUpdated: new Date(),
      };

    case 'LOAD_QUEUE_ERROR':
      return {
        ...state,
        isLoading: false,
        error: action.payload,
      };

    case 'UPDATE_QUEUE':
      return {
        ...state,
        queueState: action.payload,
        lastUpdated: new Date(),
      };

    case 'ADD_TRACK_START':
      return {
        ...state,
        error: null,
      };

    case 'ADD_TRACK_SUCCESS':
      // The response contains position, not queueItem
      const newContribution: QueueContribution = {
        queueItemId: `temp-${Date.now()}`, // Temporary ID until queue updates
        position: action.payload.position,
        addedAt: new Date(),
        status: 'queued',
      };

      return {
        ...state,
        userContributions: [...state.userContributions, newContribution],
        error: null,
      };

    case 'ADD_TRACK_ERROR':
      return {
        ...state,
        error: action.payload,
      };

    case 'UPDATE_USER_CONTRIBUTIONS':
      return {
        ...state,
        userContributions: action.payload,
      };

    case 'CLEAR_ERROR':
      return {
        ...state,
        error: null,
      };

    default:
      return state;
  }
}

// Helper function to calculate user contributions from queue state
function calculateUserContributions(queueState: QueueState | null, deviceId: string): QueueContribution[] {
  if (!queueState) return [];

  const contributions: QueueContribution[] = [];

  // Check current track
  if (queueState.currentTrack && queueState.currentTrack.addedBy && queueState.currentTrack.addedBy.id === deviceId) {
    contributions.push({
      queueItemId: queueState.currentTrack.id,
      position: 0, // Currently playing
      addedAt: new Date(queueState.currentTrack.addedAt),
      status: 'playing',
    });
  }

  // Check upcoming tracks - ensure upcomingTracks exists and is an array
  if (queueState.upcomingTracks && Array.isArray(queueState.upcomingTracks)) {
    queueState.upcomingTracks.forEach((item, index) => {
      if (item && item.addedBy && item.addedBy.id === deviceId) {
        contributions.push({
          queueItemId: item.id,
          position: index + 1, // Position in queue (1-based)
          addedAt: new Date(item.addedAt),
          status: 'queued',
        });
      }
    });
  }

  return contributions;
}

// Create context
const QueueContext = createContext<QueueContextType | undefined>(undefined);

// Queue provider props
interface QueueProviderProps {
  children: ReactNode;
}

// Queue provider component
export function QueueProvider({ children }: QueueProviderProps) {
  const [state, dispatch] = useReducer(queueReducer, initialState);
  const { state: sessionState } = useSession();

  // Refresh queue from server
  const refreshQueue = useCallback(async () => {
    dispatch({ type: 'LOAD_QUEUE_START' });
    
    try {
      const queueState = await apiService.getQueueState();
      dispatch({ type: 'LOAD_QUEUE_SUCCESS', payload: queueState });
      
      // Update user contributions based on current queue state
      if (sessionState.session && sessionState.session.deviceId) {
        const contributions = calculateUserContributions(queueState, sessionState.session.deviceId);
        dispatch({ type: 'UPDATE_USER_CONTRIBUTIONS', payload: contributions });
      }
    } catch (error) {
      dispatch({ 
        type: 'LOAD_QUEUE_ERROR', 
        payload: `Failed to load queue: ${error instanceof Error ? error.message : 'Unknown error'}` 
      });
    }
  }, [sessionState.session]);

  // Add track to queue
  const addTrack = useCallback(async (track: Track) => {
    if (!sessionState.session) {
      const error = 'No active session';
      dispatch({ type: 'ADD_TRACK_ERROR', payload: error });
      return { success: false, error };
    }

    dispatch({ type: 'ADD_TRACK_START' });
    
    try {
      const response = await apiService.addTrack(track, {
        id: sessionState.session.deviceId,
        nickname: sessionState.session.nickname,
      });
      
      if (response.success && response.queuePosition !== undefined) {
        dispatch({ 
          type: 'ADD_TRACK_SUCCESS', 
          payload: { 
            position: response.queuePosition
          } 
        });
        return {
          success: true,
          queuePosition: response.queuePosition,
          rateLimitInfo: response.rateLimitInfo
        };
      } else {
        const error = response.error || 'Failed to add track';
        dispatch({ type: 'ADD_TRACK_ERROR', payload: error });
        return {
          success: false,
          error,
          rateLimitInfo: response.rateLimitInfo
        };
      }
    } catch (error) {
      const errorMessage = `Failed to add track: ${error instanceof Error ? error.message : 'Unknown error'}`;
      dispatch({ type: 'ADD_TRACK_ERROR', payload: errorMessage });
      return {
        success: false,
        error: errorMessage
      };
    }
  }, [sessionState.session]);

  // Update queue from WebSocket events
  const updateQueue = useCallback((queueState: QueueState) => {
    dispatch({ type: 'UPDATE_QUEUE', payload: queueState });
    
    // Update user contributions based on new queue state
    if (sessionState.session && sessionState.session.deviceId) {
      const contributions = calculateUserContributions(queueState, sessionState.session.deviceId);
      dispatch({ type: 'UPDATE_USER_CONTRIBUTIONS', payload: contributions });
    }
  }, [sessionState.session]);

  // Clear error
  const clearError = useCallback(() => {
    dispatch({ type: 'CLEAR_ERROR' });
  }, []);

  // Load initial queue state
  useEffect(() => {
    if (sessionState.session && !sessionState.isLoading) {
      refreshQueue();
    }
  }, [sessionState.session, sessionState.isLoading, refreshQueue]);

  // Update user contributions when session changes
  useEffect(() => {
    if (sessionState.session && sessionState.session.deviceId && state.queueState) {
      const contributions = calculateUserContributions(state.queueState, sessionState.session.deviceId);
      dispatch({ type: 'UPDATE_USER_CONTRIBUTIONS', payload: contributions });
    }
  }, [sessionState.session, state.queueState]);

  // Context value
  const contextValue: QueueContextType = {
    state,
    refreshQueue,
    addTrack,
    updateQueue,
    clearError,
  };

  return (
    <QueueContext.Provider value={contextValue}>
      {children}
    </QueueContext.Provider>
  );
}

// Hook to use queue context
export function useQueue(): QueueContextType {
  const context = useContext(QueueContext);
  if (context === undefined) {
    throw new Error('useQueue must be used within a QueueProvider');
  }
  return context;
}