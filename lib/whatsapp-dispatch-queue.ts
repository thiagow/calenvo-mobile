import { Client } from '@upstash/qstash';
import { appBaseUrl } from '@/lib/app-url';
import { randomStepMs, msToQstashDelay } from '@/lib/whatsapp-throttle';

export type DispatchJob =
  | { kind: 'reminder'; appointmentId: string }
  | { kind: 'confirmation-request'; appointmentId: string };

let cachedClient: Client | null | undefined;

function getClient(): Client | null {
  if (cachedClient !== undefined) return cachedClient;
  const token = process.env.QSTASH_TOKEN;
  cachedClient = token ? new Client({ token }) : null;
  return cachedClient;
}

/**
 * Publica os jobs de UMA conta de WhatsApp (mesmo instanceName) com delay
 * aleatório crescente entre eles — nunca em rajada, que é justamente o
 * padrão que engatilha bloqueio anti-spam no WhatsApp. Cada job vira uma
 * mensagem QStash independente: se uma falhar, só ela é re-tentada, e o
 * cron que enfileirou já retornou há muito tempo (não fica esperando).
 */
export async function enqueueAccountJobs(jobs: DispatchJob[]): Promise<number> {
  if (jobs.length === 0) return 0;

  const qstash = getClient();
  if (!qstash) {
    console.error('[whatsapp-dispatch-queue] QSTASH_TOKEN não configurado — fila desabilitada');
    return 0;
  }

  const url = `${appBaseUrl()}/api/internal/dispatch-whatsapp`;
  let delayMs = randomStepMs();
  let queued = 0;

  for (const job of jobs) {
    try {
      await qstash.publishJSON({ url, body: job, delay: msToQstashDelay(delayMs) as `${bigint}s` });
      queued++;
    } catch (error) {
      console.error('[whatsapp-dispatch-queue] Falha ao publicar job:', error);
    }
    delayMs += randomStepMs();
  }

  return queued;
}
