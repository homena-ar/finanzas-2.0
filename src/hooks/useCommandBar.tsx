'use client'

// ============================================
// COMMAND BAR - CONTEXT + STATE MANAGEMENT
// ============================================
// Uses React Context so layout and CommandBar component share the SAME state.
// Pipeline: Input -> Preprocess -> Parse -> Execute -> Result

import { useState, useCallback, useRef, useEffect, createContext, useContext, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { useData } from './useData'
import { useAuth } from './useAuth'
import { useWorkspace } from './useWorkspace'
import { parseCommand } from '@/lib/commandbar/parser'
import { executeCommand, type ExecutorContext } from '@/lib/commandbar/executor'
import type {
  CommandHistoryEntry,
  CommandResult,
  ParsedCommand,
  ClarificationField,
  CommandMetrics,
  UndoAction,
} from '@/lib/commandbar/types'
import {
  collection, addDoc, getDocs,
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
    const toSave = history.slice(0, MAX_HISTORY).map(h => ({
      ...h,
      result: h.result ? { ...h.result, undo_action: undefined } : null,
    }))
    localStorage.setItem(HISTORY_KEY, JSON.stringify(toSave))
  } catch { /* ignore */ }
}

// --- Context type ---

interface CommandBarContextValue {
  isOpen: boolean
  input: string
  loading: boolean
  history: CommandHistoryEntry[]
  lastResult: CommandResult | null
  clarification: ClarificationField[] | null
  pendingCommand: ParsedCommand | null
  undoAction: UndoAction | null
  undoTimeout: number | null
  metrics: CommandMetrics
  setInput: (v: string) => void
  execute: (rawInput: string, extraContext?: Partial<ExecutorContext>) => Promise<void>
  resolveClarification: (field: string, value: any, extraContext?: Partial<ExecutorContext>) => Promise<void>
  performUndo: () => Promise<void>
  open: () => void
  close: () => void
  toggle: () => void
  clearHistory: () => void
  repeatCommand: (entry: CommandHistoryEntry) => void
}

const CommandBarContext = createContext<CommandBarContextValue | null>(null)

// --- Provider ---

