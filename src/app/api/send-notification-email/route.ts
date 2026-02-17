import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { getCierreNotificationTemplate, getVencimientoNotificationTemplate } from '@/lib/email-templates'

const resend = new Resend(process.env.RESEND_API_KEY || '')

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { tipo, userName, userEmail, tarjetaNombre, dia, fecha, mensaje } = body

    if (!tipo || !userName || !userEmail || !tarjetaNombre || !dia || !fecha) {
      console.error('❌ [Email] Faltan campos', { tipo, userName, userEmail, tarjetaNombre, dia, fecha })
      return NextResponse.json(
        { error: 'Faltan campos requeridos' },
        { status: 400 }
      )
    }

    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) {
      console.error('❌ [Email] RESEND_API_KEY no configurada')
      return NextResponse.json(
        { error: 'Configuración de correo no disponible' },
        { status: 500 }
      )
    }

    let emailTemplate
    if (tipo === 'cierre') {
      emailTemplate = getCierreNotificationTemplate(userName, tarjetaNombre, dia, fecha)
    } else if (tipo === 'vencimiento') {
      emailTemplate = getVencimientoNotificationTemplate(userName, tarjetaNombre, dia, fecha)
    } else if (tipo === 'recordatorio') {
      // Template simple para recordatorios personalizados
      const msg = mensaje || `Recordatorio: ${tarjetaNombre}`
      emailTemplate = {
        subject: `🔔 ${tarjetaNombre}`,
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
                          
                          <div style="background-color: #f4f4f5; border-left: 4px solid #000000; padding: 20px; margin-bottom: 24px; border-radius: 4px;">
                            <p style="margin: 0; color: #27272a; font-size: 16px; line-height: 1.5;">${msg}</p>
                          </div>

                          <div style="margin-bottom: 32px; padding: 16px; border: 1px solid #e4e4e7; border-radius: 8px;">
                            <p style="margin: 0; color: #52525b; font-size: 14px;">Fecha del evento</p>
                            <p style="margin: 4px 0 0; color: #18181b; font-size: 18px; font-weight: 600;">📅 ${fecha}</p>
                          </div>

                          <div style="text-align: center;">
                            <a href="https://fin.nexuno.com.ar/dashboard" style="display: inline-block; background-color: #000000; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
                              Ir a la App
                            </a>
                          </div>
                        </td>
                      </tr>

                      <!-- Footer -->
                      <tr>
                        <td style="background-color: #fafafa; padding: 24px 40px; text-align: center; border-top: 1px solid #e4e4e7;">
                          <p style="margin: 0; color: #71717a; font-size: 12px;">
                            Este es un recordatorio automático de FinControl.
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
        text: `Hola ${userName},\n\n${msg}\nFecha: ${fecha}\n\nIr a la App: https://fin.nexuno.com.ar/dashboard`
      }
    } else {
      console.error('❌ [Email] Tipo inválido', tipo)
      return NextResponse.json(
        { error: 'Tipo de notificación inválido' },
        { status: 400 }
      )
    }

    const defaultFromEmail = process.env.RESEND_FROM_EMAIL || 'noreply@fin.nexuno.com.ar'
    const emailFrom = `FinControl <${defaultFromEmail}>`

    console.log('📧 [Email] Enviando', { to: userEmail, from: emailFrom, tipo, tarjetaNombre })

    const result = await resend.emails.send({
      from: emailFrom,
      to: [userEmail],
      subject: emailTemplate.subject,
      html: emailTemplate.html,
      text: emailTemplate.text,
    })

    if (result.error) {
      console.error('❌ [Email] Error enviando notificación:', result.error)
      return NextResponse.json(
        { error: 'Error al enviar correo', details: result.error },
        { status: 500 }
      )
    }

    console.log('✅ [Email] Enviado OK', { id: result.data?.id })

    return NextResponse.json({ 
      success: true, 
      data: result.data,
      message: 'Notificación enviada correctamente'
    })
  } catch (error: any) {
    console.error('❌ [Email] Error en send-notification-email:', error?.message || error)
    return NextResponse.json(
      { error: 'Error interno del servidor', details: error.message },
      { status: 500 }
    )
  }
}
