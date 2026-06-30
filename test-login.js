const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcryptjs');

async function main() {
    const hash = await bcrypt.hash('admin123', 10);
    await prisma.user.updateMany({
        where: { email: 'thiagow.net@gmail.com' },
        data: { password: hash }
    });
    console.log('Password updated to admin123');
}

main().catch(console.error).finally(() => prisma.$disconnect());
