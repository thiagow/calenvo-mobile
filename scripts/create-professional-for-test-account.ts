
import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcryptjs'
import * as dotenv from 'dotenv'

// Carregar variáveis de ambiente
dotenv.config()

const prisma = new PrismaClient()

async function createProfessionalForTestAccount() {
  try {
    console.log('🔍 Buscando conta de teste...')
    
    // Buscar o usuário master
    const masterUser = await prisma.user.findFirst({
      where: {
        email: 'nandafg@live.com',
        role: 'MASTER'
      }
    })

    if (!masterUser) {
      console.error('❌ Usuário com email nandafg@live.com não encontrado')
      return
    }

    console.log(`✅ Usuário encontrado: ${masterUser.name} (${masterUser.email})`)
    console.log(`📋 Plano atual: ${masterUser.planType}`)
    console.log(`📋 Segmento: ${masterUser.segmentType}`)

    // Verificar se já tem profissionais vinculados
    const existingProfessionals = await prisma.user.findMany({
      where: {
        masterId: masterUser.id,
        role: 'PROFESSIONAL'
      }
    })

    if (existingProfessionals.length > 0) {
      console.log(`⚠️  Já existem ${existingProfessionals.length} profissional(is) vinculado(s) a esta conta:`)
      existingProfessionals.forEach((prof: any, index: number) => {
        console.log(`   ${index + 1}. ${prof.name} (${prof.email})`)
      })
      console.log('ℹ️  Nenhum profissional adicional foi criado.')
      return
    }

    // Criar um profissional com os dados do master
    console.log('👤 Criando profissional...')
    
    // Gerar senha aleatória (pode ser alterada depois)
    const temporaryPassword = 'Temp@123'
    const hashedPassword = await bcrypt.hash(temporaryPassword, 10)

    const professional = await prisma.user.create({
      data: {
        name: masterUser.name,
        email: `prof.${masterUser.email}`, // Email diferente para não conflitar
        password: hashedPassword,
        role: 'PROFESSIONAL',
        whatsapp: masterUser.whatsapp,
        phone: masterUser.phone,
        segmentType: masterUser.segmentType,
        planType: masterUser.planType,
        masterId: masterUser.id,
        isActive: true,

        businessName: masterUser.businessName
      }
    })

    console.log(`✅ Profissional criado com sucesso!`)
    console.log(`   Nome: ${professional.name}`)
    console.log(`   Email: ${professional.email}`)
    console.log(`   ID: ${professional.id}`)
    console.log(`   Senha temporária: ${temporaryPassword}`)
    console.log(`   Role: ${professional.role}`)
    console.log(`   Vinculado ao master: ${masterUser.name}`)
    
    console.log('\n✅ Processo concluído!')
  } catch (error) {
    console.error('❌ Erro ao criar profissional:', error)
  } finally {
    await prisma.$disconnect()
  }
}

createProfessionalForTestAccount()
