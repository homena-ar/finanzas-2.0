import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { to, from, subject, html, text, workspaceName, permissions } = body

    // Validar que tenemos los datos necesarios
    if (!to || !subject || !html) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos: to, subject, html' },
        { status: 400 }
      )
    }

    // Validar que tenemos la API key
    if (!process.env.RESEND_API_KEY) {
      console.error('❌ RESEND_API_KEY no está configurada')
      return NextResponse.json(
        { error: 'Configuración de correo no disponible' },
        { status: 500 }
      )
    }

    // Enviar el correo usando Resend
    const { data, error } = await resend.emails.send({
      from: from || 'FinControl <onboarding@resend.dev>', // Usar el dominio de Resend por defecto
      to: Array.isArray(to) ? to : [to],
      subject: subject,
      html: html,
      text: text || html.replace(/<[^>]*>/g, ''), // Convertir HTML a texto si no se proporciona
    })

    if (error) {
      console.error('❌ Error enviando correo con Resend:', error)
      return NextResponse.json(
        { error: 'Error al enviar correo', details: error },
        { status: 500 }
      )
    }

    console.log('✅ Correo enviado exitosamente:', data)
    return NextResponse.json({ success: true, data })
  } catch (error: any) {
    console.error('❌ Error en API route send-invitation:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor', details: error.message },
      { status: 500 }
    )
  }
}
