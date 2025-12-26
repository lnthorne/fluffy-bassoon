#!/usr/bin/env node

/**
 * Test with a real YouTube track to see playback behavior
 */

const fetch = require('node-fetch');

async function testRealTrack() {
  console.log('🎵 Testing with real YouTube track...');
  
  try {
    const response = await fetch('http://localhost:3000/api/queue/add', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        track: {
          title: "Daft Punk - One More Time",
          artist: "Daft Punk", 
          sourceUrl: "https://www.youtube.com/watch?v=FGBhQbmPwH8",
          duration: 320
        },
        user: {
          nickname: "TestUser"
        }
      })
    });

    if (response.ok) {
      const result = await response.json();
      console.log('✅ Real track added successfully');
      console.log('   Track ID:', result.data.queueItem.id);
      console.log('   Queue Position:', result.data.queuePosition);
      console.log('');
      console.log('🎧 Now watch the WebSocket client for playback events...');
      console.log('   Should see: track_added → queue_updated → playback_updated (resolving) → playback_updated (playing)');
      console.log('   Watch for any duplicate events!');
    } else {
      console.error('❌ Failed to add track:', response.status, response.statusText);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testRealTrack();