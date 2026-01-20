import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { getCierreNotificationTemplate, getVencimientoNotificationTemplate } from '@/lib/email-templates'

const resend = new Resend(process.env.RESEND_API_KEY || '')

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { tipo, userName, userEmail, tarjetaNombre, dia, fecha } = body

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
