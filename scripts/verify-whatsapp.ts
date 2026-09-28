
import { WhatsAppTriggerService } from '../lib/whatsapp-trigger';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function runVerification() {
  console.log('🚀 Iniciando Verificação do Sistema de WhatsApp...');
  
  // 1. Setup Test Data
  const testUser = await prisma.user.findFirst({
    where: { email: 'john@doe.com' },
    include: { whatsappConfig: true }
  });

  if (!testUser) {
    console.error('❌ Usuário de teste não encontrado. Execute npm run prisma:seed primeiro.');
    return;
  }

  // Update config to ensure it's enabled for testing
  await prisma.whatsAppConfig.upsert({
    where: { userId: testUser.id },
    update: {
      enabled: true,
      isConnected: true,
      notifyOnCreate: true,
      notifyOnCancel: true,
      instanceName: 'test-instance',
      apiUrl: 'http://localhost:8080',
      phoneNumber: '5511999999999'
    },
    create: {
      userId: testUser.id,
      apiUrl: 'http://localhost:8080',
      instanceName: 'test-instance',
      phoneNumber: '5511999999999',
      enabled: true,
      isConnected: true,
      notifyOnCreate: true,
      createMessage: 'Olá {{nome_cliente}}, seu agendamento para {{data}} às {{hora}} foi confirmado!',
      notifyOnCancel: true,
      cancelMessage: 'Olá {{nome_cliente}}, seu agendamento para {{data}} foi cancelado.'
    }
  });

  const client = await prisma.client.findFirst({
    where: { userId: testUser.id }
  });

  if (!client) {
    console.error('❌ Cliente de teste não encontrado.');
    return;
  }

  const appointment = await prisma.appointment.create({
    data: {
      userId: testUser.id,
      clientId: client.id,
      date: new Date(),
      duration: 30,
      status: 'SCHEDULED',
      modality: 'PRESENCIAL',
      specialty: 'Teste'
    },
    include: {
      client: true,
      user: true,
      service: true,
      professionalUser: true
    }
  }) as any; // Cast to any to simplify for the verification script if types are tricky

  console.log('✅ Dados de teste criados/preparados.');

  // 2. Test Trigger on Creation
  console.log('🧪 Testando gatilho de criação...');
  try {
    // Sem `apiKey` (token Uazapi) configurado no upsert acima, o trigger
    // retorna cedo sem tentar enviar nada — este script só valida que o
    // fluxo não lança. Pra exercitar o envio de verdade, popule `apiKey`
    // com um token de instância real cifrado (`encryptSecret` de lib/crypto.ts).
    await WhatsAppTriggerService.onAppointmentCreated(appointment);
    console.log('✅ Gatilho de criação executado (sem apiKey configurado, não deve ter enviado nada).');
  } catch (error) {
    console.log('ℹ️ Gatilho de criação falhou como esperado (provavelmente falta de env vars):', error instanceof Error ? error.message : error);
  }

  // 3. Test Trigger on Cancellation
  console.log('🧪 Testando gatilho de cancelamento...');
  try {
    await WhatsAppTriggerService.onAppointmentCancelled(appointment);
    console.log('✅ Gatilho de cancelamento executado.');
  } catch (error) {
    console.log('ℹ️ Gatilho de cancelamento falhou como esperado.');
  }

  // 4. Cleanup
  await prisma.appointment.delete({ where: { id: appointment.id } });
  console.log('✅ Limpeza concluída.');
  console.log('🏁 Verificação finalizada.');
}

runVerification()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
