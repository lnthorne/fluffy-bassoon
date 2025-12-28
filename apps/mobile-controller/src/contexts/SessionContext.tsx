import { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { UserSession } from '../types';
import { storageService, deviceIdentityService } from '../services';

// Session state interface
interface SessionState {
  session: UserSession | null;
  isLoading: boolean;
  error: string | null;
}

// Session actions
type SessionAction =
  | { type: 'LOAD_SESSION_START' }
  | { type: 'LOAD_SESSION_SUCCESS'; payload: UserSession }
  | { type: 'LOAD_SESSION_ERROR'; payload: string }
  | { type: 'UPDATE_NICKNAME'; payload: string }
  | { type: 'UPDATE_PREFERENCES'; payload: Partial<UserSession['preferences']> }
  | { type: 'RESET_SESSION' }
  | { type: 'CLEAR_ERROR' };

// Session context interface
interface SessionContextType {
  state: SessionState;
  updateNickname: (nickname: string) => void;
  updatePreferences: (preferences: Partial<UserSession['preferences']>) => void;
  resetSession: () => void;
  clearError: () => void;
}

// Initial state
const initialState: SessionState = {
  session: null,
  isLoading: true,
  error: null,
};

// Session reducer
function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case 'LOAD_SESSION_START':
      return {
        ...state,
        isLoading: true,
        error: null,
      };

    case 'LOAD_SESSION_SUCCESS':
      return {
        ...state,
        session: action.payload,
        isLoading: false,
        error: null,
      };

    case 'LOAD_SESSION_ERROR':
      return {
        ...state,
        session: null,
        isLoading: false,
        error: action.payload,
      };

    case 'UPDATE_NICKNAME':
      if (!state.session) return state;
      
      const updatedSession = {
        ...state.session,
        nickname: action.payload,
        lastActive: new Date(),
      };
      
      // Persist to storage
      try {
        storageService.saveSession(updatedSession);
      } catch (error) {
        console.error('Failed to save session after nickname update:', error);
      }
      
      return {
        ...state,
        session: updatedSession,
      };

    case 'UPDATE_PREFERENCES':
      if (!state.session) return state;
      
      const sessionWithUpdatedPrefs = {
        ...state.session,
        preferences: {
          ...state.session.preferences,
          ...action.payload,
        },
        lastActive: new Date(),
      };
      
      // Persist to storage
      try {
        storageService.saveSession(sessionWithUpdatedPrefs);
      } catch (error) {
        console.error('Failed to save session after preferences update:', error);
      }
      
      return {
        ...state,
        session: sessionWithUpdatedPrefs,
      };

    case 'RESET_SESSION':
      // Clear storage and create new session
      try {
        storageService.clearSession();
        const newDeviceId = deviceIdentityService.generateNewDeviceId();
        const newSession: UserSession = {
          deviceId: newDeviceId,
          nickname: `Guest-${newDeviceId.slice(-4)}`,
          createdAt: new Date(),
          lastActive: new Date(),
          preferences: {
            autoRefresh: true,
            showNotifications: true,
          },
        };
        storageService.saveSession(newSession);
        
        return {
          ...state,
          session: newSession,
          error: null,
        };
      } catch (error) {
        return {
          ...state,
          error: `Failed to reset session: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }

    case 'CLEAR_ERROR':
      return {
        ...state,
        error: null,
      };

    default:
      return state;
  }
}

// Create context
const SessionContext = createContext<SessionContextType | undefined>(undefined);

// Session provider props
interface SessionProviderProps {
  children: ReactNode;
}

// Session provider component
export function SessionProvider({ children }: SessionProviderProps) {
  const [state, dispatch] = useReducer(sessionReducer, initialState);

  // Load session on mount
  useEffect(() => {
    const loadSession = async () => {
      dispatch({ type: 'LOAD_SESSION_START' });
      
      try {
        // Try to load existing session
        const existingSession = storageService.loadSession();
        
        if (existingSession) {
          // Update last active time
          const updatedSession = {
            ...existingSession,
            lastActive: new Date(),
          };
          storageService.saveSession(updatedSession);
          dispatch({ type: 'LOAD_SESSION_SUCCESS', payload: updatedSession });
        } else {
          // Create new session
          const deviceId = deviceIdentityService.getDeviceId();
          const newSession: UserSession = {
            deviceId,
            nickname: `Guest-${deviceId.slice(-4)}`,
            createdAt: new Date(),
            lastActive: new Date(),
            preferences: {
              autoRefresh: true,
              showNotifications: true,
            },
          };
          
          storageService.saveSession(newSession);
          dispatch({ type: 'LOAD_SESSION_SUCCESS', payload: newSession });
        }
      } catch (error) {
        dispatch({ 
          type: 'LOAD_SESSION_ERROR', 
          payload: `Failed to load session: ${error instanceof Error ? error.message : 'Unknown error'}` 
        });
      }
    };

    loadSession();
  }, []);

  // Context value
  const contextValue: SessionContextType = {
    state,
    updateNickname: (nickname: string) => {
      dispatch({ type: 'UPDATE_NICKNAME', payload: nickname });
    },
    updatePreferences: (preferences: Partial<UserSession['preferences']>) => {
      dispatch({ type: 'UPDATE_PREFERENCES', payload: preferences });
    },
    resetSession: () => {
      dispatch({ type: 'RESET_SESSION' });
    },
    clearError: () => {
      dispatch({ type: 'CLEAR_ERROR' });
    },
  };

  return (
    <SessionContext.Provider value={contextValue}>
      {children}
    </SessionContext.Provider>
  );
}

// Hook to use session context
export function useSession(): SessionContextType {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
}