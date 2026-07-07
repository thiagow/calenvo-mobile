export interface WelcomeEmailData {
  name: string
  email: string
  planName: string
  planPrice: string
  locale?: string
  monthlyLimitLabel?: string
  userLimitLabel?: string
}

export interface PaymentFailedEmailData {
  name: string
  email: string
  locale?: string
}

const WELCOME_COPY = {
  pt: {
    title: 'Bem-vindo ao Calenvo!',
    headerTitle: '✅ Pagamento Confirmado!',
    greeting: (name: string) => `Olá, ${name}! 🎉`,
    intro: 'Seja bem-vindo(a) ao <strong style="color: #667eea;">Calenvo</strong>! Seu pagamento foi confirmado com sucesso e sua conta já está ativa.',
    detailsTitle: '📋 Detalhes da Assinatura',
    planLabel: 'Plano:',
    priceLabel: 'Valor:',
    priceSuffix: '/mês',
    emailLabel: 'Email:',
    appointmentsLabel: 'Agendamentos:',
    usersLabel: 'Usuários:',
    nextStepsTitle: '🎯 Próximos Passos',
    step1: (loginUrl: string) => `Acesse: <a href="${loginUrl}" style="color: #667eea; text-decoration: none; font-weight: bold;">calenvo.app/login</a>`,
    step2: (email: string) => `Faça login com: <strong>${email}</strong>`,
    step3: 'Configure os horários de atendimento',
    step4: 'Adicione seus serviços',
    step5: 'Comece a agendar! 🚀',
    ctaButton: 'Acessar Minha Conta',
    support: 'Precisa de ajuda? Responda este email ou entre em contato com nosso suporte em',
    footerAutomated: 'Este é um email automático. Por favor, não responda.',
    footerRights: 'Todos os direitos reservados.',
    subject: (planName: string) => `✅ Bem-vindo ao Calenvo ${planName}!`,
  },
  en: {
    title: 'Welcome to Calenvo!',
    headerTitle: '✅ Payment Confirmed!',
    greeting: (name: string) => `Hi, ${name}! 🎉`,
    intro: 'Welcome to <strong style="color: #667eea;">Calenvo</strong>! Your payment was successfully confirmed and your account is now active.',
    detailsTitle: '📋 Subscription Details',
    planLabel: 'Plan:',
    priceLabel: 'Price:',
    priceSuffix: '/mo',
    emailLabel: 'Email:',
    appointmentsLabel: 'Appointments:',
    usersLabel: 'Users:',
    nextStepsTitle: '🎯 Next Steps',
    step1: (loginUrl: string) => `Go to: <a href="${loginUrl}" style="color: #667eea; text-decoration: none; font-weight: bold;">calenvo.app/login</a>`,
    step2: (email: string) => `Log in with: <strong>${email}</strong>`,
    step3: 'Set up your business hours',
    step4: 'Add your services',
    step5: 'Start booking! 🚀',
    ctaButton: 'Access My Account',
    support: 'Need help? Reply to this email or contact our support at',
    footerAutomated: 'This is an automated email. Please do not reply.',
    footerRights: 'All rights reserved.',
    subject: (planName: string) => `✅ Welcome to Calenvo ${planName}!`,
  },
} as const

const PAYMENT_FAILED_COPY = {
  pt: {
    title: 'Problema com Pagamento - Calenvo',
    headerTitle: '⚠️ Problema com Pagamento',
    greeting: (name: string) => `Olá, ${name}`,
    intro: 'Infelizmente, houve um problema ao processar seu pagamento para o Calenvo.',
    causesTitle: 'Possíveis causas:',
    cause1: 'Cartão sem saldo',
    cause2: 'Dados do cartão incorretos',
    cause3: 'Cartão vencido ou bloqueado',
    cause4: 'Limite de compras excedido',
    ctaButton: 'Tentar Novamente',
    outro: 'Se o problema persistir, entre em contato com seu banco ou com nosso suporte.',
    support: 'Precisa de ajuda? Entre em contato:',
    footerAutomated: 'Este é um email automático. Por favor, não responda.',
    footerRights: 'Todos os direitos reservados.',
    subject: '⚠️ Problema com seu Pagamento - Calenvo',
  },
  en: {
    title: 'Payment Issue - Calenvo',
    headerTitle: '⚠️ Payment Issue',
    greeting: (name: string) => `Hi, ${name}`,
    intro: "Unfortunately, there was a problem processing your payment for Calenvo.",
    causesTitle: 'Possible causes:',
    cause1: 'Insufficient funds',
    cause2: 'Incorrect card details',
    cause3: 'Expired or blocked card',
    cause4: 'Purchase limit exceeded',
    ctaButton: 'Try Again',
    outro: 'If the problem persists, please contact your bank or our support team.',
    support: 'Need help? Contact us:',
    footerAutomated: 'This is an automated email. Please do not reply.',
    footerRights: 'All rights reserved.',
    subject: '⚠️ Issue with Your Payment - Calenvo',
  },
} as const

