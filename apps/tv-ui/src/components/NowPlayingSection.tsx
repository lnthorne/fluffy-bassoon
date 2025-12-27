import { usePlayback } from '../contexts/PlaybackContext';
import { useConnection } from '../contexts/ConnectionContext';

interface NowPlayingSectionProps {
  className?: string;
}

export function NowPlayingSection({ className = '' }: NowPlayingSectionProps) {
  const { state: playbackState } = usePlayback();
  const { state: connectionState } = useConnection();

  const { currentTrack, status, position, duration, error } = playbackState;
  const isOffline = !connectionState.isOnline;

  // Format time in MM:SS format
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Calculate progress percentage
  const progressPercentage = duration > 0 ? (position / duration) * 100 : 0;

  // Render idle state when no music is playing
  if (!currentTrack || status === 'idle') {
    return (
      <section 
        className={`now-playing-section now-playing-idle ${className}`}
        role="main"
        aria-label="Now playing section"
      >
        <div className="idle-message">
          <h2>No music playing</h2>
          <p>
            <span className="sr-only">Status: </span>
            Waiting for music to be added to the queue
          </p>
          {isOffline && (
            <p className="offline-indicator" role="alert">
              <span className="sr-only">Warning: </span>
              Offline - Check connection
            </p>
          )}
        </div>
      </section>
    );
  }

  // Render error state
  if (status === 'error' && error) {
    return (
      <section 
        className={`now-playing-section now-playing-error ${className}`}
        role="main"
        aria-label="Now playing section"
      >
        <div className="error-message">
          <h2>Playback Error</h2>
          <p role="alert">{error}</p>
          {currentTrack && (
            <div className="error-track-info">
              <p>
                <span className="sr-only">Failed track: </span>
                "{currentTrack.track.title}" by {currentTrack.track.artist}
              </p>
            </div>
          )}
        </div>
      </section>
    );
  }

  return (
    <section 
      className={`now-playing-section now-playing-active ${className}`}
      role="main"
      aria-label="Now playing section"
    >
      {/* Track artwork */}
      <div className="track-artwork" role="img" aria-label="Album artwork">
        {currentTrack.track.thumbnailUrl ? (
          <img 
            src={currentTrack.track.thumbnailUrl} 
            alt={`Album artwork for ${currentTrack.track.title} by ${currentTrack.track.artist}`}
            className="artwork-image"
          />
        ) : (
          <div 
            className="artwork-placeholder"
            role="img"
            aria-label="No album artwork available"
          >
            <div className="music-icon" aria-hidden="true">♪</div>
          </div>
        )}
      </div>

      {/* Track information */}
      <div className="track-info">
        <h1 className="track-title">
          <span className="sr-only">Now playing: </span>
          {currentTrack.track.title}
        </h1>
        <h2 className="track-artist">
          <span className="sr-only">Artist: </span>
          {currentTrack.track.artist}
        </h2>
        
        {/* Playback status indicator */}
        <div className="playback-status" role="status" aria-live="polite">
          <span 
            className={`status-indicator status-${status}`}
            aria-hidden="true"
          >
            {status === 'playing' && '▶'}
            {status === 'paused' && '⏸'}
            {status === 'resolving' && '⏳'}
          </span>
          <span className="status-text">
            <span className="sr-only">Playback status: </span>
            {status === 'playing' && 'Playing'}
            {status === 'paused' && 'Paused'}
            {status === 'resolving' && 'Loading...'}
          </span>
        </div>

        {/* Progress bar and time display */}
        {duration > 0 && (
          <div className="progress-section">
            <div 
              className="progress-bar"
              role="progressbar"
              aria-valuenow={Math.round(progressPercentage)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Playback progress: ${formatTime(position)} of ${formatTime(duration)}`}
            >
              <div 
                className="progress-fill"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
            <div className="time-display" aria-label="Playback time">
              <span className="current-time">
                <span className="sr-only">Current time: </span>
                {formatTime(position)}
              </span>
              <span className="duration">
                <span className="sr-only">Total duration: </span>
                {formatTime(duration)}
              </span>
            </div>
          </div>
        )}

        {/* Added by information */}
        <div className="added-by">
          <span className="sr-only">Track </span>
          Added by {currentTrack.addedBy.nickname}
        </div>
      </div>
    </section>
  );
}