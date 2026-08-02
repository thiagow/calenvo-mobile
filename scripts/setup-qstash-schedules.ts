import 'dotenv/config'
import { Client } from '@upstash/qstash'

/**
 * Fonte da verdade dos agendamentos do QStash — rode `npx tsx scripts/setup-qstash-schedules.ts`
 * uma vez para criar os schedules, e de novo sempre que mudar o cron aqui embaixo
 * (é idempotente: mesmo scheduleId atualiza em vez de duplicar).
 *
 * Substitui o Schedule Trigger que hoje vive só na UI do n8n, sem versionamento.
 */

const qstashToken = process.env.QSTASH_TOKEN
if (!qstashToken) {
  console.error('❌ QSTASH_TOKEN não configurada')
  process.exit(1)
}

// Prioriza NEXT_PUBLIC_APP_URL (não NEXTAUTH_URL, que em dev é localhost) —
// este script registra um destino PÚBLICO que o QStash precisa alcançar
// pela internet, nunca a URL local de desenvolvimento.
const appUrl = (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || '').replace(/\/+$/, '')
if (!appUrl) {
  console.error('❌ NEXT_PUBLIC_APP_URL ou NEXTAUTH_URL precisa estar configurada — é pra onde o QStash vai chamar')
  process.exit(1)
}
if (/localhost|127\.0\.0\.1/.test(appUrl)) {
  console.error(`❌ appUrl resolveu para "${appUrl}" — o QStash nunca vai conseguir chamar sua máquina local.`)
  console.error('   Configure NEXT_PUBLIC_APP_URL com a URL pública de produção antes de rodar este script.')
  process.exit(1)
}

const client = new Client({ token: qstashToken })

// Cron do QStash roda em UTC. Brasil não tem horário de verão desde 2019,
// então "12:00 UTC" = "09:00 America/Sao_Paulo" é uma constante estável.
const SCHEDULES = [
  {
    scheduleId: 'calenvo-schedule-reminders',
    cron: '0 * * * *', // a cada hora
    path: '/api/internal/schedule-reminders',
  },
  {
    scheduleId: 'calenvo-send-confirmations',
    cron: '0 12 * * *', // 09:00 America/Sao_Paulo
    path: '/api/internal/send-confirmations',
  },
]

async function main() {
  for (const schedule of SCHEDULES) {
    await client.schedules.create({
      scheduleId: schedule.scheduleId,
      destination: `${appUrl}${schedule.path}`,
      cron: schedule.cron,
    })
    console.log(`✔ ${schedule.scheduleId} → ${schedule.cron} → ${appUrl}${schedule.path}`)
  }
  console.log('\nConfira em https://console.upstash.com/qstash → Schedules')
}

main().catch((error) => {
  console.error('❌ Erro ao configurar schedules do QStash:', error)
  process.exit(1)
})
