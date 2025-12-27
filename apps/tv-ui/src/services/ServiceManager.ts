/**
 * Service Manager
 * 
 * Coordinates API and WebSocket services for the TV Display Interface.
 * Manages service lifecycle, configuration updates, and error handling.
 * 
 * Requirements: 5.1, 5.2, 5.3, 6.1, 6.2, 6.3
 */

import { APIService, APIServiceConfig } from './APIService';
import { WebSocketService, WebSocketServiceConfig } from './WebSocketService';

/**
 * Service Manager Configuration
 */
export interface ServiceManagerConfig {
  api: APIServiceConfig;
  websocket: WebSocketServiceConfig;
  autoConnect?: boolean;
  healthCheckInterval?: number;
}

/**
 * Service Health Status
 */
export interface ServiceHealth {
  api: {
    healthy: boolean;
    lastCheck: Date;
    error?: string;
  };
  websocket: {
    healthy: boolean;
    lastCheck: Date;
    error?: string;
  };
  overall: 'healthy' | 'degraded' | 'unhealthy';
}

/**
 * Service Manager Class
 * 
 * Manages API and WebSocket services with health monitoring and automatic recovery.
 */
export class ServiceManager {
  private apiService: APIService;
  private wsService: WebSocketService;
  private config: Required<ServiceManagerConfig>;
  private healthCheckIntervalId: number | null = null;
  private health: ServiceHealth;

  constructor(config: ServiceManagerConfig) {
    this.config = {
      autoConnect: true,
      healthCheckInterval: 30000, // 30 seconds
      ...config,
    };

    // Initialize services
    this.apiService = new APIService(this.config.api);
    this.wsService = new WebSocketService(this.config.websocket);

    // Initialize health status
    this.health = {
      api: {
        healthy: false,
        lastCheck: new Date(),
      },
      websocket: {
        healthy: false,
        lastCheck: new Date(),
      },
      overall: 'unhealthy',
    };

    // Start health monitoring
    this.startHealthMonitoring();
  }

  /**
   * Get API service instance
   */
  getAPIService(): APIService {
    return this.apiService;
  }

  /**
   * Get WebSocket service instance
   */
  getWebSocketService(): WebSocketService {
    return this.wsService;
  }

  /**
   * Get current service health
   */
  getHealth(): ServiceHealth {
    return { ...this.health };
  }

  /**
   * Connect all services
   */
  async connect(): Promise<void> {
    console.log('ServiceManager: Connecting services...');

    try {
      // Connect WebSocket manually (not auto-connect)
      console.log('ServiceManager: Connecting WebSocket...');
      await this.wsService.connect();

      // Perform initial health check
      await this.performHealthCheck();

      console.log('ServiceManager: Services connected successfully');
    } catch (error) {
      console.error('ServiceManager: Failed to connect services:', error);
      throw error;
    }
  }

  /**
   * Disconnect all services
   */
  disconnect(): void {
    console.log('ServiceManager: Disconnecting services...');

    // Stop health monitoring
    this.stopHealthMonitoring();

    // Disconnect WebSocket
    this.wsService.disconnect();

    // Update health status
    this.health = {
      api: {
        healthy: false,
        lastCheck: new Date(),
      },
      websocket: {
        healthy: false,
        lastCheck: new Date(),
      },
      overall: 'unhealthy',
    };

    console.log('ServiceManager: Services disconnected');
  }

  /**
   * Update service configuration
   */
  updateConfig(newConfig: Partial<ServiceManagerConfig>): void {
    console.log('ServiceManager: Updating configuration...');

    const wasConnected = this.wsService.isConnected();

    // Update configuration
    this.config = {
      ...this.config,
      ...newConfig,
    };

    // Update API service config
    if (newConfig.api) {
      this.apiService.updateConfig(newConfig.api);
    }

    // Update WebSocket service config
    if (newConfig.websocket) {
      this.wsService.updateConfig(newConfig.websocket);
    }

    // Restart health monitoring if interval changed
    if (newConfig.healthCheckInterval !== undefined) {
      this.stopHealthMonitoring();
      this.startHealthMonitoring();
    }

    // Reconnect WebSocket if it was connected and URL changed
    if (wasConnected && newConfig.websocket?.url) {
      this.wsService.connect().catch(error => {
        console.error('ServiceManager: Failed to reconnect WebSocket after config update:', error);
      });
    }

    console.log('ServiceManager: Configuration updated');
  }

