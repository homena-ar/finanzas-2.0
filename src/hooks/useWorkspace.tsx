'use client'

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { useAuth } from './useAuth'
import { db } from '@/lib/firebase'
import {
  collection,
  addDoc,
  setDoc, // <--- Necesario para definir el ID del miembro manualmente
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  getDocs,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore'
import type { Workspace, WorkspaceMember, WorkspaceInvitation, WorkspacePermissions } from '@/types'

interface WorkspaceContextType {
  workspaces: Workspace[]
  currentWorkspace: Workspace | null
  members: WorkspaceMember[]
  invitations: WorkspaceInvitation[]
  loading: boolean

  setCurrentWorkspace: (workspace: Workspace | null) => void
  createWorkspace: (name: string) => Promise<{ error: any } | { error: null, workspace: Workspace }>
  updateWorkspace: (id: string, name: string) => Promise<{ error: any }>
  deleteWorkspace: (id: string) => Promise<{ error: any }>

  inviteUser: (workspaceId: string, email: string, permissions: WorkspacePermissions) => Promise<{ error: any }>
  updateMemberPermissions: (memberId: string, permissions: WorkspacePermissions) => Promise<{ error: any }>
  removeMember: (memberId: string) => Promise<{ error: any }>

  acceptInvitation: (invitationId: string) => Promise<{ error: any }>
  rejectInvitation: (invitationId: string) => Promise<{ error: any }>

  fetchAll: () => Promise<void>
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined)

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null)
  const [members, setMembers] = useState<WorkspaceMember[]>([])
  const [invitations, setInvitations] = useState<WorkspaceInvitation[]>([])
  const [loading, setLoading] = useState(true)

  const fetchAll = useCallback(async () => {
    if (!user) {
      console.log('🏢 [useWorkspace] No user, skipping fetch')
      return
    }

    console.log('🏢 [useWorkspace] Fetching all workspace data for user:', user.uid)
    setLoading(true)

    try {
      // 1. Fetch workspaces owned by user
      const workspacesRef = collection(db, 'workspaces')
      const workspacesQuery = query(workspacesRef, where('owner_id', '==', user.uid))
      const workspacesSnap = await getDocs(workspacesQuery)

      const ownedWorkspaces = workspacesSnap.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name,
        owner_id: doc.data().owner_id,
        created_at: doc.data().created_at instanceof Timestamp
          ? doc.data().created_at.toDate().toISOString()
          : doc.data().created_at
      })) as Workspace[]

      // 2. Fetch workspace memberships (workspaces where user is a member)
      const membersRef = collection(db, 'workspace_members')
      // Buscamos documentos donde user_id sea el actual
      // NOTA: Para que esto funcione rápido, Firebase podría pedir un índice compuesto.
      const membersQuery = query(membersRef, where('user_id', '==', user.uid))
      const membersSnap = await getDocs(membersQuery)

      // Get unique workspace IDs from memberships
      const memberWorkspaceIds = new Set(membersSnap.docs.map(doc => doc.data().workspace_id))

      // Fetch those workspaces (only if not already in ownedWorkspaces)
      const memberWorkspaces: Workspace[] = []
      for (const wsId of Array.from(memberWorkspaceIds)) {
        // Evitar duplicados si soy dueño y también tengo ficha de miembro (que ahora la tendré)
        if (ownedWorkspaces.find(w => w.id === wsId)) continue;

        const wsRef = doc(db, 'workspaces', wsId)
        // Usamos getDoc o query por ID
        const wsSnap = await getDocs(query(collection(db, 'workspaces'), where('__name__', '==', wsId)))
        wsSnap.docs.forEach(d => {
          memberWorkspaces.push({
            id: d.id,
            name: d.data().name,
            owner_id: d.data().owner_id,
            created_at: d.data().created_at instanceof Timestamp
              ? d.data().created_at.toDate().toISOString()
              : d.data().created_at
          })
        })
      }

      // Combine and deduplicate workspaces
      const allWorkspaces = [...ownedWorkspaces, ...memberWorkspaces]
      // Map para asegurar unicidad por ID
      const uniqueWorkspaces = Array.from(new Map(allWorkspaces.map(w => [w.id, w])).values())

      setWorkspaces(uniqueWorkspaces)

      // 3. Fetch members for current workspace
      if (currentWorkspace) {
        const currentMembersQuery = query(
          collection(db, 'workspace_members'),
          where('workspace_id', '==', currentWorkspace.id)
        )
        const currentMembersSnap = await getDocs(currentMembersQuery)
        const membersData = currentMembersSnap.docs.map(doc => ({
          id: doc.id,
          workspace_id: doc.data().workspace_id,
          user_id: doc.data().user_id,
          user_email: doc.data().user_email,
          permissions: doc.data().permissions,
          created_at: doc.data().created_at instanceof Timestamp
            ? doc.data().created_at.toDate().toISOString()
            : doc.data().created_at
        })) as WorkspaceMember[]

        setMembers(membersData)
      }

      // 4. Fetch invitations for user
      const invitationsRef = collection(db, 'workspace_invitations')
      const invitationsQuery = query(
        invitationsRef,
        where('email', '==', user.email),
        where('status', '==', 'pending')
      )
      const invitationsSnap = await getDocs(invitationsQuery)
      const invitationsData = invitationsSnap.docs.map(doc => ({
        id: doc.id,
        workspace_id: doc.data().workspace_id,
        email: doc.data().email,
        permissions: doc.data().permissions,
        status: doc.data().status,
        created_at: doc.data().created_at instanceof Timestamp
          ? doc.data().created_at.toDate().toISOString()
          : doc.data().created_at
      })) as WorkspaceInvitation[]

      setInvitations(invitationsData)
      setLoading(false)

    } catch (error) {
      console.error('🏢 [useWorkspace] Error fetching data:', error)
      setLoading(false)
    }
  }, [user, currentWorkspace])

  useEffect(() => {
    if (user) {
      fetchAll()
    } else {
      setWorkspaces([])
      setCurrentWorkspace(null)
      setMembers([])
      setInvitations([])
      setLoading(false)
    }
  }, [user])

  const createWorkspace = useCallback(async (name: string) => {
    if (!user) {
      return { error: new Error('No user') }
    }

    // 1. VALIDACIÓN DE LÍMITE (Máximo 2 propios + Personal)
    const misWorkspaces = workspaces.filter(w => w.owner_id === user.uid)
    if (misWorkspaces.length >= 2) {
      return { error: new Error('Has alcanzado el límite de 2 espacios compartidos.') }
    }

    console.log('🏢 [useWorkspace] Creating workspace:', name)

    try {
      // 2. Crear el documento del Workspace
      const workspacesRef = collection(db, 'workspaces')
      const docRef = await addDoc(workspacesRef, {
        name,
        owner_id: user.uid,
        created_at: serverTimestamp()
      })

      // 3. CORRECCIÓN CRÍTICA: Crear la ficha de MIEMBRO para el dueño
      // Usamos setDoc con el ID compuesto (workspaceId_userId) para cumplir las reglas
      const memberId = `${docRef.id}_${user.uid}`
      await setDoc(doc(db, 'workspace_members', memberId), {
        workspace_id: docRef.id,
        user_id: user.uid,
        user_email: user.email,
        permissions: { 
          gastos: 'admin', 
          ingresos: 'admin', 
          ahorros: 'admin', 
          tarjetas: 'admin' 
        },
        created_at: serverTimestamp()
      })

      const newWorkspace: Workspace = {
        id: docRef.id,
        name,
        owner_id: user.uid,
        created_at: new Date().toISOString()
      }

      await fetchAll()
      
      // Opcional: Cambiar al nuevo workspace automáticamente
      setCurrentWorkspace(newWorkspace)

      console.log('🏢 [useWorkspace] Workspace created and owner member added:', docRef.id)
      return { error: null, workspace: newWorkspace }
    } catch (error) {
      console.error('🏢 [useWorkspace] Error creating workspace:', error)
      return { error }
    }
  }, [user, fetchAll, workspaces]) // Agregamos 'workspaces' a dependencias para el conteo

  const updateWorkspace = useCallback(async (id: string, name: string) => {
    if (!user) return { error: new Error('No user') }

    console.log('🏢 [useWorkspace] Updating workspace:', id)

    try {
      const workspaceRef = doc(db, 'workspaces', id)
      await updateDoc(workspaceRef, { name })
      await fetchAll()
      return { error: null }
    } catch (error) {
      console.error('🏢 [useWorkspace] Error updating workspace:', error)
      return { error }
    }
  }, [user, fetchAll])

  const deleteWorkspace = useCallback(async (id: string) => {
    if (!user) return { error: new Error('No user') }

    console.log('🏢 [useWorkspace] Deleting workspace:', id)

    try {
      // Nota: Idealmente deberías borrar también los miembros y datos asociados
      // o usar una Cloud Function para limpieza en cascada.
      const workspaceRef = doc(db, 'workspaces', id)
      await deleteDoc(workspaceRef)

      if (currentWorkspace?.id === id) {
        setCurrentWorkspace(null)
      }

      await fetchAll()
      return { error: null }
    } catch (error) {
      console.error('🏢 [useWorkspace] Error deleting workspace:', error)
      return { error }
    }
  }, [user, currentWorkspace, fetchAll])

  const inviteUser = useCallback(async (workspaceId: string, email: string, permissions: WorkspacePermissions) => {
    if (!user) return { error: new Error('No user') }

    console.log('🏢 [useWorkspace] Inviting user:', email, 'to workspace:', workspaceId)

    try {
      const workspace = workspaces.find(w => w.id === workspaceId)
      const workspaceName = workspace?.name || 'Workspace'

      const invitationsRef = collection(db, 'workspace_invitations')
      await addDoc(invitationsRef, {
        workspace_id: workspaceId,
        email,
        permissions,
        status: 'pending',
        created_at: serverTimestamp()
      })

      const mailRef = collection(db, 'mail')
      await addDoc(mailRef, {
        to: email,
        message: {
          subject: `Invitación a ${workspaceName} - FinControl`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2 style="color: #6366f1;">¡Te invitaron a colaborar!</h2>
              <p>Has sido invitado a colaborar en <strong>${workspaceName}</strong> en FinControl.</p>
              <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <h3 style="margin-top: 0; color: #4b5563;">Permisos asignados:</h3>
                <ul style="color: #6b7280;">
                  <li>💰 Gastos: <strong>${permissions.gastos}</strong></li>
                  <li>💵 Ingresos: <strong>${permissions.ingresos}</strong></li>
                  <li>🏦 Ahorros: <strong>${permissions.ahorros}</strong></li>
                  <li>💳 Tarjetas: <strong>${permissions.tarjetas}</strong></li>
                </ul>
              </div>
              <p><strong>Para aceptar la invitación:</strong></p>
              <ol style="color: #6b7280;">
                <li>Inicia sesión en FinControl con este email: <strong>${email}</strong></li>
                <li>Ve a la página de Configuración</li>
                <li>Verás la invitación pendiente y podrás aceptarla</li>
              </ol>
            </div>
          `,
          text: `Te invitaron a colaborar en ${workspaceName}. Entra a la app para aceptar.`
        }
      })

      await fetchAll()
      console.log('🏢 [useWorkspace] Invitation sent')
      return { error: null }
    } catch (error) {
      console.error('🏢 [useWorkspace] Error sending invitation:', error)
      return { error }
    }
  }, [user, workspaces, fetchAll])

  const updateMemberPermissions = useCallback(async (memberId: string, permissions: WorkspacePermissions) => {
    if (!user) return { error: new Error('No user') }

    try {
      const memberRef = doc(db, 'workspace_members', memberId)
      await updateDoc(memberRef, { permissions })
      await fetchAll()
      return { error: null }
    } catch (error) {
      return { error }
    }
  }, [user, fetchAll])

  const removeMember = useCallback(async (memberId: string) => {
    if (!user) return { error: new Error('No user') }

    try {
      const memberRef = doc(db, 'workspace_members', memberId)
      await deleteDoc(memberRef)
      await fetchAll()
      return { error: null }
    } catch (error) {
      return { error }
    }
  }, [user, fetchAll])

  const acceptInvitation = useCallback(async (invitationId: string) => {
    if (!user) return { error: new Error('No user') }

    console.log('🏢 [useWorkspace] Accepting invitation:', invitationId)

    try {
      const invitation = invitations.find(i => i.id === invitationId)
      if (!invitation) return { error: new Error('Invitation not found') }

      // CRÍTICO: Usar ID compuesto para cumplir con las reglas de seguridad
      const memberId = `${invitation.workspace_id}_${user.uid}`
      const memberRef = doc(db, 'workspace_members', memberId)
      
      await setDoc(memberRef, {
        workspace_id: invitation.workspace_id,
        user_id: user.uid,
        user_email: user.email,
        permissions: invitation.permissions,
        created_at: serverTimestamp()
      })

      const invitationRef = doc(db, 'workspace_invitations', invitationId)
      await updateDoc(invitationRef, { status: 'accepted' })

      await fetchAll()
      return { error: null }
    } catch (error) {
      console.error('🏢 [useWorkspace] Error accepting invitation:', error)
      return { error }
    }
  }, [user, invitations, fetchAll])

  const rejectInvitation = useCallback(async (invitationId: string) => {
    if (!user) return { error: new Error('No user') }

    try {
      const invitationRef = doc(db, 'workspace_invitations', invitationId)
      await updateDoc(invitationRef, { status: 'rejected' })
      await fetchAll()
      return { error: null }
    } catch (error) {
      return { error }
    }
  }, [user, fetchAll])

  const value: WorkspaceContextType = {
    workspaces,
    currentWorkspace,
    members,
    invitations,
    loading,
    setCurrentWorkspace,
    createWorkspace,
    updateWorkspace,
    deleteWorkspace,
    inviteUser,
    updateMemberPermissions,
    removeMember,
    acceptInvitation,
    rejectInvitation,
    fetchAll
  }

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  )
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext)
  if (context === undefined) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider')
  }
  return context
}
