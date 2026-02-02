import prisma from './packages/database/prismaClient.mjs';

async function check() {
  try {
    const horseCols =
      await prisma.$queryRaw`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'horses'`;
    console.log('Columns in horses table:');
    console.log(horseCols.map((c) => c.column_name).sort());
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

check();
