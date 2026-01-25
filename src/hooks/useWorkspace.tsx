'use client'

import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react'
import { useAuth } from './useAuth'
import { db } from '@/lib/firebase'
import { getInvitationEmailTemplate } from '@/lib/email-templates'
import {
  collection,
  addDoc,
  setDoc,
  writeBatch,
  updateDoc,
  deleteDoc,
  doc,
  getDoc,
  query,
  where,
  getDocs,
  serverTimestamp,
  orderBy,
  limit,
  startAfter,
  Timestamp
} from 'firebase/firestore'
import type { Workspace, WorkspaceMember, WorkspaceInvitation, WorkspacePermissions } from '@/types'

interface WorkspaceContextType {
  workspaces: Workspace[]
  currentWorkspace: Workspace | null
  members: WorkspaceMember[]
  invitations: WorkspaceInvitation[] // Invitaciones recibidas (pendientes)
  sentInvitations: WorkspaceInvitation[] // Invitaciones enviadas
  loading: boolean
  /** Falso hasta que ensurePersonalWorkspace + setCurrentWorkspace (personal) hayan terminado. Usar para "Cargando tu espacio…". */
  initWorkspaceReady: boolean

  setCurrentWorkspace: (workspace: Workspace | null) => void
  createWorkspace: (name: string, icono?: string, logo?: string | null) => Promise<{ error: any } | { error: null, workspace: Workspace }>
  updateWorkspace: (id: string, name: string, icono?: string | null, logo?: string | null, ingresos_habilitado?: boolean, budget_ars?: number, budget_usd?: number) => Promise<{ error: any }>
  updateWorkspaceConfig: (id: string, config: { ingresos_habilitado?: boolean, budget_ars?: number, budget_usd?: number }) => Promise<{ error: any }>
  deleteWorkspace: (id: string) => Promise<{ error: any }>

  inviteUser: (workspaceId: string, email: string, permissions: WorkspacePermissions, options?: { workspaceDisplayName?: string }) => Promise<{ error: any }>
  updateMemberPermissions: (memberId: string, permissions: WorkspacePermissions) => Promise<{ error: any }>
  updateMemberDisplayName: (memberId: string, displayName: string | null) => Promise<{ error: any }>
  removeMember: (memberId: string) => Promise<{ error: any }>

  acceptInvitation: (invitationId: string) => Promise<{ error: any }>
  rejectInvitation: (invitationId: string) => Promise<{ error: any }>
  cancelInvitation: (invitationId: string) => Promise<{ error: any }>
  deleteInvitation: (invitationId: string) => Promise<{ error: any }>
  deleteAllInvitations: (workspaceId: string) => Promise<{ error: any }>

  leaveWorkspace: (workspaceId: string) => Promise<{ error: any }>

  /** Asegura que exista el workspace personal (type=personal) y profile.personal_workspace_id. Crea si falta. Retorna el workspaceId. */
  ensurePersonalWorkspace: () => Promise<string>

