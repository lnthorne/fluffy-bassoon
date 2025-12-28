import React, { useState, useEffect } from 'react';
import { RateLimitInfo } from '../types';
import './RateLimitIndicator.css';

export interface RateLimitIndicatorProps {
  rateLimitInfo: RateLimitInfo;
  className?: string;
  compact?: boolean;
}

export const RateLimitIndicator: React.FC<RateLimitIndicatorProps> = ({
  rateLimitInfo,
  className = '',
  compact = false
}) => {
  const [timeRemaining, setTimeRemaining] = useState(0);

  // Update countdown timer
  useEffect(() => {
    if (rateLimitInfo.isLimited && rateLimitInfo.timeUntilReset > 0) {
      setTimeRemaining(Math.ceil(rateLimitInfo.timeUntilReset / 1000));
      
      const interval = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(interval);
    } else {
      setTimeRemaining(0);
    }
  }, [rateLimitInfo.timeUntilReset, rateLimitInfo.isLimited]);

  // Format time remaining
  const formatTime = (seconds: number): string => {
    if (seconds >= 60) {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
    return `${seconds}s`;
  };

  // Calculate progress percentage
  const progressPercentage = rateLimitInfo.windowDuration > 0 
    ? Math.max(0, Math.min(100, ((rateLimitInfo.windowDuration - rateLimitInfo.timeUntilReset) / rateLimitInfo.windowDuration) * 100))
    : 0;

  // Determine status level
  const getStatusLevel = (): 'normal' | 'warning' | 'critical' | 'blocked' => {
    if (rateLimitInfo.isLimited) return 'blocked';
    
    const usagePercentage = (rateLimitInfo.maxRequests - rateLimitInfo.remainingRequests) / rateLimitInfo.maxRequests;
    
    if (usagePercentage >= 0.9) return 'critical';
    if (usagePercentage >= 0.7) return 'warning';
    return 'normal';
  };

  const statusLevel = getStatusLevel();
  const containerClasses = [
    'rate-limit-indicator',
    `rate-limit-indicator--${statusLevel}`,
    compact ? 'rate-limit-indicator--compact' : '',
    className
  ].filter(Boolean).join(' ');

  if (compact) {
    return (
      <div className={containerClasses}>
        <div className="rate-limit-compact">
          <span className="rate-limit-compact__icon">
            {rateLimitInfo.isLimited ? '🚫' : '⚡'}
          </span>
          <span className="rate-limit-compact__text">
            {rateLimitInfo.isLimited 
              ? formatTime(timeRemaining)
              : `${rateLimitInfo.remainingRequests}/${rateLimitInfo.maxRequests}`
            }
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={containerClasses}>
      <div className="rate-limit-header">
        <div className="rate-limit-status">
          <span className="rate-limit-status__icon">
            {statusLevel === 'blocked' && '🚫'}
            {statusLevel === 'critical' && '⚠️'}
            {statusLevel === 'warning' && '⚡'}
            {statusLevel === 'normal' && '✅'}
          </span>
          <span className="rate-limit-status__text">
            {statusLevel === 'blocked' && 'Rate Limited'}
            {statusLevel === 'critical' && 'Almost Limited'}
            {statusLevel === 'warning' && 'Approaching Limit'}
            {statusLevel === 'normal' && 'Ready to Add'}
          </span>
        </div>
        
        {rateLimitInfo.isLimited && timeRemaining > 0 && (
          <div className="rate-limit-countdown">
            <span className="countdown-label">Reset in:</span>
            <span className="countdown-time">{formatTime(timeRemaining)}</span>
          </div>
        )}
      </div>

      <div className="rate-limit-details">
        <div className="rate-limit-quota">
          <div className="quota-info">
            <span className="quota-remaining">{rateLimitInfo.remainingRequests}</span>
            <span className="quota-separator">/</span>
            <span className="quota-total">{rateLimitInfo.maxRequests}</span>
            <span className="quota-label">requests remaining</span>
          </div>
          
          <div className="quota-progress">
            <div className="progress-bar">
              <div 
                className="progress-fill"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
            <div className="progress-labels">
              <span className="progress-start">0</span>
              <span className="progress-end">{rateLimitInfo.maxRequests}</span>
            </div>
          </div>
        </div>

        {!rateLimitInfo.isLimited && (
          <div className="rate-limit-window">
            <span className="window-label">
              Window: {Math.ceil(rateLimitInfo.windowDuration / 1000)}s
            </span>
          </div>
        )}
      </div>

      {rateLimitInfo.isLimited && (
        <div className="rate-limit-message">
          <p className="message-text">
            You've reached the maximum number of requests. 
            Please wait for the cooldown to expire before adding more tracks.
          </p>
        </div>
      )}
    </div>
  );
};