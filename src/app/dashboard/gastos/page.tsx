'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { useData } from '@/hooks/useData'
import { formatMoney, getMonthName, getTagClass } from '@/lib/utils'
import { Plus, Search, Edit2, Trash2, Pin, X, Download } from 'lucide-react'
import { Gasto } from '@/types'

export default function GastosPage() {
  console.log('🔵🔵🔵 [GastosPage] COMPONENT RENDER')

  const searchParams = useSearchParams()
  const {
    tarjetas, categorias, tags, mediosPago,
    currentMonth, monthKey, getGastosMes, getImpuestosMes,
    addGasto, updateGasto, deleteGasto,
    addImpuesto, updateImpuesto, deleteImpuesto,
    addTag, addCategoria, addTarjeta, addMedioPago
  } = useData()

  console.log('🔵🔵🔵 [GastosPage] addGasto function reference:', addGasto)

  const [showGastoModal, setShowGastoModal] = useState(false)
  const [showImpModal, setShowImpModal] = useState(false)
  const [showPagoModal, setShowPagoModal] = useState(false)
  const [editingGasto, setEditingGasto] = useState<Gasto | null>(null)
  const [editingImp, setEditingImp] = useState<any>(null)
  const [gastoToMarkPaid, setGastoToMarkPaid] = useState<Gasto | null>(null)
  const [filters, setFilters] = useState({ search: '', tarjeta: '', moneda: '', tag: '', sort: 'monto-desc' })
  const [gastoError, setGastoError] = useState('')
  const [showNewTagInput, setShowNewTagInput] = useState(false)
  const [newTagName, setNewTagName] = useState('')
  const [showNewCategoriaInput, setShowNewCategoriaInput] = useState(false)
  const [newCategoria, setNewCategoria] = useState({ nombre: '', icono: '💰' })
  const [pagoForm, setPagoForm] = useState({
    fecha_pago: new Date().toISOString().split('T')[0],
    medio_pago: '',
    comprobante: null as File | null,
    medio_pago_custom: '' // Para cuando selecciona "Nuevo"
  })
  const [showNewTarjetaInput, setShowNewTarjetaInput] = useState(false)
  const [newTarjeta, setNewTarjeta] = useState({
    nombre: '',
    tipo: 'visa' as 'visa' | 'mastercard' | 'amex' | 'other',
    banco: '',
    digitos: ''
  })

  // Apply filter from URL query params
  useEffect(() => {
    const tarjetaParam = searchParams.get('tarjeta')
    if (tarjetaParam) {
      console.log('🔵 [GastosPage] Applying tarjeta filter from URL:', tarjetaParam)
      setFilters(f => ({ ...f, tarjeta: tarjetaParam }))
    }
  }, [searchParams])

  // Form states
  const [gastoForm, setGastoForm] = useState({
    descripcion: '', tarjeta_id: '', categoria_id: '', monto: '',
    moneda: 'ARS', cuotas: '1', fecha: new Date().toISOString().split('T')[0],
    es_fijo: false, tag_ids: [] as string[], pagado: false
  })
  const [impForm, setImpForm] = useState({
    descripcion: '', tarjeta_id: '', monto: '', mes: monthKey
  })

  let gastosMes = getGastosMes(monthKey)
  const impuestosMes = getImpuestosMes(monthKey)

  // Create lookup maps for categorias and tarjetas
  const categoriaMap = Object.fromEntries(categorias.map(c => [c.id, c]))
  const tarjetaMap = Object.fromEntries(tarjetas.map(t => [t.id, t]))

  // Apply filters
  if (filters.search) {
    gastosMes = gastosMes.filter(g =>
      g.descripcion.toLowerCase().includes(filters.search.toLowerCase())
    )
  }
  if (filters.tarjeta) {
    if (filters.tarjeta === 'efectivo') {
      gastosMes = gastosMes.filter(g => !g.tarjeta_id)
    } else {
      gastosMes = gastosMes.filter(g => g.tarjeta_id === filters.tarjeta)
    }
  }
  if (filters.moneda) {
    gastosMes = gastosMes.filter(g => g.moneda === filters.moneda)
  }
  if (filters.tag) {
    gastosMes = gastosMes.filter(g => g.tag_ids?.includes(filters.tag))
  }

  // Sort
  const sortParts = filters.sort.split('-')
  const [sortField, sortDir] = sortParts.length === 2 ? sortParts : ['monto', 'desc']
  gastosMes.sort((a, b) => {
    let vA, vB
    if (sortField === 'monto') {
      vA = a.cuotas > 1 ? a.monto / a.cuotas : a.monto
      vB = b.cuotas > 1 ? b.monto / b.cuotas : b.monto
    } else {
      vA = new Date(a.fecha).getTime()
      vB = new Date(b.fecha).getTime()
    }
    return sortDir === 'asc' ? vA - vB : vB - vA
  })

  const handleSaveGasto = async () => {
    console.log('🔵 [GastosPage] handleSaveGasto CALLED')
    console.log('🔵 [GastosPage] handleSaveGasto - form:', gastoForm)
    console.log('🔵 [GastosPage] handleSaveGasto - addGasto function:', typeof addGasto, addGasto)

    // Validación
    if (!gastoForm.descripcion || !gastoForm.monto) {
      console.log('🔵 [GastosPage] handleSaveGasto - Validation failed, returning')
      setGastoError('Descripción y monto son obligatorios')
      return
    }
    setGastoError('')

    const fecha = new Date(gastoForm.fecha)
    const mesFacturacion = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`

    const data = {
      descripcion: gastoForm.descripcion,
      tarjeta_id: gastoForm.tarjeta_id || null,
      categoria_id: gastoForm.categoria_id || null,
      monto: parseFloat(gastoForm.monto),
      moneda: gastoForm.moneda as 'ARS' | 'USD',
      cuotas: parseInt(gastoForm.cuotas),
      cuota_actual: 1,
      fecha: gastoForm.fecha,
      mes_facturacion: mesFacturacion,
      es_fijo: gastoForm.es_fijo,
      tag_ids: gastoForm.tag_ids,
      pagado: gastoForm.pagado
    }

    console.log('🔵 [GastosPage] handleSaveGasto - Data to save:', data)

    if (editingGasto) {
      console.log('🔵 [GastosPage] handleSaveGasto - Updating gasto:', editingGasto.id)
      await updateGasto(editingGasto.id, data)
    } else {
      console.log('🔵 [GastosPage] handleSaveGasto - Adding new gasto')
      const result = await addGasto(data)
      console.log('🔵 [GastosPage] handleSaveGasto - addGasto result:', result)
    }

    console.log('🔵 [GastosPage] handleSaveGasto - Closing modal')
    setShowGastoModal(false)
    setEditingGasto(null)
    resetGastoForm()
  }

  const handleSaveImp = async () => {
    if (!impForm.descripcion || !impForm.monto) return
    
    const data = {
      descripcion: impForm.descripcion,
      tarjeta_id: impForm.tarjeta_id || null,
      monto: parseFloat(impForm.monto),
      mes: impForm.mes
    }

    if (editingImp) {
      await updateImpuesto(editingImp.id, data)
    } else {
      await addImpuesto(data)
    }

    setShowImpModal(false)
    setEditingImp(null)
    resetImpForm()
  }

  const resetGastoForm = () => {
    setGastoForm({
      descripcion: '', tarjeta_id: tarjetas[0]?.id || '', categoria_id: '', monto: '',
      moneda: 'ARS', cuotas: '1', fecha: new Date().toISOString().split('T')[0],
      es_fijo: false, tag_ids: [], pagado: false
    })
    setGastoError('')
  }

  const resetImpForm = () => {
    setImpForm({ descripcion: '', tarjeta_id: tarjetas[0]?.id || '', monto: '', mes: monthKey })
  }

  const openEditGasto = (g: Gasto) => {
    setEditingGasto(g)
    setGastoForm({
      descripcion: g.descripcion,
      tarjeta_id: g.tarjeta_id || '',
      categoria_id: g.categoria_id || '',
      monto: String(g.monto),
      moneda: g.moneda,
      cuotas: String(g.cuotas),
      fecha: g.fecha,
      es_fijo: g.es_fijo,
      tag_ids: g.tag_ids || [],
      pagado: g.pagado || false
    })
    setShowGastoModal(true)
  }

  const togglePagado = async (g: Gasto) => {
    if (!g.pagado) {
      // Si va a marcar como pagado, abrir modal vacío
      setGastoToMarkPaid(g)
      setPagoForm({
        fecha_pago: new Date().toISOString().split('T')[0],
        medio_pago: '',
        comprobante: null,
        medio_pago_custom: ''
      })
      setShowPagoModal(true)
    } else {
      // Si ya está pagado, abrir modal con datos existentes para ver/editar
      setGastoToMarkPaid(g)
      const mediosPredefinidos = ['efectivo', 'transferencia', 'debito', 'credito', 'mercadopago']
      const isInCustomList = g.medio_pago && mediosPago.some(m => m.nombre === g.medio_pago)
      const isNewCustom = g.medio_pago && !mediosPredefinidos.includes(g.medio_pago) && !isInCustomList

      setPagoForm({
        fecha_pago: g.fecha_pago || new Date().toISOString().split('T')[0],
        medio_pago: isNewCustom ? 'nuevo' : (g.medio_pago || ''),
        comprobante: null, // No podemos pre-cargar el archivo
        medio_pago_custom: isNewCustom ? g.medio_pago || '' : ''
      })
      setShowPagoModal(true)
    }
  }

  const handleConfirmPago = async () => {
    if (!gastoToMarkPaid) return

    // Convertir comprobante a base64 si existe
    let comprobanteUrl = null
    let comprobanteNombre = null

    if (pagoForm.comprobante) {
      comprobanteNombre = pagoForm.comprobante.name
      const reader = new FileReader()
      comprobanteUrl = await new Promise((resolve) => {
        reader.onloadend = () => resolve(reader.result as string)
        reader.readAsDataURL(pagoForm.comprobante!)
      })
    }

    // Determinar el medio de pago a guardar
    let medioPagoFinal = pagoForm.medio_pago || null

    if (pagoForm.medio_pago === 'nuevo' && pagoForm.medio_pago_custom.trim()) {
      medioPagoFinal = pagoForm.medio_pago_custom.trim()

      // Guardar en Firebase si no existe
      const exists = mediosPago.some(m => m.nombre === medioPagoFinal)
      if (!exists) {
        await addMedioPago(medioPagoFinal)
      }
    }

    await updateGasto(gastoToMarkPaid.id, {
      pagado: true,
      fecha_pago: pagoForm.fecha_pago,
      medio_pago: medioPagoFinal,
      comprobante_url: comprobanteUrl,
      comprobante_nombre: comprobanteNombre
    })

    setShowPagoModal(false)
    setGastoToMarkPaid(null)
    setPagoForm({
      fecha_pago: new Date().toISOString().split('T')[0],
      medio_pago: '',
      comprobante: null,
      medio_pago_custom: ''
    })
  }

  const handleAddNewTag = async () => {
    if (!newTagName.trim()) return
    await addTag(newTagName.trim())
    setNewTagName('')
    setShowNewTagInput(false)
  }

  const handleAddNewCategoria = async () => {
    if (!newCategoria.nombre.trim()) return
    await addCategoria({
      nombre: newCategoria.nombre.trim(),
      icono: newCategoria.icono,
      color: '#6366f1'
    })
    setNewCategoria({ nombre: '', icono: '💰' })
    setShowNewCategoriaInput(false)
  }

  const handleAddNewTarjeta = async () => {
    if (!newTarjeta.nombre.trim()) return
    await addTarjeta({
      nombre: newTarjeta.nombre.trim(),
      tipo: newTarjeta.tipo,
      banco: newTarjeta.banco || null,
      digitos: newTarjeta.digitos || null,
      cierre: null
    })

    // La nueva tarjeta estará disponible después de fetchAll que se llama automáticamente
    setNewTarjeta({ nombre: '', tipo: 'visa', banco: '', digitos: '' })
    setShowNewTarjetaInput(false)
  }

  const downloadComprobante = (gasto: Gasto) => {
    if (!gasto.comprobante_url || !gasto.comprobante_nombre) return

    const link = document.createElement('a')
    link.href = gasto.comprobante_url
    link.download = gasto.comprobante_nombre
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const toggleFijo = async (g: Gasto) => {
    await updateGasto(g.id, { es_fijo: !g.es_fijo })
  }

  const totalImp = impuestosMes.reduce((s, i) => s + i.monto, 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Gastos</h1>
        <p className="text-slate-500">Consumos de {getMonthName(currentMonth)}</p>
      </div>

      {/* Consumos Section */}
      <div className="card overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h3 className="font-bold flex items-center gap-2">
            Consumos
            <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full text-xs font-bold">
              {gastosMes.length}
            </span>
          </h3>
          <button onClick={() => {
            console.log('🔵 [GastosPage] "Agregar Gasto" button CLICKED')
            resetGastoForm();
            setShowGastoModal(true)
          }} className="btn btn-primary">
            <Plus className="w-4 h-4" /> Agregar
          </button>
        </div>

        {/* Filters */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap gap-3">
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
            value={filters.tarjeta}
            onChange={e => setFilters(f => ({ ...f, tarjeta: e.target.value }))}
          >
            <option value="">Cuenta</option>
            {tarjetas.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
          </select>
          <select
            className="input w-auto"
            value={filters.moneda}
            onChange={e => setFilters(f => ({ ...f, moneda: e.target.value }))}
          >
            <option value="">Moneda</option>
            <option value="ARS">ARS</option>
            <option value="USD">USD</option>
          </select>
          <select
            className="input w-auto"
            value={filters.tag}
            onChange={e => setFilters(f => ({ ...f, tag: e.target.value }))}
          >
            <option value="">Todas las etiquetas</option>
            {tags.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
          </select>
          <select
            className="input w-auto"
            value={filters.sort}
            onChange={e => setFilters(f => ({ ...f, sort: e.target.value }))}
          >
            <option value="monto-desc">Mayor $</option>
            <option value="monto-asc">Menor $</option>
            <option value="fecha-desc">Reciente</option>
          </select>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50">
                <th className="text-left p-4 text-xs font-bold text-slate-500 uppercase">Descripción</th>
                <th className="text-left p-4 text-xs font-bold text-slate-500 uppercase">Cuenta</th>
                <th className="text-left p-4 text-xs font-bold text-slate-500 uppercase">Monto</th>
                <th className="text-left p-4 text-xs font-bold text-slate-500 uppercase">Cuotas</th>
                <th className="text-left p-4 text-xs font-bold text-slate-500 uppercase">Fijo</th>
                <th className="text-left p-4 text-xs font-bold text-slate-500 uppercase">Pagado</th>
                <th className="text-left p-4 text-xs font-bold text-slate-500 uppercase"></th>
              </tr>
            </thead>
            <tbody>
              {gastosMes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400">Sin gastos</td>
                </tr>
              ) : gastosMes.map(g => {
                const monto = g.cuotas > 1 ? g.monto / g.cuotas : g.monto
                let cuotaActual = 1
                if (g.cuotas > 1) {
                  const start = new Date(g.mes_facturacion + '-01')
                  const current = new Date(monthKey + '-01')
                  cuotaActual = Math.min(
                    (current.getFullYear() - start.getFullYear()) * 12 + current.getMonth() - start.getMonth() + 1,
                    g.cuotas
                  )
                }
                return (
                  <tr key={g.id} className={`border-b border-slate-100 hover:bg-slate-50 transition ${g.pagado ? 'opacity-50' : ''}`}>
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-slate-100 rounded-lg flex items-center justify-center text-lg">
                          {categoriaMap[g.categoria_id || '']?.icono || '💰'}
                        </div>
                        <div>
                          <div className={`font-semibold ${g.pagado ? 'line-through' : ''}`}>{g.descripcion}</div>
                          <div className="text-xs text-slate-500">
                            {categoriaMap[g.categoria_id || '']?.nombre || 'Sin categoría'}
                            {g.es_fijo && ' 📌'}
                          </div>
                          {g.pagado && (g.fecha_pago || g.medio_pago || g.comprobante_url) && (
                            <div className="mt-1 text-xs text-emerald-700 bg-emerald-50 px-2 py-1 rounded inline-block">
                              {g.fecha_pago && `📅 ${new Date(g.fecha_pago).toLocaleDateString('es-AR')}`}
                              {g.medio_pago && ` · ${g.medio_pago}`}
                              {g.comprobante_url && ' · 📎'}
                            </div>
                          )}
                          {g.tag_ids && g.tag_ids.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {g.tag_ids.map(tagId => {
                                const tag = tags.find(t => t.id === tagId)
                                return tag ? (
                                  <span key={tagId} className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full text-xs font-semibold">
                                    {tag.nombre}
                                  </span>
                                ) : null
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      {tarjetaMap[g.tarjeta_id || ''] ? (
                        <span className={`tag ${getTagClass(tarjetaMap[g.tarjeta_id || ''].tipo)}`}>
                          {tarjetaMap[g.tarjeta_id || ''].nombre}
                        </span>
                      ) : (
                        <span className="tag bg-emerald-100 text-emerald-700">
                          💵 Efectivo
                        </span>
                      )}
                    </td>
                    <td className={`p-4 font-bold ${g.moneda === 'USD' ? 'text-emerald-600' : ''}`}>
                      {formatMoney(monto, g.moneda)}
                    </td>
                    <td className="p-4">
                      {g.cuotas > 1 ? (
                        <span className="tag bg-indigo-100 text-indigo-700">
                          {cuotaActual}/{g.cuotas}
                        </span>
                      ) : '-'}
                    </td>
                    <td className="p-4">
                      <button
                        onClick={() => toggleFijo(g)}
                        className={`w-10 h-6 rounded-full relative transition-colors ${
                          g.es_fijo ? 'bg-emerald-500' : 'bg-slate-200'
                        }`}
                      >
                        <div className={`absolute w-4 h-4 bg-white rounded-full top-1 transition-transform ${
                          g.es_fijo ? 'translate-x-5' : 'translate-x-1'
                        }`} />
                      </button>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        {!g.pagado ? (
                          <button
                            onClick={() => togglePagado(g)}
                            className="px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold hover:bg-emerald-100 transition"
                          >
                            💰 Registrar Pago
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={() => togglePagado(g)}
                              className="px-3 py-1.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold hover:bg-indigo-100 transition flex items-center gap-1"
                              title={g.fecha_pago ? `Pagado el ${new Date(g.fecha_pago).toLocaleDateString()}` : 'Ver detalles de pago'}
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                              Ver Pago
                            </button>
                            {g.comprobante_url && (
                              <button
                                onClick={() => downloadComprobante(g)}
                                className="p-1.5 hover:bg-indigo-50 rounded-lg text-indigo-600 border border-indigo-200"
                                title="Descargar comprobante"
                              >
                                <Download className="w-4 h-4" />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex gap-1">
                        <button onClick={() => openEditGasto(g)} className="p-2 hover:bg-slate-100 rounded-lg">
                          <Edit2 className="w-4 h-4 text-slate-500" />
                        </button>
                        <button onClick={() => deleteGasto(g.id)} className="p-2 hover:bg-red-50 rounded-lg">
                          <Trash2 className="w-4 h-4 text-red-500" />
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

      {/* Impuestos Section */}
      <div className="card overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-bold flex items-center gap-2">
            Impuestos
            <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full text-xs font-bold">
              {impuestosMes.length}
            </span>
          </h3>
          <button onClick={() => { resetImpForm(); setShowImpModal(true) }} className="btn btn-primary">
            <Plus className="w-4 h-4" /> Agregar
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50">
                <th className="text-left p-4 text-xs font-bold text-slate-500 uppercase">Concepto</th>
                <th className="text-left p-4 text-xs font-bold text-slate-500 uppercase">Cuenta</th>
                <th className="text-left p-4 text-xs font-bold text-slate-500 uppercase">Monto</th>
                <th className="text-left p-4 text-xs font-bold text-slate-500 uppercase"></th>
              </tr>
            </thead>
            <tbody>
              {impuestosMes.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-slate-400">Sin impuestos</td>
                </tr>
              ) : (
                <>
                  {impuestosMes.map(i => (
                    <tr key={i.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="p-4 font-semibold">{i.descripcion}</td>
                      <td className="p-4">
                        {tarjetaMap[i.tarjeta_id || ''] ? (
                          <span className={`tag ${getTagClass(tarjetaMap[i.tarjeta_id || ''].tipo)}`}>
                            {tarjetaMap[i.tarjeta_id || ''].nombre}
                          </span>
                        ) : (
                          <span className="tag bg-emerald-100 text-emerald-700">
                            💵 Efectivo
                          </span>
                        )}
                      </td>
                      <td className="p-4 font-bold">{formatMoney(i.monto)}</td>
                      <td className="p-4">
                        <div className="flex gap-1">
                          <button onClick={() => { setEditingImp(i); setImpForm({ descripcion: i.descripcion, tarjeta_id: i.tarjeta_id || '', monto: String(i.monto), mes: i.mes }); setShowImpModal(true) }} className="p-2 hover:bg-slate-100 rounded-lg">
                            <Edit2 className="w-4 h-4 text-slate-500" />
                          </button>
                          <button onClick={() => deleteImpuesto(i.id)} className="p-2 hover:bg-red-50 rounded-lg">
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-slate-50">
                    <td className="p-4 font-bold">TOTAL</td>
                    <td></td>
                    <td className="p-4 font-bold">{formatMoney(totalImp)}</td>
                    <td></td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Gasto Modal */}
      {showGastoModal && (
        <div className="modal-overlay" onClick={() => setShowGastoModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-lg">{editingGasto ? 'Editar' : 'Agregar'} Gasto</h3>
              <button onClick={() => setShowGastoModal(false)} className="p-1 hover:bg-slate-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="label">
                  Descripción <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  className={`input ${!gastoForm.descripcion && gastoError ? 'border-red-500 border-2' : ''}`}
                  value={gastoForm.descripcion}
                  onChange={e => setGastoForm(f => ({ ...f, descripcion: e.target.value }))}
                  placeholder="Ej: Compra en supermercado"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Moneda</label>
                  <select
                    className="input"
                    value={gastoForm.moneda}
                    onChange={e => setGastoForm(f => ({ ...f, moneda: e.target.value }))}
                  >
                    <option value="ARS">Pesos</option>
                    <option value="USD">USD</option>
                  </select>
                </div>
                <div></div> {/* Espacio vacío */}
              </div>

              {/* Cuenta/Tarjeta - Fuera del grid para que se vea bien */}
              <div>
                <label className="label">Cuenta/Tarjeta</label>
                {!showNewTarjetaInput ? (
                  <div className="space-y-2">
                    <select
                      className="input w-full"
                      value={gastoForm.tarjeta_id}
                      onChange={e => setGastoForm(f => ({ ...f, tarjeta_id: e.target.value }))}
                    >
                      <option value="">💵 Efectivo</option>
                      {tarjetas.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                    </select>
                    <button
                      type="button"
                      onClick={() => setShowNewTarjetaInput(true)}
                      className="w-full px-3 py-2 bg-purple-50 text-purple-700 border-2 border-purple-200 rounded-lg text-sm font-bold hover:bg-purple-100 transition"
                    >
                      + Crear nueva cuenta/tarjeta
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3 p-4 bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl border-2 border-purple-300 shadow-sm">
                    <div className="text-sm font-bold text-purple-900">💳 Nueva Cuenta/Tarjeta</div>
                    <div>
                      <input
                        type="text"
                        className="input w-full text-base mb-2"
                        placeholder="Nombre (Ej: Visa BBVA, Cuenta Banco, Mercado Pago...)"
                        value={newTarjeta.nombre}
                        onChange={e => setNewTarjeta(t => ({ ...t, nombre: e.target.value }))}
                        autoFocus
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          className="input text-sm"
                          value={newTarjeta.tipo}
                          onChange={e => setNewTarjeta(t => ({ ...t, tipo: e.target.value as any }))}
                        >
                          <option value="visa">💳 Visa</option>
                          <option value="mastercard">💳 Mastercard</option>
                          <option value="amex">💳 Amex</option>
                          <option value="other">🏦 Otra/Cuenta</option>
                        </select>
                        <input
                          type="text"
                          className="input text-sm"
                          placeholder="Banco (opcional)"
                          value={newTarjeta.banco}
                          onChange={e => setNewTarjeta(t => ({ ...t, banco: e.target.value }))}
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleAddNewTarjeta}
                        className="flex-1 px-4 py-2.5 bg-purple-500 text-white rounded-lg text-sm font-bold hover:bg-purple-600 transition shadow-sm"
                      >
                        ✓ Crear
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowNewTarjetaInput(false)
                          setNewTarjeta({ nombre: '', tipo: 'visa', banco: '', digitos: '' })
                        }}
                        className="flex-1 px-4 py-2.5 bg-white border-2 border-slate-300 text-slate-700 rounded-lg text-sm font-bold hover:bg-slate-50 transition"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">
                    Monto <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    className={`input ${!gastoForm.monto && gastoError ? 'border-red-500 border-2' : ''}`}
                    value={gastoForm.monto}
                    onChange={e => setGastoForm(f => ({ ...f, monto: e.target.value }))}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="label">Cuotas</label>
                  <select
                    className="input"
                    value={gastoForm.cuotas}
                    onChange={e => setGastoForm(f => ({ ...f, cuotas: e.target.value }))}
                  >
                    {[1,3,6,12,18,24].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Fecha</label>
                  <input
                    type="date"
                    className="input"
                    value={gastoForm.fecha}
                    onChange={e => setGastoForm(f => ({ ...f, fecha: e.target.value }))}
                  />
                </div>
                <div></div> {/* Espacio vacío */}
              </div>

              {/* Categoría - Fuera del grid para que se vea bien */}
              <div>
                <label className="label">Categoría</label>
                {!showNewCategoriaInput ? (
                  <div className="space-y-2">
                    <select
                      className="input w-full"
                      value={gastoForm.categoria_id}
                      onChange={e => setGastoForm(f => ({ ...f, categoria_id: e.target.value }))}
                    >
                      <option value="">Seleccionar</option>
                      {categorias.map(c => <option key={c.id} value={c.id}>{c.icono} {c.nombre}</option>)}
                    </select>
                    <button
                      type="button"
                      onClick={() => setShowNewCategoriaInput(true)}
                      className="w-full px-3 py-2 bg-indigo-50 text-indigo-700 border-2 border-indigo-200 rounded-lg text-sm font-bold hover:bg-indigo-100 transition"
                    >
                      + Crear nueva categoría
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3 p-4 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl border-2 border-indigo-300 shadow-sm">
                    <div className="text-sm font-bold text-indigo-900">✨ Nueva Categoría</div>
                    <div className="flex gap-3 items-start">
                      <div className="flex-1">
                        <input
                          type="text"
                          className="input w-full text-base"
                          placeholder="Ej: Comidas, Transporte, Servicios..."
                          value={newCategoria.nombre}
                          onChange={e => setNewCategoria(c => ({ ...c, nombre: e.target.value }))}
                          autoFocus
                        />
                      </div>
                      <select
                        className="input w-20 h-11 text-center text-2xl p-1 cursor-pointer hover:bg-slate-50"
                        value={newCategoria.icono}
                        onChange={e => setNewCategoria(c => ({ ...c, icono: e.target.value }))}
                        title="Seleccionar ícono"
                      >
                        <option value="💰">💰</option>
                        <option value="🛒">🛒</option>
                        <option value="🍔">🍔</option>
                        <option value="🏠">🏠</option>
                        <option value="🚗">🚗</option>
                        <option value="💊">💊</option>
                        <option value="🎮">🎮</option>
                        <option value="👕">👕</option>
                        <option value="✈️">✈️</option>
                        <option value="📚">📚</option>
                      </select>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleAddNewCategoria}
                        className="flex-1 px-4 py-2.5 bg-emerald-500 text-white rounded-lg text-sm font-bold hover:bg-emerald-600 transition shadow-sm"
                      >
                        ✓ Crear
                      </button>
                      <button
                        type="button"
                        onClick={() => { setShowNewCategoriaInput(false); setNewCategoria({ nombre: '', icono: '💰' }) }}
                        className="flex-1 px-4 py-2.5 bg-white border-2 border-slate-300 text-slate-700 rounded-lg text-sm font-bold hover:bg-slate-50 transition"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={gastoForm.es_fijo}
                  onChange={e => setGastoForm(f => ({ ...f, es_fijo: e.target.checked }))}
                  className="w-5 h-5 accent-indigo-500"
                />
                <span className="font-semibold">Gasto fijo mensual</span>
              </label>

              {/* Etiquetas multiselect */}
              <div>
                <label className="label">
                  Etiquetas
                  <span className="text-xs text-slate-500 font-normal ml-2">
                    (Para organizar y filtrar gastos por categorías personalizadas)
                  </span>
                </label>
                <div className="flex flex-wrap gap-2 p-3 bg-slate-50 rounded-xl border-2 border-slate-200 min-h-[3rem]">
                  {tags.map(t => {
                    const isSelected = gastoForm.tag_ids.includes(t.id)
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            setGastoForm(f => ({ ...f, tag_ids: f.tag_ids.filter(id => id !== t.id) }))
                          } else {
                            setGastoForm(f => ({ ...f, tag_ids: [...f.tag_ids, t.id] }))
                          }
                        }}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold transition ${
                          isSelected
                            ? 'bg-orange-500 text-white'
                            : 'bg-white text-orange-700 border border-orange-200 hover:bg-orange-50'
                        }`}
                      >
                        {t.nombre}
                      </button>
                    )
                  })}
                  {!showNewTagInput && (
                    <button
                      type="button"
                      onClick={() => setShowNewTagInput(true)}
                      className="px-3 py-1.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-700 border border-indigo-200 hover:bg-indigo-200 transition"
                    >
                      + Nueva etiqueta
                    </button>
                  )}
                  {showNewTagInput && (
                    <div className="flex gap-1 items-center">
                      <input
                        type="text"
                        className="input py-1 px-2 text-xs w-32"
                        placeholder="Nombre"
                        value={newTagName}
                        onChange={e => setNewTagName(e.target.value)}
                        onKeyPress={e => e.key === 'Enter' && handleAddNewTag()}
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={handleAddNewTag}
                        className="px-2 py-1 bg-emerald-500 text-white rounded text-xs font-bold hover:bg-emerald-600"
                      >
                        ✓
                      </button>
                      <button
                        type="button"
                        onClick={() => { setShowNewTagInput(false); setNewTagName('') }}
                        className="px-2 py-1 bg-slate-300 text-slate-700 rounded text-xs font-bold hover:bg-slate-400"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Error de validación */}
              {gastoError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
                  ⚠️ {gastoError}
                </div>
              )}

              <button onClick={() => {
                console.log('🔵 [GastosPage] "Guardar Gasto" button CLICKED')
                handleSaveGasto()
              }} className="btn btn-primary w-full justify-center">
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Impuesto Modal */}
      {showImpModal && (
        <div className="modal-overlay" onClick={() => setShowImpModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-lg">{editingImp ? 'Editar' : 'Agregar'} Impuesto</h3>
              <button onClick={() => setShowImpModal(false)} className="p-1 hover:bg-slate-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="label">Concepto</label>
                <input
                  type="text"
                  className="input"
                  value={impForm.descripcion}
                  onChange={e => setImpForm(f => ({ ...f, descripcion: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Cuenta</label>
                  <select
                    className="input"
                    value={impForm.tarjeta_id}
                    onChange={e => setImpForm(f => ({ ...f, tarjeta_id: e.target.value }))}
                  >
                    <option value="">💵 Efectivo</option>
                    {tarjetas.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Monto</label>
                  <input
                    type="number"
                    step="0.01"
                    className="input"
                    value={impForm.monto}
                    onChange={e => setImpForm(f => ({ ...f, monto: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <label className="label">Mes</label>
                <input
                  type="month"
                  className="input"
                  value={impForm.mes}
                  onChange={e => setImpForm(f => ({ ...f, mes: e.target.value }))}
                />
              </div>
              <button onClick={handleSaveImp} className="btn btn-primary w-full justify-center">
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmación de Pago */}
      {showPagoModal && gastoToMarkPaid && (
        <div className="modal-overlay" onClick={() => setShowPagoModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-lg">
                {gastoToMarkPaid.pagado ? 'Ver/Editar Pago' : 'Confirmar Pago'}
              </h3>
              <button onClick={() => setShowPagoModal(false)} className="p-1 hover:bg-slate-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="bg-indigo-50 p-3 rounded-lg">
                <div className="font-semibold text-indigo-900">{gastoToMarkPaid.descripcion}</div>
                <div className="text-indigo-700 font-bold mt-1">
                  {formatMoney(gastoToMarkPaid.monto, gastoToMarkPaid.moneda)}
                </div>
              </div>

              <div>
                <label className="label">Fecha de Pago</label>
                <input
                  type="date"
                  className="input"
                  value={pagoForm.fecha_pago}
                  onChange={e => setPagoForm(f => ({ ...f, fecha_pago: e.target.value }))}
                />
              </div>

              <div>
                <label className="label">Medio de Pago (opcional)</label>
                <select
                  className="input"
                  value={pagoForm.medio_pago}
                  onChange={e => setPagoForm(f => ({ ...f, medio_pago: e.target.value }))}
                >
                  <option value="">Seleccionar...</option>
                  <option value="efectivo">💵 Efectivo</option>
                  <option value="transferencia">🏦 Transferencia</option>
                  <option value="debito">💳 Débito</option>
                  <option value="credito">💳 Crédito</option>
                  <option value="mercadopago">📱 Mercado Pago</option>
                  {mediosPago.length > 0 && <option disabled>──────────</option>}
                  {mediosPago.map(medio => (
                    <option key={medio.id} value={medio.nombre}>✨ {medio.nombre}</option>
                  ))}
                  <option value="nuevo">➕ Nuevo medio de pago</option>
                </select>
                {pagoForm.medio_pago === 'nuevo' && (
                  <div className="mt-2">
                    <input
                      type="text"
                      className="input"
                      placeholder="Escribí el nombre del medio de pago..."
                      value={pagoForm.medio_pago_custom}
                      onChange={e => setPagoForm(f => ({ ...f, medio_pago_custom: e.target.value }))}
                      autoFocus
                    />
                    <p className="text-xs text-slate-500 mt-1">Por ejemplo: PayPal, Uala, Brubank, etc.</p>
                  </div>
                )}
              </div>

              <div>
                <label className="label">Comprobante (opcional)</label>
                {gastoToMarkPaid.pagado && gastoToMarkPaid.comprobante_url && !pagoForm.comprobante && (
                  <div className="mb-3 p-4 bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-emerald-300 rounded-xl shadow-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-bold text-emerald-900 mb-1 flex items-center gap-2">
                          📎 {gastoToMarkPaid.comprobante_nombre || 'Comprobante guardado'}
                        </div>
                        {gastoToMarkPaid.fecha_pago && (
                          <div className="text-xs text-emerald-700">
                            Subido el {new Date(gastoToMarkPaid.fecha_pago).toLocaleDateString('es-AR', {
                              day: 'numeric',
                              month: 'long',
                              year: 'numeric'
                            })}
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => downloadComprobante(gastoToMarkPaid)}
                        className="px-4 py-2.5 bg-emerald-500 text-white rounded-lg text-sm font-bold hover:bg-emerald-600 transition shadow-md flex items-center gap-2"
                      >
                        <Download className="w-4 h-4" />
                        Descargar
                      </button>
                    </div>
                  </div>
                )}
                <input
                  type="file"
                  className="input"
                  accept="image/*,.pdf"
                  onChange={e => setPagoForm(f => ({ ...f, comprobante: e.target.files?.[0] || null }))}
                />
                {pagoForm.comprobante && (
                  <div className="mt-2 text-sm text-emerald-600 font-semibold">
                    ✓ {pagoForm.comprobante.name}
                  </div>
                )}
                {gastoToMarkPaid.comprobante_url && pagoForm.comprobante && (
                  <div className="mt-2 p-2 bg-orange-50 border border-orange-200 rounded text-xs text-orange-700">
                    ⚠️ Esto reemplazará el comprobante actual
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleConfirmPago}
                  className="btn btn-success flex-1 justify-center"
                >
                  {gastoToMarkPaid.pagado ? '✓ Actualizar' : '✓ Confirmar Pago'}
                </button>
                {gastoToMarkPaid.pagado && (
                  <button
                    onClick={async () => {
                      await updateGasto(gastoToMarkPaid.id, {
                        pagado: false,
                        fecha_pago: null,
                        medio_pago: null,
                        comprobante_url: null,
                        comprobante_nombre: null
                      })
                      setShowPagoModal(false)
                      setGastoToMarkPaid(null)
                    }}
                    className="btn btn-danger flex-1 justify-center"
                  >
                    Desmarcar
                  </button>
                )}
                <button
                  onClick={() => setShowPagoModal(false)}
                  className="btn btn-secondary flex-1 justify-center"
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

const iconOptions = ['🎯', '💰', '🏠', '🚗', '✈️', '🎮', '📚', '💊', '👕', '🍔', '🛒']
