
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
    const email = 'thiagow.net@gmail.com';
    const password = '##User$Admin';

    const hashedPassword = await bcrypt.hash(password, 10);

    try {
        const user = await prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                name: 'Admin',
                role: 'MASTER',
                planType: 'PREMIUM', // Dando permissão premium para o admin
                isActive: true,
            },
        });
        console.log('Usuário administrador criado com sucesso:', user);
    } catch (e) {
        if (e.code === 'P2002') {
            console.log('Usuário já existe, atualizando senha...');
            const user = await prisma.user.update({
                where: { email },
                data: {
                    password: hashedPassword,
                    role: 'MASTER',
                    isActive: true
                }
            });
            console.log('Usuário atualizado com sucesso:', user);
        } else {
            console.error('Erro ao criar usuário:', e);
        }
    } finally {
        await prisma.$disconnect();
    }
}

main();
