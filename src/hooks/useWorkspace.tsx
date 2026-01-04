'use client'

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { useAuth } from './useAuth'
import { db } from '@/lib/firebase'
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  getDocs,
  serverTimestamp,
  Timestamp,
  or
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
      // Fetch workspaces owned by user
      const workspacesRef = collection(db, 'workspaces')
      const workspacesQuery = query(workspacesRef, where('owner_id', '==', user.uid))
      const workspacesSnap = await getDocs(workspacesQuery)

      const workspacesData = workspacesSnap.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name,
        owner_id: doc.data().owner_id,
        created_at: doc.data().created_at instanceof Timestamp
          ? doc.data().created_at.toDate().toISOString()
          : doc.data().created_at
      })) as Workspace[]

      console.log('🏢 [useWorkspace] Workspaces owned:', workspacesData.length)

      // Fetch workspace memberships (workspaces where user is a member)
      const membersRef = collection(db, 'workspace_members')
      const membersQuery = query(membersRef, where('user_id', '==', user.uid))
      const membersSnap = await getDocs(membersQuery)

      // Get unique workspace IDs from memberships
      const memberWorkspaceIds = new Set(membersSnap.docs.map(doc => doc.data().workspace_id))

      // Fetch those workspaces
      const memberWorkspaces: Workspace[] = []
      for (const wsId of memberWorkspaceIds) {
        const wsRef = doc(db, 'workspaces', wsId)
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

      console.log('🏢 [useWorkspace] Workspaces as member:', memberWorkspaces.length)

      // Combine and deduplicate workspaces
      const allWorkspaces = [...workspacesData, ...memberWorkspaces]
      const uniqueWorkspaces = Array.from(new Map(allWorkspaces.map(w => [w.id, w])).values())

      setWorkspaces(uniqueWorkspaces)

      // Set current workspace if not set
      if (!currentWorkspace && uniqueWorkspaces.length > 0) {
        setCurrentWorkspace(uniqueWorkspaces[0])
      }

      // Fetch members for current workspace
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
        console.log('🏢 [useWorkspace] Members:', membersData.length)
      }

      // Fetch invitations for user
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
      console.log('🏢 [useWorkspace] Pending invitations:', invitationsData.length)

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

    console.log('🏢 [useWorkspace] Creating workspace:', name)

    try {
      const workspacesRef = collection(db, 'workspaces')
      const docRef = await addDoc(workspacesRef, {
        name,
        owner_id: user.uid,
        created_at: serverTimestamp()
      })

      const newWorkspace: Workspace = {
        id: docRef.id,
        name,
        owner_id: user.uid,
        created_at: new Date().toISOString()
      }

      await fetchAll()

      console.log('🏢 [useWorkspace] Workspace created:', docRef.id)
      return { error: null, workspace: newWorkspace }
    } catch (error) {
      console.error('🏢 [useWorkspace] Error creating workspace:', error)
      return { error }
    }
  }, [user, fetchAll])

  const updateWorkspace = useCallback(async (id: string, name: string) => {
    if (!user) {
      return { error: new Error('No user') }
    }

    console.log('🏢 [useWorkspace] Updating workspace:', id)

    try {
      const workspaceRef = doc(db, 'workspaces', id)
      await updateDoc(workspaceRef, { name })

      await fetchAll()

      console.log('🏢 [useWorkspace] Workspace updated')
      return { error: null }
    } catch (error) {
      console.error('🏢 [useWorkspace] Error updating workspace:', error)
      return { error }
    }
  }, [user, fetchAll])

  const deleteWorkspace = useCallback(async (id: string) => {
    if (!user) {
      return { error: new Error('No user') }
    }

    console.log('🏢 [useWorkspace] Deleting workspace:', id)

    try {
      const workspaceRef = doc(db, 'workspaces', id)
      await deleteDoc(workspaceRef)

      if (currentWorkspace?.id === id) {
        setCurrentWorkspace(null)
      }

      await fetchAll()

      console.log('🏢 [useWorkspace] Workspace deleted')
      return { error: null }
    } catch (error) {
      console.error('🏢 [useWorkspace] Error deleting workspace:', error)
      return { error }
    }
  }, [user, currentWorkspace, fetchAll])

  const inviteUser = useCallback(async (workspaceId: string, email: string, permissions: WorkspacePermissions) => {
    if (!user) {
      return { error: new Error('No user') }
    }

    console.log('🏢 [useWorkspace] Inviting user:', email, 'to workspace:', workspaceId)

    try {
      const invitationsRef = collection(db, 'workspace_invitations')
      await addDoc(invitationsRef, {
        workspace_id: workspaceId,
        email,
        permissions,
        status: 'pending',
        created_at: serverTimestamp()
      })

      await fetchAll()

      console.log('🏢 [useWorkspace] Invitation sent')
      return { error: null }
    } catch (error) {
      console.error('🏢 [useWorkspace] Error sending invitation:', error)
      return { error }
    }
  }, [user, fetchAll])

  const updateMemberPermissions = useCallback(async (memberId: string, permissions: WorkspacePermissions) => {
    if (!user) {
      return { error: new Error('No user') }
    }

    console.log('🏢 [useWorkspace] Updating member permissions:', memberId)

    try {
      const memberRef = doc(db, 'workspace_members', memberId)
      await updateDoc(memberRef, { permissions })

      await fetchAll()

      console.log('🏢 [useWorkspace] Member permissions updated')
      return { error: null }
    } catch (error) {
      console.error('🏢 [useWorkspace] Error updating permissions:', error)
      return { error }
    }
  }, [user, fetchAll])

  const removeMember = useCallback(async (memberId: string) => {
    if (!user) {
      return { error: new Error('No user') }
    }

    console.log('🏢 [useWorkspace] Removing member:', memberId)

    try {
      const memberRef = doc(db, 'workspace_members', memberId)
      await deleteDoc(memberRef)

      await fetchAll()

      console.log('🏢 [useWorkspace] Member removed')
      return { error: null }
    } catch (error) {
      console.error('🏢 [useWorkspace] Error removing member:', error)
      return { error }
    }
  }, [user, fetchAll])

  const acceptInvitation = useCallback(async (invitationId: string) => {
    if (!user) {
      return { error: new Error('No user') }
    }

    console.log('🏢 [useWorkspace] Accepting invitation:', invitationId)

    try {
      const invitation = invitations.find(i => i.id === invitationId)
      if (!invitation) {
        return { error: new Error('Invitation not found') }
      }

      // Create workspace member
      const membersRef = collection(db, 'workspace_members')
      await addDoc(membersRef, {
        workspace_id: invitation.workspace_id,
        user_id: user.uid,
        user_email: user.email,
        permissions: invitation.permissions,
        created_at: serverTimestamp()
      })

      // Update invitation status
      const invitationRef = doc(db, 'workspace_invitations', invitationId)
      await updateDoc(invitationRef, { status: 'accepted' })

      await fetchAll()

      console.log('🏢 [useWorkspace] Invitation accepted')
      return { error: null }
    } catch (error) {
      console.error('🏢 [useWorkspace] Error accepting invitation:', error)
      return { error }
    }
  }, [user, invitations, fetchAll])

  const rejectInvitation = useCallback(async (invitationId: string) => {
    if (!user) {
      return { error: new Error('No user') }
    }

    console.log('🏢 [useWorkspace] Rejecting invitation:', invitationId)

    try {
      const invitationRef = doc(db, 'workspace_invitations', invitationId)
      await updateDoc(invitationRef, { status: 'rejected' })

      await fetchAll()

      console.log('🏢 [useWorkspace] Invitation rejected')
      return { error: null }
    } catch (error) {
      console.error('🏢 [useWorkspace] Error rejecting invitation:', error)
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
