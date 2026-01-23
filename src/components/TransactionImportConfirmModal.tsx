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
          {/* Transaction Count */}
          <div className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <FileText className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <div className="font-semibold text-blue-900">
                Se agregarán {transactionCount} {transactionCount === 1 ? transactionLabelSingular : transactionLabel}
              </div>
            </div>
          </div>

          {/* Month/Year and Effective Date */}
          {month && (
            <div className="flex items-start gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <Calendar className="w-5 h-5 text-slate-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <div className="font-semibold text-slate-900 mb-1">
                  Mes y año destino
                </div>
                <div className="text-sm text-slate-600">
                  {formatMonth(month)}
                </div>
                {effectiveDate && (
                  <div className="text-xs text-slate-500 mt-1">
                    Fecha efectiva: <strong>{formatDate(effectiveDate)}</strong>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Account/Card */}
          <div className="flex items-start gap-3 p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
            <CreditCard className="w-5 h-5 text-indigo-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <div className="font-semibold text-indigo-900 mb-1">
                Cuenta/Tarjeta vinculada
              </div>
              {accountName ? (
                <div className="text-sm text-indigo-700">
                  {accountName}
                  {accountIsSuggested && (
                    <span className="ml-2 text-xs bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded">
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

          {/* Taxes (only for Gastos) */}
          {transactionType === 'gastos' && taxCount > 0 && (
            <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <FileText className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <div className="font-semibold text-amber-900 mb-1">
                  Impuestos detectados
                </div>
                <div className="text-sm text-amber-700">
                  Se agregarán {taxCount} {taxCount === 1 ? 'impuesto' : 'impuestos'}
                  {taxMonth && (
                    <span className="block mt-1 text-xs text-amber-600">
                      Mes: {formatMonth(taxMonth)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
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
