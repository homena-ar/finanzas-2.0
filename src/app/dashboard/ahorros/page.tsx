'use client'

import { useState, useEffect } from 'react'
import { useData } from '@/hooks/useData'
import { useAuth } from '@/hooks/useAuth'
import { formatMoney, fetchDolar } from '@/lib/utils'
import { Plus, Minus, Target, X, Edit2, Trash2, Download, TrendingUp } from 'lucide-react'
import confetti from 'canvas-confetti'
import { Meta } from '@/types'
import * as XLSX from 'xlsx'
import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

export default function AhorrosPage() {
  console.log('🟢🟢🟢 [AhorrosPage] COMPONENT RENDER')

  const { profile, updateProfile } = useAuth()
  const { metas, movimientos, addMeta, updateMeta, deleteMeta, addMovimiento, updateMovimiento, deleteMovimiento } = useData()

  console.log('🟢🟢🟢 [AhorrosPage] addMovimiento function reference:', addMovimiento)

  const [dolar, setDolar] = useState(1050)
  const [showMetaModal, setShowMetaModal] = useState(false)
  const [editingMeta, setEditingMeta] = useState<Meta | null>(null)
  const [metaForm, setMetaForm] = useState({
    nombre: '', icono: '🎯', objetivo: '', moneda: 'ARS', progreso: '0'
  })
  const [inputPesos, setInputPesos] = useState('')
  const [inputUsd, setInputUsd] = useState('')
  const [descPesos, setDescPesos] = useState('')
  const [descUsd, setDescUsd] = useState('')
  const [showMovimientosModal, setShowMovimientosModal] = useState(false)
  const [currentTipo, setCurrentTipo] = useState<'pesos' | 'usd'>('pesos')
  const [editingMovimiento, setEditingMovimiento] = useState<any>(null)
  const [editForm, setEditForm] = useState({ monto: '', descripcion: '' })
  const [filterFecha, setFilterFecha] = useState('')
  const [showChart, setShowChart] = useState(false)
  const [movimientoToDelete, setMovimientoToDelete] = useState<any>(null)
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false)
  const [deleteAllConfirmText, setDeleteAllConfirmText] = useState('')
  const [deleteProgress, setDeleteProgress] = useState(0)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    fetchDolar()
      .then(setDolar)
      .catch(err => console.error('Error al obtener cotización del dólar:', err))
  }, [])

  const ahorroPesos = profile?.ahorro_pesos || 0
  const ahorroUsd = profile?.ahorro_usd || 0
  const patrimonioEnPesos = ahorroPesos + (ahorroUsd * dolar)
  const patrimonioEnUsd = (ahorroPesos / dolar) + ahorroUsd

  const handleAddSavings = async (tipo: 'pesos' | 'usd', isAdd: boolean) => {
    console.log('🟢 [AhorrosPage] handleAddSavings CALLED - tipo:', tipo, 'isAdd:', isAdd)
    console.log('🟢 [AhorrosPage] handleAddSavings - addMovimiento function:', typeof addMovimiento, addMovimiento)

    const input = tipo === 'pesos' ? inputPesos : inputUsd
    const amount = parseFloat(input)
    console.log('🟢 [AhorrosPage] handleAddSavings - input:', input, 'amount:', amount)

    if (!amount || amount <= 0) {
      console.log('🟢 [AhorrosPage] handleAddSavings - Invalid amount, returning')
      return
    }

    console.log('🟢 [AhorrosPage] Validation passed, calculating values...')
    const finalAmount = isAdd ? amount : -amount
    const field = tipo === 'pesos' ? 'ahorro_pesos' : 'ahorro_usd'
    const currentValue = tipo === 'pesos' ? ahorroPesos : ahorroUsd
    const newValue = Math.max(0, currentValue + finalAmount)
    console.log('🟢 [AhorrosPage] Calculated - field:', field, 'currentValue:', currentValue, 'newValue:', newValue)

    console.log('🟢 [AhorrosPage] Calling updateProfile...')
    await updateProfile({ [field]: newValue })
    console.log('🟢 [AhorrosPage] updateProfile completed')

    console.log('🟢 [AhorrosPage] Calling addMovimiento...')
    const descripcion = tipo === 'pesos' ? descPesos : descUsd
    await addMovimiento(tipo, finalAmount, descripcion || undefined)
    console.log('🟢 [AhorrosPage] addMovimiento completed')

    if (tipo === 'pesos') {
      setInputPesos('')
      setDescPesos('')
    } else {
      setInputUsd('')
      setDescUsd('')
    }
  }

  const handleSaveMeta = async () => {
    if (!metaForm.nombre || !metaForm.objetivo) return

    const data = {
      nombre: metaForm.nombre,
      icono: metaForm.icono,
      objetivo: parseFloat(metaForm.objetivo),
      progreso: parseFloat(metaForm.progreso) || 0,
      moneda: metaForm.moneda as 'ARS' | 'USD'
    }

    if (editingMeta) {
      await updateMeta(editingMeta.id, data)
    } else {
      await addMeta(data)
    }

    setShowMetaModal(false)
    setEditingMeta(null)
    resetMetaForm()
  }

  const resetMetaForm = () => {
    setMetaForm({ nombre: '', icono: '🎯', objetivo: '', moneda: 'ARS', progreso: '0' })
  }

  const openEditMeta = (m: Meta) => {
    setEditingMeta(m)
    setMetaForm({
      nombre: m.nombre,
      icono: m.icono,
      objetivo: String(m.objetivo),
      moneda: m.moneda,
      progreso: String(m.progreso)
    })
    setShowMetaModal(true)
  }

  const addToMeta = async (meta: Meta, amount: number) => {
    const newProgreso = meta.progreso + amount
    await updateMeta(meta.id, { progreso: newProgreso })

    if (newProgreso >= meta.objetivo && !meta.completada) {
      await updateMeta(meta.id, { completada: true })
      confetti({ particleCount: 100, spread: 70 })
    }
  }

  const handleSaveEditMovimiento = async () => {
    if (!editingMovimiento || !editForm.monto) return

    const newMonto = parseFloat(editForm.monto)
    if (isNaN(newMonto) || newMonto <= 0) return

    // Mantener el signo original (positivo o negativo)
    const finalMonto = editingMovimiento.monto < 0 ? -newMonto : newMonto

    await updateMovimiento(editingMovimiento.id, {
      monto: finalMonto,
      descripcion: editForm.descripcion || undefined
    })

    setEditingMovimiento(null)
    setEditForm({ monto: '', descripcion: '' })
  }

  const handleDeleteMovimiento = async () => {
    if (!movimientoToDelete) return

    // Actualizar el patrimonio restando el monto del movimiento
    const field = movimientoToDelete.tipo === 'pesos' ? 'ahorro_pesos' : 'ahorro_usd'
    const currentValue = movimientoToDelete.tipo === 'pesos' ? ahorroPesos : ahorroUsd
    const newValue = Math.max(0, currentValue - movimientoToDelete.monto)

    await updateProfile({ [field]: newValue })
    await deleteMovimiento(movimientoToDelete.id)
    setMovimientoToDelete(null)
  }

  const handleDeleteAll = async () => {
    const movimientosToDelete = movimientos.filter(m => m.tipo === currentTipo)
    const total = movimientosToDelete.length

    setIsDeleting(true)
    setDeleteProgress(0)

    const field = currentTipo === 'pesos' ? 'ahorro_pesos' : 'ahorro_usd'

    // Al eliminar TODOS los movimientos, poner patrimonio en 0
    // Esto corrige cualquier desincronización entre profile y movimientos
    await updateProfile({ [field]: 0 })

    // Eliminar todos los movimientos con progreso
    for (let i = 0; i < movimientosToDelete.length; i++) {
      await deleteMovimiento(movimientosToDelete[i].id)
      setDeleteProgress(Math.round(((i + 1) / total) * 100))
    }

    // Esperar un poco para que se vea el 100%
    await new Promise(resolve => setTimeout(resolve, 500))

    setIsDeleting(false)
    setDeleteProgress(0)
    setShowDeleteAllModal(false)
    setDeleteAllConfirmText('')
    setShowMovimientosModal(false)
  }

  const exportToExcel = () => {
    const filteredMovimientos = movimientos
      .filter(m => m.tipo === currentTipo)
      .filter(m => {
        if (!filterFecha) return true
        const movFecha = new Date(m.fecha)
        const [year, month] = filterFecha.split('-')
        return movFecha.getFullYear() === parseInt(year) &&
               movFecha.getMonth() === parseInt(month) - 1
      })
      .map(m => ({
        Fecha: new Date(m.fecha).toLocaleDateString('es-AR'),
        Tipo: m.monto > 0 ? 'Agregar' : 'Quitar',
        Monto: Math.abs(m.monto),
        Descripción: m.descripcion || '',
        Moneda: currentTipo === 'pesos' ? 'ARS' : 'USD'
      }))

    const ws = XLSX.utils.json_to_sheet(filteredMovimientos)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Movimientos')

    const fileName = `movimientos_${currentTipo}_${new Date().toISOString().split('T')[0]}.xlsx`
    XLSX.writeFile(wb, fileName)
  }

  const prepareChartData = () => {
    const movimientosPesos = movimientos
      .filter(m => m.tipo === 'pesos')
      .sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime())

    const movimientosUsd = movimientos
      .filter(m => m.tipo === 'usd')
      .sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime())

    let balancePesos = 0
    let balanceUsd = 0

    const dataPointsPesos = movimientosPesos.map(m => {
      balancePesos += m.monto
      return {
        x: new Date(m.fecha).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }),
        y: balancePesos
      }
    })

    const dataPointsUsd = movimientosUsd.map(m => {
      balanceUsd += m.monto
      return {
        x: new Date(m.fecha).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }),
        y: balanceUsd
      }
    })

    // Agregar punto actual
    if (dataPointsPesos.length > 0) {
      dataPointsPesos.push({
        x: 'Ahora',
        y: ahorroPesos
      })
    }

    if (dataPointsUsd.length > 0) {
      dataPointsUsd.push({
        x: 'Ahora',
        y: ahorroUsd
      })
    }

    return {
      labels: dataPointsPesos.length >= dataPointsUsd.length
        ? dataPointsPesos.map(p => p.x)
        : dataPointsUsd.map(p => p.x),
      datasets: [
        {
          label: 'Pesos',
          data: dataPointsPesos.map(p => p.y),
          borderColor: 'rgb(99, 102, 241)',
          backgroundColor: 'rgba(99, 102, 241, 0.1)',
          fill: true,
          tension: 0.4
        },
        {
          label: 'Dólares',
          data: dataPointsUsd.map(p => p.y),
          borderColor: 'rgb(16, 185, 129)',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          fill: true,
          tension: 0.4
        }
      ]
    }
  }

  const iconOptions = ['🏖️', '🚗', '🏠', '💻', '📱', '✈️', '🎓', '💍', '🎯']

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Ahorros y Metas</h1>
        <p className="text-slate-500">Construí tu futuro 🚀</p>
      </div>

      {/* Patrimonio Hero - SEPARADO */}
      <div className="bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-500 rounded-2xl p-6 text-white">
        <div className="text-sm opacity-80 mb-4">💰 Patrimonio Total</div>

        {/* Valores separados */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div className="bg-white/10 rounded-xl p-4">
            <div className="text-sm opacity-80">Pesos</div>
            <div className="text-xl font-bold">{formatMoney(ahorroPesos)}</div>
          </div>
          <div className="bg-white/10 rounded-xl p-4">
            <div className="text-sm opacity-80">Dólares</div>
            <div className="text-xl font-bold">{formatMoney(ahorroUsd, 'USD')}</div>
          </div>
          <div className="bg-white/20 rounded-xl p-4">
            <div className="text-sm opacity-80">Total en $</div>
            <div className="text-xl font-bold">{formatMoney(patrimonioEnPesos)}</div>
          </div>
          <div className="bg-white/20 rounded-xl p-4">
            <div className="text-sm opacity-80">Total en USD</div>
            <div className="text-xl font-bold">{formatMoney(patrimonioEnUsd, 'USD')}</div>
          </div>
        </div>

        <div className="text-xs opacity-60 text-center">
          Cotización: {formatMoney(dolar)} por dólar
        </div>
      </div>

      {/* Gráfico de Evolución */}
      {movimientos.length > 0 && (
        <div className="card p-5">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-lg flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-indigo-600" />
              Evolución de Ahorros
            </h3>
            <button
              onClick={() => setShowChart(!showChart)}
              className="btn btn-secondary text-sm"
            >
              {showChart ? 'Ocultar' : 'Ver gráfico'}
            </button>
          </div>
          {showChart && (
            <div className="mt-4">
              <Line
                data={prepareChartData()}
                options={{
                  responsive: true,
                  plugins: {
                    legend: {
                      position: 'top' as const,
                    },
                    tooltip: {
                      callbacks: {
                        label: function(context) {
                          let label = context.dataset.label || '';
                          if (label) {
                            label += ': ';
                          }
                          if (context.parsed.y !== null) {
                            label += formatMoney(context.parsed.y, context.datasetIndex === 1 ? 'USD' : 'ARS');
                          }
                          return label;
                        }
                      }
                    }
                  },
                  scales: {
                    y: {
                      beginAtZero: true,
                      ticks: {
                        callback: function(value) {
                          return formatMoney(value as number);
                        }
                      }
                    }
                  }
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* Savings Cards */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Pesos */}
        <div className="card p-5">
          <div className="flex justify-between items-start mb-4">
            <div>
              <div className="font-bold">Pesos</div>
              <div className="text-2xl font-bold text-indigo-600 mt-1">{formatMoney(ahorroPesos)}</div>
            </div>
            <span className="text-3xl">💵</span>
          </div>
          <input
            type="number"
            className="input mb-2"
            placeholder="Monto"
            value={inputPesos}
            onChange={e => setInputPesos(e.target.value)}
          />
          <input
            type="text"
            className="input mb-3"
            placeholder="Descripción (opcional)"
            value={descPesos}
            onChange={e => setDescPesos(e.target.value)}
          />
          <div className="flex gap-2">
            <button onClick={() => {
              console.log('🟢 [AhorrosPage] "Agregar Pesos" button CLICKED')
              handleAddSavings('pesos', true)
            }} className="btn btn-success flex-1 justify-center">
              <Plus className="w-4 h-4" /> Agregar
            </button>
            <button onClick={() => {
              console.log('🟢 [AhorrosPage] "Quitar Pesos" button CLICKED')
              handleAddSavings('pesos', false)
            }} className="btn btn-danger flex-1 justify-center">
              <Minus className="w-4 h-4" /> Quitar
            </button>
          </div>
          {/* Historial */}
          <div className="mt-4 pt-4 border-t border-slate-200">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs text-slate-500 font-semibold">HISTORIAL</span>
              <button
                onClick={() => { setCurrentTipo('pesos'); setShowMovimientosModal(true) }}
                className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
              >
                {movimientos.filter(m => m.tipo === 'pesos').length > 3 ? 'Ver todos' : 'Ver historial'}
              </button>
            </div>
            <div className="max-h-32 overflow-y-auto space-y-1">
              {movimientos.filter(m => m.tipo === 'pesos').length > 0 ? (
                movimientos.filter(m => m.tipo === 'pesos').slice(0, 3).map(m => (
                  <div key={m.id} className="flex justify-between items-center text-sm py-1.5 hover:bg-slate-50 rounded px-2">
                    <div className="flex-1">
                      <div className="text-slate-500 text-xs">{new Date(m.fecha).toLocaleDateString('es-AR')}</div>
                      {m.descripcion && <div className="text-slate-600 text-xs truncate">{m.descripcion}</div>}
                    </div>
                    <span className={`font-medium ${m.monto > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {m.monto > 0 ? '+' : ''}{formatMoney(m.monto)}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-slate-400 text-sm text-center py-2">Sin movimientos</p>
              )}
            </div>
          </div>
        </div>

        {/* USD */}
        <div className="card p-5">
          <div className="flex justify-between items-start mb-4">
            <div>
              <div className="font-bold">Dólares</div>
              <div className="text-2xl font-bold text-emerald-600 mt-1">{formatMoney(ahorroUsd, 'USD')}</div>
            </div>
            <span className="text-3xl">💲</span>
          </div>
          <input
            type="number"
            className="input mb-2"
            placeholder="Monto"
            value={inputUsd}
            onChange={e => setInputUsd(e.target.value)}
          />
          <input
            type="text"
            className="input mb-3"
            placeholder="Descripción (opcional)"
            value={descUsd}
            onChange={e => setDescUsd(e.target.value)}
          />
          <div className="flex gap-2">
            <button onClick={() => {
              console.log('🟢 [AhorrosPage] "Agregar USD" button CLICKED')
              handleAddSavings('usd', true)
            }} className="btn btn-success flex-1 justify-center">
              <Plus className="w-4 h-4" /> Agregar
            </button>
            <button onClick={() => {
              console.log('🟢 [AhorrosPage] "Quitar USD" button CLICKED')
              handleAddSavings('usd', false)
            }} className="btn btn-danger flex-1 justify-center">
              <Minus className="w-4 h-4" /> Quitar
            </button>
          </div>
          {/* Historial */}
          <div className="mt-4 pt-4 border-t border-slate-200">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs text-slate-500 font-semibold">HISTORIAL</span>
              <button
                onClick={() => { setCurrentTipo('usd'); setShowMovimientosModal(true) }}
                className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
              >
                {movimientos.filter(m => m.tipo === 'usd').length > 3 ? 'Ver todos' : 'Ver historial'}
              </button>
            </div>
            <div className="max-h-32 overflow-y-auto space-y-1">
              {movimientos.filter(m => m.tipo === 'usd').length > 0 ? (
                movimientos.filter(m => m.tipo === 'usd').slice(0, 3).map(m => (
                  <div key={m.id} className="flex justify-between items-center text-sm py-1.5 hover:bg-slate-50 rounded px-2">
                    <div className="flex-1">
                      <div className="text-slate-500 text-xs">{new Date(m.fecha).toLocaleDateString('es-AR')}</div>
                      {m.descripcion && <div className="text-slate-600 text-xs truncate">{m.descripcion}</div>}
                    </div>
                    <span className={`font-medium ${m.monto > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {m.monto > 0 ? '+' : ''}{formatMoney(m.monto, 'USD')}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-slate-400 text-sm text-center py-2">Sin movimientos</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Metas */}
      <div className="card p-5">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-lg">🎯 Metas</h3>
          <button onClick={() => { resetMetaForm(); setEditingMeta(null); setShowMetaModal(true) }} className="btn btn-primary">
            <Plus className="w-4 h-4" /> Nueva
          </button>
        </div>

        {metas.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <Target className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Creá tu primera meta</p>
          </div>
        ) : (
          <div className="space-y-4">
            {metas.map(m => {
              const pct = Math.min((m.progreso / m.objetivo) * 100, 100)
              const isDone = pct >= 100

              return (
                <div key={m.id} className={`border-2 rounded-xl p-4 ${isDone ? 'bg-emerald-50 border-emerald-300' : 'border-slate-200'}`}>
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="text-2xl mb-1">{m.icono}</div>
                      <div className="font-bold">{m.nombre}</div>
                      <div className="text-sm text-slate-500">Meta: {formatMoney(m.objetivo, m.moneda)}</div>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => openEditMeta(m)} className="p-2 hover:bg-slate-100 rounded-lg">
                        <Edit2 className="w-4 h-4 text-slate-500" />
                      </button>
                      <button onClick={() => deleteMeta(m.id)} className="p-2 hover:bg-red-50 rounded-lg">
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="bg-slate-200 h-3 rounded-full overflow-hidden mb-2">
                    <div 
                      className={`h-full rounded-full transition-all ${isDone ? 'bg-emerald-500' : 'bg-gradient-to-r from-indigo-500 to-purple-500'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-sm mb-3">
                    <span className="text-indigo-600 font-bold">{formatMoney(m.progreso, m.moneda)}</span>
                    <span className="font-bold">{pct.toFixed(0)}%</span>
                  </div>

                  {isDone ? (
                    <div className="bg-emerald-100 text-emerald-700 p-3 rounded-lg text-center font-bold">
                      🎉 ¡FELICITACIONES!
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        type="number"
                        className="input flex-1"
                        placeholder="Agregar"
                        id={`meta-input-${m.id}`}
                      />
                      <button
                        onClick={() => {
                          const input = document.getElementById(`meta-input-${m.id}`) as HTMLInputElement | null
                          if (!input) return
                          const val = parseFloat(input.value)
                          if (val > 0) {
                            addToMeta(m, val)
                            input.value = ''
                          }
                        }}
                        className="btn btn-success"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Meta Modal */}
      {showMetaModal && (
        <div className="modal-overlay" onClick={() => setShowMetaModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-lg">{editingMeta ? 'Editar' : 'Nueva'} Meta</h3>
              <button onClick={() => setShowMetaModal(false)} className="p-1 hover:bg-slate-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="label">Nombre</label>
                <input
                  type="text"
                  className="input"
                  placeholder="Ej: Vacaciones 2025"
                  value={metaForm.nombre}
                  onChange={e => setMetaForm(f => ({ ...f, nombre: e.target.value }))}
                />
              </div>
              <div>
                <label className="label">Ícono</label>
                <div className="flex gap-2 flex-wrap">
                  {iconOptions.map(icon => (
                    <button
                      key={icon}
                      type="button"
                      onClick={() => setMetaForm(f => ({ ...f, icono: icon }))}
                      className={`w-10 h-10 rounded-lg text-xl ${metaForm.icono === icon ? 'bg-indigo-100 ring-2 ring-indigo-500' : 'bg-slate-100'}`}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Objetivo</label>
                  <input
                    type="number"
                    className="input"
                    placeholder="100000"
                    value={metaForm.objetivo}
                    onChange={e => setMetaForm(f => ({ ...f, objetivo: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="label">Moneda</label>
                  <select
                    className="input"
                    value={metaForm.moneda}
                    onChange={e => setMetaForm(f => ({ ...f, moneda: e.target.value }))}
                  >
                    <option value="ARS">Pesos</option>
                    <option value="USD">USD</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Progreso actual</label>
                <input
                  type="number"
                  className="input"
                  placeholder="0"
                  value={metaForm.progreso}
                  onChange={e => setMetaForm(f => ({ ...f, progreso: e.target.value }))}
                />
              </div>
              <button onClick={handleSaveMeta} className="btn btn-primary w-full justify-center">
                {editingMeta ? 'Guardar' : 'Crear Meta 🎯'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Historial Completo */}
      {showMovimientosModal && (
        <div className="modal-overlay" onClick={() => setShowMovimientosModal(false)}>
          <div className="modal max-w-2xl" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-lg">
                Historial de {currentTipo === 'pesos' ? 'Pesos' : 'Dólares'}
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={exportToExcel}
                  className="btn btn-secondary text-sm"
                  title="Exportar a Excel"
                >
                  <Download className="w-4 h-4" />
                  Excel
                </button>
                <button onClick={() => setShowMovimientosModal(false)} className="p-1 hover:bg-slate-100 rounded">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-4 border-b border-slate-200 space-y-3">
              <div>
                <label className="label text-xs">Filtrar por mes</label>
                <div className="flex gap-2">
                  <input
                    type="month"
                    className="input text-sm"
                    value={filterFecha}
                    onChange={e => setFilterFecha(e.target.value)}
                  />
                  {filterFecha && (
                    <button
                      onClick={() => setFilterFecha('')}
                      className="btn btn-secondary text-sm"
                    >
                      Limpiar
                    </button>
                  )}
                </div>
              </div>
              {movimientos.filter(m => m.tipo === currentTipo).length > 0 && (
                <button
                  onClick={() => setShowDeleteAllModal(true)}
                  className="btn btn-danger text-sm w-full justify-center"
                >
                  <Trash2 className="w-4 h-4" />
                  Eliminar todos los movimientos
                </button>
              )}
            </div>
            <div className="p-4 max-h-96 overflow-y-auto">
              <div className="space-y-2">
                {movimientos
                  .filter(m => m.tipo === currentTipo)
                  .filter(m => {
                    if (!filterFecha) return true
                    const movFecha = new Date(m.fecha)
                    const [year, month] = filterFecha.split('-')
                    return movFecha.getFullYear() === parseInt(year) &&
                           movFecha.getMonth() === parseInt(month) - 1
                  })
                  .map(m => (
                  <div key={m.id} className="flex items-center justify-between p-3 border border-slate-200 rounded-lg hover:bg-slate-50">
                    <div className="flex-1">
                      <div className="text-sm font-medium">{new Date(m.fecha).toLocaleDateString('es-AR', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}</div>
                      {m.descripcion && <div className="text-xs text-slate-600 mt-1">{m.descripcion}</div>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`font-bold mr-2 ${m.monto > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {m.monto > 0 ? '+' : ''}{formatMoney(m.monto, currentTipo === 'usd' ? 'USD' : 'ARS')}
                      </span>
                      <button
                        onClick={() => {
                          setEditingMovimiento(m)
                          setEditForm({
                            monto: String(Math.abs(m.monto)),
                            descripcion: m.descripcion || ''
                          })
                        }}
                        className="flex items-center gap-1 px-3 py-2 hover:bg-blue-50 rounded-lg text-blue-600 transition-colors"
                        title="Editar movimiento"
                      >
                        <Edit2 className="w-4 h-4" />
                        <span className="text-xs font-medium hidden sm:inline">Editar</span>
                      </button>
                      <button
                        onClick={() => setMovimientoToDelete(m)}
                        className="flex items-center gap-1 px-3 py-2 hover:bg-red-50 rounded-lg text-red-600 transition-colors"
                        title="Eliminar movimiento"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span className="text-xs font-medium hidden sm:inline">Borrar</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Editar Movimiento */}
      {editingMovimiento && (
        <div className="modal-overlay" onClick={() => setEditingMovimiento(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-lg">Editar Movimiento</h3>
              <button onClick={() => setEditingMovimiento(null)} className="p-1 hover:bg-slate-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="label">Tipo</label>
                <div className="text-sm text-slate-600">
                  {editingMovimiento.monto > 0 ? '➕ Agregar' : '➖ Quitar'} {editingMovimiento.tipo === 'pesos' ? 'Pesos' : 'Dólares'}
                </div>
              </div>
              <div>
                <label className="label">Monto</label>
                <input
                  type="number"
                  className="input"
                  placeholder="0"
                  value={editForm.monto}
                  onChange={e => setEditForm(f => ({ ...f, monto: e.target.value }))}
                />
              </div>
              <div>
                <label className="label">Descripción</label>
                <input
                  type="text"
                  className="input"
                  placeholder="Opcional"
                  value={editForm.descripcion}
                  onChange={e => setEditForm(f => ({ ...f, descripcion: e.target.value }))}
                />
              </div>
              <button onClick={handleSaveEditMovimiento} className="btn btn-primary w-full justify-center">
                Guardar Cambios
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmación de Eliminación Individual */}
      {movimientoToDelete && (
        <div className="modal-overlay" onClick={() => setMovimientoToDelete(null)}>
          <div className="modal max-w-md" onClick={e => e.stopPropagation()}>
            <div className="p-6 text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                <Trash2 className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">
                ¿Eliminar movimiento?
              </h3>
              <p className="text-sm text-slate-500 mb-4">
                Se eliminará el movimiento de <strong>{formatMoney(Math.abs(movimientoToDelete.monto), movimientoToDelete.tipo === 'usd' ? 'USD' : 'ARS')}</strong> del {new Date(movimientoToDelete.fecha).toLocaleDateString('es-AR')}.
              </p>
              {movimientoToDelete.descripcion && (
                <p className="text-sm text-slate-600 mb-4 italic">"{movimientoToDelete.descripcion}"</p>
              )}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
                <p className="text-xs text-amber-800">
                  ⚠️ Esta acción actualizará tu patrimonio automáticamente
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setMovimientoToDelete(null)}
                  className="btn btn-secondary flex-1 justify-center"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDeleteMovimiento}
                  className="btn btn-danger flex-1 justify-center"
                >
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmación de Eliminar Todos */}
      {showDeleteAllModal && (
        <div className="modal-overlay" onClick={() => {
  if (!isDeleting) {
    setShowDeleteAllModal(false)
    setDeleteAllConfirmText('')
  }
}}>
          <div className="modal max-w-md" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                <Trash2 className="h-6 w-6 text-red-600" />
              </div>

              {isDeleting ? (
                <>
                  <h3 className="text-lg font-bold text-slate-900 mb-2 text-center">
                    Eliminando movimientos...
                  </h3>
                  <div className="mt-6 mb-4">
                    <div className="w-full bg-slate-200 rounded-full h-4 overflow-hidden">
                      <div
                        className="bg-red-600 h-full transition-all duration-300 rounded-full flex items-center justify-center"
                        style={{ width: `${deleteProgress}%` }}
                      >
                        <span className="text-xs font-bold text-white">{deleteProgress}%</span>
                      </div>
                    </div>
                    <p className="text-sm text-slate-600 text-center mt-3">
                      Por favor espera...
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <h3 className="text-lg font-bold text-slate-900 mb-2 text-center">
                    ⚠️ Eliminar TODOS los movimientos
                  </h3>
                  <p className="text-sm text-slate-500 mb-4 text-center">
                    Estás por eliminar <strong>{movimientos.filter(m => m.tipo === currentTipo).length} movimientos</strong> de {currentTipo === 'pesos' ? 'Pesos' : 'Dólares'}.
                  </p>
                  <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4 mb-4">
                    <p className="text-sm text-red-800 font-semibold mb-2">
                      🚨 Esta acción NO se puede deshacer
                    </p>
                    <p className="text-xs text-red-700">
                      Tu patrimonio será actualizado automáticamente y se eliminarán todos los registros históricos.
                    </p>
                  </div>
                  <div className="mb-4">
                    <label className="label text-sm font-semibold">
                      Para confirmar, escribe: <span className="text-red-600">ELIMINAR TODO</span>
                    </label>
                    <input
                      type="text"
                      className="input"
                      placeholder="Escribe aquí..."
                      value={deleteAllConfirmText}
                      onChange={e => setDeleteAllConfirmText(e.target.value)}
                      autoFocus
                    />
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => { setShowDeleteAllModal(false); setDeleteAllConfirmText('') }}
                      className="btn btn-secondary flex-1 justify-center"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleDeleteAll}
                      disabled={deleteAllConfirmText !== 'ELIMINAR TODO'}
                      className="btn btn-danger flex-1 justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Confirmar
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
