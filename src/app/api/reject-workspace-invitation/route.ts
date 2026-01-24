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
    const invitationId = body?.invitationId
    if (!invitationId || typeof invitationId !== 'string') {
      return NextResponse.json({ error: 'invitationId es requerido' }, { status: 400 })
    }

    const db = admin.firestore()
    const invitationRef = db.collection('workspace_invitations').doc(invitationId)
    const invitationDoc = await invitationRef.get()

    if (!invitationDoc.exists) {
      return NextResponse.json({ error: 'Invitación no encontrada' }, { status: 404 })
    }

    const invitation = invitationDoc.data() as any
    if (invitation.email !== email) {
      return NextResponse.json({ error: 'No autorizado para esta invitación' }, { status: 403 })
    }

    if (invitation.status !== 'pending') {
      return NextResponse.json({ error: 'La invitación ya no está pendiente' }, { status: 400 })
    }

    const workspaceId = invitation.workspace_id

    if (!workspaceId || typeof workspaceId !== 'string') {
      return NextResponse.json({ error: 'workspace_id inválido en la invitación' }, { status: 400 })
    }

    // Actualizar estado a rejected
    await invitationRef.update({ status: 'rejected' })

    // Notificar al owner del workspace
    try {
      // Obtener información del workspace y del owner
      const workspaceRef = db.collection('workspaces').doc(workspaceId)
      const workspaceDoc = await workspaceRef.get()
      
      if (workspaceDoc.exists) {
        const workspaceData = workspaceDoc.data()
        const ownerId = workspaceData?.owner_id
        
        if (ownerId && ownerId !== uid) {
          // Obtener información del perfil del invitado (si existe)
          let invitedUserName: string | undefined = undefined
          try {
            const invitedUserProfile = await db.collection('profiles').doc(uid).get()
            if (invitedUserProfile.exists) {
              invitedUserName = invitedUserProfile.data()?.nombre
            }
          } catch (e) {
            console.warn('⚠️ [API] No se pudo obtener nombre del invitado:', e)
          }

          // Obtener nombre del workspace
          const workspaceName = workspaceData?.name || 'Workspace'

          // Crear notificación in-app
          await db.collection('notificaciones').add({
            user_id: ownerId,
            workspace_id: workspaceId,
            tipo: 'sistema',
            titulo: 'Invitación rechazada',
            mensaje: `${invitedUserName || email} rechazó tu invitación a ${workspaceName}`,
            icono: '❌',
            leida: false,
            link: '/dashboard/config',
            created_at: admin.firestore.FieldValue.serverTimestamp()
          })

          // Enviar email al owner
          try {
            const { getInvitationRejectedEmailTemplate } = await import('@/lib/email-templates')
            const emailTemplate = getInvitationRejectedEmailTemplate(
              workspaceName,
              email,
              invitedUserName
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
            // No fallar el rechazo si el email falla
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
                title: 'Invitación rechazada',
                body: `${invitedUserName || email} rechazó tu invitación a ${workspaceName}`,
                url: '/dashboard/config',
                tag: 'invite-rejected'
              })
            })
            
            if (pushResponse.ok) {
              console.log('✅ [API] Push notification enviada al owner')
            }
          } catch (pushError: any) {
            console.error('❌ [API] Error enviando push notification:', pushError)
            // No fallar el rechazo si el push falla
          }
        }
      }
    } catch (notificationError: any) {
      console.error('❌ [API] Error en notificaciones al owner:', notificationError)
      // No fallar el rechazo si las notificaciones fallan
    }

    return NextResponse.json({
      success: true,
      invitationId,
      workspaceId,
    })
  } catch (error: any) {
    console.error('❌ [API] Error en reject-workspace-invitation:', error)
    return NextResponse.json(
      { error: 'Error interno', details: error?.message || String(error) },
      { status: 500 }
    )
  }
}
