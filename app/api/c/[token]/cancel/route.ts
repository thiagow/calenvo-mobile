export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { cancelByToken } from '@/lib/confirmation-service';
import { checkRateLimit } from '@/lib/rate-limit';
import { hashConfirmationToken, isValidTokenShape } from '@/lib/confirmation-token';

const MAX_REASON_LENGTH = 280;

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

  let reason = '';
  try {
    const body = await request.json();
    if (typeof body?.reason === 'string') reason = body.reason.slice(0, MAX_REASON_LENGTH);
  } catch {
    // corpo ausente/inválido — cancela sem motivo, não é bloqueante
  }

  try {
    const result = await cancelByToken(token, reason);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[api/c/cancel] Erro ao cancelar agendamento:', error);
    return NextResponse.json({ error: 'Erro ao cancelar agendamento' }, { status: 500 });
  }
}
