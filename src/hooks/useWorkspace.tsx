'use client'

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { useAuth } from './useAuth'
import { db } from '@/lib/firebase'
import {
  collection,
  addDoc,
  setDoc,
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
      setLoading(false)
      return
    }

    try {
      // 1. Mis workspaces (Dueño)
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

      // 2. Workspaces donde soy miembro
      const membersRef = collection(db, 'workspace_members')
      const membersQuery = query(membersRef, where('user_id', '==', user.uid))
      const membersSnap = await getDocs(membersQuery)
      
      const memberWorkspaceIds = new Set(membersSnap.docs.map(doc => doc.data().workspace_id))
      const memberWorkspaces: Workspace[] = []

      for (const wsId of Array.from(memberWorkspaceIds)) {
        if (ownedWorkspaces.find(w => w.id === wsId)) continue; // Evitar duplicados

        try {
            // Usamos getDocs con query por ID para evitar error si el doc no existe
            const wsSnap = await getDocs(query(collection(db, 'workspaces'), where('__name__', '==', wsId)))
            if (!wsSnap.empty) {
                const d = wsSnap.docs[0]
                memberWorkspaces.push({
                    id: d.id,
                    name: d.data().name,
                    owner_id: d.data().owner_id,
                    created_at: d.data().created_at instanceof Timestamp 
                      ? d.data().created_at.toDate().toISOString() 
                      : d.data().created_at
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

      // 3. Cargar MIEMBROS de TODOS los workspaces cargados
      // (Esto arregla que diga "0 miembros" en la config cuando no estás en ese espacio)
      const workspaceIds = uniqueWorkspaces.map(w => w.id)
      
      if (workspaceIds.length > 0) {
        // Firestore 'in' soporta hasta 10 valores (tienes límite de 3 workspaces, así que OK)
        const allMembersQuery = query(
          collection(db, 'workspace_members'),
          where('workspace_id', 'in', workspaceIds)
        )
        const allMembersSnap = await getDocs(allMembersQuery)
        
        const allMembersData = allMembersSnap.docs.map(doc => ({
          id: doc.id,
          workspace_id: doc.data().workspace_id,
          user_id: doc.data().user_id,
          user_email: doc.data().user_email,
          permissions: doc.data().permissions,
          created_at: doc.data().created_at instanceof Timestamp
            ? doc.data().created_at.toDate().toISOString()
            : doc.data().created_at
        })) as WorkspaceMember[]

        setMembers(allMembersData)
      } else {
        setMembers([])
      }

      // 4. Mis invitaciones pendientes
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

      setLoading(false)
    } catch (error) {
      console.error('🏢 [useWorkspace] Error fetching data:', error)
      setLoading(false)
    }
  }, [user, currentWorkspace])

  useEffect(() => {
    if (user) fetchAll()
    else {
      setWorkspaces([])
      setCurrentWorkspace(null)
      setMembers([])
      setInvitations([])
      setLoading(false)
    }
  }, [user]) // Eliminamos currentWorkspace de dependencias para evitar loops infinitos, fetchAll ya lo maneja

  const createWorkspace = useCallback(async (name: string) => {
    if (!user) return { error: new Error('No user') }

    const misWorkspaces = workspaces.filter(w => w.owner_id === user.uid)
    if (misWorkspaces.length >= 2) return { error: new Error('Límite de espacios alcanzado') }

    try {
      const workspacesRef = collection(db, 'workspaces')
      const docRef = await addDoc(workspacesRef, {
        name,
        owner_id: user.uid,
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

      const newWorkspace = { 
        id: docRef.id, 
        name, 
        owner_id: user.uid, 
        created_at: new Date().toISOString() 
      }
      
      await fetchAll() // Recargar todo para asegurar consistencia
      setCurrentWorkspace(newWorkspace) 
      
      return { error: null, workspace: newWorkspace }
    } catch (error) {
      return { error }
    }
  }, [user, workspaces, fetchAll])

  const inviteUser = useCallback(async (workspaceId: string, email: string, permissions: WorkspacePermissions) => {
    if (!user) return { error: new Error('No user') }

    try {
      // VALIDACIÓN: Verificar si ya existe una invitación pendiente
      const existingQuery = query(
        collection(db, 'workspace_invitations'),
        where('workspace_id', '==', workspaceId),
        where('email', '==', email),
        where('status', '==', 'pending')
      )
      const existingSnap = await getDocs(existingQuery)
      if (!existingSnap.empty) {
        return { error: new Error('Ya existe una invitación pendiente para este usuario.') }
      }

      // VALIDACIÓN: Verificar si ya es miembro
      const memberId = `${workspaceId}_${user.uid}` // Nota: Esto chequea al usuario actual, idealmente chequeariamos si el email ya es miembro
      // Por simplicidad en frontend confiamos en la UI, pero el backend/reglas deben proteger.

      const workspace = workspaces.find(w => w.id === workspaceId)
      const workspaceName = workspace?.name || 'Workspace'
      
      await addDoc(collection(db, 'workspace_invitations'), {
        workspace_id: workspaceId,
        email,
        permissions,
        status: 'pending',
        created_at: serverTimestamp()
      })

      // Enviar email (simulado/extension)
      await addDoc(collection(db, 'mail'), {
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

              <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #9ca3af; font-size: 12px;">
                <p>Este es un email automático de FinControl. Si no esperabas esta invitación, puedes ignorar este mensaje.</p>
              </div>
            </div>
          `,
          text: `Te invitaron a colaborar en ${workspaceName}. Entra a la app para aceptar.`
        }
      })

      return { error: null }
    } catch (error) {
      console.error(error)
      return { error }
    }
  }, [user, workspaces])

  const updateWorkspace = useCallback(async (id: string, name: string) => {
    try { await updateDoc(doc(db, 'workspaces', id), { name }); await fetchAll(); return { error: null } } catch (e) { return { error: e } }
  }, [fetchAll])

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

  const removeMember = useCallback(async (mid: string) => {
    try { await deleteDoc(doc(db, 'workspace_members', mid)); await fetchAll(); return { error: null } } catch (e) { return { error: e } }
  }, [fetchAll])

  const acceptInvitation = useCallback(async (invitationId: string) => {
    if (!user) return { error: new Error('No user') }
    try {
      const invitation = invitations.find(i => i.id === invitationId)
      if (!invitation) return { error: new Error('Invitation not found') }

      // CRÍTICO: Usar ID compuesto para cumplir con las reglas de seguridad
      const memberId = `${invitation.workspace_id}_${user.uid}`
      await setDoc(doc(db, 'workspace_members', memberId), {
        workspace_id: invitation.workspace_id,
        user_id: user.uid,
        user_email: user.email,
        permissions: invitation.permissions,
        created_at: serverTimestamp()
      })

      await updateDoc(doc(db, 'workspace_invitations', invitationId), { status: 'accepted' })
      await fetchAll()
      return { error: null }
    } catch (error) { return { error } }
  }, [user, invitations, fetchAll])

  const rejectInvitation = useCallback(async (invitationId: string) => {
    try { 
        await updateDoc(doc(db, 'workspace_invitations', invitationId), { status: 'rejected' })
        await fetchAll()
        return { error: null } 
    } catch (e) { return { error: e } }
  }, [fetchAll])

  const value = {
    workspaces, currentWorkspace, members, invitations, loading,
    setCurrentWorkspace, createWorkspace, updateWorkspace, deleteWorkspace,
    inviteUser, updateMemberPermissions, removeMember, acceptInvitation, rejectInvitation, fetchAll
  }

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext)
  if (context === undefined) throw new Error('useWorkspace must be used within a WorkspaceProvider')
  return context
}
