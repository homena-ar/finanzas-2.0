'use client'

import { X, CheckCircle, Calendar, CreditCard, FileText } from 'lucide-react'

interface TransactionImportConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  transactionCount: number
  transactionType: 'ingresos' | 'gastos'
  month: string | null // Format: YYYY-MM
  effectiveDate: string | null // Format: YYYY-MM-DD
  accountName: string | null
  accountIsSuggested: boolean
  taxCount?: number
  taxMonth?: string | null
  loading?: boolean
}

export function TransactionImportConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  transactionCount,
  transactionType,
  month,
  effectiveDate,
  accountName,
  accountIsSuggested,
  taxCount = 0,
  taxMonth = null,
  loading = false
}: TransactionImportConfirmModalProps) {
  if (!isOpen) return null

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-'
    const [year, month, day] = dateStr.split('-').map(Number)
    const date = new Date(year, month - 1, day)
    return date.toLocaleDateString('es-AR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })
  }

  const formatMonth = (monthStr: string | null) => {
    if (!monthStr) return '-'
    const [year, month] = monthStr.split('-').map(Number)
    const date = new Date(year, month - 1, 1)
    return date.toLocaleDateString('es-AR', {
      month: 'long',
      year: 'numeric'
    })
  }

  const transactionLabel = transactionType === 'ingresos' ? 'ingresos' : 'gastos'
  const transactionLabelSingular = transactionType === 'ingresos' ? 'ingreso' : 'gasto'

  return (
    <div className="modal-overlay" onClick={loading ? undefined : onClose}>
      <div className="modal max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-bold text-lg">Confirmar Importación</h3>
          {!loading && (
            <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
        
        <div className="p-6 space-y-4">
          {/* Encabezado: Cantidad de transacciones */}
          <div className="text-lg font-semibold text-slate-900">
            {transactionCount > 0 && taxCount > 0 ? (
              <>Se agregarán {transactionCount} {transactionCount === 1 ? transactionLabelSingular : transactionLabel} y {taxCount} {taxCount === 1 ? 'impuesto' : 'impuestos'}</>
            ) : transactionCount > 0 ? (
              <>Se agregarán {transactionCount} {transactionCount === 1 ? transactionLabelSingular : transactionLabel}</>
            ) : taxCount > 0 ? (
              <>Se agregarán {taxCount} {taxCount === 1 ? 'impuesto' : 'impuestos'}</>
            ) : null}
          </div>

          {/* Mes y año destino */}
          {month && (
            <div className="space-y-1">
              <div className="text-sm font-semibold text-slate-700">
                Mes y año destino: <span className="font-normal">{formatMonth(month)}</span>
              </div>
              {effectiveDate && (
                <div className="text-sm text-slate-600">
                  Fecha efectiva: <strong>{formatDate(effectiveDate)}</strong>
                </div>
              )}
            </div>
          )}

          {/* Cuenta/Tarjeta vinculada */}
          <div className="space-y-1">
            <div className="text-sm font-semibold text-slate-700">
              Cuenta/Tarjeta vinculada:
            </div>
            {accountName ? (
              <div className="text-sm text-slate-900">
                {accountName}
                {accountIsSuggested && (
                  <span className="ml-2 text-xs bg-primary-100 text-primary-600 px-2 py-0.5 rounded">
                    (sugerida)
                  </span>
                )}
              </div>
            ) : (
              <div className="text-sm text-slate-600">
                Sin cuenta específica
              </div>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-slate-200 flex gap-3 justify-end">
          <button
            onClick={onClose}
            disabled={loading}
            className="btn btn-secondary"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="btn btn-primary flex items-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Importando...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                Confirmar importación
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
