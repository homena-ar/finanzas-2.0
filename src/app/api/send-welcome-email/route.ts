import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import * as admin from 'firebase-admin'

const resend = new Resend(process.env.RESEND_API_KEY)

// Inicializar Firebase Admin SDK si no está inicializado
let adminInitialized = false

function initializeAdmin() {
  if (adminInitialized || admin.apps.length > 0) {
    return true
  }

  try {
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
    
    if (!serviceAccount) {
      console.error('❌ [API] FIREBASE_SERVICE_ACCOUNT_KEY no está configurado')
      return false
    }

    // Parsear el JSON del service account
    let serviceAccountJson
    try {
      serviceAccountJson = JSON.parse(serviceAccount)
    } catch (parseError: any) {
      console.error('❌ [API] Error parseando FIREBASE_SERVICE_ACCOUNT_KEY:', parseError.message)
      return false
    }
    
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccountJson)
    })
    
    adminInitialized = true
    console.log('✅ [API] Firebase Admin SDK inicializado correctamente')
    return true
  } catch (error: any) {
    console.error('❌ [API] Error inicializando Firebase Admin SDK:', error.message)
    return false
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { to, userName, userId } = body

    if (!to || !userName) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos: to, userName' },
        { status: 400 }
      )
    }

    // Verificar si ya se envió el correo de bienvenida
    if (userId && initializeAdmin()) {
      try {
        const db = admin.firestore()
        const profileRef = db.collection('profiles').doc(userId)
        const profileDoc = await profileRef.get()
        
        if (profileDoc.exists) {
          const profileData = profileDoc.data()
          if (profileData?.welcome_email_sent === true) {
            console.log('📧 [API] Correo de bienvenida ya fue enviado anteriormente para:', to)
            return NextResponse.json({ 
              success: true, 
              alreadySent: true,
              message: 'Correo de bienvenida ya fue enviado anteriormente'
            })
          }
        }
      } catch (dbError) {
        console.error('⚠️ [API] Error verificando perfil (continuando):', dbError)
        // Continuar con el envío si hay error verificando
      }
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

    // Marcar como enviado en el perfil si tenemos userId
    if (userId && initializeAdmin()) {
      try {
        const db = admin.firestore()
        const profileRef = db.collection('profiles').doc(userId)
        await profileRef.set({
          welcome_email_sent: true,
          welcome_email_sent_at: new Date().toISOString()
        }, { merge: true })
        console.log('✅ [API] Perfil actualizado: welcome_email_sent = true')
      } catch (dbError) {
        console.error('⚠️ [API] Error actualizando perfil (correo enviado):', dbError)
        // No fallar si no se puede actualizar el perfil
      }
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
