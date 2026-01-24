'use client'

import { useState, useEffect } from 'react'
import { useData } from '@/hooks/useData'
import { useAuth } from '@/hooks/useAuth'
import { useWorkspace } from '@/hooks/useWorkspace'
import { updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth'
import { auth, db } from '@/lib/firebase'
import { Save, Plus, X, Edit2, Users, Mail, Trash2, Shield, UserCheck, CheckCircle2, HelpCircle, Info, Lock, Eye, EyeOff, Loader2, ChevronDown, ChevronUp, CheckSquare, Square } from 'lucide-react'
import { AlertModal, ConfirmModal } from '@/components/Modal'
import { EmojiPickerField } from '@/components/EmojiPickerField'
import type { WorkspacePermissions } from '@/types'

export default function ConfigPage() {
  const { profile, updateProfile, user } = useAuth()
  const {
    tags, addTag, deleteTag,
    tagsIngresos, addTagIngreso, deleteTagIngreso,
    categorias, addCategoria, updateCategoria, deleteCategoria,
    categoriasIngresos, addCategoriaIngreso, updateCategoriaIngreso, deleteCategoriaIngreso,
  } = useData()
  const {
    workspaces,
    currentWorkspace,
    createWorkspace,
    updateWorkspace,
    updateWorkspaceConfig,
    deleteWorkspace,
    inviteUser,
    members,
    invitations,
    sentInvitations,
    acceptInvitation,
    rejectInvitation,
    cancelInvitation,
    deleteInvitation,
    deleteAllInvitations,
    updateMemberPermissions,
    updateMemberDisplayName,
    removeMember
  } = useWorkspace()

  const [budgetEnabled, setBudgetEnabled] = useState(false)
  const [budgetAmount, setBudgetAmount] = useState('')
  const [budgetCurrency, setBudgetCurrency] = useState<'ARS' | 'USD'>('ARS')
  const [ingresosEnabled, setIngresosEnabled] = useState(false)
  const [newTag, setNewTag] = useState('')
  const [newTagIngreso, setNewTagIngreso] = useState('')
  const [saving, setSaving] = useState(false)
  const [savingIngresos, setSavingIngresos] = useState(false)

  // Nombre Espacio Personal
  const [personalName, setPersonalName] = useState('')
  const [personalIcono, setPersonalIcono] = useState('')
  const [personalLogo, setPersonalLogo] = useState<string | null>(null)

  // Modal states
  const [showAlert, setShowAlert] = useState(false)
  const [alertData, setAlertData] = useState({ title: '', message: '', variant: 'success' as 'success' | 'error' | 'warning' | 'info' })
  
  // Confirm modal states para eliminación
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false)
  const [invitationToDelete, setInvitationToDelete] = useState<{ id: string; email: string } | null>(null)
  const [workspaceToDeleteAll, setWorkspaceToDeleteAll] = useState<string | null>(null)

  // Categoría modal states (gastos)
  const [showCategoriaModal, setShowCategoriaModal] = useState(false)
  const [editingCategoria, setEditingCategoria] = useState<any>(null)
  const [categoriaForm, setCategoriaForm] = useState({ nombre: '', icono: '', color: '#6366f1' })
  
  // Categoría modal states (ingresos)
  const [showCategoriaIngresoModal, setShowCategoriaIngresoModal] = useState(false)
  const [editingCategoriaIngreso, setEditingCategoriaIngreso] = useState<any>(null)
  const [categoriaIngresoForm, setCategoriaIngresoForm] = useState({ nombre: '', icono: '', color: '#10b981' })
  
  // Estados para secciones colapsables
  const [expandedCategoriasEtiquetas, setExpandedCategoriasEtiquetas] = useState(true)
  const [expandedGastos, setExpandedGastos] = useState(false)
  const [expandedIngresos, setExpandedIngresos] = useState(false)
  
  // Estados para selección masiva
  const [selectedCategoriasGastos, setSelectedCategoriasGastos] = useState<Set<string>>(new Set())
  const [selectedCategoriasIngresos, setSelectedCategoriasIngresos] = useState<Set<string>>(new Set())
  const [selectedTagsGastos, setSelectedTagsGastos] = useState<Set<string>>(new Set())
  const [selectedTagsIngresos, setSelectedTagsIngresos] = useState<Set<string>>(new Set())
  
  // Estados para invitaciones del Espacio Personal
  const [showPersonalInviteModal, setShowPersonalInviteModal] = useState(false)
  const [personalInviteEmail, setPersonalInviteEmail] = useState('')
  const [personalInvitePermissions, setPersonalInvitePermissions] = useState<WorkspacePermissions>({
    gastos: 'solo_lectura',
    ingresos: 'solo_lectura',
    ahorros: 'solo_lectura',
    tarjetas: 'solo_lectura'
  })

  // Workspace modal states
  const [showWorkspaceModal, setShowWorkspaceModal] = useState(false)
  const [workspaceName, setWorkspaceName] = useState('')
  const [workspaceIcono, setWorkspaceIcono] = useState('')
  const [workspaceLogo, setWorkspaceLogo] = useState<string | null>(null)
  
  // Invite modal states
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteWorkspaceId, setInviteWorkspaceId] = useState('')
  const [invitePermissions, setInvitePermissions] = useState<WorkspacePermissions>({
    gastos: 'solo_lectura',
    ingresos: 'solo_lectura',
    ahorros: 'solo_lectura',
    tarjetas: 'solo_lectura'
  })

  // Estado para gestión de cambios pendientes en permisos (confirmación)
  const [pendingPermissions, setPendingPermissions] = useState<Record<string, string>>({})
  // Estado para nombres en edición
  const [editingNames, setEditingNames] = useState<Record<string, boolean>>({})
  const [displayNames, setDisplayNames] = useState<Record<string, string>>({})

  // Inicializar displayNames cuando se cargan los miembros
  useEffect(() => {
    const initialDisplayNames: Record<string, string> = {}
    members.forEach(member => {
      if (member.display_name) {
        initialDisplayNames[member.id] = member.display_name
      }
    })
    setDisplayNames(prev => ({ ...prev, ...initialDisplayNames }))
  }, [members])

  const [expandedWorkspaceId, setExpandedWorkspaceId] = useState<string | null>(null)
  const [editingWorkspaceId, setEditingWorkspaceId] = useState<string | null>(null)
  const [editingWorkspaceName, setEditingWorkspaceName] = useState('')
  const [editingPersonal, setEditingPersonal] = useState(false)
  const [editingPersonalName, setEditingPersonalName] = useState('')

  // Cambio de contraseña
  const [showPasswordChange, setShowPasswordChange] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)

  // Inicializar valores según workspace actual o perfil
  useEffect(() => {
    if (currentWorkspace) {
      // Si hay workspace activo, usar su configuración
      const hasArs = (currentWorkspace.budget_ars || 0) > 0
      const hasUsd = (currentWorkspace.budget_usd || 0) > 0
      setBudgetEnabled(hasArs || hasUsd)
      if (hasArs) {
        setBudgetAmount(String(currentWorkspace.budget_ars || ''))
        setBudgetCurrency('ARS')
      } else if (hasUsd) {
        setBudgetAmount(String(currentWorkspace.budget_usd || ''))
        setBudgetCurrency('USD')
      } else {
        setBudgetAmount('')
        setBudgetCurrency('ARS')
      }
      setIngresosEnabled(currentWorkspace.ingresos_habilitado || false)
    } else if (profile) {
      // Si es espacio personal, usar configuración del perfil
      const hasArs = (profile.budget_ars || 0) > 0
      const hasUsd = (profile.budget_usd || 0) > 0
      setBudgetEnabled(hasArs || hasUsd)
      if (hasArs) {
        setBudgetAmount(String(profile.budget_ars || ''))
        setBudgetCurrency('ARS')
      } else if (hasUsd) {
        setBudgetAmount(String(profile.budget_usd || ''))
        setBudgetCurrency('USD')
      } else {
        setBudgetAmount('')
        setBudgetCurrency('ARS')
      }
      setIngresosEnabled(profile.ingresos_habilitado || false)
    }
    
    if (profile) {
      setPersonalName(profile.personal_workspace_name || '')
      setPersonalIcono(profile.personal_workspace_icono || '')
      setPersonalLogo(profile.personal_workspace_logo || null)
    }
  }, [profile, currentWorkspace])

  const fileToDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(new Error('No se pudo leer el archivo'))
      reader.readAsDataURL(file)
    })

  const handleSaveFinancialConfig = async () => {
    setSaving(true)
    
    const newBudgetArs = budgetEnabled && budgetCurrency === 'ARS' ? (parseFloat(budgetAmount) || 0) : 0
    const newBudgetUsd = budgetEnabled && budgetCurrency === 'USD' ? (parseFloat(budgetAmount) || 0) : 0
    
    try {
      if (currentWorkspace) {
        // Actualización optimista: actualizar estado local inmediatamente
        if (currentWorkspace) {
          // Actualizar el workspace actual en el contexto (si existe método para esto)
          // Por ahora, fetchAll() lo hará, pero podemos hacer una actualización optimista visual
        }
        
        // Guardar en workspace
        const result = await updateWorkspaceConfig(currentWorkspace.id, {
          ingresos_habilitado: ingresosEnabled,
          budget_ars: newBudgetArs,
          budget_usd: newBudgetUsd
        })
        
        if (result.error) {
          // Revertir cambios en caso de error
          setAlertData({
            title: 'Error',
            message: 'No se pudo guardar la configuración',
            variant: 'error'
          })
        } else {
          // La actualización ya se reflejó visualmente, solo mostrar mensaje
          setAlertData({
            title: '¡Configuración guardada!',
            message: 'Tu configuración financiera mensual fue actualizada correctamente',
            variant: 'success'
          })
          // fetchAll() ya se llamó en updateWorkspaceConfig, así que el estado está sincronizado
        }
      } else {
        // Guardar en perfil (espacio personal) - updateProfile ya hace actualización optimista
        await updateProfile({
          ingresos_habilitado: ingresosEnabled,
          budget_ars: newBudgetArs,
          budget_usd: newBudgetUsd
        })
        
        // updateProfile ya actualiza el estado local, así que los cambios se ven inmediatamente
        setAlertData({
          title: '¡Configuración guardada!',
          message: 'Tu configuración financiera mensual fue actualizada correctamente',
          variant: 'success'
        })
      }
    } catch (error) {
      setAlertData({
        title: 'Error',
        message: 'No se pudo guardar la configuración',
        variant: 'error'
      })
    }
    
    setSaving(false)
    setShowAlert(true)
  }

  const handleEditPersonal = () => {
    setEditingPersonal(true)
    setEditingPersonalName(personalName)
  }

  const handleSavePersonalName = async () => {
    if (!editingPersonalName.trim()) {
      setAlertData({
        title: 'Nombre requerido',
        message: 'Por favor ingresá un nombre para tu espacio personal',
        variant: 'warning'
      })
      setShowAlert(true)
      return
    }
    setSaving(true)
    await updateProfile({ 
      personal_workspace_name: editingPersonalName,
      personal_workspace_icono: personalIcono || null,
      personal_workspace_logo: personalLogo || null,
    })
    setPersonalName(editingPersonalName)
    setEditingPersonal(false)
    setEditingPersonalName('')
    setSaving(false)
    setAlertData({
      title: 'Nombre actualizado',
      message: 'Tu espacio personal ha sido renombrado.',
      variant: 'success'
    })
    setShowAlert(true)
  }

  const handleCancelEditPersonal = () => {
    setEditingPersonal(false)
    setEditingPersonalName('')
    // Restaurar valores originales del perfil
    if (profile) {
      setPersonalName(profile.personal_workspace_name || '')
      setPersonalIcono(profile.personal_workspace_icono || '')
      setPersonalLogo(profile.personal_workspace_logo || null)
    }
  }


  const handleAddTag = async () => {
    if (!newTag.trim()) return
    await addTag(newTag.trim())
    setNewTag('')
  }

  const handleAddTagIngreso = async () => {
    if (!newTagIngreso.trim()) return
    await addTagIngreso(newTagIngreso.trim())
    setNewTagIngreso('')
  }

  const handleSaveCategoria = async () => {
    if (!categoriaForm.nombre.trim() || !categoriaForm.icono.trim()) {
      setAlertData({
        title: 'Campos incompletos',
        message: 'Por favor completá el nombre y seleccioná un icono',
        variant: 'warning'
      })
      setShowAlert(true)
      return
    }

    if (editingCategoria) {
      await updateCategoria(editingCategoria.id, categoriaForm)
      setAlertData({
        title: '¡Categoría actualizada!',
        message: `La categoría "${categoriaForm.nombre}" fue actualizada correctamente`,
        variant: 'success'
      })
    } else {
      await addCategoria(categoriaForm)
      setAlertData({
        title: '¡Categoría creada!',
        message: `La categoría "${categoriaForm.nombre}" fue creada correctamente`,
        variant: 'success'
      })
    }

    setShowAlert(true)
    setShowCategoriaModal(false)
    setCategoriaForm({ nombre: '', icono: '', color: '#6366f1' })
    setEditingCategoria(null)
  }

  const handleEditCategoria = (cat: any) => {
    setEditingCategoria(cat)
    setCategoriaForm({ nombre: cat.nombre, icono: cat.icono, color: cat.color })
    setShowCategoriaModal(true)
  }

  const handleDeleteCategoria = async (id: string, nombre: string) => {
    await deleteCategoria(id)
    setAlertData({
      title: 'Categoría eliminada',
      message: `La categoría "${nombre}" fue eliminada`,
      variant: 'success'
    })
    setShowAlert(true)
  }

  // Handlers para categorías de ingresos
  const handleSaveCategoriaIngreso = async () => {
    if (!categoriaIngresoForm.nombre.trim() || !categoriaIngresoForm.icono.trim()) {
      setAlertData({
        title: 'Campos incompletos',
        message: 'Por favor completá el nombre y seleccioná un icono',
        variant: 'warning'
      })
      setShowAlert(true)
      return
    }

    if (editingCategoriaIngreso) {
      await updateCategoriaIngreso(editingCategoriaIngreso.id, categoriaIngresoForm)
      setAlertData({
        title: '¡Categoría actualizada!',
        message: `La categoría "${categoriaIngresoForm.nombre}" fue actualizada correctamente`,
        variant: 'success'
      })
    } else {
      await addCategoriaIngreso(categoriaIngresoForm)
      setAlertData({
        title: '¡Categoría creada!',
        message: `La categoría "${categoriaIngresoForm.nombre}" fue creada correctamente`,
        variant: 'success'
      })
    }

    setShowAlert(true)
    setShowCategoriaIngresoModal(false)
    setCategoriaIngresoForm({ nombre: '', icono: '', color: '#10b981' })
    setEditingCategoriaIngreso(null)
  }

  const handleEditCategoriaIngreso = (cat: any) => {
    setEditingCategoriaIngreso(cat)
    setCategoriaIngresoForm({ nombre: cat.nombre, icono: cat.icono, color: cat.color })
    setShowCategoriaIngresoModal(true)
  }

  const handleDeleteCategoriaIngreso = async (id: string, nombre: string) => {
    await deleteCategoriaIngreso(id)
    setAlertData({
      title: 'Categoría eliminada',
      message: `La categoría "${nombre}" fue eliminada`,
      variant: 'success'
    })
    setShowAlert(true)
  }

  // Handlers para eliminación masiva
  const handleDeleteMasivoCategoriasGastos = async () => {
    if (selectedCategoriasGastos.size === 0) return
    
    const promises = Array.from(selectedCategoriasGastos).map(id => deleteCategoria(id))
    await Promise.all(promises)
    
    setAlertData({
      title: 'Categorías eliminadas',
      message: `Se eliminaron ${selectedCategoriasGastos.size} categoría(s) de gastos`,
      variant: 'success'
    })
    setShowAlert(true)
    setSelectedCategoriasGastos(new Set())
  }

  const handleDeleteMasivoCategoriasIngresos = async () => {
    if (selectedCategoriasIngresos.size === 0) return
    
    const promises = Array.from(selectedCategoriasIngresos).map(id => deleteCategoriaIngreso(id))
    await Promise.all(promises)
    
    setAlertData({
      title: 'Categorías eliminadas',
      message: `Se eliminaron ${selectedCategoriasIngresos.size} categoría(s) de ingresos`,
      variant: 'success'
    })
    setShowAlert(true)
    setSelectedCategoriasIngresos(new Set())
  }

  const handleDeleteMasivoTagsGastos = async () => {
    if (selectedTagsGastos.size === 0) return
    
    const promises = Array.from(selectedTagsGastos).map(id => deleteTag(id))
    await Promise.all(promises)
    
    setAlertData({
      title: 'Tags eliminados',
      message: `Se eliminaron ${selectedTagsGastos.size} tag(s) de gastos`,
      variant: 'success'
    })
    setShowAlert(true)
    setSelectedTagsGastos(new Set())
  }

  const handleDeleteMasivoTagsIngresos = async () => {
    if (selectedTagsIngresos.size === 0) return
    
    const promises = Array.from(selectedTagsIngresos).map(id => deleteTagIngreso(id))
    await Promise.all(promises)
    
    setAlertData({
      title: 'Tags eliminados',
      message: `Se eliminaron ${selectedTagsIngresos.size} tag(s) de ingresos`,
      variant: 'success'
    })
    setShowAlert(true)
    setSelectedTagsIngresos(new Set())
  }

  // Handler para invitar al Espacio Personal
  const handleInvitePersonal = async () => {
    if (!personalInviteEmail.trim()) {
      setAlertData({
        title: 'Email requerido',
        message: 'Por favor ingresá un email válido',
        variant: 'warning'
      })
      setShowAlert(true)
      return
    }

    if (personalInviteEmail === user?.email) {
      setAlertData({
        title: 'Email inválido',
        message: 'No podés invitarte a vos mismo',
        variant: 'warning'
      })
      setShowAlert(true)
      return
    }

    // El Espacio Personal necesita un workspace real para funcionar como colaborativo
    // Buscar o crear el primer workspace del usuario (que será el espacio personal)
    let personalWorkspaceId: string | null = null
    
    // Buscar el primer workspace del usuario
    const myWorkspaces = workspaces.filter(w => w.owner_id === user?.uid)
    if (myWorkspaces.length > 0) {
      // Usar el primer workspace como espacio personal
      personalWorkspaceId = myWorkspaces[0].id
    } else {
      // Crear un workspace para el espacio personal si no existe
      const workspaceName = personalName || 'Espacio Personal'
      const result = await createWorkspace(
        workspaceName,
        personalIcono || undefined,
        personalLogo || null
      )
      
      if (result.error) {
        setAlertData({
          title: 'Error',
          message: 'No se pudo crear el workspace para el espacio personal',
          variant: 'error'
        })
        setShowAlert(true)
        setShowPersonalInviteModal(false)
        return
      }
      
      personalWorkspaceId = !result.error && 'workspace' in result && result.workspace
        ? result.workspace.id
        : null
    }

    if (!personalWorkspaceId) {
      setAlertData({
        title: 'Error',
        message: 'No se pudo obtener el workspace del espacio personal',
        variant: 'error'
      })
      setShowAlert(true)
      setShowPersonalInviteModal(false)
      return
    }

    // Usar el mismo sistema de invitación que los workspaces colaborativos
    const result = await inviteUser(personalWorkspaceId, personalInviteEmail, personalInvitePermissions)

    if (result.error) {
      const errorMessage = result.error.message || 'No se pudo enviar la invitación'
      setAlertData({
        title: 'Error',
        message: errorMessage,
        variant: 'error'
      })
    } else {
      setAlertData({
        title: '¡Invitación enviada!',
        message: `Se envió una invitación a ${personalInviteEmail} con los permisos seleccionados.`,
        variant: 'success'
      })
      setPersonalInviteEmail('')
      // Reset permissions to default
      setPersonalInvitePermissions({
        gastos: 'solo_lectura',
        ingresos: 'solo_lectura',
        ahorros: 'solo_lectura',
        tarjetas: 'solo_lectura'
      })
      setShowPersonalInviteModal(false)
    }

    setShowAlert(true)
  }

  // Workspace handlers
  const handleCreateWorkspace = async () => {
    if (!workspaceName.trim()) {
      setAlertData({
        title: 'Nombre requerido',
        message: 'Por favor ingresá un nombre para el workspace',
        variant: 'warning'
      })
      setShowAlert(true)
      return
    }

    const myWorkspacesCount = workspaces.filter(w => w.owner_id === user?.uid).length
    if (myWorkspacesCount >= 2) {
      setAlertData({
        title: 'Límite alcanzado',
        message: 'Ya tenés 2 espacios compartidos creados (el máximo permitido).',
        variant: 'warning'
      })
      setShowAlert(true)
      return
    }

    const result = await createWorkspace(workspaceName, workspaceIcono || undefined, workspaceLogo || null)

    if (result.error) {
      setAlertData({
        title: 'Error',
        message: 'No se pudo crear el workspace',
        variant: 'error'
      })
    } else {
      setAlertData({
        title: '¡Workspace creado!',
        message: `El workspace "${workspaceName}" fue creado correctamente`,
        variant: 'success'
      })
      setWorkspaceName('')
      setWorkspaceIcono('')
      setWorkspaceLogo(null)
      setShowWorkspaceModal(false)
    }

    setShowAlert(true)
  }

  const handleDeleteWorkspace = async (id: string, name: string) => {
    if (confirm(`¿Estás seguro de eliminar el espacio "${name}"? ESTA ACCIÓN BORRARÁ TODOS LOS DATOS ASOCIADOS y no se puede deshacer.`)) {
      const result = await deleteWorkspace(id)
      if (result.error) {
         setAlertData({
            title: 'Error',
            message: 'No se pudo eliminar el workspace.',
            variant: 'error'
          })
      } else {
         setAlertData({
            title: 'Workspace eliminado',
            message: `El espacio "${name}" fue eliminado correctamente.`,
            variant: 'success'
          })
      }
      setShowAlert(true)
    }
  }

  const handleInviteUser = async () => {
    if (!inviteEmail.trim()) {
      setAlertData({
        title: 'Email requerido',
        message: 'Por favor ingresá un email válido',
        variant: 'warning'
      })
      setShowAlert(true)
      return
    }

    if (inviteEmail === user?.email) {
      setAlertData({
        title: 'Email inválido',
        message: 'No podés invitarte a vos mismo',
        variant: 'warning'
      })
      setShowAlert(true)
      return
    }

    const result = await inviteUser(inviteWorkspaceId, inviteEmail, invitePermissions)

    if (result.error) {
      const errorMessage = result.error.message || 'No se pudo enviar la invitación'
      setAlertData({
        title: 'Error',
        message: errorMessage,
        variant: 'error'
      })
    } else {
      setAlertData({
        title: '¡Invitación enviada!',
        message: `Se envió una invitación a ${inviteEmail} con los permisos seleccionados.`,
        variant: 'success'
      })
      setInviteEmail('')
      // Reset permissions to default
      setInvitePermissions({
        gastos: 'solo_lectura',
        ingresos: 'solo_lectura',
        ahorros: 'solo_lectura',
        tarjetas: 'solo_lectura'
      })
      setShowInviteModal(false)
    }

    setShowAlert(true)
  }

  const handleAcceptInvitation = async (id: string) => {
    const result = await acceptInvitation(id)

    if (result.error) {
      setAlertData({
        title: 'Error',
        message: 'No se pudo aceptar la invitación',
        variant: 'error'
      })
    } else {
      setAlertData({
        title: '¡Invitación aceptada!',
        message: 'Ahora tenés acceso al workspace',
        variant: 'success'
      })
    }

    setShowAlert(true)
  }

  const handleRejectInvitation = async (id: string) => {
    const result = await rejectInvitation(id)

    if (result.error) {
      setAlertData({
        title: 'Error',
        message: 'No se pudo rechazar la invitación',
        variant: 'error'
      })
    } else {
      setAlertData({
        title: 'Invitación rechazada',
        message: 'La invitación fue rechazada',
        variant: 'success'
      })
    }

    setShowAlert(true)
  }

  const handleSaveDisplayName = async (memberId: string, displayName: string) => {
    const result = await updateMemberDisplayName(memberId, displayName.trim() || null)
    
    if (result.error) {
      setAlertData({
        title: 'Error',
        message: 'No se pudo actualizar el nombre',
        variant: 'error'
      })
      setShowAlert(true)
    } else {
      setEditingNames(prev => ({ ...prev, [memberId]: false }))
      setDisplayNames(prev => ({ ...prev, [memberId]: displayName.trim() || '' }))
    }
  }

  // --- LÓGICA DE PERMISOS CON CONFIRMACIÓN ---
  const handlePermissionChange = (memberId: string, section: string, newValue: string) => {
    // Usar un separador único que no aparezca en los IDs
    const key = `${memberId}|||${section}`
    console.log('🔍 [Config] handlePermissionChange - memberId:', memberId, 'section:', section, 'key:', key)
    setPendingPermissions(prev => ({
      ...prev,
      [key]: newValue
    }))
  }

  const savePermission = async (memberId: string, section: keyof WorkspacePermissions, member: any) => {
    const newValue = pendingPermissions[`${memberId}_${section}`]
    if (!newValue) return

    const updatedPermissions = {
      ...member.permissions,
      [section]: newValue
    }

    const result = await updateMemberPermissions(memberId, updatedPermissions)

    if (result.error) {
      setAlertData({
        title: 'Error',
        message: 'No se pudieron actualizar los permisos',
        variant: 'error'
      })
      setShowAlert(true)
    } else {
      // Limpiar estado pendiente si fue exitoso
      setPendingPermissions(prev => {
        const newState = { ...prev }
        delete newState[`${memberId}_${section}`]
        return newState
      })
    }
  }

  // Guardar todos los cambios pendientes de permisos de una vez
  const saveAllPendingPermissions = async () => {
    if (Object.keys(pendingPermissions).length === 0) return

    // Agrupar cambios por miembro
    const changesByMember: Record<string, Partial<WorkspacePermissions>> = {}
    
    Object.entries(pendingPermissions).forEach(([key, value]) => {
      // El formato es "memberId|||section"
      const parts = key.split('|||')
      if (parts.length !== 2) {
        console.error('❌ [Config] Formato de key inválido:', key, 'parts:', parts, 'length:', parts.length)
        return
      }
      const [memberId, section] = parts
      if (!memberId || !section) {
        console.error('❌ [Config] Formato de key inválido - memberId o section vacío:', { key, memberId, section, parts })
        return
      }
      console.log('🔍 [Config] Procesando cambio - key:', key, 'memberId:', memberId, 'section:', section, 'value:', value)
      console.log('🔍 [Config] Miembros disponibles para comparar:', members.map(m => ({ id: m.id, workspace_id: m.workspace_id, user_id: m.user_id })))
      
      // Verificar que el memberId existe en los miembros
      const memberExists = members.some(m => m.id === memberId)
      if (!memberExists) {
        console.error('❌ [Config] MemberId no encontrado en lista de miembros:', memberId)
        console.error('❌ [Config] IDs disponibles:', members.map(m => m.id))
        return
      }
      
      if (!changesByMember[memberId]) {
        changesByMember[memberId] = {}
      }
      changesByMember[memberId][section as keyof WorkspacePermissions] = value as any
    })
    
    console.log('🔍 [Config] Cambios agrupados por miembro:', changesByMember)
    console.log('🔍 [Config] Total miembros en lista:', members.length)

    // Filtrar solo los cambios válidos (donde el miembro existe)
    const validChanges: Array<{memberId: string, newPermissions: Partial<WorkspacePermissions>}> = []
    Object.entries(changesByMember).forEach(([memberId, newPermissions]) => {
      const member = members.find(m => m.id === memberId)
      if (member) {
        validChanges.push({ memberId, newPermissions })
      } else {
        console.error('❌ [Config] Miembro no encontrado, omitiendo cambios:', memberId)
        console.error('❌ [Config] IDs de miembros disponibles:', members.map(m => m.id))
      }
    })

    if (validChanges.length === 0) {
      setAlertData({
        title: 'Error',
        message: 'No se encontraron miembros válidos para actualizar. Por favor recargá la página.',
        variant: 'error'
      })
      setShowAlert(true)
      return
    }

    // Aplicar todos los cambios válidos
    const promises = validChanges.map(async ({ memberId, newPermissions }) => {
      try {
        console.log('🔍 [Config] Actualizando miembro con ID:', memberId)
        const member = members.find(m => m.id === memberId)
        if (!member) {
          console.error('❌ [Config] Miembro no encontrado (esto no debería pasar):', memberId)
          return { error: new Error('Miembro no encontrado') }
        }

        const updatedPermissions = {
          ...member.permissions,
          ...newPermissions
        }

        console.log('💾 [Config] Actualizando permisos para miembro:', {
          memberId,
          memberEmail: member.user_email,
          currentPermissions: member.permissions,
          newPermissions,
          updatedPermissions
        })
        const result = await updateMemberPermissions(memberId, updatedPermissions)
        
        if (result.error) {
          console.error('❌ [Config] Error actualizando permisos:', result.error)
        }
        
        return result
      } catch (error) {
        console.error('❌ [Config] Excepción al actualizar permisos:', error)
        return { error: error instanceof Error ? error : new Error('Error desconocido') }
      }
    })

    const results = await Promise.all(promises)
    const errors = results.filter(r => r && r.error)
    const hasError = errors.length > 0

    if (hasError) {
      console.error('❌ [Config] Errores al actualizar permisos:', errors)
      setAlertData({
        title: 'Error',
        message: `${errors.length} de ${results.length} permisos no se pudieron actualizar. Por favor intentá nuevamente.`,
        variant: 'error'
      })
    } else {
      setAlertData({
        title: '¡Permisos actualizados!',
        message: 'Todos los cambios se guardaron correctamente',
        variant: 'success'
      })
      setPendingPermissions({}) // Limpiar todos los cambios pendientes
    }

    setShowAlert(true)
  }

  const handleRemoveMember = async (memberId: string, memberEmail: string) => {
    if (!confirm(`¿Eliminar a ${memberEmail} del workspace?`)) {
      return
    }

    const result = await removeMember(memberId)

    if (result.error) {
      setAlertData({
        title: 'Error',
        message: 'No se pudo eliminar el miembro',
        variant: 'error'
      })
    } else {
      setAlertData({
        title: 'Miembro eliminado',
        message: `${memberEmail} fue eliminado del workspace`,
        variant: 'success'
      })
    }

    setShowAlert(true)
  }

  const handleUpdateMemberName = async (memberId: string, displayName: string | null) => {
    const result = await updateMemberDisplayName(memberId, displayName)
    
    if (result.error) {
      setAlertData({
        title: 'Error',
        message: 'No se pudo actualizar el nombre',
        variant: 'error'
      })
      setShowAlert(true)
    } else {
      setAlertData({
        title: 'Nombre actualizado',
        message: 'El nombre del colaborador se actualizó correctamente',
        variant: 'success'
      })
      setShowAlert(true)
    }
  }

  const handleEditWorkspace = (workspaceId: string, currentName: string, currentIcono?: string | null, currentLogo?: string | null) => {
    setEditingWorkspaceId(workspaceId)
    setEditingWorkspaceName(currentName)
    setWorkspaceIcono(currentIcono || '')
    setWorkspaceLogo(currentLogo || null)
  }

  const handleSaveWorkspaceName = async () => {
    if (!editingWorkspaceId || !editingWorkspaceName.trim()) {
      return
    }

    const result = await updateWorkspace(editingWorkspaceId, editingWorkspaceName, workspaceIcono || null, workspaceLogo || null)

    if (result.error) {
      setAlertData({
        title: 'Error',
        message: 'No se pudo actualizar el workspace',
        variant: 'error'
      })
    } else {
      setAlertData({
        title: 'Workspace actualizado',
        message: 'El workspace fue actualizado exitosamente',
        variant: 'success'
      })
      setEditingWorkspaceId(null)
      setEditingWorkspaceName('')
      setWorkspaceIcono('')
      setWorkspaceLogo(null)
    }

    setShowAlert(true)
  }

  const handleCancelEditWorkspace = () => {
    setEditingWorkspaceId(null)
    setEditingWorkspaceName('')
    setWorkspaceIcono('')
    setWorkspaceLogo(null)
  }

  const handleChangePassword = async () => {
    if (!user || !user.email) {
      setAlertData({
        title: 'Error',
        message: 'No se pudo identificar tu usuario',
        variant: 'error'
      })
      setShowAlert(true)
      return
    }

    if (!currentPassword || !newPassword || !confirmNewPassword) {
      setAlertData({
        title: 'Campos incompletos',
        message: 'Por favor completá todos los campos',
        variant: 'warning'
      })
      setShowAlert(true)
      return
    }

    if (newPassword.length < 6) {
      setAlertData({
        title: 'Contraseña muy corta',
        message: 'La contraseña debe tener al menos 6 caracteres',
        variant: 'warning'
      })
      setShowAlert(true)
      return
    }

    if (newPassword !== confirmNewPassword) {
      setAlertData({
        title: 'Contraseñas no coinciden',
        message: 'Las contraseñas nuevas no coinciden',
        variant: 'warning'
      })
      setShowAlert(true)
      return
    }

    setChangingPassword(true)
    try {
      // Reautenticar con la contraseña actual
      const credential = EmailAuthProvider.credential(user.email, currentPassword)
      await reauthenticateWithCredential(user, credential)

      // Actualizar la contraseña
      await updatePassword(user, newPassword)

      setAlertData({
        title: '¡Contraseña actualizada!',
        message: 'Tu contraseña fue cambiada exitosamente',
        variant: 'success'
      })
      setShowAlert(true)
      
      // Limpiar formulario
      setCurrentPassword('')
      setNewPassword('')
      setConfirmNewPassword('')
      setShowPasswordChange(false)
    } catch (error: any) {
      console.error('Error cambiando contraseña:', error)
      let errorMessage = 'Error al cambiar la contraseña'
      
      if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        errorMessage = 'La contraseña actual es incorrecta'
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'La contraseña es muy débil. Debe tener al menos 6 caracteres'
      } else if (error.message) {
        errorMessage = error.message
      }

      setAlertData({
        title: 'Error',
        message: errorMessage,
        variant: 'error'
      })
      setShowAlert(true)
    } finally {
      setChangingPassword(false)
    }
  }

  // Permisos disponibles para el selector con explicaciones
  const permissionOptions = [
    { 
      value: 'ninguno', 
      label: 'Sin Acceso',
      description: 'No tiene acceso a esta sección. No puede visualizar ni modificar ningún dato.'
    },
    { 
      value: 'solo_lectura', 
      label: 'Solo Lectura',
      description: 'Puede visualizar todos los datos de la sección, pero no puede crear, modificar ni eliminar registros.'
    },
    { 
      value: 'solo_propios', 
      label: 'Solo Sus Propios Datos',
      description: 'Solo puede visualizar y gestionar los registros que él mismo ha creado. No tiene acceso a los datos de otros colaboradores.'
    },
    { 
      value: 'ver_todo_agregar_propio', 
      label: 'Ver Todo y Agregar Propios',
      description: 'Puede visualizar todos los registros del workspace y crear nuevos, pero solo puede modificar o eliminar los registros que él mismo ha creado.'
    },
    { 
      value: 'admin', 
      label: 'Administrador',
      description: 'Acceso completo a la sección. Puede visualizar, crear, modificar y eliminar cualquier registro, independientemente de quién lo haya creado.'
    },
  ]

  // Función para obtener la descripción de un permiso
  const getPermissionDescription = (value: string) => {
    return permissionOptions.find(opt => opt.value === value)?.description || ''
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="order-0">
        <h1 className="text-2xl font-bold">Configuración</h1>
        <p className="text-slate-500">Personalizá tu experiencia</p>
      </div>

      {/* Espacios de trabajo - Unificado */}
      <div className="card p-5 order-1 mb-8">
        <div className="mb-6">
          <h3 className="font-bold mb-2">🏠 Espacios de trabajo</h3>
          <p className="text-slate-500 text-sm">Gestioná tus finanzas personales y compartidas</p>
        </div>

        {/* Espacio Personal */}
        <div className="mb-6 pb-6 border-b border-slate-200">
          <div className={`rounded-xl p-4 border bg-slate-50 border-slate-200`}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex-1 min-w-0">
                {editingPersonal ? (
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                      <div className="flex items-center gap-2 flex-1">
                        <EmojiPickerField
                          value={personalIcono}
                          onChange={setPersonalIcono}
                          placeholder="🏠"
                          size="sm"
                        />
                        <div className="flex items-center gap-2">
                          <input
                            type="file"
                            accept="image/*"
                            className="input input-sm text-xs"
                            onChange={async (e) => {
                              const file = e.target.files?.[0]
                              if (!file) return
                              const maxBytes = 250 * 1024
                              if (file.size > maxBytes) {
                                setAlertData({
                                  title: 'Imagen muy grande',
                                  message: 'Usá un logo cuadrado liviano (recomendado 256x256 y menos de 250KB).',
                                  variant: 'warning'
                                })
                                setShowAlert(true)
                                e.target.value = ''
                                return
                              }
                              try {
                                const dataUrl = await fileToDataUrl(file)
                                setPersonalLogo(dataUrl)
                              } catch {
                                setAlertData({
                                  title: 'Error',
                                  message: 'No se pudo cargar la imagen',
                                  variant: 'error'
                                })
                                setShowAlert(true)
                              }
                            }}
                          />
                          {personalLogo && (
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm whitespace-nowrap"
                              onClick={() => setPersonalLogo(null)}
                            >
                              Quitar
                            </button>
                          )}
                        </div>
                        <input
                          type="text"
                          value={editingPersonalName}
                          onChange={(e) => setEditingPersonalName(e.target.value)}
                          className="input input-sm flex-1 min-w-0"
                          autoFocus
                          onKeyPress={(e) => e.key === 'Enter' && handleSavePersonalName()}
                          placeholder="Nombre del espacio personal"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button onClick={handleSavePersonalName} disabled={saving} className="btn btn-primary btn-sm flex-1 sm:flex-none">
                          {saving ? 'Guardando...' : 'Guardar'}
                        </button>
                        <button onClick={handleCancelEditPersonal} className="btn btn-secondary btn-sm flex-1 sm:flex-none">
                          Cancelar
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      {personalLogo ? (
                        <>
                          <span>Logo cargado:</span>
                          <img src={personalLogo} alt="Logo" className="w-6 h-6 rounded object-cover border border-slate-200" />
                        </>
                      ) : (
                        <span>Podés elegir un emoji o subir un logo (opcional)</span>
                      )}
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center gap-2">
                      {personalLogo ? (
                        <img src={personalLogo} alt="Logo" className="w-7 h-7 rounded-lg object-cover border border-slate-200" />
                      ) : personalIcono ? (
                        <span className="text-xl">{personalIcono}</span>
                      ) : (
                        <div className="w-7 h-7 rounded-lg bg-slate-200 flex items-center justify-center text-slate-700 font-bold text-xs">
                          {(personalName || 'E').charAt(0).toUpperCase()}
                        </div>
                      )}
                      <h4 className="font-semibold break-words">{personalName || 'Espacio Personal'}</h4>
                      <span className="bg-slate-200 text-slate-700 text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1 whitespace-nowrap">
                        <Shield className="w-3 h-3" /> PERSONAL
                      </span>
                      <div className="flex gap-1">
                        <button
                          onClick={handleEditPersonal}
                          className="p-1 hover:bg-slate-200 rounded transition"
                          title="Editar espacio personal"
                        >
                          <Edit2 className="w-4 h-4 text-slate-600" />
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
              <div className="flex flex-wrap gap-2 sm:flex-nowrap sm:shrink-0">
                {!editingPersonal && (
                  <>
                    <button
                      onClick={() => setShowPersonalInviteModal(true)}
                      className="btn btn-secondary btn-sm flex-1 sm:flex-none whitespace-nowrap"
                    >
                      <Mail className="w-4 h-4" /> Invitar
                    </button>
                    <button
                      onClick={() => setExpandedWorkspaceId(expandedWorkspaceId === 'personal' ? null : 'personal')}
                      className="btn btn-secondary btn-sm flex-1 sm:flex-none whitespace-nowrap"
                    >
                      <Users className="w-4 h-4" /> {expandedWorkspaceId === 'personal' ? 'Ocultar' : 'Ver Miembros'}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* INVITACIONES Y MIEMBROS DEL ESPACIO PERSONAL - Solo visible cuando está expandido */}
          {expandedWorkspaceId === 'personal' && (() => {
            // Obtener el primer workspace del usuario (espacio personal)
            const myWorkspaces = workspaces.filter(w => w.owner_id === user?.uid)
            const personalWorkspace = myWorkspaces.length > 0 ? myWorkspaces[0] : null
            const personalWorkspaceId = personalWorkspace?.id
            const personalWorkspaceMembers = personalWorkspaceId ? members.filter(m => m.workspace_id === personalWorkspaceId) : []
            const personalSentInvitations = personalWorkspaceId ? sentInvitations.filter(inv => inv.workspace_id === personalWorkspaceId) : []

            if (!personalWorkspaceId) {
              return (
                <div className="mt-4 pt-4 border-t border-slate-200">
                  <p className="text-xs text-slate-400">
                    Aún no hay un workspace creado para el espacio personal. Invitá a alguien para crearlo automáticamente.
                  </p>
                </div>
              )
            }

            return (
              <>
                {/* INVITACIONES ENVIADAS */}
                <div className="mt-4 pt-4 border-t border-slate-200">
                  <div className="flex items-center justify-between mb-3">
                    <h5 className="font-semibold text-sm">Invitaciones enviadas</h5>
                    {personalSentInvitations.length > 0 && (
                      <button
                        onClick={() => {
                          setWorkspaceToDeleteAll(personalWorkspaceId)
                          setShowDeleteAllConfirm(true)
                        }}
                        className="text-xs px-2 py-1 bg-red-50 text-red-700 border border-red-200 rounded hover:bg-red-100 transition flex items-center gap-1"
                        title="Eliminar todo el historial"
                      >
                        <Trash2 className="w-3 h-3" />
                        Borrar todo
                      </button>
                    )}
                  </div>
                  {personalSentInvitations.length > 0 ? (
                    <div className="space-y-2 mb-4">
                      {personalSentInvitations.map(inv => {
                        const statusColors = {
                          pending: 'bg-yellow-50 text-yellow-700 border-yellow-200',
                          accepted: 'bg-green-50 text-green-700 border-green-200',
                          rejected: 'bg-red-50 text-red-700 border-red-200',
                          cancelled: 'bg-gray-50 text-gray-700 border-gray-200'
                        }
                        const statusLabels = {
                          pending: '⏳ Pendiente',
                          accepted: '✅ Aceptada',
                          rejected: '❌ Rechazada',
                          cancelled: '🚫 Cancelada'
                        }
                        return (
                          <div key={inv.id} className="bg-white rounded-lg p-3 border border-slate-200">
                            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{inv.email}</p>
                                <div className="text-xs text-slate-500 mt-1 space-y-1">
                                  <div className="flex flex-wrap gap-1.5">
                                    {Object.entries(inv.permissions).map(([section, perm]) => (
                                      <div key={section} className="flex items-center gap-1 group relative">
                                        <span className="px-1.5 py-0.5 bg-slate-100 rounded text-slate-600 text-[10px]">
                                          {section}: {permissionOptions.find(o => o.value === perm)?.label || perm}
                                        </span>
                                        {getPermissionDescription(perm) && (
                                          <>
                                            <HelpCircle className="w-3 h-3 text-slate-400 cursor-help hidden sm:block" />
                                            <div className="absolute left-0 top-full mt-1 w-64 p-2 bg-slate-800 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 hidden sm:block">
                                              <p className="font-semibold mb-1">{section}: {permissionOptions.find(o => o.value === perm)?.label}</p>
                                              <p className="text-slate-200">{getPermissionDescription(perm)}</p>
                                            </div>
                                          </>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                                <span className={`text-xs px-2 py-1 rounded border font-medium whitespace-nowrap ${statusColors[inv.status as keyof typeof statusColors] || statusColors.pending}`}>
                                  {statusLabels[inv.status as keyof typeof statusLabels] || '⏳ Pendiente'}
                                </span>
                                {(inv.status === 'pending' || inv.status === 'rejected') && (
                                  <button
                                    onClick={async () => {
                                      const result = await cancelInvitation(inv.id)
                                      if (result.error) {
                                        setAlertData({
                                          title: 'Error',
                                          message: 'No se pudo cancelar la invitación',
                                          variant: 'error'
                                        })
                                      } else {
                                        setAlertData({
                                          title: 'Invitación cancelada',
                                          message: 'La invitación fue cancelada. Ahora puedes volver a invitar.',
                                          variant: 'success'
                                        })
                                      }
                                      setShowAlert(true)
                                    }}
                                    className="text-xs px-2 py-1 bg-red-50 text-red-700 border border-red-200 rounded hover:bg-red-100 transition whitespace-nowrap"
                                    title="Cancelar invitación"
                                  >
                                    Cancelar
                                  </button>
                                )}
                                <button
                                  onClick={() => {
                                    setInvitationToDelete({ id: inv.id, email: inv.email })
                                    setShowDeleteConfirm(true)
                                  }}
                                  className="text-xs px-2 py-1 bg-slate-50 text-slate-700 border border-slate-200 rounded hover:bg-slate-100 transition"
                                  title="Eliminar invitación del historial"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 mb-4">No hay invitaciones enviadas</p>
                  )}
                </div>

                {/* GESTIÓN DE MIEMBROS */}
                <div className="mt-4 pt-4 border-t border-slate-200">
                  <h5 className="font-semibold mb-3 text-sm">Gestión de Permisos</h5>

                  {personalWorkspaceMembers.length > 0 ? (
                    <div className="space-y-3">
                      {personalWorkspaceMembers.map(member => {
                        const isEditingName = editingNames[member.id] || false
                        const currentDisplayName = displayNames[member.id] !== undefined 
                          ? displayNames[member.id] 
                          : (member.display_name || '')
                        
                        return (
                          <div key={member.id} className="bg-white rounded-lg p-3 border border-slate-200">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <p className="font-medium text-sm">
                                    {member.user_email}
                                  </p>
                                  {member.user_id === user?.uid && <span className="text-xs text-slate-400">(Tú - Owner)</span>}
                                </div>
                                
                                {/* Campo de nombre personalizado */}
                                <div className="flex items-center gap-2 mb-1">
                                  <label className="text-xs text-slate-500 font-medium whitespace-nowrap">Nombre para etiquetas:</label>
                                  {isEditingName ? (
                                    <div className="flex items-center gap-2 flex-1">
                                      <input
                                        type="text"
                                        value={currentDisplayName}
                                        onChange={(e) => setDisplayNames(prev => ({ ...prev, [member.id]: e.target.value }))}
                                        className="input input-sm text-xs flex-1"
                                        placeholder="Nombre personalizado"
                                        onKeyPress={(e) => {
                                          if (e.key === 'Enter') {
                                            handleSaveDisplayName(member.id, currentDisplayName)
                                          } else if (e.key === 'Escape') {
                                            setEditingNames(prev => ({ ...prev, [member.id]: false }))
                                            setDisplayNames(prev => {
                                              const newState = { ...prev }
                                              delete newState[member.id]
                                              return newState
                                            })
                                          }
                                        }}
                                        autoFocus
                                      />
                                      <button
                                        onClick={() => handleSaveDisplayName(member.id, currentDisplayName)}
                                        className="btn btn-primary btn-xs"
                                      >
                                        Guardar
                                      </button>
                                      <button
                                        onClick={() => {
                                          setEditingNames(prev => ({ ...prev, [member.id]: false }))
                                          setDisplayNames(prev => {
                                            const newState = { ...prev }
                                            delete newState[member.id]
                                            return newState
                                          })
                                        }}
                                        className="btn btn-secondary btn-xs"
                                      >
                                        Cancelar
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-2 flex-1">
                                      <span className="text-xs text-slate-600 flex-1">
                                        {currentDisplayName || <span className="text-slate-400 italic">Sin nombre personalizado</span>}
                                      </span>
                                      {member.user_id !== user?.uid && (
                                        <button
                                          onClick={() => setEditingNames(prev => ({ ...prev, [member.id]: true }))}
                                          className="text-xs px-2 py-1 bg-slate-50 text-slate-700 border border-slate-200 rounded hover:bg-slate-100 transition"
                                        >
                                          Editar
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                              {member.user_id !== user?.uid && (
                                <button
                                  onClick={async () => {
                                    if (confirm(`¿Estás seguro de quitar a ${member.user_email} del espacio personal?`)) {
                                      const result = await removeMember(member.id)
                                      if (result.error) {
                                        setAlertData({
                                          title: 'Error',
                                          message: 'No se pudo quitar al miembro',
                                          variant: 'error'
                                        })
                                      } else {
                                        setAlertData({
                                          title: 'Miembro removido',
                                          message: `${member.user_email} fue removido del espacio personal`,
                                          variant: 'success'
                                        })
                                      }
                                      setShowAlert(true)
                                    }
                                  }}
                                  className="text-xs px-2 py-1 bg-red-50 text-red-700 border border-red-200 rounded hover:bg-red-100 transition"
                                  title="Quitar miembro"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                            </div>

                            {/* Permisos */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
                              {(['gastos', 'ingresos', 'ahorros', 'tarjetas'] as const).map((section) => {
                                const key = `${member.id}|||${section}`
                                const pendingValue = pendingPermissions[key]
                                const currentValue = pendingValue !== undefined ? pendingValue : member.permissions[section]
                                const hasPendingChange = pendingValue !== undefined && pendingValue !== member.permissions[section]

                                return (
                                  <div key={section} className="relative">
                                    <div className="flex items-center gap-1 mb-1">
                                      <label className="text-[10px] uppercase font-bold text-slate-500">{section}</label>
                                      {hasPendingChange && (
                                        <span className="text-[10px] text-blue-600 font-medium">(pendiente)</span>
                                      )}
                                    </div>
                                    <select
                                      value={currentValue}
                                      onChange={(e) => handlePermissionChange(member.id, section, e.target.value)}
                                      disabled={member.user_id === user?.uid}
                                      className="input input-sm text-xs w-full"
                                    >
                                      {permissionOptions.map(opt => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                      ))}
                                    </select>
                                    {hasPendingChange && (
                                      <div className="flex gap-1 mt-1">
                                        <button
                                          onClick={() => savePermission(member.id, section, member)}
                                          className="text-[10px] px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded hover:bg-blue-100 transition"
                                        >
                                          Guardar
                                        </button>
                                        <button
                                          onClick={() => {
                                            setPendingPermissions(prev => {
                                              const newState = { ...prev }
                                              delete newState[key]
                                              return newState
                                            })
                                          }}
                                          className="text-[10px] px-2 py-0.5 bg-slate-50 text-slate-700 border border-slate-200 rounded hover:bg-slate-100 transition"
                                        >
                                          Cancelar
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400">No hay miembros en el espacio personal</p>
                  )}
                </div>
              </>
            )
          })()}
        </div>

        {/* Workspaces Colaborativos */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-semibold text-base">🏢 Workspaces Colaborativos</h4>
            <button
              onClick={() => setShowWorkspaceModal(true)}
              disabled={workspaces.filter(w => w.owner_id === user?.uid).length >= 2}
              className="btn btn-primary btn-sm"
            >
              <Plus className="w-4 h-4" /> Nuevo Workspace
            </button>
          </div>

        {/* Lista de Workspaces */}
        <div className="space-y-3">
          {workspaces.length > 0 ? (
            workspaces.map(ws => {
              const isOwner = ws.owner_id === user?.uid
              const isExpanded = expandedWorkspaceId === ws.id
              const workspaceMembers = members.filter(m => m.workspace_id === ws.id)

              return (
                <div key={ws.id} className={`rounded-xl p-4 border ${isOwner ? 'bg-slate-50 border-slate-200' : 'bg-indigo-50 border-indigo-200'}`}>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      {editingWorkspaceId === ws.id ? (
                        <div className="flex flex-col gap-2">
                          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                            <div className="flex items-center gap-2 flex-1">
                              <EmojiPickerField
                                value={workspaceIcono}
                                onChange={setWorkspaceIcono}
                                placeholder="🏢"
                                size="sm"
                              />
                              <div className="flex items-center gap-2">
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="input input-sm text-xs"
                                  onChange={async (e) => {
                                    const file = e.target.files?.[0]
                                    if (!file) return
                                    const maxBytes = 250 * 1024
                                    if (file.size > maxBytes) {
                                      setAlertData({
                                        title: 'Imagen muy grande',
                                        message: 'Usá un logo cuadrado liviano (recomendado 256x256 y menos de 250KB).',
                                        variant: 'warning'
                                      })
                                      setShowAlert(true)
                                      e.target.value = ''
                                      return
                                    }
                                    try {
                                      const dataUrl = await fileToDataUrl(file)
                                      setWorkspaceLogo(dataUrl)
                                    } catch {
                                      setAlertData({
                                        title: 'Error',
                                        message: 'No se pudo cargar la imagen',
                                        variant: 'error'
                                      })
                                      setShowAlert(true)
                                    }
                                  }}
                                />
                                {workspaceLogo && (
                                  <button
                                    type="button"
                                    className="btn btn-secondary btn-sm whitespace-nowrap"
                                    onClick={() => setWorkspaceLogo(null)}
                                  >
                                    Quitar
                                  </button>
                                )}
                              </div>
                              <input
                                type="text"
                                value={editingWorkspaceName}
                                onChange={(e) => setEditingWorkspaceName(e.target.value)}
                                className="input input-sm flex-1 min-w-0"
                                autoFocus
                                onKeyPress={(e) => e.key === 'Enter' && handleSaveWorkspaceName()}
                                placeholder="Nombre del workspace"
                              />
                            </div>
                            <div className="flex gap-2">
                              <button onClick={handleSaveWorkspaceName} className="btn btn-primary btn-sm flex-1 sm:flex-none">
                                Guardar
                              </button>
                              <button onClick={handleCancelEditWorkspace} className="btn btn-secondary btn-sm flex-1 sm:flex-none">
                                Cancelar
                              </button>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-slate-500">
                            {workspaceLogo ? (
                              <>
                                <span>Logo cargado:</span>
                                <img src={workspaceLogo} alt="Logo" className="w-6 h-6 rounded object-cover border border-slate-200" />
                              </>
                            ) : (
                              <span>Podés elegir un emoji o subir un logo (opcional)</span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex flex-wrap items-center gap-2">
                            {ws.logo ? (
                              <img src={ws.logo} alt="Logo" className="w-7 h-7 rounded-lg object-cover border border-slate-200" />
                            ) : ws.icono ? (
                              <span className="text-xl">{ws.icono}</span>
                            ) : (
                              <div className="w-7 h-7 rounded-lg bg-slate-200 flex items-center justify-center text-slate-700 font-bold text-xs">
                                {ws.name.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <h4 className="font-semibold break-words">{ws.name}</h4>
                            
                            {/* ETIQUETA DE ROL */}
                            {isOwner ? (
                              <span className="bg-slate-200 text-slate-700 text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1 whitespace-nowrap">
                                <Shield className="w-3 h-3" /> PROPIETARIO
                              </span>
                            ) : (
                              <span className="bg-indigo-200 text-indigo-800 text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1 whitespace-nowrap">
                                <UserCheck className="w-3 h-3" /> COLABORADOR
                              </span>
                            )}

                            {isOwner && (
                              <div className="flex gap-1">
                                <button
                                  onClick={() => handleEditWorkspace(ws.id, ws.name, ws.icono, ws.logo)}
                                  className="p-1 hover:bg-slate-200 rounded transition"
                                  title="Editar workspace"
                                >
                                  <Edit2 className="w-4 h-4 text-slate-600" />
                                </button>
                                <button
                                  onClick={() => handleDeleteWorkspace(ws.id, ws.name)}
                                  className="p-1 hover:bg-red-100 rounded transition"
                                  title="Eliminar workspace"
                                >
                                  <Trash2 className="w-4 h-4 text-red-600" />
                                </button>
                              </div>
                            )}
                          </div>
                          {/* Solo el dueño ve cuántos miembros hay */}
                          {isOwner && (
                            <p className="text-xs text-slate-500 mt-1">
                               {workspaceMembers.length} miembro{workspaceMembers.length !== 1 ? 's' : ''} en total
                            </p>
                          )}
                        </>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 sm:flex-nowrap sm:shrink-0">
                      {/* SOLO EL DUEÑO PUEDE INVITAR Y GESTIONAR MIEMBROS */}
                      {isOwner && editingWorkspaceId !== ws.id && (
                        <>
                          <button
                            onClick={() => {
                              setInviteWorkspaceId(ws.id)
                              setShowInviteModal(true)
                            }}
                            className="btn btn-secondary btn-sm flex-1 sm:flex-none whitespace-nowrap"
                          >
                            <Mail className="w-4 h-4" /> Invitar
                          </button>
                          <button
                            onClick={() => setExpandedWorkspaceId(isExpanded ? null : ws.id)}
                            className="btn btn-secondary btn-sm flex-1 sm:flex-none whitespace-nowrap"
                          >
                            <Users className="w-4 h-4" /> {isExpanded ? 'Ocultar' : 'Ver Miembros'}
                          </button>
                        </>
                      )}
                      
                      {/* SI SOY COLABORADOR SOLO PUEDO VER, PERO NO GESTIONAR */}
                      {!isOwner && (
                        <div className="text-xs text-indigo-600 font-medium self-center px-3 whitespace-nowrap">
                          Acceso Compartido
                        </div>
                      )}
                    </div>
                  </div>

                  {/* INVITACIONES ENVIADAS - Solo visible para el dueño */}
                  {isOwner && isExpanded && (
                    <div className="mt-4 pt-4 border-t border-slate-200">
                      <div className="flex items-center justify-between mb-3">
                        <h5 className="font-semibold text-sm">Invitaciones enviadas</h5>
                        {sentInvitations.filter(inv => inv.workspace_id === ws.id).length > 0 && (
                          <button
                            onClick={() => {
                              setWorkspaceToDeleteAll(ws.id)
                              setShowDeleteAllConfirm(true)
                            }}
                            className="text-xs px-2 py-1 bg-red-50 text-red-700 border border-red-200 rounded hover:bg-red-100 transition flex items-center gap-1"
                            title="Eliminar todo el historial"
                          >
                            <Trash2 className="w-3 h-3" />
                            Borrar todo
                          </button>
                        )}
                      </div>
                      {sentInvitations.filter(inv => inv.workspace_id === ws.id).length > 0 ? (
                        <div className="space-y-2 mb-4">
                          {sentInvitations
                            .filter(inv => inv.workspace_id === ws.id)
                            .map(inv => {
                              const statusColors = {
                                pending: 'bg-yellow-50 text-yellow-700 border-yellow-200',
                                accepted: 'bg-green-50 text-green-700 border-green-200',
                                rejected: 'bg-red-50 text-red-700 border-red-200',
                                cancelled: 'bg-gray-50 text-gray-700 border-gray-200'
                              }
                              const statusLabels = {
                                pending: '⏳ Pendiente',
                                accepted: '✅ Aceptada',
                                rejected: '❌ Rechazada',
                                cancelled: '🚫 Cancelada'
                              }
                              return (
                                <div key={inv.id} className="bg-white rounded-lg p-3 border border-slate-200">
                                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium truncate">{inv.email}</p>
                                      <div className="text-xs text-slate-500 mt-1 space-y-1">
                                        <div className="flex flex-wrap gap-1.5">
                                          {Object.entries(inv.permissions).map(([section, perm]) => (
                                            <div key={section} className="flex items-center gap-1 group relative">
                                              <span className="px-1.5 py-0.5 bg-slate-100 rounded text-slate-600 text-[10px]">
                                                {section}: {permissionOptions.find(o => o.value === perm)?.label || perm}
                                              </span>
                                              {getPermissionDescription(perm) && (
                                                <>
                                                  <HelpCircle className="w-3 h-3 text-slate-400 cursor-help hidden sm:block" />
                                                  <div className="absolute left-0 top-full mt-1 w-64 p-2 bg-slate-800 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 hidden sm:block">
                                                    <p className="font-semibold mb-1">{section}: {permissionOptions.find(o => o.value === perm)?.label}</p>
                                                    <p className="text-slate-200">{getPermissionDescription(perm)}</p>
                                                  </div>
                                                </>
                                              )}
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                                      <span className={`text-xs px-2 py-1 rounded border font-medium whitespace-nowrap ${statusColors[inv.status as keyof typeof statusColors] || statusColors.pending}`}>
                                        {statusLabels[inv.status as keyof typeof statusLabels] || '⏳ Pendiente'}
                                      </span>
                                      {(inv.status === 'pending' || inv.status === 'rejected') && (
                                        <button
                                          onClick={async () => {
                                            const result = await cancelInvitation(inv.id)
                                            if (result.error) {
                                              setAlertData({
                                                title: 'Error',
                                                message: 'No se pudo cancelar la invitación',
                                                variant: 'error'
                                              })
                                            } else {
                                              setAlertData({
                                                title: 'Invitación cancelada',
                                                message: 'La invitación fue cancelada. Ahora puedes volver a invitar.',
                                                variant: 'success'
                                              })
                                            }
                                            setShowAlert(true)
                                          }}
                                          className="text-xs px-2 py-1 bg-red-50 text-red-700 border border-red-200 rounded hover:bg-red-100 transition whitespace-nowrap"
                                          title="Cancelar invitación"
                                        >
                                          Cancelar
                                        </button>
                                      )}
                                      <button
                                        onClick={() => {
                                          setInvitationToDelete({ id: inv.id, email: inv.email })
                                          setShowDeleteConfirm(true)
                                        }}
                                        className="text-xs px-2 py-1 bg-slate-50 text-slate-700 border border-slate-200 rounded hover:bg-slate-100 transition"
                                        title="Eliminar invitación del historial"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              )
                            })}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 mb-4">No hay invitaciones enviadas</p>
                      )}
                    </div>
                  )}

                  {/* GESTIÓN DE MIEMBROS - Solo visible para el dueño */}
                  {isOwner && isExpanded && (
                    <div className="mt-4 pt-4 border-t border-slate-200">
                      <h5 className="font-semibold mb-3 text-sm">Gestión de Permisos</h5>

                      {workspaceMembers.length > 0 ? (
                        <div className="space-y-3">
                          {workspaceMembers.map(member => {
                            const isEditingName = editingNames[member.id] || false
                            const currentDisplayName = displayNames[member.id] !== undefined 
                              ? displayNames[member.id] 
                              : (member.display_name || '')
                            
                            return (
                            <div key={member.id} className="bg-white rounded-lg p-3 border border-slate-200">
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-2">
                                    <p className="font-medium text-sm">
                                      {member.user_email}
                                    </p>
                                    {member.user_id === user?.uid && <span className="text-xs text-slate-400">(Tú)</span>}
                                  </div>
                                  
                                  {/* Campo de nombre personalizado - siempre visible y editable */}
                                  <div className="flex items-center gap-2 mb-1">
                                    <label className="text-xs text-slate-500 font-medium whitespace-nowrap">Nombre para etiquetas:</label>
                                    {isEditingName ? (
                                      <div className="flex items-center gap-2 flex-1">
                                        <input
                                          type="text"
                                          className="input input-sm text-xs flex-1"
                                          placeholder={member.user_email.split('@')[0]}
                                          value={currentDisplayName}
                                          onChange={(e) => setDisplayNames(prev => ({ ...prev, [member.id]: e.target.value }))}
                                          onKeyPress={(e) => {
                                            if (e.key === 'Enter') {
                                              handleUpdateMemberName(member.id, currentDisplayName.trim() || null)
                                              setEditingNames(prev => ({ ...prev, [member.id]: false }))
                                            }
                                            if (e.key === 'Escape') {
                                              setDisplayNames(prev => ({ ...prev, [member.id]: member.display_name || '' }))
                                              setEditingNames(prev => ({ ...prev, [member.id]: false }))
                                            }
                                          }}
                                          onBlur={() => {
                                            // Auto-guardar al perder el foco
                                            if (currentDisplayName.trim() !== (member.display_name || '')) {
                                              handleUpdateMemberName(member.id, currentDisplayName.trim() || null)
                                            }
                                            setEditingNames(prev => ({ ...prev, [member.id]: false }))
                                          }}
                                          autoFocus
                                        />
                                        <button
                                          onClick={() => {
                                            handleUpdateMemberName(member.id, currentDisplayName.trim() || null)
                                            setEditingNames(prev => ({ ...prev, [member.id]: false }))
                                          }}
                                          className="text-green-600 hover:text-green-700 p-1"
                                          title="Guardar"
                                        >
                                          <Save className="w-4 h-4" />
                                        </button>
                                        <button
                                          onClick={() => {
                                            setDisplayNames(prev => ({ ...prev, [member.id]: member.display_name || '' }))
                                            setEditingNames(prev => ({ ...prev, [member.id]: false }))
                                          }}
                                          className="text-slate-600 hover:text-slate-700 p-1"
                                          title="Cancelar"
                                        >
                                          <X className="w-4 h-4" />
                                        </button>
                                      </div>
                                    ) : (
                                      <div className="flex items-center gap-2 flex-1">
                                        <span className="text-xs font-medium text-slate-700 bg-slate-100 px-2 py-1 rounded">
                                          {member.display_name || member.user_email.split('@')[0]}
                                        </span>
                                        <button
                                          onClick={() => {
                                            setDisplayNames(prev => ({ ...prev, [member.id]: member.display_name || '' }))
                                            setEditingNames(prev => ({ ...prev, [member.id]: true }))
                                          }}
                                          className="text-indigo-600 hover:text-indigo-700 p-1"
                                          title="Editar nombre"
                                        >
                                          <Edit2 className="w-3 h-3" />
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                  <p className="text-xs text-slate-500">ID: {member.user_id.slice(0, 8)}...</p>
                                </div>
                                {member.user_id !== user?.uid && (
                                  <button
                                    onClick={() => handleRemoveMember(member.id, member.user_email)}
                                    className="text-red-600 hover:text-red-700 text-sm flex items-center gap-1 bg-red-50 px-2 py-1 rounded-md"
                                  >
                                    <X className="w-3 h-3" /> Eliminar acceso
                                  </button>
                                )}
                              </div>

                              {/* Permission Selectors */}
                              <div className="grid grid-cols-2 gap-2">
                                {['gastos', 'ingresos', 'ahorros', 'tarjetas'].map((section) => {
                                  // Asegurarse de que member.id es válido
                                  if (!member.id || typeof member.id !== 'string') {
                                    console.error('❌ [Config] member.id inválido:', member.id, 'member:', member)
                                    return null
                                  }
                                  
                                  const key = `${member.id}|||${section}`
                                  const pendingValue = pendingPermissions[key]
                                  const currentValue = member.permissions[section as keyof WorkspacePermissions]
                                  const hasChange = pendingValue && pendingValue !== currentValue

                                  return (
                                    <div key={section} className="flex flex-col">
                                      <label className="text-[10px] uppercase font-bold text-slate-500 mb-1">{section}</label>
                                      <select
                                        className={`input input-sm text-xs w-full ${hasChange ? 'border-indigo-500 bg-indigo-50' : ''}`}
                                        value={pendingValue || currentValue}
                                        onChange={(e) => {
                                          console.log('🔍 [Config] onChange - member.id:', member.id, 'member.id type:', typeof member.id, 'section:', section, 'value:', e.target.value, 'key será:', `${member.id}|||${section}`)
                                          handlePermissionChange(member.id, section, e.target.value)
                                        }}
                                        disabled={member.user_id === user?.uid} // El dueño no se edita a sí mismo
                                      >
                                        {permissionOptions.map(opt => (
                                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                                        ))}
                                      </select>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )})}
                          {/* Botón para guardar todos los cambios pendientes */}
                          {Object.keys(pendingPermissions).length > 0 && (
                            <div className="mt-4 pt-4 border-t border-slate-200">
                              <button
                                onClick={saveAllPendingPermissions}
                                className="btn btn-primary w-full justify-center"
                              >
                                <CheckCircle2 className="w-4 h-4" />
                                Guardar todos los cambios ({Object.keys(pendingPermissions).length})
                              </button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-center text-slate-500 text-sm py-4">
                          <p>Cargando miembros...</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })
          ) : (
            <div className="bg-slate-50 rounded-xl p-8 text-center text-slate-500">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">Sin workspaces</p>
              <p className="text-sm">Creá un workspace para compartir con otros</p>
            </div>
          )}
        </div>
        </div>

        {/* Invitaciones Pendientes - MEJORADO */}
        {invitations.length > 0 && (
          <div className="mt-6 pt-6 border-t border-slate-200">
            <h4 className="font-semibold mb-3">📬 Invitaciones Pendientes</h4>
            <div className="space-y-2">
              {invitations.map(inv => (
                <div key={inv.id} className="bg-indigo-50 rounded-xl p-4 border border-indigo-100 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-indigo-900">
                      <strong>{inv.inviter_email || 'Alguien'}</strong> te invitó a unirte a:
                    </p>
                    <p className="text-lg font-bold text-indigo-700">{inv.workspace_name || 'Un Workspace'}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAcceptInvitation(inv.id)}
                      className="btn btn-primary btn-sm bg-indigo-600 hover:bg-indigo-700"
                    >
                      Aceptar
                    </button>
                    <button
                      onClick={() => handleRejectInvitation(inv.id)}
                      className="btn btn-secondary btn-sm"
                    >
                      Rechazar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Configuración financiera mensual */}
      <div className="card p-5 order-2 mb-8">
        <h3 className="font-bold mb-6">🧩 Configuración financiera mensual</h3>
        
        {/* Gestión de Ingresos */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold text-base">💰 Gestión de Ingresos</h4>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={ingresosEnabled}
                onChange={e => setIngresosEnabled(e.target.checked)}
                className="w-5 h-5 accent-indigo-500"
              />
              <span className="text-sm font-medium">Activar registro de ingresos</span>
            </label>
          </div>
          <p className="text-slate-600 text-sm">
            Podés registrar tus ingresos mensuales con categorías y etiquetas personalizadas.
          </p>
        </div>

        {/* Presupuesto Mensual */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold text-base">📊 Presupuesto Mensual</h4>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={budgetEnabled}
                onChange={e => setBudgetEnabled(e.target.checked)}
                className="w-5 h-5 accent-indigo-500"
              />
              <span className="text-sm font-medium">Activar presupuesto</span>
            </label>
          </div>
          
          {budgetEnabled ? (
            <>
              <div className="grid sm:grid-cols-2 gap-4 mb-3">
                <div>
                  <label className="label">Monto máximo mensual</label>
                  <input
                    type="number"
                    className="input"
                    placeholder="500000"
                    value={budgetAmount}
                    onChange={e => setBudgetAmount(e.target.value)}
                  />
                </div>
                <div>
                  <label className="label">Moneda</label>
                  <select
                    className="input"
                    value={budgetCurrency}
                    onChange={e => setBudgetCurrency(e.target.value as 'ARS' | 'USD')}
                  >
                    <option value="ARS">ARS</option>
                    <option value="USD">USD</option>
                  </select>
                </div>
              </div>
            </>
          ) : (
            <div className="bg-slate-50 rounded-xl p-4 text-center text-slate-500">
              <p>No tenés un presupuesto configurado.</p>
            </div>
          )}
          <p className="text-slate-600 text-sm">
            Establecé un límite para controlar tus gastos mensuales.
          </p>
        </div>

        {/* Botón único de guardar */}
        <button onClick={handleSaveFinancialConfig} disabled={saving} className="btn btn-primary w-full">
          <Save className="w-4 h-4" />
          {saving ? 'Guardando...' : 'Guardar configuración'}
        </button>
      </div>

      {/* Categorías y Etiquetas - Unificadas */}
      <div className="card p-5 order-3 mb-8">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => setExpandedCategoriasEtiquetas(!expandedCategoriasEtiquetas)}
            className="flex items-center gap-2 text-left flex-1 group"
          >
            <h3 className="font-bold">📂 Categorías y Etiquetas</h3>
            {expandedCategoriasEtiquetas ? (
              <ChevronUp className="w-5 h-5 text-slate-400 group-hover:text-slate-600" />
            ) : (
              <ChevronDown className="w-5 h-5 text-slate-400 group-hover:text-slate-600" />
            )}
          </button>
        </div>

        {expandedCategoriasEtiquetas && (
          <div className="space-y-6">
            {/* Gastos - Colapsable */}
            <div>
              <button
                onClick={() => setExpandedGastos(!expandedGastos)}
                className="flex items-center justify-between w-full mb-3 group"
              >
                <h4 className="font-semibold text-base text-slate-700">📂 Gastos</h4>
                {expandedGastos ? (
                  <ChevronUp className="w-4 h-4 text-slate-400 group-hover:text-slate-600" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-slate-600" />
                )}
              </button>
              
              {expandedGastos && (
                <div className="space-y-6 pl-4 border-l-2 border-slate-200">
                  <div className="flex gap-2 mb-4">
                    {selectedCategoriasGastos.size > 0 && (
                      <button
                        onClick={() => {
                          setWorkspaceToDeleteAll('categorias_gastos')
                          setShowDeleteAllConfirm(true)
                        }}
                        className="btn btn-secondary btn-sm"
                      >
                        <Trash2 className="w-4 h-4" /> Eliminar ({selectedCategoriasGastos.size})
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setEditingCategoria(null)
                        setCategoriaForm({ nombre: '', icono: '', color: '#6366f1' })
                        setShowCategoriaModal(true)
                      }}
                      className="btn btn-primary btn-sm"
                    >
                      <Plus className="w-4 h-4" /> Nueva Categoría
                    </button>
                  </div>

                  {/* Categorías de Gastos */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h5 className="font-semibold text-sm text-slate-700">Categorías ({categorias.length})</h5>
                      {categorias.length > 0 && (
                        <button
                          onClick={() => {
                            if (selectedCategoriasGastos.size === categorias.length) {
                              setSelectedCategoriasGastos(new Set())
                            } else {
                              setSelectedCategoriasGastos(new Set(categorias.map(c => c.id)))
                            }
                          }}
                          className="text-xs text-slate-600 hover:text-slate-900"
                        >
                          {selectedCategoriasGastos.size === categorias.length ? 'Deseleccionar todo' : 'Seleccionar todo'}
                        </button>
                      )}
                    </div>
                    <div className="grid sm:grid-cols-2 gap-3">
                      {categorias.map(c => (
                        <div
                          key={c.id}
                          className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl hover:bg-slate-100 transition"
                        >
                          <input
                            type="checkbox"
                            checked={selectedCategoriasGastos.has(c.id)}
                            onChange={(e) => {
                              const newSelected = new Set(selectedCategoriasGastos)
                              if (e.target.checked) {
                                newSelected.add(c.id)
                              } else {
                                newSelected.delete(c.id)
                              }
                              setSelectedCategoriasGastos(newSelected)
                            }}
                            className="w-4 h-4 text-indigo-600 rounded border-slate-300 cursor-pointer"
                            onClick={(e) => e.stopPropagation()}
                          />
                          <div
                            className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                            style={{ backgroundColor: c.color + '20' }}
                          >
                            {c.icono}
                          </div>
                          <div className="flex-1">
                            <div className="font-semibold">{c.nombre}</div>
                            <div className="text-xs text-slate-500">Color: {c.color}</div>
                          </div>
                          <div className="flex gap-1">
                            <button
                              onClick={() => handleEditCategoria(c)}
                              className="p-2 hover:bg-slate-200 rounded-lg transition"
                            >
                              <Edit2 className="w-4 h-4 text-slate-600" />
                            </button>
                            <button
                              onClick={() => handleDeleteCategoria(c.id, c.nombre)}
                              className="p-2 hover:bg-red-100 rounded-lg transition"
                            >
                              <X className="w-4 h-4 text-red-600" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Tags de Gastos */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h5 className="font-semibold text-sm text-slate-700">Etiquetas ({tags.length})</h5>
                    </div>
                    <div className="flex flex-wrap gap-2 mb-4">
                      {tags.map(t => (
                        <div key={t.id} className="flex items-center gap-1 bg-orange-100 text-orange-700 px-3 py-1.5 rounded-full">
                          <span className="font-semibold text-sm">{t.nombre}</span>
                          <button onClick={() => deleteTag(t.id)} className="hover:text-orange-900">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                      {tags.length === 0 && (
                        <span className="text-slate-400">Sin etiquetas</span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        className="input flex-1"
                        placeholder="Nueva etiqueta..."
                        value={newTag}
                        onChange={e => setNewTag(e.target.value)}
                        onKeyPress={e => e.key === 'Enter' && handleAddTag()}
                      />
                      <button onClick={handleAddTag} className="btn btn-primary">
                        <Plus className="w-4 h-4" /> Agregar
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Ingresos - Colapsable */}
            <div>
              <button
                onClick={() => setExpandedIngresos(!expandedIngresos)}
                className="flex items-center justify-between w-full mb-3 group"
              >
                <h4 className="font-semibold text-base text-slate-700">💰 Ingresos</h4>
                {expandedIngresos ? (
                  <ChevronUp className="w-4 h-4 text-slate-400 group-hover:text-slate-600" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-slate-600" />
                )}
              </button>
              
              {expandedIngresos && (
                <div className="space-y-6 pl-4 border-l-2 border-slate-200">
                  <div className="flex gap-2 mb-4">
                    {selectedCategoriasIngresos.size > 0 && (
                      <button
                        onClick={() => {
                          setShowDeleteAllConfirm(true)
                          setWorkspaceToDeleteAll('categorias_ingresos')
                        }}
                        className="btn btn-secondary btn-sm"
                      >
                        <Trash2 className="w-4 h-4" /> Eliminar ({selectedCategoriasIngresos.size})
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setEditingCategoriaIngreso(null)
                        setCategoriaIngresoForm({ nombre: '', icono: '', color: '#10b981' })
                        setShowCategoriaIngresoModal(true)
                      }}
                      className="btn btn-primary btn-sm"
                    >
                      <Plus className="w-4 h-4" /> Nueva Categoría
                    </button>
                  </div>

                  {/* Categorías de Ingresos */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h5 className="font-semibold text-sm text-slate-700">Categorías ({categoriasIngresos.length})</h5>
                      {categoriasIngresos.length > 0 && (
                        <button
                          onClick={() => {
                            if (selectedCategoriasIngresos.size === categoriasIngresos.length) {
                              setSelectedCategoriasIngresos(new Set())
                            } else {
                              setSelectedCategoriasIngresos(new Set(categoriasIngresos.map(c => c.id)))
                            }
                          }}
                          className="text-xs text-slate-600 hover:text-slate-900"
                        >
                          {selectedCategoriasIngresos.size === categoriasIngresos.length ? 'Deseleccionar todo' : 'Seleccionar todo'}
                        </button>
                      )}
                    </div>
                    <div className="grid sm:grid-cols-2 gap-3">
                      {categoriasIngresos.map(c => (
                        <div
                          key={c.id}
                          className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl hover:bg-slate-100 transition"
                        >
                          <input
                            type="checkbox"
                            checked={selectedCategoriasIngresos.has(c.id)}
                            onChange={(e) => {
                              const newSelected = new Set(selectedCategoriasIngresos)
                              if (e.target.checked) {
                                newSelected.add(c.id)
                              } else {
                                newSelected.delete(c.id)
                              }
                              setSelectedCategoriasIngresos(newSelected)
                            }}
                            className="w-4 h-4 text-indigo-600 rounded border-slate-300 cursor-pointer"
                            onClick={(e) => e.stopPropagation()}
                          />
                          <div
                            className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                            style={{ backgroundColor: c.color + '20' }}
                          >
                            {c.icono}
                          </div>
                          <div className="flex-1">
                            <div className="font-semibold">{c.nombre}</div>
                            <div className="text-xs text-slate-500">Color: {c.color}</div>
                          </div>
                          <div className="flex gap-1">
                            <button
                              onClick={() => handleEditCategoriaIngreso(c)}
                              className="p-2 hover:bg-slate-200 rounded-lg transition"
                            >
                              <Edit2 className="w-4 h-4 text-slate-600" />
                            </button>
                            <button
                              onClick={() => handleDeleteCategoriaIngreso(c.id, c.nombre)}
                              className="p-2 hover:bg-red-100 rounded-lg transition"
                            >
                              <X className="w-4 h-4 text-red-600" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Tags de Ingresos */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h5 className="font-semibold text-sm text-slate-700">Etiquetas ({tagsIngresos.length})</h5>
                    </div>
                    <div className="flex flex-wrap gap-2 mb-4">
                      {tagsIngresos.map(t => (
                        <div key={t.id} className="flex items-center gap-1 bg-orange-100 text-orange-700 px-3 py-1.5 rounded-full">
                          <span className="font-semibold text-sm">{t.nombre}</span>
                          <button onClick={() => deleteTagIngreso(t.id)} className="hover:text-orange-900">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                      {tagsIngresos.length === 0 && (
                        <span className="text-slate-400">Sin etiquetas</span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        className="input flex-1"
                        placeholder="Nueva etiqueta..."
                        value={newTagIngreso}
                        onChange={e => setNewTagIngreso(e.target.value)}
                        onKeyPress={e => e.key === 'Enter' && handleAddTagIngreso()}
                      />
                      <button onClick={handleAddTagIngreso} className="btn btn-primary">
                        <Plus className="w-4 h-4" /> Agregar
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Sección Cambio de Contraseña */}
      <div className="card p-5 order-4 mb-8">
        <h3 className="font-bold mb-4">🔐 Seguridad</h3>
        {!showPasswordChange ? (
          <button
            onClick={() => setShowPasswordChange(true)}
            className="btn btn-secondary"
          >
            <Lock className="w-4 h-4" /> Cambiar contraseña
          </button>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="label">Contraseña actual</label>
              <div className="relative">
                <input
                  type={showCurrentPassword ? 'text' : 'password'}
                  className="input w-full pr-10"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Ingresá tu contraseña actual"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showCurrentPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div>
              <label className="label">Nueva contraseña</label>
              <div className="relative">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  className="input w-full pr-10"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div>
              <label className="label">Confirmar nueva contraseña</label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  className="input w-full pr-10"
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  placeholder="Repetí la nueva contraseña"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleChangePassword}
                disabled={changingPassword}
                className="btn btn-primary"
              >
                {changingPassword ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Guardando...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" /> Guardar
                  </>
                )}
              </button>
              <button
                onClick={() => {
                  setShowPasswordChange(false)
                  setCurrentPassword('')
                  setNewPassword('')
                  setConfirmNewPassword('')
                }}
                disabled={changingPassword}
                className="btn btn-secondary"
              >
                <X className="w-4 h-4" /> Cancelar
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="card p-5 bg-slate-50 order-5 mb-8">
        <h3 className="font-bold mb-2">ℹ️ Información</h3>
        <div className="text-sm text-slate-600 space-y-1">
          <p><strong>Email:</strong> {profile?.email}</p>
          <p><strong>Usuario:</strong> {profile?.nombre}</p>
          <p><strong>Versión:</strong> 2.0.0</p>
        </div>
      </div>

      {/* Modal de Categoría */}
      {showCategoriaIngresoModal && (
        <div className="modal-overlay" onClick={() => setShowCategoriaIngresoModal(false)}>
          <div className="modal-content max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">
                {editingCategoriaIngreso ? 'Editar Categoría de Ingreso' : 'Nueva Categoría de Ingreso'}
              </h2>
              <button onClick={() => setShowCategoriaIngresoModal(false)} className="p-1 hover:bg-slate-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="label">Nombre</label>
                <input
                  type="text"
                  className="input"
                  value={categoriaIngresoForm.nombre}
                  onChange={e => setCategoriaIngresoForm(c => ({ ...c, nombre: e.target.value }))}
                  placeholder="Ej: Salario, Freelance, Inversiones..."
                />
              </div>
              <div>
                <label className="label">Icono</label>
                <EmojiPickerField
                  value={categoriaIngresoForm.icono}
                  onChange={v => setCategoriaIngresoForm(c => ({ ...c, icono: v }))}
                  placeholder="💵"
                />
              </div>
              <div>
                <label className="label">Color</label>
                <div className="flex gap-3 items-center">
                  <input
                    type="color"
                    className="w-16 h-16 rounded border border-slate-200 cursor-pointer"
                    value={categoriaIngresoForm.color}
                    onChange={e => setCategoriaIngresoForm(c => ({ ...c, color: e.target.value }))}
                  />
                  <input
                    type="text"
                    className="input flex-1"
                    value={categoriaIngresoForm.color}
                    onChange={e => setCategoriaIngresoForm(c => ({ ...c, color: e.target.value }))}
                    placeholder="#10b981"
                  />
                </div>
                <div className="mt-3 p-3 bg-slate-50 rounded-lg flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                    style={{ backgroundColor: categoriaIngresoForm.color + '20' }}
                  >
                    {categoriaIngresoForm.icono || '?'}
                  </div>
                  <div className="font-semibold">{categoriaIngresoForm.nombre || 'Nombre de categoría'}</div>
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={handleSaveCategoriaIngreso} className="btn btn-primary flex-1">
                  {editingCategoriaIngreso ? 'Actualizar' : 'Crear'}
                </button>
                <button onClick={() => setShowCategoriaIngresoModal(false)} className="btn btn-secondary">
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showCategoriaModal && (
        <div className="modal-overlay" onClick={() => setShowCategoriaModal(false)}>
          <div className="modal max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-lg">
                {editingCategoria ? 'Editar Categoría' : 'Nueva Categoría'}
              </h3>
              <button onClick={() => setShowCategoriaModal(false)} className="p-1 hover:bg-slate-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="label">Nombre</label>
                <input
                  type="text"
                  className="input"
                  placeholder="ej: Comida, Transporte..."
                  value={categoriaForm.nombre}
                  onChange={e => setCategoriaForm(f => ({ ...f, nombre: e.target.value }))}
                />
              </div>

              <div>
                <label className="label">Icono</label>
                <EmojiPickerField
                  value={categoriaForm.icono}
                  onChange={v => setCategoriaForm(f => ({ ...f, icono: v }))}
                  placeholder="😀"
                  size="md"
                />
              </div>

              <div>
                <label className="label">Color</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    className="w-16 h-16 rounded-lg border-2 border-slate-200 cursor-pointer"
                    value={categoriaForm.color}
                    onChange={e => setCategoriaForm(f => ({ ...f, color: e.target.value }))}
                  />
                  <div className="flex-1">
                    <input
                      type="text"
                      className="input"
                      placeholder="#6366f1"
                      value={categoriaForm.color}
                      onChange={e => setCategoriaForm(f => ({ ...f, color: e.target.value }))}
                    />
                  </div>
                </div>
              </div>

              {/* Preview */}
              <div className="bg-slate-50 rounded-xl p-4">
                <div className="text-xs text-slate-500 mb-2">Vista previa:</div>
                <div className="flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                    style={{ backgroundColor: categoriaForm.color + '20' }}
                  >
                    {categoriaForm.icono || '?'}
                  </div>
                  <div className="font-semibold">{categoriaForm.nombre || 'Nombre de categoría'}</div>
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-slate-200 flex gap-3 justify-end">
              <button onClick={() => setShowCategoriaModal(false)} className="btn btn-secondary">
                Cancelar
              </button>
              <button onClick={handleSaveCategoria} className="btn btn-primary">
                {editingCategoria ? 'Actualizar' : 'Crear'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Crear Workspace */}
      {showWorkspaceModal && (
        <div className="modal-overlay" onClick={() => setShowWorkspaceModal(false)}>
          <div className="modal max-w-md" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-lg">Crear Workspace</h3>
              <button onClick={() => setShowWorkspaceModal(false)} className="p-1 hover:bg-slate-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="label">Icono (opcional)</label>
                <EmojiPickerField
                  value={workspaceIcono}
                  onChange={setWorkspaceIcono}
                  placeholder="🏢"
                  size="md"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Elegí un emoji para identificar fácilmente el workspace
                </p>
              </div>
              <div>
                <label className="label">Logo (opcional)</label>
                <div className="flex items-center gap-3">
                  <input
                    type="file"
                    accept="image/*"
                    className="input"
                    onChange={async (e) => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      const maxBytes = 250 * 1024
                      if (file.size > maxBytes) {
                        setAlertData({
                          title: 'Imagen muy grande',
                          message: 'Usá un logo cuadrado y liviano (recomendado 256x256 y menos de 250KB).',
                          variant: 'warning'
                        })
                        setShowAlert(true)
                        e.target.value = ''
                        return
                      }
                      try {
                        const dataUrl = await fileToDataUrl(file)
                        setWorkspaceLogo(dataUrl)
                      } catch {
                        setAlertData({
                          title: 'Error',
                          message: 'No se pudo cargar la imagen',
                          variant: 'error'
                        })
                        setShowAlert(true)
                      }
                    }}
                  />
                  {workspaceLogo && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm whitespace-nowrap"
                      onClick={() => setWorkspaceLogo(null)}
                    >
                      Quitar
                    </button>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-1">Recomendado: 256x256 (PNG) / fondo transparente</p>
              </div>
              <div>
                <label className="label">Nombre del Workspace</label>
                <input
                  type="text"
                  className="input"
                  placeholder="ej: Finanzas Familiares"
                  value={workspaceName}
                  onChange={e => setWorkspaceName(e.target.value)}
                  onKeyPress={e => e.key === 'Enter' && handleCreateWorkspace()}
                  autoFocus
                />
                <p className="text-xs text-slate-500 mt-2">
                  Podés crear hasta 2 workspaces compartidos adicionales.
                </p>
              </div>

              {/* Preview */}
              {(workspaceName || workspaceIcono || workspaceLogo) && (
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                  <div className="text-xs text-slate-500 mb-2">Vista previa:</div>
                  <div className="flex items-center gap-2">
                    {workspaceLogo ? (
                      <img src={workspaceLogo} alt="Logo" className="w-9 h-9 rounded-lg object-cover border border-slate-200" />
                    ) : workspaceIcono ? (
                      <span className="text-2xl">{workspaceIcono}</span>
                    ) : (
                      <div className="w-9 h-9 rounded-lg bg-slate-200 flex items-center justify-center text-slate-700 font-bold">
                        {(workspaceName || 'W').charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className="font-semibold">{workspaceName || 'Nombre del workspace'}</span>
                  </div>
                </div>
              )}
            </div>
            <div className="p-4 border-t border-slate-200 flex gap-3 justify-end">
              <button onClick={() => { setShowWorkspaceModal(false); setWorkspaceName(''); setWorkspaceIcono(''); setWorkspaceLogo(null) }} className="btn btn-secondary">
                Cancelar
              </button>
              <button onClick={handleCreateWorkspace} className="btn btn-primary">
                Crear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Invitar Usuario */}
      {showInviteModal && (
        <div className="modal-overlay" onClick={() => setShowInviteModal(false)}>
          <div className="modal max-w-md w-full mx-2 sm:mx-4" onClick={e => e.stopPropagation()}>
            <div className="p-3 sm:p-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-base sm:text-lg">Invitar Usuario</h3>
              <button onClick={() => setShowInviteModal(false)} className="p-1 hover:bg-slate-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-3 sm:p-4 sm:p-6 space-y-4 max-h-[calc(100vh-180px)] overflow-y-auto">
              <div>
                <label className="label text-sm">Email del usuario</label>
                <input
                  type="email"
                  className="input w-full text-sm"
                  placeholder="usuario@ejemplo.com"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  onKeyPress={e => e.key === 'Enter' && handleInviteUser()}
                  autoFocus
                />
              </div>

              {/* SELECTORES DE PERMISOS */}
              <div className="space-y-3 pt-2">
                <div className="flex items-start sm:items-center gap-2 flex-wrap">
                  <h4 className="font-semibold text-xs sm:text-sm text-slate-700">Configurar Permisos</h4>
                  <div className="group relative">
                    <Info className="w-4 h-4 text-slate-400 cursor-help flex-shrink-0" />
                    <div className="hidden sm:block absolute left-0 bottom-full mb-2 w-64 p-3 bg-slate-800 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                      <p className="font-semibold mb-2">Niveles de Permisos:</p>
                      <ul className="space-y-1.5 text-slate-200">
                        {permissionOptions.map(opt => (
                          <li key={opt.value}>
                            <span className="font-medium">{opt.label}:</span> {opt.description}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {['gastos', 'ingresos', 'ahorros', 'tarjetas'].map((section) => {
                    const currentPermission = invitePermissions[section as keyof WorkspacePermissions]
                    const currentDescription = getPermissionDescription(currentPermission)
                    return (
                      <div key={section} className="relative w-full">
                        <div className="flex items-center gap-1 mb-1 flex-wrap">
                          <label className="text-[10px] uppercase font-bold text-slate-500 whitespace-nowrap">{section}</label>
                          {currentDescription && (
                            <div className="group relative">
                              <HelpCircle className="w-3 h-3 text-slate-400 cursor-help flex-shrink-0" />
                              <div className="hidden sm:block absolute left-0 top-full mt-1 w-56 p-2 bg-slate-800 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                                {currentDescription}
                              </div>
                            </div>
                          )}
                        </div>
                        <select
                          value={currentPermission}
                          onChange={(e) => setInvitePermissions(p => ({
                            ...p,
                            [section]: e.target.value
                          }))}
                          className="input input-sm text-xs w-full min-w-0"
                        >
                          {permissionOptions.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                        {currentDescription && (
                          <p className="text-[10px] text-slate-500 mt-1 italic break-words">{currentDescription}</p>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

            </div>
            <div className="p-3 sm:p-4 border-t border-slate-200 flex flex-col sm:flex-row gap-2 sm:gap-3 sm:justify-end">
              <button onClick={() => setShowInviteModal(false)} className="btn btn-secondary w-full sm:w-auto order-2 sm:order-1 text-sm">
                Cancelar
              </button>
              <button onClick={handleInviteUser} className="btn btn-primary w-full sm:w-auto order-1 sm:order-2 text-sm">
                Enviar Invitación
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Alert Modal */}
      <AlertModal
        isOpen={showAlert}
        onClose={() => setShowAlert(false)}
        title={alertData.title}
        message={alertData.message}
        variant={alertData.variant}
      />

      {/* Confirm Modal - Eliminar Invitación Individual */}
      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false)
          setInvitationToDelete(null)
        }}
        onConfirm={async () => {
          if (invitationToDelete) {
            const result = await deleteInvitation(invitationToDelete.id)
            if (result.error) {
              setAlertData({
                title: 'Error',
                message: 'No se pudo eliminar la invitación',
                variant: 'error'
              })
            } else {
              setAlertData({
                title: 'Invitación eliminada',
                message: `La invitación a ${invitationToDelete.email} fue eliminada del historial.`,
                variant: 'success'
              })
            }
            setShowAlert(true)
            setShowDeleteConfirm(false)
            setInvitationToDelete(null)
          }
        }}
        title="Eliminar Invitación"
        message={invitationToDelete ? `¿Estás seguro de que deseas eliminar esta invitación a ${invitationToDelete.email}?\n\nEsta acción no se puede deshacer y la invitación será eliminada permanentemente del historial.` : '¿Estás seguro de que deseas eliminar esta invitación?'}
        confirmText="Eliminar"
        cancelText="Cancelar"
        variant="danger"
      />

      {/* Confirm Modal - Eliminar Todo el Historial */}
      <ConfirmModal
        isOpen={showDeleteAllConfirm}
        onClose={() => {
          setShowDeleteAllConfirm(false)
          setWorkspaceToDeleteAll(null)
        }}
        onConfirm={async () => {
          if (workspaceToDeleteAll === 'categorias_gastos') {
            await handleDeleteMasivoCategoriasGastos()
          } else if (workspaceToDeleteAll === 'categorias_ingresos') {
            await handleDeleteMasivoCategoriasIngresos()
          } else if (workspaceToDeleteAll) {
            const result = await deleteAllInvitations(workspaceToDeleteAll)
            if (result.error) {
              setAlertData({
                title: 'Error',
                message: 'No se pudo eliminar el historial de invitaciones',
                variant: 'error'
              })
            } else {
              setAlertData({
                title: 'Historial eliminado',
                message: 'Se eliminó todo el historial de invitaciones del workspace.',
                variant: 'success'
              })
            }
            setShowAlert(true)
          }
          setShowDeleteAllConfirm(false)
          setWorkspaceToDeleteAll(null)
        }}
        title={workspaceToDeleteAll === 'categorias_gastos' || workspaceToDeleteAll === 'categorias_ingresos' ? 'Eliminar Categorías' : 'Eliminar Todo el Historial'}
        message={
          workspaceToDeleteAll === 'categorias_gastos'
            ? `¿Estás seguro de que querés eliminar ${selectedCategoriasGastos.size} categoría(s) de gastos? Esta acción no se puede deshacer.`
            : workspaceToDeleteAll === 'categorias_ingresos'
            ? `¿Estás seguro de que querés eliminar ${selectedCategoriasIngresos.size} categoría(s) de ingresos? Esta acción no se puede deshacer.`
            : '¿Estás seguro de que deseas eliminar todo el historial de invitaciones de este workspace?\n\nEsta acción eliminará permanentemente todas las invitaciones (pendientes, aceptadas, rechazadas y canceladas) y no se puede deshacer.'
        }
        confirmText={workspaceToDeleteAll === 'categorias_gastos' || workspaceToDeleteAll === 'categorias_ingresos' ? 'Eliminar' : 'Eliminar Todo'}
        cancelText="Cancelar"
        variant="danger"
      />

      {/* Modal de Invitación Espacio Personal */}
      {showPersonalInviteModal && (
        <div className="modal-overlay" onClick={() => setShowPersonalInviteModal(false)}>
          <div className="modal max-w-md w-full mx-2 sm:mx-4" onClick={e => e.stopPropagation()}>
            <div className="p-3 sm:p-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-base sm:text-lg">Invitar al Espacio Personal</h3>
              <button onClick={() => setShowPersonalInviteModal(false)} className="p-1 hover:bg-slate-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-3 sm:p-4 sm:p-6 space-y-4 max-h-[calc(100vh-180px)] overflow-y-auto">
              <div>
                <label className="label text-sm">Email del usuario</label>
                <input
                  type="email"
                  className="input w-full text-sm"
                  placeholder="usuario@ejemplo.com"
                  value={personalInviteEmail}
                  onChange={e => setPersonalInviteEmail(e.target.value)}
                  onKeyPress={e => e.key === 'Enter' && handleInvitePersonal()}
                  autoFocus
                />
              </div>

              {/* SELECTORES DE PERMISOS */}
              <div className="space-y-3 pt-2">
                <div className="flex items-start sm:items-center gap-2 flex-wrap">
                  <h4 className="font-semibold text-xs sm:text-sm text-slate-700">Configurar Permisos</h4>
                  <div className="group relative">
                    <Info className="w-4 h-4 text-slate-400 cursor-help flex-shrink-0" />
                    <div className="hidden sm:block absolute left-0 bottom-full mb-2 w-64 p-3 bg-slate-800 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                      <p className="font-semibold mb-2">Niveles de Permisos:</p>
                      <ul className="space-y-1.5 text-slate-200">
                        {permissionOptions.map(opt => (
                          <li key={opt.value}>
                            <span className="font-medium">{opt.label}:</span> {opt.description}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {['gastos', 'ingresos', 'ahorros', 'tarjetas'].map((section) => {
                    const currentPermission = personalInvitePermissions[section as keyof WorkspacePermissions]
                    const currentDescription = getPermissionDescription(currentPermission)
                    return (
                      <div key={section} className="relative w-full">
                        <div className="flex items-center gap-1 mb-1 flex-wrap">
                          <label className="text-[10px] uppercase font-bold text-slate-500 whitespace-nowrap">{section}</label>
                          {currentDescription && (
                            <div className="group relative">
                              <HelpCircle className="w-3 h-3 text-slate-400 cursor-help flex-shrink-0" />
                              <div className="hidden sm:block absolute left-0 top-full mt-1 w-56 p-2 bg-slate-800 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                                {currentDescription}
                              </div>
                            </div>
                          )}
                        </div>
                        <select
                          value={currentPermission}
                          onChange={(e) => setPersonalInvitePermissions(p => ({
                            ...p,
                            [section]: e.target.value
                          }))}
                          className="input input-sm text-xs w-full min-w-0"
                        >
                          {permissionOptions.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                        {currentDescription && (
                          <p className="text-[10px] text-slate-500 mt-1 italic break-words">{currentDescription}</p>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

            </div>
            <div className="p-3 sm:p-4 border-t border-slate-200 flex flex-col sm:flex-row gap-2 sm:gap-3 sm:justify-end">
              <button onClick={() => setShowPersonalInviteModal(false)} className="btn btn-secondary w-full sm:w-auto order-2 sm:order-1 text-sm">
                Cancelar
              </button>
              <button onClick={handleInvitePersonal} className="btn btn-primary w-full sm:w-auto order-1 sm:order-2 text-sm">
                Enviar Invitación
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
