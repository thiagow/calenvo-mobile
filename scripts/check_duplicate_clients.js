
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('Procurando clientes duplicados (mesmo nome ou telefone)...');

    // Buscar os top clientes para ver se tem duplicados
    const adminUserId = 'cmkkmmkr10000krok4fgakfbt'; // Admin

    const clients = await prisma.client.findMany({
        where: { userId: adminUserId },
        include: {
            _count: {
                select: { appointments: true }
            }
        }
    });

    console.log(`Total de clientes encontrados: ${clients.length}`);

    // Agrupar por nome e telefone
    const byName = new Map();
    const byPhone = new Map();

    clients.forEach(c => {
        // Por Nome
        const nameKey = c.name.toLowerCase().trim();
        if (!byName.has(nameKey)) {
            byName.set(nameKey, []);
        }
        byName.get(nameKey).push(c);

        // Por Telefone
        if (c.phone) {
            const phoneKey = c.phone.replace(/\D/g, ''); // apenas numeros
            if (phoneKey && phoneKey.length > 5) {
                if (!byPhone.has(phoneKey)) {
                    byPhone.set(phoneKey, []);
                }
                byPhone.get(phoneKey).push(c);
            }
        }
    });

    let foundDupes = false;

    console.log('\n--- Duplicados por Nome ---');
    byName.forEach((dupes, name) => {
        if (dupes.length > 1) {
            foundDupes = true;
            console.log(`Nome: "${name}" aparece ${dupes.length} vezes:`);
            dupes.forEach(d => console.log(`  - ID: ${d.id}, Phone: ${d.phone}, Agendamentos: ${d._count.appointments}`));
        }
    });

    console.log('\n--- Duplicados por Telefone ---');
    byPhone.forEach((dupes, phone) => {
        if (dupes.length > 1) {
            foundDupes = true;
            console.log(`Telefone: "${phone}" aparece ${dupes.length} vezes:`);
            dupes.forEach(d => console.log(`  - ID: ${d.id}, Name: ${d.name}, Agendamentos: ${d._count.appointments}`));
        }
    });

    if (!foundDupes) {
        console.log('\n✅ NENHUM CLIENTE DUPLICADO ENCONTRADO!');
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
