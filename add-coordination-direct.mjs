import { Client } from 'pg';

async function addCoordinationColumn() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    database: 'equoria_test',
    user: 'postgres',
    password: 'JimpkpNnVF2o#DaX1Qx0',
  });

  try {
    await client.connect();
    console.log('✅ Connected to PostgreSQL database');

    // List all tables to see what exists
    const tablesResult = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
    `);
    console.log('📋 Available tables:', tablesResult.rows.map(r => r.table_name));

    // Check if coordination column already exists
    const checkQuery = `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'horses' AND column_name = 'coordination'
    `;
    
    const checkResult = await client.query(checkQuery);
    
    if (checkResult.rows.length > 0) {
      console.log('✅ Coordination column already exists');
      return;
    }

    // Add coordination column
    console.log('🔧 Adding coordination column to horses table...');
    await client.query('ALTER TABLE "horses" ADD COLUMN "coordination" INTEGER DEFAULT 0');
    
    console.log('✅ Coordination column added successfully!');

    // Verify the column was added
    const verifyResult = await client.query(checkQuery);
    
    if (verifyResult.rows.length > 0) {
      console.log('✅ Coordination column verified in database');
    } else {
      console.log('❌ Failed to verify coordination column');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
    console.log('✅ Database connection closed');
  }
}

addCoordinationColumn();
