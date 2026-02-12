'use client'

// ============================================
// ASISTENTE — PANEL FIJO (NO MODAL)
// ============================================
// Desktop: panel fijo a la derecha (380px, 100dvh)
// Mobile: bottom sheet adaptable al teclado
// Sin backdrop/overlay. Sin mensajes duplicados.
// Un solo mensaje final estructurado por interacción.

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  X, Send, RotateCcw, ChevronRight,
  CheckCircle2, AlertCircle, Loader2,
  ArrowDownCircle, ArrowUpCircle, PiggyBank,
  Bell, ShoppingCart, BarChart3,
  Sparkles, MessageCircle,
} from 'lucide-react'
import { useCommandBar } from '@/hooks/useCommandBar'
import { motion } from 'framer-motion'
import { useAuth } from '@/hooks/useAuth'
import { useWorkspace } from '@/hooks/useWorkspace'
import { useKeyboardViewport } from '@/hooks/useKeyboardViewport'
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { ListaCompra, Recordatorio } from '@/types'

const SUGGESTION_CHIPS = [
  { label: 'Agregar gasto', example: 'gasto 2000 Carrefour', icon: ArrowDownCircle },
  { label: 'Agregar ingreso', example: 'ingreso 500000 sueldo', icon: ArrowUpCircle },
  { label: 'Crear recordatorio', example: 'recordame pagar internet el 10', icon: Bell },
  { label: 'Agregar a lista', example: 'en supermercado agrega leche y cafe', icon: ShoppingCart },
  { label: 'Balance del mes', example: 'balance del mes', icon: BarChart3 },
  { label: 'Total de gastos', example: 'cuanto gaste este mes', icon: BarChart3 },
]

