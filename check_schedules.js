require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('\n=== Verificando agendas no banco de dados ===\n');
  
  const schedules = await prisma.schedule.findMany({
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true
        }
      },
      services: {
        include: {
          service: true
        }
      },
      professionals: {
        include: {
          professional: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        }
      }
    }
  });
  
  console.log(`Total de agendas: ${schedules.length}\n`);
  
  if (schedules.length > 0) {
    schedules.forEach((schedule, index) => {
      console.log(`\n--- Agenda ${index + 1} ---`);
      console.log(`ID: ${schedule.id}`);
      console.log(`Nome: ${schedule.name}`);
      console.log(`Descrição: ${schedule.description || 'N/A'}`);
      console.log(`Cor: ${schedule.color}`);
      console.log(`Usuário: ${schedule.user.name} (${schedule.user.email})`);
      console.log(`Dias de trabalho: ${schedule.workingDays.join(', ')}`);
      console.log(`Horário: ${schedule.startTime} - ${schedule.endTime}`);
      console.log(`Ativa: ${schedule.isActive ? 'Sim' : 'Não'}`);
      console.log(`Criada em: ${schedule.createdAt}`);
      console.log(`Serviços vinculados: ${schedule.services.length}`);
      console.log(`Profissionais vinculados: ${schedule.professionals.length}`);
    });
  } else {
    console.log('Nenhuma agenda encontrada no banco de dados.');
  }
  
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
