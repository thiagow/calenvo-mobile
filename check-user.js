const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const user = await prisma.user.findFirst({
        where: { email: 'thiagow.net@gmail.com' }
    });
    console.log('User:', user);
}

main().catch(console.error).finally(() => prisma.$disconnect());
