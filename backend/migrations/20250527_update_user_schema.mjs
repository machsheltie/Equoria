/**
 * Migration file to update the User schema
 * This ensures User model in database matches the application expectations
 */

import prisma from '../db/index.mjs';

async function main() {
  try {
    // console.log('Starting User schema migration...');

    // 1. First get all users to identify those needing updates
    const allUsers = await prisma.user.findMany();
    // console.log(`Found ${allUsers.length} total users`);

    // 2. Process each user to ensure they have all required fields
    for (const user of allUsers) {
      const updates = {};
      // Handle username field - generate if missing or null
      if (!user.username) {
        try {
          if (typeof user.email !== 'string' || !user.email.includes('@')) {
            throw new Error(
              `User email (${JSON.stringify(user.email)}) is not a string or does not contain '@'.`,
            );
          }
          const usernameBase = user.email.split('@')[0];
          if (!usernameBase) {
            // Handles cases like "@domain.com" or an empty email part
            throw new Error(
              `Username base derived from email (${JSON.stringify(user.email)}) is empty.`,
            );
          }

          let username = usernameBase;
          let counter = 1;
          let usernameFound = false;

          // Make sure username is unique
          while (!usernameFound) {
            const existingUser = await prisma.user.findFirst({
              where: {
                username,
                NOT: { id: user.id },
              },
            });

            if (!existingUser) {
              usernameFound = true;
            } else {
              username = `${usernameBase}${counter}`;
              counter++;
            }
          }

          updates.username = username;
          // console.log(`Generated username for user ID ${user.id} (email: ${user.email}): ${username}`);
        } catch (error) {
          // console.warn(`Failed to generate username for user ID ${user.id} (email: ${JSON.stringify(user.email)}): ${error.message}`);
          updates.username = `user_${user.id}`; // Fallback username
          // console.log(`Using default username for user ID ${user.id} (email: ${user.email || 'N/A'}): ${updates.username}`);
        }
      }
      // Handle firstName field
      if (!user.firstName) {
        try {
          if (user.name && typeof user.name !== 'string') {
            throw new Error(`User name (${JSON.stringify(user.name)}) is not a string.`);
          }
          updates.firstName = user.name ? user.name.split(' ')[0] : 'User';
          // If user.name was an empty string, user.name.split(' ')[0] would be "", so ensure it's 'User'
          if (updates.firstName === '') {
            updates.firstName = 'User';
          }
        } catch (error) {
          // console.warn(`Failed to generate firstName for user ID ${user.id} (name: ${JSON.stringify(user.name)}): ${error.message}`);
          updates.firstName = 'User'; // Fallback
        }
        // console.log(`Set firstName for user ID ${user.id} (email: ${user.email || 'N/A'}) to ${updates.firstName}`);
      }

      // Handle lastName field
      if (!user.lastName) {
        try {
          if (user.name && typeof user.name !== 'string') {
            throw new Error(`User name (${JSON.stringify(user.name)}) is not a string.`);
          }
          updates.lastName = user.name
            ? user.name.split(' ').slice(1).join(' ').trim() || 'User' // Ensure 'User' if rest of name is empty
            : `User_${user.id}`; // Fallback with consistent prefix
          // If user.name was a single word or empty string, (slice(1).join(' ').trim() || 'User') handles it.
          // If user.name was null/undefined, ternary handles it.
        } catch (error) {
          // console.warn(`Failed to generate lastName for user ID ${user.id} (name: ${JSON.stringify(user.name)}): ${error.message}`);
          updates.lastName = `User_${user.id}`; // Fallback with consistent prefix
        }
        // console.log(`Set lastName for user ID ${user.id} (email: ${user.email || 'N/A'}) to ${updates.lastName}`);
      }

      // Update user if we have changes
      if (Object.keys(updates).length > 0) {
        await prisma.user.update({
          where: { id: user.id },
          data: updates,
        });

        // console.log(`Updated user ID ${user.id} (email: ${user.email || 'N/A'}) with fields: ${Object.keys(updates).join(', ')}`);
      }
    }

    // console.log('User schema migration completed successfully!');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(async error => {
  console.error('Migration failed:', error);
  await prisma.$disconnect();
  process.exit(1);
});
