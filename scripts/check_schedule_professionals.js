
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const scheduleId = 'cm7mejbtf0003bpxr7f26n354'; // Vou pegar o ID da agenda do resultado anterior se possível, mas aqui vou buscar pelo nome para garantir

    console.log('Pesquisando profissionais para a agenda "Consulta Fisioterapia"...');
    const schedule = await prisma.schedule.findFirst({
        where: { name: 'Consulta Fisioterapia' },
        include: {
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

    if (!schedule) {
        console.log('❌ Agenda não encontrada.');
        return;
    }

    console.log(`✅ Agenda encontrada: ${schedule.name} (ID: ${schedule.id})`);
    console.log(`Total de profissionais vinculados: ${schedule.professionals.length}`);

    schedule.professionals.forEach((sp, index) => {
        console.log(`--- Profissional ${index + 1} ---`);
        console.log(`ID: ${sp.professional.id}`);
        console.log(`Nome: ${sp.professional.name}`);
        console.log(`Email: ${sp.professional.email}`);
    });
}

main()
    .catch(e => console.error('Erro ao executar consulta:', e))
    .finally(async () => {
        await prisma.$disconnect();
    });
