
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const USERS_TO_UPDATE = [
    'john@doe.com',
    'thiagow.net@gmail.com'
]

const NEW_PASSWORD = '@@Senha123'

async function main() {
    console.log('Iniciando atualização de senhas...')

    const hashedPassword = await bcrypt.hash(NEW_PASSWORD, 12)

    for (const email of USERS_TO_UPDATE) {
        const user = await prisma.user.findFirst({
            where: { email }
        })

        if (user) {
            await prisma.user.update({
                where: { id: user.id },
                data: { password: hashedPassword }
            })
            console.log(`Senha atualizada para o usuário: ${email}`)
        } else {
            console.log(`Usuário não encontrado: ${email}`)
        }
    }

    console.log('Atualização concluída!')
}

main()
    .then(async () => {
        await prisma.$disconnect()
    })
    .catch(async (e) => {
        console.error('Erro durante a atualização:', e)
        await prisma.$disconnect()
        process.exit(1)
    })
