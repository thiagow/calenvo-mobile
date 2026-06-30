const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcryptjs');

async function testAuthorize() {
    const credentials = { email: 'thiagow.net@gmail.com', password: 'admin123' };

    const user = await prisma.user.findFirst({
        where: {
            email: credentials.email,
            OR: [
                { role: 'SAAS_ADMIN' },
                { AND: [{ role: { in: ['MASTER', 'PROFESSIONAL'] } }, { isActive: true }] }
            ]
        }
    });

    if (!user) {
        console.log('❌ Auth: User not found with criteria');
        return;
    }

    const isPasswordValid = await bcrypt.compare(credentials.password, user.password);

    if (!isPasswordValid) {
        console.log('❌ Auth: Invalid password');
        return;
    }

    console.log('✅ Auth: Password valid! Returning', user.id);
}

testAuthorize().catch(console.error).finally(() => prisma.$disconnect());