  /**
   * Perform health check on all services
   */
  async performHealthCheck(): Promise<ServiceHealth> {
    const now = new Date();

    // Check API health
    try {
      const response = await this.apiService.getPlaybackStatus();
      this.health.api = {
        healthy: response.success || response.error?.code !== 'NETWORK_ERROR',
        lastCheck: now,
        error: response.success ? undefined : response.error?.message,
      };
    } catch (error) {
      this.health.api = {
        healthy: false,
        lastCheck: now,
        error: error instanceof Error ? error.message : 'Unknown API error',
      };
    }

    // Check WebSocket health
    const wsConnected = this.wsService.isConnected();
    const wsStatus = this.wsService.getConnectionStatus();
    
    this.health.websocket = {
      healthy: wsConnected && wsStatus === 'connected',
      lastCheck: now,
      error: wsConnected ? undefined : `WebSocket status: ${wsStatus}`,
    };

    // Determine overall health
    if (this.health.api.healthy && this.health.websocket.healthy) {
      this.health.overall = 'healthy';
    } else if (this.health.api.healthy || this.health.websocket.healthy) {
      this.health.overall = 'degraded';
    } else {
      this.health.overall = 'unhealthy';
    }

    return this.getHealth();
  }

  /**
   * Start health monitoring
   */
  private startHealthMonitoring(): void {
    if (this.healthCheckIntervalId !== null || this.config.healthCheckInterval === 0) {
      return; // Already monitoring or disabled
    }

    console.log(`ServiceManager: Starting health monitoring (interval: ${this.config.healthCheckInterval}ms)`);

    this.healthCheckIntervalId = window.setInterval(() => {
      this.performHealthCheck().catch(error => {
        console.error('ServiceManager: Health check failed:', error);
      });
    }, this.config.healthCheckInterval);

    // Perform initial health check
    this.performHealthCheck().catch(error => {
      console.error('ServiceManager: Initial health check failed:', error);
    });
  }

  /**
   * Stop health monitoring
   */
  private stopHealthMonitoring(): void {
    if (this.healthCheckIntervalId !== null) {
      console.log('ServiceManager: Stopping health monitoring');
      clearInterval(this.healthCheckIntervalId);
      this.healthCheckIntervalId = null;
    }
  }

  /**
   * Get service URLs for debugging
   */
  getServiceURLs(): { api: string; websocket: string } {
    return {
      api: this.apiService.getConfig().baseUrl,
      websocket: this.wsService.getConfig().url,
    };
  }

  /**
   * Check if services are ready
   */
  isReady(): boolean {
    return this.health.overall !== 'unhealthy';
  }

  /**
   * Wait for services to be ready
   */
  async waitForReady(timeout: number = 30000): Promise<boolean> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      if (this.isReady()) {
        return true;
      }

      // Wait 1 second before checking again
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return false;
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    console.log('ServiceManager: Destroying...');
    
    this.stopHealthMonitoring();
    this.disconnect();
    
    console.log('ServiceManager: Destroyed');
  }
}

/**
 * Create service manager with default configuration
 */
export function createServiceManager(config: Partial<ServiceManagerConfig> = {}): ServiceManager {
  const defaultConfig: ServiceManagerConfig = {
    api: {
      baseUrl: 'http://localhost:3000',
      timeout: 10000,
      maxRetries: 3,
      retryDelay: 1000,
      maxRetryDelay: 30000,
    },
    websocket: {
      url: 'ws://localhost:3000/ws',
      clientType: 'display',
      reconnectInterval: 1000,
      maxReconnectInterval: 30000,
      reconnectBackoffFactor: 2,
      maxReconnectAttempts: 10,
      heartbeatInterval: 30000,
      connectionTimeout: 10000,
    },
    autoConnect: true,
    healthCheckInterval: 30000,
  };

  return new ServiceManager({
    ...defaultConfig,
    ...config,
    api: {
      ...defaultConfig.api,
      ...config.api,
    },
    websocket: {
      ...defaultConfig.websocket,
      ...config.websocket,
    },
  });
}