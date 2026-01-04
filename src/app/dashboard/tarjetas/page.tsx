'use client'

import { useState } from 'react'
import { useData } from '@/hooks/useData'
import { Plus, Edit2, Trash2, X, CreditCard } from 'lucide-react'
import { Tarjeta } from '@/types'
import { ConfirmModal, AlertModal } from '@/components/Modal'

function getCardGradient(tipo: string): string {
  const gradients: Record<string, string> = {
    'visa': 'background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)',
    'mastercard': 'background: linear-gradient(135deg, #991b1b 0%, #ef4444 100%)',
    'amex': 'background: linear-gradient(135deg, #065f46 0%, #10b981 100%)',
    'other': 'background: linear-gradient(135deg, #374151 0%, #6b7280 100%)'
  }
  return gradients[tipo] || gradients.other
}

export default function TarjetasPage() {
  const { tarjetas, addTarjeta, updateTarjeta, deleteTarjeta, loading } = useData()
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Tarjeta | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    nombre: '', tipo: 'visa', banco: '', digitos: '', cierre: '', esCuenta: false
  })

  // Modal states
  const [showConfirmDelete, setShowConfirmDelete] = useState(false)
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)
  const [showAlert, setShowAlert] = useState(false)
  const [alertData, setAlertData] = useState({ title: '', message: '', variant: 'info' as 'success' | 'error' | 'warning' | 'info' })

  console.log('💳 [TarjetasPage] Render - loading:', loading)

  const resetForm = () => {
    setForm({ nombre: '', tipo: 'visa', banco: '', digitos: '', cierre: '', esCuenta: false })
  }

  const openEdit = (t: Tarjeta) => {
    setEditing(t)
    setForm({
      nombre: t.nombre,
      tipo: t.tipo,
      banco: t.banco || '',
      digitos: t.digitos || '',
      cierre: t.cierre ? String(t.cierre) : '',
      esCuenta: t.tipo === 'other'
    })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.nombre) {
      setAlertData({
        title: 'Campo requerido',
        message: 'El nombre de la cuenta es requerido',
        variant: 'warning'
      })
      setShowAlert(true)
      return
    }

    setSaving(true)

    const data = {
      nombre: form.nombre,
      tipo: (form.esCuenta ? 'other' : form.tipo) as 'visa' | 'mastercard' | 'amex' | 'other',
      banco: form.banco || null,
      digitos: form.digitos || null,
      cierre: form.cierre ? parseInt(form.cierre) : null
    }

    try {
      if (editing) {
        const { error } = await updateTarjeta(editing.id, data)
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
        const { error } = await addTarjeta(data)
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
        message: 'Ocurrió un error al guardar la cuenta',
        variant: 'error'
      })
      setShowAlert(true)
    }

    setSaving(false)
  }

  const handleDelete = (id: string) => {
    setDeleteTargetId(id)
    setShowConfirmDelete(true)
  }

  const confirmDelete = async () => {
    if (!deleteTargetId) return

    const { error } = await deleteTarjeta(deleteTargetId)
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

  if (loading) {
    console.log('💳 [TarjetasPage] SHOWING LOADING SPINNER - loading is TRUE')
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  console.log('💳 [TarjetasPage] Rendering content - loading is FALSE')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Cuentas</h1>
          <p className="text-slate-500">Administrá tus cuentas y tarjetas ({tarjetas.length})</p>
        </div>
        <button onClick={() => { resetForm(); setEditing(null); setShowModal(true) }} className="btn btn-primary">
          <Plus className="w-4 h-4" /> Nueva Cuenta
        </button>
      </div>

      {/* Cards Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {tarjetas.length === 0 ? (
          <div className="col-span-full card p-12 text-center">
            <CreditCard className="w-16 h-16 mx-auto text-slate-300 mb-4" />
            <p className="text-slate-500 mb-4">No tenés cuentas o tarjetas configuradas</p>
            <button onClick={() => { resetForm(); setEditing(null); setShowModal(true) }} className="btn btn-primary">
              <Plus className="w-4 h-4" /> Agregar primera cuenta
            </button>
          </div>
        ) : tarjetas.map(t => (
          <div 
            key={t.id} 
            className="rounded-2xl p-5 text-white min-h-[180px] relative shadow-lg"
            style={{
              background: t.tipo === 'visa' 
                ? 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)'
                : t.tipo === 'mastercard'
                  ? 'linear-gradient(135deg, #991b1b 0%, #ef4444 100%)'
                  : t.tipo === 'amex'
                    ? 'linear-gradient(135deg, #065f46 0%, #10b981 100%)'
                    : 'linear-gradient(135deg, #374151 0%, #6b7280 100%)'
            }}
          >
            {/* Decorative circles */}
            <div className="absolute top-4 right-4 opacity-20 pointer-events-none">
              <div className="w-16 h-16 rounded-full border-4 border-white"></div>
            </div>
            <div className="absolute top-8 right-8 opacity-10 pointer-events-none">
              <div className="w-12 h-12 rounded-full border-4 border-white"></div>
            </div>

            {/* Actions */}
            <div className="absolute top-3 right-3 flex gap-2 z-50">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  openEdit(t)
                }}
                className="px-3 py-2 bg-white/20 backdrop-blur rounded-lg flex items-center gap-1 hover:bg-white/30 transition"
                title="Editar cuenta"
              >
                <Edit2 className="w-4 h-4" />
                <span className="text-xs font-medium hidden sm:inline">Editar</span>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleDelete(t.id)
                }}
                className="px-3 py-2 bg-white/20 backdrop-blur rounded-lg flex items-center gap-1 hover:bg-white/30 transition"
                title="Eliminar cuenta"
              >
                <Trash2 className="w-4 h-4" />
                <span className="text-xs font-medium hidden sm:inline">Borrar</span>
              </button>
            </div>
            
            {/* Card content */}
            <div className="relative z-10">
              <div className="text-xs font-bold uppercase tracking-wider opacity-80 mb-4">
                {t.tipo === 'visa' ? '💳 VISA' : t.tipo === 'mastercard' ? '💳 MASTERCARD' : t.tipo === 'amex' ? '💳 AMEX' : '🏦 CUENTA'}
              </div>
              
              <div className="text-xl font-bold mb-2">{t.nombre}</div>
              
              <div className="text-sm opacity-70 font-mono tracking-widest mb-4">
                •••• •••• •••• {t.digitos || '****'}
              </div>
              
              <div className="flex justify-between items-end">
                <div>
                  <div className="text-xs opacity-60 uppercase">Banco</div>
                  <div className="font-semibold">{t.banco || '-'}</div>
                </div>
                {t.cierre && (
                  <div className="text-right">
                    <div className="text-xs opacity-60 uppercase">Cierre</div>
                    <div className="font-semibold">Día {t.cierre}</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-lg">{editing ? 'Editar' : 'Nueva'} Cuenta</h3>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-slate-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              {/* Selector Tarjeta/Cuenta */}
              <div>
                <label className="label">Tipo *</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, esCuenta: false, tipo: 'visa' }))}
                    className={`p-4 rounded-xl border-2 transition ${
                      !form.esCuenta
                        ? 'bg-indigo-50 border-indigo-500 text-indigo-700'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <div className="text-2xl mb-1">💳</div>
                    <div className="font-bold text-sm">Tarjeta</div>
                    <div className="text-xs opacity-70">Crédito o débito</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, esCuenta: true, tipo: 'other' }))}
                    className={`p-4 rounded-xl border-2 transition ${
                      form.esCuenta
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-700'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <div className="text-2xl mb-1">🏦</div>
                    <div className="font-bold text-sm">Cuenta</div>
                    <div className="text-xs opacity-70">Banco, billetera digital</div>
                  </button>
                </div>
              </div>

              <div>
                <label className="label">Nombre *</label>
                <input
                  type="text"
                  className="input"
                  placeholder={form.esCuenta ? "Ej: Cuenta Banco, Mercado Pago, Uala" : "Ej: Visa Gold BBVA, Mastercard Santander"}
                  value={form.nombre}
                  onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                {!form.esCuenta && (
                  <div>
                    <label className="label">Marca de Tarjeta</label>
                    <select
                      className="input"
                      value={form.tipo}
                      onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}
                    >
                      <option value="visa">💳 Visa</option>
                      <option value="mastercard">💳 Mastercard</option>
                      <option value="amex">💳 Amex</option>
                    </select>
                  </div>
                )}
                <div>
                  <label className="label">Banco{form.esCuenta ? ' o Institución' : ''}</label>
                  <input
                    type="text"
                    className="input"
                    placeholder={form.esCuenta ? "Ej: Mercado Pago, Santander..." : "Ej: BBVA, Santander..."}
                    value={form.banco}
                    onChange={e => setForm(f => ({ ...f, banco: e.target.value }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Últimos 4 dígitos</label>
                  <input
                    type="text"
                    className="input"
                    maxLength={4}
                    placeholder="1234"
                    value={form.digitos}
                    onChange={e => setForm(f => ({ ...f, digitos: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="label">Día de cierre</label>
                  <input
                    type="number"
                    className="input"
                    min={1}
                    max={31}
                    placeholder="15"
                    value={form.cierre}
                    onChange={e => setForm(f => ({ ...f, cierre: e.target.value }))}
                  />
                </div>
              </div>
              
              {/* Preview */}
              <div
                className="rounded-xl p-4 text-white text-sm"
                style={{
                  background: form.esCuenta
                    ? 'linear-gradient(135deg, #374151 0%, #6b7280 100%)'
                    : form.tipo === 'visa'
                      ? 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)'
                      : form.tipo === 'mastercard'
                        ? 'linear-gradient(135deg, #991b1b 0%, #ef4444 100%)'
                        : 'linear-gradient(135deg, #065f46 0%, #10b981 100%)'
                }}
              >
                <div className="text-xs opacity-70 mb-1">Vista previa - {form.esCuenta ? '🏦 Cuenta' : '💳 Tarjeta'}</div>
                <div className="font-bold">{form.nombre || (form.esCuenta ? 'Nombre de cuenta' : 'Nombre de tarjeta')}</div>
                <div className="font-mono text-xs opacity-70">•••• {form.digitos || '****'}</div>
              </div>
              
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
      <ConfirmModal
        isOpen={showConfirmDelete}
        onClose={() => {
          setShowConfirmDelete(false)
          setDeleteTargetId(null)
        }}
        onConfirm={confirmDelete}
        title="¿Eliminar cuenta?"
        message="Los gastos asociados a esta cuenta quedarán como Efectivo."
        confirmText="Eliminar"
        cancelText="Cancelar"
        variant="danger"
      />

      {/* Alert Modal */}
      <AlertModal
        isOpen={showAlert}
        onClose={() => setShowAlert(false)}
        title={alertData.title}
        message={alertData.message}
        variant={alertData.variant}
      />
    </div>
  )
}
