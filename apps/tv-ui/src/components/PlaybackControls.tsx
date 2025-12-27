import { useState } from 'react';
import { usePlayback } from '../contexts/PlaybackContext';
import { useConnection } from '../contexts/ConnectionContext';
import { APIService } from '../services/APIService';

interface PlaybackControlsProps {
  apiService: APIService;
  className?: string;
}

export function PlaybackControls({ apiService, className = '' }: PlaybackControlsProps) {
  const { state: playbackState, actions: playbackActions } = usePlayback();
  const { state: connectionState } = useConnection();
  
  const [isLoading, setIsLoading] = useState<string | null>(null); // Track which button is loading

  const { status, currentTrack } = playbackState;
  const isOffline = !connectionState.isOnline;
  const isDisabled = isOffline || status === 'error';

  // Handle play/pause button click
  const handlePlayPause = async () => {
    if (isDisabled || isLoading) return;

    const action = status === 'playing' ? 'pause' : 'resume';
    setIsLoading(action);

    try {
      const response = action === 'pause' 
        ? await apiService.pausePlayback()
        : await apiService.resumePlayback();

      if (response.success && response.data) {
        // Update playback state with server response
        playbackActions.setPlaybackStatus({
          status: response.data.newStatus.status,
          position: response.data.newStatus.position,
          duration: response.data.newStatus.duration,
        });
      } else {
        // Handle API error
        const errorMessage = response.error?.message || `Failed to ${action} playback`;
        playbackActions.setError(errorMessage);
        console.error(`Playback ${action} failed:`, response.error);
      }
    } catch (error) {
      const errorMessage = `Network error during ${action}`;
      playbackActions.setError(errorMessage);
      console.error(`Playback ${action} error:`, error);
    } finally {
      setIsLoading(null);
    }
  };

  // Handle skip button click
  const handleSkip = async () => {
    if (isDisabled || isLoading) return;

    setIsLoading('skip');

    try {
      const response = await apiService.skipTrack();

      if (response.success && response.data) {
        // Update playback state with server response
        playbackActions.setPlaybackStatus({
          status: response.data.newStatus.status,
          currentTrack: response.data.newStatus.currentTrack,
          position: response.data.newStatus.position,
          duration: response.data.newStatus.duration,
        });
      } else {
        // Handle API error
        const errorMessage = response.error?.message || 'Failed to skip track';
        playbackActions.setError(errorMessage);
        console.error('Skip track failed:', response.error);
      }
    } catch (error) {
      const errorMessage = 'Network error during skip';
      playbackActions.setError(errorMessage);
      console.error('Skip track error:', error);
    } finally {
      setIsLoading(null);
    }
  };

  // Determine button states and labels
  const getPlayPauseButton = () => {
    if (isLoading === 'pause' || isLoading === 'resume') {
      return {
        icon: '⏳',
        label: 'Loading...',
        ariaLabel: 'Loading playback action',
      };
    }

    if (status === 'playing') {
      return {
        icon: '⏸',
        label: 'Pause',
        ariaLabel: 'Pause playback',
      };
    }

    return {
      icon: '▶',
      label: 'Play',
      ariaLabel: status === 'paused' ? 'Resume playback' : 'Start playback',
    };
  };

  const getSkipButton = () => {
    if (isLoading === 'skip') {
      return {
        icon: '⏳',
        label: 'Skipping...',
        ariaLabel: 'Skipping track',
      };
    }

    return {
      icon: '⏭',
      label: 'Skip',
      ariaLabel: 'Skip to next track',
    };
  };

  const playPauseButton = getPlayPauseButton();
  const skipButton = getSkipButton();

  // Show disabled state message when offline
  const getDisabledMessage = () => {
    if (isOffline) {
      return 'Offline - Controls disabled';
    }
    if (status === 'error') {
      return 'Error - Controls disabled';
    }
    return null;
  };

  const disabledMessage = getDisabledMessage();

  return (
    <div className={`playback-controls ${className}`}>
      {/* Disabled state message */}
      {disabledMessage && (
        <div className="controls-disabled-message">
          {disabledMessage}
        </div>
      )}

      {/* Control buttons */}
      <div className="controls-buttons">
        {/* Play/Pause Button */}
        <button
          className={`control-button play-pause-button ${status === 'playing' ? 'playing' : 'paused'}`}
          onClick={handlePlayPause}
          disabled={isDisabled || isLoading !== null}
          aria-label={playPauseButton.ariaLabel}
          title={playPauseButton.ariaLabel}
        >
          <span className="button-icon" aria-hidden="true">
            {playPauseButton.icon}
          </span>
          <span className="button-label">
            {playPauseButton.label}
          </span>
        </button>

        {/* Skip Button */}
        <button
          className="control-button skip-button"
          onClick={handleSkip}
          disabled={isDisabled || isLoading !== null || !currentTrack}
          aria-label={skipButton.ariaLabel}
          title={skipButton.ariaLabel}
        >
          <span className="button-icon" aria-hidden="true">
            {skipButton.icon}
          </span>
          <span className="button-label">
            {skipButton.label}
          </span>
        </button>
      </div>

      {/* Status indicator */}
      <div className="playback-status-indicator">
        <div className={`status-dot status-${status}`} aria-hidden="true" />
        <span className="status-text">
          {status === 'idle' && 'Ready'}
          {status === 'resolving' && 'Loading track...'}
          {status === 'playing' && 'Playing'}
          {status === 'paused' && 'Paused'}
          {status === 'error' && 'Error'}
        </span>
        {isOffline && (
          <span className="offline-indicator" aria-label="Offline">
            📡
          </span>
        )}
      </div>
    </div>
  );
}