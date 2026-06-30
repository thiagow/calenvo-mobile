import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';
/**
 * DEBUG ONLY - Remove after diagnosis
 * GET /api/debug/whatsapp-config
 */
export async function GET(request: NextRequest) {
    const configs = await prisma.whatsAppConfig.findMany({
        select: {
            id: true,
            userId: true,
            instanceName: true,
            isConnected: true,
            aiAgentEnabled: true,
            enabled: true,
            phoneNumber: true,
            updatedAt: true,
        },
    });
    return NextResponse.json(configs);
}
