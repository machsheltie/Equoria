import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function addCoordinationField() {
  try {
    console.log('Adding coordination field to Horse table...');
    
    await prisma.$executeRaw`ALTER TABLE "Horse" ADD COLUMN IF NOT EXISTS "coordination" INTEGER DEFAULT 0;`;
    
    console.log('✅ Coordination field added successfully!');
  } catch (error) {
    console.error('❌ Error adding coordination field:', error);
  } finally {
    await prisma.$disconnect();
  }
}

addCoordinationField();
