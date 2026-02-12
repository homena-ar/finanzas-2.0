'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useWorkspace } from '@/hooks/useWorkspace'
import {
  collection, addDoc, updateDoc, deleteDoc, doc,
  getDocs, query, where, orderBy, serverTimestamp, writeBatch
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { ListaCompra, ItemLista } from '@/types'
import {
  Plus, Edit2, Trash2, X, ShoppingCart, ChevronDown, ChevronRight,
  Check, Clock, Package
} from 'lucide-react'
import { ConfirmModal } from '@/components/Modal'

const UNIDADES = ['u', 'kg', 'g', 'L', 'ml', 'pack', 'doc']
const UNIDAD_LABELS: Record<string, string> = {
  u: 'unid.', kg: 'kg', g: 'g', L: 'L', ml: 'ml', pack: 'pack', doc: 'doc'
}

const ICONOS_LISTAS = ['🛒', '🏪', '🏠', '💊', '🔧', '🧹', '🐾', '👶', '🎒', '📦', '🍎', '🥩']

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
  const [showItemDetails, setShowItemDetails] = useState(false)
  const [savingItem, setSavingItem] = useState(false)
  const itemInputRef = useRef<HTMLInputElement>(null)

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'list' | 'item'; id: string; listaId?: string } | null>(null)

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

  useEffect(() => { fetchListas() }, [fetchListas])

  useEffect(() => {
    if (expandedListId) {
      fetchItems(expandedListId)
    }
  }, [expandedListId, fetchItems])

  // ── List CRUD ──

  const openNewList = () => {
    setListForm({ nombre: '', icono: '🛒' })
    setEditingList(null)
    setShowListModal(true)
  }

  const openEditList = (l: ListaCompra) => {
    setEditingList(l)
    setListForm({ nombre: l.nombre, icono: l.icono })
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

  const handleDeleteList = async (listaId: string) => {
    if (!user || !currentWorkspace?.id) return
    try {
      // Delete all items in the list first
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
    } catch (e) {
      console.error('[Listas] Error deleting list:', e)
    }
  }

  // ── Item CRUD ──

  const resetItemForm = () => {
    setNewItemName('')
    setNewItemCantidad('1')
    setNewItemUnidad('u')
    setNewItemPrecio('')
    setNewItemMoneda('ARS')
    setShowItemDetails(false)
  }

  const handleAddItem = async (listaId: string) => {
    if (!user || !newItemName.trim() || !currentWorkspace?.id) return
    setSavingItem(true)
    try {
      const data: any = {
        lista_id: listaId,
        nombre: newItemName.trim(),
        cantidad: parseFloat(newItemCantidad) || 1,
        unidad: newItemUnidad,
        precio_estimado: newItemPrecio ? parseFloat(newItemPrecio) : null,
        moneda: newItemMoneda,
        comprado: false,
        user_id: user.uid,
        workspace_id: currentWorkspace.id,
        created_by: user.uid,
        created_at: serverTimestamp(),
      }
      await addDoc(collection(db, 'items_lista'), data)
      resetItemForm()
      await fetchItems(listaId)
      setTimeout(() => itemInputRef.current?.focus(), 100)
    } catch (e) {
      console.error('[Listas] Error adding item:', e)
    }
    setSavingItem(false)
  }

  const handleToggleComprado = async (item: ItemLista) => {
    try {
      await updateDoc(doc(db, 'items_lista', item.id), { comprado: !item.comprado })
      await fetchItems(item.lista_id)
    } catch (e) {
      console.error('[Listas] Error toggling item:', e)
    }
  }

  const handleDeleteItem = async (item: ItemLista) => {
    try {
      await deleteDoc(doc(db, 'items_lista', item.id))
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
      const listItems = Object.values(items).flat()
      const item = listItems.find(i => i.id === deleteTarget.id)
      if (item) await handleDeleteItem(item)
    }
    setDeleteTarget(null)
  }

  const toggleExpand = (listaId: string) => {
    setExpandedListId(prev => prev === listaId ? null : listaId)
    resetItemForm()
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

  // Sort items: pending first, then bought
  const sortedItems = (listaId: string) => {
    const listItems = items[listaId] || []
    return [...listItems].sort((a, b) => {
      if (a.comprado !== b.comprado) return a.comprado ? 1 : -1
      return 0
    })
  }

  // ── Render ──

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6 animate-fade-in">
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
          <p className="text-slate-500 mb-4">No tenés listas de compras todavía</p>
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
                <button
                  onClick={() => toggleExpand(lista.id)}
                  className="w-full p-4 flex items-center gap-3 hover:bg-slate-50/50 transition-colors"
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
                            <span className="text-xs text-slate-400">
                              ~${formatPrice(stats.estimado)} pend.
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-xs text-slate-400">Sin items</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={e => { e.stopPropagation(); openEditList(lista) }}
                      className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); setDeleteTarget({ type: 'list', id: lista.id }) }}
                      className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    {isExpanded
                      ? <ChevronDown className="w-4 h-4 text-slate-400" />
                      : <ChevronRight className="w-4 h-4 text-slate-400" />}
                  </div>
                </button>

                {/* Expanded: items */}
                {isExpanded && (
                  <div className="border-t border-slate-100">
                    {/* Quick-add item */}
                    <div className="p-3 bg-slate-50/50 border-b border-slate-100">
                      <div className="flex gap-2">
                        <input
                          ref={itemInputRef}
                          type="text"
                          className="input flex-1 text-sm"
                          placeholder="Agregar item..."
                          value={newItemName}
                          onChange={e => setNewItemName(e.target.value)}
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

                      {/* Expanded details */}
                      {showItemDetails && (
                        <div className="mt-2 flex flex-wrap gap-2">
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
                            <label className="text-[10px] text-slate-500 uppercase font-bold">Precio est.</label>
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
                      )}
                    </div>

                    {/* Items list */}
                    <div className="divide-y divide-slate-50">
                      {sortedItems(lista.id).length === 0 ? (
                        <div className="p-6 text-center text-sm text-slate-400">
                          Lista vacía. Agregá items arriba.
                        </div>
                      ) : (
                        sortedItems(lista.id).map(item => (
                          <div
                            key={item.id}
                            className={`flex items-center gap-3 px-4 py-2.5 transition-all ${
                              item.comprado ? 'bg-slate-50/50 opacity-60' : 'hover:bg-slate-50/30'
                            }`}
                          >
                            {/* Checkbox */}
                            <button
                              onClick={() => handleToggleComprado(item)}
                              className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all ${
                                item.comprado
                                  ? 'bg-emerald-500 border-emerald-500'
                                  : 'border-slate-300 hover:border-primary'
                              }`}
                            >
                              {item.comprado && <Check className="w-3 h-3 text-white" />}
                            </button>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <span className={`text-sm ${item.comprado ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                                {item.nombre}
                              </span>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[11px] text-slate-400">
                                  {item.cantidad} {UNIDAD_LABELS[item.unidad] || item.unidad}
                                </span>
                                {item.precio_estimado != null && item.precio_estimado > 0 && (
                                  <span className="text-[11px] text-slate-400">
                                    {item.moneda === 'USD' ? 'US$' : '$'}{formatPrice(item.precio_estimado * item.cantidad)}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Delete */}
                            <button
                              onClick={() => setDeleteTarget({ type: 'item', id: item.id, listaId: item.lista_id })}
                              className="p-1 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors flex-shrink-0"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
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
              {/* Icono */}
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

              {/* Nombre */}
              <div>
                <label className="label">Nombre de la lista</label>
                <input
                  type="text"
                  className="input"
                  placeholder="Ej: Supermercado, Ferretería..."
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
            ? 'Se eliminarán la lista y todos sus items. Esta acción no se puede deshacer.'
            : '¿Eliminar este item de la lista?'
        }
        confirmText="Eliminar"
        variant="danger"
      />
    </div>
  )
}
