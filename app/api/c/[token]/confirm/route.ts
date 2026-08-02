export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { confirmByToken } from '@/lib/confirmation-service';
import { checkRateLimit } from '@/lib/rate-limit';
import { hashConfirmationToken, isValidTokenShape } from '@/lib/confirmation-token';

function getClientIp(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0].trim()
    || request.headers.get('x-real-ip')
    || 'unknown';
}

export async function POST(request: NextRequest, { params }: { params: { token: string } }) {
  const { token } = params;

  if (!isValidTokenShape(token)) {
    return NextResponse.json({ error: 'Link inválido' }, { status: 404 });
  }

  const ip = getClientIp(request);
  const tokenKey = hashConfirmationToken(token).slice(0, 16);
  const [ipRate, tokenRate] = await Promise.all([
    checkRateLimit(`confirm-act:ip:${ip}`, { tier: 'public', failClosed: false }),
    checkRateLimit(`confirm-act:tok:${tokenKey}`, { tier: 'public', failClosed: false }),
  ]);
  if (!ipRate.success || !tokenRate.success) {
    return NextResponse.json({ error: 'Muitas tentativas. Tente novamente em instantes.' }, { status: 429 });
  }

  try {
    const result = await confirmByToken(token);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[api/c/confirm] Erro ao confirmar agendamento:', error);
    return NextResponse.json({ error: 'Erro ao confirmar agendamento' }, { status: 500 });
  }
}