  fetchAll: () => Promise<void>
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined)

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user, profile, updateProfile } = useAuth()
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null)
  const [members, setMembers] = useState<WorkspaceMember[]>([])
  const [invitations, setInvitations] = useState<WorkspaceInvitation[]>([]) // Invitaciones recibidas
  const [sentInvitations, setSentInvitations] = useState<WorkspaceInvitation[]>([]) // Invitaciones enviadas
  const [loading, setLoading] = useState(true)
  const [initWorkspaceReady, setInitWorkspaceReady] = useState(false)
  const personalMigrationRunningRef = useRef(false)
  const initialPersonalSelectionRef = useRef(false)
  const previousUserIdRef = useRef<string | null>(null)

  const fetchAll = useCallback(async () => {
    if (!user) {
      setLoading(false)
      return
    }

    try {
      // 1. Mis workspaces (Dueño)
      const workspacesRef = collection(db, 'workspaces')
      const workspacesQuery = query(workspacesRef, where('owner_id', '==', user.uid))
      const workspacesSnap = await getDocs(workspacesQuery)

      const ownedWorkspaces = workspacesSnap.docs.map(d => ({
        id: d.id,
        name: d.data().name,
        owner_id: d.data().owner_id,
        type: (d.data().type === 'personal' ? 'personal' : 'collaborative') as Workspace['type'],
        icono: d.data().icono || null,
        logo: d.data().logo || null,
        ingresos_habilitado: d.data().ingresos_habilitado || false,
        budget_ars: d.data().budget_ars || 0,
        budget_usd: d.data().budget_usd || 0,
        created_at: d.data().created_at instanceof Timestamp 
          ? d.data().created_at.toDate().toISOString() 
          : d.data().created_at
      })) as Workspace[]

      // 2. Workspaces donde soy miembro
      const membersRef = collection(db, 'workspace_members')
      const membersQuery = query(membersRef, where('user_id', '==', user.uid))
      const membersSnap = await getDocs(membersQuery)
      
      const memberWorkspaceIds = new Set(membersSnap.docs.map(doc => doc.data().workspace_id))
      const memberWorkspaces: Workspace[] = []

      for (const wsId of Array.from(memberWorkspaceIds)) {
        if (ownedWorkspaces.find(w => w.id === wsId)) continue; // Evitar duplicados

        try {
            // Obtener el workspace directamente por ID
            const wsDoc = await getDoc(doc(db, 'workspaces', wsId))
            if (wsDoc.exists()) {
                const data = wsDoc.data()
                memberWorkspaces.push({
                    id: wsDoc.id,
                    name: data.name,
                    owner_id: data.owner_id,
                    type: (data.type === 'personal' ? 'personal' : 'collaborative') as Workspace['type'],
                    icono: data.icono || null,
                    logo: data.logo || null,
                    ingresos_habilitado: data.ingresos_habilitado || false,
                    budget_ars: data.budget_ars || 0,
                    budget_usd: data.budget_usd || 0,
                    created_at: data.created_at instanceof Timestamp 
                      ? data.created_at.toDate().toISOString() 
                      : data.created_at
                })
            }
        } catch (e) {
            console.warn(`No se pudo cargar info del workspace ${wsId}`, e)
        }
      }

      const allWorkspaces = [...ownedWorkspaces, ...memberWorkspaces]
      // Deduplicar por ID por seguridad
      const uniqueWorkspaces = Array.from(new Map(allWorkspaces.map(w => [w.id, w])).values())
      
      setWorkspaces(uniqueWorkspaces)

      // 3. Cargar MIEMBROS - Solo los del usuario actual (para cumplir con reglas de seguridad)
      // Primero obtenemos todos los miembros donde el usuario actual es miembro
      console.log('🏢 [useWorkspace] Cargando miembros del usuario:', user.uid)
      const myMembersRef = collection(db, 'workspace_members')
      const myMembersQuery = query(myMembersRef, where('user_id', '==', user.uid))
      const myMembersSnap = await getDocs(myMembersQuery)
      console.log('🏢 [useWorkspace] Miembros encontrados:', myMembersSnap.docs.length)
      
      const myMembersData = myMembersSnap.docs.map(doc => ({
        id: doc.id,
        workspace_id: doc.data().workspace_id,
        user_id: doc.data().user_id,
        user_email: doc.data().user_email,
        display_name: doc.data().display_name,
        permissions: doc.data().permissions,
        created_at: doc.data().created_at instanceof Timestamp
          ? doc.data().created_at.toDate().toISOString()
          : doc.data().created_at
      })) as WorkspaceMember[]

      // Ahora, para cada workspace donde soy dueño, cargar TODOS los miembros
      const ownedWorkspaceIds = ownedWorkspaces.map(w => w.id)
      const allMembersData: WorkspaceMember[] = [...myMembersData]

      if (ownedWorkspaceIds.length > 0) {
        // Solo el dueño puede leer todos los miembros de sus workspaces
        for (const wsId of ownedWorkspaceIds) {
          try {
            const workspaceMembersQuery = query(
              collection(db, 'workspace_members'),
              where('workspace_id', '==', wsId)
            )
            const workspaceMembersSnap = await getDocs(workspaceMembersQuery)
            
            const workspaceMembers = workspaceMembersSnap.docs.map(doc => ({
              id: doc.id,
              workspace_id: doc.data().workspace_id,
              user_id: doc.data().user_id,
              user_email: doc.data().user_email,
              display_name: doc.data().display_name,
              permissions: doc.data().permissions,
              created_at: doc.data().created_at instanceof Timestamp
                ? doc.data().created_at.toDate().toISOString()
                : doc.data().created_at
            })) as WorkspaceMember[]

            // Agregar solo los que no están ya en la lista
            workspaceMembers.forEach(member => {
              if (!allMembersData.find(m => m.id === member.id)) {
                allMembersData.push(member)
              }
            })
          } catch (e) {
            console.warn(`Error cargando miembros del workspace ${wsId}:`, e)
          }
        }
      }

      console.log('🏢 [useWorkspace] Total miembros cargados:', allMembersData.length)
      setMembers(allMembersData)

      // 4. Mis invitaciones pendientes (recibidas)
      const invitationsRef = collection(db, 'workspace_invitations')
      const invitationsQuery = query(
        invitationsRef, 
        where('email', '==', user.email), 
        where('status', '==', 'pending')
      )
      const invitationsSnap = await getDocs(invitationsQuery)
      setInvitations(invitationsSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as WorkspaceInvitation[])

      // 5. Invitaciones enviadas (para workspaces donde soy dueño)
      const sentInvitationsList: WorkspaceInvitation[] = []
      
      if (ownedWorkspaceIds.length > 0) {
        // Cargar todas las invitaciones de los workspaces que poseo
        for (const wsId of ownedWorkspaceIds) {
          try {
            const sentQuery = query(
              collection(db, 'workspace_invitations'),
              where('workspace_id', '==', wsId)
            )
            const sentSnap = await getDocs(sentQuery)
            sentInvitationsList.push(...sentSnap.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            })) as WorkspaceInvitation[])
          } catch (e) {
            console.warn(`Error cargando invitaciones enviadas para workspace ${wsId}:`, e)
          }
        }
      }
      
      setSentInvitations(sentInvitationsList)

      setLoading(false)
    } catch (error) {
      console.error('🏢 [useWorkspace] Error fetching data:', error)
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (user) {
      if (user.uid !== previousUserIdRef.current) {
        setWorkspaces([])
        setCurrentWorkspace(null)
        setMembers([])
        setInvitations([])
        setSentInvitations([])
        setLoading(true)
        setInitWorkspaceReady(false)
        initialPersonalSelectionRef.current = false
        previousUserIdRef.current = user.uid
      }
      fetchAll()
    } else {
      setWorkspaces([])
      setCurrentWorkspace(null)
      setMembers([])
      setInvitations([])
      setSentInvitations([])
      setLoading(false)
      setInitWorkspaceReady(false)
      initialPersonalSelectionRef.current = false
      previousUserIdRef.current = null
    }
  }, [user, fetchAll])

  // Reparar workspaces viejos: asegurar membership con ID compuesto
  const fixedMembershipRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    const wsId = currentWorkspace?.id
    if (!user || !wsId) return
    if (fixedMembershipRef.current.has(wsId)) return

    fixedMembershipRef.current.add(wsId)

    ;(async () => {
      try {
        const token = await user.getIdToken()
        const res = await fetch('/api/fix-workspace-membership', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ workspaceId: wsId }),
        })

        const text = await res.text()
        let data: any = null
        try { data = JSON.parse(text) } catch { /* ignore */ }

        if (!res.ok) {
          console.warn('⚠️ [useWorkspace] fix-workspace-membership failed:', res.status, data || text)
          return
        }

        console.log('✅ [useWorkspace] fix-workspace-membership:', data)
        // Refrescar datos una vez reparado
        await fetchAll()
      } catch (e) {
        console.warn('⚠️ [useWorkspace] Error calling fix-workspace-membership:', e)
      }
    })()
  }, [user?.uid, currentWorkspace?.id, fetchAll])

  // Recargar miembros cuando cambia el workspace actual (solo si es colaborador)
  useEffect(() => {
    if (user && currentWorkspace && !loading) {
      console.log('🏢 [useWorkspace] Workspace cambió a:', currentWorkspace.id, 'verificando miembros...')
      const member = members.find(m => m.workspace_id === currentWorkspace.id && m.user_id === user.uid)
      const isOwner = currentWorkspace.owner_id === user.uid
      
      if (!member && !isOwner) {
        console.log('🏢 [useWorkspace] No se encontró miembro para colaborador, recargando...')
        // Solo recargar si realmente no es dueño y no hay miembro
        fetchAll()
      } else {
        console.log('🏢 [useWorkspace] Miembro encontrado o es dueño:', { isOwner, hasMember: !!member })
      }
    }
  }, [currentWorkspace?.id, user?.uid, members.length]) // Solo cuando cambia el ID del workspace o del usuario

  const createWorkspace = useCallback(async (name: string, icono?: string, logo?: string | null) => {
    if (!user) return { error: new Error('No user') }

    // El límite es solo para workspaces colaborativos; el personal no cuenta
    const collaborativeCount = workspaces.filter(w => w.owner_id === user.uid && w.type !== 'personal').length
    if (collaborativeCount >= 3) return { error: new Error('Límite de espacios alcanzado') }

    try {
      const workspacesRef = collection(db, 'workspaces')
      const docRef = await addDoc(workspacesRef, {
        name,
        owner_id: user.uid,
        type: 'collaborative',
        icono: icono || null,
        logo: logo || null,
        created_at: serverTimestamp()
      })

      // CRÍTICO: Crear ficha de miembro ADMIN para el dueño usando ID compuesto
      const memberId = `${docRef.id}_${user.uid}`
      await setDoc(doc(db, 'workspace_members', memberId), {
        workspace_id: docRef.id,
        user_id: user.uid,
        user_email: user.email,
        permissions: { gastos: 'admin', ingresos: 'admin', ahorros: 'admin', tarjetas: 'admin' },
        created_at: serverTimestamp()
      })

      const newWorkspace: Workspace = { 
        id: docRef.id, 
        name, 
        owner_id: user.uid,
        type: 'collaborative',
        icono: icono || null,
        logo: logo || null,
        ingresos_habilitado: false,
        budget_ars: 0,
        budget_usd: 0,
        created_at: new Date().toISOString() 
      }
      
      await fetchAll() // Recargar todo para asegurar consistencia
      setCurrentWorkspace(newWorkspace) 
      
      return { error: null, workspace: newWorkspace }
    } catch (error) {
      return { error }
    }
  }, [user, workspaces, fetchAll])

  // Crea el workspace personal real (type=personal) si no existe.
  // - Asigna profile.personal_workspace_id (fuente de verdad; NO se resuelve por nombre)
  // - Asegura membership admin del owner
  // - Migra datos legacy (workspace_id null) y proxy workspaces (workspace_id legacy) → personal_workspace_id
  const ensurePersonalWorkspace = useCallback(async (): Promise<string> => {
    if (!user) throw new Error('No user')
    if (!profile) throw new Error('No profile')

    const ensureOwnerMembership = async (workspaceId: string) => {
      const mid = `${workspaceId}_${user.uid}`
      const mref = doc(db, 'workspace_members', mid)
      const msnap = await getDoc(mref)
      if (!msnap.exists()) {
        await setDoc(mref, {
          workspace_id: workspaceId,
          user_id: user.uid,
          user_email: user.email,
          permissions: { gastos: 'admin', ingresos: 'admin', ahorros: 'admin', tarjetas: 'admin' },
          created_at: serverTimestamp()
        })
      }
    }

    const migrateCollectionByWorkspaceId = async (col: string, fromWorkspaceId: string, toWorkspaceId: string) => {
      let last: any = null
      let total = 0
      while (true) {
        const base = [
          where('workspace_id', '==', fromWorkspaceId),
          orderBy('__name__'),
          limit(200),
        ] as any[]
        const q = query(collection(db, col), ...(last ? [...base, startAfter(last)] : base))
        const snap = await getDocs(q)
        if (snap.empty) break
        const batch = writeBatch(db)
        snap.docs.forEach(d => batch.update(d.ref, { workspace_id: toWorkspaceId }))
        await batch.commit()
        total += snap.size
        last = snap.docs[snap.docs.length - 1]
        console.log(`[useWorkspace] migrate ${col}: ${fromWorkspaceId} -> ${toWorkspaceId} (+${snap.size}, total ${total})`)
      }
      return total
    }

    const migrateLegacyPersonalWithoutWorkspaceId = async (col: string, toWorkspaceId: string) => {
      let last: any = null
      let total = 0
      while (true) {
        const base = [
          where('user_id', '==', user.uid),
          orderBy('__name__'),
          limit(200),
        ] as any[]
        const q = query(collection(db, col), ...(last ? [...base, startAfter(last)] : base))
        const snap = await getDocs(q)
        if (snap.empty) break
        const batch = writeBatch(db)
        let dirty = 0
        snap.docs.forEach(d => {
          const data = d.data()
          if (data.workspace_id === undefined || data.workspace_id === null) {
            batch.update(d.ref, { workspace_id: toWorkspaceId })
            dirty++
          }
        })
        if (dirty > 0) {
          await batch.commit()
          total += dirty
          console.log(`[useWorkspace] migrate ${col}: user legacy -> ${toWorkspaceId} (+${dirty}, total ${total})`)
        }
        last = snap.docs[snap.docs.length - 1]
      }
      return total
    }

    const migrateMembers = async (fromWorkspaceId: string, toWorkspaceId: string) => {
      let last: any = null
      let total = 0
      while (true) {
        const base = [
          where('workspace_id', '==', fromWorkspaceId),
          orderBy('__name__'),
          limit(200),
        ] as any[]
        const q = query(collection(db, 'workspace_members'), ...(last ? [...base, startAfter(last)] : base))
        const snap = await getDocs(q)
        if (snap.empty) break
        const batch = writeBatch(db)
        snap.docs.forEach(d => {
          const data: any = d.data()
          // Owner del personal ya se asegura aparte
          if (data.user_id && data.user_id !== user.uid) {
            const newRef = doc(db, 'workspace_members', `${toWorkspaceId}_${data.user_id}`)
            batch.set(newRef, {
              workspace_id: toWorkspaceId,
              user_id: data.user_id,
              user_email: data.user_email,
              display_name: data.display_name,
              permissions: data.permissions,
              created_at: data.created_at || serverTimestamp(),
            }, { merge: true } as any)
          }
          batch.delete(d.ref)
        })
        await batch.commit()
        total += snap.size
        last = snap.docs[snap.docs.length - 1]
        console.log(`[useWorkspace] migrate workspace_members: ${fromWorkspaceId} -> ${toWorkspaceId} (+${snap.size}, total ${total})`)
      }
      return total
    }

    const migrateInvitations = async (fromWorkspaceId: string, toWorkspaceId: string, workspaceName: string) => {
      let last: any = null
      let total = 0
      while (true) {
        const base = [
          where('workspace_id', '==', fromWorkspaceId),
          orderBy('__name__'),
          limit(200),
        ] as any[]
        const q = query(collection(db, 'workspace_invitations'), ...(last ? [...base, startAfter(last)] : base))
        const snap = await getDocs(q)
        if (snap.empty) break
        const batch = writeBatch(db)
        snap.docs.forEach(d => {
          batch.update(d.ref, { workspace_id: toWorkspaceId, workspace_name: workspaceName })
        })
        await batch.commit()
        total += snap.size
        last = snap.docs[snap.docs.length - 1]
        console.log(`[useWorkspace] migrate workspace_invitations: ${fromWorkspaceId} -> ${toWorkspaceId} (+${snap.size}, total ${total})`)
      }
      return total
    }

    const runMigrationIfNeeded = async (personalId: string, personalName: string, ownedSnap?: any) => {
      if (profile.personal_migration_done && profile.personal_migration_version === 1) return
      if (personalMigrationRunningRef.current) return
      personalMigrationRunningRef.current = true
      try {
        // Marcar inicio (idempotente / indicador UI)
        try {
          await updateProfile({
            personal_migration_running: true,
            personal_migration_started_at: new Date().toISOString(),
            personal_migration_needs_attention: false,
            personal_migration_proxy_candidates: [],
          })
        } catch { /* ignore */ }

        const dataCols = ['gastos', 'ingresos', 'impuestos', 'tarjetas', 'movimientos_ahorro', 'metas', 'categorias', 'categorias_ingresos', 'tags', 'tags_ingresos', 'medios_pago'] as const

        // 1) Legacy personal (workspace_id faltante) -> personalId
        for (const col of dataCols) {
          try { await migrateLegacyPersonalWithoutWorkspaceId(col, personalId) } catch (e) { console.warn('[useWorkspace] migrate legacy user', col, e) }
        }

        // 2) Proxy workspaces -> personalId (detectar duplicados creados por bug)
        const owned = ownedSnap ?? await getDocs(query(collection(db, 'workspaces'), where('owner_id', '==', user.uid)))
        const legacyDocs = (owned.docs as any[])
          .filter((d: any) => d.id !== personalId && d.data().type !== 'personal')
          .filter((d: any) => d.data().name === personalName || d.data().name === 'Espacio Personal')
        const legacyIds = legacyDocs.map((d: any) => d.id as string)

        const proxyCandidatesNeedingAttention: Array<{ id: string; name: string }> = []

        const isSafeProxyToAutoMigrate = async (legacyId: string) => {
          // Heurística conservadora para evitar migrar un workspace real:
          // - Sin datos en colecciones principales (workspace_id == legacyId)
          // - Sin invitaciones
          // - Sin miembros extra (<= 1 membership)
          try {
            const mSnap = await getDocs(query(collection(db, 'workspace_members'), where('workspace_id', '==', legacyId), limit(2)))
            if (mSnap.size > 1) return { ok: false, reason: 'tiene miembros' }

            const iSnap = await getDocs(query(collection(db, 'workspace_invitations'), where('workspace_id', '==', legacyId), limit(1)))
            if (!iSnap.empty) return { ok: false, reason: 'tiene invitaciones' }

            for (const col of dataCols) {
              const dSnap = await getDocs(query(collection(db, col), where('workspace_id', '==', legacyId), limit(1)))
              if (!dSnap.empty) return { ok: false, reason: `tiene datos (${col})` }
            }

            return { ok: true as const, reason: 'parece proxy vacío' }
          } catch (e) {
            return { ok: false, reason: 'no se pudo verificar (seguridad)' }
          }
        }

        if (legacyIds.length > 0) {
          console.warn('[useWorkspace] posibles workspaces proxy detectados:', legacyIds)
        }

        for (const legacyId of legacyIds) {
          const legacyName = (legacyDocs.find((d: any) => d.id === legacyId)?.data()?.name as string) || legacyId
          const safety = await isSafeProxyToAutoMigrate(legacyId)
          if (!safety.ok) {
            console.warn('[useWorkspace] proxy NO migrado automáticamente:', legacyId, legacyName, safety.reason)
            proxyCandidatesNeedingAttention.push({ id: legacyId, name: legacyName })
            continue
          }

          console.warn('[useWorkspace] proxy migrado automáticamente:', legacyId, legacyName, safety.reason)
          for (const col of dataCols) {
            try { await migrateCollectionByWorkspaceId(col, legacyId, personalId) } catch (e) { console.warn('[useWorkspace] migrate proxy', col, e) }
          }
          // members + invitations
          try { await migrateMembers(legacyId, personalId) } catch (e) { console.warn('[useWorkspace] migrate members', e) }
          try { await migrateInvitations(legacyId, personalId, personalName) } catch (e) { console.warn('[useWorkspace] migrate invitations', e) }
        }

        await updateProfile({
          personal_migration_done: true,
          personal_migration_done_at: new Date().toISOString(),
          personal_migration_version: 1,
          personal_migration_running: false,
          personal_migration_needs_attention: proxyCandidatesNeedingAttention.length > 0,
          personal_migration_proxy_candidates: proxyCandidatesNeedingAttention,
        })
      } finally {
        personalMigrationRunningRef.current = false
        // Si falló antes del update final, evitar dejar el flag "running" prendido
        try { await updateProfile({ personal_migration_running: false }) } catch { /* ignore */ }
      }
    }

    const existingId = profile.personal_workspace_id
    if (existingId) {
      const wsSnap = await getDoc(doc(db, 'workspaces', existingId))
      if (wsSnap.exists()) {
        await ensureOwnerMembership(existingId)
        // Migrar (idempotente) si aún no se hizo
        ;(async () => {
          try { await runMigrationIfNeeded(existingId, wsSnap.data()?.name || (profile.personal_workspace_name || 'Espacio Personal')) } catch (e) { console.warn('[useWorkspace] migration failed', e) }
        })()
        return existingId
      }
    }

    // Si no hay id o fue borrado: comprobar si ya existe un personal (p. ej. creación previa con updateProfile fallido)
    const ownedQ = query(collection(db, 'workspaces'), where('owner_id', '==', user.uid))
    const ownedSnap = await getDocs(ownedQ)
    const personalDoc = ownedSnap.docs.find(d => d.data().type === 'personal')
    if (personalDoc) {
      const id = personalDoc.id
      try { await updateProfile({ personal_workspace_id: id }) } catch { /* ignore */ }
      await ensureOwnerMembership(id)
      ;(async () => {
        try { await runMigrationIfNeeded(id, personalDoc.data().name || (profile.personal_workspace_name || 'Espacio Personal'), ownedSnap) } catch (e) { console.warn('[useWorkspace] migration failed', e) }
      })()
      return id
    }

    // Crear personal real
    const personalName = profile.personal_workspace_name || 'Espacio Personal'
    const workspacesRef = collection(db, 'workspaces')
    const docRef = await addDoc(workspacesRef, {
      name: personalName,
      owner_id: user.uid,
      type: 'personal',
      icono: profile.personal_workspace_icono || null,
      logo: profile.personal_workspace_logo || null,
      ingresos_habilitado: profile?.ingresos_habilitado ?? false,
      created_at: serverTimestamp()
    })
    const newId = docRef.id
    await ensureOwnerMembership(newId)
    await updateProfile({ personal_workspace_id: newId })

    ;(async () => {
      try { await runMigrationIfNeeded(newId, personalName, ownedSnap) } catch (e) { console.warn('[useWorkspace] migration failed', e) }
    })()

    return newId
  }, [user, profile, updateProfile])

  // Init ordenado: ensurePersonalWorkspace → fetchAll → setCurrentWorkspace(personal). Así los datos se cargan con workspaceId válido.
  useEffect(() => {
    if (!user || !profile) return
    if (initialPersonalSelectionRef.current) {
      setInitWorkspaceReady(true)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const personalId = await ensurePersonalWorkspace()
        if (cancelled) return
        await fetchAll()
        if (cancelled) return
        if (initialPersonalSelectionRef.current) {
          setInitWorkspaceReady(true)
          return
        }
        const wsSnap = await getDoc(doc(db, 'workspaces', personalId))
        if (cancelled || !wsSnap.exists()) {
          setInitWorkspaceReady(true)
          return
        }
        const d = wsSnap.data()
        const personalWs: Workspace = {
          id: wsSnap.id,
          name: d.name,
          owner_id: d.owner_id,
          type: (d.type === 'personal' ? 'personal' : 'collaborative') as Workspace['type'],
          icono: d.icono || null,
          logo: d.logo || null,
          ingresos_habilitado: d.ingresos_habilitado || false,
          budget_ars: d.budget_ars || 0,
          budget_usd: d.budget_usd || 0,
          created_at: d.created_at instanceof Timestamp ? d.created_at.toDate().toISOString() : (d.created_at || new Date().toISOString())
        }
        setCurrentWorkspace(personalWs)
        initialPersonalSelectionRef.current = true
        setInitWorkspaceReady(true)
      } catch (e) {
        console.warn('[useWorkspace] init ensurePersonalWorkspace failed:', e)
        setInitWorkspaceReady(true)
      }
    })()
    return () => { cancelled = true }
  }, [user?.uid, profile, ensurePersonalWorkspace, fetchAll])

  const inviteUser = useCallback(async (workspaceId: string, email: string, permissions: WorkspacePermissions, options?: { workspaceDisplayName?: string }) => {
    if (!user) return { error: new Error('No user') }

    try {
      // Crear invitación vía API (evita "Missing or insufficient permissions" en Espacio personal)
      const token = await user.getIdToken()
      const createRes = await fetch('/api/create-workspace-invitation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          workspaceId,
          email,
          permissions,
          workspaceDisplayName: options?.workspaceDisplayName,
        }),
      })

      if (!createRes.ok) {
        const data = await createRes.json().catch(() => ({}))
        return { error: new Error(data?.error || 'No se pudo crear la invitación') }
      }

      const createData = await createRes.json()
      const workspaceName = createData.workspaceName || 'Workspace'

      console.log('✅ [useWorkspace] Invitación creada con ID:', createData.invitationId, 'workspace_id:', workspaceId)

      // Enviar email usando Resend API
      try {
        // Obtener nombre del invitador si está disponible
        const inviterName = profile?.nombre || null
        
        // Usar el template profesional
        const emailTemplate = getInvitationEmailTemplate(
          workspaceName,
          email,
          permissions,
          inviterName || undefined
        )
        
        const emailHtml = emailTemplate.html
        const emailText = emailTemplate.text

        // Formatear el campo 'from' correctamente para Resend
        // Resend requiere formato: "Nombre <email@domain.com>" o solo "email@domain.com"
        // IMPORTANTE: El dominio debe estar verificado en Resend Dashboard
        // Si no está verificado, Resend usará el dominio de prueba (resend.dev) que solo permite enviar a tu propio email
        // Nota: El API route también puede usar RESEND_FROM_EMAIL para configurar el dominio
        // Dominio verificado: fin.nexuno.com.ar
        const defaultFromEmail = 'noreply@fin.nexuno.com.ar'
        let emailFrom = `FinControl <${defaultFromEmail}>`
        
        // Validar que no se esté usando el dominio de prueba
        if (defaultFromEmail.includes('@resend.dev')) {
          console.error('❌ [useWorkspace] ADVERTENCIA: Se está usando el dominio de prueba resend.dev')
          console.error('❌ [useWorkspace] El dominio debe estar verificado en Resend Dashboard')
        }

        const emailPayload = {
          to: email,
          from: emailFrom,
          subject: emailTemplate.subject,
          html: emailHtml,
          text: emailText,
          workspaceName,
          permissions
        }

        console.log('📧 [useWorkspace] Enviando email de invitación:', {
          to: email,
          from: emailPayload.from,
          subject: emailPayload.subject,
          htmlLength: emailHtml.length,
          textLength: emailText.length
        })
        
        console.log('📧 [useWorkspace] Llamando a /api/send-invitation...')
        const response = await fetch('/api/send-invitation', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(emailPayload)
        })

        console.log('📧 [useWorkspace] Response recibida:', {
          ok: response.ok,
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries())
        })

        const result = await response.json()
        console.log('📧 [useWorkspace] Resultado parseado:', result)
        
        if (!response.ok) {
          let errorMessage = result.error || result.details || 'Error al enviar correo'
          
          // Detectar errores específicos
          const errorDetails = typeof result.details === 'string' ? result.details : JSON.stringify(result.details || {})
          const errorString = JSON.stringify(result)
          
          // Detectar errores de dominio no verificado
          if (errorDetails.includes('Testing domain restriction') || 
              errorDetails.includes('resend.dev') ||
              errorString.includes('resend.dev') ||
              result.error?.includes('Dominio no verificado')) {
            errorMessage = '⚠️ El dominio de correo no está verificado en Resend. El correo no se pudo enviar, pero la invitación se creó correctamente y el usuario puede verla en la app. Para enviar correos, verifica tu dominio en https://resend.com/domains'
            console.error('❌ [useWorkspace] ERROR DE DOMINIO:', {
              message: 'El dominio no está verificado en Resend',
              currentFrom: result.currentFrom,
              resendFromEmail: result.resendFromEmail,
              help: result.help || 'Ve a https://resend.com/domains para verificar tu dominio'
            })
          }
          
          console.error('❌ [useWorkspace] Error en respuesta:', {
            status: response.status,
            error: errorMessage,
            details: result.details,
            warning: result.warning,
            fullResult: result
          })
          
          // Si hay un warning, no lanzar error (la invitación se creó)
          if (result.warning) {
            console.warn('⚠️ [useWorkspace] Advertencia (invitación creada):', result.warning)
            // No lanzar error, la invitación ya está creada
            // Recargar invitaciones para mostrar la nueva invitación enviada
            await fetchAll()
            return { error: null }
          }
          
          // Si es un error de dominio, no lanzar excepción pero loguear el problema
          if (errorMessage.includes('dominio no está verificado')) {
            console.error('❌ [useWorkspace] El correo no se envió por dominio no verificado, pero la invitación está creada')
            // Recargar invitaciones para mostrar la nueva invitación enviada
            await fetchAll()
            return { error: null } // No lanzar error, la invitación ya está creada
          }
          
          throw new Error(errorMessage)
        }

        console.log('✅ [useWorkspace] Correo enviado exitosamente:', result)
      } catch (emailError: any) {
        console.error('❌ [useWorkspace] Error al enviar correo:', {
          error: emailError,
          errorMessage: emailError?.message,
          errorStack: emailError?.stack,
          errorType: emailError?.constructor?.name
        })
        // No fallar la invitación si el email falla, la invitación ya está creada
        // El usuario puede ver la invitación en la app aunque no reciba el email
      }

      // Recargar invitaciones para mostrar la nueva invitación enviada
      await fetchAll()

      return { error: null }
    } catch (error) {
      console.error(error)
      return { error }
    }
  }, [user, profile, fetchAll])

  const updateWorkspace = useCallback(async (id: string, name: string, icono?: string | null, logo?: string | null, ingresos_habilitado?: boolean, budget_ars?: number, budget_usd?: number) => {
    try { 
      const updateData: any = { name }
      if (icono !== undefined) {
        updateData.icono = icono
      }
      if (logo !== undefined) {
        updateData.logo = logo
      }
      if (ingresos_habilitado !== undefined) {
        updateData.ingresos_habilitado = ingresos_habilitado
      }
      if (budget_ars !== undefined) {
        updateData.budget_ars = budget_ars
      }
      if (budget_usd !== undefined) {
        updateData.budget_usd = budget_usd
      }
      await updateDoc(doc(db, 'workspaces', id), updateData)
      await fetchAll()
      return { error: null } 
    } catch (e) { return { error: e } }
  }, [fetchAll])

  const updateWorkspaceConfig = useCallback(async (id: string, config: { ingresos_habilitado?: boolean, budget_ars?: number, budget_usd?: number }) => {
    try {
      // Actualización optimista: actualizar estado local inmediatamente
      if (currentWorkspace && currentWorkspace.id === id) {
        setCurrentWorkspace(prev => prev ? {
          ...prev,
          ingresos_habilitado: config.ingresos_habilitado !== undefined ? config.ingresos_habilitado : prev.ingresos_habilitado,
          budget_ars: config.budget_ars !== undefined ? config.budget_ars : prev.budget_ars,
          budget_usd: config.budget_usd !== undefined ? config.budget_usd : prev.budget_usd
        } : null)
      }
      
      // Actualizar también en la lista de workspaces
      setWorkspaces(prev => prev.map(w => 
        w.id === id ? {
          ...w,
          ingresos_habilitado: config.ingresos_habilitado !== undefined ? config.ingresos_habilitado : w.ingresos_habilitado,
          budget_ars: config.budget_ars !== undefined ? config.budget_ars : w.budget_ars,
          budget_usd: config.budget_usd !== undefined ? config.budget_usd : w.budget_usd
        } : w
      ))
      
      const updateData: any = {}
      if (config.ingresos_habilitado !== undefined) {
        updateData.ingresos_habilitado = config.ingresos_habilitado
      }
      if (config.budget_ars !== undefined) {
        updateData.budget_ars = config.budget_ars
      }
      if (config.budget_usd !== undefined) {
        updateData.budget_usd = config.budget_usd
      }
      await updateDoc(doc(db, 'workspaces', id), updateData)
      await fetchAll() // Sincronizar con Firebase
      return { error: null }
    } catch (e) {
      // En caso de error, revertir haciendo fetchAll
      await fetchAll()
      return { error: e }
    }
  }, [fetchAll, currentWorkspace])

  const deleteWorkspace = useCallback(async (id: string) => {
    try { 
        await deleteDoc(doc(db, 'workspaces', id))
        if (currentWorkspace?.id === id) setCurrentWorkspace(null)
        await fetchAll()
        return { error: null } 
    } catch (e) { return { error: e } }
  }, [currentWorkspace, fetchAll])

  const updateMemberPermissions = useCallback(async (mid: string, p: any) => {
    try { await updateDoc(doc(db, 'workspace_members', mid), { permissions: p }); await fetchAll(); return { error: null } } catch (e) { return { error: e } }
  }, [fetchAll])

  const updateMemberDisplayName = useCallback(async (mid: string, displayName: string | null) => {
    try {
      const updateData: any = {}
      if (displayName) {
        updateData.display_name = displayName
      } else {
        // Si es null, eliminar el campo (usar FieldValue.delete() si es necesario)
        updateData.display_name = null
      }
      await updateDoc(doc(db, 'workspace_members', mid), updateData)
      await fetchAll()
      return { error: null }
    } catch (e) {
      return { error: e }
    }
  }, [fetchAll])

  const removeMember = useCallback(async (mid: string) => {
    try { await deleteDoc(doc(db, 'workspace_members', mid)); await fetchAll(); return { error: null } } catch (e) { return { error: e } }
  }, [fetchAll])

  const acceptInvitation = useCallback(async (invitationId: string) => {
    if (!user) return { error: new Error('No user') }
    try {
      // IMPORTANTE: las reglas actuales no permiten que el invitado cree membership directamente.
      // Lo hacemos vía API (Admin SDK) verificando el token.
      const token = await user.getIdToken()
      const resp = await fetch('/api/accept-workspace-invitation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ invitationId }),
      })

      const text = await resp.text()
      if (!resp.ok) {
        let msg = text
        try {
          const parsed = JSON.parse(text)
          msg = parsed.error || parsed.details || msg
        } catch { /* ignore */ }
        return { error: new Error(msg) }
      }

      console.log('✅ [useWorkspace] Invitación aceptada vía API:', text)
      await fetchAll()
      return { error: null }
    } catch (error) { return { error } }
  }, [user, invitations, fetchAll])

  const rejectInvitation = useCallback(async (invitationId: string) => {
    if (!user) return { error: new Error('No user') }
    try {
      // IMPORTANTE: Usar API para rechazar y notificar al owner
      const token = await user.getIdToken()
      const resp = await fetch('/api/reject-workspace-invitation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ invitationId }),
      })

      const text = await resp.text()
      if (!resp.ok) {
        let msg = text
        try {
          const parsed = JSON.parse(text)
          msg = parsed.error || parsed.details || msg
        } catch { /* ignore */ }
        return { error: new Error(msg) }
      }

      console.log('✅ [useWorkspace] Invitación rechazada vía API:', text)
      await fetchAll()
      return { error: null }
    } catch (error) { 
      return { error } 
    }
  }, [user, fetchAll])

  const cancelInvitation = useCallback(async (invitationId: string) => {
    try {
        await updateDoc(doc(db, 'workspace_invitations', invitationId), { status: 'cancelled' })
        await fetchAll()
        return { error: null }
    } catch (e) { return { error: e } }
  }, [fetchAll])

  const deleteInvitation = useCallback(async (invitationId: string) => {
    try {
      await deleteDoc(doc(db, 'workspace_invitations', invitationId))
      await fetchAll()
      return { error: null }
    } catch (e) { 
      return { error: e } 
    }
  }, [fetchAll])

  const deleteAllInvitations = useCallback(async (workspaceId: string) => {
    if (!user) return { error: new Error('No user') }
    
    try {
      // Verificar que el usuario es dueño del workspace
      const workspace = workspaces.find(w => w.id === workspaceId)
      if (!workspace || workspace.owner_id !== user.uid) {
        return { error: new Error('Solo el administrador puede eliminar invitaciones') }
      }

      // Obtener todas las invitaciones del workspace
      const invitationsQuery = query(
        collection(db, 'workspace_invitations'),
        where('workspace_id', '==', workspaceId)
      )
      const invitationsSnap = await getDocs(invitationsQuery)
      
      // Eliminar todas las invitaciones
      const deletePromises = invitationsSnap.docs.map(doc => deleteDoc(doc.ref))
      await Promise.all(deletePromises)
      
      await fetchAll()
      return { error: null }
    } catch (e) { 
      return { error: e } 
    }
  }, [user, workspaces, fetchAll])

  const leaveWorkspace = useCallback(async (workspaceId: string) => {
    if (!user) return { error: new Error('No user') }
    
    try {
      // Verificar que el usuario NO es dueño del workspace
      const workspace = workspaces.find(w => w.id === workspaceId)
      if (!workspace) {
        return { error: new Error('Workspace no encontrado') }
      }
      
      if (workspace.owner_id === user.uid) {
        return { error: new Error('El dueño no puede salir de su propio workspace') }
      }

      // Verificar que el usuario es miembro
      const memberId = `${workspaceId}_${user.uid}`
      const memberDoc = await getDoc(doc(db, 'workspace_members', memberId))
      if (!memberDoc.exists()) {
        return { error: new Error('No eres miembro de este workspace') }
      }

      // Usar API para salir (elimina membership y notifica al owner)
      const token = await user.getIdToken()
      const resp = await fetch('/api/leave-workspace', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ workspaceId }),
      })

      const text = await resp.text()
      if (!resp.ok) {
        let msg = text
        try {
          const parsed = JSON.parse(text)
          msg = parsed.error || parsed.details || msg
        } catch { /* ignore */ }
        return { error: new Error(msg) }
      }

      console.log('✅ [useWorkspace] Usuario salió del workspace vía API:', text)
      
      // Si el workspace actual es el que estamos abandonando, limpiarlo
      if (currentWorkspace?.id === workspaceId) {
        setCurrentWorkspace(null)
      }
      
      await fetchAll()
      return { error: null }
    } catch (error) { 
      return { error } 
    }
  }, [user, workspaces, currentWorkspace, fetchAll])

  const value = {
    workspaces, currentWorkspace, members, invitations, sentInvitations, loading, initWorkspaceReady,
    setCurrentWorkspace, createWorkspace, updateWorkspace, updateWorkspaceConfig, deleteWorkspace,
    inviteUser, updateMemberPermissions, updateMemberDisplayName, removeMember, 
    acceptInvitation, rejectInvitation, cancelInvitation, deleteInvitation, deleteAllInvitations,
    leaveWorkspace,
    ensurePersonalWorkspace,
    fetchAll
  }

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext)
  if (context === undefined) throw new Error('useWorkspace must be used within a WorkspaceProvider')
  return context
}
