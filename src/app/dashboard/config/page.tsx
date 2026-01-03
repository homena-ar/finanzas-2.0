'use client'

import { useState, useEffect } from 'react'
import { useData } from '@/hooks/useData'
import { useAuth } from '@/hooks/useAuth'
import { formatMoney, getMonthName } from '@/lib/utils'
import { Save, Plus, X, Edit2 } from 'lucide-react'
import { AlertModal } from '@/components/Modal'

export default function ConfigPage() {
  const { profile, updateProfile } = useAuth()
  const {
    tags, addTag, deleteTag,
    categorias, addCategoria, updateCategoria, deleteCategoria,
    gastos, addGasto, currentMonth
  } = useData()

  const [budgetEnabled, setBudgetEnabled] = useState(false)
  const [budgetArs, setBudgetArs] = useState('')
  const [budgetUsd, setBudgetUsd] = useState('')
  const [newTag, setNewTag] = useState('')
  const [saving, setSaving] = useState(false)

  // Modal states
  const [showAlert, setShowAlert] = useState(false)
  const [alertData, setAlertData] = useState({ title: '', message: '', variant: 'success' as 'success' | 'error' | 'warning' | 'info' })

  // Categoría modal states
  const [showCategoriaModal, setShowCategoriaModal] = useState(false)
  const [editingCategoria, setEditingCategoria] = useState<any>(null)
  const [categoriaForm, setCategoriaForm] = useState({ nombre: '', icono: '', color: '#6366f1' })

  // Inicializar valores del perfil
  useEffect(() => {
    if (profile) {
      const hasArs = (profile.budget_ars || 0) > 0
      const hasUsd = (profile.budget_usd || 0) > 0
      setBudgetEnabled(hasArs || hasUsd)
      setBudgetArs(profile.budget_ars ? String(profile.budget_ars) : '')
      setBudgetUsd(profile.budget_usd ? String(profile.budget_usd) : '')
    }
  }, [profile])

  const handleSaveBudget = async () => {
    setSaving(true)
    
    if (budgetEnabled) {
      await updateProfile({
        budget_ars: parseFloat(budgetArs) || 0,
        budget_usd: parseFloat(budgetUsd) || 0
      })
    } else {
      // Desactivar presupuesto
      await updateProfile({
        budget_ars: 0,
        budget_usd: 0
      })
    }
    
    setSaving(false)
  }

  const handleAddTag = async () => {
    if (!newTag.trim()) return
    await addTag(newTag.trim())
    setNewTag('')
  }

  const handleSaveCategoria = async () => {
    if (!categoriaForm.nombre.trim() || !categoriaForm.icono.trim()) {
      setAlertData({
        title: 'Campos incompletos',
        message: 'Por favor completá el nombre y seleccioná un icono',
        variant: 'warning'
      })
      setShowAlert(true)
      return
    }

    if (editingCategoria) {
      await updateCategoria(editingCategoria.id, categoriaForm)
      setAlertData({
        title: '¡Categoría actualizada!',
        message: `La categoría "${categoriaForm.nombre}" fue actualizada correctamente`,
        variant: 'success'
      })
    } else {
      await addCategoria(categoriaForm)
      setAlertData({
        title: '¡Categoría creada!',
        message: `La categoría "${categoriaForm.nombre}" fue creada correctamente`,
        variant: 'success'
      })
    }

    setShowAlert(true)
    setShowCategoriaModal(false)
    setCategoriaForm({ nombre: '', icono: '', color: '#6366f1' })
    setEditingCategoria(null)
  }

  const handleEditCategoria = (cat: any) => {
    setEditingCategoria(cat)
    setCategoriaForm({ nombre: cat.nombre, icono: cat.icono, color: cat.color })
    setShowCategoriaModal(true)
  }

  const handleDeleteCategoria = async (id: string, nombre: string) => {
    await deleteCategoria(id)
    setAlertData({
      title: 'Categoría eliminada',
      message: `La categoría "${nombre}" fue eliminada`,
      variant: 'success'
    })
    setShowAlert(true)
  }

  const commonIcons = ['🍔', '🏠', '🚗', '🎮', '👕', '💊', '📚', '✈️', '🎬', '🏋️', '🐕', '💰', '🔧', '📱', '💡']

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Configuración</h1>
        <p className="text-slate-500">Personalizá tu experiencia</p>
      </div>

      {/* Presupuesto - OPCIONAL */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold">💰 Presupuesto Mensual</h3>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={budgetEnabled}
              onChange={e => setBudgetEnabled(e.target.checked)}
              className="w-5 h-5 accent-indigo-500"
            />
            <span className="text-sm font-medium">Activar</span>
          </label>
        </div>
        
        {budgetEnabled ? (
          <>
            <p className="text-slate-500 text-sm mb-4">Establecé un límite mensual para controlar tus gastos</p>
            
            <div className="grid sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="label">Presupuesto ARS</label>
                <input
                  type="number"
                  className="input"
                  placeholder="500000"
                  value={budgetArs}
                  onChange={e => setBudgetArs(e.target.value)}
                />
              </div>
              <div>
                <label className="label">Presupuesto USD</label>
                <input
                  type="number"
                  className="input"
                  placeholder="500"
                  value={budgetUsd}
                  onChange={e => setBudgetUsd(e.target.value)}
                />
              </div>
            </div>
          </>
        ) : (
          <div className="bg-slate-50 rounded-xl p-4 text-center text-slate-500">
            <p>Sin presupuesto configurado</p>
            <p className="text-sm">Activá el checkbox para establecer un límite mensual</p>
          </div>
        )}
        
        <button onClick={handleSaveBudget} disabled={saving} className="btn btn-primary mt-4">
          <Save className="w-4 h-4" />
          {saving ? 'Guardando...' : 'Guardar'}
        </button>
      </div>

      {/* Categorías */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold">📂 Categorías</h3>
            <p className="text-slate-500 text-sm mt-1">Administrá tus categorías de gastos</p>
          </div>
          <button
            onClick={() => {
              setEditingCategoria(null)
              setCategoriaForm({ nombre: '', icono: '', color: '#6366f1' })
              setShowCategoriaModal(true)
            }}
            className="btn btn-primary"
          >
            <Plus className="w-4 h-4" /> Nueva Categoría
          </button>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          {categorias.map(c => (
            <div
              key={c.id}
              className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl hover:bg-slate-100 transition"
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                style={{ backgroundColor: c.color + '20' }}
              >
                {c.icono}
              </div>
              <div className="flex-1">
                <div className="font-semibold">{c.nombre}</div>
                <div className="text-xs text-slate-500">Color: {c.color}</div>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => handleEditCategoria(c)}
                  className="p-2 hover:bg-slate-200 rounded-lg transition"
                >
                  <Edit2 className="w-4 h-4 text-slate-600" />
                </button>
                <button
                  onClick={() => handleDeleteCategoria(c.id, c.nombre)}
                  className="p-2 hover:bg-red-100 rounded-lg transition"
                >
                  <X className="w-4 h-4 text-red-600" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tags */}
      <div className="card p-5">
        <h3 className="font-bold mb-4">🏷️ Tags Personalizados</h3>
        <p className="text-slate-500 text-sm mb-4">Creá tags para organizar tus gastos</p>

        <div className="flex flex-wrap gap-2 mb-4">
          {tags.map(t => (
            <div key={t.id} className="flex items-center gap-1 bg-orange-100 text-orange-700 px-3 py-1.5 rounded-full">
              <span className="font-semibold text-sm">{t.nombre}</span>
              <button onClick={() => deleteTag(t.id)} className="hover:text-orange-900">
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
          {tags.length === 0 && (
            <span className="text-slate-400">Sin tags</span>
          )}
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            className="input flex-1"
            placeholder="Nuevo tag..."
            value={newTag}
            onChange={e => setNewTag(e.target.value)}
            onKeyPress={e => e.key === 'Enter' && handleAddTag()}
          />
          <button onClick={handleAddTag} className="btn btn-primary">
            <Plus className="w-4 h-4" /> Agregar
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="card p-5 bg-slate-50">
        <h3 className="font-bold mb-2">ℹ️ Información</h3>
        <div className="text-sm text-slate-600 space-y-1">
          <p><strong>Email:</strong> {profile?.email}</p>
          <p><strong>Usuario:</strong> {profile?.nombre}</p>
          <p><strong>Versión:</strong> 2.0.0</p>
        </div>
      </div>

      {/* Modal de Categoría */}
      {showCategoriaModal && (
        <div className="modal-overlay" onClick={() => setShowCategoriaModal(false)}>
          <div className="modal max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-lg">
                {editingCategoria ? 'Editar Categoría' : 'Nueva Categoría'}
              </h3>
              <button onClick={() => setShowCategoriaModal(false)} className="p-1 hover:bg-slate-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="label">Nombre</label>
                <input
                  type="text"
                  className="input"
                  placeholder="ej: Comida, Transporte..."
                  value={categoriaForm.nombre}
                  onChange={e => setCategoriaForm(f => ({ ...f, nombre: e.target.value }))}
                />
              </div>

              <div>
                <label className="label">Icono</label>
                <div className="grid grid-cols-8 gap-2 mb-2">
                  {commonIcons.map(icon => (
                    <button
                      key={icon}
                      onClick={() => setCategoriaForm(f => ({ ...f, icono: icon }))}
                      className={`p-3 text-2xl rounded-lg border-2 transition flex items-center justify-center ${
                        categoriaForm.icono === icon
                          ? 'border-indigo-500 bg-indigo-50'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  className="input text-2xl text-center"
                  placeholder="O escribí un emoji"
                  value={categoriaForm.icono}
                  onChange={e => setCategoriaForm(f => ({ ...f, icono: e.target.value }))}
                  maxLength={2}
                />
              </div>

              <div>
                <label className="label">Color</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    className="w-16 h-16 rounded-lg border-2 border-slate-200 cursor-pointer"
                    value={categoriaForm.color}
                    onChange={e => setCategoriaForm(f => ({ ...f, color: e.target.value }))}
                  />
                  <div className="flex-1">
                    <input
                      type="text"
                      className="input"
                      placeholder="#6366f1"
                      value={categoriaForm.color}
                      onChange={e => setCategoriaForm(f => ({ ...f, color: e.target.value }))}
                    />
                  </div>
                </div>
              </div>

              {/* Preview */}
              <div className="bg-slate-50 rounded-xl p-4">
                <div className="text-xs text-slate-500 mb-2">Vista previa:</div>
                <div className="flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                    style={{ backgroundColor: categoriaForm.color + '20' }}
                  >
                    {categoriaForm.icono || '?'}
                  </div>
                  <div className="font-semibold">{categoriaForm.nombre || 'Nombre de categoría'}</div>
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-slate-200 flex gap-3 justify-end">
              <button onClick={() => setShowCategoriaModal(false)} className="btn btn-secondary">
                Cancelar
              </button>
              <button onClick={handleSaveCategoria} className="btn btn-primary">
                {editingCategoria ? 'Actualizar' : 'Crear'}
              </button>
            </div>
          </div>
        </div>
      )}

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
