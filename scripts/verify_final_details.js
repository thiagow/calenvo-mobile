
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const appointmentId = '21d10dab-aaae-4d73-bfc4-1ec7aae8066a';

    console.log(`Verificando IDs detalhados para o agendamento ${appointmentId}...`);
    const app = await prisma.appointment.findUnique({
        where: { id: appointmentId },
        select: {
            id: true,
            userId: true,
            professionalId: true,
            professional: true,
            scheduleId: true
        }
    });

    if (!app) {
        console.log('❌ Agendamento não encontrado.');
        return;
    }

    console.log('--- Detalhes do Agendamento ---');
    console.log(`ID: ${app.id}`);
    console.log(`userId (Master/Dono): ${app.userId}`);
    console.log(`professionalId (Profissional Relacionamento): ${app.professionalId || 'NULO'}`);
    console.log(`professional (Profissional Legado): ${app.professional || 'NULO'}`);
    console.log(`scheduleId: ${app.scheduleId}`);

    // Verificar o usuário do userId
    const master = await prisma.user.findUnique({
        where: { id: app.userId },
        select: { id: true, name: true, email: true, role: true }
    });
    console.log('\n--- Detalhes do Dono do Agendamento (userId) ---');
    console.log(`ID: ${master.id}`);
    console.log(`Nome: ${master.name}`);
    console.log(`Email: ${master.email}`);
    console.log(`Função: ${master.role}`);
}

main()
    .catch(e => console.error('Erro ao executar consulta:', e))
    .finally(async () => {
        await prisma.$disconnect();
    });
