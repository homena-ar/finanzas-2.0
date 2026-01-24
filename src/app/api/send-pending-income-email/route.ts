import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY || '')

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userName, userEmail, ingresoDescripcion, ingresoMonto, ingresoMoneda, fechaCobroEsperada } = body

    if (!userName || !userEmail || !ingresoDescripcion || !ingresoMonto) {
      console.error('❌ [Email Ingresos] Faltan campos', { userName, userEmail, ingresoDescripcion, ingresoMonto })
      return NextResponse.json(
        { error: 'Faltan campos requeridos' },
        { status: 400 }
      )
    }

    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) {
      console.error('❌ [Email Ingresos] RESEND_API_KEY no configurada')
      return NextResponse.json(
        { error: 'Configuración de correo no disponible' },
        { status: 500 }
      )
    }

    const fechaFormateada = fechaCobroEsperada 
      ? new Date(fechaCobroEsperada).toLocaleDateString('es-AR', { 
          day: 'numeric', 
          month: 'long', 
          year: 'numeric' 
        })
      : 'hoy'

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Recordatorio: Ingreso pendiente de cobro</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">💰 Recordatorio de Cobro</h1>
          </div>
          
          <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
            <p style="font-size: 16px; margin-bottom: 20px;">Hola <strong>${userName}</strong>,</p>
            
            <p style="font-size: 16px; margin-bottom: 20px;">
              Te recordamos que tienes un ingreso pendiente de cobro que vence <strong>${fechaFormateada}</strong>:
            </p>
            
            <div style="background: white; border-left: 4px solid #667eea; padding: 20px; margin: 20px 0; border-radius: 5px;">
              <p style="margin: 0; font-size: 18px; font-weight: bold; color: #333;">
                ${ingresoDescripcion}
              </p>
              <p style="margin: 10px 0 0 0; font-size: 24px; font-weight: bold; color: #10b981;">
                ${ingresoMonto}
              </p>
            </div>
            
            <p style="font-size: 16px; margin-bottom: 20px;">
              <strong>¿Ya cobraste este ingreso?</strong> No olvides confirmarlo en FinControl para que se incluya en tus totales.
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://fin.nexuno.com.ar'}/dashboard/ingresos" 
                 style="background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
                Ver Ingresos
              </a>
            </div>
            
            <p style="font-size: 14px; color: #666; margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 20px;">
              Este es un recordatorio automático. Si ya cobraste este ingreso, puedes confirmarlo desde la aplicación.
            </p>
          </div>
        </body>
      </html>
    `

    const emailText = `
Recordatorio: Ingreso pendiente de cobro

Hola ${userName},

Te recordamos que tienes un ingreso pendiente de cobro que vence ${fechaFormateada}:

${ingresoDescripcion}
${ingresoMonto}

¿Ya cobraste este ingreso? No olvides confirmarlo en FinControl para que se incluya en tus totales.

Ver ingresos: ${process.env.NEXT_PUBLIC_APP_URL || 'https://fin.nexuno.com.ar'}/dashboard/ingresos

Este es un recordatorio automático. Si ya cobraste este ingreso, puedes confirmarlo desde la aplicación.
    `

    const defaultFromEmail = process.env.RESEND_FROM_EMAIL || 'noreply@fin.nexuno.com.ar'
    const emailFrom = `FinControl <${defaultFromEmail}>`

    console.log('📧 [Email Ingresos] Enviando', { to: userEmail, from: emailFrom, ingresoDescripcion })

    const result = await resend.emails.send({
      from: emailFrom,
      to: [userEmail],
      subject: `💰 Cobro pendiente: ${ingresoDescripcion}`,
      html: emailHtml,
      text: emailText,
    })

    if (result.error) {
      console.error('❌ [Email Ingresos] Error de Resend:', result.error)
      return NextResponse.json(
        { error: 'Error enviando correo', details: result.error },
        { status: 500 }
      )
    }

    console.log('✅ [Email Ingresos] Correo enviado exitosamente:', result.data?.id)
    return NextResponse.json({
      success: true,
      messageId: result.data?.id
    })

  } catch (error: any) {
    console.error('❌ [Email Ingresos] Error:', error)
    return NextResponse.json(
      {
        error: 'Error enviando correo de recordatorio',
        details: error.message
      },
      { status: 500 }
    )
  }
}
