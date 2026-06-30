import { prisma } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';

interface ExtendedUser {
    id: string;
    email: string;
}

interface ExtendedSession {
    user: ExtendedUser;
}


interface LogErrorParams {
    functionality: string;
    error: unknown;
    metadata?: Record<string, any>;
    userId?: string;
}

export async function logError({
    functionality,
    error,
    metadata,
    userId,
}: LogErrorParams): Promise<void> {
    try {
        // Get userId from session if not provided
        let finalUserId = userId;
        if (!finalUserId) {
            // Note: getServerSession might need req/res or just options depending on version
            const session = (await getServerSession(authOptions)) as ExtendedSession | null;
            finalUserId = session?.user?.id;
        }

        if (!finalUserId) {
            console.error('[logError] No userId available for:', functionality);
            // Fallback to console if no user to link to
            console.error(error);
            return;
        }

        const errorMessage = error instanceof Error ? error.message : String(error);
        const stackTrace = error instanceof Error ? error.stack : undefined;

        await prisma.errorLog.create({
            data: {
                userId: finalUserId,
                functionality,
                errorMessage,
                stackTrace,
                metadata: metadata || {},
            },
        });

        console.error(`[${functionality}] Error logged for user ${finalUserId}:`, errorMessage);
    } catch (logErr) {
        // Never throw errors from the logger to prevent crashing the app
        console.error('[logError] Failed to log error to database:', logErr);
        console.error('Original error:', error);
    }
}
