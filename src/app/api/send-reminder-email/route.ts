import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { getReminderEmailTemplate } from '@/lib/email-templates'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userEmail, userName, titulo, descripcion, fecha, daysUntil } = body

    if (!userEmail || !titulo || !fecha) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos: userEmail, titulo, fecha' },
        { status: 400 }
      )
    }

    const { html, text, subject } = getReminderEmailTemplate(
      userName || 'Usuario',
      titulo,
      descripcion || '',
      fecha,
      daysUntil ?? 0
    )

    const fromEmail = process.env.RESEND_FROM_EMAIL || 'noreply@fin.nexuno.com.ar'

    const { data, error } = await resend.emails.send({
      from: `FinControl <${fromEmail}>`,
      to: [userEmail],
      subject,
      html,
      text,
    })

    if (error) {
      console.error('[send-reminder-email] Resend error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, messageId: data?.id })
  } catch (error: any) {
    console.error('[send-reminder-email] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
