'use client'

import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react'
import { useAuth } from './useAuth'
import { db } from '@/lib/firebase'
import { getInvitationEmailTemplate } from '@/lib/email-templates'
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
  invitations: WorkspaceInvitation[] // Invitaciones recibidas (pendientes)
  sentInvitations: WorkspaceInvitation[] // Invitaciones enviadas
  loading: boolean

  setCurrentWorkspace: (workspace: Workspace | null) => void
  createWorkspace: (name: string, icono?: string, logo?: string | null) => Promise<{ error: any } | { error: null, workspace: Workspace }>
  updateWorkspace: (id: string, name: string, icono?: string | null, logo?: string | null) => Promise<{ error: any }>
  deleteWorkspace: (id: string) => Promise<{ error: any }>

  inviteUser: (workspaceId: string, email: string, permissions: WorkspacePermissions) => Promise<{ error: any }>
  updateMemberPermissions: (memberId: string, permissions: WorkspacePermissions) => Promise<{ error: any }>
  updateMemberDisplayName: (memberId: string, displayName: string | null) => Promise<{ error: any }>
  removeMember: (memberId: string) => Promise<{ error: any }>

  acceptInvitation: (invitationId: string) => Promise<{ error: any }>
  rejectInvitation: (invitationId: string) => Promise<{ error: any }>
  cancelInvitation: (invitationId: string) => Promise<{ error: any }>
  deleteInvitation: (invitationId: string) => Promise<{ error: any }>
  deleteAllInvitations: (workspaceId: string) => Promise<{ error: any }>

  fetchAll: () => Promise<void>
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined)

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user, profile } = useAuth()
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null)
  const [members, setMembers] = useState<WorkspaceMember[]>([])
  const [invitations, setInvitations] = useState<WorkspaceInvitation[]>([]) // Invitaciones recibidas
  const [sentInvitations, setSentInvitations] = useState<WorkspaceInvitation[]>([]) // Invitaciones enviadas
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
        icono: doc.data().icono || null,
        logo: doc.data().logo || null,
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
                    icono: d.data().icono || null,
                    logo: d.data().logo || null,
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
  }, [user, currentWorkspace])

  useEffect(() => {
    if (user) fetchAll()
    else {
      setWorkspaces([])
      setCurrentWorkspace(null)
      setMembers([])
      setInvitations([])
      setSentInvitations([])
      setLoading(false)
    }
  }, [user, fetchAll]) // Agregamos fetchAll a las dependencias

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

    const misWorkspaces = workspaces.filter(w => w.owner_id === user.uid)
    if (misWorkspaces.length >= 2) return { error: new Error('Límite de espacios alcanzado') }

    try {
      const workspacesRef = collection(db, 'workspaces')
      const docRef = await addDoc(workspacesRef, {
        name,
        owner_id: user.uid,
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

      const newWorkspace = { 
        id: docRef.id, 
        name, 
        owner_id: user.uid,
        icono: icono || null,
        logo: logo || null,
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
      // VALIDACIÓN: Verificar si ya existe una invitación (cualquier estado)
      const existingInvitationQuery = query(
        collection(db, 'workspace_invitations'),
        where('workspace_id', '==', workspaceId),
        where('email', '==', email)
      )
      const existingInvitationSnap = await getDocs(existingInvitationQuery)
      
      if (!existingInvitationSnap.empty) {
        const existingInvitation = existingInvitationSnap.docs[0].data()
        const status = existingInvitation.status
        
        if (status === 'pending') {
          return { error: new Error('Ya existe una invitación pendiente para este email. Puedes cancelarla y volver a invitar.') }
        } else if (status === 'accepted') {
          return { error: new Error('Este usuario ya aceptó una invitación y es miembro del workspace.') }
        } else if (status === 'rejected') {
          return { error: new Error('Este usuario rechazó una invitación anterior. Puedes cancelarla y volver a invitar.') }
        } else if (status === 'cancelled') {
          // Si está cancelada, podemos crear una nueva
        }
      }

      // VALIDACIÓN: Verificar si ya es miembro del workspace
      const membersQuery = query(
        collection(db, 'workspace_members'),
        where('workspace_id', '==', workspaceId)
      )
      const membersSnap = await getDocs(membersQuery)
      const isAlreadyMember = membersSnap.docs.some(doc => doc.data().user_email === email)
      
      if (isAlreadyMember) {
        return { error: new Error('Este email ya es miembro del workspace.') }
      }

      const workspace = workspaces.find(w => w.id === workspaceId)
      const workspaceName = workspace?.name || 'Workspace'
      
      // Crear la invitación con toda la información necesaria
      await addDoc(collection(db, 'workspace_invitations'), {
        workspace_id: workspaceId,
        email,
        inviter_email: user.email, // Email de quien envía la invitación
        workspace_name: workspaceName, // Nombre del workspace
        permissions,
        status: 'pending',
        created_at: serverTimestamp()
      })

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
  }, [user, workspaces])

  const updateWorkspace = useCallback(async (id: string, name: string, icono?: string | null, logo?: string | null) => {
    try { 
      const updateData: { name: string; icono?: string | null; logo?: string | null } = { name }
      if (icono !== undefined) {
        updateData.icono = icono
      }
      if (logo !== undefined) {
        updateData.logo = logo
      }
      await updateDoc(doc(db, 'workspaces', id), updateData)
      await fetchAll()
      return { error: null } 
    } catch (e) { return { error: e } }
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
    try { 
        await updateDoc(doc(db, 'workspace_invitations', invitationId), { status: 'rejected' })
        await fetchAll()
        return { error: null } 
    } catch (e) { return { error: e } }
  }, [fetchAll])

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

  const value = {
    workspaces, currentWorkspace, members, invitations, sentInvitations, loading,
    setCurrentWorkspace, createWorkspace, updateWorkspace, deleteWorkspace,
    inviteUser, updateMemberPermissions, updateMemberDisplayName, removeMember, 
    acceptInvitation, rejectInvitation, cancelInvitation, deleteInvitation, deleteAllInvitations, fetchAll
  }

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext)
  if (context === undefined) throw new Error('useWorkspace must be used within a WorkspaceProvider')
  return context
}