export function CommandBarProvider({ children }: { children: ReactNode }) {
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
        setInput('')
        setClarification(null)
        setPendingCommand(null)
        setLastResult(null)
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

    const findShoppingList = (_name: string) => {
      return null // Will be overridden by extraContext from CommandBar
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

    const getRemindersForDate = (_date: string) => [] as any[]
    const getActiveReminders = () => [] as any[]

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
      dolarRate: 0,
    }
  }, [user, currentWorkspace, data, router])

  // --- History helper ---
  const addToHistory = useCallback((inputText: string, parsed: ParsedCommand | null, result: CommandResult) => {
    const entry: CommandHistoryEntry = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
      input: inputText,
      parsed,
      result,
      timestamp: Date.now(),
    }
    setHistory(prev => [entry, ...prev].slice(0, MAX_HISTORY))
  }, [])

  // --- Execute a command ---
  const execute = useCallback(async (rawInput: string, extraContext?: Partial<ExecutorContext>) => {
    if (!rawInput.trim()) return

    setLoading(true)
    setClarification(null)
    setLastResult(null)

    metricsRef.current.totalCommands++

    const parsed = parseCommand(rawInput)

    if (!parsed) {
      metricsRef.current.failedCommands++
      saveMetrics(metricsRef.current)

      const result: CommandResult = {
        success: false,
        message: 'No entendi el comando. Proba con algo como "gasto 2000 Carrefour" o "balance del mes".',
      }
      setLastResult(result)
      addToHistory(rawInput, null, result)
      setLoading(false)
      return
    }

    if (parsed.needs_clarification.length > 0 || parsed.confidence < 0.75) {
      setClarification(parsed.needs_clarification)
      setPendingCommand(parsed)
      setLoading(false)
      metricsRef.current.resolvedLocally++
      saveMetrics(metricsRef.current)
      return
    }

    const ctx = { ...buildContext(), ...extraContext }
    const result = await executeCommand(parsed, ctx)

    metricsRef.current.resolvedLocally++
    metricsRef.current.intentCounts[parsed.intent] = (metricsRef.current.intentCounts[parsed.intent] || 0) + 1
    saveMetrics(metricsRef.current)

    if (result.undo_action) {
      setupUndo(result.undo_action)
    }

    setLastResult(result)
    addToHistory(rawInput, parsed, result)
    setInput('')
    setLoading(false)
  }, [buildContext, addToHistory])

  // --- Resolve clarification ---
  const resolveClarification = useCallback(async (field: string, value: any, extraContext?: Partial<ExecutorContext>) => {
    if (!pendingCommand) return

    if (value === 'cancel') {
      setClarification(null)
      setPendingCommand(null)
      return
    }

    if (field === 'domain') {
      if (value === 'shopping_list') {
        const updatedCommand: ParsedCommand = {
          ...pendingCommand,
          intent: 'add_shopping_items',
          confidence: 0.90,
          needs_clarification: pendingCommand.needs_clarification.filter(c => c.field !== 'domain'),
          params: { ...pendingCommand.params, list_name: 'Supermercado' },
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
        const items = pendingCommand.params.items
        const itemName = items?.[0]?.name || ''
        const updatedCommand: ParsedCommand = {
          ...pendingCommand,
          intent: 'create_expense',
          confidence: 0.70,
          needs_clarification: [{ field: 'amount', message: `Cuanto fue "${itemName}"?` }],
          params: { merchant: itemName, currency: 'ARS', date: new Date().toISOString().split('T')[0] },
        }
        setClarification(updatedCommand.needs_clarification)
        setPendingCommand(updatedCommand)
        return
      }
    }

    const updatedCommand: ParsedCommand = {
      ...pendingCommand,
      params: { ...pendingCommand.params, [field]: value },
      needs_clarification: pendingCommand.needs_clarification.filter(c => c.field !== field),
      confidence: Math.min(pendingCommand.confidence + 0.15, 0.95),
    }

    if (updatedCommand.needs_clarification.length > 0 || updatedCommand.confidence < 0.75) {
      setClarification(updatedCommand.needs_clarification)
      setPendingCommand(updatedCommand)
      return
    }

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
  }, [pendingCommand, buildContext, addToHistory])

  // --- Undo ---
  const setupUndo = useCallback((action: UndoAction) => {
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current)
    }
    setUndoAction(action)
    setUndoTimeoutState(Date.now() + UNDO_TIMEOUT)
    undoTimerRef.current = setTimeout(() => {
      setUndoAction(null)
      setUndoTimeoutState(null)
    }, UNDO_TIMEOUT)
  }, [])

  const performUndo = useCallback(async () => {
    if (!undoAction) return
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
    try {
      await undoAction.execute()
      setLastResult({ success: true, message: 'Accion deshecha' })
    } catch {
      setLastResult({ success: false, message: 'No se pudo deshacer la accion' })
    }
    setUndoAction(null)
    setUndoTimeoutState(null)
  }, [undoAction])

  // --- Open / Close ---
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

  const clearHistory = useCallback(() => {
    setHistory([])
    if (typeof window !== 'undefined') localStorage.removeItem(HISTORY_KEY)
  }, [])

  const repeatCommand = useCallback((entry: CommandHistoryEntry) => {
    setInput(entry.input)
  }, [])

  const value: CommandBarContextValue = {
    isOpen, input, loading, history, lastResult,
    clarification, pendingCommand, undoAction, undoTimeout,
    metrics: metricsRef.current,
    setInput, execute, resolveClarification, performUndo,
    open, close, toggle, clearHistory, repeatCommand,
  }

  return (
    <CommandBarContext.Provider value={value}>
      {children}
    </CommandBarContext.Provider>
  )
}

// --- Consumer Hook ---

export function useCommandBar(): CommandBarContextValue {
  const ctx = useContext(CommandBarContext)
  if (!ctx) {
    throw new Error('useCommandBar debe usarse dentro de <CommandBarProvider>')
  }
  return ctx
}
