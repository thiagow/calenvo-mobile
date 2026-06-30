export interface WelcomeEmailData {
  name: string
  email: string
  planName: string
  planPrice: string
}

export interface PaymentFailedEmailData {
  name: string
  email: string
}

export function getWelcomeEmailHTML(data: WelcomeEmailData): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Bem-vindo ao Calenvo!</title>
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
                    ✅ Pagamento Confirmado!
                  </h1>
                </td>
              </tr>
              
              <!-- Body -->
              <tr>
                <td style="padding: 40px 30px;">
                  <h2 style="color: #333333; margin-top: 0; font-size: 24px;">
                    Olá, ${data.name}! 🎉
                  </h2>
                  
                  <p style="color: #666666; font-size: 16px; line-height: 1.6;">
                    Seja bem-vindo(a) ao <strong style="color: #667eea;">Calenvo</strong>! Seu pagamento foi confirmado com sucesso e sua conta já está ativa.
                  </p>
                  
                  <!-- Plan Details Box -->
                  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8f9ff; border-radius: 8px; margin: 30px 0; border-left: 4px solid #667eea;">
                    <tr>
                      <td style="padding: 25px;">
                        <h3 style="color: #333333; margin: 0 0 15px 0; font-size: 18px;">
                          📋 Detalhes da Assinatura
                        </h3>
                        <table width="100%" cellpadding="8" cellspacing="0">
                          <tr>
                            <td style="color: #666666; font-size: 14px;"><strong>Plano:</strong></td>
                            <td style="color: #333333; font-size: 14px; text-align: right;">${data.planName}</td>
                          </tr>
                          <tr>
                            <td style="color: #666666; font-size: 14px;"><strong>Valor:</strong></td>
                            <td style="color: #333333; font-size: 14px; text-align: right;">${data.planPrice}/mês</td>
                          </tr>
                          <tr>
                            <td style="color: #666666; font-size: 14px;"><strong>Email:</strong></td>
                            <td style="color: #333333; font-size: 14px; text-align: right;">${data.email}</td>
                          </tr>
                          <tr>
                            <td style="color: #666666; font-size: 14px;"><strong>Agendamentos:</strong></td>
                            <td style="color: #333333; font-size: 14px; text-align: right;">180/mês</td>
                          </tr>
                          <tr>
                            <td style="color: #666666; font-size: 14px;"><strong>Usuários:</strong></td>
                            <td style="color: #333333; font-size: 14px; text-align: right;">Até 3 usuários</td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                  
                  <!-- Next Steps -->
                  <h3 style="color: #333333; font-size: 20px; margin: 30px 0 15px 0;">
                    🎯 Próximos Passos
                  </h3>
                  
                  <ol style="color: #666666; font-size: 16px; line-height: 1.8; padding-left: 20px;">
                    <li>Acesse: <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://calenvo.app'}/login" style="color: #667eea; text-decoration: none; font-weight: bold;">calenvo.app/login</a></li>
                    <li>Faça login com: <strong>${data.email}</strong></li>
                    <li>Configure os horários de atendimento</li>
                    <li>Adicione seus serviços</li>
                    <li>Comece a agendar! 🚀</li>
                  </ol>
                  
                  <!-- CTA Button -->
                  <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                    <tr>
                      <td align="center">
                        <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://calenvo.app'}/login" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; padding: 15px 40px; border-radius: 6px; font-size: 16px; font-weight: bold;">
                          Acessar Minha Conta
                        </a>
                      </td>
                    </tr>
                  </table>
                  
                  <!-- Support -->
                  <p style="color: #999999; font-size: 14px; line-height: 1.6; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eeeeee;">
                    Precisa de ajuda? Responda este email ou entre em contato com nosso suporte em <a href="mailto:contato@calenvo.com.br" style="color: #667eea; text-decoration: none;">contato@calenvo.com.br</a>
                  </p>
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="background-color: #f8f9ff; padding: 20px 30px; text-align: center; border-top: 1px solid #eeeeee;">
                  <p style="color: #999999; font-size: 12px; margin: 0;">
                    Este é um email automático. Por favor, não responda.<br>
                    &copy; ${new Date().getFullYear()} Calenvo. Todos os direitos reservados.
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
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Problema com Pagamento - Calenvo</title>
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
                    ⚠️ Problema com Pagamento
                  </h1>
                </td>
              </tr>
              
              <!-- Body -->
              <tr>
                <td style="padding: 40px 30px;">
                  <h2 style="color: #333333; margin-top: 0; font-size: 24px;">
                    Olá, ${data.name}
                  </h2>
                  
                  <p style="color: #666666; font-size: 16px; line-height: 1.6;">
                    Infelizmente, houve um problema ao processar seu pagamento para o Calenvo.
                  </p>
                  
                  <p style="color: #666666; font-size: 16px; line-height: 1.6;">
                    <strong>Possíveis causas:</strong>
                  </p>
                  
                  <ul style="color: #666666; font-size: 16px; line-height: 1.8;">
                    <li>Cartão sem saldo</li>
                    <li>Dados do cartão incorretos</li>
                    <li>Cartão vencido ou bloqueado</li>
                    <li>Limite de compras excedido</li>
                  </ul>
                  
                  <!-- CTA Button -->
                  <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                    <tr>
                      <td align="center">
                        <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://calenvo.app'}/signup/standard" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; padding: 15px 40px; border-radius: 6px; font-size: 16px; font-weight: bold;">
                          Tentar Novamente
                        </a>
                      </td>
                    </tr>
                  </table>
                  
                  <p style="color: #666666; font-size: 16px; line-height: 1.6;">
                    Se o problema persistir, entre em contato com seu banco ou com nosso suporte.
                  </p>
                  
                  <!-- Support -->
                  <p style="color: #999999; font-size: 14px; line-height: 1.6; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eeeeee;">
                    Precisa de ajuda? Entre em contato: <a href="mailto:contato@calenvo.com.br" style="color: #667eea; text-decoration: none;">contato@calenvo.com.br</a>
                  </p>
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="background-color: #f8f9ff; padding: 20px 30px; text-align: center; border-top: 1px solid #eeeeee;">
                  <p style="color: #999999; font-size: 12px; margin: 0;">
                    Este é um email automático. Por favor, não responda.<br>
                    &copy; ${new Date().getFullYear()} Calenvo. Todos os direitos reservados.
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
    
    const response = await fetch('https://apps.abacus.ai/api/sendNotificationEmail', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deployment_token: process.env.ABACUSAI_API_KEY,
        subject: `✅ Bem-vindo ao Calenvo ${data.planName}!`,
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
    
    const response = await fetch('https://apps.abacus.ai/api/sendNotificationEmail', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deployment_token: process.env.ABACUSAI_API_KEY,
        subject: `⚠️ Problema com seu Pagamento - Calenvo`,
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
