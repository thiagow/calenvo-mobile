export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { revalidatePath } from 'next/cache';

/**
 * Evolution API Webhook Handler v3.1
 * 
 * This endpoint is registered in n8n/Evolution to receive real-time events.
 * Currently handles:
 * - connection.update: Updates database when instance connects/disconnects.
 * - messages.upsert: Placeholder for handling user replies or confirmations.
 */
export async function POST(request: NextRequest) {
  try {
    // Validate webhook secret
    // Validate webhook secret (support both header and query param)
    const webhookSecretHeader = request.headers.get('x-webhook-secret');
    const { searchParams } = new URL(request.url);
    const webhookSecretQuery = searchParams.get('secret');

    const receivedSecret = webhookSecretHeader || webhookSecretQuery;
    const expectedSecret = process.env.EVOLUTION_WEBHOOK_SECRET;

    if (expectedSecret && receivedSecret !== expectedSecret) {
      console.warn('[Webhook:Evolution] Invalid webhook secret');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { event, instance, data } = body;

    console.log('[Webhook:Evolution] Received event:', {
      event,
      instanceName: instance,
      dataKeys: Object.keys(data || {}),
    });

    // Handle connection update events
    if (event === 'connection.update') {
      await handleConnectionUpdate(instance, data);
    }

    // Handle message events (for future use - responses, confirmations)
    if (event === 'messages.upsert') {
      // TODO: Handle incoming messages if needed for confirmations
      console.log('[Webhook:Evolution] Message received:', data);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Webhook:Evolution] Error processing webhook:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Handle connection state updates
 */
async function handleConnectionUpdate(instanceName: string, data: any) {
  try {
    const state = data.state || data.status;
    const isConnected = state === 'open' || state === 'connected';

    console.log('[Webhook:Evolution] Connection update:', {
      instanceName,
      state,
      isConnected,
    });

    // Find WhatsAppConfig by instanceName
    const config = await prisma.whatsAppConfig.findUnique({
      where: { instanceName },
      include: { user: true },
    });

    if (!config) {
      console.warn('[Webhook:Evolution] Config not found for instance:', instanceName);
      return;
    }

    // Update connection status
    await prisma.whatsAppConfig.update({
      where: { id: config.id },
      data: {
        isConnected,
        qrCode: !isConnected ? null : config.qrCode, // Clear QR code when disconnected
        updatedAt: new Date(),
      },
    });

    console.log('[Webhook:Evolution] Updated config:', {
      userId: config.userId,
      isConnected,
    });

    // Revalidate settings page to reflect new status
    revalidatePath('/dashboard/settings/notifications');

    // TODO: Create internal notification if disconnected
    if (!isConnected && config.enabled) {
      console.warn('[Webhook:Evolution] Instance disconnected while enabled:', {
        userId: config.userId,
        instanceName,
      });
      // Could create a notification here using NotificationService
    }
  } catch (error) {
    console.error('[Webhook:Evolution] Error in handleConnectionUpdate:', error);
  }
}