function resolveLocale(locale?: string): 'pt' | 'en' {
  return locale === 'en' ? 'en' : 'pt'
}

export function getWelcomeEmailHTML(data: WelcomeEmailData): string {
  const c = WELCOME_COPY[resolveLocale(data.locale)]
  const loginUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://calenvo.app'}/login`

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${c.title}</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 20px;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center;">
                  <h1 style="color: #ffffff; margin: 0; font-size: 32px; font-weight: bold;">
                    ${c.headerTitle}
                  </h1>
                </td>
              </tr>

              <!-- Body -->
              <tr>
                <td style="padding: 40px 30px;">
                  <h2 style="color: #333333; margin-top: 0; font-size: 24px;">
                    ${c.greeting(data.name)}
                  </h2>

                  <p style="color: #666666; font-size: 16px; line-height: 1.6;">
                    ${c.intro}
                  </p>

                  <!-- Plan Details Box -->
                  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8f9ff; border-radius: 8px; margin: 30px 0; border-left: 4px solid #667eea;">
                    <tr>
                      <td style="padding: 25px;">
                        <h3 style="color: #333333; margin: 0 0 15px 0; font-size: 18px;">
                          ${c.detailsTitle}
                        </h3>
                        <table width="100%" cellpadding="8" cellspacing="0">
                          <tr>
                            <td style="color: #666666; font-size: 14px;"><strong>${c.planLabel}</strong></td>
                            <td style="color: #333333; font-size: 14px; text-align: right;">${data.planName}</td>
                          </tr>
                          <tr>
                            <td style="color: #666666; font-size: 14px;"><strong>${c.priceLabel}</strong></td>
                            <td style="color: #333333; font-size: 14px; text-align: right;">${data.planPrice}${c.priceSuffix}</td>
                          </tr>
                          <tr>
                            <td style="color: #666666; font-size: 14px;"><strong>${c.emailLabel}</strong></td>
                            <td style="color: #333333; font-size: 14px; text-align: right;">${data.email}</td>
                          </tr>
                          <tr>
                            <td style="color: #666666; font-size: 14px;"><strong>${c.appointmentsLabel}</strong></td>
                            <td style="color: #333333; font-size: 14px; text-align: right;">${data.monthlyLimitLabel || '-'}</td>
                          </tr>
                          <tr>
                            <td style="color: #666666; font-size: 14px;"><strong>${c.usersLabel}</strong></td>
                            <td style="color: #333333; font-size: 14px; text-align: right;">${data.userLimitLabel || '-'}</td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>

                  <!-- Next Steps -->
                  <h3 style="color: #333333; font-size: 20px; margin: 30px 0 15px 0;">
                    ${c.nextStepsTitle}
                  </h3>

                  <ol style="color: #666666; font-size: 16px; line-height: 1.8; padding-left: 20px;">
                    <li>${c.step1(loginUrl)}</li>
                    <li>${c.step2(data.email)}</li>
                    <li>${c.step3}</li>
                    <li>${c.step4}</li>
                    <li>${c.step5}</li>
                  </ol>

                  <!-- CTA Button -->
                  <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                    <tr>
                      <td align="center">
                        <a href="${loginUrl}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; padding: 15px 40px; border-radius: 6px; font-size: 16px; font-weight: bold;">
                          ${c.ctaButton}
                        </a>
                      </td>
                    </tr>
                  </table>

                  <!-- Support -->
                  <p style="color: #999999; font-size: 14px; line-height: 1.6; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eeeeee;">
                    ${c.support} <a href="mailto:contato@calenvo.com.br" style="color: #667eea; text-decoration: none;">contato@calenvo.com.br</a>
                  </p>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="background-color: #f8f9ff; padding: 20px 30px; text-align: center; border-top: 1px solid #eeeeee;">
                  <p style="color: #999999; font-size: 12px; margin: 0;">
                    ${c.footerAutomated}<br>
                    &copy; ${new Date().getFullYear()} Calenvo. ${c.footerRights}
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `
}

export function getPaymentFailedEmailHTML(data: PaymentFailedEmailData): string {
  const c = PAYMENT_FAILED_COPY[resolveLocale(data.locale)]
  const loginUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://calenvo.app'}/login`

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${c.title}</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 20px;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, #f56565 0%, #e53e3e 100%); padding: 40px 20px; text-align: center;">
                  <h1 style="color: #ffffff; margin: 0; font-size: 32px; font-weight: bold;">
                    ${c.headerTitle}
                  </h1>
                </td>
              </tr>

              <!-- Body -->
              <tr>
                <td style="padding: 40px 30px;">
                  <h2 style="color: #333333; margin-top: 0; font-size: 24px;">
                    ${c.greeting(data.name)}
                  </h2>

                  <p style="color: #666666; font-size: 16px; line-height: 1.6;">
                    ${c.intro}
                  </p>

                  <p style="color: #666666; font-size: 16px; line-height: 1.6;">
                    <strong>${c.causesTitle}</strong>
                  </p>

                  <ul style="color: #666666; font-size: 16px; line-height: 1.8;">
                    <li>${c.cause1}</li>
                    <li>${c.cause2}</li>
                    <li>${c.cause3}</li>
                    <li>${c.cause4}</li>
                  </ul>

                  <!-- CTA Button -->
                  <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                    <tr>
                      <td align="center">
                        <a href="${loginUrl}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; padding: 15px 40px; border-radius: 6px; font-size: 16px; font-weight: bold;">
                          ${c.ctaButton}
                        </a>
                      </td>
                    </tr>
                  </table>

                  <p style="color: #666666; font-size: 16px; line-height: 1.6;">
                    ${c.outro}
                  </p>

                  <!-- Support -->
                  <p style="color: #999999; font-size: 14px; line-height: 1.6; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eeeeee;">
                    ${c.support} <a href="mailto:contato@calenvo.com.br" style="color: #667eea; text-decoration: none;">contato@calenvo.com.br</a>
                  </p>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="background-color: #f8f9ff; padding: 20px 30px; text-align: center; border-top: 1px solid #eeeeee;">
                  <p style="color: #999999; font-size: 12px; margin: 0;">
                    ${c.footerAutomated}<br>
                    &copy; ${new Date().getFullYear()} Calenvo. ${c.footerRights}
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `
}

export async function sendWelcomeEmail(data: WelcomeEmailData): Promise<boolean> {
  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'https://calenvo.app'
    const appName = 'Calenvo'
    const c = WELCOME_COPY[resolveLocale(data.locale)]

    const response = await fetch('https://apps.abacus.ai/api/sendNotificationEmail', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deployment_token: process.env.ABACUSAI_API_KEY,
        subject: c.subject(data.planName),
        body: getWelcomeEmailHTML(data),
        is_html: true,
        recipient_email: data.email,
        sender_email: `noreply@${new URL(appUrl).hostname}`,
        sender_alias: appName,
      }),
    })

    const result = await response.json()
    if (!result.success) {
      console.error('❌ Erro ao enviar email de boas-vindas:', result.message)
      return false
    }

    console.log('✅ Email de boas-vindas enviado para:', data.email)
    return true
  } catch (error) {
    console.error('❌ Erro ao enviar email de boas-vindas:', error)
    return false
  }
}

export async function sendPaymentFailedEmail(data: PaymentFailedEmailData): Promise<boolean> {
  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'https://calenvo.app'
    const appName = 'Calenvo'
    const c = PAYMENT_FAILED_COPY[resolveLocale(data.locale)]

    const response = await fetch('https://apps.abacus.ai/api/sendNotificationEmail', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deployment_token: process.env.ABACUSAI_API_KEY,
        subject: c.subject,
        body: getPaymentFailedEmailHTML(data),
        is_html: true,
        recipient_email: data.email,
        sender_email: `noreply@${new URL(appUrl).hostname}`,
        sender_alias: appName,
      }),
    })

    const result = await response.json()
    if (!result.success) {
      console.error('❌ Erro ao enviar email de falha no pagamento:', result.message)
      return false
    }

    console.log('✅ Email de falha no pagamento enviado para:', data.email)
    return true
  } catch (error) {
    console.error('❌ Erro ao enviar email de falha no pagamento:', error)
    return false
  }
}
