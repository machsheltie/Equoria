import pkg from 'pg';
const { Client } = pkg;

async function applyCoordinationMigration() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    database: 'equoria_test',
    user: 'postgres',
    password: 'password123',
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    // Check if coordination column already exists
    const checkResult = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'Horse' AND column_name = 'coordination'
    `);

    if (checkResult.rows.length > 0) {
      console.log('✅ Coordination column already exists');
      return;
    }

    // Add coordination column
    await client.query('ALTER TABLE "Horse" ADD COLUMN "coordination" INTEGER DEFAULT 0');
    console.log('✅ Added coordination column to Horse table');

    // Verify the column was added
    const verifyResult = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'Horse' AND column_name = 'coordination'
    `);

    if (verifyResult.rows.length > 0) {
      console.log('✅ Coordination column verified successfully');
    } else {
      console.log('❌ Failed to verify coordination column');
    }

  } catch (error) {
    console.error('❌ Error applying migration:', error);
  } finally {
    await client.end();
    console.log('✅ Database connection closed');
  }
}

applyCoordinationMigration();
