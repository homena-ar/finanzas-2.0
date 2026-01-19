import { NextRequest, NextResponse } from 'next/server'
import * as admin from 'firebase-admin'

// Inicializar Firebase Admin SDK si no está inicializado
if (!admin.apps.length) {
  try {
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
    
    if (!serviceAccount) {
      console.error('❌ [API] FIREBASE_SERVICE_ACCOUNT_KEY no está configurado')
      throw new Error('Firebase Admin SDK no está configurado')
    }

    // Parsear el JSON del service account
    const serviceAccountJson = JSON.parse(serviceAccount)
    
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccountJson)
    })
    
    console.log('✅ [API] Firebase Admin SDK inicializado')
  } catch (error: any) {
    console.error('❌ [API] Error inicializando Firebase Admin SDK:', error.message)
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email } = body

    if (!email) {
      return NextResponse.json(
        { error: 'Email es requerido' },
        { status: 400 }
      )
    }

    // Obtener el usuario por email
    const user = await admin.auth().getUserByEmail(email)
    
    if (!user) {
      return NextResponse.json(
        { error: 'Usuario no encontrado' },
        { status: 404 }
      )
    }

    // Generar el link de verificación de email
    const actionCodeSettings = {
      url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://fin.nexuno.com.ar'}/verificar-email?verified=true`,
      handleCodeInApp: false,
    }

    const verificationLink = await admin.auth().generateEmailVerificationLink(
      email,
      actionCodeSettings
    )

    return NextResponse.json({ 
      success: true,
      verificationLink 
    })
  } catch (error: any) {
    console.error('❌ [API] Error generando link de verificación:', error)
    
    // Manejar errores específicos
    if (error.code === 'auth/user-not-found') {
      return NextResponse.json(
        { error: 'Usuario no encontrado' },
        { status: 404 }
      )
    }
    
    return NextResponse.json(
      { error: 'Error al generar link de verificación', details: error.message },
      { status: 500 }
    )
  }
}
