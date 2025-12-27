# WebSocket Connection Debug Guide

## Issue Fixed: Infinite Connection Loop

### Problem
The TV interface was creating an infinite loop of WebSocket connection attempts, causing:
- Rapid connection attempts every few milliseconds
- Server rejecting connections due to "Maximum connections reached"
- Resource exhaustion on both client and server

### Root Causes
1. **Competing reconnection logic**: Both `WebSocketService` and `WebSocketIntegration` had their own reconnection mechanisms
2. **Aggressive polling**: 5-second interval checks triggering unnecessary reconnections
3. **No server rejection handling**: Client didn't respect server connection limits
4. **State synchronization issues**: Connection status tracking was inconsistent

### Fixes Applied

#### 1. WebSocketIntegration.tsx
- **Removed duplicate reconnection logic**: Let the service handle all reconnections
- **Reduced polling frequency**: Changed from 5s to 10s intervals
- **Added connection state checks**: Prevent connection attempts when already connecting
- **Simplified status monitoring**: Just sync with service status, don't trigger reconnections

#### 2. WebSocketService.ts
- **Added connection rejection handling**: Detect server "Maximum connections" rejections
- **Improved reconnection scheduling**: Clear existing timeouts before scheduling new ones
- **Enhanced connection state checks**: Prevent multiple simultaneous connection attempts
- **Better error handling**: Different backoff strategies for different error types

### Connection Flow (Fixed)

```
1. App starts → ServiceManager creates WebSocketService
2. WebSocketIntegration subscribes to events
3. Single connection attempt via WebSocketService
4. If connection fails:
   - Service handles exponential backoff (1s, 2s, 4s, 8s, max 30s)
   - Integration just monitors status, doesn't interfere
5. If server rejects (max connections):
   - Longer backoff delay applied
   - No aggressive retry loops
```

### Testing the Fix

#### Check Connection Behavior
1. Start the server: `npm run dev:server`
2. Open TV interface: `http://localhost:3000/display`
3. Monitor server logs for connection attempts
4. Should see single connection attempt, not rapid-fire attempts

#### Verify Reconnection Logic
1. Start TV interface with server running
2. Stop the server
3. Restart the server
4. Should see gradual reconnection attempts with increasing delays

#### Test Connection Limits
1. Open multiple TV interface tabs
2. Should see some connections rejected gracefully
3. No infinite retry loops should occur

### Configuration

#### WebSocket Service Config (App.tsx)
```typescript
websocket: {
  url: 'ws://localhost:3000/ws',
  clientType: 'display',
  reconnectInterval: 1000,        // Start with 1s
  maxReconnectInterval: 30000,    // Max 30s between attempts
  reconnectBackoffFactor: 2,      // Double delay each time
  maxReconnectAttempts: 10,       // Give up after 10 attempts
  heartbeatInterval: 30000,       // 30s heartbeat
  connectionTimeout: 10000,       // 10s connection timeout
}
```

#### Server Connection Limits
- Default: 50 max connections per WebSocket server
- Configurable in server WebSocket configuration
- TV displays should use `clientType: 'display'` for proper categorization

### Monitoring

#### Client-side Logs
- `WebSocket connected` - Successful connection
- `Scheduling reconnection attempt X in Yms` - Normal reconnection
- `Connection rejected by server` - Server limit reached
- `Max reconnection attempts reached` - Giving up

#### Server-side Logs
- `WebSocket connection established` - New client connected
- `WebSocket connection rejected: Maximum connections reached` - Limit hit
- Connection count should be reasonable (not hundreds per second)

### Prevention

#### Development
- Use single browser tab for TV interface testing
- Close unused connections before opening new ones
- Monitor server logs for connection patterns

#### Production
- Set appropriate connection limits on server
- Monitor connection metrics
- Implement connection pooling if needed for multiple displays

### Recovery

If infinite loop occurs again:
1. **Immediate**: Restart the server to clear all connections
2. **Debug**: Check for multiple WebSocket service instances
3. **Fix**: Ensure only one connection attempt mechanism is active
4. **Monitor**: Watch server logs for connection patterns