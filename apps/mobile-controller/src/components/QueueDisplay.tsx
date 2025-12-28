import React, { useMemo } from 'react';
import { QueueState, QueueItem } from '@party-jukebox/shared';
import './QueueDisplay.css';

export interface QueueDisplayProps {
  queueState: QueueState | null;
  currentDeviceId: string;
  maxVisible?: number;
  highlightUserTracks?: boolean;
  showCurrentTrack?: boolean;
}

export const QueueDisplay: React.FC<QueueDisplayProps> = ({
  queueState,
  currentDeviceId,
  maxVisible = 10,
  highlightUserTracks = true,
  showCurrentTrack = true
}) => {
  // Format duration from seconds to MM:SS
  const formatDuration = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Format relative time (e.g., "2 minutes ago")
  const formatRelativeTime = (date: Date | string): string => {
    const now = new Date();
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    
    // Check if the date is valid
    if (!dateObj || isNaN(dateObj.getTime())) {
      return 'unknown';
    }
    
    const diffMs = now.getTime() - dateObj.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    
    if (diffMinutes < 1) return 'just now';
    if (diffMinutes === 1) return '1 minute ago';
    if (diffMinutes < 60) return `${diffMinutes} minutes ago`;
    
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours === 1) return '1 hour ago';
    if (diffHours < 24) return `${diffHours} hours ago`;
    
    return dateObj.toLocaleDateString();
  };

  // Check if a track was added by the current device
  const isUserTrack = (queueItem: QueueItem): boolean => {
    return queueItem && queueItem.addedBy && queueItem.addedBy.id === currentDeviceId;
  };

  // Get visible upcoming tracks (limited by maxVisible)
  const visibleUpcomingTracks = useMemo(() => {
    if (!queueState || !queueState.upcomingTracks || !Array.isArray(queueState.upcomingTracks)) {
      return [];
    }
    return queueState.upcomingTracks.slice(0, maxVisible);
  }, [queueState, maxVisible]);

  // Count user's tracks in the queue
  const userTrackCount = useMemo(() => {
    if (!queueState) return 0;
    
    let count = 0;
    if (queueState.currentTrack && isUserTrack(queueState.currentTrack)) {
      count++;
    }
    if (queueState.upcomingTracks && Array.isArray(queueState.upcomingTracks)) {
      count += queueState.upcomingTracks.filter(isUserTrack).length;
    }
    return count;
  }, [queueState, currentDeviceId]);

  // Render a queue item
  const renderQueueItem = (
    queueItem: QueueItem, 
    position: number, 
    isCurrent: boolean = false
  ) => {
    const isFromUser = highlightUserTracks && isUserTrack(queueItem);
    
    return (
      <div
        key={queueItem.id}
        className={`queue-item ${isCurrent ? 'queue-item--current' : ''} ${isFromUser ? 'queue-item--user' : ''}`}
      >
        <div className="queue-item__position">
          {isCurrent ? (
            <span className="now-playing-indicator">♪</span>
          ) : (
            <span className="position-number">{position}</span>
          )}
        </div>

        <div className="queue-item__thumbnail">
          {queueItem.track.thumbnailUrl ? (
            <img 
              src={queueItem.track.thumbnailUrl} 
              alt={`${queueItem.track.title} thumbnail`}
              loading="lazy"
            />
          ) : (
            <div className="thumbnail-placeholder">🎵</div>
          )}
        </div>

        <div className="queue-item__info">
          <div className="queue-item__title">{queueItem.track.title}</div>
          <div className="queue-item__artist">{queueItem.track.artist}</div>
          <div className="queue-item__meta">
            <span className="queue-item__duration">
              {formatDuration(queueItem.track.duration)}
            </span>
            <span className="queue-item__contributor">
              {isFromUser ? 'You' : queueItem.addedBy.nickname}
            </span>
            <span className="queue-item__time">
              {formatRelativeTime(queueItem.addedAt)}
            </span>
          </div>
        </div>

        {isFromUser && (
          <div className="queue-item__user-badge">
            <span>Your track</span>
          </div>
        )}
      </div>
    );
  };

  // Handle empty queue state
  if (!queueState || queueState.isEmpty) {
    return (
      <div className="queue-display queue-display--empty">
        <div className="empty-queue">
          <div className="empty-queue__icon">🎵</div>
          <div className="empty-queue__title">Queue is empty</div>
          <div className="empty-queue__message">
            Be the first to add some music to get the party started!
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="queue-display">
      {/* Queue Summary */}
      <div className="queue-summary">
        <div className="queue-summary__stats">
          <span className="total-tracks">
            {queueState?.totalLength || 0} track{(queueState?.totalLength || 0) !== 1 ? 's' : ''} in queue
          </span>
          {userTrackCount > 0 && (
            <span className="user-tracks">
              • {userTrackCount} from you
            </span>
          )}
        </div>
      </div>

      {/* Currently Playing */}
      {showCurrentTrack && queueState?.currentTrack && (
        <div className="current-track-section">
          <h3 className="section-title">Now Playing</h3>
          {renderQueueItem(queueState.currentTrack, 0, true)}
        </div>
      )}

      {/* Upcoming Tracks */}
      {visibleUpcomingTracks.length > 0 && (
        <div className="upcoming-tracks-section">
          <h3 className="section-title">
            Up Next
            {queueState?.upcomingTracks && queueState.upcomingTracks.length > maxVisible && (
              <span className="section-subtitle">
                (showing {maxVisible} of {queueState.upcomingTracks.length})
              </span>
            )}
          </h3>
          <div className="upcoming-tracks-list">
            {visibleUpcomingTracks.map((queueItem, index) => 
              renderQueueItem(queueItem, index + 1)
            )}
          </div>
        </div>
      )}

      {/* Show more indicator */}
      {queueState?.upcomingTracks && queueState.upcomingTracks.length > maxVisible && (
        <div className="queue-more-indicator">
          <span>
            + {queueState.upcomingTracks.length - maxVisible} more track{queueState.upcomingTracks.length - maxVisible !== 1 ? 's' : ''}
          </span>
        </div>
      )}
    </div>
  );
};