import { NextRequest, NextResponse } from 'next/server'
import * as admin from 'firebase-admin'

let adminInitialized = false

function initializeAdmin() {
  if (adminInitialized || admin.apps.length > 0) return true

  try {
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
    if (!serviceAccount) {
      console.error('❌ [API] FIREBASE_SERVICE_ACCOUNT_KEY no está configurado')
      return false
    }

    const serviceAccountJson = JSON.parse(serviceAccount)
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccountJson),
    })

    adminInitialized = true
    console.log('✅ [API] Firebase Admin SDK inicializado correctamente')
    return true
  } catch (error: any) {
    console.error('❌ [API] Error inicializando Firebase Admin SDK:', error?.message || error)
    return false
  }
}

function getBearerToken(request: NextRequest) {
  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization')
  if (!authHeader) return null
  const [type, token] = authHeader.split(' ')
  if (type !== 'Bearer' || !token) return null
  return token
}

export async function POST(request: NextRequest) {
  try {
    if (!initializeAdmin()) {
      return NextResponse.json({ error: 'Firebase Admin SDK no está configurado' }, { status: 500 })
    }

    const token = getBearerToken(request)
    if (!token) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const decoded = await admin.auth().verifyIdToken(token)
    const uid = decoded.uid
    const email = decoded.email
    if (!email) {
      return NextResponse.json({ error: 'Email no disponible en el token' }, { status: 400 })
    }

    const body = await request.json().catch(() => ({}))
    const workspaceId = body?.workspaceId
    if (!workspaceId || typeof workspaceId !== 'string') {
      return NextResponse.json({ error: 'workspaceId es requerido' }, { status: 400 })
    }

    const db = admin.firestore()
    
    // Verificar que el workspace existe
    const workspaceRef = db.collection('workspaces').doc(workspaceId)
    const workspaceDoc = await workspaceRef.get()
    
    if (!workspaceDoc.exists) {
      return NextResponse.json({ error: 'Workspace no encontrado' }, { status: 404 })
    }

    const workspaceData = workspaceDoc.data()
    const ownerId = workspaceData?.owner_id
    const workspaceName = workspaceData?.name || 'Workspace'

    // Verificar que el usuario NO es el owner
    if (ownerId === uid) {
      return NextResponse.json({ error: 'El dueño no puede salir de su propio workspace' }, { status: 403 })
    }

    // Verificar que el usuario es miembro
    const memberId = `${workspaceId}_${uid}`
    const memberRef = db.collection('workspace_members').doc(memberId)
    const memberDoc = await memberRef.get()
    
    if (!memberDoc.exists) {
      return NextResponse.json({ error: 'No eres miembro de este workspace' }, { status: 403 })
    }

    // Eliminar el membership
    await memberRef.delete()

    // Notificar al owner
    try {
      // Obtener información del perfil del usuario que sale (si existe)
      let leavingUserName: string | undefined = undefined
      try {
        const leavingUserProfile = await db.collection('profiles').doc(uid).get()
        if (leavingUserProfile.exists) {
          leavingUserName = leavingUserProfile.data()?.nombre
        }
      } catch (e) {
        console.warn('⚠️ [API] No se pudo obtener nombre del usuario que sale:', e)
      }

      // Crear notificación in-app para el owner
      await db.collection('notificaciones').add({
        user_id: ownerId,
        workspace_id: workspaceId,
        tipo: 'sistema',
        titulo: 'Miembro salió del espacio',
        mensaje: `${leavingUserName || email} salió del espacio ${workspaceName}`,
        icono: '👋',
        leida: false,
        link: '/dashboard/config',
        created_at: admin.firestore.FieldValue.serverTimestamp()
      })

      // Enviar email al owner
      try {
        const { getMemberLeftEmailTemplate } = await import('@/lib/email-templates')
        const emailTemplate = getMemberLeftEmailTemplate(
          workspaceName,
          email,
          leavingUserName
        )

        // Obtener email del owner
        const ownerRecord = await admin.auth().getUser(ownerId)
        const ownerEmail = ownerRecord.email

        if (ownerEmail) {
          const { Resend } = await import('resend')
          const resendClient = new Resend(process.env.RESEND_API_KEY)
          
          const defaultFromEmail = process.env.RESEND_FROM_EMAIL || 'noreply@fin.nexuno.com.ar'
          const emailFrom = `FinControl <${defaultFromEmail}>`

          await resendClient.emails.send({
            from: emailFrom,
            to: [ownerEmail],
            subject: emailTemplate.subject,
            html: emailTemplate.html,
            text: emailTemplate.text,
          })

          console.log('✅ [API] Email de notificación enviado al owner:', ownerEmail)
        }
      } catch (emailError: any) {
        console.error('❌ [API] Error enviando email al owner:', emailError)
        // No fallar si el email falla
      }

      // Enviar push notification al owner (todos sus dispositivos, sin filtrar por workspace)
      try {
        const pushResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/send-push-notification`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: ownerId,
            title: 'Miembro salió del espacio',
            body: `${leavingUserName || email} salió del espacio ${workspaceName}`,
            url: '/dashboard/config',
            tag: 'member-left'
          })
        })
        
        if (pushResponse.ok) {
          console.log('✅ [API] Push notification enviada al owner')
        }
      } catch (pushError: any) {
        console.error('❌ [API] Error enviando push notification:', pushError)
        // No fallar si el push falla
      }
    } catch (notificationError: any) {
      console.error('❌ [API] Error en notificaciones al owner:', notificationError)
      // No fallar si las notificaciones fallan
    }

    return NextResponse.json({
      success: true,
      workspaceId,
    })
  } catch (error: any) {
    console.error('❌ [API] Error en leave-workspace:', error)
    return NextResponse.json(
      { error: 'Error interno', details: error?.message || String(error) },
      { status: 500 }
    )
  }
}
