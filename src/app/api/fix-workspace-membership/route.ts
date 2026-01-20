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
 * Este endpoint “arregla” workspaces viejos:
 * - Si existe un membership del usuario con ID viejo (random), lo copia al ID compuesto `${workspaceId}_${uid}`
 * - Si el usuario es dueño y no existe membership, crea uno admin
 *
 * Seguridad:
 * - Solo permite arreglar para el usuario autenticado (uid del token)
 * - Solo si es dueño del workspace o ya tenía un membership existente (con cualquier ID)
 */
export async function POST(request: NextRequest) {
  try {
    if (!initializeAdmin()) {
      return NextResponse.json(
        { error: 'Firebase Admin SDK no está configurado' },
        { status: 500 }
      )
    }

    const token = getBearerToken(request)
    if (!token) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const decoded = await admin.auth().verifyIdToken(token)
    const uid = decoded.uid
    const email = decoded.email || null

    const body = await request.json().catch(() => ({}))
    const workspaceId = body?.workspaceId

    if (!workspaceId || typeof workspaceId !== 'string') {
      return NextResponse.json({ error: 'workspaceId es requerido' }, { status: 400 })
    }

    const db = admin.firestore()
    const workspaceRef = db.collection('workspaces').doc(workspaceId)
    const workspaceDoc = await workspaceRef.get()

    if (!workspaceDoc.exists) {
      return NextResponse.json({ error: 'Workspace no encontrado' }, { status: 404 })
    }

    const workspaceData = workspaceDoc.data() as any
    const isOwner = workspaceData?.owner_id === uid

    // Buscar membership existente (con ID viejo o nuevo)
    const membersSnap = await db
      .collection('workspace_members')
      .where('workspace_id', '==', workspaceId)
      .where('user_id', '==', uid)
      .limit(1)
      .get()

    const targetId = `${workspaceId}_${uid}`
    const targetRef = db.collection('workspace_members').doc(targetId)

    if (!membersSnap.empty) {
      const sourceDoc = membersSnap.docs[0]
      const sourceData = sourceDoc.data() as any

      await targetRef.set(
        {
          workspace_id: workspaceId,
          user_id: uid,
          user_email: sourceData.user_email || email,
          permissions: sourceData.permissions || {
            gastos: 'solo_lectura',
            ingresos: 'solo_lectura',
            ahorros: 'solo_lectura',
            tarjetas: 'solo_lectura',
          },
          display_name: sourceData.display_name ?? null,
          created_at: sourceData.created_at || admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      )

      return NextResponse.json({
        success: true,
        fixed: true,
        mode: 'copied_existing_membership',
        sourceMemberDocId: sourceDoc.id,
        targetMemberDocId: targetId,
      })
    }

    if (isOwner) {
      await targetRef.set(
        {
          workspace_id: workspaceId,
          user_id: uid,
          user_email: email,
          permissions: { gastos: 'admin', ingresos: 'admin', ahorros: 'admin', tarjetas: 'admin' },
          created_at: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      )

      return NextResponse.json({
        success: true,
        fixed: true,
        mode: 'created_owner_membership',
        targetMemberDocId: targetId,
      })
    }

    return NextResponse.json(
      { error: 'No tenés permisos para arreglar este workspace' },
      { status: 403 }
    )
  } catch (error: any) {
    console.error('❌ [API] Error en fix-workspace-membership:', error)
    return NextResponse.json(
      { error: 'Error interno', details: error?.message || String(error) },
      { status: 500 }
    )
  }
}

