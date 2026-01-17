'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { useData } from '@/hooks/useData'
import { useWorkspace } from '@/hooks/useWorkspace' // Importamos para identificar al usuario
import { useAuth } from '@/hooks/useAuth' // Importamos para saber "quién soy yo"
import { formatMoney, getMonthName, getTagClass } from '@/lib/utils'
import { Plus, Search, Edit2, Trash2, Pin, X, Download, Upload, Image as ImageIcon, Loader2 } from 'lucide-react'
import { Gasto } from '@/types'

export default function GastosPage() {
  console.log('🔵🔵🔵 [GastosPage] COMPONENT RENDER')

  const searchParams = useSearchParams()
  const { user } = useAuth()
  const { currentWorkspace, members } = useWorkspace() // Traemos info del workspace
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
  const [filters, setFilters] = useState({ search: '', tarjeta: '', moneda: '', tag: '', colaborador: '', sort: 'monto-desc' })
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

  // AI Image processing states
  const [processingImage, setProcessingImage] = useState(false)
  const [showImagePreview, setShowImagePreview] = useState(false)
  const [extractedData, setExtractedData] = useState<any>(null)
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [selectedTransactions, setSelectedTransactions] = useState<Set<number>>(new Set())
  const [includeTotal, setIncludeTotal] = useState(false)
  const [selectedTarjetaId, setSelectedTarjetaId] = useState<string>('')
  const [detectedTarjeta, setDetectedTarjeta] = useState<any>(null)
  const [selectedImpuestos, setSelectedImpuestos] = useState<Set<number>>(new Set())
  const [savingTransactions, setSavingTransactions] = useState(false)
  const [progressPercent, setProgressPercent] = useState(0)
  const [processingComplete, setProcessingComplete] = useState(false)
  // Estado para transacciones editadas (permite modificar fecha, descripción y monto antes de confirmar)
  const [editedTransactions, setEditedTransactions] = useState<Map<number, any>>(new Map())
  const [editedImpuestos, setEditedImpuestos] = useState<Map<number, any>>(new Map())
  // Estado para fecha/mes general del documento (aplica a todas las transacciones)
  const [globalDocumentDate, setGlobalDocumentDate] = useState<string | null>(null)
  const [useGlobalDate, setUseGlobalDate] = useState(false)

  // Función para obtener el nombre del usuario que creó el gasto
  const getUserLabel = (userId: string) => {
    if (!currentWorkspace) return null; // No mostrar en modo personal
    if (userId === user?.uid) return 'Tú'; // Si soy yo
    if (userId === currentWorkspace.owner_id) return 'Propietario';
    
    const member = members.find(m => m.user_id === userId && m.workspace_id === currentWorkspace.id);
    // Usar display_name si existe, sino usar email (antes del @) o "Desconocido"
    return member ? (member.display_name || member.user_email.split('@')[0]) : 'Desconocido';
  }

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
  if (filters.colaborador && currentWorkspace) {
    gastosMes = gastosMes.filter(g => {
      // Filtrar por user_id o created_by si existe
      const userId = (g as any).created_by || g.user_id
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
        const { error } = await addMedioPago(medioPagoFinal)
        if (error) {
          console.error('Error al guardar medio de pago:', error)
          // Continuar de todas formas para que se guarde en el gasto
          console.log('⚠️ Medio de pago no se guardó en la lista global, pero se usará para este gasto')
        }
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

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validar que sea una imagen o PDF
    const isValidFile = file.type.startsWith('image/') || file.type === 'application/pdf'
    if (!isValidFile) {
      setGastoError('Por favor, selecciona una imagen o PDF válido')
      return
    }

    setProcessingImage(true)
    setProgressPercent(0)
    setProcessingComplete(false)

    let progressInterval: NodeJS.Timeout | null = null

    try {
      // Convertir a base64
      const reader = new FileReader()
      
      // Función para incrementar progreso gradualmente
      const incrementProgress = () => {
        setProgressPercent(prev => {
          if (prev >= 99) return 99 // No llegar a 100% hasta que termine
          // Incremento más gradual y controlado
          const increment = Math.min(3 + Math.random() * 4, 99 - prev) // Entre 3 y 7, máximo hasta 99%
          return Math.min(prev + increment, 99)
        })
      }
      
      // Simular progreso gradual durante la lectura (más lento)
      progressInterval = setInterval(incrementProgress, 400)
      
      reader.onloadend = async () => {
        // Detener el progreso automático, ahora lo controlamos manualmente
        if (progressInterval) clearInterval(progressInterval)
        progressInterval = null
        
        const base64 = reader.result as string
        setPreviewImage(base64)
        
        // Iniciar progreso desde 1% y avanzar suavemente
        setProgressPercent(1)
        
        // Función para incrementar progreso suavemente de 1% a 99%
        const smoothProgress = (targetPercent: number, duration: number) => {
          return new Promise<void>((resolve) => {
            const startPercent = progressPercent
            const startTime = Date.now()
            
            const updateProgress = () => {
              const elapsed = Date.now() - startTime
              const progress = Math.min(elapsed / duration, 1)
              const current = Math.floor(startPercent + (targetPercent - startPercent) * progress)
              
              if (current < targetPercent) {
                setProgressPercent(Math.min(current, 99))
                requestAnimationFrame(updateProgress)
              } else {
                setProgressPercent(Math.min(targetPercent, 99))
                resolve()
              }
            }
            
            updateProgress()
          })
        }

        try {
          // Avanzar a 20% mientras se prepara la petición
          await smoothProgress(20, 500)
          
          // Llamar a la API
          const response = await fetch('/api/process-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              imageBase64: base64,
              type: 'gasto',
              mimeType: file.type
            })
          })

          // Avanzar a 50% mientras se espera la respuesta
          await smoothProgress(50, 1000)

          const result = await response.json()

          // Avanzar a 80% mientras se procesa el resultado
          await smoothProgress(80, 500)

          if (!response.ok || !result.success) {
            const errorMessage = result.error || 'Error al procesar el archivo'
            const errorDetails = result.details ? `\n\nDetalles: ${result.details}` : ''
            throw new Error(`${errorMessage}${errorDetails}`)
          }

          setExtractedData(result.data)
          
          // Detectar fecha general del documento (usar la primera fecha encontrada o fecha actual)
          if (result.data.transacciones && result.data.transacciones.length > 0) {
            const firstDate = result.data.transacciones[0]?.fecha
            if (firstDate) {
              setGlobalDocumentDate(firstDate)
              setUseGlobalDate(true)
            } else {
              setGlobalDocumentDate(new Date().toISOString().split('T')[0])
              setUseGlobalDate(false)
            }
          }
          
          // Si hay información de tarjeta detectada, configurarla
          if (result.data.tarjeta) {
            setDetectedTarjeta(result.data.tarjeta)
            
            // Intentar encontrar una tarjeta existente que coincida
            const bancoMatch = result.data.tarjeta.banco ? 
              tarjetas.find(t => t.banco && t.banco.toLowerCase().includes(result.data.tarjeta.banco.toLowerCase())) : null
            
            if (bancoMatch) {
              setSelectedTarjetaId(bancoMatch.id)
            } else {
              // Si no hay match, usar la tarjeta del formulario si existe, sino dejar vacío
              setSelectedTarjetaId(gastoForm.tarjeta_id || '')
            }
          } else {
            setDetectedTarjeta(null)
            setSelectedTarjetaId(gastoForm.tarjeta_id || '')
          }
          
          // Avanzar a 99% y esperar un momento
          await smoothProgress(99, 300)
          await new Promise(resolve => setTimeout(resolve, 200))
          
          // Completar suavemente
          setProgressPercent(100)
          setProcessingComplete(true)
          
          // Esperar un momento para mostrar el 100% antes de mostrar resultados
          setTimeout(() => {
            setShowImagePreview(true)
            setProcessingImage(false)
            setProgressPercent(0)
            setProcessingComplete(false)
            // Limpiar ediciones anteriores cuando se procesa una nueva imagen
            setEditedTransactions(new Map())
            setEditedImpuestos(new Map())
            setGlobalDocumentDate(null)
            setUseGlobalDate(false)
          }, 400)
        } catch (apiError: any) {
          if (progressInterval) clearInterval(progressInterval)
          setProcessingImage(false)
          setProgressPercent(0)
          setProcessingComplete(false)
          throw apiError
        }
      }

      reader.onerror = () => {
        if (progressInterval) clearInterval(progressInterval)
        setProcessingImage(false)
        setProgressPercent(0)
        setProcessingComplete(false)
        setGastoError('Error al leer la imagen')
      }

      reader.readAsDataURL(file)
    } catch (error: any) {
      if (progressInterval) clearInterval(progressInterval)
      setProcessingImage(false)
      setProgressPercent(0)
      setProcessingComplete(false)
      console.error('Error procesando archivo:', error)
      
      let errorMessage = error.message || 'Error al procesar el archivo'
      
      // Si el error viene del servidor con detalles
      if (error.message && error.message.includes('Detalles:')) {
        errorMessage = error.message
      }
      
      setGastoError(errorMessage)
    }
  }

  // Función para obtener el valor editado o el original de una transacción
  const getTransactionValue = (index: number, field: string, originalValue: any) => {
    const edited = editedTransactions.get(index)
    const editedValue = edited && edited[field] !== undefined ? edited[field] : originalValue
    
    // Si es fecha y se usa fecha global, aplicar la fecha global
    if (field === 'fecha' && useGlobalDate && globalDocumentDate && !edited?.fecha) {
      return globalDocumentDate
    }
    
    return editedValue
  }

  // Función para obtener el valor editado o el original de un impuesto
  const getImpuestoValue = (index: number, field: string, originalValue: any) => {
    const edited = editedImpuestos.get(index)
    return edited && edited[field] !== undefined ? edited[field] : originalValue
  }

  // Función para actualizar una transacción editada
  const updateEditedTransaction = (index: number, field: string, value: any) => {
    const newEdited = new Map(editedTransactions)
    const current = newEdited.get(index) || {}
    newEdited.set(index, { ...current, [field]: value })
    setEditedTransactions(newEdited)
  }

  // Función para actualizar un impuesto editado
  const updateEditedImpuesto = (index: number, field: string, value: any) => {
    const newEdited = new Map(editedImpuestos)
    const current = newEdited.get(index) || {}
    newEdited.set(index, { ...current, [field]: value })
    setEditedImpuestos(newEdited)
  }

  const handleConfirmExtractedData = async () => {
    console.log('🔵 [GastosPage] handleConfirmExtractedData - INICIO')
    console.log('🔵 [GastosPage] handleConfirmExtractedData - extractedData:', extractedData)
    console.log('🔵 [GastosPage] handleConfirmExtractedData - selectedTransactions:', selectedTransactions)
    console.log('🔵 [GastosPage] handleConfirmExtractedData - selectedImpuestos:', selectedImpuestos)
    console.log('🔵 [GastosPage] handleConfirmExtractedData - selectedTarjetaId:', selectedTarjetaId)
    
    if (!extractedData) {
      console.error('❌ [GastosPage] handleConfirmExtractedData - No extractedData')
      return
    }

    // Si hay múltiples transacciones (resumen)
    if (extractedData.transacciones && Array.isArray(extractedData.transacciones)) {
      // Aplicar ediciones a las transacciones seleccionadas
      const transactionsToAdd = extractedData.transacciones
        .map((trans: any, index: number) => {
          if (!selectedTransactions.has(index)) return null
          
          // Aplicar ediciones si existen
          const edited = editedTransactions.get(index)
          let finalTrans = edited ? { ...trans, ...edited } : { ...trans }
          
          // Si se usa fecha global y no hay fecha editada individualmente, aplicar fecha global
          if (useGlobalDate && globalDocumentDate && !edited?.fecha) {
            finalTrans.fecha = globalDocumentDate
          }
          
          return finalTrans
        })
        .filter((t: any) => t !== null)
      
      console.log('🔵 [GastosPage] handleConfirmExtractedData - transactionsToAdd:', transactionsToAdd.length)
      
      if (transactionsToAdd.length === 0 && !includeTotal && (!extractedData.impuestos || selectedImpuestos.size === 0)) {
        console.error('❌ [GastosPage] handleConfirmExtractedData - No hay transacciones seleccionadas')
        setGastoError('Por favor, selecciona al menos una transacción o impuesto')
        return
      }
      
      setSavingTransactions(true)
      setGastoError('')
      
      // Usar la tarjeta seleccionada en el modal, o la del formulario como fallback
      const tarjetaIdToUse = selectedTarjetaId || gastoForm.tarjeta_id || null
      console.log('🔵 [GastosPage] handleConfirmExtractedData - tarjetaIdToUse:', tarjetaIdToUse)

      // Agregar cada transacción seleccionada como gasto individual
      const addPromises = transactionsToAdd.map(async (trans: any, index: number) => {
        console.log(`🔵 [GastosPage] handleConfirmExtractedData - Procesando transacción ${index + 1}:`, trans)
        
        let categoriaId = ''
        if (trans.categoria) {
          const categoriaMatch = categorias.find(
            c => c.nombre.toLowerCase().includes(trans.categoria.toLowerCase()) ||
            trans.categoria.toLowerCase().includes(c.nombre.toLowerCase())
          )
          if (categoriaMatch) {
            categoriaId = categoriaMatch.id
          }
        }
        
        const fecha = trans.fecha || gastoForm.fecha
        const fechaObj = new Date(fecha)
        const mesFacturacion = `${fechaObj.getFullYear()}-${String(fechaObj.getMonth() + 1).padStart(2, '0')}`
        
        const gastoData = {
          descripcion: trans.descripcion,
          categoria_id: categoriaId,
          monto: trans.monto,
          moneda: trans.moneda || 'ARS',
          fecha: fecha,
          mes_facturacion: mesFacturacion,
          tarjeta_id: tarjetaIdToUse,
          cuotas: parseInt(gastoForm.cuotas) || 1,
          cuota_actual: 1,
          es_fijo: false,
          tag_ids: gastoForm.tag_ids || [],
          pagado: gastoForm.pagado,
          comercio: trans.comercio || ''
        }
        
        console.log(`🔵 [GastosPage] handleConfirmExtractedData - Agregando gasto ${index + 1}:`, gastoData)
        const result = await addGasto(gastoData)
        console.log(`🔵 [GastosPage] handleConfirmExtractedData - Resultado gasto ${index + 1}:`, result)
        
        if (result.error) {
          console.error(`❌ [GastosPage] handleConfirmExtractedData - Error agregando gasto ${index + 1}:`, result.error)
          throw result.error
        }
        
        return result
      })

      // Si se solicita, agregar el total también
      if (includeTotal && extractedData.total && extractedData.total.monto) {
        console.log('🔵 [GastosPage] handleConfirmExtractedData - Agregando total:', extractedData.total)
        const fechaObj = new Date(gastoForm.fecha)
        const mesFacturacion = `${fechaObj.getFullYear()}-${String(fechaObj.getMonth() + 1).padStart(2, '0')}`
        
        addPromises.push(
          addGasto({
            descripcion: `Total del resumen - ${extractedData.total.periodo || 'Período'}`,
            categoria_id: '',
            monto: extractedData.total.monto,
            moneda: extractedData.total.moneda || 'ARS',
            fecha: gastoForm.fecha,
            mes_facturacion: mesFacturacion,
            tarjeta_id: tarjetaIdToUse,
            cuotas: parseInt(gastoForm.cuotas) || 1,
            cuota_actual: 1,
            es_fijo: false,
            tag_ids: gastoForm.tag_ids || [],
            pagado: gastoForm.pagado
          })
        )
      }
      
      // Agregar impuestos seleccionados
      if (extractedData.impuestos && Array.isArray(extractedData.impuestos) && selectedImpuestos.size > 0) {
        // Aplicar ediciones a los impuestos seleccionados
        const impuestosToAdd = extractedData.impuestos
          .map((imp: any, index: number) => {
            if (!selectedImpuestos.has(index)) return null
            
            // Aplicar ediciones si existen
            const edited = editedImpuestos.get(index)
            if (edited) {
              return {
                ...imp,
                ...edited
              }
            }
            return imp
          })
          .filter((i: any) => i !== null)
        
        console.log('🔵 [GastosPage] handleConfirmExtractedData - Agregando impuestos:', impuestosToAdd.length)
        
        impuestosToAdd.forEach((imp: any, index: number) => {
          console.log(`🔵 [GastosPage] handleConfirmExtractedData - Procesando impuesto ${index + 1}:`, imp)
          
          const fechaObj = new Date(imp.fecha || gastoForm.fecha)
          const mesFacturacion = `${fechaObj.getFullYear()}-${String(fechaObj.getMonth() + 1).padStart(2, '0')}`
          
          addPromises.push(
            addImpuesto({
              descripcion: imp.descripcion,
              monto: imp.monto,
              tarjeta_id: tarjetaIdToUse,
              mes: mesFacturacion
            })
          )
        })
      }

      try {
        console.log('🔵 [GastosPage] handleConfirmExtractedData - Ejecutando Promise.all con', addPromises.length, 'promesas')
        const results = await Promise.all(addPromises)
        console.log('🔵 [GastosPage] handleConfirmExtractedData - Promise.all completado. Resultados:', results)
        
        // Verificar resultados
        const successCount = results.filter(r => !r.error).length
        const errorCount = results.filter(r => r.error).length
        console.log(`🔵 [GastosPage] handleConfirmExtractedData - Resultados: ${successCount} exitosos, ${errorCount} con error`)
        
        if (errorCount > 0) {
          console.error('❌ [GastosPage] handleConfirmExtractedData - Algunos gastos fallaron al agregarse')
        }
        
        // Mostrar mensaje de éxito
        if (successCount > 0) {
          const mensajeGastos = transactionsToAdd.length > 0 ? `${successCount} gasto${successCount !== 1 ? 's' : ''} agregado${successCount !== 1 ? 's' : ''}` : ''
          const mensajeImpuestos = selectedImpuestos.size > 0 ? `${selectedImpuestos.size} impuesto${selectedImpuestos.size !== 1 ? 's' : ''} agregado${selectedImpuestos.size !== 1 ? 's' : ''}` : ''
          const mensaje = [mensajeGastos, mensajeImpuestos].filter(m => m).join(', ')
          
          console.log(`✅ [GastosPage] handleConfirmExtractedData - ${mensaje}`)
          // No usar alert, solo logs por ahora
        }
        
        console.log('🔵 [GastosPage] handleConfirmExtractedData - Cerrando modal y limpiando estado')
        
        setShowImagePreview(false)
        setExtractedData(null)
        setPreviewImage(null)
        setSelectedTransactions(new Set())
        setSelectedImpuestos(new Set())
        setIncludeTotal(false)
        setEditedTransactions(new Map())
        setEditedImpuestos(new Map())
        setDetectedTarjeta(null)
        setSelectedTarjetaId('')
        setSavingTransactions(false)
        setGlobalDocumentDate(null)
        setUseGlobalDate(false)
        setShowGastoModal(false)
        resetGastoForm()
        
        // Los gastos deberían aparecer automáticamente después de que fetchAll se complete
        console.log('🔵 [GastosPage] handleConfirmExtractedData - COMPLETADO EXITOSAMENTE')
        console.log(`✅ [GastosPage] handleConfirmExtractedData - Los gastos deberían aparecer en el listado. Si no aparecen, verifica que estés viendo el mes correcto.`)
      } catch (error) {
        console.error('❌ [GastosPage] handleConfirmExtractedData - Error en Promise.all:', error)
        setGastoError(`Error al agregar las transacciones: ${error instanceof Error ? error.message : 'Error desconocido'}`)
        setSavingTransactions(false)
      }
      
      return
    }

    // Formato antiguo: transacción única (mantener compatibilidad)
    setGastoForm(f => ({
      ...f,
      descripcion: extractedData.descripcion || f.descripcion,
      monto: extractedData.monto ? String(extractedData.monto) : f.monto,
      moneda: extractedData.moneda || f.moneda,
      fecha: extractedData.fecha || f.fecha
    }))

    // Si hay una categoría sugerida, intentar encontrarla
    if (extractedData.categoria) {
      const categoriaMatch = categorias.find(
        c => c.nombre.toLowerCase().includes(extractedData.categoria.toLowerCase()) ||
        extractedData.categoria.toLowerCase().includes(c.nombre.toLowerCase())
      )
      if (categoriaMatch) {
        setGastoForm(f => ({ ...f, categoria_id: categoriaMatch.id }))
      }
    }

    setShowImagePreview(false)
    setExtractedData(null)
    setPreviewImage(null)
    setSelectedTransactions(new Set())
    setIncludeTotal(false)
    setEditedTransactions(new Map())
    setEditedImpuestos(new Map())
    setGlobalDocumentDate(null)
    setUseGlobalDate(false)
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
                const authorLabel = getUserLabel(g.user_id) // <-- Obtener etiqueta

                return (
                  <tr key={g.id} className={`border-b border-slate-100 hover:bg-slate-50 transition ${g.pagado ? 'opacity-50' : ''}`}>
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-slate-100 rounded-lg flex items-center justify-center text-lg">
                          {categoriaMap[g.categoria_id || '']?.icono || '💰'}
                        </div>
                        <div>
                          <div className={`font-semibold ${g.pagado ? 'line-through' : ''}`}>{g.descripcion}</div>
                          
                          {/* --- NUEVO: ETIQUETA DE AUTOR --- */}
                          {currentWorkspace && authorLabel && (
                            <div className="mb-1">
                              <span className={`text-[10px] px-1.5 py-0.5 rounded border font-bold ${
                                authorLabel === 'Tú' 
                                  ? 'bg-slate-100 text-slate-500 border-slate-200' 
                                  : 'bg-purple-100 text-purple-700 border-purple-200'
                              }`}>
                                {authorLabel === 'Tú' ? '👤 Tú' : `👤 ${authorLabel}`}
                              </span>
                            </div>
                          )}
                          {/* -------------------------------- */}

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
              {/* Botón para subir imagen con IA */}
              <div className="flex items-center gap-2 p-3 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg border-2 border-purple-200">
                <ImageIcon className="w-5 h-5 text-purple-600" />
                <div className="flex-1">
                  <label className="text-sm font-semibold text-purple-900 cursor-pointer">
                    📸 Leer con IA desde imagen
                  </label>
                  <p className="text-xs text-purple-700">Sube una imagen o PDF de tu comprobante o ticket</p>
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

              {/* 2️⃣ CATEGORÍA */}
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

              {/* 3️⃣ MONTO Y CUOTAS */}
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

              {/* 4️⃣ MONEDA Y FECHA */}
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
                <div>
                  <label className="label">Fecha</label>
                  <input
                    type="date"
                    className="input"
                    value={gastoForm.fecha}
                    onChange={e => setGastoForm(f => ({ ...f, fecha: e.target.value }))}
                  />
                </div>
              </div>

              {/* 5️⃣ CUENTA/TARJETA */}
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

              {/* 6️⃣ ETIQUETAS */}
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

              {/* 7️⃣ OPCIONES ADICIONALES */}
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={gastoForm.es_fijo}
                  onChange={e => setGastoForm(f => ({ ...f, es_fijo: e.target.checked }))}
                  className="w-5 h-5 accent-indigo-500"
                />
                <span className="font-semibold">Gasto fijo mensual</span>
              </label>

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
                        className="px-4 py-2.5 bg-emerald-50 text-white rounded-lg text-sm font-bold hover:bg-emerald-600 transition shadow-md flex items-center gap-2"
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

      {/* Modal de Vista Previa de Datos Extraídos */}
      {/* Overlay de carga durante procesamiento de IA */}
      {processingImage && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-2xl p-8 max-w-md w-full mx-4">
            <div className="text-center space-y-4">
              <Loader2 className="w-12 h-12 animate-spin text-purple-600 mx-auto" />
              <h3 className="text-xl font-bold text-slate-900">Procesando con IA...</h3>
              <p className="text-slate-600 mb-4">
                {processingComplete ? (
                  <span className="flex items-center gap-2 justify-center">
                    <span className="text-emerald-600">✅</span>
                    <span>Análisis completado</span>
                  </span>
                ) : (
                  `Analizando el documento${progressPercent > 50 ? '...' : '.'} Esto puede tardar unos segundos...`
                )}
              </p>
              <div className="w-full bg-slate-200 rounded-full h-2.5 mt-4 overflow-hidden">
                <div 
                  className={`h-2.5 rounded-full shadow-sm transition-all duration-500 ease-out ${
                    processingComplete 
                      ? 'bg-gradient-to-r from-emerald-500 to-emerald-600' 
                      : 'bg-gradient-to-r from-purple-500 to-purple-600'
                  }`}
                  style={{ 
                    width: `${Math.min(Math.max(progressPercent, 0), 100)}%`,
                    transition: 'width 0.5s ease-out'
                  }}
                ></div>
              </div>
              {progressPercent > 0 && progressPercent < 100 && !processingComplete && (
                <p className="text-xs text-slate-500 mt-2 text-center animate-pulse">
                  {Math.round(Math.min(Math.max(progressPercent, 0), 99))}%
                </p>
              )}
              {processingComplete && progressPercent >= 100 && (
                <p className="text-xs text-emerald-600 mt-2 text-center font-semibold">100% - Preparando resultados...</p>
              )}
            </div>
          </div>
        </div>
      )}

      {showImagePreview && extractedData && (
        <div className="modal-overlay" onClick={() => { 
          setShowImagePreview(false); 
          setExtractedData(null); 
          setPreviewImage(null); 
          setSelectedTransactions(new Set());
          setEditedTransactions(new Map());
          setEditedImpuestos(new Map()); 
          setIncludeTotal(false);
          setDetectedTarjeta(null);
          setSelectedTarjetaId('');
        }}>
          <div className="modal max-w-4xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-purple-600" />
                {extractedData.transacciones ? `Confirmar Transacciones (${extractedData.transacciones.length} encontradas)` : 'Confirmar Datos Extraídos'}
              </h3>
              <button 
                onClick={() => { 
                  setShowImagePreview(false); 
                  setExtractedData(null); 
                  setPreviewImage(null); 
                  setSelectedTransactions(new Set()); 
                  setSelectedImpuestos(new Set());
                  setIncludeTotal(false);
                  setDetectedTarjeta(null);
                  setSelectedTarjetaId('');
                  setEditedTransactions(new Map());
                  setEditedImpuestos(new Map());
                  setGlobalDocumentDate(null);
                  setUseGlobalDate(false);
                }} 
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
                      <strong>Resumen detectado:</strong> Se encontraron {extractedData.transacciones.length} transacciones individuales. 
                      Selecciona las que deseas agregar como gastos.
                    </p>
                  </div>

                  {/* Información de tarjeta detectada */}
                  {detectedTarjeta && (
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-3">
                        <h4 className="font-semibold text-purple-900 flex items-center gap-2">
                          💳 Tarjeta detectada
                        </h4>
                      </div>
                      <div className="space-y-2 text-sm">
                        {detectedTarjeta.banco && (
                          <div className="flex items-center gap-2">
                            <span className="text-purple-700 font-medium">Banco:</span>
                            <span className="text-purple-900">{detectedTarjeta.banco}</span>
                          </div>
                        )}
                        {detectedTarjeta.tipo_tarjeta && (
                          <div className="flex items-center gap-2">
                            <span className="text-purple-700 font-medium">Tipo:</span>
                            <span className="text-purple-900">{detectedTarjeta.tipo_tarjeta}</span>
                          </div>
                        )}
                        {detectedTarjeta.ultimos_digitos && (
                          <div className="flex items-center gap-2">
                            <span className="text-purple-700 font-medium">Últimos dígitos:</span>
                            <span className="text-purple-900">****{detectedTarjeta.ultimos_digitos}</span>
                          </div>
                        )}
                        {detectedTarjeta.nombre_titular && (
                          <div className="flex items-center gap-2">
                            <span className="text-purple-700 font-medium">Titular:</span>
                            <span className="text-purple-900">{detectedTarjeta.nombre_titular}</span>
                          </div>
                        )}
                      </div>
                      
                      <div className="mt-4 pt-3 border-t border-purple-200">
                        <label className="block text-xs font-semibold text-purple-700 uppercase mb-2">
                          Seleccionar tarjeta
                        </label>
                        <select
                          value={selectedTarjetaId}
                          onChange={(e) => setSelectedTarjetaId(e.target.value)}
                          className="input w-full text-sm"
                        >
                          <option value="">Selecciona una tarjeta o deja vacío</option>
                          {tarjetas.map(t => (
                            <option key={t.id} value={t.id}>
                              {t.nombre} {t.banco ? `(${t.banco})` : ''} {t.digitos ? `****${t.digitos}` : ''}
                            </option>
                          ))}
                        </select>
                        <p className="text-xs text-purple-600 mt-2">
                          💡 Si no encuentras la tarjeta, puedes crearla desde el menú de Tarjetas y luego agregar estos gastos nuevamente.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Si no se detectó tarjeta, mostrar selector opcional */}
                  {!detectedTarjeta && (
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                      <label className="block text-xs font-semibold text-slate-700 uppercase mb-2">
                        Tarjeta (opcional)
                      </label>
                      <select
                        value={selectedTarjetaId}
                        onChange={(e) => setSelectedTarjetaId(e.target.value)}
                        className="input w-full text-sm"
                      >
                        <option value="">Sin tarjeta (efectivo)</option>
                        {tarjetas.map(t => (
                          <option key={t.id} value={t.id}>
                            {t.nombre} {t.banco ? `(${t.banco})` : ''} {t.digitos ? `****${t.digitos}` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Selector de Fecha/Mes General para todo el documento */}
                  <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border-2 border-indigo-200 rounded-xl p-4 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">📅</span>
                        <div>
                          <h4 className="font-bold text-indigo-900 text-sm">Fecha General del Documento</h4>
                          <p className="text-xs text-indigo-600 mt-0.5">
                            Esta fecha se aplicará a todas las transacciones seleccionadas
                          </p>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={useGlobalDate}
                          onChange={(e) => {
                            setUseGlobalDate(e.target.checked)
                            if (e.target.checked && globalDocumentDate) {
                              // Aplicar fecha global a todas las transacciones
                              const newEdited = new Map(editedTransactions)
                              extractedData.transacciones.forEach((_: any, index: number) => {
                                if (!newEdited.has(index) || !newEdited.get(index)?.fecha) {
                                  const current = newEdited.get(index) || {}
                                  newEdited.set(index, { ...current, fecha: globalDocumentDate })
                                }
                              })
                              setEditedTransactions(newEdited)
                            }
                          }}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                      </label>
                    </div>
                    
                    {useGlobalDate && (
                      <div className="mt-3 space-y-2">
                        <div className="flex gap-3">
                          <div className="flex-1">
                            <label className="block text-xs font-semibold text-indigo-700 mb-1.5">
                              Fecha
                            </label>
                            <input
                              type="date"
                              value={globalDocumentDate || ''}
                              onChange={(e) => {
                                const newDate = e.target.value
                                setGlobalDocumentDate(newDate)
                                // Aplicar a todas las transacciones seleccionadas
                                const newEdited = new Map(editedTransactions)
                                extractedData.transacciones.forEach((_: any, index: number) => {
                                  if (selectedTransactions.has(index)) {
                                    const current = newEdited.get(index) || {}
                                    newEdited.set(index, { ...current, fecha: newDate })
                                  }
                                })
                                setEditedTransactions(newEdited)
                              }}
                              className="input w-full text-sm border-indigo-300 focus:border-indigo-500 focus:ring-indigo-500"
                            />
                          </div>
                          <div className="flex-1">
                            <label className="block text-xs font-semibold text-indigo-700 mb-1.5">
                              Mes de Facturación
                            </label>
                            <input
                              type="month"
                              value={globalDocumentDate ? globalDocumentDate.substring(0, 7) : ''}
                              onChange={(e) => {
                                const monthValue = e.target.value
                                // Usar el primer día del mes seleccionado
                                const newDate = `${monthValue}-01`
                                setGlobalDocumentDate(newDate)
                                // Aplicar a todas las transacciones seleccionadas
                                const newEdited = new Map(editedTransactions)
                                extractedData.transacciones.forEach((_: any, index: number) => {
                                  if (selectedTransactions.has(index)) {
                                    const current = newEdited.get(index) || {}
                                    newEdited.set(index, { ...current, fecha: newDate })
                                  }
                                })
                                setEditedTransactions(newEdited)
                              }}
                              className="input w-full text-sm border-indigo-300 focus:border-indigo-500 focus:ring-indigo-500"
                            />
                          </div>
                        </div>
                        <p className="text-xs text-indigo-600 flex items-center gap-1">
                          <span>💡</span>
                          <span>La fecha seleccionada se aplicará automáticamente a todas las transacciones. Puedes modificar individualmente cada una si es necesario.</span>
                        </p>
                      </div>
                    )}
                    
                    {!useGlobalDate && globalDocumentDate && (
                      <div className="mt-3 p-2 bg-white/60 rounded-lg border border-indigo-200">
                        <p className="text-xs text-indigo-700">
                          <strong>Fecha detectada por IA:</strong> {new Date(globalDocumentDate).toLocaleDateString('es-AR', { 
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric' 
                          })}
                        </p>
                        <p className="text-xs text-indigo-600 mt-1">
                          Activa el interruptor arriba para aplicar una fecha general a todas las transacciones.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Lista de Transacciones */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold text-slate-900 text-sm">
                        Transacciones Detectadas ({extractedData.transacciones.length})
                      </h4>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            const allSelected = new Set<number>(extractedData.transacciones.map((_: any, i: number) => i))
                            setSelectedTransactions(allSelected)
                          }}
                          className="text-xs px-2 py-1 bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200 transition-colors"
                        >
                          Seleccionar todas
                        </button>
                        <button
                          onClick={() => setSelectedTransactions(new Set())}
                          className="text-xs px-2 py-1 bg-slate-100 text-slate-700 rounded hover:bg-slate-200 transition-colors"
                        >
                          Deseleccionar todas
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                    {extractedData.transacciones.map((trans: any, index: number) => {
                      const descripcion = getTransactionValue(index, 'descripcion', trans.descripcion)
                      const monto = getTransactionValue(index, 'monto', trans.monto)
                      const fecha = getTransactionValue(index, 'fecha', trans.fecha)
                      const moneda = getTransactionValue(index, 'moneda', trans.moneda || 'ARS')
                      
                      return (
                        <div 
                          key={index}
                          className={`border-2 rounded-xl p-4 transition-all duration-200 ${
                            selectedTransactions.has(index) 
                              ? 'border-indigo-500 bg-gradient-to-br from-indigo-50 to-purple-50 shadow-md' 
                              : 'border-slate-200 hover:border-indigo-300 bg-white hover:shadow-sm'
                          }`}
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
                                  // Si se selecciona y hay fecha global activa, aplicar fecha
                                  if (useGlobalDate && globalDocumentDate) {
                                    const current = editedTransactions.get(index) || {}
                                    updateEditedTransaction(index, 'fecha', globalDocumentDate)
                                  }
                                }
                                setSelectedTransactions(newSelected)
                              }}
                              className="mt-1 w-5 h-5 text-indigo-600 rounded border-slate-300 cursor-pointer focus:ring-2 focus:ring-indigo-500"
                            />
                            <div className="flex-1 space-y-3">
                              {/* Descripción editable */}
                              <div>
                                <label className="text-xs font-semibold text-slate-700 mb-1.5 block">
                                  Descripción
                                </label>
                                <input
                                  type="text"
                                  value={descripcion || ''}
                                  onChange={(e) => {
                                    e.stopPropagation()
                                    updateEditedTransaction(index, 'descripcion', e.target.value)
                                  }}
                                  className="input w-full text-sm border-slate-300 focus:border-indigo-500 focus:ring-indigo-500"
                                  placeholder="Descripción del gasto"
                                />
                              </div>
                              
                              {/* Fecha y Monto en fila */}
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="text-xs font-semibold text-slate-700 mb-1.5 block">
                                    Fecha {useGlobalDate && globalDocumentDate && (
                                      <span className="text-indigo-600 text-xs font-normal">(global aplicada)</span>
                                    )}
                                  </label>
                                  <input
                                    type="date"
                                    value={fecha || ''}
                                    onChange={(e) => {
                                      e.stopPropagation()
                                      updateEditedTransaction(index, 'fecha', e.target.value)
                                    }}
                                    className="input w-full text-sm border-slate-300 focus:border-indigo-500 focus:ring-indigo-500"
                                  />
                                </div>
                                <div>
                                  <label className="text-xs font-semibold text-slate-700 mb-1.5 block">
                                    Monto
                                  </label>
                                  <div className="flex gap-2">
                                    <input
                                      type="number"
                                      step="0.01"
                                      value={monto || ''}
                                      onChange={(e) => {
                                        e.stopPropagation()
                                        updateEditedTransaction(index, 'monto', parseFloat(e.target.value) || 0)
                                      }}
                                      className="input w-full text-sm border-slate-300 focus:border-indigo-500 focus:ring-indigo-500"
                                      placeholder="0.00"
                                    />
                                    <select
                                      value={moneda}
                                      onChange={(e) => {
                                        e.stopPropagation()
                                        updateEditedTransaction(index, 'moneda', e.target.value)
                                      }}
                                      className="input text-sm w-20 border-slate-300 focus:border-indigo-500 focus:ring-indigo-500"
                                    >
                                      <option value="ARS">ARS</option>
                                      <option value="USD">USD</option>
                                    </select>
                                  </div>
                                </div>
                              </div>
                              
                              {/* Información adicional (solo lectura) */}
                              {(trans.comercio || trans.categoria) && (
                                <div className="flex items-center gap-3 text-xs pt-1 border-t border-slate-200">
                                  {trans.comercio && (
                                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded-md">
                                      <span>📍</span>
                                      <span>{trans.comercio}</span>
                                    </span>
                                  )}
                                  {trans.categoria && (
                                    <span className="inline-flex items-center px-2 py-1 bg-purple-100 text-purple-700 rounded-md font-medium">
                                      {trans.categoria}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Impuestos detectados */}
                  {extractedData.impuestos && Array.isArray(extractedData.impuestos) && extractedData.impuestos.length > 0 && (
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                      <h4 className="font-semibold text-orange-900 flex items-center gap-2 mb-3">
                        📝 Impuestos, Comisiones y Cargos detectados
                      </h4>
                      <p className="text-sm text-orange-700 mb-3">
                        Se encontraron {extractedData.impuestos.length} impuesto{extractedData.impuestos.length !== 1 ? 's' : ''}. Selecciona los que deseas agregar.
                      </p>
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {extractedData.impuestos.map((imp: any, index: number) => {
                          const descripcion = getImpuestoValue(index, 'descripcion', imp.descripcion)
                          const monto = getImpuestoValue(index, 'monto', imp.monto)
                          const fecha = getImpuestoValue(index, 'fecha', imp.fecha)
                          const moneda = getImpuestoValue(index, 'moneda', imp.moneda || 'ARS')
                          
                          return (
                            <div 
                              key={index}
                              className={`border rounded-lg p-4 transition-colors ${
                                selectedImpuestos.has(index) 
                                  ? 'border-orange-500 bg-orange-100' 
                                  : 'border-orange-200 hover:border-orange-300 bg-white'
                              }`}
                            >
                              <div className="flex items-start gap-3">
                                <input
                                  type="checkbox"
                                  checked={selectedImpuestos.has(index)}
                                  onChange={(e) => {
                                    e.stopPropagation()
                                    const newSelected = new Set(selectedImpuestos)
                                    if (newSelected.has(index)) {
                                      newSelected.delete(index)
                                    } else {
                                      newSelected.add(index)
                                    }
                                    setSelectedImpuestos(newSelected)
                                  }}
                                  className="mt-1 w-4 h-4 text-orange-600 rounded border-slate-300"
                                />
                                <div className="flex-1 space-y-3">
                                  {/* Descripción editable */}
                                  <div>
                                    <label className="text-xs text-slate-500 mb-1 block">Descripción</label>
                                    <input
                                      type="text"
                                      value={descripcion || ''}
                                      onChange={(e) => {
                                        e.stopPropagation()
                                        updateEditedImpuesto(index, 'descripcion', e.target.value)
                                      }}
                                      className="input w-full text-sm"
                                      placeholder="Descripción del impuesto"
                                    />
                                  </div>
                                  
                                  {/* Fecha y Monto en fila */}
                                  <div className="grid grid-cols-2 gap-3">
                                    <div>
                                      <label className="text-xs text-slate-500 mb-1 block">Fecha</label>
                                      <input
                                        type="date"
                                        value={fecha || ''}
                                        onChange={(e) => {
                                          e.stopPropagation()
                                          updateEditedImpuesto(index, 'fecha', e.target.value)
                                        }}
                                        className="input w-full text-sm"
                                      />
                                    </div>
                                    <div>
                                      <label className="text-xs text-slate-500 mb-1 block">Monto</label>
                                      <div className="flex gap-2">
                                        <input
                                          type="number"
                                          step="0.01"
                                          value={monto || ''}
                                          onChange={(e) => {
                                            e.stopPropagation()
                                            updateEditedImpuesto(index, 'monto', parseFloat(e.target.value) || 0)
                                          }}
                                          className="input w-full text-sm"
                                          placeholder="0.00"
                                        />
                                        <select
                                          value={moneda}
                                          onChange={(e) => {
                                            e.stopPropagation()
                                            updateEditedImpuesto(index, 'moneda', e.target.value)
                                          }}
                                          className="input text-sm w-20"
                                        >
                                          <option value="ARS">ARS</option>
                                          <option value="USD">USD</option>
                                        </select>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                      <div className="flex gap-2 mt-3 pt-3 border-t border-orange-200">
                        <button
                          onClick={() => {
                            const allSelected = new Set<number>(extractedData.impuestos.map((_: any, i: number) => i))
                            setSelectedImpuestos(allSelected)
                          }}
                          className="btn btn-secondary text-sm"
                        >
                          Seleccionar todos
                        </button>
                        <button
                          onClick={() => setSelectedImpuestos(new Set())}
                          className="btn btn-secondary text-sm"
                        >
                          Deseleccionar
                        </button>
                      </div>
                    </div>
                  )}

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
                            Opcional: Agregar el total del resumen como un gasto adicional
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                    <span className="text-sm text-slate-600">
                      {selectedTransactions.size} transacción{selectedTransactions.size !== 1 ? 'es' : ''} seleccionada{selectedTransactions.size !== 1 ? 's' : ''}
                      {selectedImpuestos.size > 0 && `, ${selectedImpuestos.size} impuesto${selectedImpuestos.size !== 1 ? 's' : ''}`}
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
                  
                  {extractedData.comercio && (
                    <div>
                      <label className="text-xs font-semibold text-slate-600 uppercase">Comercio</label>
                      <div className="mt-1 px-3 py-2 bg-blue-100 text-blue-700 rounded-lg">
                        {extractedData.comercio}
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              <div className="flex gap-2 pt-2 border-t border-slate-200">
                <button
                  onClick={handleConfirmExtractedData}
                  className="btn btn-primary flex-1"
                  disabled={(extractedData.transacciones && selectedTransactions.size === 0 && !includeTotal && (!extractedData.impuestos || selectedImpuestos.size === 0)) || savingTransactions}
                >
                  {savingTransactions ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Agregando...
                    </>
                  ) : (
                    <>
                      ✓ {extractedData.transacciones ? 
                        `Agregar ${selectedTransactions.size} transacción${selectedTransactions.size !== 1 ? 'es' : ''}${selectedImpuestos.size > 0 ? ` + ${selectedImpuestos.size} impuesto${selectedImpuestos.size !== 1 ? 's' : ''}` : ''}` : 
                        'Usar estos datos'}
                    </>
                  )}
                </button>
              <button 
                onClick={() => { 
                  setShowImagePreview(false); 
                  setExtractedData(null); 
                  setPreviewImage(null); 
                  setSelectedTransactions(new Set()); 
                  setSelectedImpuestos(new Set());
                  setIncludeTotal(false);
                  setDetectedTarjeta(null);
                  setSelectedTarjetaId('');
                  setEditedTransactions(new Map());
                  setEditedImpuestos(new Map());
                  setGlobalDocumentDate(null);
                  setUseGlobalDate(false);
                }}
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

const iconOptions = ['🎯', '💰', '🏠', '🚗', '✈️', '🎮', '📚', '💊', '👕', '🍔', '🛒']
