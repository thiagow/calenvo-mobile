
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testAppointmentFlow() {
  try {
    console.log('🧪 Testando fluxo de criação de agendamento...\n');
    
    // 1. Verificar se o usuário existe
    const user = await prisma.user.findUnique({
      where: { email: 'john@doe.com' }
    });
    
    if (!user) {
      console.log('❌ Usuário não encontrado');
      return;
    }
    console.log('✅ Usuário encontrado:', user.name);
    
    // 2. Simular criação de cliente
    const clientData = {
      name: 'Teste Cliente',
      email: 'teste@cliente.com',
      phone: '(11) 99999-9999',
      cpf: null
    };
    
    let client = await prisma.client.findFirst({
      where: {
        userId: user.id,
        name: {
          equals: clientData.name,
          mode: 'insensitive'
        }
      }
    });
    
    if (!client) {
      client = await prisma.client.create({
        data: {
          userId: user.id,
          ...clientData
        }
      });
      console.log('✅ Cliente criado:', client.name);
    } else {
      console.log('✅ Cliente já existe:', client.name);
    }
    
    // 3. Simular criação de agendamento
    const appointmentDate = new Date();
    appointmentDate.setDate(appointmentDate.getDate() + 1);
    appointmentDate.setHours(10, 0, 0, 0);
    
    const appointmentData = {
      userId: user.id,
      clientId: client.id,
      date: appointmentDate,
      duration: 30,
      status: 'SCHEDULED',
      modality: 'PRESENCIAL',
      specialty: 'Teste',
      insurance: 'Particular',
      notes: 'Teste de agendamento'
    };
    
    const appointment = await prisma.appointment.create({
      data: appointmentData,
      include: {
        client: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true
          }
        }
      }
    });
    
    console.log('✅ Agendamento criado com sucesso!');
    console.log('ID:', appointment.id);
    console.log('Data:', appointment.date);
    console.log('Cliente:', appointment.client.name);
    
    // 4. Verificar se o agendamento pode ser listado
    const appointments = await prisma.appointment.findMany({
      where: { userId: user.id },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true
          }
        }
      }
    });
    
    console.log('✅ Total de agendamentos no sistema:', appointments.length);
    
    // 5. Testar a transformação dos dados (como na API)
    const transformedAppointments = appointments.map(appointment => ({
      id: appointment.id,
      date: appointment.date,
      patient: {
        name: appointment.client.name,
        phone: appointment.client.phone,
        email: appointment.client.email
      },
      specialty: appointment.specialty || 'Consulta Geral',
      status: appointment.status,
      modality: appointment.modality,
      duration: appointment.duration,
      insurance: appointment.insurance || 'Particular',
      notes: appointment.notes || '',
      professional: appointment.professional || 'Não definido',
      price: appointment.price
    }));
    
    console.log('✅ Dados transformados corretamente');
    console.log('Primeiro agendamento:', JSON.stringify(transformedAppointments[0], null, 2));
    
  } catch (error) {
    console.log('❌ Erro durante o teste:', error.message);
    console.log('Stack:', error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

testAppointmentFlow();
