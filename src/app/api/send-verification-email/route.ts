import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { to, userName, verificationLink } = body

    if (!to || !userName || !verificationLink) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos: to, userName, verificationLink' },
        { status: 400 }
      )
    }

    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Configuración de correo no disponible' },
        { status: 500 }
      )
    }

    // Template de verificación con nuevo diseño
    const emailTemplate = {
      subject: 'Verifica tu correo electrónico - FinControl',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
            <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="padding: 40px 0;">
              <tr>
                <td align="center">
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="600" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);">
                    <!-- Header -->
                    <tr>
                      <td style="background-color: #000000; padding: 24px 40px; text-align: center;">
                        <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">FinControl</h1>
                      </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                      <td style="padding: 40px;">
                        <h2 style="margin: 0 0 24px; color: #18181b; font-size: 20px; font-weight: 600;">Hola ${userName},</h2>
                        
                        <p style="margin: 0 0 24px; color: #52525b; font-size: 16px; line-height: 1.5;">
                          Gracias por registrarte en FinControl. Para comenzar a usar tu cuenta y mantenerla segura, por favor verifica tu dirección de correo electrónico.
                        </p>

                        <div style="text-align: center; margin: 32px 0;">
                          <a href="${verificationLink}" style="display: inline-block; background-color: #000000; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
                            Verificar mi correo
                          </a>
                        </div>

                        <p style="margin: 0; color: #71717a; font-size: 14px; line-height: 1.5;">
                          Si no creaste esta cuenta, puedes ignorar este correo tranquilamente.
                        </p>
                      </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                      <td style="background-color: #fafafa; padding: 24px 40px; text-align: center; border-top: 1px solid #e4e4e7;">
                        <p style="margin: 0; color: #71717a; font-size: 12px;">
                          © ${new Date().getFullYear()} FinControl. Todos los derechos reservados.
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </body>
        </html>
      `,
      text: `Hola ${userName},\n\nGracias por registrarte en FinControl. Por favor verifica tu correo electrónico usando el siguiente enlace:\n\n${verificationLink}\n\nSi no creaste esta cuenta, ignora este mensaje.`
    }

    const defaultFromEmail = process.env.RESEND_FROM_EMAIL || 'noreply@fin.nexuno.com.ar'
    const emailFrom = `FinControl <${defaultFromEmail}>`

    const result = await resend.emails.send({
      from: emailFrom,
      to: [to],
      subject: emailTemplate.subject,
      html: emailTemplate.html,
      text: emailTemplate.text,
    })

    if (result.error) {
      console.error('❌ [API] Error enviando correo de verificación:', result.error)
      return NextResponse.json(
        { error: 'Error al enviar correo', details: result.error },
        { status: 500 }
      )
    }

    return NextResponse.json({ 
      success: true, 
      data: result.data,
      message: 'Correo de verificación enviado correctamente'
    })
  } catch (error: any) {
    console.error('❌ [API] Error en send-verification-email:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor', details: error.message },
      { status: 500 }
    )
  }
}
