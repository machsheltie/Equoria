#!/usr/bin/env node

/**
 * Foal Enrichment API Demonstration
 *
 * Demonstrates how to use POST /api/foals/{foalId}/enrichment to complete
 * enrichment activities for a foal and track its bonding and stress levels.
 *
 * Derived-day contract (Equoria-g89vy): the enrichment "day" is DERIVED
 * server-side from the foal's dateOfBirth (canonical date-only UTC age math).
 * The client does NOT send a `day` field — the request body is ONLY
 * `{ activity }`. The foal's real age is the single source of truth for which
 * activities are available; any client-supplied `day` is ignored.
 *
 * Read the day's valid activities from GET /api/foals/{foalId}/development
 * (`availableEnrichmentActivities` + `development.enrichmentDay` /
 * `development.enrichmentWindowOpen`). The window is open only on derived days
 * 0-6; once the foal is 7+ days old it is closed (HTTP 400). Each activity can
 * be completed at most once per derived day (anti-farming → HTTP 400 on
 * repeat).
 *
 * Auth: the endpoint requires a Bearer token and foal ownership. Set
 * AUTH_TOKEN in the environment before running.
 *
 * Usage: AUTH_TOKEN=<jwt> node backend/examples/foalEnrichmentDemo.mjs
 */

import fetch from 'node-fetch';

// Configuration
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const DEMO_FOAL_ID = Number(process.env.DEMO_FOAL_ID || 1); // a foal you own, age 0-6 days
const AUTH_TOKEN = process.env.AUTH_TOKEN || '';

function authHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  if (AUTH_TOKEN) {
    headers.Authorization = `Bearer ${AUTH_TOKEN}`;
  }
  return headers;
}

/**
 * Read the foal's development data to discover the server-derived day and the
 * activities available for it right now.
 */
