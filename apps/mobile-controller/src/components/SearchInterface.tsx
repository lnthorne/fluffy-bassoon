import React, { useState, useCallback, useRef, useEffect } from 'react';
import { SearchResult } from '@party-jukebox/shared';
import { apiService } from '../services/APIService';
import './SearchInterface.css';

export interface SearchInterfaceProps {
  onTrackSelect: (track: SearchResult) => void;
  disabled?: boolean;
}

export const SearchInterface: React.FC<SearchInterfaceProps> = ({
  onTrackSelect,
  disabled = false
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  
  const searchTimeoutRef = useRef<NodeJS.Timeout>();
  const abortControllerRef = useRef<AbortController>();

  // Debounced search function
  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      setError(null);
      setHasSearched(false);
      return;
    }

    // Cancel previous request if still pending
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    setIsLoading(true);
    setError(null);
    setHasSearched(true);

    try {
      const searchResults = await apiService.search(searchQuery.trim());
      setResults(searchResults);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Search failed';
      setError(errorMessage);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Handle input change with debouncing
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newQuery = e.target.value;
    setQuery(newQuery);

    // Clear existing timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Set new timeout for debounced search
    searchTimeoutRef.current = setTimeout(() => {
      performSearch(newQuery);
    }, 500); // 500ms debounce
  }, [performSearch]);

  // Handle manual search trigger (Enter key or search button)
  const handleSearch = useCallback((e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
    }

    // Clear debounce timeout and search immediately
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    performSearch(query);
  }, [query, performSearch]);

  // Handle track selection
  const handleTrackSelect = useCallback((track: SearchResult) => {
    if (!disabled) {
      onTrackSelect(track);
    }
  }, [onTrackSelect, disabled]);

  // Format duration from seconds to MM:SS
  const formatDuration = useCallback((seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return (
    <div className="search-interface">
      <form onSubmit={handleSearch} className="search-form">
        <div className="search-input-container">
          <input
            type="text"
            value={query}
            onChange={handleInputChange}
            placeholder="Search for music..."
            className="search-input"
            disabled={disabled}
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
          />
          <button
            type="submit"
            className="search-button"
            disabled={disabled || isLoading || !query.trim()}
            aria-label="Search"
          >
            {isLoading ? (
              <span className="search-spinner" aria-hidden="true">⟳</span>
            ) : (
              <span aria-hidden="true">🔍</span>
            )}
          </button>
        </div>
      </form>

      <div className="search-results">
        {isLoading && (
          <div className="search-status loading">
            <span className="loading-spinner">⟳</span>
            <span>Searching...</span>
          </div>
        )}

        {error && (
          <div className="search-status error">
            <span>❌ {error}</span>
            <button 
              onClick={() => handleSearch()}
              className="retry-button"
              disabled={disabled}
            >
              Try Again
            </button>
          </div>
        )}

        {!isLoading && !error && hasSearched && results.length === 0 && (
          <div className="search-status empty">
            <span>🎵 No results found</span>
            <p>Try different search terms or check your spelling</p>
          </div>
        )}

        {!isLoading && !error && results.length > 0 && (
          <div className="results-list">
            {results.map((track) => (
              <button
                key={track.videoId}
                className="result-item"
                onClick={() => handleTrackSelect(track)}
                disabled={disabled}
                type="button"
              >
                <div className="result-thumbnail">
                  {track.thumbnailUrl ? (
                    <img 
                      src={track.thumbnailUrl} 
                      alt={`${track.title} thumbnail`}
                      loading="lazy"
                    />
                  ) : (
                    <div className="thumbnail-placeholder">🎵</div>
                  )}
                </div>
                
                <div className="result-info">
                  <div className="result-title">{track.title}</div>
                  <div className="result-artist">{track.artist}</div>
                  <div className="result-meta">
                    <span className="result-duration">
                      {formatDuration(track.duration)}
                    </span>
                    {track.channelTitle && (
                      <span className="result-channel">
                        • {track.channelTitle}
                      </span>
                    )}
                  </div>
                </div>

                <div className="result-action">
                  <span className="add-icon">+</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};