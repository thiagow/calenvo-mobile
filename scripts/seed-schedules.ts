
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Iniciando seed de agendas e serviços...')

  // Buscar todos os usuários
  const users = await prisma.user.findMany()

  for (const user of users) {
    console.log(`\n👤 Processando usuário: ${user.email}`)

    // Verificar se já tem agendas
    const existingSchedules = await prisma.schedule.findMany({
      where: { userId: user.id }
    })

    if (existingSchedules.length > 0) {
      console.log(`  ✅ Usuário já possui ${existingSchedules.length} agenda(s)`)
      continue
    }

    // Criar serviços baseados no segmento do usuário
    let services: any[] = []

    if (user.segmentType === 'PHYSIOTHERAPY') {
      console.log('  🏥 Criando serviços para clínica médica...')
      
      const serviceData = [
        { name: 'Consulta Geral', category: 'Consultas', duration: 30, price: 150 },
        { name: 'Retorno', category: 'Consultas', duration: 20, price: 80 },
        { name: 'Exame de Rotina', category: 'Exames', duration: 15, price: 50 },
      ]

      for (const svc of serviceData) {
        const service = await prisma.service.create({
          data: {
            userId: user.id,
            ...svc
          }
        })
        services.push(service)
        console.log(`    ✓ Serviço criado: ${service.name}`)
      }

    } else if (user.segmentType === 'BEAUTY_SALON') {
      console.log('  💇 Criando serviços para salão de beleza...')
      
      const serviceData = [
        { name: 'Corte Masculino', category: 'Cortes', duration: 30, price: 40 },
        { name: 'Corte Feminino', category: 'Cortes', duration: 45, price: 60 },
        { name: 'Barba', category: 'Barba', duration: 20, price: 25 },
        { name: 'Coloração', category: 'Coloração', duration: 90, price: 150 },
      ]

      for (const svc of serviceData) {
        const service = await prisma.service.create({
          data: {
            userId: user.id,
            ...svc
          }
        })
        services.push(service)
        console.log(`    ✓ Serviço criado: ${service.name}`)
      }

    } else {
      console.log('  📋 Criando serviços padrão...')
      
      const serviceData = [
        { name: 'Atendimento Padrão', category: 'Geral', duration: 30, price: 100 },
        { name: 'Atendimento Express', category: 'Geral', duration: 15, price: 50 },
      ]

      for (const svc of serviceData) {
        const service = await prisma.service.create({
          data: {
            userId: user.id,
            ...svc
          }
        })
        services.push(service)
        console.log(`    ✓ Serviço criado: ${service.name}`)
      }
    }

    // Criar agenda padrão
    console.log('  📅 Criando agenda padrão...')
    
    const scheduleName = user.segmentType === 'PHYSIOTHERAPY' 
      ? 'Consultas Gerais'
      : user.segmentType === 'BEAUTY_SALON'
      ? 'Atendimentos'
      : 'Agenda Principal'

    const schedule = await prisma.schedule.create({
      data: {
        userId: user.id,
        name: scheduleName,
        description: 'Agenda padrão criada automaticamente',
        color: '#3B82F6',
        workingDays: [1, 2, 3, 4, 5], // Segunda a Sexta
        startTime: '08:00',
        endTime: '18:00',
        slotDuration: 30,
        bufferTime: 0,
        lunchStart: '12:00',
        lunchEnd: '13:00',
        advanceBookingDays: 30,
        minNoticeHours: 2
      }
    })
    console.log(`    ✓ Agenda criada: ${schedule.name}`)

    // Vincular todos os serviços à agenda
    if (services.length > 0) {
      console.log('  🔗 Vinculando serviços à agenda...')
      
      for (const service of services) {
        await prisma.scheduleService.create({
          data: {
            scheduleId: schedule.id,
            serviceId: service.id
          }
        })
      }
      console.log(`    ✓ ${services.length} serviço(s) vinculado(s)`)
    }

    // Migrar appointments existentes para usar a nova agenda e serviço
    const existingAppointments = await prisma.appointment.findMany({
      where: { 
        userId: user.id,
        scheduleId: null
      }
    })

    if (existingAppointments.length > 0) {
      console.log(`  📋 Migrando ${existingAppointments.length} agendamento(s) existente(s)...`)
      
      // Usar o primeiro serviço como padrão
      const defaultService = services[0]

      for (const appointment of existingAppointments) {
        await prisma.appointment.update({
          where: { id: appointment.id },
          data: {
            scheduleId: schedule.id,
            serviceId: defaultService?.id || null
          }
        })
      }
      console.log(`    ✓ Agendamentos migrados`)
    }

    console.log(`  ✅ Processamento concluído para ${user.email}`)
  }

  console.log('\n🎉 Seed concluído com sucesso!')
}

main()
  .catch((e) => {
    console.error('❌ Erro durante seed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
