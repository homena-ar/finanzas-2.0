'use client'

// ============================================
// LISTAS INTELIGENTES — IMPLEMENTACION COMPLETA
// ============================================
// - Header con total estimado dinamico + updatedAt real
// - Menu ⋯ por lista: rename, duplicate, clear completed, sort, delete
// - Toast Undo global con snapshot + rollback
// - Sugerencias inteligentes SIN IA (historial + frecuencia)
// - Metadata colapsable: qty, unit, price, note, category, store
// - Categorias opcionales con agrupacion visual
// - Normalizacion automatica (diccionario local + fuzzy match)
// - Duplicados inteligentes: string normalizado → sumar qty
// - Precios inteligentes: lastPriceHistory con variacion %

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useWorkspace } from '@/hooks/useWorkspace'
import {
  collection, addDoc, updateDoc, deleteDoc, doc,
  getDocs, query, where, orderBy, serverTimestamp, writeBatch
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { ListaCompra, ItemLista, CATEGORY_MAP, ListaSnapshot } from '@/types'
import {
  Plus, Trash2, X, ShoppingCart, ChevronDown, ChevronRight,
  Check, Clock, Package, MoreHorizontal, Copy, ArrowUpDown,
  RotateCcw, Edit2, CheckCircle2, Tag, Store, StickyNote
} from 'lucide-react'
import { ConfirmModal } from '@/components/Modal'

const UNIDADES = ['u', 'kg', 'g', 'L', 'ml', 'pack', 'doc']
const UNIDAD_LABELS: Record<string, string> = {
  u: 'unid.', kg: 'kg', g: 'g', L: 'L', ml: 'ml', pack: 'pack', doc: 'doc'
}

const ICONOS_LISTAS = ['🛒', '🏪', '🏠', '💊', '🔧', '🧹', '🐾', '👶', '🎒', '📦', '🍎', '🥩']

// ── Normalizacion ──

const NORMALIZATION_DICT: Record<string, string> = {
  'leche': 'leche', 'lechee': 'leche', 'lch': 'leche',
  'pan': 'pan', 'pann': 'pan',
  'huevos': 'huevos', 'huevo': 'huevos', 'guevos': 'huevos',
  'queso': 'queso', 'qeso': 'queso',
  'cafe': 'cafe', 'café': 'cafe',
  'azucar': 'azucar', 'azúcar': 'azucar', 'asucar': 'azucar',
  'arroz': 'arroz', 'arros': 'arroz',
  'fideos': 'fideos', 'fideo': 'fideos',
  'aceite': 'aceite', 'aseite': 'aceite',
  'manteca': 'manteca', 'manteka': 'manteca',
  'galletitas': 'galletitas', 'galletas': 'galletitas', 'galletita': 'galletitas',
  'yogur': 'yogur', 'yogurt': 'yogur', 'jogurt': 'yogur',
  'atun': 'atun', 'atún': 'atun',
  'tomate': 'tomate', 'tomates': 'tomate',
  'papa': 'papa', 'papas': 'papa',
  'cebolla': 'cebolla', 'cebollas': 'cebolla',
  'banana': 'banana', 'bananas': 'banana',
  'manzana': 'manzana', 'manzanas': 'manzana',
  'jabon': 'jabon', 'jabón': 'jabon',
  'detergente': 'detergente',
  'lavandina': 'lavandina',
  'servilletas': 'servilletas', 'servilleta': 'servilletas',
  'papel higienico': 'papel higienico', 'papel higiénico': 'papel higienico',
  'shampoo': 'shampoo', 'shampu': 'shampoo',
}

function normalizeItemName(name: string): string {
  const lower = name.toLowerCase().trim()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')

  // Buscar en diccionario exacto
  if (NORMALIZATION_DICT[lower]) return NORMALIZATION_DICT[lower]

  // Fuzzy match: distancia de levenshtein <= 2
  for (const [key, value] of Object.entries(NORMALIZATION_DICT)) {
    if (levenshteinDistance(lower, key) <= 2) return value
  }

  return lower
}

function levenshteinDistance(a: string, b: string): number {
  const m = a.length, n = b.length
  if (Math.abs(m - n) > 3) return 999
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))
  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i-1] === b[j-1]
        ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1])
    }
  }
  return dp[m][n]
}

// ── Historial de frecuencia para sugerencias ──

const FREQUENCY_KEY = 'fincontrol:item_frequency'

function loadFrequency(): Record<string, number> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(FREQUENCY_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

function saveFrequency(freq: Record<string, number>) {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(FREQUENCY_KEY, JSON.stringify(freq)) } catch {}
}

function trackItem(name: string) {
  const normalized = normalizeItemName(name)
  const freq = loadFrequency()
  freq[normalized] = (freq[normalized] || 0) + 1
  saveFrequency(freq)
}

function getSuggestions(input: string, existingItems: string[]): string[] {
  const freq = loadFrequency()
  const lower = input.toLowerCase().trim()
  const existing = new Set(existingItems.map(n => normalizeItemName(n)))

  const sorted = Object.entries(freq)
    .filter(([name]) => !existing.has(name))
    .filter(([name]) => !lower || name.includes(lower))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name]) => name.charAt(0).toUpperCase() + name.slice(1))

  return sorted
}

// ── Precios inteligentes ──

const PRICE_HISTORY_KEY = 'fincontrol:price_history'

