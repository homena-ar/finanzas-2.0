'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { useData } from '@/hooks/useData'
import { useWorkspace } from '@/hooks/useWorkspace' // Importamos para identificar al usuario
import { useAuth } from '@/hooks/useAuth' // Importamos para saber "quién soy yo"
import { formatMoney, getMonthName, getTagClass } from '@/lib/utils'
import { Plus, Search, Edit2, Trash2, Pin, X, Download, Upload, Image as ImageIcon, Loader2, CheckCircle2 } from 'lucide-react'
import { Gasto } from '@/types'
import { ConfirmModal } from '@/components/Modal'
import { EmojiPickerField } from '@/components/EmojiPickerField'

// Función helper para calcular mes_facturacion desde una fecha en formato YYYY-MM-DD
// Evita problemas de zona horaria al parsear directamente la cadena
const getMesFacturacion = (fecha: string): string => {
  // La fecha viene en formato YYYY-MM-DD, extraemos directamente año y mes
  const [year, month] = fecha.split('-')
  return `${year}-${month}`
}

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
  const [selectedGastos, setSelectedGastos] = useState<Set<string>>(new Set())
  const [selectedImpuestosGastos, setSelectedImpuestosGastos] = useState<Set<string>>(new Set())
  const [showDeleteMasivoModal, setShowDeleteMasivoModal] = useState(false)
  const [showPagoMasivoModal, setShowPagoMasivoModal] = useState(false)
  const [pagoMasivoForm, setPagoMasivoForm] = useState({
    fecha_pago: new Date().toISOString().split('T')[0],
    medio_pago: '',
    comprobante: null as File | null,
    medio_pago_custom: ''
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
  const [editedTotal, setEditedTotal] = useState<{ descripcion?: string; monto?: number; moneda?: string } | null>(null)
  // Estado para fecha/mes general del documento (aplica a todas las transacciones)
  const [globalDocumentDate, setGlobalDocumentDate] = useState<string | null>(null)
  const [useGlobalDate, setUseGlobalDate] = useState(false)

  // Debug: Log cuando cambian los selectores
  useEffect(() => {
    console.log('🔵 [GastosPage] selectedTarjetaId cambió:', selectedTarjetaId)
    if (selectedTarjetaId) {
      const tarjeta = tarjetas.find(t => t.id === selectedTarjetaId)
      console.log('🔵 [GastosPage] Tarjeta encontrada:', tarjeta)
    }
  }, [selectedTarjetaId, tarjetas])

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
    moneda: 'ARS', cuotas: '1', cuotas_custom: '', fecha: new Date().toISOString().split('T')[0],
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

    const mesFacturacion = getMesFacturacion(gastoForm.fecha)

    const data = {
      descripcion: gastoForm.descripcion,
      tarjeta_id: gastoForm.tarjeta_id || null,
      categoria_id: gastoForm.categoria_id || null,
      monto: parseFloat(gastoForm.monto),
      moneda: gastoForm.moneda as 'ARS' | 'USD',
      cuotas: parseInt(gastoForm.cuotas === 'custom' ? (gastoForm.cuotas_custom || '1') : gastoForm.cuotas),
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
      moneda: 'ARS', cuotas: '1', cuotas_custom: '', fecha: new Date().toISOString().split('T')[0],
      es_fijo: false, tag_ids: [], pagado: false
    })
    setGastoError('')
  }

  const resetImpForm = () => {
    setImpForm({ descripcion: '', tarjeta_id: tarjetas[0]?.id || '', monto: '', mes: monthKey })
  }

  const openEditGasto = (g: Gasto) => {
    setEditingGasto(g)
    const cuotasVal = String(g.cuotas || 1)
    // Si el número de cuotas no está en la lista predefinida, usar "custom"
    const cuotasPredefinidas = ['1', '2', '3', '4', '6', '9', '12', '18', '24', '36', '48']
    const isCustom = !cuotasPredefinidas.includes(cuotasVal)
    
    setGastoForm({
      descripcion: g.descripcion,
      tarjeta_id: g.tarjeta_id || '',
      categoria_id: g.categoria_id || '',
      monto: String(g.monto),
      moneda: g.moneda,
      cuotas: isCustom ? 'custom' : cuotasVal,
      cuotas_custom: isCustom ? cuotasVal : '',
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

  const handleConfirmPagoMasivo = async () => {
    if (selectedGastos.size === 0) return

    // Convertir comprobante a base64 si existe (mismo comprobante para todos)
    let comprobanteUrl = null
    let comprobanteNombre = null

    if (pagoMasivoForm.comprobante) {
      comprobanteNombre = pagoMasivoForm.comprobante.name
      const reader = new FileReader()
      comprobanteUrl = await new Promise((resolve) => {
        reader.onloadend = () => resolve(reader.result as string)
        reader.readAsDataURL(pagoMasivoForm.comprobante!)
      })
    }

    // Determinar el medio de pago a guardar
    let medioPagoFinal = pagoMasivoForm.medio_pago || null

    if (pagoMasivoForm.medio_pago === 'nuevo' && pagoMasivoForm.medio_pago_custom.trim()) {
      medioPagoFinal = pagoMasivoForm.medio_pago_custom.trim()

      // Guardar en Firebase si no existe
      const exists = mediosPago.some(m => m.nombre === medioPagoFinal)
      if (!exists) {
        const { error } = await addMedioPago(medioPagoFinal)
        if (error) {
          console.error('Error al guardar medio de pago:', error)
        }
      }
    }

    // Marcar todos los gastos seleccionados como pagados con el mismo comprobante
    const gastosSeleccionados = gastosMes.filter(g => selectedGastos.has(g.id))
    const promises = gastosSeleccionados.map(g => 
      updateGasto(g.id, {
        pagado: true,
        fecha_pago: pagoMasivoForm.fecha_pago,
        medio_pago: medioPagoFinal,
        comprobante_url: comprobanteUrl,
        comprobante_nombre: comprobanteNombre
      })
    )

    await Promise.all(promises)

    setShowPagoMasivoModal(false)
    setSelectedGastos(new Set())
    setPagoMasivoForm({
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
        
        // Función para incrementar progreso suavemente con actualización continua
        const smoothProgress = (targetPercent: number, duration: number) => {
          return new Promise<void>((resolve) => {
            setProgressPercent(prev => {
              const startPercent = prev
              const startTime = Date.now()
              
              const updateProgress = () => {
                const elapsed = Date.now() - startTime
                const progress = Math.min(elapsed / duration, 1)
                const newPercent = Math.floor(startPercent + (targetPercent - startPercent) * progress)
                
                if (progress < 1) {
                  setProgressPercent(Math.min(newPercent, targetPercent))
                  requestAnimationFrame(updateProgress)
                } else {
                  setProgressPercent(targetPercent)
                  resolve()
                }
              }
              
              updateProgress()
              return startPercent
            })
          })
        }

        // Función para simular progreso continuo durante la llamada a la API
        const simulateContinuousProgress = (startPercent: number, endPercent: number, estimatedDuration: number) => {
          return new Promise<void>((resolve) => {
            const startTime = Date.now()
            let lastPercent = startPercent
            let animationFrameId: number | null = null
            
            const updateProgress = () => {
              const elapsed = Date.now() - startTime
              const progress = Math.min(elapsed / estimatedDuration, 1)
              const current = Math.floor(startPercent + (endPercent - startPercent) * progress)
              
              if (current > lastPercent && current < endPercent) {
                setProgressPercent(Math.min(current, endPercent - 1))
                lastPercent = current
              }
              
              if (progress < 1) {
                animationFrameId = requestAnimationFrame(updateProgress)
              } else {
                if (animationFrameId) cancelAnimationFrame(animationFrameId)
                resolve()
              }
            }
            
            updateProgress()
            
            // Resolver cuando se complete el tiempo estimado
            setTimeout(() => {
              if (animationFrameId) cancelAnimationFrame(animationFrameId)
              resolve()
            }, estimatedDuration)
          })
        }

        try {
          // Avanzar a 5% rápidamente
          await smoothProgress(5, 200)
          
          // Iniciar progreso continuo mientras se prepara y envía la petición
          const progressPromise = simulateContinuousProgress(5, 69, 10000) // 10 segundos estimados, hasta 69%
          
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

          // Esperar a que termine el progreso simulado o la respuesta
          await Promise.race([
            progressPromise,
            new Promise(resolve => setTimeout(resolve, 100))
          ])

          // Esperar unos segundos en 70% como solicitó el usuario
          await smoothProgress(70, 300)
          await new Promise(resolve => setTimeout(resolve, 2000)) // Esperar 2 segundos en 70%

          // Avanzar gradualmente de 70 a 99, de a uno por vez con esperas
          for (let i = 71; i <= 99; i++) {
            await smoothProgress(i, 150) // Avanzar de a 1%
            await new Promise(resolve => setTimeout(resolve, 100)) // Esperar 100ms entre cada incremento
          }

          const result = await response.json()

          if (!response.ok || !result.success) {
            const errorMessage = result.error || 'Error al procesar el archivo'
            const errorDetails = result.details ? `\n\nDetalles: ${result.details}` : ''
            throw new Error(`${errorMessage}${errorDetails}`)
          }

          setExtractedData(result.data)
          
          // Seleccionar automáticamente todas las transacciones e impuestos detectados
          if (result.data.transacciones && Array.isArray(result.data.transacciones)) {
            const allTransactions = new Set<number>(result.data.transacciones.map((_: any, i: number) => i))
            setSelectedTransactions(allTransactions)
          }
          if (result.data.impuestos && Array.isArray(result.data.impuestos)) {
            const allImpuestos = new Set<number>(result.data.impuestos.map((_: any, i: number) => i))
            setSelectedImpuestos(allImpuestos)
          }
          
          // Detectar fecha general del documento desde el mes del resumen
          if (result.data.total && result.data.total.mes_resumen) {
            // Si la IA detectó el mes del resumen, usar el primer día de ese mes
            const mesResumen = result.data.total.mes_resumen // Formato: "YYYY-MM"
            const fechaResumen = `${mesResumen}-01`
            setGlobalDocumentDate(fechaResumen)
            setUseGlobalDate(true)
          } else if (result.data.transacciones && result.data.transacciones.length > 0) {
            // Fallback: usar la primera fecha encontrada
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
          
          // Esperar un momento en 99% antes de completar
          await new Promise(resolve => setTimeout(resolve, 500))
          
          // Avanzar a 100% suavemente
          await smoothProgress(100, 300)
          
          // Completar
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
            setEditedTotal(null)
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
        setGastoError('Por favor, selecciona al menos una transacción, impuesto o el total')
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
        
        // Usar fecha global del mes del resumen si está disponible, sino usar la fecha de la transacción o del formulario
        const fecha = (useGlobalDate && globalDocumentDate) ? globalDocumentDate : (trans.fecha || gastoForm.fecha)
        const mesFacturacion = getMesFacturacion(fecha)
        
        // Detectar si es un gasto en cuotas (la IA puede detectar esto o puede estar editado)
        const cuotasEditadas = editedTransactions.get(index)?.cuotas
        const cuotaActualEditada = editedTransactions.get(index)?.cuota_actual
        
        console.log(`🔵 [GastosPage] Transacción ${index + 1} - Datos originales:`, {
          descripcion: trans.descripcion,
          monto: trans.monto,
          cuotas: trans.cuotas,
          cuota_actual: trans.cuota_actual,
          cuotasEditadas,
          cuotaActualEditada
        })
        
        // La IA puede devolver cuotas como número, string, null o undefined
        let totalCuotasDetectadas = cuotasEditadas !== undefined 
          ? cuotasEditadas 
          : (trans.cuotas !== null && trans.cuotas !== undefined 
              ? (typeof trans.cuotas === 'number' ? trans.cuotas : parseInt(String(trans.cuotas))) 
              : null)
        
        // Detectar cuota actual si la IA la proporcionó
        let cuotaActualDetectada = cuotaActualEditada !== undefined
          ? cuotaActualEditada
          : (trans.cuota_actual !== null && trans.cuota_actual !== undefined
              ? (typeof trans.cuota_actual === 'number' ? trans.cuota_actual : parseInt(String(trans.cuota_actual)))
              : null)
        
        console.log(`🔵 [GastosPage] Transacción ${index + 1} - Cuotas detectadas:`, {
          totalCuotasDetectadas,
          cuotaActualDetectada
        })
        
        // Si hay cuota actual detectada y total de cuotas, calcular cuotas restantes
        let cuotasFinal = totalCuotasDetectadas && totalCuotasDetectadas > 1 
          ? totalCuotasDetectadas 
          : (parseInt(gastoForm.cuotas === 'custom' ? (gastoForm.cuotas_custom || '1') : gastoForm.cuotas) || 1)
        
        let cuotaActualFinal = 1
        let montoFinal = trans.monto
        
        // CASO 1: Cuota intermedia (ej: cuota 4 de 6)
        if (cuotaActualDetectada && totalCuotasDetectadas && cuotaActualDetectada > 0 && totalCuotasDetectadas >= cuotaActualDetectada) {
          // Calcular cuántas cuotas faltan (si es cuota 4 de 6, faltan 3: 4, 5, 6)
          const cuotasRestantes = totalCuotasDetectadas - cuotaActualDetectada + 1
          cuotasFinal = cuotasRestantes
          cuotaActualFinal = cuotaActualDetectada
          
          // IMPORTANTE: Si es una cuota intermedia (ej: cuota 4 de 6), el monto mostrado en el resumen
          // es el monto de UNA cuota. Necesitamos multiplicar por las cuotas restantes para obtener el total.
          // Ejemplo: Si el monto es 14.999,83 y es cuota 4 de 6, el total restante es: 14.999,83 × 3 = 44.999,49
          montoFinal = trans.monto * cuotasRestantes
          
          console.log(`✅ [GastosPage] CASO 1 - Cuota intermedia detectada:`)
          console.log(`   - Descripción: ${trans.descripcion}`)
          console.log(`   - Cuota actual: ${cuotaActualDetectada} de ${totalCuotasDetectadas}`)
          console.log(`   - Cuotas restantes: ${cuotasRestantes} (cuotas ${cuotaActualDetectada}, ${cuotaActualDetectada + 1}, ..., ${totalCuotasDetectadas})`)
          console.log(`   - Monto por cuota (del resumen): ${trans.monto}`)
          console.log(`   - Monto total restante calculado: ${montoFinal} (${trans.monto} × ${cuotasRestantes})`)
          console.log(`   - Se agregarán ${cuotasRestantes} cuotas con monto total de ${montoFinal}`)
        } 
        // CASO 2: Primera cuota o solo total de cuotas sin cuota actual
        else if (totalCuotasDetectadas && totalCuotasDetectadas > 1) {
          // Si solo hay total de cuotas pero no cuota actual, asumir que es la primera
          // En este caso, el monto mostrado es de una cuota, multiplicar por el total
          montoFinal = trans.monto * totalCuotasDetectadas
          cuotasFinal = totalCuotasDetectadas
          cuotaActualFinal = 1
          
          console.log(`✅ [GastosPage] CASO 2 - Primera cuota detectada:`)
          console.log(`   - Descripción: ${trans.descripcion}`)
          console.log(`   - Total de cuotas: ${totalCuotasDetectadas}`)
          console.log(`   - Monto por cuota (del resumen): ${trans.monto}`)
          console.log(`   - Monto total calculado: ${montoFinal} (${trans.monto} × ${totalCuotasDetectadas})`)
          console.log(`   - Se agregarán ${totalCuotasDetectadas} cuotas con monto total de ${montoFinal}`)
        }
        // CASO 3: Sin cuotas o cuota única
        else {
          console.log(`✅ [GastosPage] CASO 3 - Sin cuotas o cuota única:`)
          console.log(`   - Descripción: ${trans.descripcion}`)
          console.log(`   - Monto: ${montoFinal}`)
          console.log(`   - Cuotas: ${cuotasFinal}`)
        }
        
        console.log(`🔵 [GastosPage] RESULTADO FINAL - Transacción ${index + 1}:`, {
          descripcion: trans.descripcion,
          montoFinal,
          cuotasFinal,
          cuotaActualFinal
        })
        
        const gastoData = {
          descripcion: trans.descripcion,
          categoria_id: categoriaId,
          monto: montoFinal,
          moneda: trans.moneda || 'ARS',
          fecha: fecha,
          mes_facturacion: mesFacturacion,
          tarjeta_id: tarjetaIdToUse,
          cuotas: cuotasFinal,
          cuota_actual: cuotaActualFinal,
          es_fijo: false, // NO marcar como fijo, las cuotas se distribuyen automáticamente
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

      // Si se solicita, agregar el total también (el total ya debería incluir impuestos según el prompt mejorado)
      if (includeTotal && extractedData.total && extractedData.total.monto) {
        console.log('🔵 [GastosPage] handleConfirmExtractedData - Agregando total:', extractedData.total)
        
        // Usar valores editados si existen, sino usar los originales o el nombre sugerido por la IA
        const nombrePorDefecto = extractedData.total.nombre_sugerido || 
          (extractedData.total.tipo_documento === 'comprobante_unico' 
            ? extractedData.total.nombre_sugerido || 'Comprobante'
            : `Total del resumen - ${extractedData.total.periodo || 'Período'}`)
        const totalDescripcion = editedTotal?.descripcion || nombrePorDefecto
        const totalMonto = editedTotal?.monto !== undefined ? editedTotal.monto : extractedData.total.monto
        const totalMoneda = editedTotal?.moneda || extractedData.total.moneda || 'ARS'
        
        // Usar fecha global si está disponible, sino usar la del formulario
        const fechaToUse = useGlobalDate && globalDocumentDate ? globalDocumentDate : gastoForm.fecha
        const mesFacturacion = getMesFacturacion(fechaToUse)
        
        addPromises.push(
          addGasto({
            descripcion: totalDescripcion,
            categoria_id: '',
            monto: totalMonto,
            moneda: totalMoneda,
            fecha: fechaToUse,
            mes_facturacion: mesFacturacion,
            tarjeta_id: tarjetaIdToUse,
            cuotas: parseInt(gastoForm.cuotas === 'custom' ? (gastoForm.cuotas_custom || '1') : gastoForm.cuotas) || 1,
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
          
          // Usar fecha global del mes del resumen si está disponible, sino usar la fecha del impuesto o del formulario
          const fechaImp = (useGlobalDate && globalDocumentDate) ? globalDocumentDate : (imp.fecha || gastoForm.fecha)
          const mesFacturacion = getMesFacturacion(fechaImp)
          
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
    setEditedTotal(null)
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

        {/* Acciones masivas */}
        {selectedGastos.size > 0 && (
          <div className="p-4 bg-indigo-50 border-b border-indigo-200 flex items-center justify-between flex-wrap gap-2">
            <span className="text-sm font-semibold text-indigo-900">
              {selectedGastos.size} gasto{selectedGastos.size !== 1 ? 's' : ''} seleccionado{selectedGastos.size !== 1 ? 's' : ''}
            </span>
            <div className="flex gap-2 items-center flex-wrap">
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-indigo-900">Cambiar cuenta:</label>
                <select
                  onChange={async (e) => {
                    const tarjetaId = e.target.value || null
                    const gastosSeleccionados = gastosMes.filter(g => selectedGastos.has(g.id))
                    const promises = gastosSeleccionados.map(g => 
                      updateGasto(g.id, { tarjeta_id: tarjetaId })
                    )
                    await Promise.all(promises)
                    setSelectedGastos(new Set())
                    e.target.value = ''
                  }}
                  className="input text-xs h-8 min-w-[150px]"
                  defaultValue=""
                >
                  <option value="">Seleccionar cuenta...</option>
                  <option value="">💵 Efectivo</option>
                  {tarjetas.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.nombre} {t.banco ? `(${t.banco})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={() => {
                  setPagoMasivoForm({
                    fecha_pago: new Date().toISOString().split('T')[0],
                    medio_pago: '',
                    comprobante: null,
                    medio_pago_custom: ''
                  })
                  setShowPagoMasivoModal(true)
                }}
                className="btn btn-success btn-sm"
              >
                <CheckCircle2 className="w-4 h-4" /> Registrar Pago Masivo
              </button>
              <button
                onClick={() => setShowDeleteMasivoModal(true)}
                className="btn btn-danger btn-sm"
              >
                <Trash2 className="w-4 h-4" /> Eliminar Seleccionados
              </button>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50">
                <th className="text-left p-4 text-xs font-bold text-slate-500 uppercase w-12">
                  <input
                    type="checkbox"
                    checked={selectedGastos.size === gastosMes.length && gastosMes.length > 0}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedGastos(new Set(gastosMes.map(g => g.id)))
                      } else {
                        setSelectedGastos(new Set())
                      }
                    }}
                    className="w-4 h-4 text-indigo-600 rounded border-slate-300 cursor-pointer"
                  />
                </th>
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
                  <td colSpan={8} className="p-8 text-center text-slate-400">Sin gastos</td>
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
                      <input
                        type="checkbox"
                        checked={selectedGastos.has(g.id)}
                        onChange={(e) => {
                          const newSelected = new Set(selectedGastos)
                          if (e.target.checked) {
                            newSelected.add(g.id)
                          } else {
                            newSelected.delete(g.id)
                          }
                          setSelectedGastos(newSelected)
                        }}
                        className="w-4 h-4 text-indigo-600 rounded border-slate-300 cursor-pointer"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </td>
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
          <div className="flex gap-2 items-center flex-wrap">
            {selectedImpuestosGastos.size > 0 && (
              <>
                <div className="flex items-center gap-2">
                  <label className="text-xs font-semibold text-slate-700">Cambiar cuenta:</label>
                  <select
                    onChange={async (e) => {
                      const tarjetaId = e.target.value || null
                      const impuestosSeleccionados = impuestosMes.filter(i => selectedImpuestosGastos.has(i.id))
                      const promises = impuestosSeleccionados.map(i => 
                        updateImpuesto(i.id, { tarjeta_id: tarjetaId })
                      )
                      await Promise.all(promises)
                      setSelectedImpuestosGastos(new Set())
                      e.target.value = ''
                    }}
                    className="input text-xs h-8 min-w-[150px]"
                    defaultValue=""
                  >
                    <option value="">Seleccionar cuenta...</option>
                    <option value="">💵 Efectivo</option>
                    {tarjetas.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.nombre} {t.banco ? `(${t.banco})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={() => {
                    // TODO: Implementar pago masivo de impuestos
                    console.log('🔵 [GastosPage] Pago masivo de impuestos:', Array.from(selectedImpuestosGastos))
                  }}
                  className="btn btn-success text-sm"
                >
                  Pagar {selectedImpuestosGastos.size}
                </button>
                <button
                  onClick={() => {
                    if (confirm(`¿Eliminar ${selectedImpuestosGastos.size} impuesto${selectedImpuestosGastos.size !== 1 ? 's' : ''}?`)) {
                      selectedImpuestosGastos.forEach(id => deleteImpuesto(id))
                      setSelectedImpuestosGastos(new Set())
                    }
                  }}
                  className="btn btn-danger text-sm"
                >
                  Eliminar {selectedImpuestosGastos.size}
                </button>
              </>
            )}
            <button onClick={() => { resetImpForm(); setShowImpModal(true) }} className="btn btn-primary">
              <Plus className="w-4 h-4" /> Agregar
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50">
                <th className="text-left p-4 text-xs font-bold text-slate-500 uppercase">
                  <input
                    type="checkbox"
                    checked={impuestosMes.length > 0 && selectedImpuestosGastos.size === impuestosMes.length}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedImpuestosGastos(new Set(impuestosMes.map(i => i.id)))
                      } else {
                        setSelectedImpuestosGastos(new Set())
                      }
                    }}
                    className="w-4 h-4 text-indigo-600 rounded border-slate-300 cursor-pointer"
                  />
                </th>
                <th className="text-left p-4 text-xs font-bold text-slate-500 uppercase">Concepto</th>
                <th className="text-left p-4 text-xs font-bold text-slate-500 uppercase">Cuenta</th>
                <th className="text-left p-4 text-xs font-bold text-slate-500 uppercase">Monto</th>
                <th className="text-left p-4 text-xs font-bold text-slate-500 uppercase"></th>
              </tr>
            </thead>
            <tbody>
              {impuestosMes.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-400">Sin impuestos</td>
                </tr>
              ) : (
                <>
                  {impuestosMes.map(i => (
                    <tr key={i.id} className={`border-b border-slate-100 hover:bg-slate-50 ${selectedImpuestosGastos.has(i.id) ? 'bg-indigo-50' : ''}`}>
                      <td className="p-4">
                        <input
                          type="checkbox"
                          checked={selectedImpuestosGastos.has(i.id)}
                          onChange={(e) => {
                            const newSelected = new Set(selectedImpuestosGastos)
                            if (e.target.checked) {
                              newSelected.add(i.id)
                            } else {
                              newSelected.delete(i.id)
                            }
                            setSelectedImpuestosGastos(newSelected)
                          }}
                          className="w-4 h-4 text-indigo-600 rounded border-slate-300 cursor-pointer"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </td>
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
                    <td className="p-4 font-bold"></td>
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
              <div className="flex flex-col gap-2 p-3 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg border-2 border-purple-200">
                <div className="flex items-center gap-2">
                  <ImageIcon className="w-5 h-5 text-purple-600" />
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-purple-900">📸 Leer con IA</div>
                    <p className="text-xs text-purple-700">Sube una imagen o PDF de tu comprobante o resumen</p>
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <label className="btn btn-primary cursor-pointer relative btn-sm">
                    {processingImage ? <Loader2 className="w-4 h-4 animate-spin" /> : (<>📷 Foto / Imagen</>)}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleImageUpload}
                      disabled={processingImage}
                    />
                  </label>
                  <label className="btn btn-secondary cursor-pointer relative btn-sm border-2 border-purple-300 text-purple-700 hover:bg-purple-50">
                    {processingImage ? <Loader2 className="w-4 h-4 animate-spin" /> : (<>📄 PDF / Documento</>)}
                    <input
                      type="file"
                      accept="application/pdf,.pdf"
                      className="hidden"
                      onChange={handleImageUpload}
                      disabled={processingImage}
                    />
                  </label>
                </div>
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
                    <div>
                      <input
                        type="text"
                        className="input w-full text-base"
                        placeholder="Ej: Comidas, Transporte, Servicios..."
                        value={newCategoria.nombre}
                        onChange={e => setNewCategoria(c => ({ ...c, nombre: e.target.value }))}
                        autoFocus
                      />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-indigo-900 mb-1.5">Icono</div>
                      <EmojiPickerField
                        value={newCategoria.icono}
                        onChange={v => setNewCategoria(c => ({ ...c, icono: v }))}
                        placeholder="💰"
                        size="sm"
                      />
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
                  <div className="flex gap-2">
                    <select
                      className="input flex-1"
                      value={gastoForm.cuotas}
                      onChange={e => setGastoForm(f => ({ ...f, cuotas: e.target.value }))}
                    >
                      <option value="1">1 (Sin cuotas)</option>
                      <option value="2">2</option>
                      <option value="3">3</option>
                      <option value="4">4</option>
                      <option value="6">6</option>
                      <option value="9">9</option>
                      <option value="12">12</option>
                      <option value="18">18</option>
                      <option value="24">24</option>
                      <option value="36">36</option>
                      <option value="48">48</option>
                      <option value="custom">Otra cantidad...</option>
                    </select>
                    {gastoForm.cuotas === 'custom' && (
                      <input
                        type="number"
                        min="1"
                        max="999"
                        className="input w-24"
                        placeholder="Cantidad"
                        value={gastoForm.cuotas_custom || ''}
                        onChange={e => {
                          const val = e.target.value
                          if (val === '' || (parseInt(val) > 0 && parseInt(val) <= 999)) {
                            setGastoForm(f => ({ ...f, cuotas_custom: val }))
                          }
                        }}
                        onBlur={() => {
                          if (gastoForm.cuotas_custom && parseInt(gastoForm.cuotas_custom) > 0) {
                            setGastoForm(f => ({ ...f, cuotas: gastoForm.cuotas_custom }))
                          }
                        }}
                        autoFocus
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* 4️⃣ MONEDA Y FECHA */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Moneda</label>
                  <select
                    className="input"
                    value={gastoForm.moneda || 'ARS'}
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
                      value={gastoForm.tarjeta_id || ''}
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
          setEditedTotal(null);
          setIncludeTotal(false);
          setDetectedTarjeta(null);
          setSelectedTarjetaId('');
        }}>
          <div className="modal max-w-3xl max-h-[85vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="p-3 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10 shrink-0">
              <h3 className="font-bold text-base flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-indigo-600" />
                <span>
                  {extractedData.total?.tipo_documento === 'resumen_tarjeta' && extractedData.transacciones
                    ? `${extractedData.transacciones.length} transacciones`
                    : extractedData.total?.nombre_sugerido || 'Datos extraídos'}
                </span>
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
                className="p-1.5 hover:bg-slate-100 rounded transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
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
                <div className="space-y-3">
                  {extractedData.total?.tipo_documento === 'resumen_tarjeta' && (
                    <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-2.5">
                      <p className="text-xs text-indigo-800">
                        <strong>{extractedData.transacciones.length} transacciones</strong> detectadas. Selecciona las que deseas agregar.
                      </p>
                    </div>
                  )}

                  {/* Información de tarjeta detectada - Compacto */}
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5">
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      {detectedTarjeta ? '💳 Tarjeta detectada' : '💳 Tarjeta (opcional)'}
                    </label>
                    {detectedTarjeta && (
                      <div className="text-xs text-slate-600 mb-2 space-y-0.5">
                        {detectedTarjeta.banco && <div><strong>Banco:</strong> {detectedTarjeta.banco}</div>}
                        {detectedTarjeta.tipo_tarjeta && <div><strong>Tipo:</strong> {detectedTarjeta.tipo_tarjeta}</div>}
                        {detectedTarjeta.ultimos_digitos && <div><strong>Dígitos:</strong> ****{detectedTarjeta.ultimos_digitos}</div>}
                      </div>
                    )}
                    <div className="relative">
                      <select
                        value={selectedTarjetaId || ''}
                        onChange={(e) => {
                          console.log('🔵 [GastosPage] Tarjeta seleccionada:', e.target.value)
                          const tarjeta = tarjetas.find(t => t.id === e.target.value)
                          console.log('🔵 [GastosPage] Tarjeta encontrada:', tarjeta)
                          setSelectedTarjetaId(e.target.value)
                        }}
                        className="w-full h-8 text-xs font-semibold rounded-lg border-2 px-3 pr-8 cursor-pointer"
                        style={{ 
                          color: 'rgb(15, 23, 42) !important',
                          backgroundColor: 'rgb(224, 242, 254) !important',
                          borderColor: 'rgb(59, 130, 246) !important',
                          WebkitAppearance: 'none',
                          MozAppearance: 'none',
                          appearance: 'none',
                          fontWeight: '600'
                        }}
                      >
                        <option value="" style={{ color: 'rgb(100, 116, 139)', backgroundColor: 'white', fontWeight: '400' }}>
                          {detectedTarjeta ? 'Selecciona o deja vacío' : 'Sin tarjeta (efectivo)'}
                        </option>
                        {tarjetas.map(t => (
                          <option 
                            key={t.id} 
                            value={t.id}
                            style={{ color: 'rgb(15, 23, 42)', backgroundColor: 'white', fontWeight: '600' }}
                          >
                            {t.nombre} {t.banco ? `(${t.banco})` : ''} {t.digitos ? `****${t.digitos}` : ''}
                          </option>
                        ))}
                      </select>
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-blue-600">▼</div>
                    </div>
                  </div>

                  {/* Selector de Fecha/Mes General - Compacto */}
                  <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-2.5">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-semibold text-indigo-900">📅 Fecha General</label>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={useGlobalDate}
                          onChange={(e) => {
                            setUseGlobalDate(e.target.checked)
                            if (e.target.checked && globalDocumentDate) {
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
                        <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                      </label>
                    </div>
                    
                    {useGlobalDate ? (
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="date"
                          value={globalDocumentDate || ''}
                          onChange={(e) => {
                            const newDate = e.target.value
                            setGlobalDocumentDate(newDate)
                            const newEdited = new Map(editedTransactions)
                            extractedData.transacciones.forEach((_: any, index: number) => {
                              if (selectedTransactions.has(index)) {
                                const current = newEdited.get(index) || {}
                                newEdited.set(index, { ...current, fecha: newDate })
                              }
                            })
                            setEditedTransactions(newEdited)
                          }}
                          className="input w-full text-xs h-8 border-indigo-300 focus:border-indigo-500"
                        />
                        <input
                          type="month"
                          value={globalDocumentDate ? globalDocumentDate.substring(0, 7) : ''}
                          onChange={(e) => {
                            const newDate = `${e.target.value}-01`
                            setGlobalDocumentDate(newDate)
                            const newEdited = new Map(editedTransactions)
                            extractedData.transacciones.forEach((_: any, index: number) => {
                              if (selectedTransactions.has(index)) {
                                const current = newEdited.get(index) || {}
                                newEdited.set(index, { ...current, fecha: newDate })
                              }
                            })
                            setEditedTransactions(newEdited)
                          }}
                          className="input w-full text-xs h-8 border-indigo-300 focus:border-indigo-500"
                        />
                      </div>
                    ) : globalDocumentDate && (
                      <p className="text-xs text-indigo-700">
                        Detectada: {new Date(globalDocumentDate).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    )}
                  </div>

                  {/* Lista de Transacciones - Compacta */}
                  {extractedData.total?.tipo_documento === 'resumen_tarjeta' && (
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold text-slate-900 text-xs">
                        Transacciones ({extractedData.transacciones.length})
                      </h4>
                    </div>
                  )}

                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {extractedData.transacciones.map((trans: any, index: number) => {
                      const descripcion = getTransactionValue(index, 'descripcion', trans.descripcion)
                      const monto = getTransactionValue(index, 'monto', trans.monto)
                      const fecha = getTransactionValue(index, 'fecha', trans.fecha)
                      const moneda = getTransactionValue(index, 'moneda', trans.moneda || 'ARS')
                      const cuotas = getTransactionValue(index, 'cuotas', trans.cuotas)
                      
                      return (
                        <div 
                          key={index}
                          className={`border rounded-lg p-2 transition-all ${
                            selectedTransactions.has(index) 
                              ? 'border-indigo-500 bg-indigo-50' 
                              : 'border-slate-200 hover:border-indigo-300 bg-white'
                          }`}
                        >
                          <div className="flex items-start gap-2">
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
                                  if (useGlobalDate && globalDocumentDate) {
                                    const current = editedTransactions.get(index) || {}
                                    updateEditedTransaction(index, 'fecha', globalDocumentDate)
                                  }
                                }
                                setSelectedTransactions(newSelected)
                              }}
                              className="mt-0.5 w-4 h-4 text-indigo-600 rounded border-slate-300 cursor-pointer"
                            />
                            <div className="flex-1 space-y-1.5 min-w-0">
                              <input
                                type="text"
                                value={descripcion || ''}
                                onChange={(e) => {
                                  e.stopPropagation()
                                  updateEditedTransaction(index, 'descripcion', e.target.value)
                                }}
                                className="input w-full text-xs h-7 border-slate-300 focus:border-indigo-500"
                                placeholder="Descripción"
                              />
                              <div className="grid grid-cols-2 gap-2">
                                <input
                                  type="date"
                                  value={fecha || ''}
                                  onChange={(e) => {
                                    e.stopPropagation()
                                    updateEditedTransaction(index, 'fecha', e.target.value)
                                  }}
                                  className="input w-full text-xs h-7 border-slate-300 focus:border-indigo-500"
                                />
                                <div className="flex gap-1">
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={monto || ''}
                                    onChange={(e) => {
                                      e.stopPropagation()
                                      updateEditedTransaction(index, 'monto', parseFloat(e.target.value) || 0)
                                    }}
                                    className="input w-full text-xs h-7 border-slate-300 focus:border-indigo-500"
                                    placeholder="0.00"
                                  />
                                  <div className="relative">
                                    <select
                                      value={moneda || 'ARS'}
                                      onChange={(e) => {
                                        e.stopPropagation()
                                        console.log('🔵 [GastosPage] Moneda cambiada para transacción', index, ':', e.target.value)
                                        updateEditedTransaction(index, 'moneda', e.target.value)
                                      }}
                                      className="w-16 h-7 text-xs font-bold text-center rounded-lg border-2 cursor-pointer pr-6"
                                      style={{ 
                                        color: 'rgb(15, 23, 42) !important',
                                        backgroundColor: 'rgb(255, 237, 213) !important',
                                        borderColor: 'rgb(251, 146, 60) !important',
                                        WebkitAppearance: 'none',
                                        MozAppearance: 'none',
                                        appearance: 'none',
                                        fontWeight: '700'
                                      }}
                                    >
                                      <option value="ARS" style={{ color: 'rgb(15, 23, 42)', backgroundColor: 'white', fontWeight: '700' }}>ARS</option>
                                      <option value="USD" style={{ color: 'rgb(15, 23, 42)', backgroundColor: 'white', fontWeight: '700' }}>USD</option>
                                    </select>
                                    <div className="absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none text-orange-600">▼</div>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="flex items-center gap-1">
                                  <label className="text-xs text-slate-600">Cuotas:</label>
                                  <input
                                    type="number"
                                    min="1"
                                    value={cuotas || 1}
                                    onChange={(e) => {
                                      e.stopPropagation()
                                      const numCuotas = parseInt(e.target.value) || 1
                                      updateEditedTransaction(index, 'cuotas', numCuotas)
                                    }}
                                    className="input w-16 text-xs h-6 border-slate-300 focus:border-indigo-500"
                                    placeholder="1"
                                  />
                                </div>
                                {(() => {
                                  const cuotaActual = getTransactionValue(index, 'cuota_actual', trans.cuota_actual)
                                  const totalCuotas = getTransactionValue(index, 'cuotas', trans.cuotas)
                                  const cuotasRestantes = cuotaActual && totalCuotas && totalCuotas > cuotaActual
                                    ? totalCuotas - cuotaActual + 1
                                    : cuotas
                                  
                                  if (cuotas && cuotas > 1) {
                                    if (cuotaActual && totalCuotas && totalCuotas > cuotaActual) {
                                      return (
                                        <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-xs">
                                          {cuotasRestantes} cuotas restantes (cuotas {cuotaActual} a {totalCuotas} de {totalCuotas})
                                        </span>
                                      )
                                    } else {
                                      return (
                                        <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-xs">
                                          {cuotas} cuotas (se distribuirá en {cuotas} meses)
                                        </span>
                                      )
                                    }
                                  }
                                  return null
                                })()}
                              </div>
                              <div className="flex items-center gap-2 text-xs flex-wrap">
                                {trans.comercio && <span className="text-blue-600">📍 {trans.comercio}</span>}
                                {trans.categoria && <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded">{trans.categoria}</span>}
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Impuestos detectados */}
                  {extractedData.impuestos && Array.isArray(extractedData.impuestos) && extractedData.impuestos.length > 0 && (
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-2.5">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold text-orange-900 text-xs flex items-center gap-2">
                          📝 Impuestos ({extractedData.impuestos.length})
                        </h4>
                      </div>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {extractedData.impuestos.map((imp: any, index: number) => {
                          const descripcion = getImpuestoValue(index, 'descripcion', imp.descripcion)
                          const monto = getImpuestoValue(index, 'monto', imp.monto)
                          const fecha = getImpuestoValue(index, 'fecha', imp.fecha)
                          const moneda = getImpuestoValue(index, 'moneda', imp.moneda || 'ARS')
                          
                          return (
                            <div 
                              key={index}
                              className={`border rounded-lg p-2 transition-colors ${
                                selectedImpuestos.has(index) 
                                  ? 'border-orange-500 bg-orange-100' 
                                  : 'border-orange-200 hover:border-orange-300 bg-white'
                              }`}
                            >
                              <div className="flex items-start gap-2">
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
                                  className="mt-0.5 w-4 h-4 text-orange-600 rounded border-slate-300"
                                />
                                <div className="flex-1 space-y-1.5 min-w-0">
                                  <input
                                    type="text"
                                    value={descripcion || ''}
                                    onChange={(e) => {
                                      e.stopPropagation()
                                      updateEditedImpuesto(index, 'descripcion', e.target.value)
                                    }}
                                    className="input w-full text-xs h-7 border-slate-300 focus:border-orange-500"
                                    placeholder="Descripción"
                                  />
                                  <div className="grid grid-cols-2 gap-2">
                                    <input
                                      type="date"
                                      value={fecha || ''}
                                      onChange={(e) => {
                                        e.stopPropagation()
                                        updateEditedImpuesto(index, 'fecha', e.target.value)
                                      }}
                                      className="input w-full text-xs h-7 border-slate-300 focus:border-orange-500"
                                    />
                                    <div className="flex gap-1">
                                      <input
                                        type="number"
                                        step="0.01"
                                        value={monto || ''}
                                        onChange={(e) => {
                                          e.stopPropagation()
                                          updateEditedImpuesto(index, 'monto', parseFloat(e.target.value) || 0)
                                        }}
                                        className="input w-full text-xs h-7 border-slate-300 focus:border-orange-500"
                                        placeholder="0.00"
                                      />
                                      <div className="relative">
                                        <select
                                          value={moneda}
                                          onChange={(e) => {
                                            e.stopPropagation()
                                            updateEditedImpuesto(index, 'moneda', e.target.value)
                                          }}
                                          className="w-16 h-7 text-xs font-bold text-center rounded-lg border-2 cursor-pointer pr-6"
                                          style={{ 
                                            color: 'rgb(15, 23, 42) !important',
                                            backgroundColor: 'rgb(255, 237, 213) !important',
                                            borderColor: 'rgb(251, 146, 60) !important',
                                            WebkitAppearance: 'none',
                                            MozAppearance: 'none',
                                            appearance: 'none',
                                            fontWeight: '700'
                                          }}
                                        >
                                          <option value="ARS" style={{ color: 'rgb(15, 23, 42)', backgroundColor: 'white', fontWeight: '700' }}>ARS</option>
                                          <option value="USD" style={{ color: 'rgb(15, 23, 42)', backgroundColor: 'white', fontWeight: '700' }}>USD</option>
                                        </select>
                                        <div className="absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none text-orange-600">▼</div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Botones de selección global */}
                  <div className="flex gap-2 pt-2 border-t border-slate-200">
                    <button
                      onClick={() => {
                        const allTransactions = new Set<number>(extractedData.transacciones.map((_: any, i: number) => i))
                        setSelectedTransactions(allTransactions)
                        if (extractedData.impuestos && Array.isArray(extractedData.impuestos)) {
                          const allImpuestos = new Set<number>(extractedData.impuestos.map((_: any, i: number) => i))
                          setSelectedImpuestos(allImpuestos)
                        }
                      }}
                      className="btn btn-secondary text-xs px-3 py-1.5"
                    >
                      Seleccionar todo
                    </button>
                    <button
                      onClick={() => {
                        setSelectedTransactions(new Set())
                        setSelectedImpuestos(new Set())
                      }}
                      className="btn btn-secondary text-xs px-3 py-1.5"
                    >
                      Deseleccionar todo
                    </button>
                  </div>

                  {/* Opción para agregar total */}
                  {extractedData.total && extractedData.total.monto && (
                    <div 
                      className={`border rounded-lg p-2.5 transition-colors ${
                        includeTotal 
                          ? 'border-purple-500 bg-purple-50' 
                          : 'border-slate-200 bg-white'
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <input
                          type="checkbox"
                          checked={includeTotal}
                          onChange={(e) => {
                            setIncludeTotal(e.target.checked)
                          }}
                          className="mt-1 w-4 h-4 text-purple-600 rounded border-slate-300"
                        />
                        <div className="flex-1 space-y-2">
                          <div className="font-semibold text-xs text-slate-900">
                            {extractedData.total.tipo_documento === 'comprobante_unico' 
                              ? (extractedData.total.nombre_sugerido || 'Comprobante')
                              : `Total del resumen ${extractedData.total.periodo ? `- ${extractedData.total.periodo}` : ''}`}
                          </div>
                          
                          {includeTotal && (
                            <div className="space-y-2 pt-1 border-t border-slate-200">
                              <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">
                                  Descripción
                                </label>
                                <input
                                  type="text"
                                  value={editedTotal?.descripcion || (extractedData.total.nombre_sugerido || (extractedData.total.tipo_documento === 'comprobante_unico' 
                                    ? 'Comprobante'
                                    : `Total del resumen - ${extractedData.total.periodo || 'Período'}`))}
                                  onChange={(e) => setEditedTotal(prev => ({ ...(prev || {}), descripcion: e.target.value }))}
                                  onClick={(e) => e.stopPropagation()}
                                  className="input w-full text-xs h-7"
                                  placeholder="Nombre del gasto"
                                />
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                                    Monto
                                  </label>
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={editedTotal?.monto !== undefined ? editedTotal.monto : extractedData.total.monto}
                                    onChange={(e) => setEditedTotal(prev => ({ ...(prev || {}), monto: parseFloat(e.target.value) || 0 }))}
                                    onClick={(e) => e.stopPropagation()}
                                    className="input w-full text-xs h-7"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                                    Moneda
                                  </label>
                                  <select
                                    value={editedTotal?.moneda || extractedData.total.moneda || 'ARS'}
                                    onChange={(e) => setEditedTotal(prev => ({ ...(prev || {}), moneda: e.target.value }))}
                                    onClick={(e) => e.stopPropagation()}
                                    className="input w-full text-xs h-7"
                                  >
                                    <option value="ARS">ARS</option>
                                    <option value="USD">USD</option>
                                  </select>
                                </div>
                              </div>
                              {(extractedData.total.saldo_a_favor_ars || extractedData.total.saldo_a_favor_usd) && (
                                <div className="text-xs text-slate-600 bg-blue-50 p-2 rounded border border-blue-200">
                                  <strong>Saldo a favor detectado:</strong>
                                  {extractedData.total.saldo_a_favor_ars && (
                                    <div>ARS: {formatMoney(extractedData.total.saldo_a_favor_ars)}</div>
                                  )}
                                  {extractedData.total.saldo_a_favor_usd && (
                                    <div>USD: {formatMoney(extractedData.total.saldo_a_favor_usd)}</div>
                                  )}
                                  <div className="mt-1 text-slate-500">
                                    El total mostrado ya considera este descuento.
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                          
                          {!includeTotal && (
                            <div className="text-xs text-slate-600 mt-1">
                              {formatMoney(extractedData.total.monto)} {extractedData.total.moneda || 'ARS'}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

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
              
            </div>
            
            {/* Footer fijo con botón de confirmación */}
            <div className="p-3 border-t border-slate-200 bg-white sticky bottom-0 z-10 shrink-0 flex gap-2">
              <button
                onClick={handleConfirmExtractedData}
                className="btn btn-primary flex-1 text-sm h-9"
                disabled={((extractedData.transacciones && selectedTransactions.size === 0 && !includeTotal && (!extractedData.impuestos || selectedImpuestos.size === 0)) || (!extractedData.transacciones && !includeTotal && (!extractedData.impuestos || selectedImpuestos.size === 0))) || savingTransactions}
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
                className="btn btn-secondary text-sm h-9 px-4"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmación Eliminación Masiva */}
      <ConfirmModal
        isOpen={showDeleteMasivoModal}
        onClose={() => setShowDeleteMasivoModal(false)}
        onConfirm={async () => {
          const promises = Array.from(selectedGastos).map(id => deleteGasto(id))
          await Promise.all(promises)
          setSelectedGastos(new Set())
          setShowDeleteMasivoModal(false)
        }}
        title="Eliminar Gastos Seleccionados"
        message={`¿Estás seguro de que deseas eliminar ${selectedGastos.size} gasto${selectedGastos.size !== 1 ? 's' : ''}?\n\nEsta acción no se puede deshacer.`}
        confirmText="Eliminar"
        cancelText="Cancelar"
        variant="danger"
      />

      {/* Modal Pago Masivo */}
      {showPagoMasivoModal && selectedGastos.size > 0 && (
        <div className="modal-overlay" onClick={() => setShowPagoMasivoModal(false)}>
          <div className="modal max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-emerald-50">
              <h3 className="font-bold text-lg text-emerald-800">
                💳 Registrar Pago Masivo
              </h3>
              <button onClick={() => setShowPagoMasivoModal(false)} className="p-1 hover:bg-emerald-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-sm text-slate-600 mb-2">
                  Se marcarán como pagados <strong>{selectedGastos.size} gastos</strong> con la misma información de pago.
                </p>
                <div className="text-xs text-slate-500">
                  Total: {formatMoney(
                    gastosMes
                      .filter(g => selectedGastos.has(g.id))
                      .reduce((sum, g) => sum + (g.cuotas > 1 ? g.monto / g.cuotas : g.monto), 0)
                  )}
                </div>
              </div>

              <div>
                <label className="label">Fecha de Pago</label>
                <input
                  type="date"
                  className="input"
                  value={pagoMasivoForm.fecha_pago}
                  onChange={e => setPagoMasivoForm(f => ({ ...f, fecha_pago: e.target.value }))}
                />
              </div>

              <div>
                <label className="label">Medio de Pago (opcional)</label>
                <select
                  className="input"
                  value={pagoMasivoForm.medio_pago}
                  onChange={e => setPagoMasivoForm(f => ({ ...f, medio_pago: e.target.value }))}
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
                {pagoMasivoForm.medio_pago === 'nuevo' && (
                  <div className="mt-2">
                    <input
                      type="text"
                      className="input"
                      placeholder="Escribí el nombre del medio de pago..."
                      value={pagoMasivoForm.medio_pago_custom}
                      onChange={e => setPagoMasivoForm(f => ({ ...f, medio_pago_custom: e.target.value }))}
                      autoFocus
                    />
                    <p className="text-xs text-slate-500 mt-1">Por ejemplo: PayPal, Uala, Brubank, etc.</p>
                  </div>
                )}
              </div>

              <div>
                <label className="label">Comprobante (opcional - se usará para todos los gastos)</label>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  className="input"
                  onChange={e => setPagoMasivoForm(f => ({ ...f, comprobante: e.target.files?.[0] || null }))}
                />
                {pagoMasivoForm.comprobante && (
                  <div className="mt-2 text-sm text-emerald-600 font-semibold">
                    ✓ {pagoMasivoForm.comprobante.name}
                  </div>
                )}
                <p className="text-xs text-slate-500 mt-1">
                  El mismo comprobante se asociará a todos los gastos seleccionados.
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleConfirmPagoMasivo}
                  className="btn btn-success flex-1"
                >
                  <CheckCircle2 className="w-4 h-4" /> Confirmar Pago de Todos
                </button>
                <button
                  onClick={() => {
                    setShowPagoMasivoModal(false)
                    setPagoMasivoForm({
                      fecha_pago: new Date().toISOString().split('T')[0],
                      medio_pago: '',
                      comprobante: null,
                      medio_pago_custom: ''
                    })
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
