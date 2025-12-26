/**
 * Core types for the Music Resolution & Playback system
 * Requirements: 7.5, 7.6
 */

import { Result } from '@party-jukebox/shared';
import { QueueItem } from '@party-jukebox/shared';
import { PlaybackError } from './errors';

/**
 * Playback state enumeration
 * Requirements: 4.1, 4.6
 */
export type PlaybackStatus = 'idle' | 'resolving' | 'playing' | 'paused' | 'error';

/**
 * Current playback state
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.6
 */
export interface PlaybackState {
  readonly status: PlaybackStatus;
  readonly currentTrack: QueueItem | null;
  readonly position: number; // seconds
  readonly duration: number; // seconds
  readonly volume: number; // 0-100
  readonly error?: PlaybackError;
}

/**
 * Resolved stream information from yt-dlp
 * Requirements: 1.1, 1.2, 1.3
 */
export interface ResolvedStream {
  readonly streamUrl: string;
  readonly title: string;
  readonly duration: number;
  readonly format: string;
  readonly quality: string;
}

/**
 * Stream resolution cache entry
 * Requirements: 6.1
 */
export interface ResolutionCache {
  readonly url: string;
  readonly resolvedStream: ResolvedStream;
  readonly timestamp: Date;
  readonly expiresAt: Date;
}

/**
 * yt-dlp process options
 * Requirements: 1.4, 1.6, 1.7
 */
export interface YtDlpOptions {
  readonly format: string; // 'bestaudio'
  readonly extractAudio: boolean;
  readonly audioFormat: string; // 'opus' or 'mp3'
  readonly timeout: number; // 30 seconds
  readonly retries: number;
}

/**
 * MPV player configuration
 * Requirements: 2.1, 2.2, 2.8
 */
export interface MpvOptions {
  readonly socketPath: string;
  readonly audioOnly: boolean;
  readonly volume: number;
  readonly noVideo: boolean;
  readonly quiet: boolean;
  readonly inputIpcServer: string;
}

/**
 * MPV IPC command structure
 * Requirements: 2.2, 2.6
 */
export interface MPVCommand {
  readonly command: string[];
  readonly request_id?: number;
}

/**
 * MPV IPC response structure
 * Requirements: 2.2, 2.6
 */
export interface MPVResponse {
  readonly data?: any;
  readonly error: string;
  readonly request_id: number;
}

/**
 * Playback event types for system coordination
 * Requirements: 2.4, 2.5, 4.2, 4.4, 5.7
 */
export type PlaybackEventType = 
  | 'state_changed'
  | 'track_started'
  | 'track_finished'
  | 'track_failed'
  | 'progress_update'
  | 'error_occurred';

/**
 * Playback event data
 * Requirements: 2.4, 2.5, 4.2, 4.4, 5.7
 */
export interface PlaybackEvent {
  readonly type: PlaybackEventType;
  readonly timestamp: Date;
  readonly data: {
    readonly state?: PlaybackState;
    readonly track?: QueueItem;
    readonly position?: number;
    readonly error?: PlaybackError;
  };
}

/**
 * Event listener function type
 */
export type PlaybackEventListener = (event: PlaybackEvent) => void;

/**
 * IPC event listener function type
 */
export type IPCEventListener = (response: MPVResponse) => void;