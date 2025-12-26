#!/usr/bin/env node

/**
 * Simple WebSocket client to test EventBroadcaster integration
 */

const WebSocket = require('ws');

console.log('🔌 Connecting to WebSocket server...');

const ws = new WebSocket('ws://127.0.0.1:3000/ws');

ws.on('open', function open() {
  console.log('✅ Connected to WebSocket server');
  console.log('📡 Listening for events...\n');
});

ws.on('message', function message(data) {
  try {
    const event = JSON.parse(data.toString());
    console.log(`📨 Received event: ${event.type}`);
    console.log(`   Timestamp: ${event.timestamp}`);
    console.log(`   Sequence: ${event.sequenceNumber}`);
    
    switch (event.type) {
      case 'initial_state':
        console.log('   🎯 Initial State:');
        console.log(`      Queue: ${event.data.queue.totalLength} tracks`);
        console.log(`      Playback: ${event.data.playback.status}`);
        console.log(`      Current Track: ${event.data.playback.currentTrack?.track?.title || 'none'}`);
        break;
        
      case 'track_added':
        console.log('   🎵 Track Added:');
        console.log(`      Title: ${event.data.track.track.title}`);
        console.log(`      Artist: ${event.data.track.track.artist}`);
        console.log(`      Position: ${event.data.queuePosition}`);
        console.log(`      Added by: ${event.data.addedBy.nickname}`);
        break;
        
      case 'queue_updated':
        console.log('   📋 Queue Updated:');
        console.log(`      Total tracks: ${event.data.totalLength}`);
        console.log(`      Is empty: ${event.data.isEmpty}`);
        console.log(`      Current track: ${event.data.currentTrack?.track?.title || 'none'}`);
        break;
        
      case 'playback_updated':
        console.log('   ▶️  Playback Updated:');
        console.log(`      Status: ${event.data.status}`);
        console.log(`      Current track: ${event.data.currentTrack?.track?.title || 'none'}`);
        console.log(`      Position: ${event.data.position}s / ${event.data.duration}s`);
        break;
        
      case 'heartbeat':
        console.log('   💓 Heartbeat');
        console.log(`      Server time: ${event.data.serverTime}`);
        console.log(`      Client count: ${event.data.clientCount}`);
        break;
        
      default:
        console.log(`   📦 Data:`, JSON.stringify(event.data, null, 2));
    }
    
    console.log(''); // Empty line for readability
  } catch (error) {
    console.error('❌ Failed to parse message:', error);
    console.log('Raw message:', data.toString());
  }
});

ws.on('error', function error(err) {
  console.error('❌ WebSocket error:', err);
});

ws.on('close', function close() {
  console.log('🔌 WebSocket connection closed');
});

// Keep the process alive
process.on('SIGINT', () => {
  console.log('\n👋 Closing WebSocket connection...');
  ws.close();
  process.exit(0);
});

console.log('💡 Press Ctrl+C to exit');
console.log('🧪 Now run the integration test in another terminal to see events!');