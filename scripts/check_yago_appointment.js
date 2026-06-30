
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('Pesquisando cliente "Yago Wenceslau"...');
    const clients = await prisma.client.findMany({
        where: {
            name: {
                contains: 'Yago Wenceslau',
                mode: 'insensitive'
            }
        },
        include: {
            appointments: {
                include: {
                    professionalUser: {
                        select: {
                            id: true,
                            name: true,
                            email: true
                        }
                    },
                    schedule: {
                        select: {
                            id: true,
                            name: true
                        }
                    },
                    service: {
                        select: {
                            id: true,
                            name: true
                        }
                    }
                },
                orderBy: {
                    date: 'desc'
                }
            }
        }
    });

    if (clients.length === 0) {
        console.log('❌ Nenhum cliente encontrado com este nome.');
        return;
    }

    clients.forEach(client => {
        console.log(`\n✅ Cliente encontrado: ${client.name} (ID: ${client.id})`);
        console.log(`Total de agendamentos: ${client.appointments.length}`);

        client.appointments.forEach((app, index) => {
            console.log(`\n--- Agendamento ${index + 1} ---`);
            console.log(`ID: ${app.id}`);
            console.log(`Data: ${app.date}`);
            console.log(`Status: ${app.status}`);
            console.log(`Profissional (Relacionamento): ${app.professionalUser ? `${app.professionalUser.name} (${app.professionalUser.email})` : 'NÃO DEFINIDO'}`);
            console.log(`Profissional (Legado): ${app.professional || 'NÃO DEFINIDO'}`);
            console.log(`Agenda: ${app.schedule ? app.schedule.name : 'NÃO DEFINIDO'}`);
            console.log(`Serviço: ${app.service ? app.service.name : 'NÃO DEFINIDO'}`);
            console.log(`Criado em: ${app.createdAt}`);
        });
    });
}

main()
    .catch(e => console.error('Erro ao executar consulta:', e))
    .finally(async () => {
        await prisma.$disconnect();
    });
