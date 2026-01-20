import { NextRequest, NextResponse } from 'next/server'
import * as admin from 'firebase-admin'
import webpush from 'web-push'

// Inicializar Firebase Admin SDK si no está inicializado
let adminInitialized = false

function initializeAdmin() {
  if (adminInitialized || admin.apps.length > 0) return true

  try {
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
    if (!serviceAccount) {
      console.error('❌ [Push] FIREBASE_SERVICE_ACCOUNT_KEY no está configurado')
      return false
    }

    const serviceAccountJson = JSON.parse(serviceAccount)
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccountJson),
    })

    adminInitialized = true
    return true
  } catch (error: any) {
    console.error('❌ [Push] Error inicializando Firebase Admin SDK:', error.message)
    return false
  }
}

// Configurar web-push
function initializeWebPush() {
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY
  const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:noreply@fin.nexuno.com.ar'

  if (!vapidPublicKey || !vapidPrivateKey) {
    console.error('❌ [Push] VAPID keys no configuradas')
    return false
  }

  webpush.setVapidDetails(
    vapidSubject,
    vapidPublicKey,
    vapidPrivateKey
  )

  return true
}

export async function POST(request: NextRequest) {
  try {
    if (!initializeAdmin()) {
      return NextResponse.json(
        { error: 'Firebase Admin SDK no configurado' },
        { status: 500 }
      )
    }

    if (!initializeWebPush()) {
      return NextResponse.json(
        { error: 'Web Push no configurado' },
        { status: 500 }
      )
    }

    const body = await request.json()
    const { userId, title, body: messageBody, url, tag, workspaceId } = body

    if (!userId || !title || !messageBody) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos: userId, title, body' },
        { status: 400 }
      )
    }

    const firestore = admin.firestore()
    
    // Obtener todos los tokens del usuario
    let tokensQuery = firestore.collection('notification_tokens').where('user_id', '==', userId)
    
    // Si se especifica workspace, filtrar por ese workspace
    if (workspaceId) {
      tokensQuery = tokensQuery.where('workspace_id', '==', workspaceId)
    }
    
    const tokensSnap = await tokensQuery.get()

    if (tokensSnap.empty) {
      return NextResponse.json({
        success: true,
        sent: 0,
        message: 'No hay tokens registrados para este usuario'
      })
    }

    const payload = JSON.stringify({
      title,
      body: messageBody,
      url: url || '/dashboard',
      tag: tag || 'fincontrol-notification',
      timestamp: Date.now()
    })

    const results = []
    const tokensToDelete: string[] = []

    for (const tokenDoc of tokensSnap.docs) {
      const tokenData = tokenDoc.data()
      const subscription = tokenData.subscription

      try {
        await webpush.sendNotification(subscription, payload)
        results.push({ success: true, tokenId: tokenDoc.id })
      } catch (error: any) {
        console.error('❌ [Push] Error enviando notificación:', error)
        
        // Si el token ya no es válido (410 Gone), marcarlo para eliminar
        if (error.statusCode === 410) {
          tokensToDelete.push(tokenDoc.id)
        }
        
        results.push({ success: false, tokenId: tokenDoc.id, error: error.message })
      }
    }

    // Eliminar tokens inválidos
    if (tokensToDelete.length > 0) {
      await Promise.all(
        tokensToDelete.map(tokenId => firestore.collection('notification_tokens').doc(tokenId).delete())
      )
    }

    const successCount = results.filter(r => r.success).length

    return NextResponse.json({
      success: true,
      sent: successCount,
      total: results.length,
      deleted: tokensToDelete.length,
      results
    })
  } catch (error: any) {
    console.error('❌ [Push] Error en send-push-notification:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor', details: error.message },
      { status: 500 }
    )
  }
}
