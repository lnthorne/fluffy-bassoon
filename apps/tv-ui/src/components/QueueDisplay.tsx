import type { QueueItem } from '@party-jukebox/shared';
import { useQueue } from '../contexts/QueueContext';
import { usePlayback } from '../contexts/PlaybackContext';

interface QueueDisplayProps {
  maxVisible?: number;
  className?: string;
}

export function QueueDisplay({ maxVisible = 5, className = '' }: QueueDisplayProps) {
  const { state } = useQueue();
  const { state: playbackState } = usePlayback();
  const { items, isLoading, error } = state;

  // Filter out the currently playing track from the queue display
  const upcomingItems = items.filter(item => {
    // If there's a current track playing, exclude it from the "Up Next" list
    return !playbackState.currentTrack || item.id !== playbackState.currentTrack.id;
  });

  // Get upcoming tracks with limit for screen space management
  const upcomingTracks = maxVisible ? upcomingItems.slice(0, maxVisible) : upcomingItems;
  const hasMoreTracks = upcomingItems.length > maxVisible;
  const isQueueEmpty = upcomingItems.length === 0;

  if (error) {
    return (
      <section 
        className={`queue-display queue-error ${className}`}
        role="region"
        aria-label="Music queue"
      >
        <div className="queue-header">
          <h3>Queue</h3>
        </div>
        <div className="error-message" role="alert">
          <p>Unable to load queue</p>
          <p className="error-details">{error}</p>
        </div>
      </section>
    );
  }

  if (isLoading) {
    return (
      <section 
        className={`queue-display queue-loading ${className}`}
        role="region"
        aria-label="Music queue"
      >
        <div className="queue-header">
          <h3>Queue</h3>
        </div>
        <div className="loading-message" aria-live="polite">
          <p>Loading queue...</p>
        </div>
      </section>
    );
  }

  if (isQueueEmpty) {
    return (
      <section 
        className={`queue-display queue-empty ${className}`}
        role="region"
        aria-label="Music queue"
      >
        <div className="queue-header">
          <h3>Up Next</h3>
        </div>
        <div className="empty-message">
          <p>Queue is empty</p>
          <p className="empty-subtitle">Guests can add music using the controller</p>
        </div>
      </section>
    );
  }

  return (
    <section 
      className={`queue-display queue-active ${className}`}
      role="region"
      aria-label="Music queue"
    >
      <div className="queue-header">
        <h3>Up Next</h3>
        <span 
          className="queue-count"
          aria-label={`${upcomingItems.length} track${upcomingItems.length !== 1 ? 's' : ''} in queue`}
        >
          {upcomingItems.length} track{upcomingItems.length !== 1 ? 's' : ''}
        </span>
      </div>
      
      <div 
        className="queue-list"
        role="list"
        aria-label="Upcoming tracks"
      >
        {upcomingTracks.map((item, index) => (
          <QueueItem key={item.id} item={item} position={index + 1} />
        ))}
        
        {hasMoreTracks && (
          <div 
            className="queue-more-indicator"
            role="listitem"
            aria-label={`${upcomingItems.length - maxVisible} additional tracks not shown`}
          >
            <p>+ {upcomingItems.length - maxVisible} more track{upcomingItems.length - maxVisible !== 1 ? 's' : ''}</p>
          </div>
        )}
      </div>
    </section>
  );
}

interface QueueItemProps {
  item: QueueItem;
  position: number;
}

function QueueItem({ item, position }: QueueItemProps) {
  const { track, addedBy } = item;
  const durationText = track.duration ? formatDuration(track.duration) : '';

  return (
    <div 
      className="queue-item"
      role="listitem"
      aria-label={`Position ${position}: ${track.title} by ${track.artist}, added by ${addedBy.nickname}${durationText ? `, duration ${durationText}` : ''}`}
    >
      <div 
        className="queue-position"
        aria-label={`Position ${position}`}
      >
        {position}
      </div>
      
      <div className="queue-track-info">
        <div className="queue-track-title">
          <span className="sr-only">Track: </span>
          {track.title}
        </div>
        <div className="queue-track-artist">
          <span className="sr-only">Artist: </span>
          {track.artist}
        </div>
        <div className="queue-added-by">
          <span className="sr-only">Added by: </span>
          Added by {addedBy.nickname}
        </div>
      </div>
      
      {track.duration && (
        <div 
          className="queue-track-duration"
          aria-label={`Duration: ${durationText}`}
        >
          <span className="sr-only">Duration: </span>
          {durationText}
        </div>
      )}
    </div>
  );
}

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}