import prisma from '../../packages/database/prismaClient.mjs';

async function checkData() {
  try {
    const breeds = await prisma.breed.findMany();
    const users = await prisma.user.findMany();
    const horses = await prisma.horse.findMany();
    const grooms = await prisma.groom.findMany();

    console.log('📊 Database Status:');
    console.log(`Breeds: ${breeds.length}`);
    console.log(`Users: ${users.length}`);
    console.log(`Horses: ${horses.length}`);
    console.log(`Grooms: ${grooms.length}`);

    if (breeds.length === 0) {
      console.log('\n❌ No breeds found. Need to seed breeds first.');
    }
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkData();
