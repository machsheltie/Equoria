/**
 * Quick test of assignment endpoint
 */

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3000';

async function testAssignment() {
  try {
    console.log('🧪 Testing assignment endpoint...');

    const response = await fetch(`${BASE_URL}/api/grooms/assign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        foalId: 1,
        groomId: 1,
        priority: 1,
        notes: 'Test assignment',
      }),
    });

    console.log(`Status: ${response.status}`);
    const data = await response.json();
    console.log('Response:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testAssignment();
