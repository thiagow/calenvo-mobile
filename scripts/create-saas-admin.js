
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
    // Email e senha podem vir de variáveis de ambiente ou argumentos
    const email = process.env.SAAS_ADMIN_EMAIL || process.argv[2] || 'admin@calenvo.com.br';
    const password = process.env.SAAS_ADMIN_PASSWORD || process.argv[3] || 'Admin@2024!';
    const name = process.env.SAAS_ADMIN_NAME || process.argv[4] || 'SaaS Admin';

    console.log('🔐 Criando usuário SAAS_ADMIN...');
    console.log('📧 Email:', email);
    console.log('👤 Nome:', name);

    const hashedPassword = await bcrypt.hash(password, 12);

    try {
        const user = await prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                name,
                role: 'SAAS_ADMIN',
                planType: 'PREMIUM',
                isActive: true,
                // SAAS_ADMIN não precisa de businessName, segmentType, etc.
            },
        });
        console.log('✅ Usuário SAAS_ADMIN criado com sucesso!');
        console.log('📋 ID:', user.id);
        console.log('📧 Email:', user.email);
        console.log('👤 Nome:', user.name);
        console.log('🔑 Role:', user.role);
    } catch (e) {
        if (e.code === 'P2002') {
            console.log('⚠️ Usuário já existe com este email e role.');
            console.log('💡 Tentando atualizar senha...');

            const user = await prisma.user.updateMany({
                where: {
                    email,
                    role: 'SAAS_ADMIN'
                },
                data: {
                    password: hashedPassword,
                    isActive: true,
                    name
                }
            });

            if (user.count > 0) {
                console.log('✅ Senha atualizada com sucesso!');
            } else {
                console.log('❌ Não foi possível atualizar. Verifique se o usuário existe.');
            }
        } else {
            console.error('❌ Erro ao criar usuário:', e);
        }
    } finally {
        await prisma.$disconnect();
    }
}

main();
