'use client'

import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg'
}

export function Modal({ isOpen, onClose, title, children, size = 'md' }: ModalProps) {
  if (!isOpen) return null

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-lg',
    lg: 'max-w-2xl'
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={`modal ${sizeClasses[size]}`} onClick={e => e.stopPropagation()}>
        {title && (
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <h3 className="font-bold text-lg">{title}</h3>
            <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded">
              <X className="w-5 h-5" />
            </button>
          </div>
        )}
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  )
}

interface ConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  variant?: 'danger' | 'warning' | 'info'
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  variant = 'danger'
}: ConfirmModalProps) {
  if (!isOpen) return null

  const handleConfirm = () => {
    onConfirm()
    onClose()
  }

  const variants = {
    danger: {
      icon: <AlertCircle className="w-12 h-12 text-red-500" />,
      bg: 'bg-red-50',
      border: 'border-red-200',
      btnClass: 'btn-danger'
    },
    warning: {
      icon: <AlertTriangle className="w-12 h-12 text-amber-500" />,
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      btnClass: 'btn-warning'
    },
    info: {
      icon: <Info className="w-12 h-12 text-blue-500" />,
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      btnClass: 'btn-primary'
    }
  }

  const config = variants[variant]

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal max-w-md" onClick={e => e.stopPropagation()}>
        <div className={`p-6 ${config.bg} border-b ${config.border}`}>
          <div className="flex flex-col items-center text-center gap-4">
            {config.icon}
            <div>
              <h3 className="font-bold text-lg mb-2">{title}</h3>
              <p className="text-slate-600">{message}</p>
            </div>
          </div>
        </div>
        <div className="p-4 flex gap-3 justify-end">
          <button onClick={onClose} className="btn btn-secondary">
            {cancelText}
          </button>
          <button onClick={handleConfirm} className={`btn ${config.btnClass}`}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}

interface AlertModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  message: string
  variant?: 'success' | 'error' | 'warning' | 'info'
}

export function AlertModal({
  isOpen,
  onClose,
  title,
  message,
  variant = 'info'
}: AlertModalProps) {
  const variants = {
    success: {
      icon: <CheckCircle className="w-16 h-16 text-emerald-500" />,
      bg: 'bg-emerald-50',
      border: 'border-emerald-200',
      textColor: 'text-emerald-800'
    },
    error: {
      icon: <AlertCircle className="w-16 h-16 text-red-500" />,
      bg: 'bg-red-50',
      border: 'border-red-200',
      textColor: 'text-red-800'
    },
    warning: {
      icon: <AlertTriangle className="w-16 h-16 text-amber-500" />,
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      textColor: 'text-amber-800'
    },
    info: {
      icon: <Info className="w-16 h-16 text-blue-500" />,
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      textColor: 'text-blue-800'
    }
  }

  const config = variants[variant]

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="modal-overlay"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: "spring", duration: 0.3 }}
            className="modal max-w-md"
            onClick={e => e.stopPropagation()}
          >
            <div className={`p-8 ${config.bg} border-b ${config.border}`}>
              <div className="flex flex-col items-center text-center gap-4">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
                >
                  {config.icon}
                </motion.div>
                <div>
                  <h3 className={`font-bold text-xl mb-2 ${config.textColor}`}>{title}</h3>
                  <p className="text-slate-600 whitespace-pre-line">{message}</p>
                </div>
              </div>
            </div>
            <div className="p-4 flex justify-center">
              <button onClick={onClose} className="btn btn-primary px-8">
                Entendido
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
