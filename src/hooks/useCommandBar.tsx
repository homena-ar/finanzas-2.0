'use client'

// ============================================
// COMMAND BAR - STATE MANAGEMENT HOOK
// ============================================
// Provides the full command bar pipeline:
//   Input -> Preprocess -> Parse -> Execute -> Result
// Also manages history, undo timers, clarification state, and metrics.

import { useState, useCallback, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useData } from './useData'
import { useAuth } from './useAuth'
import { useWorkspace } from './useWorkspace'
import { parseCommand } from '@/lib/commandbar/parser'
import { executeCommand, type ExecutorContext } from '@/lib/commandbar/executor'
import type {
  CommandBarState,
  CommandHistoryEntry,
  CommandResult,
  ParsedCommand,
  ClarificationField,
  CommandMetrics,
  UndoAction,
} from '@/lib/commandbar/types'
import {
  collection, addDoc, getDocs, deleteDoc, doc,
  query, where, orderBy, serverTimestamp, writeBatch,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'

const MAX_HISTORY = 20
const UNDO_TIMEOUT = 6000

// --- Metrics persistence ---
const METRICS_KEY = 'fincontrol:commandbar_metrics'

function loadMetrics(): CommandMetrics {
  if (typeof window === 'undefined') {
    return { totalCommands: 0, resolvedLocally: 0, resolvedByAI: 0, failedCommands: 0, intentCounts: {} }
  }
  try {
    const raw = localStorage.getItem(METRICS_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return { totalCommands: 0, resolvedLocally: 0, resolvedByAI: 0, failedCommands: 0, intentCounts: {} }
}

function saveMetrics(metrics: CommandMetrics) {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(METRICS_KEY, JSON.stringify(metrics)) } catch { /* ignore */ }
}

// --- History persistence ---
const HISTORY_KEY = 'fincontrol:commandbar_history'

function loadHistory(): CommandHistoryEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return []
}

function saveHistory(history: CommandHistoryEntry[]) {
  if (typeof window === 'undefined') return
  try {
    // Only save last MAX_HISTORY entries, and strip undo_action (not serializable)
    const toSave = history.slice(0, MAX_HISTORY).map(h => ({
      ...h,
      result: h.result ? { ...h.result, undo_action: undefined } : null,
    }))
    localStorage.setItem(HISTORY_KEY, JSON.stringify(toSave))
  } catch { /* ignore */ }
}

// --- Main Hook ---

export function useCommandBar() {
  const router = useRouter()
  const { user } = useAuth()
  const { currentWorkspace } = useWorkspace()
  const data = useData()

  const [isOpen, setIsOpen] = useState(false)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [history, setHistory] = useState<CommandHistoryEntry[]>(() => loadHistory())
  const [lastResult, setLastResult] = useState<CommandResult | null>(null)
  const [clarification, setClarification] = useState<ClarificationField[] | null>(null)
  const [pendingCommand, setPendingCommand] = useState<ParsedCommand | null>(null)
  const [undoAction, setUndoAction] = useState<UndoAction | null>(null)
  const [undoTimeout, setUndoTimeoutState] = useState<number | null>(null)

  const metricsRef = useRef<CommandMetrics>(loadMetrics())
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // --- Keyboard shortcut: Ctrl+K / Cmd+K ---
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setIsOpen(prev => !prev)
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isOpen])

  // --- Persist history on change ---
  useEffect(() => {
    saveHistory(history)
  }, [history])

  // --- Build executor context ---
  const buildContext = useCallback((): ExecutorContext => {
    // Shopping list operations (direct Firestore)
    const addShoppingList = async (name: string, icon: string) => {
      if (!user || !currentWorkspace?.id) return null
      try {
        const docRef = await addDoc(collection(db, 'listas_compra'), {
          nombre: name,
          icono: icon,
          user_id: user.uid,
          workspace_id: currentWorkspace.id,
          created_by: user.uid,
          created_at: serverTimestamp(),
        })
        return { id: docRef.id }
      } catch { return null }
    }

    const addShoppingItems = async (listId: string, items: any[]) => {
      if (!user || !currentWorkspace?.id) return false
      try {
        for (const item of items) {
          await addDoc(collection(db, 'items_lista'), {
            lista_id: listId,
            nombre: item.name,
            cantidad: item.qty || 1,
            unidad: item.unit || 'u',
            precio_estimado: item.price || null,
            moneda: item.currency || 'ARS',
            comprado: false,
            user_id: user.uid,
            workspace_id: currentWorkspace.id,
            created_by: user.uid,
            created_at: serverTimestamp(),
          })
        }
        return true
      } catch { return false }
    }

    const findShoppingList = (name: string) => {
      // This requires loading lists - we'll search from cached state
      // The CommandBar component will pass pre-loaded lists
      return null // Will be overridden in component
    }

    const clearCompletedItems = async (listId: string) => {
      if (!user || !currentWorkspace?.id) return false
      try {
        const snap = await getDocs(
          query(
            collection(db, 'items_lista'),
            where('lista_id', '==', listId),
            where('comprado', '==', true)
          )
        )
        const batch = writeBatch(db)
        snap.docs.forEach(d => batch.delete(d.ref))
        await batch.commit()
        return true
      } catch { return false }
    }

    const getShoppingListStats = async (listId: string) => {
      try {
        const snap = await getDocs(
          query(collection(db, 'items_lista'), where('lista_id', '==', listId))
        )
        const items = snap.docs.map(d => d.data())
        return {
          total: items.length,
          completed: items.filter(i => i.comprado).length,
          estimated: items.filter(i => !i.comprado && i.precio_estimado)
            .reduce((s, i) => s + (i.precio_estimado * (i.cantidad || 1)), 0),
        }
      } catch { return { total: 0, completed: 0, estimated: 0 } }
    }

    // Reminder operations
    const addReminder = async (reminderData: any) => {
      if (!user || !currentWorkspace?.id) return null
      try {
        const docRef = await addDoc(collection(db, 'recordatorios'), {
          ...reminderData,
          user_id: user.uid,
          workspace_id: currentWorkspace.id,
          created_by: user.uid,
          created_at: serverTimestamp(),
          updated_at: serverTimestamp(),
        })
        return { id: docRef.id }
      } catch { return null }
    }

    const getRemindersForDate = (date: string) => {
      // Will be populated from loaded reminders
      return []
    }

    const getActiveReminders = () => {
      // Will be populated from loaded reminders
      return []
    }

    return {
      addGasto: data.addGasto,
      deleteGasto: data.deleteGasto,
      addIngreso: data.addIngreso,
      deleteIngreso: data.deleteIngreso,
      addMovimiento: data.addMovimiento,
      addMeta: data.addMeta,
      updateMeta: data.updateMeta,
      gastos: data.gastos,
      ingresos: data.ingresos,
      movimientos: data.movimientos,
      metas: data.metas,
      categorias: data.categorias,
      monthKey: data.monthKey,
      getGastosMes: data.getGastosMes,
      getIngresosMes: data.getIngresosMes,
      addShoppingList,
      addShoppingItems,
      findShoppingList,
      clearCompletedItems,
      getShoppingListStats,
      addReminder,
      getRemindersForDate,
      getActiveReminders,
      navigate: (path: string) => router.push(path),
      dolarRate: 0, // Will be set by component
    }
  }, [user, currentWorkspace, data, router])

  // --- Execute a command ---
  const execute = useCallback(async (rawInput: string, extraContext?: Partial<ExecutorContext>) => {
    if (!rawInput.trim()) return

    setLoading(true)
    setClarification(null)
    setLastResult(null)

    // Track metrics
    metricsRef.current.totalCommands++

    // Parse locally
    const parsed = parseCommand(rawInput)

    if (!parsed) {
      // No local match - could call AI here, but for now show helpful message
      metricsRef.current.failedCommands++
      saveMetrics(metricsRef.current)

      const result: CommandResult = {
        success: false,
        message: 'No entendí el comando. Probá con algo como "gasto 2000 Carrefour" o "balance del mes".',
      }
      setLastResult(result)
      addToHistory(rawInput, null, result)
      setLoading(false)
      return
    }

    // If needs clarification or low confidence
    if (parsed.needs_clarification.length > 0 || parsed.confidence < 0.75) {
      setClarification(parsed.needs_clarification)
      setPendingCommand(parsed)
      setLoading(false)
      metricsRef.current.resolvedLocally++
      saveMetrics(metricsRef.current)
      return
    }

    // Execute
    const ctx = { ...buildContext(), ...extraContext }
    const result = await executeCommand(parsed, ctx)

    // Track intent
    metricsRef.current.resolvedLocally++
    metricsRef.current.intentCounts[parsed.intent] = (metricsRef.current.intentCounts[parsed.intent] || 0) + 1
    saveMetrics(metricsRef.current)

    // Handle undo
    if (result.undo_action) {
      setupUndo(result.undo_action)
    }

    setLastResult(result)
    addToHistory(rawInput, parsed, result)
    setInput('')
    setLoading(false)

    // Navigate if needed
    if (result.navigate_to && result.success) {
      // Don't auto-navigate for queries, just show the result
      // Only navigate for actions if explicitly requested
    }
  }, [buildContext])

  // --- Resolve clarification ---
  const resolveClarification = useCallback(async (field: string, value: any, extraContext?: Partial<ExecutorContext>) => {
    if (!pendingCommand) return

    // If the user cancelled
    if (value === 'cancel') {
      setClarification(null)
      setPendingCommand(null)
      return
    }

    // If this is a domain clarification (ambiguous command)
    if (field === 'domain') {
      if (value === 'shopping_list') {
        // Re-parse as shopping list command with first available list
        const updatedCommand: ParsedCommand = {
          ...pendingCommand,
          intent: 'add_shopping_items',
          confidence: 0.90,
          needs_clarification: pendingCommand.needs_clarification.filter(c => c.field !== 'domain'),
          params: {
            ...pendingCommand.params,
            list_name: 'Supermercado', // Default
          },
        }

        if (updatedCommand.needs_clarification.length > 0) {
          setClarification(updatedCommand.needs_clarification)
          setPendingCommand(updatedCommand)
          return
        }

        const ctx = { ...buildContext(), ...extraContext }
        setLoading(true)
        const result = await executeCommand(updatedCommand, ctx)
        setLastResult(result)
        addToHistory(pendingCommand.raw_input, updatedCommand, result)
        setClarification(null)
        setPendingCommand(null)
        setInput('')
        setLoading(false)
        return
      }

      if (value === 'expense') {
        // Re-parse as expense creation
        const items = pendingCommand.params.items
        const itemName = items?.[0]?.name || ''
        const updatedCommand: ParsedCommand = {
          ...pendingCommand,
          intent: 'create_expense',
          confidence: 0.70,
          needs_clarification: [{ field: 'amount', message: `¿Cuánto fue "${itemName}"?` }],
          params: { merchant: itemName, currency: 'ARS', date: new Date().toISOString().split('T')[0] },
        }
        setClarification(updatedCommand.needs_clarification)
        setPendingCommand(updatedCommand)
        return
      }
    }

    // Update the command params with the clarified value
    const updatedCommand: ParsedCommand = {
      ...pendingCommand,
      params: { ...pendingCommand.params, [field]: value },
      needs_clarification: pendingCommand.needs_clarification.filter(c => c.field !== field),
      confidence: Math.min(pendingCommand.confidence + 0.15, 0.95),
    }

    // If still needs more clarification
    if (updatedCommand.needs_clarification.length > 0 || updatedCommand.confidence < 0.75) {
      setClarification(updatedCommand.needs_clarification)
      setPendingCommand(updatedCommand)
      return
    }

    // Execute the now-complete command
    const ctx = { ...buildContext(), ...extraContext }
    setLoading(true)
    const result = await executeCommand(updatedCommand, ctx)

    if (result.undo_action) {
      setupUndo(result.undo_action)
    }

    setLastResult(result)
    addToHistory(pendingCommand.raw_input, updatedCommand, result)
    setClarification(null)
    setPendingCommand(null)
    setInput('')
    setLoading(false)
  }, [pendingCommand, buildContext])

  // --- Undo ---
  const setupUndo = useCallback((action: UndoAction) => {
    // Clear previous undo timer
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current)
    }

    setUndoAction(action)
    const startTime = Date.now()
    setUndoTimeoutState(startTime + UNDO_TIMEOUT)

    undoTimerRef.current = setTimeout(() => {
      setUndoAction(null)
      setUndoTimeoutState(null)
    }, UNDO_TIMEOUT)
  }, [])

  const performUndo = useCallback(async () => {
    if (!undoAction) return

    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current)
    }

    try {
      await undoAction.execute()
      setLastResult({ success: true, message: 'Acción deshecha' })
    } catch {
      setLastResult({ success: false, message: 'No se pudo deshacer la acción' })
    }

    setUndoAction(null)
    setUndoTimeoutState(null)
  }, [undoAction])

  // --- History ---
  const addToHistory = useCallback((input: string, parsed: ParsedCommand | null, result: CommandResult) => {
    const entry: CommandHistoryEntry = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
      input,
      parsed,
      result,
      timestamp: Date.now(),
    }
    setHistory(prev => [entry, ...prev].slice(0, MAX_HISTORY))
  }, [])

  const clearHistory = useCallback(() => {
    setHistory([])
    if (typeof window !== 'undefined') {
      localStorage.removeItem(HISTORY_KEY)
    }
  }, [])

  // --- Open/Close ---
  const open = useCallback(() => {
    setIsOpen(true)
    setClarification(null)
    setLastResult(null)
  }, [])

  const close = useCallback(() => {
    setIsOpen(false)
    setInput('')
    setClarification(null)
    setPendingCommand(null)
    setLastResult(null)
  }, [])

  const toggle = useCallback(() => {
    if (isOpen) close()
    else open()
  }, [isOpen, open, close])

  // --- Repeat from history ---
  const repeatCommand = useCallback((historyEntry: CommandHistoryEntry) => {
    setInput(historyEntry.input)
  }, [])

  return {
    // State
    isOpen,
    input,
    loading,
    history,
    lastResult,
    clarification,
    pendingCommand,
    undoAction,
    undoTimeout,
    metrics: metricsRef.current,

    // Actions
    setInput,
    execute,
    resolveClarification,
    performUndo,
    open,
    close,
    toggle,
    clearHistory,
    repeatCommand,
  }
}
