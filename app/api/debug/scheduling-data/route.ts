export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * DEBUG ONLY - Remove after diagnosis
 * GET /api/debug/scheduling-data?userId=xxx
 */
export async function GET(request: NextRequest) {
    const userId = request.nextUrl.searchParams.get('userId') || 'cmkkmmkr10000krok4fgakfbt';

    const services = await prisma.service.findMany({
        where: { userId },
        select: { id: true, name: true, isActive: true, duration: true, price: true },
    });

    const schedules = await prisma.schedule.findMany({
        where: { userId },
        select: {
            id: true,
            name: true,
            isActive: true,
            workingDays: true,
            startTime: true,
            endTime: true,
            services: {
                select: {
                    serviceId: true,
                    service: { select: { name: true } },
                },
            },
            professionals: {
                select: {
                    professionalId: true,
                    professional: { select: { name: true } },
                },
            },
        },
    });

    return NextResponse.json({
        userId,
        totalServices: services.length,
        totalSchedules: schedules.length,
        services,
        schedules,
    });
}
