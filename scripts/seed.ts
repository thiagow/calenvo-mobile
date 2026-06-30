
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Iniciando seed do banco de dados...')

  // Create test user (required for testing)
  const testPassword = await bcrypt.hash('johndoe123', 12)
  
  // First check if user exists
  let testUser = await prisma.user.findFirst({
    where: { 
      email: 'john@doe.com',
      role: 'MASTER'
    }
  })

  if (!testUser) {
    testUser = await prisma.user.create({
      data: {
        email: 'john@doe.com',
        role: 'MASTER',
        password: testPassword,
        name: 'Dr. John Doe',
        businessName: 'Clínica Teste',
        segmentType: 'BEAUTY_SALON',
        phone: '(11) 99999-9999',
        planType: 'PREMIUM' // Admin with Premium privileges
      }
    })
  }

  // Create business config for test user
  await prisma.businessConfig.upsert({
    where: { userId: testUser.id },
    update: {},
    create: {
      userId: testUser.id,
      workingDays: [1, 2, 3, 4, 5], // Monday to Friday
      startTime: '08:00',
      endTime: '18:00',
      defaultDuration: 30,
      lunchStart: '12:00',
      lunchEnd: '13:00'
    }
  })

  // Create plan usage for test user
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)

  await prisma.planUsage.upsert({
    where: { userId: testUser.id },
    update: {},
    create: {
      userId: testUser.id,
      appointmentsCount: 0,
      currentPeriodStart: startOfMonth,
      currentPeriodEnd: endOfMonth,
      resetAt: nextMonth
    }
  })

  // Create some sample patients
  const patients = [
    {
      name: 'Maria Silva Santos',
      email: 'maria.silva@email.com',
      phone: '(11) 98765-4321',
      cpf: '123.456.789-10',
      birthDate: new Date('1985-03-15'),
      address: 'Rua das Flores, 123, São Paulo - SP'
    },
    {
      name: 'João Oliveira Lima',
      email: 'joao.oliveira@email.com',
      phone: '(11) 97654-3210',
      cpf: '987.654.321-00',
      birthDate: new Date('1990-07-22'),
      address: 'Av. Paulista, 456, São Paulo - SP'
    },
    {
      name: 'Ana Costa Pereira',
      email: 'ana.costa@email.com',
      phone: '(11) 96543-2109',
      cpf: '456.789.123-45',
      birthDate: new Date('1978-11-08'),
      address: 'Rua Augusta, 789, São Paulo - SP'
    }
  ]

  for (const patientData of patients) {
    await prisma.client.upsert({
      where: { 
        cpf_userId: {
          cpf: patientData.cpf,
          userId: testUser.id
        }
      },
      update: {},
      create: {
        ...patientData,
        userId: testUser.id
      }
    })
  }

  // Create some sample appointments
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(9, 0, 0, 0)

  const dayAfterTomorrow = new Date()
  dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2)
  dayAfterTomorrow.setHours(14, 0, 0, 0)

  // Get created clients
  const createdClients = await prisma.client.findMany({
    where: { userId: testUser.id }
  })

  if (createdClients.length >= 2) {
    await prisma.appointment.create({
      data: {
        date: tomorrow,
        duration: 30,
        status: 'SCHEDULED',
        modality: 'PRESENCIAL',
        specialty: 'Clínica Geral',
        insurance: 'Unimed',
        notes: 'Consulta de rotina',
        price: 150.00,
        userId: testUser.id,
        clientId: createdClients[0].id
      }
    })

    await prisma.appointment.create({
      data: {
        date: dayAfterTomorrow,
        duration: 45,
        status: 'CONFIRMED',
        modality: 'TELECONSULTA',
        specialty: 'Cardiologia',
        insurance: 'Bradesco Saúde',
        notes: 'Acompanhamento cardiológico',
        price: 200.00,
        userId: testUser.id,
        clientId: createdClients[1].id
      }
    })
  }

  console.log('Seed concluído com sucesso!')
  console.log(`Usuário teste criado: john@doe.com`)
  console.log(`${patients.length} clientes criados`)
  console.log(`${createdClients.length >= 2 ? '2' : '0'} agendamentos criados`)
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
