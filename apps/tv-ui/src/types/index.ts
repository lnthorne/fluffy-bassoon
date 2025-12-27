import { QueueItem } from '@party-jukebox/shared';

// TV-specific types
export interface PlaybackStatus {
  status: 'idle' | 'resolving' | 'playing' | 'paused' | 'error';
  currentTrack: QueueItem | null;
  position: number;
  duration: number;
  volume: number;
  error?: string;
}

export interface ConnectionStatus {
  connected: boolean;
  reconnecting: boolean;
  lastConnected?: Date;
  error?: string;
}

export interface ServerInfo {
  url: string;
  wsUrl: string;
  addresses: string[];
  version?: string;
}