function loadPriceHistory(): Record<string, { precio: number; moneda: string; fecha: string }[]> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(PRICE_HISTORY_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

function savePriceHistory(history: Record<string, { precio: number; moneda: string; fecha: string }[]>) {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(PRICE_HISTORY_KEY, JSON.stringify(history)) } catch {}
}

function trackPrice(name: string, precio: number, moneda: string) {
  if (!precio || precio <= 0) return
  const normalized = normalizeItemName(name)
  const history = loadPriceHistory()
  if (!history[normalized]) history[normalized] = []
  history[normalized].push({ precio, moneda, fecha: new Date().toISOString().split('T')[0] })
  // Mantener ultimos 10
  if (history[normalized].length > 10) history[normalized] = history[normalized].slice(-10)
  savePriceHistory(history)
}

function getLastPrice(name: string): { precio: number; moneda: string; variacion: number | null } | null {
  const normalized = normalizeItemName(name)
  const history = loadPriceHistory()
  const entries = history[normalized]
  if (!entries || entries.length === 0) return null
  const last = entries[entries.length - 1]
  let variacion: number | null = null
  if (entries.length >= 2) {
    const prev = entries[entries.length - 2]
    if (prev.precio > 0) {
      variacion = Math.round(((last.precio - prev.precio) / prev.precio) * 100)
    }
  }
  return { precio: last.precio, moneda: last.moneda, variacion }
}

// ══════════════════════════════════
// COMPONENTE PRINCIPAL
// ══════════════════════════════════

