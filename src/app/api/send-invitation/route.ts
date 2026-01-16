import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: NextRequest) {
  console.log('📧 [API] POST /api/send-invitation - Iniciando...')
  
  try {
    const body = await request.json()
    console.log('📧 [API] Body recibido:', {
      to: body.to,
      from: body.from,
      subject: body.subject,
      hasHtml: !!body.html,
      hasText: !!body.text,
      workspaceName: body.workspaceName
    })

    const { to, from, subject, html, text, workspaceName, permissions } = body

    // Validar que tenemos los datos necesarios
    if (!to || !subject || !html) {
      console.error('❌ [API] Faltan campos requeridos:', { to: !!to, subject: !!subject, html: !!html })
      return NextResponse.json(
        { error: 'Faltan campos requeridos: to, subject, html' },
        { status: 400 }
      )
    }

    // Validar que tenemos la API key
    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) {
      console.error('❌ [API] RESEND_API_KEY no está configurada')
      return NextResponse.json(
        { error: 'Configuración de correo no disponible' },
        { status: 500 }
      )
    }

    console.log('📧 [API] API Key configurada:', apiKey ? `${apiKey.substring(0, 10)}...` : 'NO ENCONTRADA')

    // Preparar el email payload
    // Usamos el dominio verificado registro@nexuno.com.ar que permite enviar a cualquier email
    // Se puede configurar mediante la variable de entorno RESEND_FROM_EMAIL
    const defaultFromEmail = process.env.RESEND_FROM_EMAIL || 'registro@nexuno.com.ar'
    let emailFrom = `FinControl <${defaultFromEmail}>`
    
    // Si se proporciona un 'from', validar formato
    if (from) {
      // Validar que tenga el formato correcto: "Nombre <email@domain.com>"
      if (from.includes('<') && from.includes('>')) {
        emailFrom = from
      } else {
        // Si solo es un email, agregar formato
        emailFrom = `FinControl <${from}>`
      }
    }
    
    console.log('📧 [API] Email FROM configurado:', emailFrom)
    
    // Validar que 'to' es un email válido
    const emailTo = Array.isArray(to) ? to : [to]
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    const invalidEmails = emailTo.filter((email: string) => !emailRegex.test(email))
    if (invalidEmails.length > 0) {
      console.error('❌ [API] Emails inválidos:', invalidEmails)
      return NextResponse.json(
        { error: `Emails inválidos: ${invalidEmails.join(', ')}` },
        { status: 400 }
      )
    }
    
    const emailText = text || html.replace(/<[^>]*>/g, '')

    console.log('📧 [API] Preparando email:', {
      from: emailFrom,
      to: emailTo,
      subject: subject,
      htmlLength: html.length,
      textLength: emailText.length,
      apiKeyPrefix: apiKey?.substring(0, 7)
    })

    // Validar que Resend está inicializado correctamente
    if (!resend) {
      console.error('❌ [API] Resend no está inicializado')
      return NextResponse.json(
        { error: 'Servicio de correo no disponible' },
        { status: 500 }
      )
    }

    // Enviar el correo usando Resend
    console.log('📧 [API] Llamando a resend.emails.send...')
    let data, error
    try {
      const result = await resend.emails.send({
        from: emailFrom,
        to: emailTo,
        subject: subject,
        html: html,
        text: emailText,
      })
      data = result.data
      error = result.error
    } catch (sendError: any) {
      console.error('❌ [API] Excepción al llamar resend.emails.send:', {
        error: sendError,
        message: sendError?.message,
        stack: sendError?.stack
      })
      error = sendError
    }

    if (error) {
      console.error('❌ [API] Error enviando correo con Resend:', {
        error,
        errorType: typeof error,
        errorString: JSON.stringify(error, null, 2)
      })
      
      // Detectar errores específicos
      const errorMessage = typeof error === 'object' && error !== null
        ? (error as any).message || JSON.stringify(error)
        : String(error)
      
      let userFriendlyError = 'Error al enviar correo'
      // Nota: Con el dominio verificado, estos errores no deberían ocurrir
      if (errorMessage.includes('Testing domain restriction') || errorMessage.includes('resend.dev')) {
        userFriendlyError = 'Error de configuración del dominio. Verifica que el dominio esté correctamente verificado en Resend.'
      }
      
      return NextResponse.json(
        { 
          error: userFriendlyError,
          details: error,
          errorMessage: errorMessage,
          // No fallar completamente, la invitación ya está creada
          warning: 'La invitación fue creada pero el correo no se pudo enviar. El usuario puede ver la invitación en la app.'
        },
        { status: 500 }
      )
    }

    console.log('✅ [API] Correo enviado exitosamente:', {
      data,
      dataType: typeof data,
      dataString: JSON.stringify(data, null, 2)
    })
    
    return NextResponse.json({ 
      success: true, 
      data,
      message: 'Correo enviado correctamente'
    })
  } catch (error: any) {
    console.error('❌ [API] Error en API route send-invitation:', {
      error,
      errorMessage: error?.message,
      errorStack: error?.stack,
      errorString: JSON.stringify(error, null, 2)
    })
    return NextResponse.json(
      { 
        error: 'Error interno del servidor', 
        details: error.message,
        errorType: error?.constructor?.name,
        stack: process.env.NODE_ENV === 'development' ? error?.stack : undefined
      },
      { status: 500 }
    )
  }
}