async function getDevelopment(foalId) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/foals/${foalId}/development`, {
      method: 'GET',
      headers: authHeaders(),
    });
    const data = await response.json();
    if (!response.ok) {
      console.log(`❌ Could not read development data: ${data.message}`);
      return null;
    }
    const dev = data.data?.development || {};
    console.log(`\n📅 Server-derived enrichment day: ${dev.enrichmentDay}`);
    console.log(`   Window open: ${dev.enrichmentWindowOpen}`);
    const available = data.data?.availableEnrichmentActivities || [];
    console.log(
      `   Available activities today: ${available.map(a => a.name).join(', ') || 'none'}`,
    );
    return data.data;
  } catch (error) {
    console.error(`💥 Request failed: ${error.message}`);
    return null;
  }
}

/**
 * Complete an enrichment activity. The body is ONLY { activity } — the day is
 * derived server-side from the foal's age and must NOT be supplied.
 */
async function completeEnrichmentActivity(foalId, activity) {
  try {
    console.log(`\n🎯 Attempting to complete activity: "${activity}" for foal ${foalId}`);

    const response = await fetch(`${API_BASE_URL}/api/foals/${foalId}/enrichment`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ activity }), // NO `day` — derived server-side
    });

    const data = await response.json();

    if (response.ok) {
      console.log(`✅ Success! ${data.message}`);
      console.log('   📊 Updated Levels:');
      console.log(
        `      🤝 Bond Score: ${data.data.updatedLevels.bondScore} (${data.data.changes.bondChange >= 0 ? '+' : ''}${data.data.changes.bondChange})`,
      );
      console.log(
        `      😰 Stress Level: ${data.data.updatedLevels.stressLevel} (${data.data.changes.stressChange >= 0 ? '+' : ''}${data.data.changes.stressChange})`,
      );
      console.log(`   🎭 Outcome: ${data.data.activity.outcome}`);
      console.log(`   📝 Training Record ID: ${data.data.trainingRecordId}`);

      return data.data;
    } else {
      console.log(`❌ Error: ${data.message}`);
      if (data.errors) {
        data.errors.forEach(error => console.log(`   - ${error.msg}`));
      }
      return null;
    }
  } catch (error) {
    console.error(`💥 Request failed: ${error.message}`);
    return null;
  }
}

/**
 * Demonstrate the API. Because the day is derived from the foal's age, the demo
 * first reads the available activities for the foal's current derived day and
 * then completes them — it does NOT try to drive arbitrary days.
 */
async function runDemo() {
  console.log('🐴 Foal Enrichment API Demonstration');
  console.log('=====================================');

  console.log(`\n📋 Testing with foal ID: ${DEMO_FOAL_ID}`);
  console.log('Note: use a foal you own that is 0-6 days old (enrichment window open).');

  const development = await getDevelopment(DEMO_FOAL_ID);
  const available = development?.availableEnrichmentActivities || [];

  if (available.length === 0) {
    console.log(
      '\n⚠️ No enrichment activities available right now (window closed or foal too old).',
    );
  } else {
    // Complete the first available activity for the current derived day.
    await completeEnrichmentActivity(DEMO_FOAL_ID, available[0].name);

    // Anti-farming demo: repeating the SAME activity on the same derived day is
    // rejected with HTTP 400.
    console.log('\n🧪 Anti-farming: repeating the same activity on the same day should fail:');
    await completeEnrichmentActivity(DEMO_FOAL_ID, available[0].name);

    // If there is a second activity, it can still be completed (different activity).
    if (available[1]) {
      await completeEnrichmentActivity(DEMO_FOAL_ID, available[1].name);
    }
  }

  console.log('\n🧪 Testing Error Scenarios:');

  // Activity not appropriate for the foal's derived day → HTTP 400.
  await completeEnrichmentActivity(DEMO_FOAL_ID, 'definitely_not_a_real_day_activity');

  // Non-existent / not-owned foal → HTTP 404.
  await completeEnrichmentActivity(99999, 'Gentle Touch');

  // Invalid activity name → HTTP 400.
  await completeEnrichmentActivity(DEMO_FOAL_ID, 'Flying Lessons');

  console.log('\n✨ Demo completed!');

  console.log('\n📚 Enrichment activities by derived day (for reference):');
  console.log('Day 0: Gentle Touch, Quiet Presence, Soft Voice');
  console.log('Day 1: Feeding Assistance, Grooming Introduction, Play Interaction');
  console.log('Day 2: Walking Practice, Environment Exploration, Social Introduction');
  console.log('Day 3: Halter Introduction, Leading Practice, Handling Exercises, Trailer Exposure');
  console.log('Day 4: Obstacle Introduction, Advanced Grooming, Training Games');
  console.log('Day 5: Confidence Building, New Experiences, Independence Practice');
  console.log('Day 6: Final Assessment, Graduation Ceremony, Future Planning');
  console.log("(Which day applies is determined by the foal's age, not by the client.)");

  console.log('\n🔧 API Endpoint Details:');
  console.log('POST /api/foals/{foalId}/enrichment   (alias: POST /api/foals/{foalId}/enrich)');
  console.log('Auth: Bearer token + foal ownership required');
  console.log('Request Body: { "activity": "Activity Name" }   (NO day — derived server-side)');
  console.log('Response: Updated bondScore and stressLevel with activity outcome');
}

/**
 * Check if server is running
 */
async function checkServer() {
  try {
    const response = await fetch(`${API_BASE_URL}/ping`);
    if (response.ok) {
      console.log('✅ Server is running');
      return true;
    } else {
      console.log('❌ Server responded with error');
      return false;
    }
  } catch {
    console.log("❌ Cannot connect to server. Make sure it's running on port 3000");
    console.log('   Start the server with: npm run dev');
    return false;
  }
}

// Run the demonstration
async function main() {
  if (!AUTH_TOKEN) {
    console.log('⚠️ AUTH_TOKEN is not set. The enrichment endpoint requires a Bearer token.');
    console.log('   Run with: AUTH_TOKEN=<jwt> node backend/examples/foalEnrichmentDemo.mjs');
  }
  const serverRunning = await checkServer();
  if (serverRunning) {
    await runDemo();
  }
}

main().catch(console.error);
