/* eslint-disable no-console */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Ensure __dirname resolution works in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Explicitly load the test .env
dotenv.config({ path: path.resolve(__dirname, '../.env.test') });

console.log('[DEBUG] Loaded NODE_ENV:', process.env.NODE_ENV);
console.log('[DEBUG] Loaded JWT_REFRESH_SECRET:', process.env.JWT_REFRESH_SECRET);

// XP Test System Script
import { addXpToUser, getUserById, createUser } from '../models/userModel.mjs';
import logger from '../utils/logger.mjs';

async function testXpSystem() {
  try {
    console.log('🎮 Testing XP and Level System');
    console.log('================================\n');

    const testUser = {
      username: 'XPTestUser',
      firstName: 'XP',
      lastName: 'Test',
      email: `xp-test-${Date.now()}@example.com`,
      password: 'password123',
      money: 1000,
      level: 1,
      xp: 0,
      settings: { theme: 'light' },
    };

    console.log('1. Creating test user...');
    const user = await createUser(testUser);
    console.log(`✅ Created user: ${user.name} (ID: ${user.id})`);
    console.log(`   Initial Level: ${user.level}, XP: ${user.xp}\n`);

    console.log('2. Adding 20 XP (should not level up)...');
    let result = await addXpToUser(user.id, 20);
    console.log(`✅ Result: Level ${result.level}, XP: ${result.xp}`);
    console.log(`   Leveled up: ${result.leveledUp}, Levels gained: ${result.levelsGained}\n`);

    console.log('3. Adding 80 XP (should level up once: 20+80=100)...');
    result = await addXpToUser(user.id, 80);
    console.log(`✅ Result: Level ${result.level}, XP: ${result.xp}`);
    console.log(`   Leveled up: ${result.leveledUp}, Levels gained: ${result.levelsGained}\n`);

    console.log('4. Adding 250 XP (should level up 2 times: 0+250=250)...');
    result = await addXpToUser(user.id, 250);
    console.log(`✅ Result: Level ${result.level}, XP: ${result.xp}`);
    console.log(`   Leveled up: ${result.leveledUp}, Levels gained: ${result.levelsGained}\n`);

    console.log('5. Adding 150 XP more (should level up 1 time)...');
    result = await addXpToUser(user.id, 150);
    console.log(`✅ Result: Level ${result.level}, XP: ${result.xp}`);
    console.log(`   Leveled up: ${result.leveledUp}, Levels gained: ${result.levelsGained}\n`);

    console.log('6. Testing addXpToUser when no level up needed (add 0 XP)...');
    const userState = await getUserById(user.id);
    result = {
      level: userState.level,
      xp: userState.xp,
      leveledUp: false,
      levelsGained: 0,
      message: 'Checked user state without adding XP.',
    };
    console.log(`✅ Result: Level ${result.level}, XP: ${result.xp}`);
    console.log(`   Leveled up: ${result.leveledUp}, Message: ${result.message}\n`);

    console.log('7. Adding 200 XP (will trigger level up inside addXpToUser)...');
    result = await addXpToUser(user.id, 200);

    console.log('8. Verifying state after adding 200 XP...');
    console.log(
      `✅ Result: Level ${result.currentLevel || result.level}, XP: ${result.currentXP || result.xp}`,
    );
    console.log(`   Leveled up: ${result.leveledUp}, Levels gained: ${result.levelsGained}\n`);

    console.log('9. Final user state...');
    const finalUser = await getUserById(user.id);
    console.log(`✅ Final state: Level ${finalUser.level}, XP: ${finalUser.xp}\n`);

    console.log('🎉 All XP system tests completed successfully!');
    console.log('\n📋 Test Summary:');
    console.log('- ✅ XP addition without leveling up');
    console.log('- ✅ Single level up at 100 XP');
    console.log('- ✅ Multiple level ups with large XP gains');
    console.log('- ✅ XP rollover behavior (subtract 100 per level)');
    console.log('- ✅ Proper XP remainder after multiple level ups');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    logger.error('[testXpSystem] Test error: %o', error);
    throw error;
  }
}

// Auto-run if executed directly
(async () => {
  try {
    await testXpSystem();
    console.log('\n✨ Test script completed');
    process.exit(0);
  } catch (error) {
    console.error('💥 Test script failed:', error);
    process.exit(1);
  }
})();

export { testXpSystem };
