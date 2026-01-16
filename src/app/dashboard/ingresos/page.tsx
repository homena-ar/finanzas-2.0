'use client'

import { useState } from 'react'
import { useData } from '@/hooks/useData'
import { useWorkspace } from '@/hooks/useWorkspace'
import { useAuth } from '@/hooks/useAuth'
import { formatMoney, getMonthName } from '@/lib/utils'
import { Plus, Edit2, Trash2, X, Wallet, Search, Upload, Image as ImageIcon, Loader2 } from 'lucide-react'
import { Ingreso } from '@/types'
import { ConfirmModal, AlertModal } from '@/components/Modal'

export default function IngresosPage() {
  const { user } = useAuth()
  const { currentWorkspace, members } = useWorkspace()
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

  // AI Image processing states
  const [processingImage, setProcessingImage] = useState(false)
  const [showImagePreview, setShowImagePreview] = useState(false)
  const [extractedData, setExtractedData] = useState<any>(null)
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [selectedTransactions, setSelectedTransactions] = useState<Set<number>>(new Set())
  const [includeTotal, setIncludeTotal] = useState(false)

  // Filters
  const [filters, setFilters] = useState({ search: '', colaborador: '', moneda: '' })

  let ingresosMes = getIngresosMes(monthKey)

  // Apply filters
  if (filters.search) {
    ingresosMes = ingresosMes.filter(i =>
      i.descripcion.toLowerCase().includes(filters.search.toLowerCase())
    )
  }
  if (filters.moneda) {
    ingresosMes = ingresosMes.filter(i => i.moneda === filters.moneda)
  }
  if (filters.colaborador && currentWorkspace) {
    ingresosMes = ingresosMes.filter(i => {
      const userId = (i as any).created_by || i.user_id
      if (filters.colaborador === 'yo') {
        return userId === user?.uid
      } else if (filters.colaborador === 'propietario') {
        return userId === currentWorkspace.owner_id
      } else {
        return userId === filters.colaborador
      }
    })
  }

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

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validar que sea una imagen o PDF
    const isValidFile = file.type.startsWith('image/') || file.type === 'application/pdf'
    if (!isValidFile) {
      setAlertData({
        title: 'Error',
        message: 'Por favor, selecciona una imagen o PDF válido',
        variant: 'error'
      })
      setShowAlert(true)
      return
    }

    setProcessingImage(true)

    try {
      // Convertir a base64
      const reader = new FileReader()
      reader.onloadend = async () => {
        const base64 = reader.result as string
        setPreviewImage(base64)

        // Llamar a la API
        const response = await fetch('/api/process-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64: base64,
            type: 'ingreso',
            mimeType: file.type
          })
        })

        const result = await response.json()

        if (!response.ok || !result.success) {
          const errorMessage = result.error || 'Error al procesar el archivo'
          const errorDetails = result.details ? `\n\nDetalles: ${result.details}` : ''
          throw new Error(`${errorMessage}${errorDetails}`)
        }

        setExtractedData(result.data)
        setShowImagePreview(true)
        setProcessingImage(false)
      }

      reader.onerror = () => {
        setProcessingImage(false)
        setAlertData({
          title: 'Error',
          message: 'Error al leer la imagen',
          variant: 'error'
        })
        setShowAlert(true)
      }

      reader.readAsDataURL(file)
    } catch (error: any) {
      setProcessingImage(false)
      console.error('Error procesando archivo:', error)
      
      let errorMessage = error.message || 'Error al procesar el archivo'
      
      // Si el error viene del servidor con detalles
      if (error.message && error.message.includes('Detalles:')) {
        errorMessage = error.message
      }
      
      setAlertData({
        title: 'Error al procesar',
        message: errorMessage,
        variant: 'error'
      })
      setShowAlert(true)
    }
  }

  const handleConfirmExtractedData = () => {
    if (!extractedData) return

    // Si hay múltiples transacciones (resumen)
    if (extractedData.transacciones && Array.isArray(extractedData.transacciones)) {
      const transactionsToAdd = extractedData.transacciones.filter((_: any, index: number) => 
        selectedTransactions.has(index)
      )
      
      if (transactionsToAdd.length === 0 && !includeTotal) {
        setAlertData({
          title: 'Error',
          message: 'Por favor, selecciona al menos una transacción',
          variant: 'error'
        })
        setShowAlert(true)
        return
      }

      // Agregar cada transacción seleccionada como ingreso individual
      const addPromises = transactionsToAdd.map(async (trans: any) => {
        let categoriaId = ''
        if (trans.categoria) {
          const categoriaMatch = categoriasIngresos.find(
            c => c.nombre.toLowerCase().includes(trans.categoria.toLowerCase()) ||
            trans.categoria.toLowerCase().includes(c.nombre.toLowerCase())
          )
          if (categoriaMatch) {
            categoriaId = categoriaMatch.id
          }
        }
        
        await addIngreso({
          descripcion: trans.descripcion,
          categoria_id: categoriaId,
          monto: trans.monto,
          moneda: trans.moneda || 'ARS',
          fecha: trans.fecha || form.fecha,
          origen: trans.origen || ''
        })
      })

      // Si se solicita, agregar el total también
      if (includeTotal && extractedData.total && extractedData.total.monto) {
        addPromises.push(
          addIngreso({
            descripcion: `Total del resumen - ${extractedData.total.periodo || 'Período'}`,
            categoria_id: '',
            monto: extractedData.total.monto,
            moneda: extractedData.total.moneda || 'ARS',
            fecha: form.fecha,
            origen: extractedData.total.periodo || ''
          })
        )
      }

      Promise.all(addPromises)
        .then(() => {
          setShowImagePreview(false)
          setExtractedData(null)
          setPreviewImage(null)
          setSelectedTransactions(new Set())
          setIncludeTotal(false)
          setShowModal(false)
          resetForm()
        })
        .catch((error) => {
          console.error('Error agregando transacciones:', error)
          setAlertData({
            title: 'Error',
            message: 'Error al agregar las transacciones. Por favor, intenta nuevamente.',
            variant: 'error'
          })
          setShowAlert(true)
        })
      
      return
    }

    // Formato antiguo: transacción única (mantener compatibilidad)
    setForm(f => ({
      ...f,
      descripcion: extractedData.descripcion || f.descripcion,
      monto: extractedData.monto ? String(extractedData.monto) : f.monto,
      moneda: extractedData.moneda || f.moneda,
      fecha: extractedData.fecha || f.fecha
    }))

    // Si hay una categoría sugerida, intentar encontrarla
    if (extractedData.categoria) {
      const categoriaMatch = categoriasIngresos.find(
        c => c.nombre.toLowerCase().includes(extractedData.categoria.toLowerCase()) ||
        extractedData.categoria.toLowerCase().includes(c.nombre.toLowerCase())
      )
      if (categoriaMatch) {
        setForm(f => ({ ...f, categoria_id: categoriaMatch.id }))
      }
    }

    setShowImagePreview(false)
    setExtractedData(null)
    setPreviewImage(null)
    setSelectedTransactions(new Set())
    setIncludeTotal(false)
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

      {/* Filters */}
      {(currentWorkspace && members.length > 0) || filters.search || filters.moneda ? (
        <div className="card p-4 bg-slate-50 border-b border-slate-200">
          <div className="flex flex-wrap gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar..."
                className="input pl-9 w-40"
                value={filters.search}
                onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
              />
            </div>
            <select
              className="input w-auto"
              value={filters.moneda}
              onChange={e => setFilters(f => ({ ...f, moneda: e.target.value }))}
            >
              <option value="">Todas las monedas</option>
              <option value="ARS">ARS</option>
              <option value="USD">USD</option>
            </select>
            {currentWorkspace && members.length > 0 && (
              <select
                className="input w-auto"
                value={filters.colaborador}
                onChange={e => setFilters(f => ({ ...f, colaborador: e.target.value }))}
              >
                <option value="">Todos los colaboradores</option>
                <option value="yo">Tú</option>
                {currentWorkspace.owner_id !== user?.uid && (
                  <option value="propietario">
                    {members.find(m => m.user_id === currentWorkspace.owner_id)?.display_name || 
                     members.find(m => m.user_id === currentWorkspace.owner_id)?.user_email?.split('@')[0] || 
                     'Propietario'}
                  </option>
                )}
                {members
                  .filter(m => m.workspace_id === currentWorkspace.id && m.user_id !== user?.uid && m.user_id !== currentWorkspace.owner_id)
                  .map(m => (
                    <option key={m.id} value={m.user_id}>
                      {m.display_name || m.user_email.split('@')[0]}
                    </option>
                  ))}
              </select>
            )}
          </div>
        </div>
      ) : null}

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
              {/* Botón para subir imagen con IA */}
              <div className="flex items-center gap-2 p-3 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg border-2 border-purple-200">
                <ImageIcon className="w-5 h-5 text-purple-600" />
                <div className="flex-1">
                  <label className="text-sm font-semibold text-purple-900 cursor-pointer">
                    📸 Leer con IA desde imagen
                  </label>
                  <p className="text-xs text-purple-700">Sube una imagen o PDF de tu resumen bancario o comprobante</p>
                </div>
                <label className="btn btn-primary cursor-pointer relative">
                  {processingImage ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      Subir
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    className="hidden"
                    onChange={handleImageUpload}
                    disabled={processingImage}
                  />
                </label>
              </div>

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

      {/* Overlay de carga durante procesamiento de IA */}
      {processingImage && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-2xl p-8 max-w-md w-full mx-4">
            <div className="text-center space-y-4">
              <Loader2 className="w-12 h-12 animate-spin text-purple-600 mx-auto" />
              <h3 className="text-xl font-bold text-slate-900">Procesando con IA...</h3>
              <p className="text-slate-600">Analizando el documento. Esto puede tardar unos segundos.</p>
              <div className="w-full bg-slate-200 rounded-full h-2 mt-4">
                <div className="bg-purple-600 h-2 rounded-full animate-pulse" style={{ width: '60%' }}></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Vista Previa de Datos Extraídos */}
      {showImagePreview && extractedData && (
        <div className="modal-overlay" onClick={() => { setShowImagePreview(false); setExtractedData(null); setPreviewImage(null); setSelectedTransactions(new Set()); setIncludeTotal(false) }}>
          <div className="modal max-w-4xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-purple-600" />
                {extractedData.transacciones ? `Confirmar Transacciones (${extractedData.transacciones.length} encontradas)` : 'Confirmar Datos Extraídos'}
              </h3>
              <button 
                onClick={() => { setShowImagePreview(false); setExtractedData(null); setPreviewImage(null); setSelectedTransactions(new Set()); setIncludeTotal(false) }} 
                className="p-1 hover:bg-slate-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              {/* PDF/Imagen colapsable - menos prominente */}
              {previewImage && (
                <details className="mb-4 group">
                  <summary className="cursor-pointer text-sm text-slate-600 hover:text-slate-900 font-semibold pb-2 border-b border-slate-200">
                    📄 Ver documento ({previewImage.includes('data:application/pdf') ? 'PDF' : 'Imagen'})
                  </summary>
                  <div className="mt-3">
                    {previewImage.includes('data:application/pdf') ? (
                      <iframe
                        src={previewImage}
                        className="w-full h-96 rounded-lg border border-slate-200"
                        title="Vista previa del PDF"
                      />
                    ) : (
                      <img src={previewImage} alt="Preview" className="w-full max-h-64 object-contain rounded-lg border border-slate-200" />
                    )}
                  </div>
                </details>
              )}
              
              {/* Si hay múltiples transacciones (resumen) */}
              {extractedData.transacciones && Array.isArray(extractedData.transacciones) ? (
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-sm text-blue-800">
                      <strong>Resumen detectado:</strong> Se encontraron {extractedData.transacciones.length} ingresos individuales. 
                      Selecciona los que deseas agregar.
                    </p>
                  </div>

                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {extractedData.transacciones.map((trans: any, index: number) => (
                      <div 
                        key={index}
                        className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                          selectedTransactions.has(index) 
                            ? 'border-purple-500 bg-purple-50' 
                            : 'border-slate-200 hover:border-purple-300 bg-white'
                        }`}
                        onClick={() => {
                          const newSelected = new Set(selectedTransactions)
                          if (newSelected.has(index)) {
                            newSelected.delete(index)
                          } else {
                            newSelected.add(index)
                          }
                          setSelectedTransactions(newSelected)
                        }}
                      >
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={selectedTransactions.has(index)}
                            onChange={(e) => {
                              e.stopPropagation()
                              const newSelected = new Set(selectedTransactions)
                              if (newSelected.has(index)) {
                                newSelected.delete(index)
                              } else {
                                newSelected.add(index)
                              }
                              setSelectedTransactions(newSelected)
                            }}
                            className="mt-1 w-4 h-4 text-purple-600 rounded border-slate-300"
                          />
                          <div className="flex-1 space-y-1">
                            <div className="font-semibold text-slate-900">{trans.descripcion || 'Sin descripción'}</div>
                            <div className="flex items-center gap-4 text-sm text-slate-600">
                              <span className="font-medium">{formatMoney(trans.monto || 0)} {trans.moneda || 'ARS'}</span>
                              <span>{trans.fecha || ''}</span>
                              {trans.origen && <span className="text-blue-600">📍 {trans.origen}</span>}
                            </div>
                            {trans.categoria && (
                              <span className="inline-block px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded">
                                {trans.categoria}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Opción para agregar total */}
                  {extractedData.total && extractedData.total.monto && (
                    <div 
                      className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                        includeTotal 
                          ? 'border-purple-500 bg-purple-50' 
                          : 'border-slate-200 hover:border-purple-300 bg-white'
                      }`}
                      onClick={() => setIncludeTotal(!includeTotal)}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={includeTotal}
                          onChange={(e) => {
                            e.stopPropagation()
                            setIncludeTotal(!includeTotal)
                          }}
                          className="mt-1 w-4 h-4 text-purple-600 rounded border-slate-300"
                        />
                        <div className="flex-1">
                          <div className="font-semibold text-slate-900">
                            Total del resumen {extractedData.total.periodo ? `- ${extractedData.total.periodo}` : ''}
                          </div>
                          <div className="text-sm text-slate-600 mt-1">
                            {formatMoney(extractedData.total.monto)} {extractedData.total.moneda || 'ARS'}
                          </div>
                          <div className="text-xs text-slate-500 mt-1">
                            Opcional: Agregar el total del resumen como un ingreso adicional
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                    <span className="text-sm text-slate-600">
                      {selectedTransactions.size} transacción{selectedTransactions.size !== 1 ? 'es' : ''} seleccionada{selectedTransactions.size !== 1 ? 's' : ''}
                      {includeTotal && extractedData.total && ' + Total'}
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          const allSelected = new Set<number>(extractedData.transacciones.map((_: any, i: number) => i))
                          setSelectedTransactions(allSelected)
                        }}
                        className="btn btn-secondary text-sm"
                      >
                        Seleccionar todas
                      </button>
                      <button
                        onClick={() => setSelectedTransactions(new Set())}
                        className="btn btn-secondary text-sm"
                      >
                        Deseleccionar
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                /* Formato antiguo: transacción única (mantener compatibilidad) */
                <div className="bg-slate-50 p-4 rounded-lg space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-600 uppercase">Descripción</label>
                    <input
                      type="text"
                      className="input mt-1"
                      value={extractedData.descripcion || ''}
                      onChange={e => setExtractedData({ ...extractedData, descripcion: e.target.value })}
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-slate-600 uppercase">Monto</label>
                      <input
                        type="number"
                        step="0.01"
                        className="input mt-1"
                        value={extractedData.monto || ''}
                        onChange={e => setExtractedData({ ...extractedData, monto: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-600 uppercase">Moneda</label>
                      <select
                        className="input mt-1"
                        value={extractedData.moneda || 'ARS'}
                        onChange={e => setExtractedData({ ...extractedData, moneda: e.target.value })}
                      >
                        <option value="ARS">ARS</option>
                        <option value="USD">USD</option>
                      </select>
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-xs font-semibold text-slate-600 uppercase">Fecha</label>
                    <input
                      type="date"
                      className="input mt-1"
                      value={extractedData.fecha || ''}
                      onChange={e => setExtractedData({ ...extractedData, fecha: e.target.value })}
                    />
                  </div>
                  
                  {extractedData.categoria && (
                    <div>
                      <label className="text-xs font-semibold text-slate-600 uppercase">Categoría Sugerida</label>
                      <div className="mt-1 px-3 py-2 bg-purple-100 text-purple-700 rounded-lg">
                        {extractedData.categoria}
                      </div>
                    </div>
                  )}
                  
                  {extractedData.origen && (
                    <div>
                      <label className="text-xs font-semibold text-slate-600 uppercase">Origen</label>
                      <div className="mt-1 px-3 py-2 bg-blue-100 text-blue-700 rounded-lg">
                        {extractedData.origen}
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              <div className="flex gap-2 pt-2 border-t border-slate-200">
                <button
                  onClick={handleConfirmExtractedData}
                  className="btn btn-primary flex-1"
                  disabled={extractedData.transacciones && selectedTransactions.size === 0 && !includeTotal}
                >
                  ✓ {extractedData.transacciones ? `Agregar ${selectedTransactions.size} transacción${selectedTransactions.size !== 1 ? 'es' : ''}` : 'Usar estos datos'}
                </button>
                <button
                  onClick={() => { setShowImagePreview(false); setExtractedData(null); setPreviewImage(null); setSelectedTransactions(new Set()); setIncludeTotal(false) }}
                  className="btn btn-secondary"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
