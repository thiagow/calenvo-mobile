import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'

const prisma = new PrismaClient()

async function main() {
  console.log('Criando usuário admin SaaS...')

  const email = process.env.SAAS_ADMIN_EMAIL
  let plainPassword = process.env.SAAS_ADMIN_PASSWORD

  if (!email) {
    throw new Error('SAAS_ADMIN_EMAIL não definido. Use: SAAS_ADMIN_EMAIL=... SAAS_ADMIN_PASSWORD=... npx tsx scripts/create-saas-admin.ts')
  }

  if (!plainPassword) {
    plainPassword = crypto.randomBytes(18).toString('base64url')
    console.log(`SAAS_ADMIN_PASSWORD não definido — gerando senha aleatória: ${plainPassword}`)
    console.log('Guarde essa senha agora, ela não será exibida novamente.')
  }

  // Check if user already exists
  const existingUser = await prisma.user.findFirst({
    where: {
      email: email,
      role: 'SAAS_ADMIN'
    }
  })

  if (existingUser) {
    console.log(`Usuário admin SaaS já existe: ${email}`)
    console.log(`ID: ${existingUser.id}`)
    return
  }

  // Hash password with bcrypt (12 rounds - same as NextAuth default)
  const hashedPassword = await bcrypt.hash(plainPassword, 12)

  const admin = await prisma.user.create({
    data: {
      email,
      role: 'SAAS_ADMIN',
      password: hashedPassword,
      name: 'Admin SaaS',
      isActive: true,
      locale: 'pt',
      // SAAS_ADMIN doesn't need these, but schema requires some defaults
      segmentTypes: ['TECH_SAAS'],
      planType: null, // SAAS_ADMIN doesn't have a plan
    }
  })

  console.log('✅ Admin SaaS criado com sucesso!')
  console.log(`Email: ${admin.email}`)
  console.log(`ID: ${admin.id}`)
  console.log(`Role: ${admin.role}`)
  console.log(`Ativo: ${admin.isActive}`)
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error('❌ Erro ao criar admin SaaS:', e.message)
    await prisma.$disconnect()
    process.exit(1)
  })
