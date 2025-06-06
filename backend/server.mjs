import { PrismaClient } from '../packages/database/node_modules/@prisma/client/index.mjs';

async function testConnections() {
  const connectionStrings = [
    'postgresql://postgres@localhost:5432/postgres', // No password
    'postgresql://postgres:@localhost:5432/postgres', // Empty password
    'postgresql://postgres:postgres@localhost:5432/postgres', // postgres password
    'postgresql://postgres:admin@localhost:5432/postgres', // admin password
    'postgresql://postgres:123456@localhost:5432/postgres', // 123456 password
    'postgresql://postgres:password@localhost:5432/postgres', // password password
  ];

  for (const connectionString of connectionStrings) {
    console.log(`\nTrying: ${connectionString.replace(/:([^:@]+)@/, ':***@')}`);

    const prisma = new PrismaClient({
      datasources: {
        db: {
          url: connectionString,
        },
      },
    });

    try {
      await prisma.$connect();
      console.log('✅ Connection successful!');

      // Try to list databases
      try {
        const result =
          await prisma.$queryRaw`SELECT datname FROM pg_database WHERE datistemplate = false;`;
        console.log(
          '📋 Available databases:',
          result.map(r => r.datname),
        );

        // Check if equoria database exists
        const equoriaExists = result.some(r => r.datname === 'equoria');
        if (!equoriaExists) {
          console.log('🔧 Creating equoria database...');
          await prisma.$executeRaw`CREATE DATABASE equoria;`;
          console.log('✅ Equoria database created!');
        } else {
          console.log('✅ Equoria database already exists');
        }
      } catch (error) {
        console.log('⚠️ Could not list/create databases:', error.message);
      }

      await prisma.$disconnect();
      return connectionString; // Return successful connection string
    } catch (error) {
      console.log('❌ Failed:', error.message);
      await prisma.$disconnect();
    }
  }

  console.log('\n❌ All connection attempts failed');
  return null;
}

testConnections()
  .then(successfulConnection => {
    if (successfulConnection) {
      console.log(`\n🎉 Use this connection string: ${successfulConnection}`);
    }
  })
  .catch(console.error);
