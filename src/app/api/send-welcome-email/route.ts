import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { to, userName } = body

    if (!to || !userName) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos: to, userName' },
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

    const { getWelcomeEmailTemplate } = await import('@/lib/email-templates')
    const emailTemplate = getWelcomeEmailTemplate(userName, to)

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
      console.error('❌ [API] Error enviando correo de bienvenida:', result.error)
      return NextResponse.json(
        { error: 'Error al enviar correo', details: result.error },
        { status: 500 }
      )
    }

    return NextResponse.json({ 
      success: true, 
      data: result.data,
      message: 'Correo de bienvenida enviado correctamente'
    })
  } catch (error: any) {
    console.error('❌ [API] Error en send-welcome-email:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor', details: error.message },
      { status: 500 }
    )
  }
}
