'use client'

// ============================================
// COMMAND BAR - GLOBAL UI COMPONENT
// ============================================
// Floating command bar accessible from anywhere in the dashboard.
// Supports: text input, chip suggestions, clarification dialogs,
// confirmation toasts with undo, history, and keyboard navigation.

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Command, X, Send, RotateCcw, ChevronRight,
  CheckCircle2, AlertCircle, Clock, Loader2,
  ArrowDownCircle, ArrowUpCircle, PiggyBank,
  Bell, ShoppingCart, BarChart3, Navigation,
  Sparkles,
} from 'lucide-react'
import { useCommandBar } from '@/hooks/useCommandBar'
import { AnimatePresence, motion } from 'framer-motion'
import { useAuth } from '@/hooks/useAuth'
import { useWorkspace } from '@/hooks/useWorkspace'
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { ListaCompra, Recordatorio } from '@/types'

// --- Quick Suggestion Chips ---
const SUGGESTION_CHIPS = [
  { label: 'Agregar gasto', example: 'gasto 2000 Carrefour', icon: ArrowDownCircle },
  { label: 'Agregar ingreso', example: 'ingreso 500000 sueldo', icon: ArrowUpCircle },
  { label: 'Crear recordatorio', example: 'recordame pagar internet el 10', icon: Bell },
  { label: 'Agregar a lista', example: 'en supermercado agrega leche y cafe', icon: ShoppingCart },
  { label: 'Balance del mes', example: 'balance del mes', icon: BarChart3 },
  { label: 'Total de gastos', example: 'cuanto gaste este mes', icon: BarChart3 },
]

// --- Intent Icon Map ---
function getIntentIcon(intent: string) {
  if (intent.includes('expense') || intent.includes('gasto')) return ArrowDownCircle
  if (intent.includes('income') || intent.includes('ingreso')) return ArrowUpCircle
  if (intent.includes('saving') || intent.includes('goal') || intent.includes('ahorro') || intent.includes('meta')) return PiggyBank
  if (intent.includes('reminder') || intent.includes('recordatorio')) return Bell
  if (intent.includes('shopping') || intent.includes('lista')) return ShoppingCart
  if (intent.includes('query') || intent.includes('balance') || intent.includes('top')) return BarChart3
  if (intent.includes('navigate')) return Navigation
  return Sparkles
}

// --- Component ---

