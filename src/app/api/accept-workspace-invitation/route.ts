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
    const permissions = invitation.permissions

    if (!workspaceId || typeof workspaceId !== 'string') {
      return NextResponse.json({ error: 'workspace_id inválido en la invitación' }, { status: 400 })
    }

    const memberId = `${workspaceId}_${uid}`

    await db.collection('workspace_members').doc(memberId).set(
      {
        workspace_id: workspaceId,
        user_id: uid,
        user_email: email,
        permissions,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    )

    await invitationRef.update({ status: 'accepted' })

    return NextResponse.json({
      success: true,
      memberId,
      workspaceId,
    })
  } catch (error: any) {
    console.error('❌ [API] Error en accept-workspace-invitation:', error)
    return NextResponse.json(
      { error: 'Error interno', details: error?.message || String(error) },
      { status: 500 }
    )
  }
}

