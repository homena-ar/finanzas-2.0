'use client'

import { useState } from 'react'
import { useData } from '@/hooks/useData'
import { useWorkspace } from '@/hooks/useWorkspace'
import { useAuth } from '@/hooks/useAuth'
import { formatMoney, getMonthName } from '@/lib/utils'
import { Plus, Edit2, Trash2, X, Wallet, Search, Upload, Image as ImageIcon, Loader2, CheckCircle2, Download } from 'lucide-react'
import { Ingreso } from '@/types'
import { ConfirmModal, AlertModal } from '@/components/Modal'
import { EmojiPickerField } from '@/components/EmojiPickerField'

export default function IngresosPage() {
  const { user, profile } = useAuth()
  const { currentWorkspace, members } = useWorkspace()
  const {
    ingresos, categoriasIngresos, tagsIngresos, tarjetas,
    currentMonth, monthKey, getIngresosMes,
    addIngreso, updateIngreso, deleteIngreso,
    addTagIngreso, addCategoriaIngreso, addTarjeta
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
    tag_ids: [] as string[],
    pendiente_cobro: false,
    fecha_cobro_esperada: '' as string | null,
    cuenta_bancaria_id: '' as string | null,
    comprobante: null as File | null,
    notificar_celular: true,
    notificar_correo: true
  })

  // Modal states
  const [showConfirmDelete, setShowConfirmDelete] = useState(false)
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)
  const [showAlert, setShowAlert] = useState(false)
  const [alertData, setAlertData] = useState({ title: '', message: '', variant: 'info' as 'success' | 'error' | 'warning' | 'info' })
  const [selectedIngresos, setSelectedIngresos] = useState<Set<string>>(new Set())
  const [showDeleteMasivoModal, setShowDeleteMasivoModal] = useState(false)

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
  const [editedTransactions, setEditedTransactions] = useState<Map<number, any>>(new Map())
  const [savingTransactions, setSavingTransactions] = useState(false)

  // IA (preview): creación/edición sin mezclar con el modal principal
  const [aiShowNewTagInput, setAiShowNewTagInput] = useState(false)
  const [aiNewTagName, setAiNewTagName] = useState('')
  const [aiShowNewCategoriaInput, setAiShowNewCategoriaInput] = useState(false)
  const [aiNewCategoria, setAiNewCategoria] = useState({ nombre: '', icono: '💵', color: '#3b82f6' })
  const [aiExpandedTransaction, setAiExpandedTransaction] = useState<number | null>(null)
  
  // Modal de edición de transacción individual del preview
  const [editingAiTransaction, setEditingAiTransaction] = useState<number | null>(null)
  const [aiTransactionForm, setAiTransactionForm] = useState({
    descripcion: '',
    categoria_id: '',
    monto: '',
    moneda: 'ARS' as 'ARS' | 'USD',
    fecha: new Date().toISOString().split('T')[0],
    tag_ids: [] as string[],
    pendiente_cobro: false,
    fecha_cobro_esperada: '' as string | null,
    cuenta_bancaria_id: '' as string | null,
    notificar_celular: true,
    notificar_correo: true
  })

  const findCategoriaIdFromLabel = (label?: string) => {
    const normalized = (label || '').trim().toLowerCase()
    if (!normalized) return ''
    const match = categoriasIngresos.find(
      c => c.nombre.toLowerCase().includes(normalized) || normalized.includes(c.nombre.toLowerCase())
    )
    return match?.id || ''
  }

  const updateEditedTransaction = (index: number, field: string, value: any) => {
    const newEdited = new Map(editedTransactions)
    const current = newEdited.get(index) || {}
    newEdited.set(index, { ...current, [field]: value })
    setEditedTransactions(newEdited)
  }

  const getTransactionTagIds = (index: number) => {
    const edited = editedTransactions.get(index)
    if (edited && Array.isArray(edited.tag_ids)) return edited.tag_ids as string[]
    return form.tag_ids || []
  }

  const toggleTransactionTag = (index: number, tagId: string) => {
    const current = getTransactionTagIds(index)
    const next = current.includes(tagId) ? current.filter(id => id !== tagId) : [...current, tagId]
    updateEditedTransaction(index, 'tag_ids', next)
  }

  const handleAddNewTagAI = async () => {
    if (!aiNewTagName.trim()) return
    await addTagIngreso(aiNewTagName.trim())
    setAiNewTagName('')
    setAiShowNewTagInput(false)
  }

  const handleAddNewCategoriaAI = async () => {
    if (!aiNewCategoria.nombre.trim()) return
    await addCategoriaIngreso({
      nombre: aiNewCategoria.nombre.trim(),
      icono: aiNewCategoria.icono,
      color: aiNewCategoria.color
    })
    setAiNewCategoria({ nombre: '', icono: '💵', color: '#3b82f6' })
    setAiShowNewCategoriaInput(false)
  }

  const buildDetectedCuentaName = (t: any) => {
    const banco = t?.banco ? String(t.banco).trim() : ''
    const tipo = t?.tipo_tarjeta ? String(t.tipo_tarjeta).trim() : ''
    const base = [tipo, banco].filter(Boolean).join(' ')
    return base || 'Nueva cuenta/tarjeta'
  }

  const handleAddNewCuentaAI = async () => {
    if (!aiNewCuenta.nombre.trim()) return
    const result = await addTarjeta({
      nombre: aiNewCuenta.nombre.trim(),
      tipo: aiNewCuenta.tipo,
      banco: aiNewCuenta.banco || null,
      digitos: aiNewCuenta.digitos || null,
      cierre: null
    })
    if (!result.error && result.id) {
      setSelectedCuentaId(result.id as string)
    }
    setAiNewCuenta({ nombre: '', tipo: 'visa', banco: '', digitos: '' })
    setAiShowNewCuentaInput(false)
  }

  // Función para crear automáticamente categoría si no existe y la IA la sugiere
  const ensureCategoriaExists = async (categoriaLabel: string): Promise<string | null> => {
    if (!categoriaLabel) return null
    
    // Buscar si ya existe
    const existingId = findCategoriaIdFromLabel(categoriaLabel)
    if (existingId) {
      console.log('✅ [Ingresos] Categoría ya existe:', categoriaLabel, '→', existingId)
      return existingId
    }
    
    // Crear automáticamente
    console.log('🔵 [Ingresos] Creando categoría automáticamente:', categoriaLabel)
    const { error, id } = await addCategoriaIngreso({
      nombre: categoriaLabel.trim(),
      icono: '💵',
      color: '#3b82f6'
    })
    
    if (error) {
      console.error('❌ [Ingresos] Error creando categoría automáticamente:', error)
      return null
    }
    
    // Si addCategoriaIngreso devuelve el ID, usarlo directamente
    if (id) {
      console.log('✅ [Ingresos] Categoría creada con ID:', categoriaLabel, '→', id)
      return id
    }
    
    // Si no devuelve ID, esperar y buscar
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // Buscar de nuevo en las categorías actualizadas
    const newId = findCategoriaIdFromLabel(categoriaLabel)
    if (newId) {
      console.log('✅ [Ingresos] Categoría creada y encontrada:', categoriaLabel, '→', newId)
      return newId
    }
    
    console.warn('⚠️ [Ingresos] Categoría creada pero no encontrada después de esperar:', categoriaLabel)
    return null
  }

  // Función para crear automáticamente cuenta/tarjeta si no existe
  const ensureCuentaExists = async (cuentaData: any): Promise<string | null> => {
    if (!cuentaData || (!cuentaData.banco && !cuentaData.tipo_tarjeta)) return null
    
    const nombreCuenta = buildDetectedCuentaName(cuentaData)
    
    // Buscar si ya existe
    const existing = tarjetas.find(t => 
      t.nombre.toLowerCase().includes(nombreCuenta.toLowerCase()) ||
      nombreCuenta.toLowerCase().includes(t.nombre.toLowerCase())
    )
    if (existing) return existing.id
    
    // Crear automáticamente
    const result = await addTarjeta({
      nombre: nombreCuenta,
      tipo: cuentaData.tipo_tarjeta?.toLowerCase().includes('master') ? 'mastercard' :
            cuentaData.tipo_tarjeta?.toLowerCase().includes('amex') ? 'amex' :
            cuentaData.tipo_tarjeta?.toLowerCase().includes('visa') ? 'visa' : 'other',
      banco: cuentaData.banco || null,
      digitos: cuentaData.ultimos_digitos || null,
      cierre: null
    })
    
    return result.id || null
  }

  // Filters
  const [filters, setFilters] = useState({ 
    search: '', 
    colaborador: '', 
    moneda: '', 
    categoria: '', 
    tag: '', 
    cuenta: '',
    pendiente: '',
    sort: 'monto-desc' 
  })

  // Estado para fecha/mes general del documento (similar a gastos)
  const [globalDocumentDate, setGlobalDocumentDate] = useState<string | null>(null)
  const [useGlobalDate, setUseGlobalDate] = useState(false)

  // Estados para creación automática de tarjetas/cuentas
  const [detectedCuenta, setDetectedCuenta] = useState<any>(null)
  const [selectedCuentaId, setSelectedCuentaId] = useState<string>('')
  const [aiShowNewCuentaInput, setAiShowNewCuentaInput] = useState(false)
  const [aiNewCuenta, setAiNewCuenta] = useState({
    nombre: '',
    tipo: 'visa' as 'visa' | 'mastercard' | 'amex' | 'other',
    banco: '',
    digitos: ''
  })

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
  if (filters.categoria) {
    ingresosMes = ingresosMes.filter(i => i.categoria_id === filters.categoria)
  }
  if (filters.tag) {
    ingresosMes = ingresosMes.filter(i => i.tag_ids?.includes(filters.tag))
  }
  if (filters.cuenta) {
    ingresosMes = ingresosMes.filter(i => (i as any).cuenta_bancaria_id === filters.cuenta)
  }
  if (filters.pendiente) {
    if (filters.pendiente === 'si') {
      ingresosMes = ingresosMes.filter(i => (i as any).pendiente_cobro === true && !(i as any).fecha_cobro_confirmada)
    } else if (filters.pendiente === 'no') {
      ingresosMes = ingresosMes.filter(i => !(i as any).pendiente_cobro || (i as any).fecha_cobro_confirmada)
    }
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

  // Sort
  const sortParts = filters.sort.split('-')
  const [sortField, sortDir] = sortParts.length === 2 ? sortParts : ['monto', 'desc']
  ingresosMes.sort((a, b) => {
    let vA, vB
    if (sortField === 'monto') {
      vA = a.monto
      vB = b.monto
    } else if (sortField === 'fecha') {
      vA = new Date(a.fecha).getTime()
      vB = new Date(b.fecha).getTime()
    } else {
      vA = a.descripcion.toLowerCase()
      vB = b.descripcion.toLowerCase()
    }
    return sortDir === 'asc' ? (vA < vB ? -1 : vA > vB ? 1 : 0) : (vA > vB ? -1 : vA < vB ? 1 : 0)
  })

  // Calculate totals (solo ingresos confirmados/no pendientes)
  const totalARS = ingresosMes
    .filter(i => i.moneda === 'ARS' && (!(i as any).pendiente_cobro || (i as any).fecha_cobro_confirmada))
    .reduce((sum, i) => sum + i.monto, 0)
  const totalUSD = ingresosMes
    .filter(i => i.moneda === 'USD' && (!(i as any).pendiente_cobro || (i as any).fecha_cobro_confirmada))
    .reduce((sum, i) => sum + i.monto, 0)
  const totalPendienteARS = ingresosMes
    .filter(i => i.moneda === 'ARS' && (i as any).pendiente_cobro && !(i as any).fecha_cobro_confirmada)
    .reduce((sum, i) => sum + i.monto, 0)
  const totalPendienteUSD = ingresosMes
    .filter(i => i.moneda === 'USD' && (i as any).pendiente_cobro && !(i as any).fecha_cobro_confirmada)
    .reduce((sum, i) => sum + i.monto, 0)

  const resetForm = () => {
    setForm({
      descripcion: '',
      categoria_id: categoriasIngresos[0]?.id || '',
      monto: '',
      moneda: 'ARS',
      fecha: new Date().toISOString().split('T')[0],
      tag_ids: [],
      pendiente_cobro: false,
      fecha_cobro_esperada: null,
      cuenta_bancaria_id: null,
      comprobante: null,
      notificar_celular: true,
      notificar_correo: true
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
      tag_ids: ingreso.tag_ids || [],
      pendiente_cobro: (ingreso as any).pendiente_cobro || false,
      fecha_cobro_esperada: (ingreso as any).fecha_cobro_esperada || null,
      cuenta_bancaria_id: (ingreso as any).cuenta_bancaria_id || null,
      comprobante: null, // No pre-cargar archivo
      notificar_celular: (ingreso as any).notificar_celular !== undefined ? (ingreso as any).notificar_celular : true,
      notificar_correo: (ingreso as any).notificar_correo !== undefined ? (ingreso as any).notificar_correo : true
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

    // Convertir comprobante a base64 si existe
    let comprobanteUrl = null
    let comprobanteNombre = null
    if (form.comprobante) {
      comprobanteNombre = form.comprobante.name
      const reader = new FileReader()
      comprobanteUrl = await new Promise((resolve) => {
        reader.onloadend = () => resolve(reader.result as string)
        reader.readAsDataURL(form.comprobante!)
      })
    }

    const data: any = {
      descripcion: form.descripcion,
      categoria_id: form.categoria_id || null,
      monto: parseFloat(form.monto),
      moneda: form.moneda,
      fecha: form.fecha,
      mes: mes,
      tag_ids: form.tag_ids,
      pendiente_cobro: form.pendiente_cobro || false,
      fecha_cobro_esperada: form.fecha_cobro_esperada || null,
      cuenta_bancaria_id: form.cuenta_bancaria_id || null,
      comprobante_url: comprobanteUrl,
      comprobante_nombre: comprobanteNombre,
      notificar_celular: form.notificar_celular !== undefined ? form.notificar_celular : true,
      notificar_correo: form.notificar_correo !== undefined ? form.notificar_correo : true
    }

    // Si no está marcado como pendiente o ya se confirmó, establecer fecha_cobro_confirmada
    if (!form.pendiente_cobro || editing?.fecha_cobro_confirmada) {
      if (!editing?.fecha_cobro_confirmada && !form.pendiente_cobro) {
        data.fecha_cobro_confirmada = form.fecha
      }
    } else {
      // Si está pendiente, asegurar que fecha_cobro_confirmada sea null
      data.fecha_cobro_confirmada = null
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
    setEditedTransactions(new Map())
    setAiExpandedTransaction(null)
    setAiShowNewTagInput(false)
    setAiNewTagName('')
    setAiShowNewCategoriaInput(false)
    setAiNewCategoria({ nombre: '', icono: '💵', color: '#3b82f6' })
    setAiShowNewCuentaInput(false)
    setAiNewCuenta({ nombre: '', tipo: 'visa', banco: '', digitos: '' })
    setDetectedCuenta(null)
    setSelectedCuentaId('')
    setGlobalDocumentDate(null)
    setUseGlobalDate(false)

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
        
        // Detectar fecha general del documento desde el mes del resumen
        if (result.data?.total && result.data.total.mes_resumen) {
          const mesResumen = result.data.total.mes_resumen // Formato: "YYYY-MM"
          // Asegurar que sea el primer día del mes (no el último del mes anterior)
          const fechaResumen = `${mesResumen}-01`
          setGlobalDocumentDate(fechaResumen)
          setUseGlobalDate(true)
        } else if (result.data?.transacciones && result.data.transacciones.length > 0) {
          const firstDate = result.data.transacciones[0]?.fecha
          if (firstDate) {
            // Si hay fecha, usar el primer día de ese mes
            const fechaDate = new Date(firstDate)
            const mesResumen = `${fechaDate.getFullYear()}-${String(fechaDate.getMonth() + 1).padStart(2, '0')}`
            setGlobalDocumentDate(`${mesResumen}-01`)
            setUseGlobalDate(true)
          } else {
            // Si no hay fecha, usar el primer día del mes actual
            const hoy = new Date()
            const mesActual = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`
            setGlobalDocumentDate(`${mesActual}-01`)
            setUseGlobalDate(false)
          }
        } else {
          // Si no hay transacciones, usar el primer día del mes actual
          const hoy = new Date()
          const mesActual = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`
          setGlobalDocumentDate(`${mesActual}-01`)
          setUseGlobalDate(false)
        }

        // Si hay información de cuenta/tarjeta detectada, configurarla
        if (result.data?.tarjeta) {
          setDetectedCuenta(result.data.tarjeta)
          // Intentar encontrar tarjeta existente
          const nombreDetectado = buildDetectedCuentaName(result.data.tarjeta)
          const existing = tarjetas.find(t => 
            t.nombre.toLowerCase().includes(nombreDetectado.toLowerCase()) ||
            nombreDetectado.toLowerCase().includes(t.nombre.toLowerCase())
          )
          if (existing) {
            setSelectedCuentaId(existing.id)
          }
        }
        
        // Seleccionar automáticamente todas las transacciones detectadas
        if (result.data?.transacciones && Array.isArray(result.data.transacciones)) {
          const allTransactions = new Set<number>(result.data.transacciones.map((_: any, i: number) => i))
          setSelectedTransactions(allTransactions)
          
          // Preseleccionar categorías (si la IA sugiere una que coincide con las existentes)
          const initialEdited = new Map<number, any>()
          result.data.transacciones.forEach((trans: any, i: number) => {
            const categoriaId = findCategoriaIdFromLabel(trans?.categoria)
            if (categoriaId) {
              initialEdited.set(i, { ...(initialEdited.get(i) || {}), categoria_id: categoriaId })
            }
          })
          if (initialEdited.size > 0) setEditedTransactions(initialEdited)
        }
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

  const handleConfirmExtractedData = async () => {
    if (!extractedData) return

    // Si hay múltiples transacciones (resumen)
    if (extractedData.transacciones && Array.isArray(extractedData.transacciones)) {
      // Mapear transacciones seleccionadas manteniendo el índice original
      const transactionsToAdd: Array<{ trans: any; originalIndex: number }> = []
      extractedData.transacciones.forEach((trans: any, index: number) => {
        if (selectedTransactions.has(index)) {
          const edited = editedTransactions.get(index)
          transactionsToAdd.push({
            trans: edited ? { ...trans, ...edited } : { ...trans },
            originalIndex: index
          })
        }
      })
      
      if (transactionsToAdd.length === 0 && !includeTotal) {
        setAlertData({
          title: 'Error',
          message: 'Por favor, selecciona al menos una transacción',
          variant: 'error'
        })
        setShowAlert(true)
        return
      }

      setSavingTransactions(true)

      // Crear cuenta/tarjeta automáticamente si fue detectada y no existe
      let cuentaIdToUse = selectedCuentaId || null
      if (detectedCuenta && !cuentaIdToUse) {
        cuentaIdToUse = await ensureCuentaExists(detectedCuenta)
        if (cuentaIdToUse) {
          setSelectedCuentaId(cuentaIdToUse)
        }
      }

      // Mapa para evitar crear categorías duplicadas en el mismo proceso
      const categoriasCreadas = new Map<string, string>() // Map<categoriaLabel, categoriaId>

      // Agregar cada transacción seleccionada como ingreso individual
      const addPromises = transactionsToAdd.map(async ({ trans, originalIndex }) => {
        // Obtener ediciones si existen (usando el índice original)
        const edited = editedTransactions.get(originalIndex) || {}
        
        // Crear categoría automáticamente si la IA la sugiere y no existe
        let categoriaId = ''
        if (edited.categoria_id) {
          categoriaId = String(edited.categoria_id)
        } else if (trans.categoria_id) {
          categoriaId = String(trans.categoria_id)
        } else if (trans.categoria) {
          const categoriaLabel = trans.categoria.trim()
          
          // Verificar si ya creamos esta categoría en este proceso
          if (categoriasCreadas.has(categoriaLabel)) {
            categoriaId = categoriasCreadas.get(categoriaLabel)!
            console.log('✅ [Ingresos] Reutilizando categoría ya creada en este proceso:', categoriaLabel, '→', categoriaId)
          } else {
            // Intentar encontrar primero en las existentes
            categoriaId = findCategoriaIdFromLabel(categoriaLabel)
            // Si no existe, crearla automáticamente
            if (!categoriaId) {
              console.log('🔵 [Ingresos] Creando categoría automáticamente:', categoriaLabel)
              categoriaId = (await ensureCategoriaExists(categoriaLabel)) || ''
              if (categoriaId) {
                // Guardar en el mapa para reutilizar
                categoriasCreadas.set(categoriaLabel, categoriaId)
                console.log('✅ [Ingresos] Categoría creada y guardada en mapa:', categoriaLabel, '→', categoriaId)
              } else {
                console.warn('⚠️ [Ingresos] No se pudo crear/obtener categoría:', categoriaLabel)
              }
            } else {
              // Guardar en el mapa para reutilizar
              categoriasCreadas.set(categoriaLabel, categoriaId)
              console.log('✅ [Ingresos] Categoría encontrada y guardada en mapa:', categoriaLabel, '→', categoriaId)
            }
          }
        } else if (form.categoria_id && form.categoria_id !== '__new__') {
          categoriaId = form.categoria_id
        }

        // Usar fecha global del mes del resumen si está disponible, sino usar la fecha de la transacción o del formulario
        let fecha = (useGlobalDate && globalDocumentDate) ? globalDocumentDate : (edited.fecha || trans.fecha || form.fecha)
        
        // Si se usa fecha global, asegurar que sea el primer día del mes seleccionado
        if (useGlobalDate && globalDocumentDate) {
          // globalDocumentDate ya debería ser YYYY-MM-01, pero asegurémonos
          const [year, month] = globalDocumentDate.split('-')
          fecha = `${year}-${month}-01`
        }
        
        const fechaDate = new Date(fecha)
        const mes = `${fechaDate.getFullYear()}-${String(fechaDate.getMonth() + 1).padStart(2, '0')}`
        const tagIds = Array.isArray(edited.tag_ids) ? edited.tag_ids : (Array.isArray(trans.tag_ids) ? trans.tag_ids : (form.tag_ids || []))
        
        // Determinar si está pendiente de cobro (desde ediciones o por defecto false)
        const pendienteCobro = edited.pendiente_cobro !== undefined ? edited.pendiente_cobro : false
        const fechaCobroEsperada = edited.fecha_cobro_esperada || null
        
        // Calcular cuándo se enviará la notificación
        let notificacionInfo = ''
        if (pendienteCobro && fechaCobroEsperada) {
          const fechaCobro = new Date(fechaCobroEsperada)
          const hoy = new Date()
          hoy.setHours(0, 0, 0, 0)
          fechaCobro.setHours(0, 0, 0, 0)
          const diasDiferencia = Math.ceil((fechaCobro.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24))
          
          if (diasDiferencia === 0) {
            notificacionInfo = ' (Notificación: hoy)'
          } else if (diasDiferencia === 1) {
            notificacionInfo = ' (Notificación: mañana)'
          } else if (diasDiferencia > 1) {
            notificacionInfo = ` (Notificación: en ${diasDiferencia} días)`
          } else {
            notificacionInfo = ' (Notificación: ya pasó la fecha)'
          }
        }
        
        console.log('🔵 [Ingresos] Agregando ingreso:', {
          descripcion: edited.descripcion || trans.descripcion,
          categoria_id: categoriaId || null,
          categoria_sugerida: trans.categoria,
          pendiente_cobro: pendienteCobro,
          fecha_cobro_esperada: fechaCobroEsperada,
          notificacion: notificacionInfo
        })
        
        const { error } = await addIngreso({
          descripcion: edited.descripcion || trans.descripcion,
          categoria_id: categoriaId || null,
          monto: edited.monto !== undefined ? edited.monto : trans.monto,
          moneda: edited.moneda || trans.moneda || 'ARS',
          fecha: fecha,
          mes: mes,
          tag_ids: tagIds,
          origen: trans.origen || '',
          cuenta_bancaria_id: edited.cuenta_bancaria_id || cuentaIdToUse,
          pendiente_cobro: pendienteCobro,
          fecha_cobro_esperada: fechaCobroEsperada,
          fecha_cobro_confirmada: pendienteCobro ? null : fecha, // Solo se confirma si no está pendiente
          notificar_celular: edited.notificar_celular !== undefined ? edited.notificar_celular : (pendienteCobro ? true : false), // Notificar solo si está pendiente
          notificar_correo: edited.notificar_correo !== undefined ? edited.notificar_correo : (pendienteCobro ? true : false) // Notificar solo si está pendiente
        })

        if (error) {
          console.error('Error al agregar ingreso desde IA:', error)
          throw error
        }
      })

      // Si se solicita, agregar el total también
      if (includeTotal && extractedData.total && extractedData.total.monto) {
        const totalFecha = (useGlobalDate && globalDocumentDate) ? globalDocumentDate : form.fecha
        const totalFechaDate = new Date(totalFecha)
        const totalMes = `${totalFechaDate.getFullYear()}-${String(totalFechaDate.getMonth() + 1).padStart(2, '0')}`
        addPromises.push((async () => {
          const { error } = await addIngreso({
            descripcion: `Total del resumen - ${extractedData.total.periodo || 'Período'}`,
            categoria_id: null,
            monto: extractedData.total.monto,
            moneda: extractedData.total.moneda || 'ARS',
            fecha: totalFecha,
            mes: totalMes,
            tag_ids: form.tag_ids || [],
            origen: extractedData.total.periodo || '',
            cuenta_bancaria_id: cuentaIdToUse,
            pendiente_cobro: false,
            fecha_cobro_confirmada: totalFecha
          })

          if (error) {
            console.error('Error al agregar ingreso TOTAL desde IA:', error)
            throw error
          }
        })())
      }

      try {
        await Promise.all(addPromises)
        setShowImagePreview(false)
        setExtractedData(null)
        setPreviewImage(null)
        setSelectedTransactions(new Set())
        setIncludeTotal(false)
        setEditedTransactions(new Map())
        setAiExpandedTransaction(null)
        setAiShowNewTagInput(false)
        setAiNewTagName('')
        setAiShowNewCategoriaInput(false)
        setAiNewCategoria({ nombre: '', icono: '💵', color: '#3b82f6' })
        setAiShowNewCuentaInput(false)
        setAiNewCuenta({ nombre: '', tipo: 'visa', banco: '', digitos: '' })
        setDetectedCuenta(null)
        setSelectedCuentaId('')
        setGlobalDocumentDate(null)
        setUseGlobalDate(false)
        setSavingTransactions(false)
        setShowModal(false)
        resetForm()
      } catch (error) {
        console.error('Error agregando transacciones:', error)
        setSavingTransactions(false)
        setAlertData({
          title: 'Error',
          message: 'Error al agregar las transacciones. Por favor, intenta nuevamente.',
          variant: 'error'
        })
        setShowAlert(true)
      }
      
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
    setEditedTransactions(new Map())
    setAiExpandedTransaction(null)
    setAiShowNewTagInput(false)
    setAiNewTagName('')
    setAiShowNewCategoriaInput(false)
    setAiNewCategoria({ nombre: '', icono: '💵', color: '#3b82f6' })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Ingresos</h1>
          <p className="text-slate-500">
            <><span className="text-indigo-600 font-medium">{currentWorkspace?.name || (profile?.personal_workspace_name || 'Espacio Personal')}</span> · </>
            {getMonthName(currentMonth)} - {ingresosMes.length} registros
          </p>
        </div>
        <button
          onClick={() => { resetForm(); setEditing(null); setShowModal(true) }}
          className="btn btn-primary"
        >
          <Plus className="w-4 h-4" /> Nuevo Ingreso
        </button>
      </div>

      {/* Totals */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-6">
          <div className="text-sm text-slate-500 mb-1">Total ARS</div>
          <div className="text-2xl font-bold text-emerald-600">{formatMoney(totalARS, 'ARS')}</div>
        </div>
        <div className="card p-6">
          <div className="text-sm text-slate-500 mb-1">Total USD</div>
          <div className="text-2xl font-bold text-emerald-600">{formatMoney(totalUSD, 'USD')}</div>
        </div>
        <div className="card p-6">
          <div className="text-sm text-slate-500 mb-1">Pendiente ARS</div>
          <div className="text-2xl font-bold text-amber-600">{formatMoney(totalPendienteARS, 'ARS')}</div>
        </div>
        <div className="card p-6">
          <div className="text-sm text-slate-500 mb-1">Pendiente USD</div>
          <div className="text-2xl font-bold text-amber-600">{formatMoney(totalPendienteUSD, 'USD')}</div>
        </div>
      </div>

      {/* Filters */}
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
          <select
            className="input w-auto"
            value={filters.categoria}
            onChange={e => setFilters(f => ({ ...f, categoria: e.target.value }))}
          >
            <option value="">Todas las categorías</option>
            {categoriasIngresos.map(c => (
              <option key={c.id} value={c.id}>
                {c.icono} {c.nombre}
              </option>
            ))}
          </select>
          <select
            className="input w-auto"
            value={filters.tag}
            onChange={e => setFilters(f => ({ ...f, tag: e.target.value }))}
          >
            <option value="">Todos los tags</option>
            {tagsIngresos.map(t => (
              <option key={t.id} value={t.id}>
                {t.nombre}
              </option>
            ))}
          </select>
          <select
            className="input w-auto"
            value={filters.cuenta}
            onChange={e => setFilters(f => ({ ...f, cuenta: e.target.value }))}
          >
            <option value="">Todas las cuentas</option>
            {tarjetas.map(t => (
              <option key={t.id} value={t.id}>
                {t.nombre}
              </option>
            ))}
          </select>
          <select
            className="input w-auto"
            value={filters.pendiente}
            onChange={e => setFilters(f => ({ ...f, pendiente: e.target.value }))}
          >
            <option value="">Todos</option>
            <option value="si">Pendientes de cobro</option>
            <option value="no">Confirmados</option>
          </select>
          <select
            className="input w-auto"
            value={filters.sort}
            onChange={e => setFilters(f => ({ ...f, sort: e.target.value }))}
          >
            <option value="monto-desc">Mayor a menor monto</option>
            <option value="monto-asc">Menor a mayor monto</option>
            <option value="fecha-desc">Más recientes</option>
            <option value="fecha-asc">Más antiguos</option>
            <option value="descripcion-asc">A-Z</option>
            <option value="descripcion-desc">Z-A</option>
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

      {/* Ingresos List */}
      <div className="card">
        {/* Acciones masivas */}
        {selectedIngresos.size > 0 && (
          <div className="p-4 bg-indigo-50 border-b border-indigo-200 flex items-center justify-between flex-wrap gap-2">
            <span className="text-sm font-semibold text-indigo-900">
              {selectedIngresos.size} ingreso{selectedIngresos.size !== 1 ? 's' : ''} seleccionado{selectedIngresos.size !== 1 ? 's' : ''}
            </span>
            <div className="flex gap-2 items-center flex-wrap">
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-indigo-900">Cambiar categoría:</label>
                <select
                  onChange={async (e) => {
                    const categoriaId = e.target.value || null
                    const ingresosSeleccionados = ingresosMes.filter(i => selectedIngresos.has(i.id))
                    const promises = ingresosSeleccionados.map(i => 
                      updateIngreso(i.id, { categoria_id: categoriaId })
                    )
                    await Promise.all(promises)
                    setSelectedIngresos(new Set())
                    e.target.value = ''
                  }}
                  className="input text-xs h-8 min-w-[150px]"
                  defaultValue=""
                >
                  <option value="">Seleccionar categoría...</option>
                  <option value="">Sin categoría</option>
                  {categoriasIngresos.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.icono} {c.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={() => setShowDeleteMasivoModal(true)}
                className="btn btn-danger btn-sm"
              >
                <Trash2 className="w-4 h-4" /> Eliminar Seleccionados
              </button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left p-4 font-semibold text-slate-700 w-12">
                  <input
                    type="checkbox"
                    checked={selectedIngresos.size === ingresosMes.length && ingresosMes.length > 0}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedIngresos(new Set(ingresosMes.map(i => i.id)))
                      } else {
                        setSelectedIngresos(new Set())
                      }
                    }}
                    className="w-4 h-4 text-indigo-600 rounded border-slate-300 cursor-pointer"
                  />
                </th>
                <th className="text-left p-4 font-semibold text-slate-700">Descripción</th>
                <th className="text-left p-4 font-semibold text-slate-700">Categoría</th>
                <th className="text-left p-4 font-semibold text-slate-700">Fecha</th>
                <th className="text-right p-4 font-semibold text-slate-700">Monto</th>
                <th className="text-left p-4 font-semibold text-slate-700">Estado</th>
                <th className="text-right p-4 font-semibold text-slate-700">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {ingresosMes.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center p-12">
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
                      <input
                        type="checkbox"
                        checked={selectedIngresos.has(ingreso.id)}
                        onChange={(e) => {
                          const newSelected = new Set(selectedIngresos)
                          if (e.target.checked) {
                            newSelected.add(ingreso.id)
                          } else {
                            newSelected.delete(ingreso.id)
                          }
                          setSelectedIngresos(newSelected)
                        }}
                        className="w-4 h-4 text-indigo-600 rounded border-slate-300 cursor-pointer"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </td>
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
                      {(ingreso as any).comprobante_url && (
                        <div className="mt-1">
                          <span className="text-xs text-slate-500">📎 {(ingreso as any).comprobante_nombre || 'Comprobante'}</span>
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
                      <span className={`font-bold ${(ingreso as any).pendiente_cobro && !(ingreso as any).fecha_cobro_confirmada ? 'text-amber-600' : 'text-emerald-600'}`}>
                        {formatMoney(ingreso.monto, ingreso.moneda)}
                      </span>
                    </td>
                    <td className="p-4">
                      {(ingreso as any).pendiente_cobro && !(ingreso as any).fecha_cobro_confirmada ? (
                        <span className="px-2 py-1 bg-amber-100 text-amber-700 text-xs rounded-full font-semibold">
                          ⏳ Pendiente
                        </span>
                      ) : (ingreso as any).fecha_cobro_confirmada ? (
                        <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-xs rounded-full font-semibold">
                          ✓ Confirmado
                        </span>
                      ) : (
                        <span className="px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded-full">
                          -
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex gap-2 justify-end">
                        {(ingreso as any).pendiente_cobro && !(ingreso as any).fecha_cobro_confirmada && (
                          <button
                            onClick={async () => {
                              await updateIngreso(ingreso.id, {
                                fecha_cobro_confirmada: new Date().toISOString().split('T')[0]
                              })
                            }}
                            className="p-2 hover:bg-emerald-50 rounded-lg transition"
                            title="Confirmar cobro"
                          >
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          </button>
                        )}
                        {(ingreso as any).comprobante_url && (
                          <a
                            href={(ingreso as any).comprobante_url}
                            download={(ingreso as any).comprobante_nombre}
                            className="p-2 hover:bg-slate-100 rounded-lg transition"
                            title="Descargar comprobante"
                          >
                            <Download className="w-4 h-4 text-slate-600" />
                          </a>
                        )}
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
              <div className="flex flex-col gap-2 p-3 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg border-2 border-purple-200">
                <div className="flex items-center gap-2">
                  <ImageIcon className="w-5 h-5 text-purple-600" />
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-purple-900">📸 Leer con IA</div>
                    <p className="text-xs text-purple-700">Sube una imagen o PDF de tu resumen bancario o comprobante</p>
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <label className="btn btn-primary cursor-pointer relative btn-sm">
                    {processingImage ? <Loader2 className="w-4 h-4 animate-spin" /> : (<>📷 Foto / Imagen</>)}
                    <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={processingImage} />
                  </label>
                  <label className="btn btn-secondary cursor-pointer relative btn-sm border-2 border-purple-300 text-purple-700 hover:bg-purple-50">
                    {processingImage ? <Loader2 className="w-4 h-4 animate-spin" /> : (<>📄 PDF / Documento</>)}
                    <input type="file" accept="application/pdf,.pdf" className="hidden" onChange={handleImageUpload} disabled={processingImage} />
                  </label>
                </div>
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
                    <div className="mt-2 p-3 bg-slate-50 rounded-lg space-y-3">
                      <input
                        type="text"
                        className="input"
                        placeholder="Nombre de categoría"
                        value={newCategoria.nombre}
                        onChange={e => setNewCategoria(c => ({ ...c, nombre: e.target.value }))}
                      />
                      <div>
                        <div className="text-xs font-bold text-slate-700 mb-1">Icono</div>
                        <EmojiPickerField
                          value={newCategoria.icono}
                          onChange={v => setNewCategoria(c => ({ ...c, icono: v }))}
                          placeholder="💵"
                          size="sm"
                        />
                      </div>
                      <div className="flex gap-2 items-center">
                        <input
                          type="color"
                          className="w-10 h-10 rounded border border-slate-200 cursor-pointer"
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

              <div>
                <label className="label">Cuenta bancaria / Tarjeta de origen (opcional)</label>
                <select
                  className="input"
                  value={form.cuenta_bancaria_id || ''}
                  onChange={e => setForm(f => ({ ...f, cuenta_bancaria_id: e.target.value || null }))}
                >
                  <option value="">Sin cuenta específica</option>
                  {tarjetas.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div className="border-t border-slate-200 pt-4">
                <div className="flex items-center gap-3 mb-3">
                  <input
                    type="checkbox"
                    id="pendiente_cobro"
                    checked={form.pendiente_cobro}
                    onChange={e => setForm(f => ({ ...f, pendiente_cobro: e.target.checked }))}
                    className="w-5 h-5 text-amber-600 rounded border-slate-300"
                  />
                  <label htmlFor="pendiente_cobro" className="font-semibold text-slate-700 cursor-pointer">
                    ⏳ Pendiente de cobro
                  </label>
                </div>
                {form.pendiente_cobro && (
                  <div className="ml-8 space-y-2">
                    <div>
                      <label className="label text-sm">Fecha esperada de cobro (opcional)</label>
                      <input
                        type="date"
                        className="input"
                        value={form.fecha_cobro_esperada || ''}
                        onChange={e => setForm(f => ({ ...f, fecha_cobro_esperada: e.target.value || null }))}
                      />
                    </div>
                    <p className="text-xs text-slate-500">
                      El ingreso no se incluirá en los totales hasta que se confirme el cobro.
                    </p>
                    {form.fecha_cobro_esperada && (
                      <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                        <p className="text-xs text-blue-800">
                          <strong>📅 Notificación:</strong> Se te avisará el día {new Date(form.fecha_cobro_esperada).toLocaleDateString('es-AR', { 
                            day: 'numeric', 
                            month: 'long', 
                            year: 'numeric' 
                          })} para recordarte confirmar el cobro.
                        </p>
                      </div>
                    )}
                    <div className="space-y-2 mt-3">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="notificar_celular"
                          checked={form.notificar_celular !== undefined ? form.notificar_celular : true}
                          onChange={e => setForm(f => ({ ...f, notificar_celular: e.target.checked }))}
                          className="w-4 h-4 text-indigo-600 rounded border-slate-300"
                        />
                        <label htmlFor="notificar_celular" className="text-sm text-slate-700 cursor-pointer">
                          📱 Notificar por celular (push)
                        </label>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="notificar_correo"
                          checked={form.notificar_correo !== undefined ? form.notificar_correo : true}
                          onChange={e => setForm(f => ({ ...f, notificar_correo: e.target.checked }))}
                          className="w-4 h-4 text-indigo-600 rounded border-slate-300"
                        />
                        <label htmlFor="notificar_correo" className="text-sm text-slate-700 cursor-pointer">
                          📧 Notificar por correo
                        </label>
                      </div>
                    </div>
                    {editing && (editing as any).pendiente_cobro && !(editing as any).fecha_cobro_confirmada && (
                      <button
                        onClick={async () => {
                          await updateIngreso(editing.id, {
                            fecha_cobro_confirmada: new Date().toISOString().split('T')[0]
                          })
                          setShowModal(false)
                          setEditing(null)
                          resetForm()
                        }}
                        className="btn btn-success btn-sm w-full mt-2"
                      >
                        ✓ Confirmar cobro ahora
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="label">Comprobante (opcional)</label>
                {editing && (editing as any).comprobante_url && !form.comprobante && (
                  <div className="mb-2 p-2 bg-slate-50 rounded-lg flex items-center justify-between">
                    <span className="text-sm text-slate-600">
                      📎 {(editing as any).comprobante_nombre || 'Comprobante guardado'}
                    </span>
                    <a
                      href={(editing as any).comprobante_url}
                      download={(editing as any).comprobante_nombre}
                      className="text-xs text-indigo-600 hover:underline"
                    >
                      Descargar
                    </a>
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*,.pdf"
                  className="input"
                  onChange={e => setForm(f => ({ ...f, comprobante: e.target.files?.[0] || null }))}
                />
                {form.comprobante && (
                  <p className="text-xs text-slate-500 mt-1">
                    ✓ {form.comprobante.name}
                    {editing && (editing as any).comprobante_url && ' (reemplazará el actual)'}
                  </p>
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
        <div className="modal-overlay" onClick={() => { setShowImagePreview(false); setExtractedData(null); setPreviewImage(null); setSelectedTransactions(new Set()); setIncludeTotal(false); setEditedTransactions(new Map()); setAiExpandedTransaction(null); setAiShowNewTagInput(false); setAiNewTagName(''); setAiShowNewCategoriaInput(false); setAiNewCategoria({ nombre: '', icono: '💵', color: '#3b82f6' }) }}>
          <div className="modal max-w-4xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-purple-600" />
                {extractedData.transacciones ? `Confirmar Transacciones (${extractedData.transacciones.length} encontradas)` : 'Confirmar Datos Extraídos'}
              </h3>
              <button 
                onClick={() => { setShowImagePreview(false); setExtractedData(null); setPreviewImage(null); setSelectedTransactions(new Set()); setIncludeTotal(false); setEditedTransactions(new Map()); setAiExpandedTransaction(null); setAiShowNewTagInput(false); setAiNewTagName(''); setAiShowNewCategoriaInput(false); setAiNewCategoria({ nombre: '', icono: '💵', color: '#3b82f6' }) }} 
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

                  {/* Selector de Fecha/Mes General */}
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                    <div className="flex items-center gap-3 flex-wrap">
                      <label className="text-sm font-semibold text-slate-700">
                        📅 Mes para cargar los ingresos:
                      </label>
                      <input
                        type="month"
                        className="input"
                        value={globalDocumentDate ? globalDocumentDate.slice(0, 7) : new Date().toISOString().slice(0, 7)}
                        onChange={e => {
                          const monthValue = e.target.value
                          if (monthValue) {
                            // Usar el primer día del mes seleccionado (no el último del mes anterior)
                            const fechaSeleccionada = `${monthValue}-01`
                            setGlobalDocumentDate(fechaSeleccionada)
                            setUseGlobalDate(true)
                            console.log('🔵 [Ingresos] Mes seleccionado:', monthValue, '→ Fecha:', fechaSeleccionada)
                          }
                        }}
                      />
                      {globalDocumentDate && (
                        <div className="text-xs text-slate-600">
                          Se cargarán en: <strong>{new Date(globalDocumentDate).toLocaleDateString('es-AR', { 
                            day: 'numeric', 
                            month: 'long', 
                            year: 'numeric' 
                          })}</strong>
                        </div>
                      )}
                      <button
                        onClick={() => setUseGlobalDate(!useGlobalDate)}
                        className={`text-xs px-2 py-1 rounded ${
                          useGlobalDate 
                            ? 'bg-indigo-100 text-indigo-700' 
                            : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {useGlobalDate ? '✓ Usar fecha global' : 'Usar fechas individuales'}
                      </button>
                    </div>
                    {useGlobalDate && globalDocumentDate && (
                      <p className="text-xs text-slate-500 mt-2">
                        Todos los ingresos seleccionados se cargarán en <strong>{new Date(globalDocumentDate).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}</strong>.
                      </p>
                    )}
                  </div>

                  {/* Selección de cuenta/tarjeta si fue detectada */}
                  {detectedCuenta && (
                    <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3">
                      <div className="text-sm font-semibold text-indigo-900 mb-2">
                        💳 Cuenta/Tarjeta detectada: {buildDetectedCuentaName(detectedCuenta)}
                      </div>
                      <div className="space-y-2">
                        <select
                          className="input w-full"
                          value={selectedCuentaId}
                          onChange={e => setSelectedCuentaId(e.target.value)}
                        >
                          <option value="">No asignar cuenta</option>
                          {tarjetas.map(t => (
                            <option key={t.id} value={t.id}>
                              {t.nombre}
                            </option>
                          ))}
                          <option value="__new__">➕ Crear nueva cuenta/tarjeta</option>
                        </select>
                        {selectedCuentaId === '__new__' && (
                          <div className="p-3 bg-white rounded-lg border border-indigo-200 space-y-2">
                            <input
                              type="text"
                              className="input"
                              placeholder="Nombre de la cuenta/tarjeta"
                              value={aiNewCuenta.nombre}
                              onChange={e => setAiNewCuenta(c => ({ ...c, nombre: e.target.value }))}
                            />
                            <div className="grid grid-cols-2 gap-2">
                              <select
                                className="input"
                                value={aiNewCuenta.tipo}
                                onChange={e => setAiNewCuenta(c => ({ ...c, tipo: e.target.value as any }))}
                              >
                                <option value="visa">Visa</option>
                                <option value="mastercard">Mastercard</option>
                                <option value="amex">Amex</option>
                                <option value="other">Otra</option>
                              </select>
                              <input
                                type="text"
                                className="input"
                                placeholder="Banco"
                                value={aiNewCuenta.banco}
                                onChange={e => setAiNewCuenta(c => ({ ...c, banco: e.target.value }))}
                              />
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={handleAddNewCuentaAI}
                                className="btn btn-primary btn-sm"
                              >
                                Crear
                              </button>
                              <button
                                onClick={() => setSelectedCuentaId('')}
                                className="btn btn-secondary btn-sm"
                              >
                                Cancelar
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Crear categorías / tags desde el preview */}
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-3">
                    <div className="text-xs font-semibold text-slate-700">🏷️ Categorías y etiquetas</div>
                    {!aiShowNewCategoriaInput ? (
                      <button
                        type="button"
                        onClick={() => setAiShowNewCategoriaInput(true)}
                        className="w-full px-3 py-2 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold hover:bg-indigo-100 transition"
                      >
                        + Crear nueva categoría
                      </button>
                    ) : (
                      <div className="space-y-2 p-3 bg-white rounded-lg border border-indigo-200">
                        <input
                          type="text"
                          className="input w-full text-xs h-8"
                          placeholder="Nombre de categoría"
                          value={aiNewCategoria.nombre}
                          onChange={e => setAiNewCategoria(c => ({ ...c, nombre: e.target.value }))}
                        />
                        <div>
                          <div className="text-[10px] font-bold text-slate-600 mb-1">Icono</div>
                          <EmojiPickerField
                            value={aiNewCategoria.icono}
                            onChange={v => setAiNewCategoria(c => ({ ...c, icono: v }))}
                            placeholder="💵"
                            size="sm"
                          />
                        </div>
                        <div className="flex gap-2 items-center">
                          <input
                            type="color"
                            className="w-10 h-10 rounded border border-slate-200 cursor-pointer"
                            value={aiNewCategoria.color}
                            onChange={e => setAiNewCategoria(c => ({ ...c, color: e.target.value }))}
                          />
                          <button
                            type="button"
                            onClick={handleAddNewCategoriaAI}
                            className="btn btn-primary btn-sm"
                          >
                            Crear
                          </button>
                          <button
                            type="button"
                            onClick={() => { setAiShowNewCategoriaInput(false); setAiNewCategoria({ nombre: '', icono: '💵', color: '#3b82f6' }) }}
                            className="btn btn-secondary btn-sm"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    )}

                    {!aiShowNewTagInput ? (
                      <button
                        type="button"
                        onClick={() => setAiShowNewTagInput(true)}
                        className="w-full px-3 py-2 bg-orange-50 text-orange-700 border border-orange-200 rounded-lg text-xs font-bold hover:bg-orange-100 transition"
                      >
                        + Crear nueva etiqueta
                      </button>
                    ) : (
                      <div className="flex gap-2 p-3 bg-white rounded-lg border border-orange-200">
                        <input
                          type="text"
                          className="input flex-1 text-xs h-8"
                          placeholder="Nombre de etiqueta"
                          value={aiNewTagName}
                          onChange={e => setAiNewTagName(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleAddNewTagAI()}
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={handleAddNewTagAI}
                          className="px-3 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition"
                        >
                          ✓
                        </button>
                        <button
                          type="button"
                          onClick={() => { setAiShowNewTagInput(false); setAiNewTagName('') }}
                          className="px-3 py-2 bg-slate-200 text-slate-700 rounded-lg text-xs font-bold hover:bg-slate-300 transition"
                        >
                          ✕
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Lista de Transacciones - Tabla como en ingresos normales */}
                  <div className="card overflow-hidden">
                    <div className="p-3 bg-slate-50 border-b border-slate-200">
                      <h4 className="font-semibold text-sm">
                        Transacciones ({extractedData.transacciones.length})
                      </h4>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="bg-slate-50">
                            <th className="text-left p-3 text-xs font-bold text-slate-500 uppercase w-12">
                              <input
                                type="checkbox"
                                checked={selectedTransactions.size === extractedData.transacciones.length && extractedData.transacciones.length > 0}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    const all = new Set<number>(extractedData.transacciones.map((_: any, i: number) => i))
                                    setSelectedTransactions(all)
                                  } else {
                                    setSelectedTransactions(new Set())
                                  }
                                }}
                                className="w-4 h-4 text-purple-600 rounded border-slate-300 cursor-pointer"
                              />
                            </th>
                            <th className="text-left p-3 text-xs font-bold text-slate-500 uppercase">Descripción</th>
                            <th className="text-left p-3 text-xs font-bold text-slate-500 uppercase">Categoría</th>
                            <th className="text-left p-3 text-xs font-bold text-slate-500 uppercase">Monto</th>
                            <th className="text-left p-3 text-xs font-bold text-slate-500 uppercase"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {extractedData.transacciones.map((trans: any, index: number) => {
                            const edited = editedTransactions.get(index)
                            const descripcion = edited?.descripcion ?? trans.descripcion ?? ''
                            const monto = edited?.monto ?? trans.monto ?? 0
                            const fecha = edited?.fecha ?? trans.fecha ?? ''
                            const moneda = edited?.moneda ?? trans.moneda ?? 'ARS'
                            const categoriaId = edited?.categoria_id ?? findCategoriaIdFromLabel(trans.categoria) ?? ''
                            const tagIds = edited?.tag_ids ?? getTransactionTagIds(index)
                            
                            const categoria = categoriasIngresos.find(c => c.id === categoriaId)
                            
                            return (
                              <tr 
                                key={index}
                                className={`border-b border-slate-100 hover:bg-slate-50 transition ${
                                  selectedTransactions.has(index) ? 'bg-purple-50' : ''
                                }`}
                              >
                                <td className="p-3">
                                  <input
                                    type="checkbox"
                                    checked={selectedTransactions.has(index)}
                                    onChange={(e) => {
                                      const newSelected = new Set(selectedTransactions)
                                      if (e.target.checked) {
                                        newSelected.add(index)
                                      } else {
                                        newSelected.delete(index)
                                      }
                                      setSelectedTransactions(newSelected)
                                    }}
                                    className="w-4 h-4 text-purple-600 rounded border-slate-300 cursor-pointer"
                                  />
                                </td>
                                <td className="p-3">
                                  <div className="font-medium">{descripcion || 'Sin descripción'}</div>
                                  {trans.origen && (
                                    <div className="text-xs text-blue-600 mt-1">📍 {trans.origen}</div>
                                  )}
                                  {tagIds.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-1">
                                      {tagIds.map((tagId: string) => {
                                        const tag = tagsIngresos.find(t => t.id === tagId)
                                        return tag ? (
                                          <span key={tagId} className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full text-xs">
                                            {tag.nombre}
                                          </span>
                                        ) : null
                                      })}
                                    </div>
                                  )}
                                </td>
                                <td className="p-3">
                                  {categoria ? (
                                    <span className="inline-flex items-center gap-1">
                                      <span>{categoria.icono}</span>
                                      <span>{categoria.nombre}</span>
                                    </span>
                                  ) : trans.categoria ? (
                                    <span className="text-xs text-slate-500">Sugerida: {trans.categoria}</span>
                                  ) : (
                                    <span className="text-xs text-slate-400">Sin categoría</span>
                                  )}
                                </td>
                                <td className="p-3">
                                  <div className="flex items-center gap-1 justify-start">
                                    <span className={`font-bold text-lg ${moneda === 'USD' ? 'text-emerald-600' : 'text-emerald-600'}`}>
                                      {formatMoney(monto, moneda)}
                                    </span>
                                  </div>
                                  <div className="text-xs text-slate-500 mt-1">
                                    {fecha ? new Date(fecha).toLocaleDateString('es-AR') : '-'}
                                  </div>
                                </td>
                                <td className="p-3">
                                  <button
                                    onClick={() => {
                                      const edited = editedTransactions.get(index) || {}
                                      setAiTransactionForm({
                                        descripcion: edited.descripcion ?? trans.descripcion ?? '',
                                        categoria_id: edited.categoria_id ?? findCategoriaIdFromLabel(trans.categoria) ?? '',
                                        monto: edited.monto !== undefined ? String(edited.monto) : String(trans.monto ?? ''),
                                        moneda: edited.moneda ?? trans.moneda ?? 'ARS',
                                        fecha: edited.fecha ?? trans.fecha ?? new Date().toISOString().split('T')[0],
                                        tag_ids: edited.tag_ids ?? getTransactionTagIds(index),
                                        pendiente_cobro: edited.pendiente_cobro ?? false,
                                        fecha_cobro_esperada: edited.fecha_cobro_esperada ?? null,
                                        cuenta_bancaria_id: edited.cuenta_bancaria_id ?? (selectedCuentaId || null),
                                        notificar_celular: edited.notificar_celular !== undefined ? edited.notificar_celular : true,
                                        notificar_correo: edited.notificar_correo !== undefined ? edited.notificar_correo : true
                                      })
                                      setEditingAiTransaction(index)
                                    }}
                                    className="p-2 hover:bg-slate-100 rounded-lg transition"
                                    title="Editar"
                                  >
                                    <Edit2 className="w-4 h-4 text-slate-600" />
                                  </button>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
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
                  disabled={(extractedData.transacciones && selectedTransactions.size === 0 && !includeTotal) || savingTransactions}
                >
                  {savingTransactions ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Guardando...
                    </>
                  ) : (
                    <>✓ {extractedData.transacciones ? `Agregar ${selectedTransactions.size} transacción${selectedTransactions.size !== 1 ? 'es' : ''}` : 'Usar estos datos'}</>
                  )}
                </button>
                <button
                  onClick={() => { 
                    setShowImagePreview(false)
                    setExtractedData(null)
                    setPreviewImage(null)
                    setSelectedTransactions(new Set())
                    setIncludeTotal(false)
                    setEditedTransactions(new Map())
                    setGlobalDocumentDate(null)
                    setUseGlobalDate(false)
                    setDetectedCuenta(null)
                    setSelectedCuentaId('')
                  }}
                  className="btn btn-secondary"
                  disabled={savingTransactions}
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Editar Transacción del Preview IA */}
      {editingAiTransaction !== null && extractedData?.transacciones && (
        <div className="modal-overlay" onClick={() => { setEditingAiTransaction(null); setAiTransactionForm({ descripcion: '', categoria_id: '', monto: '', moneda: 'ARS', fecha: new Date().toISOString().split('T')[0], tag_ids: [], pendiente_cobro: false, fecha_cobro_esperada: null, cuenta_bancaria_id: null, notificar_celular: true, notificar_correo: true }) }}>
          <div className="modal max-w-2xl" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-lg">Editar Transacción</h3>
              <button onClick={() => { setEditingAiTransaction(null); setAiTransactionForm({ descripcion: '', categoria_id: '', monto: '', moneda: 'ARS', fecha: new Date().toISOString().split('T')[0], tag_ids: [], pendiente_cobro: false, fecha_cobro_esperada: null, cuenta_bancaria_id: null, notificar_celular: true, notificar_correo: true }) }} className="p-1 hover:bg-slate-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto">
              <div>
                <label className="label">Descripción <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  className="input"
                  value={aiTransactionForm.descripcion}
                  onChange={e => setAiTransactionForm(f => ({ ...f, descripcion: e.target.value }))}
                  placeholder="Ej: Salario, Freelance, Venta..."
                />
              </div>

              <div>
                <label className="label">Categoría</label>
                {!aiShowNewCategoriaInput ? (
                  <div className="space-y-2">
                    <select
                      className="input w-full"
                      value={aiTransactionForm.categoria_id}
                      onChange={e => setAiTransactionForm(f => ({ ...f, categoria_id: e.target.value }))}
                    >
                      <option value="">Sin categoría</option>
                      {categoriasIngresos.map(c => <option key={c.id} value={c.id}>{c.icono} {c.nombre}</option>)}
                    </select>
                    <button
                      type="button"
                      onClick={() => setAiShowNewCategoriaInput(true)}
                      className="w-full px-3 py-2 bg-indigo-50 text-indigo-700 border-2 border-indigo-200 rounded-lg text-sm font-bold hover:bg-indigo-100 transition"
                    >
                      + Crear nueva categoría
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3 p-4 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl border-2 border-indigo-300 shadow-sm">
                    <div className="text-sm font-bold text-indigo-900">✨ Nueva Categoría</div>
                    <div>
                      <input
                        type="text"
                        className="input w-full text-base"
                        placeholder="Ej: Salario, Freelance, Venta..."
                        value={aiNewCategoria.nombre}
                        onChange={e => setAiNewCategoria(c => ({ ...c, nombre: e.target.value }))}
                        autoFocus
                      />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-indigo-900 mb-1.5">Icono</div>
                      <EmojiPickerField
                        value={aiNewCategoria.icono}
                        onChange={v => setAiNewCategoria(c => ({ ...c, icono: v }))}
                        placeholder="💵"
                        size="sm"
                      />
                    </div>
                    <div className="flex gap-2 items-center">
                      <div>
                        <div className="text-xs font-bold text-indigo-900 mb-1">Color</div>
                        <input
                          type="color"
                          className="w-10 h-10 rounded border border-slate-200 cursor-pointer"
                          value={aiNewCategoria.color}
                          onChange={e => setAiNewCategoria(c => ({ ...c, color: e.target.value }))}
                        />
                      </div>
                      <div className="flex-1 flex gap-2">
                        <button
                          type="button"
                          onClick={handleAddNewCategoriaAI}
                          className="flex-1 px-4 py-2.5 bg-emerald-500 text-white rounded-lg text-sm font-bold hover:bg-emerald-600 transition shadow-sm"
                        >
                          ✓ Crear
                        </button>
                        <button
                          type="button"
                          onClick={() => { setAiShowNewCategoriaInput(false); setAiNewCategoria({ nombre: '', icono: '💵', color: '#3b82f6' }) }}
                          className="flex-1 px-4 py-2.5 bg-white border-2 border-slate-300 text-slate-700 rounded-lg text-sm font-bold hover:bg-slate-50 transition"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Monto <span className="text-red-500">*</span></label>
                  <input
                    type="number"
                    step="0.01"
                    className="input"
                    value={aiTransactionForm.monto}
                    onChange={e => setAiTransactionForm(f => ({ ...f, monto: e.target.value }))}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="label">Moneda</label>
                  <select
                    className="input"
                    value={aiTransactionForm.moneda}
                    onChange={e => setAiTransactionForm(f => ({ ...f, moneda: e.target.value as 'ARS' | 'USD' }))}
                  >
                    <option value="ARS">💵 Pesos (ARS)</option>
                    <option value="USD">💵 Dólares (USD)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="label">Fecha</label>
                <input
                  type="date"
                  className="input"
                  value={aiTransactionForm.fecha}
                  onChange={e => setAiTransactionForm(f => ({ ...f, fecha: e.target.value }))}
                />
              </div>

              <div>
                <label className="label">Etiquetas</label>
                <div className="flex flex-wrap gap-2 p-3 bg-slate-50 rounded-xl border-2 border-slate-200 min-h-[3rem]">
                  {tagsIngresos.map(t => {
                    const isSelected = aiTransactionForm.tag_ids.includes(t.id)
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            setAiTransactionForm(f => ({ ...f, tag_ids: f.tag_ids.filter(id => id !== t.id) }))
                          } else {
                            setAiTransactionForm(f => ({ ...f, tag_ids: [...f.tag_ids, t.id] }))
                          }
                        }}
                        className={`px-3 py-1.5 rounded-lg text-sm font-bold transition ${
                          isSelected
                            ? 'bg-indigo-100 text-indigo-700 border-2 border-indigo-500'
                            : 'bg-white text-slate-600 border-2 border-transparent hover:border-slate-300'
                        }`}
                      >
                        {t.nombre}
                      </button>
                    )
                  })}
                  {!aiShowNewTagInput && (
                    <button
                      type="button"
                      onClick={() => setAiShowNewTagInput(true)}
                      className="px-3 py-1.5 rounded-lg text-sm bg-slate-100 text-slate-600 hover:bg-slate-200 transition"
                    >
                      + Nueva etiqueta
                    </button>
                  )}
                  {aiShowNewTagInput && (
                    <div className="flex gap-1 items-center">
                      <input
                        type="text"
                        className="input py-1 px-2 text-xs w-32"
                        placeholder="Nombre"
                        value={aiNewTagName}
                        onChange={e => setAiNewTagName(e.target.value)}
                        onKeyPress={e => e.key === 'Enter' && handleAddNewTagAI()}
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={handleAddNewTagAI}
                        className="px-2 py-1 bg-emerald-500 text-white rounded text-xs font-bold hover:bg-emerald-600"
                      >
                        ✓
                      </button>
                      <button
                        type="button"
                        onClick={() => { setAiShowNewTagInput(false); setAiNewTagName('') }}
                        className="px-2 py-1 bg-slate-300 text-slate-700 rounded text-xs font-bold hover:bg-slate-400"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="border-t border-slate-200 pt-4">
                <div className="flex items-center gap-3 mb-3">
                  <input
                    type="checkbox"
                    id="ai_pendiente_cobro"
                    checked={aiTransactionForm.pendiente_cobro}
                    onChange={e => setAiTransactionForm(f => ({ ...f, pendiente_cobro: e.target.checked }))}
                    className="w-5 h-5 text-amber-600 rounded border-slate-300"
                  />
                  <label htmlFor="ai_pendiente_cobro" className="font-semibold text-slate-700 cursor-pointer">
                    ⏳ Pendiente de cobro
                  </label>
                </div>
                {aiTransactionForm.pendiente_cobro && (
                  <div className="ml-8 space-y-3">
                    <div>
                      <label className="label text-sm">Fecha esperada de cobro (opcional)</label>
                      <input
                        type="date"
                        className="input"
                        value={aiTransactionForm.fecha_cobro_esperada || ''}
                        onChange={e => setAiTransactionForm(f => ({ ...f, fecha_cobro_esperada: e.target.value || null }))}
                      />
                    </div>
                    <p className="text-xs text-slate-500">
                      El ingreso no se incluirá en los totales hasta que se confirme el cobro.
                    </p>
                    {aiTransactionForm.fecha_cobro_esperada && (
                      <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                        <p className="text-xs text-blue-800">
                          <strong>📅 Notificación:</strong> Se te avisará el día {new Date(aiTransactionForm.fecha_cobro_esperada).toLocaleDateString('es-AR', { 
                            day: 'numeric', 
                            month: 'long', 
                            year: 'numeric' 
                          })} para recordarte confirmar el cobro.
                        </p>
                      </div>
                    )}
                    <div className="space-y-2 mt-3">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="ai_notificar_celular"
                          checked={aiTransactionForm.notificar_celular}
                          onChange={e => setAiTransactionForm(f => ({ ...f, notificar_celular: e.target.checked }))}
                          className="w-4 h-4 text-indigo-600 rounded border-slate-300"
                        />
                        <label htmlFor="ai_notificar_celular" className="text-sm text-slate-700 cursor-pointer">
                          📱 Notificar por celular (push)
                        </label>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="ai_notificar_correo"
                          checked={aiTransactionForm.notificar_correo}
                          onChange={e => setAiTransactionForm(f => ({ ...f, notificar_correo: e.target.checked }))}
                          className="w-4 h-4 text-indigo-600 rounded border-slate-300"
                        />
                        <label htmlFor="ai_notificar_correo" className="text-sm text-slate-700 cursor-pointer">
                          📧 Notificar por correo
                        </label>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-2 border-t border-slate-200">
                <button
                  onClick={() => {
                    const index = editingAiTransaction
                    if (index === null) return
                    
                    const updated = new Map(editedTransactions)
                    updated.set(index, {
                      descripcion: aiTransactionForm.descripcion,
                      categoria_id: aiTransactionForm.categoria_id || undefined,
                      monto: parseFloat(aiTransactionForm.monto) || 0,
                      moneda: aiTransactionForm.moneda,
                      fecha: aiTransactionForm.fecha,
                      tag_ids: aiTransactionForm.tag_ids,
                      pendiente_cobro: aiTransactionForm.pendiente_cobro,
                      fecha_cobro_esperada: aiTransactionForm.fecha_cobro_esperada || undefined,
                      cuenta_bancaria_id: aiTransactionForm.cuenta_bancaria_id || undefined,
                      notificar_celular: aiTransactionForm.notificar_celular,
                      notificar_correo: aiTransactionForm.notificar_correo
                    })
                    setEditedTransactions(updated)
                    setEditingAiTransaction(null)
                    setAiTransactionForm({ descripcion: '', categoria_id: '', monto: '', moneda: 'ARS', fecha: new Date().toISOString().split('T')[0], tag_ids: [], pendiente_cobro: false, fecha_cobro_esperada: null, cuenta_bancaria_id: null, notificar_celular: true, notificar_correo: true })
                  }}
                  className="btn btn-primary flex-1"
                >
                  Guardar Cambios
                </button>
                <button
                  onClick={() => { setEditingAiTransaction(null); setAiTransactionForm({ descripcion: '', categoria_id: '', monto: '', moneda: 'ARS', fecha: new Date().toISOString().split('T')[0], tag_ids: [], pendiente_cobro: false, fecha_cobro_esperada: null, cuenta_bancaria_id: null, notificar_celular: true, notificar_correo: true }) }}
                  className="btn btn-secondary"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmación Eliminación Masiva */}
      <ConfirmModal
        isOpen={showDeleteMasivoModal}
        onClose={() => setShowDeleteMasivoModal(false)}
        onConfirm={async () => {
          const promises = Array.from(selectedIngresos).map(id => deleteIngreso(id))
          await Promise.all(promises)
          setSelectedIngresos(new Set())
          setShowDeleteMasivoModal(false)
        }}
        title="Eliminar Ingresos Seleccionados"
        message={`¿Estás seguro de que deseas eliminar ${selectedIngresos.size} ingreso${selectedIngresos.size !== 1 ? 's' : ''}?\n\nEsta acción no se puede deshacer.`}
        confirmText="Eliminar"
        cancelText="Cancelar"
        variant="danger"
      />
    </div>
  )
}