export function CommandBar() {
  const {
    isOpen, input, loading, history, lastResult,
    clarification, pendingCommand, undoAction, undoTimeout,
    setInput, execute, resolveClarification, performUndo,
    open, close, toggle, repeatCommand,
  } = useCommandBar()

  const { user } = useAuth()
  const { currentWorkspace } = useWorkspace()
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [undoProgress, setUndoProgress] = useState(100)

  // Pre-load shopping lists and reminders for context
  const [shoppingLists, setShoppingLists] = useState<ListaCompra[]>([])
  const [reminders, setReminders] = useState<Recordatorio[]>([])

  // Load shopping lists
  useEffect(() => {
    if (!user || !currentWorkspace?.id || !isOpen) return
    getDocs(
      query(
        collection(db, 'listas_compra'),
        where('workspace_id', '==', currentWorkspace.id),
        orderBy('created_at', 'desc')
      )
    ).then(snap => {
      setShoppingLists(snap.docs.map(d => ({ id: d.id, ...d.data() } as ListaCompra)))
    }).catch(() => {})
  }, [user, currentWorkspace?.id, isOpen])

  // Load reminders
  useEffect(() => {
    if (!user || !currentWorkspace?.id || !isOpen) return
    getDocs(
      query(
        collection(db, 'recordatorios'),
        where('user_id', '==', user.uid),
        where('workspace_id', '==', currentWorkspace.id),
        orderBy('fecha', 'asc')
      )
    ).then(snap => {
      setReminders(snap.docs.map(d => ({ id: d.id, ...d.data() } as Recordatorio)))
    }).catch(() => {})
  }, [user, currentWorkspace?.id, isOpen])

  // Auto-focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen])

  // Undo progress countdown
  useEffect(() => {
    if (!undoTimeout || !undoAction) {
      setUndoProgress(100)
      return
    }

    const startTime = undoTimeout - 6000
    const interval = setInterval(() => {
      const now = Date.now()
      const elapsed = now - startTime
      const remaining = Math.max(0, 100 - (elapsed / 6000) * 100)
      setUndoProgress(remaining)

      if (remaining <= 0) {
        clearInterval(interval)
      }
    }, 50)

    return () => clearInterval(interval)
  }, [undoTimeout, undoAction])

  // Build extra context with loaded data
  const getExtraContext = useCallback(() => ({
    findShoppingList: (name: string) => {
      const lower = name.toLowerCase()
      return shoppingLists.find(l =>
        l.nombre.toLowerCase().includes(lower) || lower.includes(l.nombre.toLowerCase())
      ) ? {
        id: shoppingLists.find(l =>
          l.nombre.toLowerCase().includes(lower) || lower.includes(l.nombre.toLowerCase())
        )!.id,
        nombre: shoppingLists.find(l =>
          l.nombre.toLowerCase().includes(lower) || lower.includes(l.nombre.toLowerCase())
        )!.nombre,
      } : null
    },
    getActiveReminders: () => reminders.filter(r => r.status === 'activo'),
    getRemindersForDate: (date: string) =>
      reminders.filter(r => r.status === 'activo' && r.fecha === date),
  }), [shoppingLists, reminders])

  const handleSubmit = () => {
    if (!input.trim() || loading) return
    execute(input, getExtraContext())
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleChipClick = (example: string) => {
    setInput(example)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const handleClarificationSelect = (field: string, value: any) => {
    resolveClarification(field, value, getExtraContext())
  }

  const handleNavigate = (path: string) => {
    router.push(path)
    close()
  }

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="commandbar-overlay"
        onClick={close}
      />

      {/* Main Panel */}
      <motion.div
        initial={{ opacity: 0, y: -20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -20, scale: 0.98 }}
        transition={{ type: 'spring', duration: 0.3, bounce: 0.1 }}
        className="commandbar-panel"
        onClick={e => e.stopPropagation()}
      >
        {/* Input Row */}
        <div className="commandbar-input-row">
          <Command className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            className="commandbar-input"
            placeholder="Escribi un comando... ej: 'gasto 2000 Carrefour'"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
          />
          {loading ? (
            <Loader2 className="w-4 h-4 text-primary animate-spin shrink-0" />
          ) : input.trim() ? (
            <button
              onClick={handleSubmit}
              className="p-1 hover:bg-primary-50 rounded-md transition-colors shrink-0"
              title="Ejecutar"
            >
              <Send className="w-4 h-4 text-primary" />
            </button>
          ) : null}
          <button
            onClick={close}
            className="p-1 hover:bg-slate-100 rounded-md transition-colors shrink-0 ml-1"
            title="Cerrar (Esc)"
          >
            <X className="w-3.5 h-3.5 text-slate-400" />
          </button>
        </div>

        {/* Content Area */}
        <div className="commandbar-content">
          {/* Clarification UI */}
          {clarification && clarification.length > 0 && (
            <div className="commandbar-section">
              {clarification.map((c, idx) => (
                <div key={idx} className="space-y-2">
                  <p className="text-sm text-slate-600">{c.message}</p>
                  {c.options && (
                    <div className="flex flex-wrap gap-1.5">
                      {c.options.map((opt, optIdx) => (
                        <button
                          key={optIdx}
                          onClick={() => handleClarificationSelect(c.field, opt.value)}
                          className="commandbar-option-btn"
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  )}
                  {!c.options && (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        className="input text-sm flex-1"
                        placeholder={c.message}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            handleClarificationSelect(c.field, (e.target as HTMLInputElement).value)
                          }
                        }}
                        autoFocus={idx === 0}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Result */}
          <AnimatePresence mode="wait">
            {lastResult && !clarification && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="commandbar-section"
              >
                <div className={`commandbar-result ${lastResult.success ? 'commandbar-result-success' : 'commandbar-result-error'}`}>
                  <div className="flex items-start gap-2.5">
                    {lastResult.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-700 whitespace-pre-line">{lastResult.message}</p>

                      {/* Action buttons row */}
                      <div className="flex items-center gap-2 mt-2">
                        {/* Undo button */}
                        {undoAction && (
                          <button
                            onClick={performUndo}
                            className="commandbar-undo-btn"
                          >
                            <RotateCcw className="w-3 h-3" />
                            Deshacer
                            <div
                              className="commandbar-undo-progress"
                              style={{ width: `${undoProgress}%` }}
                            />
                          </button>
                        )}

                        {/* Navigate button */}
                        {lastResult.navigate_to && (
                          <button
                            onClick={() => handleNavigate(lastResult.navigate_to!)}
                            className="commandbar-detail-btn"
                          >
                            Ver detalle
                            <ChevronRight className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Suggested followups */}
                {lastResult.success && pendingCommand?.suggested_followups && pendingCommand.suggested_followups.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {pendingCommand.suggested_followups.map((f, idx) => (
                      <button
                        key={idx}
                        onClick={() => { setInput(f); inputRef.current?.focus() }}
                        className="commandbar-chip text-xs"
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Suggestions (when input is empty and no result) */}
          {!input.trim() && !lastResult && !clarification && (
            <div className="commandbar-section">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Sugerencias</span>
                {history.length > 0 && (
                  <button
                    onClick={() => setShowHistory(!showHistory)}
                    className="text-[10px] font-medium text-primary hover:text-primary-700 transition-colors"
                  >
                    {showHistory ? 'Ver sugerencias' : 'Historial reciente'}
                  </button>
                )}
              </div>

              {showHistory ? (
                <div className="space-y-1">
                  {history.slice(0, 6).map(h => (
                    <button
                      key={h.id}
                      onClick={() => {
                        repeatCommand(h)
                        setInput(h.input)
                        setShowHistory(false)
                      }}
                      className="commandbar-history-item"
                    >
                      <Clock className="w-3 h-3 text-slate-300 shrink-0" />
                      <span className="text-sm text-slate-600 truncate">{h.input}</span>
                      {h.result?.success !== undefined && (
                        h.result.success
                          ? <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                          : <AlertCircle className="w-3 h-3 text-red-400 shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-1.5">
                  {SUGGESTION_CHIPS.map((chip, idx) => {
                    const Icon = chip.icon
                    return (
                      <button
                        key={idx}
                        onClick={() => handleChipClick(chip.example)}
                        className="commandbar-suggestion"
                      >
                        <Icon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="text-xs text-slate-600 text-left truncate">{chip.label}</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Keyboard hint */}
          <div className="commandbar-footer">
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-slate-400">
                <kbd className="commandbar-kbd">Enter</kbd> ejecutar
              </span>
              <span className="text-[10px] text-slate-400">
                <kbd className="commandbar-kbd">Esc</kbd> cerrar
              </span>
            </div>
            <span className="text-[10px] text-slate-300">
              <kbd className="commandbar-kbd">Ctrl</kbd>+<kbd className="commandbar-kbd">K</kbd>
            </span>
          </div>
        </div>
      </motion.div>
    </>
  )
}

// --- Floating Action Button (for mobile & always-visible trigger) ---

export function CommandBarTrigger({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="commandbar-fab"
      title="Abrir Command Bar (Ctrl+K)"
      aria-label="Abrir Command Bar"
    >
      <Command className="w-5 h-5" />
    </button>
  )
}
