import prisma from './db/index.mjs';

async function addCoordinationField() {
  try {
    console.log('🔧 Adding coordination field to Horse table...');
    
    // Use Prisma's raw SQL execution to add the column
    await prisma.$executeRaw`ALTER TABLE "Horse" ADD COLUMN IF NOT EXISTS "coordination" INTEGER DEFAULT 0`;
    
    console.log('✅ Coordination field added successfully!');
    
    // Verify the column was added by trying to update a horse with coordination
    const testHorse = await prisma.horse.findFirst();
    if (testHorse) {
      await prisma.horse.update({
        where: { id: testHorse.id },
        data: { coordination: 50 }
      });
      console.log('✅ Coordination field verified - test update successful!');
    }
    
  } catch (error) {
    console.error('❌ Error adding coordination field:', error.message);
  } finally {
    await prisma.$disconnect();
    console.log('✅ Database connection closed');
  }
}

addCoordinationField();
