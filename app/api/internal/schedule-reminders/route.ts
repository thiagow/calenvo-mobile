export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { WhatsAppTriggerService } from '@/lib/whatsapp-trigger';

/**
 * Internal API to trigger appointment reminders.
 * This should be called by a CRON job (e.g., every hour).
 * 
 * It looks for appointments scheduled for the next X hours/days
 * based on each user's WhatsApp configuration.
 */
export async function GET(request: NextRequest) {
  try {
    // 1. Basic security check (could use a secret header)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date();
    
    // 2. Find all active WhatsApp configurations
    const activeConfigs = await prisma.whatsAppConfig.findMany({
      where: {
        enabled: true,
        isConnected: true,
        notifyReminder: true,
      },
    });

    let totalSent = 0;

    // 3. Process reminders for each user
    for (const config of activeConfigs) {
      const reminderHours = config.reminderHours || 24;
      
      // Target window: exact hour of reminder
      // To prevent duplicate messages, we could track 'reminderSent' in Appointment model.
      // For now, we'll just find appointments in the next X hours.
      const targetTime = new Date(now.getTime() + reminderHours * 60 * 60 * 1000);
      const windowStart = new Date(targetTime.getTime() - 30 * 60 * 1000); // 30m before
      const windowEnd = new Date(targetTime.getTime() + 30 * 60 * 1000);   // 30m after

      const appointments = await prisma.appointment.findMany({
        where: {
          userId: config.userId,
          status: { in: ['SCHEDULED', 'CONFIRMED'] },
          date: {
            gte: windowStart,
            lte: windowEnd,
          },
          // Ideally we would check a flag: reminderSent: false
        },
        include: {
          client: true,
          user: { select: { businessName: true } },
          service: { select: { name: true } },
          professionalUser: { select: { name: true } },
        },
      });

      for (const appointment of appointments) {
        const serviceName = appointment.service?.name || appointment.specialty || 'Serviço';
        const professionalName = appointment.professionalUser?.name || appointment.professional || undefined;

        await WhatsAppTriggerService.onAppointmentReminder(
          appointment as any,
          serviceName,
          professionalName
        );
        totalSent++;
      }
    }

    return NextResponse.json({
      success: true,
      processedConfigs: activeConfigs.length,
      remindersTriggered: totalSent,
    });
  } catch (error) {
    console.error('[Internal:ScheduleReminders] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
