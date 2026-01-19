import { NextRequest, NextResponse } from 'next/server'
import * as admin from 'firebase-admin'

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
      console.error('❌ [API] Primeros 100 caracteres del valor:', serviceAccount.substring(0, 100))
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
    console.error('❌ [API] Stack:', error.stack)
    return false
  }
}

export async function POST(request: NextRequest) {
  try {
    // Verificar que Admin SDK esté inicializado
    if (!initializeAdmin()) {
      return NextResponse.json(
        { 
          error: 'Firebase Admin SDK no está configurado. Verifica que FIREBASE_SERVICE_ACCOUNT_KEY esté configurado correctamente en Railway.',
          details: 'Revisa los logs del servidor para más detalles'
        },
        { status: 500 }
      )
    }

    const body = await request.json()
    const { email } = body

    if (!email) {
      return NextResponse.json(
        { error: 'Email es requerido' },
        { status: 400 }
      )
    }

    console.log('🔑 [API] Generando link de recuperación de contraseña para:', email)

    // Generar el link de recuperación de contraseña
    // NO especificamos URL personalizada para evitar el error "Domain not allowlisted"
    // Firebase usará su configuración por defecto
    const actionCodeSettings: any = {
      handleCodeInApp: false,
    }

    const resetLink = await admin.auth().generatePasswordResetLink(
      email,
      actionCodeSettings
    )

    return NextResponse.json({ 
      success: true,
      resetLink 
    })
  } catch (error: any) {
    console.error('❌ [API] Error generando link de recuperación:', error)
    
    // Manejar errores específicos
    if (error.code === 'auth/user-not-found') {
      return NextResponse.json(
        { error: 'Usuario no encontrado' },
        { status: 404 }
      )
    }
    
    return NextResponse.json(
      { error: 'Error al generar link de recuperación', details: error.message },
      { status: 500 }
    )
  }
}