export function CommandBar() {
  const {
    isOpen, input, loading, history, lastResult,
    clarification, pendingCommand, undoAction, undoTimeout,
    activeInput,
    setInput, execute, resolveClarification, performUndo,
    open, close, toggle, repeatCommand,
  } = useCommandBar()

  const { user } = useAuth()
  const { currentWorkspace } = useWorkspace()
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [undoProgress, setUndoProgress] = useState(100)
  const { isKeyboardOpen, viewportHeight } = useKeyboardViewport()

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
      setTimeout(() => inputRef.current?.focus(), 150)
    }
  }, [isOpen])

  // Auto-scroll to bottom when new messages appear
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [history, lastResult, loading, activeInput, clarification])

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
      if (remaining <= 0) clearInterval(interval)
    }, 50)
    return () => clearInterval(interval)
  }, [undoTimeout, undoAction])

  // Build extra context with loaded data
  const getExtraContext = useCallback(() => ({
    findShoppingList: (name: string) => {
      const lower = name.toLowerCase()
      const found = shoppingLists.find(l =>
        l.nombre.toLowerCase().includes(lower) || lower.includes(l.nombre.toLowerCase())
      )
      return found ? { id: found.id, nombre: found.nombre } : null
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

  // Mensajes unificados: historial + resultado actual, SIN duplicación.
  // El history ya contiene los mensajes procesados.
  // lastResult se muestra solo si NO está ya en el history (es el mensaje "en curso").
  const recentHistory = [...history].slice(0, 10).reverse()

  // Determinar si el lastResult ya está en el primer elemento del history
  const isLastResultInHistory = lastResult && history.length > 0 && history[0].result?.message === lastResult.message

  const showWelcome = !activeInput && !loading && !lastResult && !clarification && recentHistory.length === 0

  // Estilo inline para mobile con teclado abierto
  const panelStyle: React.CSSProperties = isKeyboardOpen
    ? { maxHeight: `${viewportHeight}px` }
    : {}

  return (
    <motion.div
      initial={{ x: '100%', opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: '100%', opacity: 0 }}
      transition={{ type: 'spring', duration: 0.35, bounce: 0.05 }}
      className="assistant-panel"
      style={panelStyle}
    >
      {/* Header */}
      <div className="commandbar-chat-header">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800">Asistente</h3>
            <p className="text-[10px] text-slate-400">FinControl AI</p>
          </div>
        </div>
        <button
          onClick={close}
          className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
          title="Cerrar (Esc)"
        >
          <X className="w-4 h-4 text-slate-400" />
        </button>
      </div>

      {/* Messages Area */}
      <div className="commandbar-chat-messages">
        {/* Welcome state */}
        {showWelcome && (
          <div className="flex flex-col items-center justify-center h-full gap-4 px-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-primary" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-slate-700">Soy tu asistente financiero</p>
              <p className="text-xs text-slate-400 mt-1">Decime que necesitas o elegi una sugerencia</p>
            </div>
            <div className="grid grid-cols-2 gap-1.5 w-full max-w-sm">
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
          </div>
        )}

        {/* Past conversation history — UN solo mensaje por interacción */}
        {recentHistory.map(h => (
          <div key={h.id} className="space-y-2">
            {/* User message */}
            <div className="flex justify-end">
              <div className="commandbar-msg-user">
                <p className="text-sm">{h.input}</p>
              </div>
            </div>
            {/* Assistant response (mensaje final unificado) */}
            {h.result && (
              <div className="flex justify-start">
                <div className={`commandbar-msg-assistant ${h.result.success ? '' : 'commandbar-msg-error'}`}>
                  <div className="flex items-start gap-2">
                    {h.result.success ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-700 whitespace-pre-line">{h.result.message}</p>
                      {/* Boton ver detalle si tiene navegación */}
                      {h.result.navigate_to && (
                        <button
                          onClick={() => handleNavigate(h.result!.navigate_to!)}
                          className="commandbar-detail-btn mt-1.5"
                        >
                          Ver detalle
                          <ChevronRight className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Active user input (being processed) */}
        {activeInput && (
          <div className="flex justify-end">
            <div className="commandbar-msg-user">
              <p className="text-sm">{activeInput}</p>
            </div>
          </div>
        )}

        {/* Loading indicator */}
        {loading && (
          <div className="flex justify-start">
            <div className="commandbar-msg-assistant">
              <div className="flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
                <span className="text-sm text-slate-400">Procesando...</span>
              </div>
            </div>
          </div>
        )}

        {/* Current result — solo si NO está ya en el historial */}
        {lastResult && !clarification && !isLastResultInHistory && (
          <div className="flex justify-start">
            <div className={`commandbar-msg-assistant ${lastResult.success ? '' : 'commandbar-msg-error'}`}>
              <div className="flex items-start gap-2">
                {lastResult.success ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-700 whitespace-pre-line">{lastResult.message}</p>

                  {/* Action buttons */}
                  <div className="flex items-center gap-2 mt-2">
                    {undoAction && (
                      <button onClick={performUndo} className="commandbar-undo-btn">
                        <RotateCcw className="w-3 h-3" />
                        Deshacer
                        <div
                          className="commandbar-undo-progress"
                          style={{ width: `${undoProgress}%` }}
                        />
                      </button>
                    )}
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

              {/* Suggested followups */}
              {lastResult.success && pendingCommand?.suggested_followups && pendingCommand.suggested_followups.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-slate-100">
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
            </div>
          </div>
        )}

        {/* Clarification UI */}
        {clarification && clarification.length > 0 && (
          <div className="flex justify-start">
            <div className="commandbar-msg-assistant">
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
          </div>
        )}

        {/* Scroll anchor */}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area (at bottom) */}
      <div className="commandbar-chat-input-area">
        <div className="commandbar-chat-input-row">
          <input
            ref={inputRef}
            type="text"
            className="commandbar-input"
            placeholder="Escribi un comando..."
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
              className="p-1.5 bg-primary hover:bg-primary-700 rounded-lg transition-colors shrink-0"
              title="Enviar"
            >
              <Send className="w-3.5 h-3.5 text-white" />
            </button>
          ) : null}
        </div>
        <div className="commandbar-chat-footer">
          <span className="text-[10px] text-slate-400">
            <kbd className="commandbar-kbd">Enter</kbd> enviar
          </span>
          <span className="text-[10px] text-slate-400">
            <kbd className="commandbar-kbd">Esc</kbd> cerrar
          </span>
          <span className="text-[10px] text-slate-300 ml-auto hidden sm:inline">
            <kbd className="commandbar-kbd">Ctrl</kbd>+<kbd className="commandbar-kbd">K</kbd>
          </span>
        </div>
      </div>
    </motion.div>
  )
}

// --- Floating Action Button (for mobile & always-visible trigger) ---

export function CommandBarTrigger({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="commandbar-fab"
      title="Abrir Asistente (Ctrl+K)"
      aria-label="Abrir Asistente"
    >
      <MessageCircle className="w-5 h-5" />
    </button>
  )
}
