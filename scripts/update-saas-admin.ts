import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const ADMIN_EMAIL = process.env.SAAS_ADMIN_EMAIL
const ADMIN_PASSWORD = process.env.SAAS_ADMIN_PASSWORD

async function main() {
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.error('❌ Defina SAAS_ADMIN_EMAIL e SAAS_ADMIN_PASSWORD no ambiente antes de rodar este script')
    process.exit(1)
  }

  console.log('Iniciando atualização do Administrador SaaS...')

  const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 12)

  // Primeiro, tenta encontrar um admin existente com role SAAS_ADMIN
  let admin = await prisma.user.findFirst({
    where: { role: 'SAAS_ADMIN' }
  })

  if (admin) {
    // Atualiza admin existente
    await prisma.user.update({
      where: { id: admin.id },
      data: {
        email: ADMIN_EMAIL,
        password: hashedPassword,
        name: 'SaaS Administrator'
      }
    })
    console.log(`✅ Administrador SaaS atualizado:`)
    console.log(`   Email: ${ADMIN_EMAIL}`)
    console.log(`   Senha: ${ADMIN_PASSWORD}`)
  } else {
    // Cria um novo admin se não existir
    admin = await prisma.user.create({
      data: {
        email: ADMIN_EMAIL,
        password: hashedPassword,
        name: 'SaaS Administrator',
        role: 'SAAS_ADMIN',
        isActive: true
      }
    })
    console.log(`✅ Novo Administrador SaaS criado:`)
    console.log(`   Email: ${ADMIN_EMAIL}`)
    console.log(`   Senha: ${ADMIN_PASSWORD}`)
  }

  console.log('\n✨ Operação concluída com sucesso!')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error('❌ Erro durante a atualização:', e)
    await prisma.$disconnect()
    process.exit(1)
  })
