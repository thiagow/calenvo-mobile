const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const user = await prisma.user.findFirst({
        where: { email: 'thiagow.net@gmail.com' }
    });
    fs.writeFileSync('user-info.json', JSON.stringify(user, null, 2), 'utf-8');
}

main().catch(console.error).finally(() => prisma.$disconnect());
