'use client'

import { useState, useEffect, useRef } from 'react'
import { useData } from '@/hooks/useData'
import { useWorkspace } from '@/hooks/useWorkspace'
import { useAuth } from '@/hooks/useAuth'
import { formatMoney, getMonthName, getMonthFromDateString, parseDateSafe, normalizeAccountName } from '@/lib/utils'
import { Plus, Edit2, Trash2, X, Wallet, Search, Upload, Image as ImageIcon, Loader2, CheckCircle2, Download } from 'lucide-react'
import { Ingreso } from '@/types'
import { ConfirmModal, AlertModal } from '@/components/Modal'
import { EmojiPickerField } from '@/components/EmojiPickerField'
import { MonthYearPicker } from '@/components/MonthYearPicker'
import { DatePicker } from '@/components/DatePicker'
import { TransactionImportConfirmModal } from '@/components/TransactionImportConfirmModal'

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
    notificar_correo: true,
    es_fijo: false
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
  
  // Set global para rastrear categorías que se están creando (evitar duplicados en paralelo)
  const categoriasEnCreacion = useRef<Set<string>>(new Set())
  const categoriasCreadasGlobal = useRef<Map<string, string>>(new Map())
  
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
    notificar_correo: true
  })

  // Función auxiliar para normalizar nombres de categorías (quitar acentos, espacios extra, etc.)
  const normalizeCategoriaName = (name: string): string => {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Quitar acentos
      .replace(/\s+/g, ' ') // Normalizar espacios
      .trim()
  }

  const findCategoriaIdFromLabel = (label?: string) => {
    if (!label) return ''
    const normalized = normalizeCategoriaName(label)
    if (!normalized) return ''
    
    // Buscar coincidencia exacta primero
    const exactMatch = categoriasIngresos.find(
      c => normalizeCategoriaName(c.nombre) === normalized
    )
    if (exactMatch) return exactMatch.id
    
    // Buscar coincidencia parcial (una contiene a la otra)
    const partialMatch = categoriasIngresos.find(c => {
      const catNormalized = normalizeCategoriaName(c.nombre)
      return catNormalized.includes(normalized) || normalized.includes(catNormalized)
    })
    if (partialMatch) return partialMatch.id
    
    // Buscar palabras clave comunes (si una categoría tiene palabras clave de otra)
    const words = normalized.split(/\s+/).filter(w => w.length > 2) // Palabras de más de 2 caracteres
    if (words.length > 0) {
      const keywordMatch = categoriasIngresos.find(c => {
        const catNormalized = normalizeCategoriaName(c.nombre)
        const catWords = catNormalized.split(/\s+/).filter(w => w.length > 2)
        // Si comparten al menos una palabra clave importante
        return words.some(w => catWords.includes(w)) || catWords.some(w => words.includes(w))
      })
      if (keywordMatch) return keywordMatch.id
    }
    
    return ''
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
    // Priorizar accountSuggestion (nuevo formato) sobre tarjeta (formato antiguo)
    const accountSuggestion = t?.accountSuggestion || t
    
    // Si tiene nombre directo, normalizarlo y usarlo
    if (accountSuggestion?.nombre) {
      return normalizeAccountName(String(accountSuggestion.nombre).trim())
    }
    
    // Construir nombre desde componentes
    const banco = accountSuggestion?.banco ? String(accountSuggestion.banco).trim() : ''
    const tipo = accountSuggestion?.tipo_tarjeta || accountSuggestion?.tipo ? 
      String(accountSuggestion.tipo_tarjeta || accountSuggestion.tipo).trim() : ''
    const ultimosDigitos = accountSuggestion?.ultimosDigitos || accountSuggestion?.ultimos_digitos ? 
      String(accountSuggestion.ultimosDigitos || accountSuggestion.ultimos_digitos).trim() : ''
    
    // Construir nombre inteligente
    const parts: string[] = []
    if (tipo) {
      // Normalizar tipo (reemplazar "creditcard" por español, etc.)
      const tipoNormalized = normalizeAccountName(tipo)
      // Capitalizar tipo
      const tipoCapitalized = tipoNormalized.charAt(0).toUpperCase() + tipoNormalized.slice(1).toLowerCase()
      parts.push(tipoCapitalized)
    }
    if (banco) parts.push(banco)
    if (ultimosDigitos) parts.push(`****${ultimosDigitos}`)
    
    const builtName = parts.length > 0 ? parts.join(' ') : 'Nueva cuenta/tarjeta'
    return normalizeAccountName(builtName)
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
  const ensureCategoriaExists = async (categoriaLabel: string, categoriaIcono?: string): Promise<string | null> => {
    if (!categoriaLabel) return null
    
    const normalizedLabel = normalizeCategoriaName(categoriaLabel)
    
    // 1. Verificar en el mapa global de categorías ya creadas en esta sesión
    const categoriasCreadasArray = Array.from(categoriasCreadasGlobal.current.entries())
    for (let i = 0; i < categoriasCreadasArray.length; i++) {
      const [mapLabel, mapId] = categoriasCreadasArray[i]
      const mapNormalized = normalizeCategoriaName(mapLabel)
      if (mapNormalized === normalizedLabel || 
          mapNormalized.includes(normalizedLabel) || 
          normalizedLabel.includes(mapNormalized)) {
        console.log('✅ [Ingresos] Categoría encontrada en mapa global:', categoriaLabel, '→', mapId, '(similar a:', mapLabel, ')')
        return mapId
      }
    }
    
    // 2. Verificar si se está creando actualmente (evitar race conditions)
    if (categoriasEnCreacion.current.has(normalizedLabel)) {
      console.log('⏳ [Ingresos] Categoría en proceso de creación, esperando...', categoriaLabel)
      // Esperar hasta que se complete la creación
      let attempts = 0
      while (categoriasEnCreacion.current.has(normalizedLabel) && attempts < 50) {
        await new Promise(resolve => setTimeout(resolve, 100))
        attempts++
        // Verificar si ya se creó mientras esperábamos
        const categoriasCreadasArray2 = Array.from(categoriasCreadasGlobal.current.entries())
        for (let j = 0; j < categoriasCreadasArray2.length; j++) {
          const [mapLabel, mapId] = categoriasCreadasArray2[j]
          const mapNormalized = normalizeCategoriaName(mapLabel)
          if (mapNormalized === normalizedLabel || 
              mapNormalized.includes(normalizedLabel) || 
              normalizedLabel.includes(mapNormalized)) {
            console.log('✅ [Ingresos] Categoría encontrada después de esperar:', categoriaLabel, '→', mapId)
            return mapId
          }
        }
      }
    }
    
    // 3. Buscar si ya existe en la base de datos
    const existingId = findCategoriaIdFromLabel(categoriaLabel)
    if (existingId) {
      console.log('✅ [Ingresos] Categoría ya existe en BD:', categoriaLabel, '→', existingId)
      // Guardar en el mapa global para futuras referencias
      categoriasCreadasGlobal.current.set(categoriaLabel, existingId)
      return existingId
    }
    
    // Mapeo de iconos por tipo de categoría (si no viene de la IA)
    const iconoMap: Record<string, string> = {
      'salario': '💰',
      'trabajo freelance': '💼',
      'freelance': '💼',
      'inversiones': '📈',
      'alquiler': '🏠',
      'venta': '💵',
      'reembolso': '🔄',
      'intereses bancarios': '🏦',
      'intereses': '🏦',
      'transferencia personal': '👤',
      'transferencia': '👤',
      'pago recibido': '✅',
      'pago': '✅',
      'beneficio bancario': '🎁',
      'beneficio': '🎁'
    }
    
    // Determinar el icono a usar
    let iconoFinal = categoriaIcono || '💵' // Usar el icono de la IA si está disponible
    if (!categoriaIcono) {
      // Si no hay icono de la IA, buscar en el mapa
      const categoriaLower = categoriaLabel.toLowerCase()
      for (const [key, icono] of Object.entries(iconoMap)) {
        if (categoriaLower.includes(key)) {
          iconoFinal = icono
          break
        }
      }
    }
    
    // 4. Marcar como en proceso de creación (evitar duplicados en paralelo)
    categoriasEnCreacion.current.add(normalizedLabel)
    
    try {
      // Crear automáticamente
      console.log('🔵 [Ingresos] Creando categoría automáticamente:', categoriaLabel, 'con icono:', iconoFinal)
      const { error, id } = await addCategoriaIngreso({
        nombre: categoriaLabel.trim(),
        icono: iconoFinal,
        color: '#10b981' // Color verde por defecto para ingresos
      })
      
      if (error) {
        console.error('❌ [Ingresos] Error creando categoría automáticamente:', error)
        categoriasEnCreacion.current.delete(normalizedLabel)
        return null
      }
      
      let finalId = id
      
      // Si no devuelve ID, esperar y buscar
      if (!finalId) {
        await new Promise(resolve => setTimeout(resolve, 1500))
        finalId = findCategoriaIdFromLabel(categoriaLabel)
      }
      
      if (finalId) {
        console.log('✅ [Ingresos] Categoría creada con ID:', categoriaLabel, '→', finalId)
        // Guardar en el mapa global para futuras referencias
        categoriasCreadasGlobal.current.set(categoriaLabel, finalId)
        categoriasEnCreacion.current.delete(normalizedLabel)
        return finalId
      }
      
      console.warn('⚠️ [Ingresos] Categoría creada pero no encontrada después de esperar:', categoriaLabel)
      categoriasEnCreacion.current.delete(normalizedLabel)
      return null
    } catch (error) {
      console.error('❌ [Ingresos] Error inesperado creando categoría:', error)
      categoriasEnCreacion.current.delete(normalizedLabel)
      return null
    }
  }

  // Función para crear automáticamente cuenta/tarjeta si no existe
  // Si se pasa aiNewCuentaData, usa esos datos (modificados por el usuario) en lugar de cuentaData
  const ensureCuentaExists = async (cuentaData: any, aiNewCuentaData?: { nombre: string; tipo: 'visa' | 'mastercard' | 'amex' | 'other'; banco: string; digitos: string }): Promise<string | null> => {
    // Si se pasan datos modificados por el usuario, usarlos directamente
    if (aiNewCuentaData && aiNewCuentaData.nombre) {
      const nombreCuenta = aiNewCuentaData.nombre.trim()
      if (!nombreCuenta) return null
      
      // Buscar si ya existe con ese nombre exacto
      const existing = tarjetas.find(t => 
        t.nombre.toLowerCase() === nombreCuenta.toLowerCase()
      )
      
      if (existing) {
        console.log('✅ [Ingresos] Cuenta existente encontrada:', existing.nombre, '→', existing.id)
        return existing.id
      }
      
      // Crear con los datos del usuario
      console.log('🔵 [Ingresos] Creando cuenta con datos del usuario:', nombreCuenta)
      const result = await addTarjeta({
        nombre: nombreCuenta,
        tipo: aiNewCuentaData.tipo,
        banco: aiNewCuentaData.banco || null,
        digitos: aiNewCuentaData.digitos || null,
        cierre: null
      })
      
      if (result.error) {
        console.error('❌ [Ingresos] Error creando cuenta automáticamente:', result.error)
        return null
      }
      
      console.log('✅ [Ingresos] Cuenta creada con ID:', nombreCuenta, '→', result.id)
      return result.id || null
    }
    
    // Lógica original: usar cuentaData detectada
    if (!cuentaData) return null
    
    // Priorizar accountSuggestion (nuevo formato) sobre tarjeta (formato antiguo)
    const accountSuggestion = cuentaData?.accountSuggestion || cuentaData
    
    // Validar que tenga información suficiente
    if (!accountSuggestion.nombre && !accountSuggestion.banco && !accountSuggestion.tipo && !accountSuggestion.tipo_tarjeta) {
      return null
    }
    
    const nombreCuenta = buildDetectedCuentaName(cuentaData)
    
    // Buscar si ya existe (por nombre, banco, o últimos dígitos)
    const ultimosDigitos = accountSuggestion?.ultimosDigitos || accountSuggestion?.ultimos_digitos
    const banco = accountSuggestion?.banco
    
    const existing = tarjetas.find(t => {
      // Buscar por nombre
      if (t.nombre.toLowerCase().includes(nombreCuenta.toLowerCase()) ||
          nombreCuenta.toLowerCase().includes(t.nombre.toLowerCase())) {
        return true
      }
      // Buscar por banco y últimos dígitos
      if (banco && t.banco && t.banco.toLowerCase() === banco.toLowerCase()) {
        if (ultimosDigitos && t.digitos && t.digitos.includes(ultimosDigitos)) {
          return true
        }
        // Si no hay últimos dígitos pero el banco coincide y el nombre es similar
        if (!ultimosDigitos && !t.digitos) {
          return true
        }
      }
      return false
    })
    
    if (existing) {
      console.log('✅ [Ingresos] Cuenta existente encontrada:', existing.nombre, '→', existing.id)
      return existing.id
    }
    
    // Determinar tipo de tarjeta
    const tipoStr = (accountSuggestion?.tipo || accountSuggestion?.tipo_tarjeta || '').toLowerCase()
    let tipo: 'visa' | 'mastercard' | 'amex' | 'other' = 'other'
    if (tipoStr.includes('visa')) {
      tipo = 'visa'
    } else if (tipoStr.includes('master')) {
      tipo = 'mastercard'
    } else if (tipoStr.includes('amex') || tipoStr.includes('american')) {
      tipo = 'amex'
    } else if (tipoStr === 'tarjeta') {
      tipo = 'other' // Tarjeta genérica
    } else if (tipoStr === 'cuenta') {
      tipo = 'other' // Cuenta bancaria
    }
    
    // Extraer fechas de vencimiento y cierre del resumen
    const tarjetaData = cuentaData?.tarjeta || {}
    const fechaCierre = tarjetaData.fecha_cierre || null
    const fechaVencimiento = tarjetaData.fecha_vencimiento || null
    
    // Crear automáticamente
    console.log('🔵 [Ingresos] Creando cuenta automáticamente:', nombreCuenta, 'con cierre:', fechaCierre, 'vencimiento:', fechaVencimiento)
    const result = await addTarjeta({
      nombre: nombreCuenta,
      tipo: tipo,
      banco: banco || null,
      digitos: ultimosDigitos || null,
      cierre: fechaCierre ? parseInt(String(fechaCierre)) : null,
      vencimiento: fechaVencimiento ? parseInt(String(fechaVencimiento)) : null
    })
    
    if (result.error) {
      console.error('❌ [Ingresos] Error creando cuenta automáticamente:', result.error)
      return null
    }
    
    console.log('✅ [Ingresos] Cuenta creada con ID:', nombreCuenta, '→', result.id)
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
  
  // Estado para modal de confirmación de importación
  const [showImportConfirmModal, setShowImportConfirmModal] = useState(false)

  // Pre-llenar automáticamente los campos de cuenta cuando se detecta una cuenta
  useEffect(() => {
    if (detectedCuenta && selectedCuentaId === '__new_suggested__') {
      const nombreSugerido = buildDetectedCuentaName(detectedCuenta)
      const tipoStr = (detectedCuenta?.tipo || detectedCuenta?.tipo_tarjeta || '').toLowerCase()
      let tipo: 'visa' | 'mastercard' | 'amex' | 'other' = 'other'
      if (tipoStr.includes('visa')) tipo = 'visa'
      else if (tipoStr.includes('master')) tipo = 'mastercard'
      else if (tipoStr.includes('amex') || tipoStr.includes('american')) tipo = 'amex'
      
      setAiNewCuenta({
        nombre: nombreSugerido,
        tipo: tipo,
        banco: detectedCuenta?.banco || '',
        digitos: detectedCuenta?.ultimosDigitos || detectedCuenta?.ultimos_digitos || ''
      })
    }
  }, [detectedCuenta, selectedCuentaId])

  let ingresosMes = getIngresosMes(monthKey)

  // Create lookup maps for categorias
  const categoriaMap = Object.fromEntries(categoriasIngresos.map(c => [c.id, c]))

  // Función para obtener el nombre del usuario que creó el ingreso
  const getUserLabel = (userId: string) => {
    if (!currentWorkspace) return null; // No mostrar en modo personal
    if (userId === user?.uid) return 'Tú'; // Si soy yo
    if (userId === currentWorkspace.owner_id) return 'Propietario';
    
    const member = members.find(m => m.user_id === userId && m.workspace_id === currentWorkspace.id);
    // Usar display_name si existe, sino usar email (antes del @) o "Desconocido"
    return member ? (member.display_name || member.user_email.split('@')[0]) : 'Desconocido';
  }

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
      notificar_correo: true,
      es_fijo: false
    })
  }

  const openEdit = (ingreso: Ingreso) => {
    console.log('🔵 [Ingresos] Abriendo edición de ingreso:', {
      id: ingreso.id,
      pendiente_cobro_raw: (ingreso as any).pendiente_cobro,
      pendiente_cobro_type: typeof (ingreso as any).pendiente_cobro,
      fecha_cobro_esperada: (ingreso as any).fecha_cobro_esperada,
      fecha_cobro_confirmada: (ingreso as any).fecha_cobro_confirmada
    })
    
    const pendienteCobroValue = (ingreso as any).pendiente_cobro === true || (typeof (ingreso as any).pendiente_cobro === 'string' && (ingreso as any).pendiente_cobro === 'true') || (typeof (ingreso as any).pendiente_cobro === 'number' && (ingreso as any).pendiente_cobro === 1)
    
    console.log('🔵 [Ingresos] Valor procesado de pendiente_cobro:', pendienteCobroValue)
    
    setEditing(ingreso)
    setForm({
      descripcion: ingreso.descripcion,
      categoria_id: ingreso.categoria_id || '',
      monto: String(ingreso.monto),
      moneda: ingreso.moneda,
      fecha: ingreso.fecha,
      tag_ids: ingreso.tag_ids || [],
      pendiente_cobro: pendienteCobroValue,
      fecha_cobro_esperada: (ingreso as any).fecha_cobro_esperada || null,
      cuenta_bancaria_id: (ingreso as any).cuenta_bancaria_id || null,
      comprobante: null, // No pre-cargar archivo
      notificar_correo: (ingreso as any).notificar_correo !== undefined ? (ingreso as any).notificar_correo : true,
      es_fijo: (ingreso as any).es_fijo === true
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

    // Calcular mes de forma segura sin problemas de timezone
    const mes = getMonthFromDateString(form.fecha)

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

    const pendienteCobroBoolean = form.pendiente_cobro === true
    
    console.log('🔵 [Ingresos] Preparando datos para guardar:', {
      form_pendiente_cobro: form.pendiente_cobro,
      form_pendiente_cobro_type: typeof form.pendiente_cobro,
      pendienteCobroBoolean: pendienteCobroBoolean,
      fecha_cobro_esperada: form.fecha_cobro_esperada
    })
    
    const data: any = {
      descripcion: form.descripcion,
      categoria_id: form.categoria_id || null,
      monto: parseFloat(form.monto),
      moneda: form.moneda,
      fecha: form.fecha,
      mes: mes,
      tag_ids: form.tag_ids,
      pendiente_cobro: pendienteCobroBoolean, // Asegurar que sea boolean
      fecha_cobro_esperada: form.fecha_cobro_esperada || null,
      cuenta_bancaria_id: form.cuenta_bancaria_id || null,
      comprobante_url: comprobanteUrl,
      comprobante_nombre: comprobanteNombre,
      notificar_correo: form.notificar_correo !== undefined ? form.notificar_correo : (pendienteCobroBoolean ? true : false),
      es_fijo: form.es_fijo === true
    }

    // Manejar fecha_cobro_confirmada según el estado de pendiente_cobro
    if (pendienteCobroBoolean) {
      // Si está marcado como pendiente, fecha_cobro_confirmada debe ser null
      data.fecha_cobro_confirmada = null
      console.log('🔵 [Ingresos] Ingreso marcado como PENDIENTE - fecha_cobro_confirmada será null')
    } else {
      // Si NO está pendiente, confirmar automáticamente con la fecha del ingreso
      data.fecha_cobro_confirmada = form.fecha
      console.log('🔵 [Ingresos] Ingreso NO pendiente - fecha_cobro_confirmada será:', form.fecha)
    }
    
    console.log('🔵 [Ingresos] Datos finales a guardar:', {
      ...data,
      pendiente_cobro_type: typeof data.pendiente_cobro,
      pendiente_cobro_value: data.pendiente_cobro,
      fecha_cobro_confirmada: data.fecha_cobro_confirmada
    })

    try {
      if (editing) {
        // Actualizar el ingreso (si es fijo, los cambios se reflejan automáticamente en todos los meses futuros)
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
        // Crear el ingreso (si es fijo, aparecerá automáticamente en meses futuros)
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

  const toggleFijo = async (ingreso: Ingreso) => {
    // Igual que gastos: solo actualizar el campo es_fijo
    // El ingreso aparecerá automáticamente en meses futuros gracias a getIngresosMes
    await updateIngreso(ingreso.id, { es_fijo: !(ingreso as any).es_fijo })
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
          // Usar día 10 del mes para evitar problemas de timezone
          const fechaResumen = `${mesResumen}-10`
          console.log('🔵 [Ingresos] Fecha detectada desde mes_resumen:', mesResumen, '→', fechaResumen)
          setGlobalDocumentDate(fechaResumen)
          setUseGlobalDate(true)
        } else if (result.data?.transacciones && result.data.transacciones.length > 0) {
          const firstDate = result.data.transacciones[0]?.fecha
          if (firstDate) {
            // Si hay fecha, usar el día 10 de ese mes (parsear de forma segura)
            const mesResumen = getMonthFromDateString(firstDate)
            setGlobalDocumentDate(`${mesResumen}-10`)
            setUseGlobalDate(true)
          } else {
            // Si no hay fecha, usar el día 10 del mes actual
            const hoy = new Date()
            const mesActual = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`
            setGlobalDocumentDate(`${mesActual}-10`)
            setUseGlobalDate(false)
          }
        } else {
          // Si no hay transacciones, usar el día 10 del mes actual
          const hoy = new Date()
          const mesActual = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`
          setGlobalDocumentDate(`${mesActual}-10`)
          setUseGlobalDate(false)
        }

        // Si hay información de cuenta/tarjeta detectada, configurarla
        // Priorizar accountSuggestion (nuevo formato) sobre tarjeta (formato antiguo)
        const accountInfo = result.data?.accountSuggestion || result.data?.tarjeta
        if (accountInfo) {
          setDetectedCuenta(accountInfo)
          // Intentar encontrar cuenta existente
          const nombreDetectado = buildDetectedCuentaName(accountInfo)
          const ultimosDigitos = accountInfo?.ultimosDigitos || accountInfo?.ultimos_digitos
          const banco = accountInfo?.banco
          
          const existing = tarjetas.find(t => {
            // Buscar por nombre
            if (t.nombre.toLowerCase().includes(nombreDetectado.toLowerCase()) ||
                nombreDetectado.toLowerCase().includes(t.nombre.toLowerCase())) {
              return true
            }
            // Buscar por banco y últimos dígitos
            if (banco && t.banco && t.banco.toLowerCase() === banco.toLowerCase()) {
              if (ultimosDigitos && t.digitos && t.digitos.includes(ultimosDigitos)) {
                return true
              }
              // Si no hay últimos dígitos pero el banco coincide
              if (!ultimosDigitos && !t.digitos) {
                return true
              }
            }
            return false
          })
          
          if (existing) {
            console.log('✅ [Ingresos] Cuenta existente encontrada y preseleccionada:', existing.nombre)
            setSelectedCuentaId(existing.id)
          } else {
            // Si no existe, preseleccionar opción de crear nueva
            setSelectedCuentaId('__new_suggested__')
            // Pre-llenar automáticamente los campos
            const nombreSugerido = buildDetectedCuentaName(accountInfo)
            const tipoStr = (accountInfo?.tipo || accountInfo?.tipo_tarjeta || '').toLowerCase()
            let tipo: 'visa' | 'mastercard' | 'amex' | 'other' = 'other'
            if (tipoStr.includes('visa')) tipo = 'visa'
            else if (tipoStr.includes('master')) tipo = 'mastercard'
            else if (tipoStr.includes('amex') || tipoStr.includes('american')) tipo = 'amex'
            
            setAiNewCuenta({
              nombre: nombreSugerido,
              tipo: tipo,
              banco: accountInfo?.banco || '',
              digitos: accountInfo?.ultimosDigitos || accountInfo?.ultimos_digitos || ''
            })
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

      // Crear cuenta/tarjeta automáticamente si fue detectada y se seleccionó crear nueva sugerida
      let cuentaIdToUse = selectedCuentaId || null
      
      // Si se seleccionó crear nueva sugerida, crear la cuenta automáticamente
      // Usar los datos modificados por el usuario (aiNewCuenta) si están disponibles
      if (selectedCuentaId === '__new_suggested__' && detectedCuenta) {
        console.log('🔵 [Ingresos] Creando cuenta sugerida automáticamente con datos del usuario...')
        try {
          cuentaIdToUse = await ensureCuentaExists(detectedCuenta, aiNewCuenta)
          if (cuentaIdToUse) {
            console.log('✅ [Ingresos] Cuenta sugerida creada con ID:', cuentaIdToUse)
            setSelectedCuentaId(cuentaIdToUse)
          } else {
            console.warn('⚠️ [Ingresos] No se pudo crear la cuenta sugerida')
            setSavingTransactions(false)
            setAlertData({
              title: 'Error',
              message: 'Error al crear la cuenta sugerida. Por favor, intenta nuevamente o selecciona otra cuenta.',
              variant: 'error'
            })
            setShowAlert(true)
            return
          }
        } catch (error: any) {
          console.error('❌ [Ingresos] Error creando cuenta:', error)
          setSavingTransactions(false)
          setAlertData({
            title: 'Error',
            message: `Error al crear la cuenta: ${error.message || 'Error desconocido'}`,
            variant: 'error'
          })
          setShowAlert(true)
          return
        }
      } else if (detectedCuenta && !cuentaIdToUse) {
        // Fallback: si hay cuenta detectada pero no se seleccionó nada, intentar crear automáticamente
        try {
          cuentaIdToUse = await ensureCuentaExists(detectedCuenta)
          if (cuentaIdToUse) {
            setSelectedCuentaId(cuentaIdToUse)
          }
        } catch (error: any) {
          console.error('❌ [Ingresos] Error creando cuenta (fallback):', error)
          // Continuar sin cuenta si falla el fallback
        }
      }

      // Usar el mapa global para evitar crear categorías duplicadas
      // El mapa global ya está inicializado arriba con useRef

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
          const categoriaIcono = (trans as any).categoria_icono || undefined
          
          // Normalizar el nombre para buscar en el mapa
          const normalizedLabel = normalizeCategoriaName(categoriaLabel)
          
          // ensureCategoriaExists ya maneja el mapa global y evita duplicados
          categoriaId = (await ensureCategoriaExists(categoriaLabel, categoriaIcono)) || ''
          if (!categoriaId) {
            console.warn('⚠️ [Ingresos] No se pudo crear/obtener categoría:', categoriaLabel)
          }
        } else if (form.categoria_id && form.categoria_id !== '__new__') {
          categoriaId = form.categoria_id
        }

        // Usar fecha global del mes del resumen si está disponible, sino usar la fecha de la transacción o del formulario
        let fecha = (useGlobalDate && globalDocumentDate) ? globalDocumentDate : (edited.fecha || trans.fecha || form.fecha)
        
        // Si se usa fecha global, asegurar que sea el día 10 del mes seleccionado
        if (useGlobalDate && globalDocumentDate) {
          // globalDocumentDate ya debería ser YYYY-MM-10, pero asegurémonos
          const [year, month] = globalDocumentDate.split('-')
          fecha = `${year}-${month}-10`
        }
        
        // Calcular mes de forma segura sin problemas de timezone
        const mes = getMonthFromDateString(fecha)
        const tagIds = Array.isArray(edited.tag_ids) ? edited.tag_ids : (Array.isArray(trans.tag_ids) ? trans.tag_ids : (form.tag_ids || []))
        
        // Determinar si está pendiente de cobro (desde ediciones o por defecto false)
        // Asegurar que sea boolean explícitamente
        const pendienteCobro = edited.pendiente_cobro === true || (typeof edited.pendiente_cobro === 'string' && edited.pendiente_cobro === 'true') || (typeof edited.pendiente_cobro === 'number' && edited.pendiente_cobro === 1)
        console.log('🔵 [Ingresos] Verificando pendiente_cobro desde IA:', {
          edited_pendiente_cobro: edited.pendiente_cobro,
          edited_pendiente_cobro_type: typeof edited.pendiente_cobro,
          pendienteCobro_result: pendienteCobro,
          fecha_cobro_esperada: edited.fecha_cobro_esperada,
          notificar_correo: edited.notificar_correo
        })
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
        
        const ingresoData = {
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
          // Ingresos creados por IA deben ser normales sin estado visible (sin fecha_cobro_confirmada)
          // Solo se establece fecha_cobro_confirmada cuando el usuario explícitamente confirma un pendiente
          fecha_cobro_confirmada: null,
          notificar_correo: edited.notificar_correo !== undefined ? edited.notificar_correo : (pendienteCobro ? true : false) // Notificar solo si está pendiente
        }
        
        console.log('🔵 [Ingresos] Agregando ingreso con datos:', {
          ...ingresoData,
          categoria_sugerida: trans.categoria,
          notificacion: notificacionInfo,
          pendiente_cobro_type: typeof pendienteCobro,
          pendiente_cobro_value: pendienteCobro
        })
        
        const { error } = await addIngreso(ingresoData)
        
        if (error) {
          console.error('❌ [Ingresos] Error al agregar ingreso desde IA:', error)
          throw error
        } else {
          console.log('✅ [Ingresos] Ingreso agregado exitosamente:', {
            descripcion: ingresoData.descripcion,
            pendiente_cobro: ingresoData.pendiente_cobro
          })
        }

        // Ya se maneja arriba
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
            fecha_cobro_confirmada: null // Ingresos creados por IA deben ser normales sin estado visible
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
      <div className="card p-3 sm:p-4 bg-slate-50 border-b border-slate-200">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-3">
          <div className="relative col-span-2 sm:col-span-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar..."
              className="input pl-9 w-full"
              value={filters.search}
              onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
            />
          </div>
          <select
            className="input w-full"
            value={filters.moneda}
            onChange={e => setFilters(f => ({ ...f, moneda: e.target.value }))}
          >
            <option value="">Moneda</option>
            <option value="ARS">ARS</option>
            <option value="USD">USD</option>
          </select>
          <select
            className="input w-full"
            value={filters.categoria}
            onChange={e => setFilters(f => ({ ...f, categoria: e.target.value }))}
          >
            <option value="">Categoría</option>
            {categoriasIngresos.map(c => (
              <option key={c.id} value={c.id}>
                {c.icono} {c.nombre}
              </option>
            ))}
          </select>
          <select
            className="input w-full"
            value={filters.tag}
            onChange={e => setFilters(f => ({ ...f, tag: e.target.value }))}
          >
            <option value="">Tag</option>
            {tagsIngresos.map(t => (
              <option key={t.id} value={t.id}>
                {t.nombre}
              </option>
            ))}
          </select>
          <select
            className="input w-full"
            value={filters.cuenta}
            onChange={e => setFilters(f => ({ ...f, cuenta: e.target.value }))}
          >
            <option value="">Cuenta</option>
            {tarjetas.map(t => (
              <option key={t.id} value={t.id}>
                {t.nombre}
              </option>
            ))}
          </select>
          <select
            className="input w-full"
            value={filters.pendiente}
            onChange={e => setFilters(f => ({ ...f, pendiente: e.target.value }))}
          >
            <option value="">Estado</option>
            <option value="si">Pendientes</option>
            <option value="no">Confirmados</option>
          </select>
          <select
            className="input w-full col-span-2 sm:col-span-1"
            value={filters.sort}
            onChange={e => setFilters(f => ({ ...f, sort: e.target.value }))}
          >
            <option value="monto-desc">Mayor a menor</option>
            <option value="monto-asc">Menor a mayor</option>
            <option value="fecha-desc">Más recientes</option>
            <option value="fecha-asc">Más antiguos</option>
            <option value="descripcion-asc">A-Z</option>
            <option value="descripcion-desc">Z-A</option>
          </select>
          {currentWorkspace && members.length > 0 && (
            <select
              className="input w-full"
              value={filters.colaborador}
              onChange={e => setFilters(f => ({ ...f, colaborador: e.target.value }))}
            >
              <option value="">Colaborador</option>
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
                <th className="text-left p-3 sm:p-4 font-semibold text-slate-700 w-12">
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
                <th className="text-left p-3 sm:p-4 font-semibold text-slate-700 min-w-[200px]">Descripción</th>
                <th className="text-left p-3 sm:p-4 font-semibold text-slate-700 hidden sm:table-cell min-w-[120px]">Cuenta</th>
                <th className="text-left p-3 sm:p-4 font-semibold text-slate-700 hidden md:table-cell">Fecha</th>
                <th className="text-right p-3 sm:p-4 font-semibold text-slate-700 whitespace-nowrap">Monto</th>
                <th className="text-left p-3 sm:p-4 font-semibold text-slate-700 hidden lg:table-cell">Estado</th>
                <th className="text-left p-3 sm:p-4 font-semibold text-slate-700 hidden lg:table-cell">Fijo</th>
                <th className="text-right p-3 sm:p-4 font-semibold text-slate-700">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {ingresosMes.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center p-12">
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
                const cuenta = tarjetas.find(t => t.id === (ingreso as any).cuenta_bancaria_id)
                const authorLabel = getUserLabel(ingreso.user_id)
                return (
                  <tr key={ingreso.id} className="border-b border-slate-100 hover:bg-slate-50 transition">
                    <td className="p-3 sm:p-4">
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
                    <td className="p-3 sm:p-4">
                      <div className="flex items-center gap-2 sm:gap-3">
                        <div className="w-8 h-8 sm:w-9 sm:h-9 bg-slate-100 rounded-lg flex items-center justify-center text-base sm:text-lg flex-shrink-0">
                          {categoriaMap[ingreso.categoria_id || '']?.icono || '💰'}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-sm sm:text-base">{ingreso.descripcion}</div>
                          
                          {/* ETIQUETA DE AUTOR */}
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

                          <div className="text-xs text-slate-500">
                            {categoriaMap[ingreso.categoria_id || '']?.nombre || 'Sin categoría'}
                            {(ingreso as any).es_fijo && ' 📌'}
                            {/* Mostrar cuenta en móvil si está oculta */}
                            <span className="sm:hidden ml-2">
                              {cuenta ? (
                                <span className="text-xs">{normalizeAccountName(cuenta.nombre)}</span>
                              ) : (
                                <span className="text-xs">-</span>
                              )}
                            </span>
                            {/* Mostrar fecha en móvil si está oculta */}
                            <span className="md:hidden ml-2">
                              {new Date(ingreso.fecha).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}
                            </span>
                            {/* Mostrar estado en móvil si está oculta */}
                            <span className="lg:hidden ml-2">
                              {(ingreso as any).pendiente_cobro && !(ingreso as any).fecha_cobro_confirmada ? (
                                <span className="text-xs text-amber-600">⏳ Pendiente</span>
                              ) : (ingreso as any).fecha_cobro_confirmada ? (
                                <span className="text-xs text-emerald-600">✓ Confirmado</span>
                              ) : null}
                            </span>
                          </div>
                          {ingreso.tag_ids && ingreso.tag_ids.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {ingreso.tag_ids.map(tagId => {
                                const tag = tagsIngresos.find(t => t.id === tagId)
                                return tag ? (
                                  <span key={tagId} className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full text-xs font-semibold">
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
                        </div>
                      </div>
                    </td>
                    <td className="p-3 sm:p-4 hidden sm:table-cell">
                      {cuenta ? (
                        <div>
                          <span className="inline-flex items-center gap-1 text-sm text-slate-600 font-medium">
                            {normalizeAccountName(cuenta.nombre)}
                          </span>
                          <div className="text-xs text-slate-500 mt-1">
                            {cuenta.banco && <span>{cuenta.banco}</span>}
                            {cuenta.digitos && (
                              <span>{cuenta.banco ? ' • ' : ''}****{cuenta.digitos}</span>
                            )}
                            {(cuenta.cierre || cuenta.vencimiento) && (
                              <span className="block mt-0.5">
                                {cuenta.cierre && `Cierre: día ${cuenta.cierre}`}
                                {cuenta.cierre && cuenta.vencimiento && ' • '}
                                {cuenta.vencimiento && `Venc: día ${cuenta.vencimiento}`}
                              </span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-sm">-</span>
                      )}
                    </td>
                    <td className="p-3 sm:p-4 text-slate-600 hidden md:table-cell">
                      {new Date(ingreso.fecha).toLocaleDateString('es-AR')}
                    </td>
                    <td className="p-3 sm:p-4 text-right whitespace-nowrap">
                      <span className={`font-bold inline-block text-sm sm:text-base ${(ingreso as any).pendiente_cobro && !(ingreso as any).fecha_cobro_confirmada ? 'text-amber-600' : 'text-emerald-600'}`}>
                        {formatMoney(ingreso.monto, ingreso.moneda)}
                      </span>
                    </td>
                    <td className="p-3 sm:p-4 hidden lg:table-cell">
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
                    <td className="p-3 sm:p-4 hidden lg:table-cell">
                      <button
                        onClick={() => toggleFijo(ingreso)}
                        className={`w-10 h-6 rounded-full relative transition-colors ${
                          (ingreso as any).es_fijo ? 'bg-emerald-500' : 'bg-slate-200'
                        }`}
                      >
                        <div className={`absolute w-4 h-4 bg-white rounded-full top-1 transition-transform ${
                          (ingreso as any).es_fijo ? 'translate-x-5' : 'translate-x-1'
                        }`} />
                      </button>
                    </td>
                    <td className="p-3 sm:p-4 text-right">
                      <div className="flex gap-1 sm:gap-2 justify-end">
                        {(ingreso as any).pendiente_cobro && !(ingreso as any).fecha_cobro_confirmada && (
                          <button
                            onClick={async () => {
                              await updateIngreso(ingreso.id, {
                                fecha_cobro_confirmada: new Date().toISOString().split('T')[0]
                              })
                            }}
                            className="p-1.5 sm:p-2 hover:bg-emerald-50 rounded-lg transition"
                            title="Confirmar cobro"
                          >
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          </button>
                        )}
                        {(ingreso as any).comprobante_url && (
                          <a
                            href={(ingreso as any).comprobante_url}
                            download={(ingreso as any).comprobante_nombre}
                            className="p-1.5 sm:p-2 hover:bg-slate-100 rounded-lg transition"
                            title="Descargar comprobante"
                          >
                            <Download className="w-4 h-4 text-slate-600" />
                          </a>
                        )}
                        <button
                          onClick={() => openEdit(ingreso)}
                          className="p-1.5 sm:p-2 hover:bg-slate-100 rounded-lg transition"
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
              {/* Botón para subir imagen con IA - Solo mostrar si NO está editando */}
              {!editing && (
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
              )}

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
                <label className="label">Etiquetas</label>
                <p className="text-xs text-slate-500 mb-3">Para organizar y filtrar ingresos por categorías personalizadas</p>
                <div className="flex flex-wrap gap-2 mb-2 p-3 bg-slate-50 rounded-xl border-2 border-slate-200 min-h-[3rem]">
                  {tagsIngresos.map(tag => {
                    const isSelected = form.tag_ids.includes(tag.id)
                    return (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => toggleTag(tag.id)}
                        className={`px-3 py-1.5 rounded-full text-sm font-semibold transition ${
                          isSelected
                            ? 'bg-orange-500 text-white border-2 border-orange-600'
                            : 'bg-white text-orange-700 border-2 border-orange-300 hover:border-orange-400'
                        }`}
                      >
                        {tag.nombre}
                      </button>
                    )
                  })}
                  {!showNewTagInput && (
                    <button
                      type="button"
                      onClick={() => setShowNewTagInput(true)}
                      className="px-3 py-1.5 rounded-full text-sm bg-blue-50 text-blue-700 border-2 border-blue-300 hover:bg-blue-100 transition font-semibold flex items-center gap-1"
                    >
                      <Plus className="w-4 h-4" /> Nueva etiqueta
                    </button>
                  )}
                  {showNewTagInput && (
                    <div className="flex gap-1 items-center">
                      <input
                        type="text"
                        className="input py-1 px-2 text-sm w-32 rounded-full"
                        placeholder="Nombre"
                        value={newTagName}
                        onChange={e => setNewTagName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleAddNewTag()}
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={handleAddNewTag}
                        className="px-2 py-1 bg-emerald-500 text-white rounded-full text-sm font-bold hover:bg-emerald-600"
                      >
                        ✓
                      </button>
                      <button
                        type="button"
                        onClick={() => { setShowNewTagInput(false); setNewTagName('') }}
                        className="px-2 py-1 bg-slate-300 text-slate-700 rounded-full text-sm font-bold hover:bg-slate-400"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>
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
                    id="es_fijo"
                    checked={form.es_fijo}
                    onChange={e => setForm(f => ({ ...f, es_fijo: e.target.checked }))}
                    className="w-5 h-5 text-indigo-600 rounded border-slate-300"
                  />
                  <label htmlFor="es_fijo" className="font-semibold text-slate-700 cursor-pointer">
                    📌 Ingreso fijo mensual
                  </label>
                </div>
                {form.es_fijo && (
                  <p className="text-xs text-slate-500 ml-8 mb-3">
                    Este ingreso aparecerá automáticamente en todos los meses futuros.
                  </p>
                )}
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
                      <DatePicker
                        value={form.fecha_cobro_esperada}
                        onChange={(date) => setForm(f => ({ ...f, fecha_cobro_esperada: date || null }))}
                        placeholder="dd/mm/aaaa"
                      />
                    </div>
                    <p className="text-xs text-slate-500">
                      El ingreso no se incluirá en los totales hasta que se confirme el cobro.
                    </p>
                    {form.fecha_cobro_esperada && (
                      <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                        <p className="text-xs text-blue-800">
                          <strong>📅 Notificación:</strong> Se te avisará 1 día antes ({new Date(new Date(form.fecha_cobro_esperada).getTime() - 24 * 60 * 60 * 1000).toLocaleDateString('es-AR', { 
                            day: 'numeric', 
                            month: 'long', 
                            year: 'numeric' 
                          })}) para recordarte confirmar el cobro.
                        </p>
                      </div>
                    )}
                    <div className="mt-3">
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          id="notificar_correo"
                          checked={form.notificar_correo !== undefined ? form.notificar_correo : true}
                          onChange={e => setForm(f => ({ ...f, notificar_correo: e.target.checked }))}
                          className="w-4 h-4 text-indigo-600 rounded border-slate-300 mt-0.5"
                        />
                        <div>
                          <span className="text-sm font-medium text-slate-700">Generar un recordatorio</span>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Te notificaremos por correo 1 día antes de la fecha esperada de cobro.
                          </p>
                        </div>
                      </label>
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

              {editing && (editing as any).es_fijo && (
                <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
                  <p className="text-xs text-indigo-700">
                    📌 Este es un ingreso fijo. Los cambios se aplicarán automáticamente a todos los meses.
                  </p>
                </div>
              )}
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
      {showConfirmDelete && (
        <div className="modal-overlay" onClick={() => { setShowConfirmDelete(false); setDeleteTargetId(null) }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-slate-200">
              <h3 className="font-bold text-lg text-red-600">¿Eliminar ingreso?</h3>
            </div>
            <div className="p-4 space-y-4">
              {deleteTargetId && (() => {
                const ingreso = ingresos.find(i => i.id === deleteTargetId)
                const esFijo = ingreso && (ingreso as any).es_fijo === true
                return (
                  <>
                    <p className="text-slate-700">Esta acción no se puede deshacer.</p>
                    {esFijo && (
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                        <p className="text-xs text-amber-700">
                          📌 Este es un ingreso fijo. Al eliminarlo, dejará de aparecer en todos los meses.
                        </p>
                      </div>
                    )}
                  </>
                )
              })()}
            </div>
            <div className="p-4 border-t border-slate-200 flex gap-2 justify-end">
              <button
                onClick={() => { setShowConfirmDelete(false); setDeleteTargetId(null) }}
                className="btn btn-secondary"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDelete}
                className="btn btn-danger"
              >
                Eliminar
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
                      <MonthYearPicker
                        value={globalDocumentDate || null}
                        onChange={(date) => {
                          setGlobalDocumentDate(date)
                          setUseGlobalDate(true)
                          console.log('🔵 [Ingresos] Mes seleccionado:', date)
                        }}
                      />
                      {globalDocumentDate && (() => {
                        // Parsear la fecha de forma segura para evitar problemas de zona horaria
                        const [year, month, day] = globalDocumentDate.split('-').map(Number)
                        const fechaDisplay = new Date(year, month - 1, day) // month - 1 porque Date usa 0-11
                        return (
                          <div className="text-xs text-slate-600">
                            Se cargarán en: <strong>{fechaDisplay.toLocaleDateString('es-AR', { 
                              day: 'numeric', 
                              month: 'long', 
                              year: 'numeric' 
                            })}</strong>
                          </div>
                        )
                      })()}
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
                    {useGlobalDate && globalDocumentDate && (() => {
                      // Parsear la fecha de forma segura para evitar problemas de zona horaria
                      const [year, month, day] = globalDocumentDate.split('-').map(Number)
                      const fechaDisplay = new Date(year, month - 1, day) // month - 1 porque Date usa 0-11
                      return (
                        <p className="text-xs text-slate-500 mt-2">
                          Todos los ingresos seleccionados se cargarán en <strong>{fechaDisplay.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}</strong>.
                        </p>
                      )
                    })()}
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
                          onChange={e => {
                            setSelectedCuentaId(e.target.value)
                            // Si se selecciona crear nueva sugerida, prellenar campos
                            if (e.target.value === '__new_suggested__') {
                              const nombreSugerido = buildDetectedCuentaName(detectedCuenta)
                              const tipoStr = (detectedCuenta?.tipo || detectedCuenta?.tipo_tarjeta || '').toLowerCase()
                              let tipo: 'visa' | 'mastercard' | 'amex' | 'other' = 'other'
                              if (tipoStr.includes('visa')) tipo = 'visa'
                              else if (tipoStr.includes('master')) tipo = 'mastercard'
                              else if (tipoStr.includes('amex') || tipoStr.includes('american')) tipo = 'amex'
                              
                              setAiNewCuenta({
                                nombre: nombreSugerido,
                                tipo: tipo,
                                banco: detectedCuenta?.banco || '',
                                digitos: detectedCuenta?.ultimosDigitos || detectedCuenta?.ultimos_digitos || ''
                              })
                            }
                          }}
                        >
                          <option value="">Sin cuenta específica</option>
                          {tarjetas.map(t => (
                            <option key={t.id} value={t.id}>
                              {normalizeAccountName(t.nombre)}
                            </option>
                          ))}
                          {selectedCuentaId === '__new_suggested__' || !tarjetas.find(t => {
                            const nombreDetectado = buildDetectedCuentaName(detectedCuenta)
                            const ultimosDigitos = detectedCuenta?.ultimosDigitos || detectedCuenta?.ultimos_digitos
                            const banco = detectedCuenta?.banco
                            return (
                              t.nombre.toLowerCase().includes(nombreDetectado.toLowerCase()) ||
                              nombreDetectado.toLowerCase().includes(t.nombre.toLowerCase()) ||
                              (banco && t.banco && t.banco.toLowerCase() === banco.toLowerCase() && 
                               ((ultimosDigitos && t.digitos && t.digitos.includes(ultimosDigitos)) || (!ultimosDigitos && !t.digitos)))
                            )
                          }) && (
                            <option value="__new_suggested__">
                              ➕ Crear nueva sugerida: {buildDetectedCuentaName(detectedCuenta)}
                            </option>
                          )}
                          <option value="__new__">➕ Crear nueva cuenta/tarjeta (manual)</option>
                        </select>
                        {(selectedCuentaId === '__new_suggested__' || selectedCuentaId === '__new__') && (
                          <div className="p-3 bg-white rounded-lg border border-indigo-200 space-y-2">
                            {selectedCuentaId === '__new_suggested__' && (
                              <div className="text-xs text-indigo-700 bg-indigo-50 p-2 rounded">
                                💡 La cuenta se creará automáticamente al confirmar la importación
                              </div>
                            )}
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
                            <input
                              type="text"
                              className="input"
                              placeholder="Últimos 4 dígitos (opcional)"
                              value={aiNewCuenta.digitos}
                              onChange={e => setAiNewCuenta(c => ({ ...c, digitos: e.target.value }))}
                              maxLength={4}
                            />
                            {selectedCuentaId === '__new__' && (
                              <div className="flex gap-2">
                                <button
                                  onClick={handleAddNewCuentaAI}
                                  className="btn btn-primary btn-sm"
                                >
                                  Crear ahora
                                </button>
                                <button
                                  onClick={() => setSelectedCuentaId('')}
                                  className="btn btn-secondary btn-sm"
                                >
                                  Cancelar
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}


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
                            const cuentaId = edited?.cuenta_bancaria_id ?? (selectedCuentaId && selectedCuentaId !== '__new__' && selectedCuentaId !== '__new_suggested__' ? selectedCuentaId : null)
                            
                            const categoria = categoriasIngresos.find(c => c.id === categoriaId)
                            const cuenta = cuentaId ? tarjetas.find(t => t.id === cuentaId) : null
                            
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
                                  <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 bg-slate-100 rounded-lg flex items-center justify-center text-lg">
                                      {categoria?.icono || '💰'}
                                    </div>
                                    <div>
                                      <div className="font-semibold">{descripcion || 'Sin descripción'}</div>
                                      {trans.origen && (
                                        <div className="text-xs text-blue-600 mt-1">📍 {trans.origen}</div>
                                      )}
                                      <div className="text-xs text-slate-500">
                                        {categoria ? categoria.nombre : (trans.categoria ? `Sugerida: ${trans.categoria}` : 'Sin categoría')}
                                        {(edited?.es_fijo || false) && ' 📌'}
                                      </div>
                                      {tagIds.length > 0 && (
                                        <div className="flex flex-wrap gap-1 mt-1">
                                          {tagIds.map((tagId: string) => {
                                            const tag = tagsIngresos.find(t => t.id === tagId)
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
                                <td className="p-3">
                                  <div className="flex items-center gap-1 justify-start">
                                    <span className={`font-bold text-lg ${moneda === 'USD' ? 'text-emerald-600' : 'text-emerald-600'}`}>
                                      {formatMoney(monto, moneda)}
                                    </span>
                                  </div>
                                  <div className="text-xs text-slate-500 mt-1">
                                    {fecha ? new Date(fecha).toLocaleDateString('es-AR') : '-'}
                                  </div>
                                  {cuenta && (
                                    <div className="text-xs text-slate-500 mt-1">
                                      {cuenta.banco && <span>{cuenta.banco}</span>}
                                      {cuenta.digitos && (
                                        <span>{cuenta.banco ? ' • ' : ''}****{cuenta.digitos}</span>
                                      )}
                                      {(cuenta.cierre || cuenta.vencimiento) && (
                                        <span className="block mt-0.5">
                                          {cuenta.cierre && `Cierre: día ${cuenta.cierre}`}
                                          {cuenta.cierre && cuenta.vencimiento && ' • '}
                                          {cuenta.vencimiento && `Venc: día ${cuenta.vencimiento}`}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                  {(edited?.pendiente_cobro || false) && (
                                    <div className="mt-1">
                                      <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-semibold">
                                        ⏳ Pendiente
                                      </span>
                                    </div>
                                  )}
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
                  onClick={() => {
                    // Validar antes de mostrar el modal
                    if (extractedData.transacciones && selectedTransactions.size === 0 && !includeTotal) {
                      setAlertData({
                        title: 'Error',
                        message: 'Por favor, selecciona al menos una transacción',
                        variant: 'error'
                      })
                      setShowAlert(true)
                      return
                    }
                    setShowImportConfirmModal(true)
                  }}
                  className="btn btn-primary flex-1"
                  disabled={savingTransactions}
                >
                  ✓ {extractedData.transacciones ? `Confirmar ${selectedTransactions.size} transacción${selectedTransactions.size !== 1 ? 'es' : ''}` : 'Usar estos datos'}
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
        <div className="modal-overlay" onClick={() => { setEditingAiTransaction(null); setAiTransactionForm({ descripcion: '', categoria_id: '', monto: '', moneda: 'ARS', fecha: new Date().toISOString().split('T')[0], tag_ids: [], pendiente_cobro: false, fecha_cobro_esperada: null, cuenta_bancaria_id: null, notificar_correo: true }) }}>
          <div className="modal max-w-2xl" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-lg">Editar Transacción</h3>
              <button onClick={() => { setEditingAiTransaction(null); setAiTransactionForm({ descripcion: '', categoria_id: '', monto: '', moneda: 'ARS', fecha: new Date().toISOString().split('T')[0], tag_ids: [], pendiente_cobro: false, fecha_cobro_esperada: null, cuenta_bancaria_id: null, notificar_correo: true }) }} className="p-1 hover:bg-slate-100 rounded">
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
                <p className="text-xs text-slate-500 mb-3">Para organizar y filtrar ingresos por categorías personalizadas</p>
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
                        className={`px-3 py-1.5 rounded-full text-sm font-semibold transition ${
                          isSelected
                            ? 'bg-orange-500 text-white border-2 border-orange-600'
                            : 'bg-white text-orange-700 border-2 border-orange-300 hover:border-orange-400'
                        }`}
                      >
                        {t.nombre}
                      </button>
                    )
                  })}
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
                      <DatePicker
                        value={aiTransactionForm.fecha_cobro_esperada}
                        onChange={(date) => setAiTransactionForm(f => ({ ...f, fecha_cobro_esperada: date || null }))}
                        placeholder="dd/mm/aaaa"
                      />
                    </div>
                    <p className="text-xs text-slate-500">
                      El ingreso no se incluirá en los totales hasta que se confirme el cobro.
                    </p>
                    {aiTransactionForm.fecha_cobro_esperada && (
                      <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                        <p className="text-xs text-blue-800">
                          <strong>📅 Notificación:</strong> Se te avisará 1 día antes ({new Date(new Date(aiTransactionForm.fecha_cobro_esperada).getTime() - 24 * 60 * 60 * 1000).toLocaleDateString('es-AR', { 
                            day: 'numeric', 
                            month: 'long', 
                            year: 'numeric' 
                          })}) para recordarte confirmar el cobro.
                        </p>
                      </div>
                    )}
                    <div className="mt-3">
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          id="ai_notificar_correo"
                          checked={aiTransactionForm.notificar_correo}
                          onChange={e => setAiTransactionForm(f => ({ ...f, notificar_correo: e.target.checked }))}
                          className="w-4 h-4 text-indigo-600 rounded border-slate-300 mt-0.5"
                        />
                        <div>
                          <span className="text-sm font-medium text-slate-700">Generar un recordatorio</span>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Te notificaremos por correo 1 día antes de la fecha esperada de cobro.
                          </p>
                        </div>
                      </label>
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
                      notificar_correo: aiTransactionForm.notificar_correo
                    })
                    setEditedTransactions(updated)
                    setEditingAiTransaction(null)
                    setAiTransactionForm({ descripcion: '', categoria_id: '', monto: '', moneda: 'ARS', fecha: new Date().toISOString().split('T')[0], tag_ids: [], pendiente_cobro: false, fecha_cobro_esperada: null, cuenta_bancaria_id: null, notificar_correo: true })
                  }}
                  className="btn btn-primary flex-1"
                >
                  Guardar Cambios
                </button>
                <button
                  onClick={() => { setEditingAiTransaction(null); setAiTransactionForm({ descripcion: '', categoria_id: '', monto: '', moneda: 'ARS', fecha: new Date().toISOString().split('T')[0], tag_ids: [], pendiente_cobro: false, fecha_cobro_esperada: null, cuenta_bancaria_id: null, notificar_correo: true }) }}
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

      {/* Modal Confirmación Importación */}
      {extractedData && extractedData.transacciones && Array.isArray(extractedData.transacciones) && (
        <TransactionImportConfirmModal
          isOpen={showImportConfirmModal}
          onClose={() => setShowImportConfirmModal(false)}
          onConfirm={handleConfirmExtractedData}
          transactionCount={selectedTransactions.size + (includeTotal && extractedData.total ? 1 : 0)}
          transactionType="ingresos"
          month={globalDocumentDate ? globalDocumentDate.slice(0, 7) : null}
          effectiveDate={globalDocumentDate}
          accountName={
            selectedCuentaId && selectedCuentaId !== '__new_suggested__' && selectedCuentaId !== '__new__'
              ? normalizeAccountName(tarjetas.find(t => t.id === selectedCuentaId)?.nombre || '')
              : selectedCuentaId === '__new_suggested__' && aiNewCuenta.nombre
              ? normalizeAccountName(aiNewCuenta.nombre)
              : null
          }
          accountIsSuggested={selectedCuentaId === '__new_suggested__'}
          loading={savingTransactions}
        />
      )}
    </div>
  )
}
