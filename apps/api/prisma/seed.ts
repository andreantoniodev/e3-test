import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  const unitA = await prisma.unit.upsert({
    where: { slug: 'unidade-a' },
    update: { name: 'Unidade A' },
    create: { name: 'Unidade A', slug: 'unidade-a' },
  });

  const unitB = await prisma.unit.upsert({
    where: { slug: 'unidade-b' },
    update: { name: 'Unidade B' },
    create: { name: 'Unidade B', slug: 'unidade-b' },
  });

  await prisma.user.upsert({
    where: { email: 'unidade.a@example.com' },
    update: { name: 'Atendente Unidade A', unitId: unitA.id },
    create: {
      email: 'unidade.a@example.com',
      name: 'Atendente Unidade A',
      unitId: unitA.id,
    },
  });

  await prisma.user.upsert({
    where: { email: 'unidade.b@example.com' },
    update: { name: 'Atendente Unidade B', unitId: unitB.id },
    create: {
      email: 'unidade.b@example.com',
      name: 'Atendente Unidade B',
      unitId: unitB.id,
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    throw error;
  });
