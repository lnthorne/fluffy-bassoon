import { createContext, useContext, useReducer, useEffect, ReactNode, useCallback } from 'react';
import { RateLimitInfo } from '../types';

// Rate limit state interface
interface RateLimitContextState {
  rateLimitInfo: RateLimitInfo | null;
  isLimited: boolean;
  timeUntilReset: number; // in seconds
  lastUpdated: Date | null;
}

// Rate limit actions
type RateLimitAction =
  | { type: 'UPDATE_RATE_LIMIT'; payload: RateLimitInfo }
  | { type: 'TICK_COUNTDOWN' }
  | { type: 'RESET_RATE_LIMIT' }
  | { type: 'CLEAR_RATE_LIMIT' };

// Rate limit context interface
interface RateLimitContextType {
  state: RateLimitContextState;
  updateRateLimit: (rateLimitInfo: RateLimitInfo) => void;
  clearRateLimit: () => void;
  resetRateLimit: () => void;
  isActionAllowed: () => boolean;
  getTimeRemaining: () => number;
}

// Initial state
const initialState: RateLimitContextState = {
  rateLimitInfo: null,
  isLimited: false,
  timeUntilReset: 0,
  lastUpdated: null,
};

// Rate limit reducer
function rateLimitReducer(state: RateLimitContextState, action: RateLimitAction): RateLimitContextState {
  switch (action.type) {
    case 'UPDATE_RATE_LIMIT':
      return {
        ...state,
        rateLimitInfo: action.payload,
        isLimited: action.payload.isLimited,
        timeUntilReset: action.payload.isLimited ? Math.ceil(action.payload.timeUntilReset / 1000) : 0,
        lastUpdated: new Date(),
      };

    case 'TICK_COUNTDOWN':
      if (state.timeUntilReset <= 1) {
        // Rate limit has expired
        return {
          ...state,
          isLimited: false,
          timeUntilReset: 0,
          rateLimitInfo: state.rateLimitInfo ? {
            ...state.rateLimitInfo,
            isLimited: false,
            timeUntilReset: 0,
            remainingRequests: state.rateLimitInfo.maxRequests, // Reset to max
          } : null,
        };
      }
      
      return {
        ...state,
        timeUntilReset: state.timeUntilReset - 1,
        rateLimitInfo: state.rateLimitInfo ? {
          ...state.rateLimitInfo,
          timeUntilReset: (state.timeUntilReset - 1) * 1000,
        } : null,
      };

    case 'RESET_RATE_LIMIT':
      return {
        ...state,
        isLimited: false,
        timeUntilReset: 0,
        rateLimitInfo: state.rateLimitInfo ? {
          ...state.rateLimitInfo,
          isLimited: false,
          timeUntilReset: 0,
          remainingRequests: state.rateLimitInfo.maxRequests,
        } : null,
      };

    case 'CLEAR_RATE_LIMIT':
      return initialState;

    default:
      return state;
  }
}

// Create context
const RateLimitContext = createContext<RateLimitContextType | undefined>(undefined);

// Rate limit provider props
interface RateLimitProviderProps {
  children: ReactNode;
}

// Rate limit provider component
export function RateLimitProvider({ children }: RateLimitProviderProps) {
  const [state, dispatch] = useReducer(rateLimitReducer, initialState);

  // Update rate limit information
  const updateRateLimit = useCallback((rateLimitInfo: RateLimitInfo) => {
    console.log('🔍 RateLimitContext - Updating rate limit:', rateLimitInfo);
    dispatch({ type: 'UPDATE_RATE_LIMIT', payload: rateLimitInfo });
  }, []);

  // Clear rate limit information
  const clearRateLimit = useCallback(() => {
    dispatch({ type: 'CLEAR_RATE_LIMIT' });
  }, []);

  // Reset rate limit (manually expire)
  const resetRateLimit = useCallback(() => {
    dispatch({ type: 'RESET_RATE_LIMIT' });
  }, []);

  // Check if an action is allowed
  const isActionAllowed = useCallback((): boolean => {
    // If no rate limit info, allow the action
    if (!state.rateLimitInfo) {
      return true;
    }
    
    // User is allowed if they are not currently rate limited
    // The remainingRequests check is handled by the server, not the client
    const allowed = !state.isLimited;
    
    console.log('🔍 RateLimitContext - isActionAllowed:', allowed, 'state:', {
      isLimited: state.isLimited,
      remainingRequests: state.rateLimitInfo?.remainingRequests,
      timeUntilReset: state.timeUntilReset
    });
    return allowed;
  }, [state.isLimited]);

  // Get time remaining in seconds
  const getTimeRemaining = useCallback((): number => {
    return state.timeUntilReset;
  }, [state.timeUntilReset]);

  // Countdown timer effect
  useEffect(() => {
    if (state.isLimited && state.timeUntilReset > 0) {
      const interval = setInterval(() => {
        dispatch({ type: 'TICK_COUNTDOWN' });
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [state.isLimited, state.timeUntilReset]);

  // Auto-clear expired rate limits
  useEffect(() => {
    if (state.rateLimitInfo && !state.isLimited && state.timeUntilReset === 0) {
      // Rate limit has naturally expired, we can keep the info but mark as not limited
      // This allows components to show "ready" status
    }
  }, [state.rateLimitInfo, state.isLimited, state.timeUntilReset]);

  // Context value
  const contextValue: RateLimitContextType = {
    state,
    updateRateLimit,
    clearRateLimit,
    resetRateLimit,
    isActionAllowed,
    getTimeRemaining,
  };

  return (
    <RateLimitContext.Provider value={contextValue}>
      {children}
    </RateLimitContext.Provider>
  );
}

// Hook to use rate limit context
export function useRateLimit(): RateLimitContextType {
  const context = useContext(RateLimitContext);
  if (context === undefined) {
    throw new Error('useRateLimit must be used within a RateLimitProvider');
  }
  return context;
}