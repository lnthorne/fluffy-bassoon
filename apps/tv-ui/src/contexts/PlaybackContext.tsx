import { createContext, useContext, useReducer, ReactNode } from 'react';
import { QueueItem } from '@party-jukebox/shared';
import { PlaybackStatus } from '../types';

// Action types for playback state updates
type PlaybackAction =
  | { type: 'SET_PLAYBACK_STATUS'; payload: Partial<PlaybackStatus> }
  | { type: 'SET_CURRENT_TRACK'; payload: QueueItem | null }
  | { type: 'UPDATE_PROGRESS'; payload: { position: number; duration: number } }
  | { type: 'SET_ERROR'; payload: string }
  | { type: 'CLEAR_ERROR' }
  | { type: 'RESET_STATE' };

// Initial state
const initialPlaybackState: PlaybackStatus = {
  status: 'idle',
  currentTrack: null,
  position: 0,
  duration: 0,
  volume: 100,
  error: undefined,
};

// Reducer function
function playbackReducer(state: PlaybackStatus, action: PlaybackAction): PlaybackStatus {
  switch (action.type) {
    case 'SET_PLAYBACK_STATUS':
      return {
        ...state,
        ...action.payload,
        error: action.payload.status === 'error' ? state.error : undefined,
      };
    
    case 'SET_CURRENT_TRACK':
      return {
        ...state,
        currentTrack: action.payload,
        position: 0,
        duration: 0,
        error: undefined,
      };
    
    case 'UPDATE_PROGRESS':
      return {
        ...state,
        position: action.payload.position,
        duration: action.payload.duration,
      };
    
    case 'SET_ERROR':
      return {
        ...state,
        status: 'error',
        error: action.payload,
      };
    
    case 'CLEAR_ERROR':
      return {
        ...state,
        error: undefined,
        status: state.status === 'error' ? 'idle' : state.status,
      };
    
    case 'RESET_STATE':
      return initialPlaybackState;
    
    default:
      return state;
  }
}

// Context interface
interface PlaybackContextType {
  state: PlaybackStatus;
  actions: {
    setPlaybackStatus: (status: Partial<PlaybackStatus>) => void;
    setCurrentTrack: (track: QueueItem | null) => void;
    updateProgress: (position: number, duration: number) => void;
    setError: (error: string) => void;
    clearError: () => void;
    resetState: () => void;
  };
}

// Create context
const PlaybackContext = createContext<PlaybackContextType | undefined>(undefined);

// Provider component
interface PlaybackProviderProps {
  children: ReactNode;
}

export function PlaybackProvider({ children }: PlaybackProviderProps) {
  const [state, dispatch] = useReducer(playbackReducer, initialPlaybackState);

  const actions = {
    setPlaybackStatus: (status: Partial<PlaybackStatus>) => {
      dispatch({ type: 'SET_PLAYBACK_STATUS', payload: status });
    },
    
    setCurrentTrack: (track: QueueItem | null) => {
      dispatch({ type: 'SET_CURRENT_TRACK', payload: track });
    },
    
    updateProgress: (position: number, duration: number) => {
      dispatch({ type: 'UPDATE_PROGRESS', payload: { position, duration } });
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
  };

  return (
    <PlaybackContext.Provider value={{ state, actions }}>
      {children}
    </PlaybackContext.Provider>
  );
}

// Hook for using the context
export function usePlayback() {
  const context = useContext(PlaybackContext);
  if (context === undefined) {
    throw new Error('usePlayback must be used within a PlaybackProvider');
  }
  return context;
}