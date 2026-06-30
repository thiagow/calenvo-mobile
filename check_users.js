require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('\n=== Verificando usuários no banco de dados ===\n');
  
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      segmentType: true,
      planType: true
    }
  });
  
  console.log(`Total de usuários: ${users.length}\n`);
  
  users.forEach((user, index) => {
    console.log(`\n--- Usuário ${index + 1} ---`);
    console.log(`ID: ${user.id}`);
    console.log(`Nome: ${user.name}`);
    console.log(`Email: ${user.email}`);
    console.log(`Role: ${user.role}`);
    console.log(`Ativo: ${user.isActive ? 'Sim' : 'Não'}`);
    console.log(`Segmento: ${user.segmentType}`);
    console.log(`Plano: ${user.planType}`);
  });
  
  console.log('\n===========================================\n');
}

main()
  .catch((e) => {
    console.error('Erro:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
