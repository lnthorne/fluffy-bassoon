import React, { useState } from 'react';
import { RateLimitIndicator } from './RateLimitIndicator';
import { useRateLimit } from '../contexts';
import { RateLimitInfo } from '../types';

/**
 * Demo component to showcase rate limiting integration
 * This demonstrates how the RateLimitIndicator works with different rate limit states
 */
export const RateLimitDemo: React.FC = () => {
  const { state: rateLimitState, updateRateLimit, resetRateLimit, clearRateLimit } = useRateLimit();
  const [demoMode, setDemoMode] = useState<'normal' | 'warning' | 'critical' | 'blocked'>('normal');

  // Create demo rate limit info based on selected mode
  const createDemoRateLimit = (mode: typeof demoMode): RateLimitInfo => {
    const baseInfo = {
      maxRequests: 5, // Correct: 5 songs
      windowDuration: 600000, // Correct: 10 minutes (600,000 ms)
    };

    switch (mode) {
      case 'normal':
        return {
          ...baseInfo,
          remainingRequests: 3,
          timeUntilReset: 300000, // 5 minutes
          isLimited: false,
        };
      case 'warning':
        return {
          ...baseInfo,
          remainingRequests: 1,
          timeUntilReset: 450000, // 7.5 minutes
          isLimited: false,
        };
      case 'critical':
        return {
          ...baseInfo,
          remainingRequests: 1,
          timeUntilReset: 500000, // 8.3 minutes
          isLimited: false,
        };
      case 'blocked':
        return {
          ...baseInfo,
          remainingRequests: 0,
          timeUntilReset: 250000, // 4.2 minutes
          isLimited: true,
        };
      default:
        return {
          ...baseInfo,
          remainingRequests: 3,
          timeUntilReset: 300000,
          isLimited: false,
        };
    }
  };

  const handleDemoModeChange = (mode: typeof demoMode) => {
    setDemoMode(mode);
    const demoRateLimit = createDemoRateLimit(mode);
    updateRateLimit(demoRateLimit);
  };

  const handleReset = () => {
    resetRateLimit();
  };

  const handleClear = () => {
    clearRateLimit();
    setDemoMode('normal');
  };

  return (
    <div style={{ padding: '1rem', maxWidth: '600px', margin: '0 auto' }}>
      <h2>Rate Limiting Demo</h2>
      
      <div style={{ marginBottom: '1rem' }}>
        <h3>Demo Controls</h3>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <button 
            onClick={() => handleDemoModeChange('normal')}
            style={{ 
              padding: '0.5rem 1rem', 
              backgroundColor: demoMode === 'normal' ? '#007bff' : '#e9ecef',
              color: demoMode === 'normal' ? 'white' : '#333',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Normal (3/5)
          </button>
          <button 
            onClick={() => handleDemoModeChange('warning')}
            style={{ 
              padding: '0.5rem 1rem', 
              backgroundColor: demoMode === 'warning' ? '#ffc107' : '#e9ecef',
              color: demoMode === 'warning' ? '#333' : '#333',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Warning (1/5)
          </button>
          <button 
            onClick={() => handleDemoModeChange('critical')}
            style={{ 
              padding: '0.5rem 1rem', 
              backgroundColor: demoMode === 'critical' ? '#fd7e14' : '#e9ecef',
              color: demoMode === 'critical' ? 'white' : '#333',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Critical (1/5)
          </button>
          <button 
            onClick={() => handleDemoModeChange('blocked')}
            style={{ 
              padding: '0.5rem 1rem', 
              backgroundColor: demoMode === 'blocked' ? '#dc3545' : '#e9ecef',
              color: demoMode === 'blocked' ? 'white' : '#333',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Blocked (0/5)
          </button>
        </div>
        
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button 
            onClick={handleReset}
            style={{ 
              padding: '0.5rem 1rem', 
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Reset Rate Limit
          </button>
          <button 
            onClick={handleClear}
            style={{ 
              padding: '0.5rem 1rem', 
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Clear Rate Limit
          </button>
        </div>
      </div>

      <div style={{ marginBottom: '2rem' }}>
        <h3>Full Rate Limit Indicator</h3>
        {rateLimitState.rateLimitInfo ? (
          <RateLimitIndicator rateLimitInfo={rateLimitState.rateLimitInfo} />
        ) : (
          <div style={{ 
            padding: '1rem', 
            backgroundColor: '#f8f9fa', 
            border: '1px solid #dee2e6', 
            borderRadius: '8px',
            textAlign: 'center',
            color: '#6c757d'
          }}>
            No rate limit information available
          </div>
        )}
      </div>

      <div style={{ marginBottom: '2rem' }}>
        <h3>Compact Rate Limit Indicator</h3>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          {rateLimitState.rateLimitInfo ? (
            <RateLimitIndicator rateLimitInfo={rateLimitState.rateLimitInfo} compact />
          ) : (
            <div style={{ 
              padding: '0.5rem 1rem', 
              backgroundColor: '#f8f9fa', 
              border: '1px solid #dee2e6', 
              borderRadius: '8px',
              color: '#6c757d',
              fontSize: '0.9rem'
            }}>
              No data
            </div>
          )}
        </div>
      </div>

      <div>
        <h3>Current State</h3>
        <div style={{ 
          padding: '1rem', 
          backgroundColor: '#f8f9fa', 
          border: '1px solid #dee2e6', 
          borderRadius: '8px',
          fontFamily: 'monospace',
          fontSize: '0.9rem'
        }}>
          <div><strong>Is Limited:</strong> {rateLimitState.isLimited ? 'Yes' : 'No'}</div>
          <div><strong>Time Until Reset:</strong> {rateLimitState.timeUntilReset}s</div>
          <div><strong>Last Updated:</strong> {rateLimitState.lastUpdated?.toLocaleTimeString() || 'Never'}</div>
          {rateLimitState.rateLimitInfo && (
            <>
              <div><strong>Remaining:</strong> {rateLimitState.rateLimitInfo.remainingRequests}</div>
              <div><strong>Max:</strong> {rateLimitState.rateLimitInfo.maxRequests}</div>
              <div><strong>Window:</strong> {rateLimitState.rateLimitInfo.windowDuration}ms</div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};