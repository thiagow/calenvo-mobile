
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { AppointmentStatus } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('Testando lógica de Top Clientes (simulação da API)...');
    const userId = 'cmkkmmkr10000krok4fgakfbt'; // Admin

    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const appointments = await prisma.appointment.findMany({
        where: {
            userId,
            date: {
                gte: startDate,
                lte: endDate
            }
        },
        select: {
            clientId: true,
            status: true,
            client: {
                select: {
                    id: true,
                    name: true,
                    phone: true,
                    email: true
                }
            }
        }
    });

    const clientStats = new Map();

    appointments.forEach(apt => {
        // Nova lógica de chave
        const clientKey = apt.client.name.toLowerCase().trim();

        const existing = clientStats.get(clientKey) || {
            clientId: apt.clientId,
            clientName: apt.client.name,
            clientPhone: apt.client.phone,
            clientEmail: apt.client.email,
            total: 0,
            completed: 0,
            cancelled: 0,
            noShow: 0
        };

        existing.total++;

        if (apt.status === AppointmentStatus.COMPLETED) {
            existing.completed++;
        } else if (apt.status === AppointmentStatus.CANCELLED) {
            existing.cancelled++;
        } else if (apt.status === AppointmentStatus.NO_SHOW) {
            existing.noShow++;
        }

        clientStats.set(clientKey, existing);
    });

    const topClients = Array.from(clientStats.values())
        .map(client => ({
            ...client,
            completionRate: client.total > 0
                ? Math.round((client.completed / client.total) * 100)
                : 0
        }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 10);

    console.log(`\n✅ Retorno simulado da API (Top ${topClients.length} clientes):`);
    topClients.forEach((c, idx) => {
        console.log(`${idx + 1}. ${c.clientName} | Total: ${c.total} (Agrupado com sucesso)`);
    });
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
