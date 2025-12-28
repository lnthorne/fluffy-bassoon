import React, { useState, useCallback, useEffect } from 'react';
import { Track, SearchResult, TrackFactory, TrackValidator } from '@party-jukebox/shared';
import { RateLimitInfo } from '../types';
import { useRateLimit } from '../contexts';
import './AddTrackButton.css';

export interface AddTrackButtonProps {
  track: SearchResult;
  onAdd: (track: Track) => Promise<{ success: boolean; queuePosition?: number; error?: string; rateLimitInfo?: RateLimitInfo }>;
  disabled?: boolean;
  isRecentlyAdded?: boolean; // For duplicate prevention
}

export const AddTrackButton: React.FC<AddTrackButtonProps> = ({
  track,
  onAdd,
  disabled = false,
  isRecentlyAdded = false
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error' | 'rate-limit';
    message: string;
    queuePosition?: number;
  } | null>(null);
  
  const { state: rateLimitState, updateRateLimit, isActionAllowed, getTimeRemaining } = useRateLimit();
  const cooldownTime = getTimeRemaining();

  // Handle rate limit cooldown timer - now managed by RateLimitContext
  // Remove the old useEffect for cooldown timer

  // Clear feedback after a delay
  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => {
        setFeedback(null);
      }, feedback.type === 'success' ? 3000 : 5000);

      return () => clearTimeout(timer);
    }
  }, [feedback]);

  const handleAddTrack = useCallback(async () => {
    if (disabled || isLoading || isRecentlyAdded || !isActionAllowed()) {
      return;
    }

    setIsLoading(true);
    setFeedback(null);

    try {
      // Convert SearchResult to Track using the factory
      const trackCreateData = TrackFactory.fromSearchResult(track);
      const trackResult = TrackValidator.create(trackCreateData);

      if (!trackResult.success) {
        setFeedback({
          type: 'error',
          message: 'Invalid track data'
        });
        return;
      }

      const result = await onAdd(trackResult.value);

      // Update rate limit info if provided
      if (result.rateLimitInfo) {
        updateRateLimit(result.rateLimitInfo);
      }

      if (result.success) {
        setFeedback({
          type: 'success',
          message: result.queuePosition 
            ? `Added to queue at position ${result.queuePosition}`
            : 'Added to queue',
          queuePosition: result.queuePosition
        });
      } else if (result.rateLimitInfo?.isLimited) {
        setFeedback({
          type: 'rate-limit',
          message: result.error || 'Rate limited - please wait before adding more tracks'
        });
      } else {
        setFeedback({
          type: 'error',
          message: result.error || 'Failed to add track'
        });
      }
    } catch (error) {
      setFeedback({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to add track'
      });
    } finally {
      setIsLoading(false);
    }
  }, [track, onAdd, disabled, isLoading, isRecentlyAdded, isActionAllowed, updateRateLimit]);

  // Determine button state and styling
  const getButtonState = () => {
    if (isLoading) return 'loading';
    if (isRecentlyAdded) return 'duplicate';
    if (!isActionAllowed()) return 'rate-limited';
    if (disabled) return 'disabled';
    if (feedback?.type === 'success') return 'success';
    return 'default';
  };

  const buttonState = getButtonState();
  const isButtonDisabled = disabled || isLoading || isRecentlyAdded || !isActionAllowed();

  // Format cooldown time
  const formatCooldown = (seconds: number): string => {
    if (seconds >= 60) {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
    return `${seconds}s`;
  };

  return (
    <div className="add-track-button-container">
      <button
        className={`add-track-button add-track-button--${buttonState}`}
        onClick={handleAddTrack}
        disabled={isButtonDisabled}
        type="button"
        aria-label={
          isRecentlyAdded 
            ? 'Track already added'
            : !isActionAllowed()
            ? `Rate limited, wait ${formatCooldown(cooldownTime)}`
            : `Add ${track.title} to queue`
        }
      >
        <span className="add-track-button__icon">
          {isLoading && <span className="spinner">⟳</span>}
          {!isLoading && buttonState === 'success' && '✓'}
          {!isLoading && buttonState === 'duplicate' && '✓'}
          {!isLoading && buttonState === 'rate-limited' && '⏱'}
          {!isLoading && buttonState === 'default' && '+'}
          {!isLoading && buttonState === 'disabled' && '+'}
        </span>
        
        <span className="add-track-button__text">
          {isLoading && 'Adding...'}
          {!isLoading && buttonState === 'success' && 'Added!'}
          {!isLoading && buttonState === 'duplicate' && 'Already Added'}
          {!isLoading && buttonState === 'rate-limited' && formatCooldown(cooldownTime)}
          {!isLoading && (buttonState === 'default' || buttonState === 'disabled') && 'Add to Queue'}
        </span>
      </button>

      {/* Rate limit status indicator */}
      {rateLimitState.rateLimitInfo && !rateLimitState.isLimited && (
        <div className="rate-limit-status">
          <span className="rate-limit-remaining">
            {rateLimitState.rateLimitInfo.remainingRequests}/{rateLimitState.rateLimitInfo.maxRequests} requests remaining
          </span>
        </div>
      )}

      {/* Feedback messages */}
      {feedback && (
        <div className={`add-track-feedback add-track-feedback--${feedback.type}`}>
          <span className="feedback-icon">
            {feedback.type === 'success' && '✅'}
            {feedback.type === 'error' && '❌'}
            {feedback.type === 'rate-limit' && '⏱️'}
          </span>
          <span className="feedback-message">{feedback.message}</span>
        </div>
      )}
    </div>
  );
};