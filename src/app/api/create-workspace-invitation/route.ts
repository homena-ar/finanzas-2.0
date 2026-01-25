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

/**
 * Crea una invitación a un workspace usando Admin SDK (bypasea reglas de Firestore).
 * Resuelve "Missing or insufficient permissions" al invitar desde Espacio personal
 * cuando la regla isWorkspaceOwner(get(workspaces/...)) falla por latencia o edge cases.
 *
 * - Verifica que el usuario sea owner del workspace
 * - Valida: no invitación pendiente/aceptada/rechazada previa, no ya miembro
 * - Crea el doc en workspace_invitations
 */
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
    const inviterEmail = decoded.email || ''

    const body = await request.json().catch(() => ({}))
    const workspaceId = body?.workspaceId
    const email = body?.email
    const permissions = body?.permissions
    const workspaceDisplayName = body?.workspaceDisplayName

    if (!workspaceId || typeof workspaceId !== 'string') {
      return NextResponse.json({ error: 'workspaceId es requerido' }, { status: 400 })
    }
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'email es requerido' }, { status: 400 })
    }
    if (!permissions || typeof permissions !== 'object') {
      return NextResponse.json({ error: 'permissions es requerido' }, { status: 400 })
    }

    const db = admin.firestore()

    // Verificar que el workspace existe y el usuario es owner
    const workspaceRef = db.collection('workspaces').doc(workspaceId)
    const workspaceDoc = await workspaceRef.get()

    if (!workspaceDoc.exists) {
      return NextResponse.json({ error: 'Workspace no encontrado' }, { status: 404 })
    }

    const workspaceData = workspaceDoc.data() as any
    if (workspaceData?.owner_id !== uid) {
      return NextResponse.json(
        { error: 'Solo el dueño del workspace puede invitar' },
        { status: 403 }
      )
    }

    // Invitación existente (cualquier estado)
    const existingInvites = await db
      .collection('workspace_invitations')
      .where('workspace_id', '==', workspaceId)
      .where('email', '==', email)
      .limit(1)
      .get()

    if (!existingInvites.empty) {
      const status = (existingInvites.docs[0].data() as any).status
      if (status === 'pending') {
        return NextResponse.json(
          { error: 'Ya existe una invitación pendiente para este email. Podés cancelarla y volver a invitar.' },
          { status: 400 }
        )
      }
      if (status === 'accepted') {
        return NextResponse.json(
          { error: 'Este usuario ya aceptó una invitación y es miembro del workspace.' },
          { status: 400 }
        )
      }
      if (status === 'rejected') {
        return NextResponse.json(
          { error: 'Este usuario rechazó una invitación anterior. Podés cancelarla y volver a invitar.' },
          { status: 400 }
        )
      }
      // cancelled: permitir crear nueva
    }

    // Ya es miembro
    const membersSnap = await db
      .collection('workspace_members')
      .where('workspace_id', '==', workspaceId)
      .get()

    const isAlreadyMember = membersSnap.docs.some((d) => (d.data() as any).user_email === email)
    if (isAlreadyMember) {
      return NextResponse.json(
        { error: 'Este email ya es miembro del workspace.' },
        { status: 400 }
      )
    }

    const workspaceName =
      (typeof workspaceDisplayName === 'string' && workspaceDisplayName.trim())
        ? workspaceDisplayName.trim()
        : (workspaceData?.name || 'Workspace')

    const invitationRef = await db.collection('workspace_invitations').add({
      workspace_id: workspaceId,
      email,
      inviter_email: inviterEmail,
      workspace_name: workspaceName,
      permissions,
      status: 'pending',
      created_at: admin.firestore.FieldValue.serverTimestamp(),
    })

    return NextResponse.json({
      success: true,
      invitationId: invitationRef.id,
      workspaceId,
      workspaceName,
    })
  } catch (error: any) {
    console.error('❌ [API] Error en create-workspace-invitation:', error)
    return NextResponse.json(
      { error: 'Error interno', details: error?.message || String(error) },
      { status: 500 }
    )
  }
}
