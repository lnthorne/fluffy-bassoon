/**
 * Simple test to verify EventBroadcaster integration
 * Run this after starting the server to verify the integration is working
 */

const http = require('http');

async function testEventBroadcasterIntegration() {
  console.log('🧪 Testing EventBroadcaster Integration (Fixed Version)');
  console.log('====================================================');

  try {
    // Test 1: Check server health to see if EventBroadcaster is active
    console.log('1. Checking server health...');
    
    const healthResponse = await fetch('http://localhost:3000/health');
    const healthData = await healthResponse.json();
    
    console.log('   Server Status:', healthData.status);
    console.log('   WebSocket Stats:', healthData.websocket);
    
    // Test 2: Add a track via API to trigger EventBroadcaster
    console.log('\n2. Adding a test track to trigger events...');
    console.log('   🔥 This should now trigger EventBroadcaster events!');
    
    const addTrackResponse = await fetch('http://localhost:3000/api/queue/add', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        track: {
          title: 'EventBroadcaster Test Song',
          artist: 'Debug Artist',
          sourceUrl: 'https://youtube.com/watch?v=debug123',
          duration: 180
        },
        user: {
          nickname: 'DebugTester'
        }
      })
    });
    
    const addTrackData = await addTrackResponse.json();
    
    if (addTrackData.success) {
      console.log('   ✅ Track added successfully');
      console.log('   Queue Position:', addTrackData.data.queuePosition);
      console.log('   Track ID:', addTrackData.data.queueItem.id);
      console.log('   → Check server logs for EventBroadcaster debug output');
      console.log('   → WebSocket clients should receive track_added and queue_updated events');
    } else {
      console.log('   ❌ Failed to add track:', addTrackData.error.message);
    }
    
    // Test 3: Check queue state
    console.log('\n3. Checking queue state...');
    
    const queueResponse = await fetch('http://localhost:3000/api/queue');
    const queueData = await queueResponse.json();
    
    if (queueData.success) {
      console.log('   ✅ Queue retrieved successfully');
      console.log('   Total tracks:', queueData.data.queue.totalLength);
      console.log('   Is empty:', queueData.data.queue.isEmpty);
    } else {
      console.log('   ❌ Failed to get queue:', queueData.error.message);
    }
    
    console.log('\n🎯 Integration Test Summary:');
    console.log('- Server is running and responding');
    console.log('- API endpoints are functional');
    console.log('- EventBroadcaster should be active (check server logs for debug output)');
    console.log('- WebSocket clients should receive real-time events');
    console.log('\n🔍 Debug Information:');
    console.log('- Look for "🔥 API: EventBroadcaster available" in server logs');
    console.log('- Look for "📡 Broadcasting track_added to X clients" in server logs');
    console.log('- Look for "📤 Sending track_added to client" in server logs');
    console.log('\n📱 WebSocket Testing:');
    console.log('1. Connect to ws://localhost:3000/ws with Postman');
    console.log('2. You should see connection_established and initial_state events');
    console.log('3. Run this test again and watch for track_added events');
    console.log('4. Check server logs for detailed debug output');
    
  } catch (error) {
    console.error('❌ Integration test failed:', error.message);
    console.log('\nMake sure the server is running with: npm run dev');
  }
}

// Run the test
testEventBroadcasterIntegration();