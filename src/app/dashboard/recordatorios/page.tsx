'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useWorkspace } from '@/hooks/useWorkspace'
import { collection, addDoc, updateDoc, deleteDoc, doc, getDocs, query, where, orderBy, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { Recordatorio, ReminderChannel } from '@/types'
import { Plus, Edit2, Trash2, X, Bell, Calendar, CheckCircle2, Clock } from 'lucide-react'
import { ConfirmModal } from '@/components/Modal'

const DIAS_ANTES_OPTIONS = [
  { value: 0, label: 'El mismo día' },
  { value: 1, label: '1 día antes' },
  { value: 2, label: '2 días antes' },
  { value: 3, label: '3 días antes' },
  { value: 7, label: '1 semana antes' },
]

export default function RecordatoriosPage() {
  const { user } = useAuth()
  const { currentWorkspace } = useWorkspace()

  const [recordatorios, setRecordatorios] = useState<Recordatorio[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Recordatorio | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)
  const [showConfirmDelete, setShowConfirmDelete] = useState(false)

  const [form, setForm] = useState({
    titulo: '',
    descripcion: '',
    fecha: '',
    dias_antes: [0] as number[],
    canales: ['push'] as ReminderChannel[],
  })

  const fetchRecordatorios = useCallback(async () => {
    if (!user || !currentWorkspace?.id) {
      // Dependencies not ready yet. Set loading to false to avoid infinite
      // "Cargando..." state when this runs before workspace is initialized.
      // When user/workspace become available, the useCallback ref changes and
      // the useEffect below re-triggers the fetch with loading=true.
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const constraints: any[] = [
        where('user_id', '==', user.uid),
        where('workspace_id', '==', currentWorkspace.id),
        orderBy('fecha', 'asc'),
      ]

      const snap = await getDocs(query(collection(db, 'recordatorios'), ...constraints))
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Recordatorio))
      setRecordatorios(data)
    } catch (e) {
      console.error('[Recordatorios] Error fetching:', e)
    }
    setLoading(false)
  }, [user, currentWorkspace?.id])

  useEffect(() => {
    fetchRecordatorios()
  }, [fetchRecordatorios])

  const resetForm = () => {
    setForm({
      titulo: '',
      descripcion: '',
      fecha: '',
      dias_antes: [0],
      canales: ['push'],
    })
  }

  const openNew = () => {
    resetForm()
    setEditing(null)
    setShowModal(true)
  }

  const openEdit = (r: Recordatorio) => {
    setEditing(r)
    setForm({
      titulo: r.titulo,
      descripcion: r.descripcion,
      fecha: r.fecha,
      dias_antes: r.dias_antes || [0],
      canales: r.canales || ['push'],
    })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!user || !form.titulo.trim() || !form.fecha) return
    if (!currentWorkspace?.id) {
      console.error('[Recordatorios] No workspace available - cannot save')
      return
    }
    setSaving(true)

    const data: any = {
      titulo: form.titulo.trim().slice(0, 80),
      descripcion: form.descripcion.trim(),
      fecha: form.fecha,
      dias_antes: form.dias_antes,
      canales: form.canales,
      user_id: user.uid,
      workspace_id: currentWorkspace.id,
      created_by: user.uid,
      updated_at: serverTimestamp(),
    }

    try {
      if (editing) {
        await updateDoc(doc(db, 'recordatorios', editing.id), data)
      } else {
        data.status = 'activo'
        data.created_at = serverTimestamp()
        await addDoc(collection(db, 'recordatorios'), data)
      }
      await fetchRecordatorios()
      setShowModal(false)
      resetForm()
      setEditing(null)
    } catch (e) {
      console.error('[Recordatorios] Error saving:', e)
    }
    setSaving(false)
  }

  const handleDelete = async () => {
    if (!deleteTargetId) return
    try {
      await deleteDoc(doc(db, 'recordatorios', deleteTargetId))
      await fetchRecordatorios()
    } catch (e) {
      console.error('[Recordatorios] Error deleting:', e)
    }
    setDeleteTargetId(null)
    setShowConfirmDelete(false)
  }

  const handleToggleComplete = async (r: Recordatorio) => {
    const newStatus = r.status === 'activo' ? 'completado' : 'activo'
    try {
      await updateDoc(doc(db, 'recordatorios', r.id), { status: newStatus, updated_at: serverTimestamp() })
      await fetchRecordatorios()
    } catch (e) {
      console.error('[Recordatorios] Error toggling status:', e)
    }
  }

  const toggleDiasAntes = (val: number) => {
    setForm(prev => {
      const current = prev.dias_antes
      if (current.includes(val)) {
        const next = current.filter(d => d !== val)
        return { ...prev, dias_antes: next.length > 0 ? next : [0] }
      }
      return { ...prev, dias_antes: [...current, val].sort((a, b) => a - b) }
    })
  }

  const toggleCanal = (canal: ReminderChannel) => {
    setForm(prev => {
      const current = prev.canales
      if (current.includes(canal)) {
        const next = current.filter(c => c !== canal)
        return { ...prev, canales: next.length > 0 ? next : ['push'] }
      }
      return { ...prev, canales: [...current, canal] }
    })
  }

  const isOverdue = (fecha: string) => {
    const today = new Date().toISOString().split('T')[0]
    return fecha < today
  }

  const isToday = (fecha: string) => {
    const today = new Date().toISOString().split('T')[0]
    return fecha === today
  }

  const formatDate = (fecha: string) => {
    const d = new Date(fecha + 'T12:00:00')
    return d.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
  }

  const activeRecordatorios = recordatorios.filter(r => r.status === 'activo')
  const completedRecordatorios = recordatorios.filter(r => r.status === 'completado')

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Recordatorios</h1>
          <p className="text-sm text-slate-500 mt-1">
            {activeRecordatorios.length} activo{activeRecordatorios.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button onClick={openNew} className="btn btn-primary">
          <Plus className="w-4 h-4" />
          Nuevo recordatorio
        </button>
      </div>

      {/* Active reminders */}
      {loading ? (
        <div className="card p-12 text-center">
          <Clock className="w-10 h-10 mx-auto text-slate-300 animate-spin mb-3" />
          <p className="text-slate-500 text-sm">Cargando recordatorios...</p>
        </div>
      ) : activeRecordatorios.length === 0 && completedRecordatorios.length === 0 ? (
        <div className="card p-12 text-center">
          <Bell className="w-16 h-16 mx-auto text-slate-200 mb-4" />
          <p className="text-slate-500 mb-4">No tenés recordatorios todavía</p>
          <button onClick={openNew} className="btn btn-primary">
            <Plus className="w-4 h-4" />
            Crear tu primer recordatorio
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {activeRecordatorios.map(r => (
            <div
              key={r.id}
              className={`card p-4 flex items-start gap-4 transition-all duration-200 hover:shadow-md ${
                isOverdue(r.fecha) ? 'border-red-200 bg-red-50/30' :
                isToday(r.fecha) ? 'border-primary-200 bg-primary-50/30' : ''
              }`}
            >
              <button
                onClick={() => handleToggleComplete(r)}
                className="mt-0.5 w-5 h-5 rounded-full border-2 border-slate-300 hover:border-primary flex-shrink-0 transition-colors"
                title="Marcar como completado"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-medium text-slate-800 text-sm">{r.titulo}</h3>
                  {isOverdue(r.fecha) && (
                    <span className="px-1.5 py-0.5 bg-red-100 text-red-600 text-[10px] font-semibold rounded uppercase">Vencido</span>
                  )}
                  {isToday(r.fecha) && (
                    <span className="px-1.5 py-0.5 bg-primary-100 text-primary-700 text-[10px] font-semibold rounded uppercase">Hoy</span>
                  )}
                </div>
                {r.descripcion && (
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2">{r.descripcion}</p>
                )}
                <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {formatDate(r.fecha)}
                  </span>
                  {r.dias_antes && r.dias_antes.length > 0 && r.dias_antes.some(d => d > 0) && (
                    <span className="flex items-center gap-1">
                      <Bell className="w-3 h-3" />
                      {r.dias_antes.filter(d => d > 0).map(d => `${d}d`).join(', ')} antes
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    {r.canales.includes('push') && <Bell className="w-3 h-3" />}
                    {r.canales.includes('email') && <span>@</span>}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={() => openEdit(r)} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => { setDeleteTargetId(r.id); setShowConfirmDelete(true) }}
                  className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Completed reminders */}
      {completedRecordatorios.length > 0 && (
        <div>
          <h2 className="section-title mb-3 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            Completados ({completedRecordatorios.length})
          </h2>
          <div className="space-y-2">
            {completedRecordatorios.map(r => (
              <div key={r.id} className="card p-3 flex items-center gap-3 opacity-60">
                <button
                  onClick={() => handleToggleComplete(r)}
                  className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0"
                  title="Reactivar"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                </button>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-slate-500 text-sm line-through">{r.titulo}</h3>
                  <span className="text-xs text-slate-400">{formatDate(r.fecha)}</span>
                </div>
                <button
                  onClick={() => { setDeleteTargetId(r.id); setShowConfirmDelete(true) }}
                  className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h2 className="section-title">{editing ? 'Editar recordatorio' : 'Nuevo recordatorio'}</h2>
              <button onClick={() => setShowModal(false)} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Título */}
              <div>
                <label className="label">Título (máx. 80 caracteres)</label>
                <input
                  type="text"
                  className="input"
                  placeholder="Ej: Pagar factura de luz"
                  maxLength={80}
                  value={form.titulo}
                  onChange={e => setForm(prev => ({ ...prev, titulo: e.target.value }))}
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block text-right">{form.titulo.length}/80</span>
              </div>

              {/* Descripción */}
              <div>
                <label className="label">Descripción (opcional)</label>
                <textarea
                  className="input"
                  placeholder="Detalles adicionales..."
                  rows={3}
                  value={form.descripcion}
                  onChange={e => setForm(prev => ({ ...prev, descripcion: e.target.value }))}
                />
              </div>

              {/* Fecha */}
              <div>
                <label className="label">Fecha del recordatorio</label>
                <input
                  type="date"
                  className="input"
                  value={form.fecha}
                  onChange={e => setForm(prev => ({ ...prev, fecha: e.target.value }))}
                />
              </div>

              {/* Días antes */}
              <div>
                <label className="label">Recordar</label>
                <div className="flex flex-wrap gap-1.5">
                  {DIAS_ANTES_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => toggleDiasAntes(opt.value)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        form.dias_antes.includes(opt.value)
                          ? 'bg-primary text-white shadow-sm'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Canales */}
              <div>
                <label className="label">Canal de notificación</label>
                <div className="flex gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.canales.includes('push')}
                      onChange={() => toggleCanal('push')}
                      className="w-4 h-4 text-primary rounded border-slate-300"
                    />
                    <span className="text-sm text-slate-600">Push notification</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.canales.includes('email')}
                      onChange={() => toggleCanal('email')}
                      className="w-4 h-4 text-primary rounded border-slate-300"
                    />
                    <span className="text-sm text-slate-600">Email</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="p-5 border-t border-slate-100 flex gap-3">
              <button onClick={() => setShowModal(false)} className="btn btn-secondary flex-1">
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.titulo.trim() || !form.fecha}
                className="btn btn-primary flex-1"
              >
                {saving ? 'Guardando...' : editing ? 'Guardar cambios' : 'Crear recordatorio'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete Modal */}
      <ConfirmModal
        isOpen={showConfirmDelete}
        onClose={() => { setShowConfirmDelete(false); setDeleteTargetId(null) }}
        onConfirm={handleDelete}
        title="Eliminar recordatorio"
        message="¿Estás seguro de que querés eliminar este recordatorio?"
        confirmText="Eliminar"
        variant="danger"
      />
    </div>
  )
}
