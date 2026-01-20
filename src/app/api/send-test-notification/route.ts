import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { getCierreNotificationTemplate, getVencimientoNotificationTemplate } from '@/lib/email-templates'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { tipo, email } = body

    if (!tipo || !email) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos: tipo, email' },
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

    // Datos de prueba
    const userName = 'Usuario de Prueba'
    const tarjetaNombre = 'Tarjeta de Prueba'
    const dia = 15
    const fecha = new Date().toLocaleDateString('es-AR')

    let emailTemplate
    if (tipo === 'cierre') {
      emailTemplate = getCierreNotificationTemplate(userName, tarjetaNombre, dia, fecha)
    } else if (tipo === 'vencimiento') {
      emailTemplate = getVencimientoNotificationTemplate(userName, tarjetaNombre, dia, fecha)
    } else {
      return NextResponse.json(
        { error: 'Tipo inválido. Usa "cierre" o "vencimiento"' },
        { status: 400 }
      )
    }

    const defaultFromEmail = process.env.RESEND_FROM_EMAIL || 'noreply@fin.nexuno.com.ar'
    const emailFrom = `FinControl <${defaultFromEmail}>`

    const result = await resend.emails.send({
      from: emailFrom,
      to: [email],
      subject: `[PRUEBA] ${emailTemplate.subject}`,
      html: emailTemplate.html,
      text: emailTemplate.text,
    })

    if (result.error) {
      console.error('❌ [API] Error enviando correo de prueba:', result.error)
      return NextResponse.json(
        { error: 'Error al enviar correo', details: result.error },
        { status: 500 }
      )
    }

    return NextResponse.json({ 
      success: true, 
      data: result.data,
      message: `Correo de prueba (${tipo}) enviado correctamente a ${email}`
    })
  } catch (error: any) {
    console.error('❌ [API] Error en send-test-notification:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor', details: error.message },
      { status: 500 }
    )
  }
}
