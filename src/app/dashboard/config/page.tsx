'use client'

import { useState, useEffect } from 'react'
import { useData } from '@/hooks/useData'
import { useAuth } from '@/hooks/useAuth'
import { useWorkspace } from '@/hooks/useWorkspace'
import { Save, Plus, X, Edit2, Users, Mail, Trash2, Shield, UserCheck, CheckCircle2 } from 'lucide-react'
import { AlertModal } from '@/components/Modal'
import type { WorkspacePermissions } from '@/types'

export default function ConfigPage() {
  const { profile, updateProfile, user } = useAuth()
  const {
    tags, addTag, deleteTag,
    categorias, addCategoria, updateCategoria, deleteCategoria,
  } = useData()
  const {
    workspaces,
    createWorkspace,
    updateWorkspace,
    deleteWorkspace,
    inviteUser,
    members,
    invitations,
    acceptInvitation,
    rejectInvitation,
    updateMemberPermissions,
    removeMember
  } = useWorkspace()

  const [budgetEnabled, setBudgetEnabled] = useState(false)
  const [budgetArs, setBudgetArs] = useState('')
  const [budgetUsd, setBudgetUsd] = useState('')
  const [ingresosEnabled, setIngresosEnabled] = useState(false)
  const [newTag, setNewTag] = useState('')
  const [saving, setSaving] = useState(false)
  const [savingIngresos, setSavingIngresos] = useState(false)

  // Nombre Espacio Personal
  const [personalName, setPersonalName] = useState('')

  // Modal states
  const [showAlert, setShowAlert] = useState(false)
  const [alertData, setAlertData] = useState({ title: '', message: '', variant: 'success' as 'success' | 'error' | 'warning' | 'info' })

  // Categoría modal states
  const [showCategoriaModal, setShowCategoriaModal] = useState(false)
  const [editingCategoria, setEditingCategoria] = useState<any>(null)
  const [categoriaForm, setCategoriaForm] = useState({ nombre: '', icono: '', color: '#6366f1' })

  // Workspace modal states
  const [showWorkspaceModal, setShowWorkspaceModal] = useState(false)
  const [workspaceName, setWorkspaceName] = useState('')
  
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

  const [expandedWorkspaceId, setExpandedWorkspaceId] = useState<string | null>(null)
  const [editingWorkspaceId, setEditingWorkspaceId] = useState<string | null>(null)
  const [editingWorkspaceName, setEditingWorkspaceName] = useState('')

  // Inicializar valores del perfil
  useEffect(() => {
    if (profile) {
      const hasArs = (profile.budget_ars || 0) > 0
      const hasUsd = (profile.budget_usd || 0) > 0
      setBudgetEnabled(hasArs || hasUsd)
      setBudgetArs(profile.budget_ars ? String(profile.budget_ars) : '')
      setBudgetUsd(profile.budget_usd ? String(profile.budget_usd) : '')
      setIngresosEnabled(profile.ingresos_habilitado || false)
      setPersonalName(profile.personal_workspace_name || '')
    }
  }, [profile])

  const handleSaveIngresos = async () => {
    setSavingIngresos(true)
    await updateProfile({
      ingresos_habilitado: ingresosEnabled
    })
    setSavingIngresos(false)

    setAlertData({
      title: ingresosEnabled ? '¡Ingresos activados!' : 'Ingresos desactivados',
      message: ingresosEnabled
        ? 'Ahora podés registrar tus ingresos en la sección correspondiente'
        : 'La sección de ingresos se ocultó del menú',
      variant: 'success'
    })
    setShowAlert(true)
  }

  const handleSavePersonalName = async () => {
    if (!personalName.trim()) return
    setSaving(true)
    await updateProfile({ personal_workspace_name: personalName })
    setSaving(false)
    setAlertData({
      title: 'Nombre actualizado',
      message: 'Tu espacio personal ha sido renombrado.',
      variant: 'success'
    })
    setShowAlert(true)
  }

  const handleSaveBudget = async () => {
    setSaving(true)

    if (budgetEnabled) {
      await updateProfile({
        budget_ars: parseFloat(budgetArs) || 0,
        budget_usd: parseFloat(budgetUsd) || 0
      })
    } else {
      await updateProfile({
        budget_ars: 0,
        budget_usd: 0
      })
    }

    setSaving(false)
  }

  const handleAddTag = async () => {
    if (!newTag.trim()) return
    await addTag(newTag.trim())
    setNewTag('')
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

    const result = await createWorkspace(workspaceName)

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
      setAlertData({
        title: 'Error',
        message: 'No se pudo enviar la invitación',
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

  // --- LÓGICA DE PERMISOS CON CONFIRMACIÓN ---
  const handlePermissionChange = (memberId: string, section: string, newValue: string) => {
    setPendingPermissions(prev => ({
      ...prev,
      [`${memberId}_${section}`]: newValue
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
      const [memberId, section] = key.split('_')
      if (!changesByMember[memberId]) {
        changesByMember[memberId] = {}
      }
      changesByMember[memberId][section as keyof WorkspacePermissions] = value as any
    })

    // Aplicar todos los cambios
    const promises = Object.entries(changesByMember).map(async ([memberId, newPermissions]) => {
      const member = members.find(m => m.id === memberId)
      if (!member) return { error: new Error('Miembro no encontrado') }

      const updatedPermissions = {
        ...member.permissions,
        ...newPermissions
      }

      return updateMemberPermissions(memberId, updatedPermissions)
    })

    const results = await Promise.all(promises)
    const hasError = results.some(r => r && r.error)

    if (hasError) {
      setAlertData({
        title: 'Error',
        message: 'Algunos permisos no se pudieron actualizar',
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

  const handleEditWorkspace = (workspaceId: string, currentName: string) => {
    setEditingWorkspaceId(workspaceId)
    setEditingWorkspaceName(currentName)
  }

  const handleSaveWorkspaceName = async () => {
    if (!editingWorkspaceId || !editingWorkspaceName.trim()) {
      return
    }

    const result = await updateWorkspace(editingWorkspaceId, editingWorkspaceName)

    if (result.error) {
      setAlertData({
        title: 'Error',
        message: 'No se pudo actualizar el nombre',
        variant: 'error'
      })
    } else {
      setAlertData({
        title: 'Nombre actualizado',
        message: 'El workspace fue renombrado exitosamente',
        variant: 'success'
      })
      setEditingWorkspaceId(null)
      setEditingWorkspaceName('')
    }

    setShowAlert(true)
  }

  const handleCancelEditWorkspace = () => {
    setEditingWorkspaceId(null)
    setEditingWorkspaceName('')
  }

  const commonIcons = ['🍔', '🏠', '🚗', '🎮', '👕', '💊', '📚', '✈️', '🎬', '🏋️', '🐕', '💰', '🔧', '📱', '💡']

  // Permisos disponibles para el selector
  const permissionOptions = [
    { value: 'ninguno', label: 'Sin Acceso' },
    { value: 'solo_lectura', label: 'Solo Lectura' },
    { value: 'solo_propios', label: 'Solo sus datos' },
    { value: 'ver_todo_agregar_propio', label: 'Ver todo + Agregar' },
    { value: 'admin', label: 'Administrador Total' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Configuración</h1>
        <p className="text-slate-500">Personalizá tu experiencia</p>
      </div>

      {/* Sección Nombre de Espacio Personal */}
      <div className="card p-5">
        <h3 className="font-bold mb-4">🏠 Espacio Personal</h3>
        <div className="flex gap-2">
          <input
            type="text"
            className="input flex-1"
            placeholder="Ej: Mis Finanzas, Casa, etc."
            value={personalName}
            onChange={e => setPersonalName(e.target.value)}
          />
          <button onClick={handleSavePersonalName} disabled={saving} className="btn btn-primary">
            <Edit2 className="w-4 h-4" /> Renombrar
          </button>
        </div>
      </div>

      {/* Sección de Workspaces */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold">🏢 Workspaces Colaborativos</h3>
            <p className="text-slate-500 text-sm mt-1">
              Compartí tus finanzas con otras personas
            </p>
          </div>
          <button
            onClick={() => setShowWorkspaceModal(true)}
            disabled={workspaces.filter(w => w.owner_id === user?.uid).length >= 2}
            className="btn btn-primary"
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
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      {editingWorkspaceId === ws.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={editingWorkspaceName}
                            onChange={(e) => setEditingWorkspaceName(e.target.value)}
                            className="input input-sm flex-1 max-w-xs"
                            autoFocus
                            onKeyPress={(e) => e.key === 'Enter' && handleSaveWorkspaceName()}
                          />
                          <button onClick={handleSaveWorkspaceName} className="btn btn-primary btn-sm">
                            Guardar
                          </button>
                          <button onClick={handleCancelEditWorkspace} className="btn btn-secondary btn-sm">
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold">{ws.name}</h4>
                            
                            {/* ETIQUETA DE ROL */}
                            {isOwner ? (
                              <span className="bg-slate-200 text-slate-700 text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                                <Shield className="w-3 h-3" /> PROPIETARIO
                              </span>
                            ) : (
                              <span className="bg-indigo-200 text-indigo-800 text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                                <UserCheck className="w-3 h-3" /> COLABORADOR
                              </span>
                            )}

                            {isOwner && (
                              <div className="flex gap-1 ml-2">
                                <button
                                  onClick={() => handleEditWorkspace(ws.id, ws.name)}
                                  className="p-1 hover:bg-slate-200 rounded transition"
                                  title="Editar nombre"
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
                    <div className="flex gap-2">
                      {/* SOLO EL DUEÑO PUEDE INVITAR Y GESTIONAR MIEMBROS */}
                      {isOwner && editingWorkspaceId !== ws.id && (
                        <>
                          <button
                            onClick={() => {
                              setInviteWorkspaceId(ws.id)
                              setShowInviteModal(true)
                            }}
                            className="btn btn-secondary btn-sm"
                          >
                            <Mail className="w-4 h-4" /> Invitar
                          </button>
                          <button
                            onClick={() => setExpandedWorkspaceId(isExpanded ? null : ws.id)}
                            className="btn btn-secondary btn-sm"
                          >
                            <Users className="w-4 h-4" /> {isExpanded ? 'Ocultar' : 'Ver'} Miembros
                          </button>
                        </>
                      )}
                      
                      {/* SI SOY COLABORADOR SOLO PUEDO VER, PERO NO GESTIONAR */}
                      {!isOwner && (
                        <div className="text-xs text-indigo-600 font-medium self-center px-3">
                          Acceso Compartido
                        </div>
                      )}
                    </div>
                  </div>

                  {/* GESTIÓN DE MIEMBROS - Solo visible para el dueño */}
                  {isOwner && isExpanded && (
                    <div className="mt-4 pt-4 border-t border-slate-200">
                      <h5 className="font-semibold mb-3 text-sm">Gestión de Permisos</h5>

                      {workspaceMembers.length > 0 ? (
                        <div className="space-y-3">
                          {workspaceMembers.map(member => (
                            <div key={member.id} className="bg-white rounded-lg p-3 border border-slate-200">
                              <div className="flex items-center justify-between mb-3">
                                <div>
                                  <p className="font-medium text-sm flex items-center gap-2">
                                    {member.user_email}
                                    {member.user_id === user?.uid && <span className="text-xs text-slate-400">(Tú)</span>}
                                  </p>
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
                                  const pendingValue = pendingPermissions[`${member.id}_${section}`]
                                  const currentValue = member.permissions[section as keyof WorkspacePermissions]
                                  const hasChange = pendingValue && pendingValue !== currentValue

                                  return (
                                    <div key={section} className="flex flex-col">
                                      <label className="text-[10px] uppercase font-bold text-slate-500 mb-1">{section}</label>
                                      <select
                                        className={`input input-sm text-xs w-full ${hasChange ? 'border-indigo-500 bg-indigo-50' : ''}`}
                                        value={pendingValue || currentValue}
                                        onChange={(e) => handlePermissionChange(member.id, section, e.target.value)}
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
                          ))}
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

      {/* Sección de Ingresos */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold">💵 Registro de Ingresos</h3>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={ingresosEnabled}
              onChange={e => setIngresosEnabled(e.target.checked)}
              className="w-5 h-5 accent-indigo-500"
            />
            <span className="text-sm font-medium">Activar</span>
          </label>
        </div>

        {ingresosEnabled ? (
          <div className="bg-emerald-50 rounded-xl p-4">
            <p className="text-emerald-700 font-medium mb-1">✓ Sección de ingresos activada</p>
            <p className="text-emerald-600 text-sm">
              Podés registrar tus ingresos mensuales con categorías y tags personalizados
            </p>
          </div>
        ) : (
          <div className="bg-slate-50 rounded-xl p-4 text-center text-slate-500">
            <p>Sección de ingresos desactivada</p>
            <p className="text-sm">Activá el checkbox para habilitar el registro de ingresos</p>
          </div>
        )}

        <button onClick={handleSaveIngresos} disabled={savingIngresos} className="btn btn-primary mt-4">
          <Save className="w-4 h-4" />
          {savingIngresos ? 'Guardando...' : 'Guardar'}
        </button>
      </div>

      {/* Presupuesto */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold">💰 Presupuesto Mensual</h3>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={budgetEnabled}
              onChange={e => setBudgetEnabled(e.target.checked)}
              className="w-5 h-5 accent-indigo-500"
            />
            <span className="text-sm font-medium">Activar</span>
          </label>
        </div>
        
        {budgetEnabled ? (
          <>
            <p className="text-slate-500 text-sm mb-4">Establecé un límite mensual para controlar tus gastos</p>
            <div className="grid sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="label">Presupuesto ARS</label>
                <input
                  type="number"
                  className="input"
                  placeholder="500000"
                  value={budgetArs}
                  onChange={e => setBudgetArs(e.target.value)}
                />
              </div>
              <div>
                <label className="label">Presupuesto USD</label>
                <input
                  type="number"
                  className="input"
                  placeholder="500"
                  value={budgetUsd}
                  onChange={e => setBudgetUsd(e.target.value)}
                />
              </div>
            </div>
          </>
        ) : (
          <div className="bg-slate-50 rounded-xl p-4 text-center text-slate-500">
            <p>Sin presupuesto configurado</p>
            <p className="text-sm">Activá el checkbox para establecer un límite mensual</p>
          </div>
        )}
        
        <button onClick={handleSaveBudget} disabled={saving} className="btn btn-primary mt-4">
          <Save className="w-4 h-4" />
          {saving ? 'Guardando...' : 'Guardar'}
        </button>
      </div>

      {/* Categorías */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold">📂 Categorías</h3>
            <p className="text-slate-500 text-sm mt-1">Administrá tus categorías de gastos</p>
          </div>
          <button
            onClick={() => {
              setEditingCategoria(null)
              setCategoriaForm({ nombre: '', icono: '', color: '#6366f1' })
              setShowCategoriaModal(true)
            }}
            className="btn btn-primary"
          >
            <Plus className="w-4 h-4" /> Nueva Categoría
          </button>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          {categorias.map(c => (
            <div
              key={c.id}
              className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl hover:bg-slate-100 transition"
            >
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

      {/* Tags */}
      <div className="card p-5">
        <h3 className="font-bold mb-4">🏷️ Tags Personalizados</h3>
        <p className="text-slate-500 text-sm mb-4">Creá tags para organizar tus gastos</p>

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
            <span className="text-slate-400">Sin tags</span>
          )}
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            className="input flex-1"
            placeholder="Nuevo tag..."
            value={newTag}
            onChange={e => setNewTag(e.target.value)}
            onKeyPress={e => e.key === 'Enter' && handleAddTag()}
          />
          <button onClick={handleAddTag} className="btn btn-primary">
            <Plus className="w-4 h-4" /> Agregar
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="card p-5 bg-slate-50">
        <h3 className="font-bold mb-2">ℹ️ Información</h3>
        <div className="text-sm text-slate-600 space-y-1">
          <p><strong>Email:</strong> {profile?.email}</p>
          <p><strong>Usuario:</strong> {profile?.nombre}</p>
          <p><strong>Versión:</strong> 2.0.0</p>
        </div>
      </div>

      {/* Modal de Categoría */}
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
                <div className="grid grid-cols-8 gap-2 mb-2">
                  {commonIcons.map(icon => (
                    <button
                      key={icon}
                      onClick={() => setCategoriaForm(f => ({ ...f, icono: icon }))}
                      className={`p-3 text-2xl rounded-lg border-2 transition flex items-center justify-center ${
                        categoriaForm.icono === icon
                          ? 'border-indigo-500 bg-indigo-50'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  className="input text-2xl text-center"
                  placeholder="O escribí un emoji"
                  value={categoriaForm.icono}
                  onChange={e => setCategoriaForm(f => ({ ...f, icono: e.target.value }))}
                  maxLength={2}
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
            </div>
            <div className="p-4 border-t border-slate-200 flex gap-3 justify-end">
              <button onClick={() => setShowWorkspaceModal(false)} className="btn btn-secondary">
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
          <div className="modal max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-lg">Invitar Usuario</h3>
              <button onClick={() => setShowInviteModal(false)} className="p-1 hover:bg-slate-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 sm:p-6 space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto">
              <div>
                <label className="label">Email del usuario</label>
                <input
                  type="email"
                  className="input"
                  placeholder="usuario@ejemplo.com"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  onKeyPress={e => e.key === 'Enter' && handleInviteUser()}
                  autoFocus
                />
              </div>

              {/* SELECTORES DE PERMISOS */}
              <div className="space-y-3 pt-2">
                <h4 className="font-semibold text-sm text-slate-700">Configurar Permisos</h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {['gastos', 'ingresos', 'ahorros', 'tarjetas'].map((section) => (
                    <div key={section}>
                      <label className="text-[10px] uppercase font-bold text-slate-500">{section}</label>
                      <select
                        value={invitePermissions[section as keyof WorkspacePermissions]}
                        onChange={(e) => setInvitePermissions(p => ({
                          ...p,
                          [section]: e.target.value
                        }))}
                        className="input input-sm text-xs w-full"
                      >
                        {permissionOptions.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

            </div>
            <div className="p-4 border-t border-slate-200 flex flex-col sm:flex-row gap-3 sm:justify-end">
              <button onClick={() => setShowInviteModal(false)} className="btn btn-secondary order-2 sm:order-1">
                Cancelar
              </button>
              <button onClick={handleInviteUser} className="btn btn-primary order-1 sm:order-2">
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
    </div>
  )
}
