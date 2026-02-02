import pkg from 'pg';
const { Client } = pkg;

// Use the connection string from .env.test (hardcoded here for safety as shown in read_file)
const connectionString = 'postgresql://postgres:JimpkpNnVF2o%23DaX1Qx0@localhost:5432/equoria_test';

const client = new Client({
  connectionString,
});

async function kill() {
  try {
    console.log('Attempting to connect to DB to inspect connections...');
    await client.connect();
    console.log('Connected.');

    const countRes = await client.query(`
      SELECT datname, usename, count(*) as connections
      FROM pg_stat_activity
      GROUP BY datname, usename;
    `);

    console.log('Current Connections:', countRes.rows);

    const killRes = await client.query(`
      SELECT pg_terminate_backend(pid)
      FROM pg_stat_activity
      WHERE datname = 'equoria_test'
        AND pid <> pg_backend_pid();
    `);

    console.log(`Terminated ${killRes.rowCount} connections for equoria_test.`);
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }
}

kill();