export default function ListasPage() {
  const { user } = useAuth()
  const { currentWorkspace, initWorkspaceReady } = useWorkspace()

  const [listas, setListas] = useState<ListaCompra[]>([])
  const [items, setItems] = useState<Record<string, ItemLista[]>>({})
  const [loading, setLoading] = useState(true)
  const [expandedListId, setExpandedListId] = useState<string | null>(null)

  // List modal
  const [showListModal, setShowListModal] = useState(false)
  const [editingList, setEditingList] = useState<ListaCompra | null>(null)
  const [listForm, setListForm] = useState({ nombre: '', icono: '🛒' })
  const [savingList, setSavingList] = useState(false)

  // Item quick-add
  const [newItemName, setNewItemName] = useState('')
  const [newItemCantidad, setNewItemCantidad] = useState('1')
  const [newItemUnidad, setNewItemUnidad] = useState('u')
  const [newItemPrecio, setNewItemPrecio] = useState('')
  const [newItemMoneda, setNewItemMoneda] = useState<'ARS' | 'USD'>('ARS')
  const [newItemNota, setNewItemNota] = useState('')
  const [newItemCategoria, setNewItemCategoria] = useState('')
  const [newItemTienda, setNewItemTienda] = useState('')
  const [showItemDetails, setShowItemDetails] = useState(false)
  const [savingItem, setSavingItem] = useState(false)
  const itemInputRef = useRef<HTMLInputElement>(null)

  // Suggestions
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)

  // Context menu per list
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'list' | 'item'; id: string; listaId?: string } | null>(null)

  // Toast undo global
  const [undoToast, setUndoToast] = useState<{ message: string; snapshot: ListaSnapshot | null; timeout: ReturnType<typeof setTimeout> | null } | null>(null)

  // Category grouping toggle
  const [groupByCategory, setGroupByCategory] = useState(false)

  // ── Fetch ──

  const fetchListas = useCallback(async () => {
    if (!user || !currentWorkspace?.id) {
      if (!initWorkspaceReady) return
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const snap = await getDocs(
        query(
          collection(db, 'listas_compra'),
          where('workspace_id', '==', currentWorkspace.id),
          orderBy('created_at', 'desc')
        )
      )
      setListas(snap.docs.map(d => ({ id: d.id, ...d.data() } as ListaCompra)))
    } catch (e) {
      console.error('[Listas] Error fetching lists:', e)
    }
    setLoading(false)
  }, [user, currentWorkspace?.id, initWorkspaceReady])

  const fetchItems = useCallback(async (listaId: string) => {
    if (!user || !currentWorkspace?.id) return
    try {
      const snap = await getDocs(
        query(
          collection(db, 'items_lista'),
          where('lista_id', '==', listaId),
          where('workspace_id', '==', currentWorkspace.id),
          orderBy('created_at', 'asc')
        )
      )
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as ItemLista))
      setItems(prev => ({ ...prev, [listaId]: data }))
    } catch (e) {
      console.error('[Listas] Error fetching items:', e)
    }
  }, [user, currentWorkspace?.id])

  // Cargar todos los items al inicio para que los contadores funcionen
  const fetchAllItems = useCallback(async () => {
    if (!user || !currentWorkspace?.id) return
    try {
      const snap = await getDocs(
        query(
          collection(db, 'items_lista'),
          where('workspace_id', '==', currentWorkspace.id),
          orderBy('created_at', 'asc')
        )
      )
      const newItems: Record<string, ItemLista[]> = {}
      snap.docs.forEach(d => {
        const item = { id: d.id, ...d.data() } as ItemLista
        if (!newItems[item.lista_id]) newItems[item.lista_id] = []
        newItems[item.lista_id].push(item)
      })
      setItems(newItems)
    } catch (e) {
      console.error('[Listas] Error fetching all items:', e)
    }
  }, [user, currentWorkspace?.id])

  useEffect(() => {
    fetchListas()
    fetchAllItems()
  }, [fetchListas, fetchAllItems])

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpenId) return
    const handler = () => setMenuOpenId(null)
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [menuOpenId])

  // ── List CRUD ──

  const openNewList = () => {
    setListForm({ nombre: '', icono: '🛒' })
    setEditingList(null)
    setShowListModal(true)
  }

  const handleSaveList = async () => {
    if (!user || !listForm.nombre.trim() || !currentWorkspace?.id) return
    setSavingList(true)
    try {
      const data: any = {
        nombre: listForm.nombre.trim(),
        icono: listForm.icono,
        user_id: user.uid,
        workspace_id: currentWorkspace.id,
        created_by: user.uid,
        updated_at: new Date().toISOString(),
      }
      if (editingList) {
        await updateDoc(doc(db, 'listas_compra', editingList.id), data)
      } else {
        data.created_at = serverTimestamp()
        await addDoc(collection(db, 'listas_compra'), data)
      }
      await fetchListas()
      setShowListModal(false)
      setEditingList(null)
    } catch (e) {
      console.error('[Listas] Error saving list:', e)
    }
    setSavingList(false)
  }

  // Snapshot para undo
  const createSnapshot = async (listaId: string): Promise<ListaSnapshot | null> => {
    const lista = listas.find(l => l.id === listaId)
    if (!lista) return null
    const listItems = items[listaId] || []
    // Si no hay items cargados, fetch
    if (listItems.length === 0 && user && currentWorkspace?.id) {
      try {
        const snap = await getDocs(
          query(
            collection(db, 'items_lista'),
            where('lista_id', '==', listaId),
            where('workspace_id', '==', currentWorkspace.id)
          )
        )
        return {
          lista,
          items: snap.docs.map(d => ({ id: d.id, ...d.data() } as ItemLista)),
          timestamp: Date.now(),
        }
      } catch { return null }
    }
    return { lista, items: listItems, timestamp: Date.now() }
  }

  const showUndoToast = (message: string, snapshot: ListaSnapshot | null) => {
    // Limpiar toast anterior
    if (undoToast?.timeout) clearTimeout(undoToast.timeout)

    const timeout = setTimeout(() => setUndoToast(null), 6000)
    setUndoToast({ message, snapshot, timeout })
  }

  const performUndo = async () => {
    if (!undoToast?.snapshot || !user || !currentWorkspace?.id) return
    const { snapshot } = undoToast

    try {
      // Restaurar lista
      const listData: any = {
        nombre: snapshot.lista.nombre,
        icono: snapshot.lista.icono,
        user_id: snapshot.lista.user_id,
        workspace_id: snapshot.lista.workspace_id,
        created_by: snapshot.lista.created_by,
        created_at: serverTimestamp(),
        updated_at: new Date().toISOString(),
      }
      const newListRef = await addDoc(collection(db, 'listas_compra'), listData)

      // Restaurar items
      for (const item of snapshot.items) {
        await addDoc(collection(db, 'items_lista'), {
          lista_id: newListRef.id,
          nombre: item.nombre,
          nombre_normalizado: item.nombre_normalizado || normalizeItemName(item.nombre),
          cantidad: item.cantidad,
          unidad: item.unidad,
          precio_estimado: item.precio_estimado,
          moneda: item.moneda,
          comprado: item.comprado,
          nota: item.nota || '',
          categoria: item.categoria || '',
          tienda: item.tienda || '',
          user_id: user.uid,
          workspace_id: currentWorkspace.id,
          created_by: user.uid,
          created_at: serverTimestamp(),
        })
      }

      await fetchListas()
    } catch (e) {
      console.error('[Listas] Error restoring snapshot:', e)
    }

    if (undoToast.timeout) clearTimeout(undoToast.timeout)
    setUndoToast(null)
  }

  const handleDeleteList = async (listaId: string) => {
    if (!user || !currentWorkspace?.id) return

    // Crear snapshot antes de borrar
    const snapshot = await createSnapshot(listaId)

    try {
      const itemsSnap = await getDocs(
        query(collection(db, 'items_lista'), where('lista_id', '==', listaId), where('workspace_id', '==', currentWorkspace.id))
      )
      const batch = writeBatch(db)
      itemsSnap.docs.forEach(d => batch.delete(d.ref))
      batch.delete(doc(db, 'listas_compra', listaId))
      await batch.commit()
      if (expandedListId === listaId) setExpandedListId(null)
      setItems(prev => { const next = { ...prev }; delete next[listaId]; return next })
      await fetchListas()

      showUndoToast('Lista eliminada', snapshot)
    } catch (e) {
      console.error('[Listas] Error deleting list:', e)
    }
  }

  // ── Menu actions ──

  const handleEditList = (lista: ListaCompra) => {
    setMenuOpenId(null)
    setEditingList(lista)
    setListForm({ nombre: lista.nombre, icono: lista.icono })
    setShowListModal(true)
  }

  const handleDuplicate = async (lista: ListaCompra) => {
    if (!user || !currentWorkspace?.id) return
    setMenuOpenId(null)
    try {
      // Crear nueva lista
      const newListRef = await addDoc(collection(db, 'listas_compra'), {
        nombre: `${lista.nombre} (copia)`,
        icono: lista.icono,
        user_id: user.uid,
        workspace_id: currentWorkspace.id,
        created_by: user.uid,
        created_at: serverTimestamp(),
        updated_at: new Date().toISOString(),
      })

      // Deep copy items
      const itemsSnap = await getDocs(
        query(
          collection(db, 'items_lista'),
          where('lista_id', '==', lista.id),
          where('workspace_id', '==', currentWorkspace.id)
        )
      )
      for (const d of itemsSnap.docs) {
        const itemData = d.data()
        await addDoc(collection(db, 'items_lista'), {
          ...itemData,
          lista_id: newListRef.id,
          comprado: false,
          created_at: serverTimestamp(),
        })
      }
      await fetchListas()
    } catch (e) {
      console.error('[Listas] Error duplicating:', e)
    }
  }

  const handleClearCompleted = async (listaId: string) => {
    if (!user || !currentWorkspace?.id) return
    setMenuOpenId(null)
    try {
      const snap = await getDocs(
        query(
          collection(db, 'items_lista'),
          where('lista_id', '==', listaId),
          where('workspace_id', '==', currentWorkspace.id),
          where('comprado', '==', true)
        )
      )
      if (snap.docs.length === 0) return
      const batch = writeBatch(db)
      snap.docs.forEach(d => batch.delete(d.ref))
      await batch.commit()
      await updateDoc(doc(db, 'listas_compra', listaId), { updated_at: new Date().toISOString() })
      await fetchItems(listaId)
      await fetchListas()
    } catch (e) {
      console.error('[Listas] Error clearing completed:', e)
    }
  }

  const handleSort = async (listaId: string) => {
    setMenuOpenId(null)
    const listItems = items[listaId]
    if (!listItems || listItems.length <= 1) return
    // Ordenar por categoria, luego nombre
    const sorted = [...listItems].sort((a, b) => {
      if (a.comprado !== b.comprado) return a.comprado ? 1 : -1
      const catA = a.categoria || 'zzz'
      const catB = b.categoria || 'zzz'
      if (catA !== catB) return catA.localeCompare(catB)
      return a.nombre.localeCompare(b.nombre)
    })
    // Actualizar orden en firestore (updated_at como proxy de orden)
    try {
      for (let i = 0; i < sorted.length; i++) {
        await updateDoc(doc(db, 'items_lista', sorted[i].id), {
          updated_at: new Date(Date.now() + i).toISOString(),
        })
      }
      await fetchItems(listaId)
    } catch (e) {
      console.error('[Listas] Error sorting:', e)
    }
  }

  // ── Item CRUD ──

  const resetItemForm = () => {
    setNewItemName('')
    setNewItemCantidad('1')
    setNewItemUnidad('u')
    setNewItemPrecio('')
    setNewItemMoneda('ARS')
    setNewItemNota('')
    setNewItemCategoria('')
    setNewItemTienda('')
    setShowItemDetails(false)
    setShowSuggestions(false)
  }

  const handleAddItem = async (listaId: string) => {
    if (!user || !newItemName.trim() || !currentWorkspace?.id) return

    const normalized = normalizeItemName(newItemName)
    const listItems = items[listaId] || []

    // Duplicados inteligentes: si existe item con nombre normalizado igual → sumar qty
    const existingItem = listItems.find(i =>
      normalizeItemName(i.nombre) === normalized && !i.comprado
    )

    if (existingItem) {
      setSavingItem(true)
      try {
        const newQty = existingItem.cantidad + (parseFloat(newItemCantidad) || 1)
        await updateDoc(doc(db, 'items_lista', existingItem.id), {
          cantidad: newQty,
          updated_at: new Date().toISOString(),
        })
        resetItemForm()
        await fetchItems(listaId)
        await updateDoc(doc(db, 'listas_compra', listaId), { updated_at: new Date().toISOString() })
        setTimeout(() => itemInputRef.current?.focus(), 100)
      } catch (e) {
        console.error('[Listas] Error updating qty:', e)
      }
      setSavingItem(false)
      return
    }

    setSavingItem(true)
    try {
      const precioNum = newItemPrecio ? parseFloat(newItemPrecio) : null
      const data: any = {
        lista_id: listaId,
        nombre: newItemName.trim(),
        nombre_normalizado: normalized,
        cantidad: parseFloat(newItemCantidad) || 1,
        unidad: newItemUnidad,
        precio_estimado: precioNum,
        moneda: newItemMoneda,
        comprado: false,
        nota: newItemNota.trim(),
        categoria: newItemCategoria,
        tienda: newItemTienda.trim(),
        user_id: user.uid,
        workspace_id: currentWorkspace.id,
        created_by: user.uid,
        created_at: serverTimestamp(),
      }
      await addDoc(collection(db, 'items_lista'), data)

      // Track frecuencia y precio
      trackItem(newItemName)
      if (precioNum) trackPrice(newItemName, precioNum, newItemMoneda)

      resetItemForm()
      await fetchItems(listaId)
      await updateDoc(doc(db, 'listas_compra', listaId), { updated_at: new Date().toISOString() })
      setTimeout(() => itemInputRef.current?.focus(), 100)
    } catch (e) {
      console.error('[Listas] Error adding item:', e)
    }
    setSavingItem(false)
  }

  const handleToggleComprado = async (item: ItemLista) => {
    try {
      await updateDoc(doc(db, 'items_lista', item.id), {
        comprado: !item.comprado,
        updated_at: new Date().toISOString(),
      })
      await updateDoc(doc(db, 'listas_compra', item.lista_id), { updated_at: new Date().toISOString() })
      await fetchItems(item.lista_id)
    } catch (e) {
      console.error('[Listas] Error toggling item:', e)
    }
  }

  const handleDeleteItem = async (item: ItemLista) => {
    try {
      await deleteDoc(doc(db, 'items_lista', item.id))
      await updateDoc(doc(db, 'listas_compra', item.lista_id), { updated_at: new Date().toISOString() })
      await fetchItems(item.lista_id)
    } catch (e) {
      console.error('[Listas] Error deleting item:', e)
    }
  }

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    if (deleteTarget.type === 'list') {
      await handleDeleteList(deleteTarget.id)
    } else {
      const listItems: ItemLista[] = Object.values(items).flat()
      const item = listItems.find((i: ItemLista) => i.id === deleteTarget.id)
      if (item) await handleDeleteItem(item)
    }
    setDeleteTarget(null)
  }

  const toggleExpand = (listaId: string) => {
    setExpandedListId(prev => prev === listaId ? null : listaId)
    resetItemForm()
    setMenuOpenId(null)
  }

  // ── Suggestions ──

  const handleInputChange = (value: string) => {
    setNewItemName(value)
    if (value.trim().length > 0 && expandedListId) {
      const existing = (items[expandedListId] || []).map(i => i.nombre)
      const sugs = getSuggestions(value, existing)
      setSuggestions(sugs)
      setShowSuggestions(sugs.length > 0)
    } else {
      setShowSuggestions(false)
    }

    // Auto-fill precio si hay historial
    const priceInfo = getLastPrice(value)
    if (priceInfo && !newItemPrecio) {
      setNewItemPrecio(priceInfo.precio.toString())
      setNewItemMoneda(priceInfo.moneda as 'ARS' | 'USD')
    }
  }

  const handleSuggestionSelect = (suggestion: string) => {
    setNewItemName(suggestion)
    setShowSuggestions(false)
    const priceInfo = getLastPrice(suggestion)
    if (priceInfo) {
      setNewItemPrecio(priceInfo.precio.toString())
      setNewItemMoneda(priceInfo.moneda as 'ARS' | 'USD')
    }
    setTimeout(() => itemInputRef.current?.focus(), 50)
  }

  // ── Helpers ──

  const getListStats = (listaId: string) => {
    const listItems = items[listaId] || []
    const total = listItems.length
    const comprados = listItems.filter(i => i.comprado).length
    const estimado = listItems.reduce((sum, i) => {
      if (i.precio_estimado && !i.comprado) return sum + i.precio_estimado * i.cantidad
      return sum
    }, 0)
    return { total, comprados, pendientes: total - comprados, estimado }
  }

  const formatPrice = (n: number) =>
    n.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })

  const formatRelativeTime = (dateStr: string | undefined) => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMin = Math.floor(diffMs / 60000)
    if (diffMin < 1) return 'recien'
    if (diffMin < 60) return `hace ${diffMin}min`
    const diffH = Math.floor(diffMin / 60)
    if (diffH < 24) return `hace ${diffH}h`
    const diffD = Math.floor(diffH / 24)
    return `hace ${diffD}d`
  }

  // Sort items: pending first, then bought. Optionally group by category.
  const sortedItems = (listaId: string) => {
    const listItems = items[listaId] || []
    return [...listItems].sort((a, b) => {
      if (a.comprado !== b.comprado) return a.comprado ? 1 : -1
      if (groupByCategory) {
        const catA = (a.categoria || 'otros')
        const catB = (b.categoria || 'otros')
        const orderA = CATEGORY_MAP[catA]?.order ?? 99
        const orderB = CATEGORY_MAP[catB]?.order ?? 99
        if (orderA !== orderB) return orderA - orderB
      }
      return 0
    })
  }

  // Group items by category
  const groupedItems = (listaId: string) => {
    const sorted = sortedItems(listaId)
    if (!groupByCategory) return [{ key: 'all', label: '', items: sorted }]

    const groups: Record<string, ItemLista[]> = {}
    for (const item of sorted) {
      const cat = item.categoria || 'otros'
      if (!groups[cat]) groups[cat] = []
      groups[cat].push(item)
    }
    return Object.entries(groups).map(([key, items]) => ({
      key,
      label: CATEGORY_MAP[key]?.label || key,
      icon: CATEGORY_MAP[key]?.icon || '📦',
      items,
    }))
  }

  // ── Render ──

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Listas de Compras</h1>
          <p className="text-sm text-slate-500 mt-1">
            {listas.length} lista{listas.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button onClick={openNewList} className="btn btn-primary">
          <Plus className="w-4 h-4" />
          Nueva lista
        </button>
      </div>

      {/* Loading */}
      {loading ? (
        <div className="card p-12 text-center">
          <Clock className="w-10 h-10 mx-auto text-slate-300 animate-spin mb-3" />
          <p className="text-slate-500 text-sm">Cargando listas...</p>
        </div>
      ) : listas.length === 0 ? (
        <div className="card p-12 text-center">
          <ShoppingCart className="w-16 h-16 mx-auto text-slate-200 mb-4" />
          <p className="text-slate-500 mb-4">No tenes listas de compras todavia</p>
          <button onClick={openNewList} className="btn btn-primary">
            <Plus className="w-4 h-4" />
            Crear tu primera lista
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {listas.map(lista => {
            const isExpanded = expandedListId === lista.id
            const stats = getListStats(lista.id)
            const progress = stats.total > 0 ? (stats.comprados / stats.total) * 100 : 0

            return (
              <div key={lista.id} className="card overflow-hidden transition-all duration-200">
                {/* List header */}
                <div className="relative">
                  <div
                    onClick={() => toggleExpand(lista.id)}
                    className="w-full p-4 flex items-center gap-3 hover:bg-slate-50/50 transition-colors cursor-pointer"
                  >
                    <span className="text-2xl flex-shrink-0">{lista.icono}</span>
                    <div className="flex-1 min-w-0 text-left">
                      <h3 className="font-medium text-slate-800 text-sm">{lista.nombre}</h3>
                      <div className="flex items-center gap-3 mt-1">
                        {stats.total > 0 ? (
                          <>
                            <span className="text-xs text-slate-400">
                              {stats.comprados}/{stats.total} items
                            </span>
                            <div className="flex-1 max-w-[120px] h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                            {stats.estimado > 0 && (
                              <span className="text-xs font-medium text-slate-500">
                                ~${formatPrice(stats.estimado)}
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-xs text-slate-400">Sin items</span>
                        )}
                        {lista.updated_at && (
                          <span className="text-[10px] text-slate-300">{formatRelativeTime(lista.updated_at)}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {/* Menu ⋯ */}
                      <button
                        onClick={e => { e.stopPropagation(); setMenuOpenId(menuOpenId === lista.id ? null : lista.id) }}
                        className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                      {isExpanded
                        ? <ChevronDown className="w-4 h-4 text-slate-400" />
                        : <ChevronRight className="w-4 h-4 text-slate-400" />}
                    </div>
                  </div>

                  {/* Dropdown menu */}
                  {menuOpenId === lista.id && (
                    <div className="list-menu" onClick={e => e.stopPropagation()}>
                      <button className="list-menu-item" onClick={() => handleEditList(lista)}>
                        <Edit2 className="w-3.5 h-3.5 text-slate-400" />
                        Editar
                      </button>
                      <button className="list-menu-item" onClick={() => handleDuplicate(lista)}>
                        <Copy className="w-3.5 h-3.5 text-slate-400" />
                        Duplicar
                      </button>
                      <button className="list-menu-item" onClick={() => handleClearCompleted(lista.id)}>
                        <CheckCircle2 className="w-3.5 h-3.5 text-slate-400" />
                        Limpiar completados
                      </button>
                      <button className="list-menu-item" onClick={() => handleSort(lista.id)}>
                        <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                        Ordenar
                      </button>
                      <div className="border-t border-slate-100 my-1" />
                      <button className="list-menu-item-danger" onClick={() => { setMenuOpenId(null); setDeleteTarget({ type: 'list', id: lista.id }) }}>
                        <Trash2 className="w-3.5 h-3.5" />
                        Eliminar
                      </button>
                    </div>
                  )}
                </div>

                {/* Expanded: items */}
                {isExpanded && (
                  <div className="border-t border-slate-100">
                    {/* Quick-add item */}
                    <div className="p-3 bg-slate-50/50 border-b border-slate-100">
                      <div className="relative">
                        <div className="flex gap-2">
                          <input
                            ref={itemInputRef}
                            type="text"
                            className="input flex-1 text-sm"
                            placeholder="Agregar item..."
                            value={newItemName}
                            onChange={e => handleInputChange(e.target.value)}
                            onFocus={() => {
                              if (newItemName.trim()) {
                                const existing = (items[lista.id] || []).map(i => i.nombre)
                                const sugs = getSuggestions(newItemName, existing)
                                setSuggestions(sugs)
                                setShowSuggestions(sugs.length > 0)
                              }
                            }}
                            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                            onKeyDown={e => {
                              if (e.key === 'Enter' && newItemName.trim()) handleAddItem(lista.id)
                            }}
                          />
                          <button
                            onClick={() => setShowItemDetails(!showItemDetails)}
                            className={`px-2 py-1.5 rounded-lg text-xs font-medium transition-all ${
                              showItemDetails
                                ? 'bg-primary text-white'
                                : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                            }`}
                            title="Detalle"
                          >
                            <Package className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleAddItem(lista.id)}
                            disabled={savingItem || !newItemName.trim()}
                            className="btn btn-primary text-xs px-3"
                          >
                            {savingItem ? '...' : <Plus className="w-3.5 h-3.5" />}
                          </button>
                        </div>

                        {/* Suggestions dropdown */}
                        {showSuggestions && suggestions.length > 0 && (
                          <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-20 py-1">
                            {suggestions.map((s, idx) => {
                              const priceInfo = getLastPrice(s)
                              return (
                                <button
                                  key={idx}
                                  className="w-full text-left px-3 py-1.5 text-sm hover:bg-slate-50 flex items-center justify-between"
                                  onMouseDown={e => { e.preventDefault(); handleSuggestionSelect(s) }}
                                >
                                  <span className="text-slate-700">{s}</span>
                                  {priceInfo && (
                                    <span className="text-[10px] text-slate-400">
                                      ${formatPrice(priceInfo.precio)}
                                      {priceInfo.variacion !== null && (
                                        <span className={priceInfo.variacion > 0 ? 'text-red-500 ml-1' : 'text-emerald-500 ml-1'}>
                                          {priceInfo.variacion > 0 ? '+' : ''}{priceInfo.variacion}%
                                        </span>
                                      )}
                                    </span>
                                  )}
                                </button>
                              )
                            })}
                          </div>
                        )}
                      </div>

                      {/* Expanded details (metadata colapsable) */}
                      {showItemDetails && (
                        <div className="mt-2 space-y-2">
                          <div className="flex flex-wrap gap-2">
                            <div className="flex items-center gap-1">
                              <label className="text-[10px] text-slate-500 uppercase font-bold">Cant.</label>
                              <input
                                type="number"
                                className="input w-16 text-sm text-center"
                                value={newItemCantidad}
                                min="0.1"
                                step="0.5"
                                onChange={e => setNewItemCantidad(e.target.value)}
                              />
                            </div>
                            <div className="flex items-center gap-1">
                              <label className="text-[10px] text-slate-500 uppercase font-bold">Unid.</label>
                              <select
                                className="input text-sm pr-6"
                                value={newItemUnidad}
                                onChange={e => setNewItemUnidad(e.target.value)}
                              >
                                {UNIDADES.map(u => (
                                  <option key={u} value={u}>{UNIDAD_LABELS[u]}</option>
                                ))}
                              </select>
                            </div>
                            <div className="flex items-center gap-1">
                              <label className="text-[10px] text-slate-500 uppercase font-bold">Precio</label>
                              <div className="flex items-center gap-1">
                                <select
                                  className="input text-sm w-16"
                                  value={newItemMoneda}
                                  onChange={e => setNewItemMoneda(e.target.value as 'ARS' | 'USD')}
                                >
                                  <option value="ARS">$</option>
                                  <option value="USD">US$</option>
                                </select>
                                <input
                                  type="number"
                                  className="input w-24 text-sm"
                                  placeholder="0"
                                  value={newItemPrecio}
                                  min="0"
                                  onChange={e => setNewItemPrecio(e.target.value)}
                                />
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <div className="flex items-center gap-1 flex-1 min-w-[140px]">
                              <Tag className="w-3 h-3 text-slate-400 shrink-0" />
                              <select
                                className="input text-sm"
                                value={newItemCategoria}
                                onChange={e => setNewItemCategoria(e.target.value)}
                              >
                                <option value="">Sin categoria</option>
                                {Object.entries(CATEGORY_MAP).map(([key, val]) => (
                                  <option key={key} value={key}>{val.icon} {val.label}</option>
                                ))}
                              </select>
                            </div>
                            <div className="flex items-center gap-1 flex-1 min-w-[120px]">
                              <Store className="w-3 h-3 text-slate-400 shrink-0" />
                              <input
                                type="text"
                                className="input text-sm"
                                placeholder="Tienda"
                                value={newItemTienda}
                                onChange={e => setNewItemTienda(e.target.value)}
                              />
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <StickyNote className="w-3 h-3 text-slate-400 shrink-0" />
                            <input
                              type="text"
                              className="input text-sm"
                              placeholder="Nota..."
                              value={newItemNota}
                              onChange={e => setNewItemNota(e.target.value)}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Category grouping toggle */}
                    {stats.total > 0 && (
                      <div className="px-4 py-1.5 flex items-center justify-end border-b border-slate-50">
                        <button
                          onClick={() => setGroupByCategory(!groupByCategory)}
                          className={`text-[10px] font-medium px-2 py-0.5 rounded transition-colors ${
                            groupByCategory ? 'bg-primary-50 text-primary-700' : 'text-slate-400 hover:text-slate-600'
                          }`}
                        >
                          {groupByCategory ? 'Agrupado' : 'Agrupar'}
                        </button>
                      </div>
                    )}

                    {/* Items list */}
                    <div>
                      {sortedItems(lista.id).length === 0 ? (
                        <div className="p-6 text-center text-sm text-slate-400">
                          Lista vacia. Agrega items arriba.
                        </div>
                      ) : groupByCategory ? (
                        // Grouped view
                        groupedItems(lista.id).map(group => (
                          <div key={group.key}>
                            {group.label && (
                              <div className="px-4 py-1.5 bg-slate-50/80 border-b border-slate-100">
                                <span className="text-[10px] font-bold uppercase text-slate-500">
                                  {(group as any).icon} {group.label}
                                </span>
                              </div>
                            )}
                            {group.items.map(item => (
                              <ItemRow
                                key={item.id}
                                item={item}
                                onToggle={handleToggleComprado}
                                onDelete={id => setDeleteTarget({ type: 'item', id, listaId: item.lista_id })}
                                formatPrice={formatPrice}
                              />
                            ))}
                          </div>
                        ))
                      ) : (
                        // Flat view
                        sortedItems(lista.id).map(item => (
                          <ItemRow
                            key={item.id}
                            item={item}
                            onToggle={handleToggleComprado}
                            onDelete={id => setDeleteTarget({ type: 'item', id, listaId: item.lista_id })}
                            formatPrice={formatPrice}
                          />
                        ))
                      )}
                    </div>

                    {/* Footer summary */}
                    {stats.total > 0 && (
                      <div className="px-4 py-2.5 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                        <span>{stats.pendientes} pendiente{stats.pendientes !== 1 ? 's' : ''}</span>
                        {stats.estimado > 0 && (
                          <span className="font-medium">Estimado: ${formatPrice(stats.estimado)}</span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Create/Edit List Modal */}
      {showListModal && (
        <div className="modal-overlay" onClick={() => setShowListModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h2 className="section-title">{editingList ? 'Editar lista' : 'Nueva lista'}</h2>
              <button onClick={() => setShowListModal(false)} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="label">Icono</label>
                <div className="flex flex-wrap gap-1.5">
                  {ICONOS_LISTAS.map(emoji => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setListForm(prev => ({ ...prev, icono: emoji }))}
                      className={`w-10 h-10 rounded-xl text-xl flex items-center justify-center transition-all ${
                        listForm.icono === emoji
                          ? 'bg-primary-100 ring-2 ring-primary shadow-sm'
                          : 'bg-slate-100 hover:bg-slate-200'
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="label">Nombre de la lista</label>
                <input
                  type="text"
                  className="input"
                  placeholder="Ej: Supermercado, Ferreteria..."
                  maxLength={60}
                  value={listForm.nombre}
                  onChange={e => setListForm(prev => ({ ...prev, nombre: e.target.value }))}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && listForm.nombre.trim()) handleSaveList()
                  }}
                  autoFocus
                />
              </div>
            </div>

            <div className="p-5 border-t border-slate-100 flex gap-3">
              <button onClick={() => setShowListModal(false)} className="btn btn-secondary flex-1">
                Cancelar
              </button>
              <button
                onClick={handleSaveList}
                disabled={savingList || !listForm.nombre.trim() || !currentWorkspace?.id}
                className="btn btn-primary flex-1"
              >
                {savingList ? 'Guardando...' : editingList ? 'Guardar' : 'Crear lista'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete Modal */}
      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title={deleteTarget?.type === 'list' ? 'Eliminar lista' : 'Eliminar item'}
        message={
          deleteTarget?.type === 'list'
            ? 'Se eliminaran la lista y todos sus items.'
            : 'Eliminar este item de la lista?'
        }
        confirmText="Eliminar"
        variant="danger"
      />

      {/* Toast Undo Global */}
      {undoToast && (
        <div className="toast-undo">
          <span>{undoToast.message}</span>
          {undoToast.snapshot && (
            <button onClick={performUndo}>
              <RotateCcw className="w-3 h-3 inline mr-1" />
              Deshacer
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Item Row Component ──

function ItemRow({
  item,
  onToggle,
  onDelete,
  formatPrice,
}: {
  item: ItemLista
  onToggle: (item: ItemLista) => void
  onDelete: (id: string) => void
  formatPrice: (n: number) => string
}) {
  const [showMeta, setShowMeta] = useState(false)
  const hasMeta = !!(item.nota || item.categoria || item.tienda)
  const priceInfo = getLastPrice(item.nombre)

  return (
    <div
      className={`border-b border-slate-50 transition-all ${
        item.comprado ? 'bg-slate-50/50 opacity-60' : 'hover:bg-slate-50/30'
      }`}
    >
      <div className="flex items-center gap-3 px-4 py-2.5">
        {/* Checkbox */}
        <button
          onClick={() => onToggle(item)}
          className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all ${
            item.comprado
              ? 'bg-emerald-500 border-emerald-500'
              : 'border-slate-300 hover:border-primary'
          }`}
        >
          {item.comprado && <Check className="w-3 h-3 text-white" />}
        </button>

        {/* Info */}
        <div
          className="flex-1 min-w-0 cursor-pointer"
          onClick={() => hasMeta && setShowMeta(!showMeta)}
        >
          <span className={`text-sm ${item.comprado ? 'line-through text-slate-400' : 'text-slate-700'}`}>
            {item.nombre}
          </span>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-[11px] text-slate-400">
              {item.cantidad} {UNIDAD_LABELS[item.unidad] || item.unidad}
            </span>
            {item.precio_estimado != null && item.precio_estimado > 0 && (
              <span className="text-[11px] text-slate-400">
                {item.moneda === 'USD' ? 'US$' : '$'}{formatPrice(item.precio_estimado * item.cantidad)}
              </span>
            )}
            {/* Variacion de precio */}
            {priceInfo?.variacion !== null && priceInfo?.variacion !== undefined && !item.comprado && (
              <span className={`text-[10px] font-medium ${
                priceInfo.variacion > 0 ? 'text-red-500' : priceInfo.variacion < 0 ? 'text-emerald-500' : 'text-slate-400'
              }`}>
                {priceInfo.variacion > 0 ? '+' : ''}{priceInfo.variacion}%
              </span>
            )}
            {item.categoria && CATEGORY_MAP[item.categoria] && (
              <span className="text-[10px] text-slate-300">{CATEGORY_MAP[item.categoria].icon}</span>
            )}
            {hasMeta && (
              <ChevronDown className={`w-3 h-3 text-slate-300 transition-transform ${showMeta ? 'rotate-180' : ''}`} />
            )}
          </div>
        </div>

        {/* Delete */}
        <button
          onClick={() => onDelete(item.id)}
          className="p-1 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors flex-shrink-0"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Collapsible metadata */}
      {showMeta && hasMeta && (
        <div className="px-12 pb-2 flex flex-wrap gap-2 text-[10px] text-slate-400">
          {item.categoria && CATEGORY_MAP[item.categoria] && (
            <span className="bg-slate-100 px-2 py-0.5 rounded">
              {CATEGORY_MAP[item.categoria].icon} {CATEGORY_MAP[item.categoria].label}
            </span>
          )}
          {item.tienda && (
            <span className="bg-slate-100 px-2 py-0.5 rounded">
              <Store className="w-2.5 h-2.5 inline mr-0.5" />{item.tienda}
            </span>
          )}
          {item.nota && (
            <span className="bg-slate-100 px-2 py-0.5 rounded">
              <StickyNote className="w-2.5 h-2.5 inline mr-0.5" />{item.nota}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
