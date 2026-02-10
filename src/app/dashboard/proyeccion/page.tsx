'use client'

import { useState, useEffect } from 'react'
import { useData } from '@/hooks/useData'
import { useWorkspace } from '@/hooks/useWorkspace'
import { useAuth } from '@/hooks/useAuth'
import { formatMoney, getMonthName, fetchDolar } from '@/lib/utils'
import { motion } from 'framer-motion'
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler } from 'chart.js'
import { Bar } from 'react-chartjs-2'
import { TrendingDown, TrendingUp, Repeat, CreditCard, Calendar, Info } from 'lucide-react'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler)

export default function ProyeccionPage() {
  const { currentWorkspace } = useWorkspace()
  const { profile } = useAuth()
  const { gastos, ingresos, currentMonth } = useData()
  const [dolar, setDolar] = useState(1000)

  useEffect(() => {
    fetchDolar().then(setDolar).catch(() => setDolar(1000))
  }, [])

  const showIngresos = currentWorkspace
    ? currentWorkspace.ingresos_habilitado
    : profile?.ingresos_habilitado

  // === GASTOS FIJOS ===
  const fijos = gastos
    .filter(g => g.es_fijo)
    .sort((a, b) => {
      if (a.moneda === 'USD' && b.moneda !== 'USD') return -1
      if (a.moneda !== 'USD' && b.moneda === 'USD') return 1
      return b.monto - a.monto
    })

  let totalFijosARS = 0, totalFijosUSD = 0
  fijos.forEach(g => {
    if (g.moneda === 'USD') totalFijosUSD += g.monto
    else totalFijosARS += g.monto
  })

  // === CUOTAS PENDIENTES ===
  const cuotas = gastos.filter(g => g.cuotas > 1 && !g.es_fijo)

  // === PROYECCIÓN 12 MESES ===
  const proyeccion = []
  for (let i = 0; i < 12; i++) {
    const mes = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + i, 1)
    const mesKey = `${mes.getFullYear()}-${String(mes.getMonth() + 1).padStart(2, '0')}`

    let totalGastosARS = totalFijosARS
    let totalGastosUSD = totalFijosUSD
    let cuotasActivasCount = 0

    cuotas.forEach(g => {
      const start = new Date(g.mes_facturacion + '-01')
      const diff = (mes.getFullYear() - start.getFullYear()) * 12 + mes.getMonth() - start.getMonth()
      if (diff >= 0 && diff < g.cuotas) {
        cuotasActivasCount++
        const cuotaMonto = g.monto / g.cuotas
        if (g.moneda === 'USD') totalGastosUSD += cuotaMonto
        else totalGastosARS += cuotaMonto
      }
    })

    let totalIngresosARS = 0, totalIngresosUSD = 0
    if (showIngresos) {
      ingresos.forEach(ingreso => {
        if (ingreso.mes === mesKey && (!(ingreso as any).pendiente_cobro || (ingreso as any).fecha_cobro_confirmada)) {
          if (ingreso.moneda === 'USD') totalIngresosUSD += ingreso.monto
          else totalIngresosARS += ingreso.monto
        }
      })
    }

    const gastosTotalARS = totalGastosARS + (totalGastosUSD * dolar)
    const ingresosTotalARS = totalIngresosARS + (totalIngresosUSD * dolar)

    proyeccion.push({
      mes, mesKey,
      totalGastosARS, totalGastosUSD, gastosTotalARS,
      totalIngresosARS, totalIngresosUSD, ingresosTotalARS,
      balanceARS: ingresosTotalARS - gastosTotalARS,
      cuotasActivas: cuotasActivasCount
    })
  }

  // Max gasto para barras de progreso
  const maxGasto = Math.max(...proyeccion.map(p => p.gastosTotalARS), 1)

  // Chart data - barras agrupadas, mucho más claras que líneas
  const chartData = {
    labels: proyeccion.map(p => {
      const parts = getMonthName(p.mes).split(' ')
      return parts[0].substring(0, 3)
    }),
    datasets: [
      {
        label: 'Gastos (ARS)',
        data: proyeccion.map(p => p.gastosTotalARS),
        backgroundColor: '#f43f5e',
        borderRadius: 4,
        barPercentage: showIngresos ? 0.4 : 0.6,
        categoryPercentage: 0.7,
      },
      ...(showIngresos ? [{
        label: 'Ingresos (ARS)',
        data: proyeccion.map(p => p.ingresosTotalARS),
        backgroundColor: '#10b981',
        borderRadius: 4,
        barPercentage: 0.4,
        categoryPercentage: 0.7,
      }] : [])
    ]
  }

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          boxWidth: 12,
          padding: 16,
          font: { size: 12 },
          color: '#64748b'
        }
      },
      title: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: any) => ` ${ctx.dataset.label}: ${formatMoney(ctx.parsed.y)}`
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: '#f1f5f9' },
        border: { display: false },
        ticks: {
          callback: (value: any) => {
            if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`
            if (value >= 1000) return `${(value / 1000).toFixed(0)}K`
            return value
          },
          font: { size: 11 },
          color: '#94a3b8'
        }
      },
      x: {
        grid: { display: false },
        border: { display: false },
        ticks: { font: { size: 11 }, color: '#64748b' }
      }
    }
  }

  // Mes actual vs. último mes proyectado
  const mesActual = proyeccion[0]
  const mesUltimo = proyeccion[proyeccion.length - 1]
  const tendenciaGastos = mesUltimo.gastosTotalARS - mesActual.gastosTotalARS

  const containerVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.08 } }
  }
  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  }

  return (
    <motion.div initial="hidden" animate="show" variants={containerVariants} className="space-y-5">
      <motion.div variants={itemVariants}>
        <h1 className="page-title">Proyección</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          <span className="text-primary font-medium">{currentWorkspace?.name || (profile?.personal_workspace_name || 'Espacio Personal')}</span>
          {' · '}Proyección de gastos a 12 meses
        </p>
      </motion.div>

      {/* Explicación clara */}
      <motion.div variants={itemVariants} className="bg-primary-50/50 border border-primary-100 rounded-xl p-4 flex items-start gap-3">
        <Info className="w-4 h-4 text-primary mt-0.5 shrink-0" />
        <p className="text-sm text-primary-800">
          Esta proyección calcula tus gastos futuros sumando <strong>gastos fijos</strong> (se repiten cada mes) + <strong>cuotas pendientes</strong> (hasta que terminen).
          {showIngresos && ' Los ingresos solo se muestran si ya están registrados para ese mes.'}
        </p>
      </motion.div>

      {/* Summary Cards */}
      <motion.div variants={itemVariants} className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="stat-card">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center">
              <Repeat className="w-4 h-4 text-blue-500" />
            </div>
            <div className="text-stat-label text-slate-400 uppercase">Gastos fijos</div>
          </div>
          <div className="text-stat-value">{formatMoney(totalFijosARS)}</div>
          {totalFijosUSD > 0 && <div className="text-xs text-slate-400 mt-0.5">+ {formatMoney(totalFijosUSD, 'USD')}</div>}
          <div className="text-xs text-slate-400 mt-0.5">{fijos.length} gastos por mes</div>
        </div>

        <div className="stat-card">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 bg-accent-50 rounded-xl flex items-center justify-center">
              <CreditCard className="w-4 h-4 text-accent" />
            </div>
            <div className="text-stat-label text-slate-400 uppercase">Cuotas activas</div>
          </div>
          <div className="text-stat-value">{cuotas.length}</div>
          <div className="text-xs text-slate-400 mt-0.5">{mesActual.cuotasActivas} este mes</div>
        </div>

        <div className="stat-card">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 bg-red-50 rounded-xl flex items-center justify-center">
              <TrendingDown className="w-4 h-4 text-red-500" />
            </div>
            <div className="text-stat-label text-slate-400 uppercase">Gasto este mes</div>
          </div>
          <div className="text-stat-value text-red-600">{formatMoney(mesActual.gastosTotalARS)}</div>
          <div className="text-xs text-slate-400 mt-0.5">ARS equivalente</div>
        </div>

        <div className="stat-card">
          <div className="flex items-center gap-3 mb-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${tendenciaGastos <= 0 ? 'bg-emerald-50' : 'bg-red-50'}`}>
              <Calendar className={`w-4 h-4 ${tendenciaGastos <= 0 ? 'text-emerald-500' : 'text-red-500'}`} />
            </div>
            <div className="text-stat-label text-slate-400 uppercase">En 12 meses</div>
          </div>
          <div className={`text-stat-value ${tendenciaGastos <= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {formatMoney(mesUltimo.gastosTotalARS)}
          </div>
          <div className={`text-xs mt-0.5 ${tendenciaGastos <= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
            {tendenciaGastos <= 0
              ? `${formatMoney(Math.abs(tendenciaGastos))} menos`
              : `${formatMoney(tendenciaGastos)} más`
            }
          </div>
        </div>
      </motion.div>

      {/* Chart - barras agrupadas */}
      <motion.div variants={itemVariants} className="card p-5">
        <h3 className="card-title mb-4">
          {showIngresos ? 'Gastos vs ingresos por mes' : 'Gastos proyectados por mes'}
        </h3>
        <div className="h-72">
          <Bar data={chartData} options={chartOptions} />
        </div>
        <p className="text-xs text-slate-400 mt-3 text-center">
          Montos en ARS equivalente (dólar a {formatMoney(dolar)})
        </p>
      </motion.div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Desglose mensual */}
        <motion.div variants={itemVariants} className="card p-5">
          <h3 className="card-title mb-4">Desglose mensual</h3>
          <div className="space-y-3">
            {proyeccion.map((p, i) => {
              const pct = (p.gastosTotalARS / maxGasto) * 100
              const isCurrentMonth = i === 0
              return (
                <div key={p.mesKey}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-medium ${isCurrentMonth ? 'text-primary' : 'text-slate-600'}`}>
                        {getMonthName(p.mes).split(' ')[0].substring(0, 3)} {getMonthName(p.mes).split(' ')[1]}
                      </span>
                      {isCurrentMonth && (
                        <span className="text-[10px] bg-primary-50 text-primary px-1.5 py-0.5 rounded font-medium">HOY</span>
                      )}
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-semibold text-red-600">{formatMoney(p.gastosTotalARS)}</span>
                      {showIngresos && p.ingresosTotalARS > 0 && (
                        <span className="text-xs text-emerald-500 ml-2">+{formatMoney(p.ingresosTotalARS)}</span>
                      )}
                    </div>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${isCurrentMonth ? 'bg-primary' : 'bg-red-400'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="flex justify-between mt-0.5">
                    <span className="text-[10px] text-slate-400">
                      Fijos + {p.cuotasActivas} cuota{p.cuotasActivas !== 1 ? 's' : ''}
                    </span>
                    {p.totalGastosUSD > 0 && (
                      <span className="text-[10px] text-emerald-500">{formatMoney(p.totalGastosUSD, 'USD')}</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </motion.div>

        {/* Gastos Fijos */}
        <motion.div variants={itemVariants} className="card p-5">
          <h3 className="card-title mb-1">Gastos fijos</h3>
          <p className="text-xs text-slate-400 mb-4">Se repiten todos los meses</p>
          {fijos.length === 0 ? (
            <p className="text-slate-400 text-center text-sm py-8">Sin gastos fijos</p>
          ) : (
            <>
              <div className="space-y-1">
                {fijos.map(g => (
                  <div key={g.id} className="flex justify-between items-center p-2.5 rounded-lg hover:bg-slate-50 transition-colors">
                    <span className="text-sm text-slate-700">{g.descripcion}</span>
                    <span className={`text-sm font-semibold ${g.moneda === 'USD' ? 'text-emerald-600' : 'text-slate-800'}`}>
                      {formatMoney(g.monto, g.moneda)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="bg-primary-50 rounded-xl p-3 mt-4">
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-primary-700">Total mensual</span>
                  <div className="text-right">
                    <span className="font-bold text-primary-700">{formatMoney(totalFijosARS)}</span>
                    {totalFijosUSD > 0 && (
                      <span className="text-xs text-primary-500 ml-1">+ {formatMoney(totalFijosUSD, 'USD')}</span>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </motion.div>
      </div>

      {/* Cuotas Pendientes */}
      <motion.div variants={itemVariants} className="card overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="card-title">Cuotas pendientes</h3>
            <p className="text-xs text-slate-400 mt-0.5">Desaparecen de la proyección al terminar</p>
          </div>
          <span className="text-stat-label bg-primary-50 text-primary px-2 py-0.5 rounded-lg">{cuotas.length} cuotas</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px]">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="text-left px-5 py-3 text-stat-label text-slate-400 uppercase">Descripción</th>
                <th className="text-left px-5 py-3 text-stat-label text-slate-400 uppercase">Progreso</th>
                <th className="text-left px-5 py-3 text-stat-label text-slate-400 uppercase">Cuota</th>
                <th className="text-left px-5 py-3 text-stat-label text-slate-400 uppercase">Restante</th>
                <th className="text-left px-5 py-3 text-stat-label text-slate-400 uppercase">Finaliza</th>
              </tr>
            </thead>
            <tbody>
              {cuotas.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-sm text-slate-400">Sin cuotas pendientes</td>
                </tr>
              ) : cuotas.map(g => {
                const valorCuota = g.monto / g.cuotas
                const start = new Date(g.mes_facturacion + '-01')
                const diff = (currentMonth.getFullYear() - start.getFullYear()) * 12 + currentMonth.getMonth() - start.getMonth()
                const cuotaActual = Math.max(1, Math.min(diff + 1, g.cuotas))
                const restante = (g.cuotas - cuotaActual) * valorCuota
                const pctCompleted = (cuotaActual / g.cuotas) * 100
                const finMes = new Date(start)
                finMes.setMonth(finMes.getMonth() + g.cuotas - 1)

                return (
                  <tr key={g.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-3">
                      <div className="font-medium text-sm text-slate-800">{g.descripcion}</div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full" style={{ width: `${pctCompleted}%` }} />
                        </div>
                        <span className="text-xs text-slate-500 whitespace-nowrap">{cuotaActual}/{g.cuotas}</span>
                      </div>
                    </td>
                    <td className={`px-5 py-3 font-semibold text-sm ${g.moneda === 'USD' ? 'text-emerald-600' : 'text-slate-800'}`}>
                      {formatMoney(valorCuota, g.moneda)}
                    </td>
                    <td className={`px-5 py-3 text-sm ${g.moneda === 'USD' ? 'text-emerald-600' : 'text-slate-600'}`}>
                      {formatMoney(restante, g.moneda)}
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-500 whitespace-nowrap">{getMonthName(finMes)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </motion.div>
    </motion.div>
  )
}
