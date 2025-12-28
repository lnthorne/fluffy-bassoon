import { useState, useEffect } from 'react';
import { useSession } from '../contexts/SessionContext';
import './SessionSetup.css';

export interface SessionSetupProps {
  onSessionReady?: () => void;
  className?: string;
}

export function SessionSetup({ onSessionReady, className }: SessionSetupProps) {
  const { state, updateNickname, clearError } = useSession();
  const [nickname, setNickname] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSkip, setShowSkip] = useState(false);

  // Show skip option after a few seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSkip(true);
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  // Call onSessionReady when session is loaded and ready
  useEffect(() => {
    if (state.session && !state.isLoading && onSessionReady) {
      onSessionReady();
    }
  }, [state.session, state.isLoading, onSessionReady]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isSubmitting) return;
    
    const trimmedNickname = nickname.trim();
    if (!trimmedNickname) return;

    setIsSubmitting(true);
    
    try {
      updateNickname(trimmedNickname);
      // The session context will handle persistence
    } catch (error) {
      console.error('Failed to set nickname:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = () => {
    // Use the default nickname that was generated
    if (state.session) {
      // Session already exists with default nickname, just proceed
      if (onSessionReady) {
        onSessionReady();
      }
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNickname(e.target.value);
    // Clear any existing errors when user starts typing
    if (state.error) {
      clearError();
    }
  };

  // Don't render if session is already loaded and has a custom nickname
  if (state.session && !state.session.nickname.startsWith('Guest-')) {
    return null;
  }

  // Show loading state
  if (state.isLoading) {
    return (
      <div className={`session-setup ${className || ''}`}>
        <div className="session-setup__loading">
          <div className="session-setup__spinner" />
          <p>Setting up your session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`session-setup ${className || ''}`}>
      <div className="session-setup__container">
        <div className="session-setup__header">
          <h1>Welcome to Party Jukebox!</h1>
          <p>Choose a nickname so others can see who added which tracks.</p>
        </div>

        <form onSubmit={handleSubmit} className="session-setup__form">
          <div className="session-setup__input-group">
            <label htmlFor="nickname" className="session-setup__label">
              Your Nickname
            </label>
            <input
              id="nickname"
              type="text"
              value={nickname}
              onChange={handleInputChange}
              placeholder="Enter your nickname"
              className="session-setup__input"
              maxLength={20}
              autoComplete="off"
              autoFocus
              disabled={isSubmitting}
            />
            <div className="session-setup__input-hint">
              This will be shown next to tracks you add
            </div>
          </div>

          {state.error && (
            <div className="session-setup__error">
              {state.error}
            </div>
          )}

          <div className="session-setup__actions">
            <button
              type="submit"
              disabled={!nickname.trim() || isSubmitting}
              className="session-setup__submit"
            >
              {isSubmitting ? 'Setting up...' : 'Get Started'}
            </button>

            {showSkip && (
              <button
                type="button"
                onClick={handleSkip}
                className="session-setup__skip"
                disabled={isSubmitting}
              >
                Skip for now
              </button>
            )}
          </div>
        </form>

        <div className="session-setup__footer">
          <p>
            {state.session && (
              <>Device ID: {state.session.deviceId.slice(-8)}</>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}