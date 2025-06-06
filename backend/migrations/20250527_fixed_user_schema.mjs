/**
 * Migration file to update the User schema
 * This ensures User model in database matches the application expectations
 */

import prisma from '../db/index.mjs';

async function main() {
  try {
    // console.log('Starting User schema migration...');

    const allUsers = await prisma.user.findMany();
    // console.log(`Found ${allUsers.length} total users`);

    for (const user of allUsers) {
      const updates = {};

      if (!user.username) {
        try {
          if (typeof user.email !== 'string' || !user.email.includes('@')) {
            throw new Error(
              `User email (${JSON.stringify(user.email)}) is not a valid string or does not contain '@'.`,
            );
          }
          const usernameBase = user.email.split('@')[0];
          if (!usernameBase) {
            throw new Error(
              `Username base derived from email (${JSON.stringify(user.email)}) is empty.`,
            );
          }

          let username = usernameBase;
          let counter = 1;
          // eslint-disable-next-line no-constant-condition
          while (true) {
            const existingUser = await prisma.user.findFirst({
              where: {
                username,
                NOT: { id: user.id },
              },
            });
            if (!existingUser) {
              break;
            }
            username = `${usernameBase}${counter}`;
            counter++;
          }
          updates.username = username;
          // console.log(`Generated username for ${user.email}: ${username}`);
        } catch (error) {
          // console.warn(`Failed to generate username for user ID ${user.id} (email: ${JSON.stringify(user.email)}): ${error.message}`);
          updates.username = `user_${user.id}`;
          // console.log(`Using default username for user ID ${user.id} (email: ${user.email || 'N/A'}): ${updates.username}`);
        }
      }

      if (!user.firstName) {
        try {
          if (user.name && typeof user.name !== 'string') {
            throw new Error(`User name (${JSON.stringify(user.name)}) is not a string.`);
          }
          let firstName = user.name ? user.name.split(' ')[0] : '';
          if (!firstName || firstName.trim() === '') {
            firstName = 'User';
          }
          updates.firstName = firstName;
          // console.log(`Set firstName for ${user.email} to ${updates.firstName}`);
        } catch (error) {
          // console.warn(`Failed to generate firstName for user ID ${user.id} (name: ${JSON.stringify(user.name)}): ${error.message}`);
          updates.firstName = 'User';
        }
      }

      if (!user.lastName) {
        try {
          if (user.name && typeof user.name !== 'string') {
            throw new Error(`User name (${JSON.stringify(user.name)}) is not a string.`);
          }
          let lastName = '';
          if (user.name) {
            const nameParts = user.name.split(' ');
            if (nameParts.length > 1) {
              lastName = nameParts.slice(1).join(' ').trim();
            }
          }
          if (!lastName || lastName.trim() === '') {
            lastName = `UserLastName_${user.id}`;
          }
          updates.lastName = lastName;
          // console.log(`Set lastName for ${user.email} to ${updates.lastName}`);
        } catch (error) {
          // console.warn(`Failed to generate lastName for user ID ${user.id} (name: ${JSON.stringify(user.name)}): ${error.message}`);
          updates.lastName = `UserLastName_${user.id}`;
        }
      }

      if (Object.keys(updates).length > 0) {
        await prisma.user.update({
          where: { id: user.id },
          data: updates,
        });
        // console.log(`Updated user ${user.email} with fields: ${Object.keys(updates).join(', ')}`);
      }
    }
    // console.log('User schema migration completed successfully!');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(async e => {
  console.error('Unhandled migration error:', e);
  await prisma.$disconnect().catch(disconnectError => {
    console.error('Error disconnecting Prisma:', disconnectError);
  });
  process.exit(1);
});
