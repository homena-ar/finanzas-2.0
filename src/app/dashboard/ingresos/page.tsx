'use client'

import { useState } from 'react'
import { useData } from '@/hooks/useData'
import { formatMoney, getMonthName } from '@/lib/utils'
import { Plus, Edit2, Trash2, X, Wallet } from 'lucide-react'
import { Ingreso } from '@/types'
import { ConfirmModal, AlertModal } from '@/components/Modal'

export default function IngresosPage() {
  const {
    ingresos, categoriasIngresos, tagsIngresos,
    currentMonth, monthKey, getIngresosMes,
    addIngreso, updateIngreso, deleteIngreso,
    addTagIngreso, addCategoriaIngreso
  } = useData()

  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Ingreso | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    descripcion: '',
    categoria_id: '',
    monto: '',
    moneda: 'ARS' as 'ARS' | 'USD',
    fecha: new Date().toISOString().split('T')[0],
    tag_ids: [] as string[]
  })

  // Modal states
  const [showConfirmDelete, setShowConfirmDelete] = useState(false)
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)
  const [showAlert, setShowAlert] = useState(false)
  const [alertData, setAlertData] = useState({ title: '', message: '', variant: 'info' as 'success' | 'error' | 'warning' | 'info' })

  // New tag/categoria creation states
  const [showNewTagInput, setShowNewTagInput] = useState(false)
  const [newTagName, setNewTagName] = useState('')
  const [showNewCategoriaInput, setShowNewCategoriaInput] = useState(false)
  const [newCategoria, setNewCategoria] = useState({ nombre: '', icono: '💵', color: '#3b82f6' })

  const ingresosMes = getIngresosMes(monthKey)

  // Calculate totals
  const totalARS = ingresosMes.filter(i => i.moneda === 'ARS').reduce((sum, i) => sum + i.monto, 0)
  const totalUSD = ingresosMes.filter(i => i.moneda === 'USD').reduce((sum, i) => sum + i.monto, 0)

  const resetForm = () => {
    setForm({
      descripcion: '',
      categoria_id: categoriasIngresos[0]?.id || '',
      monto: '',
      moneda: 'ARS',
      fecha: new Date().toISOString().split('T')[0],
      tag_ids: []
    })
  }

  const openEdit = (ingreso: Ingreso) => {
    setEditing(ingreso)
    setForm({
      descripcion: ingreso.descripcion,
      categoria_id: ingreso.categoria_id || '',
      monto: String(ingreso.monto),
      moneda: ingreso.moneda,
      fecha: ingreso.fecha,
      tag_ids: ingreso.tag_ids || []
    })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.descripcion || !form.monto) {
      setAlertData({
        title: 'Campos requeridos',
        message: 'Descripción y monto son obligatorios',
        variant: 'warning'
      })
      setShowAlert(true)
      return
    }

    setSaving(true)

    const fecha = new Date(form.fecha)
    const mes = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`

    const data = {
      descripcion: form.descripcion,
      categoria_id: form.categoria_id || null,
      monto: parseFloat(form.monto),
      moneda: form.moneda,
      fecha: form.fecha,
      mes: mes,
      tag_ids: form.tag_ids
    }

    try {
      if (editing) {
        const { error } = await updateIngreso(editing.id, data)
        if (error) {
          console.error('Error updating:', error)
          const message = error instanceof Error ? error.message : String(error)
          setAlertData({
            title: 'Error al actualizar',
            message: message,
            variant: 'error'
          })
          setShowAlert(true)
          setSaving(false)
          return
        }
      } else {
        const { error } = await addIngreso(data)
        if (error) {
          console.error('Error adding:', error)
          const message = error instanceof Error ? error.message : String(error)
          setAlertData({
            title: 'Error al agregar',
            message: message,
            variant: 'error'
          })
          setShowAlert(true)
          setSaving(false)
          return
        }
      }

      setShowModal(false)
      setEditing(null)
      resetForm()
    } catch (err) {
      console.error('Exception:', err)
      setAlertData({
        title: 'Error inesperado',
        message: 'Ocurrió un error al guardar el ingreso',
        variant: 'error'
      })
      setShowAlert(true)
    }

    setSaving(false)
  }

  const handleDelete = (id: string) => {
    setDeleteTargetId(id)
    setShowConfirmDelete(true)
  }

  const confirmDelete = async () => {
    if (!deleteTargetId) return

    const { error } = await deleteIngreso(deleteTargetId)
    if (error) {
      const message = error instanceof Error ? error.message : String(error)
      setAlertData({
        title: 'Error al eliminar',
        message: message,
        variant: 'error'
      })
      setShowAlert(true)
    }

    setDeleteTargetId(null)
  }

  const handleAddNewTag = async () => {
    if (!newTagName.trim()) return

    const { error } = await addTagIngreso(newTagName.trim())
    if (error) {
      console.error('Error adding tag:', error)
      return
    }

    setNewTagName('')
    setShowNewTagInput(false)
  }

  const handleAddNewCategoria = async () => {
    if (!newCategoria.nombre.trim()) return

    const { error } = await addCategoriaIngreso({
      nombre: newCategoria.nombre.trim(),
      icono: newCategoria.icono,
      color: newCategoria.color
    })
    if (error) {
      console.error('Error adding categoria:', error)
      return
    }

    setNewCategoria({ nombre: '', icono: '💵', color: '#3b82f6' })
    setShowNewCategoriaInput(false)
  }

  const toggleTag = (tagId: string) => {
    setForm(f => ({
      ...f,
      tag_ids: f.tag_ids.includes(tagId)
        ? f.tag_ids.filter(id => id !== tagId)
        : [...f.tag_ids, tagId]
    }))
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Ingresos</h1>
          <p className="text-slate-500">{getMonthName(currentMonth)} - {ingresosMes.length} registros</p>
        </div>
        <button
          onClick={() => { resetForm(); setEditing(null); setShowModal(true) }}
          className="btn btn-primary"
        >
          <Plus className="w-4 h-4" /> Nuevo Ingreso
        </button>
      </div>

      {/* Totals */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="card p-6">
          <div className="text-sm text-slate-500 mb-1">Total ARS</div>
          <div className="text-2xl font-bold text-emerald-600">{formatMoney(totalARS, 'ARS')}</div>
        </div>
        <div className="card p-6">
          <div className="text-sm text-slate-500 mb-1">Total USD</div>
          <div className="text-2xl font-bold text-emerald-600">{formatMoney(totalUSD, 'USD')}</div>
        </div>
      </div>

      {/* Ingresos List */}
      <div className="card">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left p-4 font-semibold text-slate-700">Descripción</th>
                <th className="text-left p-4 font-semibold text-slate-700">Categoría</th>
                <th className="text-left p-4 font-semibold text-slate-700">Fecha</th>
                <th className="text-right p-4 font-semibold text-slate-700">Monto</th>
                <th className="text-right p-4 font-semibold text-slate-700">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {ingresosMes.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center p-12">
                    <Wallet className="w-16 h-16 mx-auto text-slate-300 mb-4" />
                    <p className="text-slate-500 mb-4">No hay ingresos registrados para este mes</p>
                    <button
                      onClick={() => { resetForm(); setEditing(null); setShowModal(true) }}
                      className="btn btn-primary"
                    >
                      <Plus className="w-4 h-4" /> Agregar primer ingreso
                    </button>
                  </td>
                </tr>
              ) : ingresosMes.map(ingreso => {
                const categoria = categoriasIngresos.find(c => c.id === ingreso.categoria_id)
                return (
                  <tr key={ingreso.id} className="border-b border-slate-100 hover:bg-slate-50 transition">
                    <td className="p-4">
                      <div className="font-medium">{ingreso.descripcion}</div>
                      {ingreso.tag_ids && ingreso.tag_ids.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {ingreso.tag_ids.map(tagId => {
                            const tag = tagsIngresos.find(t => t.id === tagId)
                            return tag ? (
                              <span key={tagId} className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded">
                                {tag.nombre}
                              </span>
                            ) : null
                          })}
                        </div>
                      )}
                    </td>
                    <td className="p-4">
                      {categoria && (
                        <span className="inline-flex items-center gap-1">
                          <span>{categoria.icono}</span>
                          <span>{categoria.nombre}</span>
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-slate-600">
                      {new Date(ingreso.fecha).toLocaleDateString('es-AR')}
                    </td>
                    <td className="p-4 text-right">
                      <span className="font-bold text-emerald-600">
                        {formatMoney(ingreso.monto, ingreso.moneda)}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => openEdit(ingreso)}
                          className="p-2 hover:bg-slate-100 rounded-lg transition"
                          title="Editar"
                        >
                          <Edit2 className="w-4 h-4 text-slate-600" />
                        </button>
                        <button
                          onClick={() => handleDelete(ingreso.id)}
                          className="p-2 hover:bg-red-50 rounded-lg transition"
                          title="Eliminar"
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal max-w-2xl" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-lg">{editing ? 'Editar' : 'Nuevo'} Ingreso</h3>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-slate-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="label">Descripción *</label>
                <input
                  type="text"
                  className="input"
                  placeholder="Ej: Salario, Freelance, Venta..."
                  value={form.descripcion}
                  onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Categoría</label>
                  <select
                    className="input"
                    value={form.categoria_id}
                    onChange={e => setForm(f => ({ ...f, categoria_id: e.target.value }))}
                  >
                    <option value="">Sin categoría</option>
                    {categoriasIngresos.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.icono} {c.nombre}
                      </option>
                    ))}
                    <option value="__new__">➕ Nueva categoría...</option>
                  </select>
                  {form.categoria_id === '__new__' && (
                    <div className="mt-2 p-3 bg-slate-50 rounded-lg space-y-2">
                      <input
                        type="text"
                        className="input"
                        placeholder="Nombre de categoría"
                        value={newCategoria.nombre}
                        onChange={e => setNewCategoria(c => ({ ...c, nombre: e.target.value }))}
                      />
                      <div className="flex gap-2">
                        <input
                          type="text"
                          className="input w-20"
                          placeholder="🎯"
                          value={newCategoria.icono}
                          onChange={e => setNewCategoria(c => ({ ...c, icono: e.target.value }))}
                        />
                        <input
                          type="color"
                          className="input w-20"
                          value={newCategoria.color}
                          onChange={e => setNewCategoria(c => ({ ...c, color: e.target.value }))}
                        />
                        <button
                          onClick={handleAddNewCategoria}
                          className="btn btn-primary"
                        >
                          Agregar
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="label">Fecha</label>
                  <input
                    type="date"
                    className="input"
                    value={form.fecha}
                    onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Monto *</label>
                  <input
                    type="number"
                    className="input"
                    placeholder="0.00"
                    step="0.01"
                    value={form.monto}
                    onChange={e => setForm(f => ({ ...f, monto: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="label">Moneda</label>
                  <select
                    className="input"
                    value={form.moneda}
                    onChange={e => setForm(f => ({ ...f, moneda: e.target.value as 'ARS' | 'USD' }))}
                  >
                    <option value="ARS">💵 Pesos (ARS)</option>
                    <option value="USD">💵 Dólares (USD)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="label">Tags</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {tagsIngresos.map(tag => (
                    <button
                      key={tag.id}
                      onClick={() => toggleTag(tag.id)}
                      className={`px-3 py-1 rounded-lg text-sm transition ${
                        form.tag_ids.includes(tag.id)
                          ? 'bg-indigo-100 text-indigo-700 border-2 border-indigo-500'
                          : 'bg-slate-100 text-slate-600 border-2 border-transparent hover:border-slate-300'
                      }`}
                    >
                      {tag.nombre}
                    </button>
                  ))}
                  <button
                    onClick={() => setShowNewTagInput(!showNewTagInput)}
                    className="px-3 py-1 rounded-lg text-sm bg-slate-100 text-slate-600 hover:bg-slate-200 transition"
                  >
                    ➕ Nuevo tag
                  </button>
                </div>
                {showNewTagInput && (
                  <div className="flex gap-2 mt-2">
                    <input
                      type="text"
                      className="input flex-1"
                      placeholder="Nombre del tag"
                      value={newTagName}
                      onChange={e => setNewTagName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleAddNewTag()}
                    />
                    <button onClick={handleAddNewTag} className="btn btn-primary">
                      Agregar
                    </button>
                  </div>
                )}
              </div>

              <button
                onClick={handleSave}
                disabled={saving}
                className="btn btn-primary w-full justify-center"
              >
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete Modal */}
      <ConfirmModal
        isOpen={showConfirmDelete}
        onClose={() => {
          setShowConfirmDelete(false)
          setDeleteTargetId(null)
        }}
        onConfirm={confirmDelete}
        title="¿Eliminar ingreso?"
        message="Esta acción no se puede deshacer."
        confirmText="Eliminar"
        cancelText="Cancelar"
        variant="danger"
      />

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
