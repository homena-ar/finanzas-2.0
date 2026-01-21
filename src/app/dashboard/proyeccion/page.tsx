'use client'

import { useState, useEffect } from 'react'
import { useData } from '@/hooks/useData'
import { useWorkspace } from '@/hooks/useWorkspace'
import { useAuth } from '@/hooks/useAuth'
import { formatMoney, getMonthName, fetchDolar } from '@/lib/utils'
import { motion } from 'framer-motion'
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler } from 'chart.js'
import { Line } from 'react-chartjs-2'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler)

export default function ProyeccionPage() {
  const { currentWorkspace } = useWorkspace()
  const { profile } = useAuth()
  const { gastos, ingresos, currentMonth } = useData()
  const [dolar, setDolar] = useState(1000)
  
  useEffect(() => {
    fetchDolar().then(setDolar).catch(() => setDolar(1000))
  }, [])
  
  // Verificar si ingresos están habilitados
  const showIngresos = currentWorkspace
    ? currentWorkspace.ingresos_habilitado
    : profile?.ingresos_habilitado

  // Gastos fijos - ordenados: primero USD mayor a menor, luego ARS mayor a menor
  const fijos = gastos
    .filter(g => g.es_fijo)
    .sort((a, b) => {
      // Primero USD, luego ARS
      if (a.moneda === 'USD' && b.moneda !== 'USD') return -1
      if (a.moneda !== 'USD' && b.moneda === 'USD') return 1
      // Dentro de la misma moneda, de mayor a menor
      return b.monto - a.monto
    })

  let totalFijosARS = 0, totalFijosUSD = 0
  fijos.forEach(g => {
    if (g.moneda === 'USD') totalFijosUSD += g.monto
    else totalFijosARS += g.monto
  })

  // Calcular ingresos promedio del mes actual (para proyección)
  const mesActualKey = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`
  const ingresosMesActual = showIngresos ? ingresos.filter(i => i.mes === mesActualKey) : []
  let promedioIngresosARS = 0, promedioIngresosUSD = 0
  if (ingresosMesActual.length > 0) {
    ingresosMesActual.forEach(i => {
      if (i.moneda === 'USD') promedioIngresosUSD += i.monto
      else promedioIngresosARS += i.monto
    })
  }

  // Cuotas pendientes
  const cuotas = gastos.filter(g => g.cuotas > 1 && !g.es_fijo)

  // Proyección 12 meses
  const proyeccion = []
  for (let i = 0; i < 12; i++) {
    const mes = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + i, 1)
    const mesKey = `${mes.getFullYear()}-${String(mes.getMonth() + 1).padStart(2, '0')}`

    // Empezar con los gastos fijos
    let totalGastosARS = totalFijosARS
    let totalGastosUSD = totalFijosUSD

    // Sumar las cuotas correspondientes a este mes
    cuotas.forEach(g => {
      const start = new Date(g.mes_facturacion + '-01')
      const diff = (mes.getFullYear() - start.getFullYear()) * 12 + mes.getMonth() - start.getMonth()
      if (diff >= 0 && diff < g.cuotas) {
        const cuotaMonto = g.monto / g.cuotas
        if (g.moneda === 'USD') {
          totalGastosUSD += cuotaMonto
        } else {
          totalGastosARS += cuotaMonto
        }
      }
    })

    // Ingresos proyectados (usar promedio del mes actual si hay ingresos habilitados)
    let totalIngresosARS = 0
    let totalIngresosUSD = 0
    
    if (showIngresos) {
      // Usar el promedio del mes actual como proyección
      totalIngresosARS = promedioIngresosARS
      totalIngresosUSD = promedioIngresosUSD
      
      // También considerar ingresos específicos de ese mes si existen
      ingresos.forEach(i => {
        const ingresoMes = new Date(i.fecha)
        if (ingresoMes.getFullYear() === mes.getFullYear() && ingresoMes.getMonth() === mes.getMonth()) {
          if (i.moneda === 'USD') {
            totalIngresosUSD += i.monto
          } else {
            totalIngresosARS += i.monto
          }
        }
      })
    }

    // Calcular balance
    const gastosTotalARS = totalGastosARS + (totalGastosUSD * dolar)
    const ingresosTotalARS = totalIngresosARS + (totalIngresosUSD * dolar)
    const balanceARS = ingresosTotalARS - gastosTotalARS

    proyeccion.push({ 
      mes, 
      mesKey, 
      totalGastosARS, 
      totalGastosUSD,
      totalIngresosARS,
      totalIngresosUSD,
      balanceARS
    })
  }
  
  // Datos para el gráfico
  const chartData = {
    labels: proyeccion.map(p => getMonthName(p.mes)),
    datasets: [
      {
        label: 'Gastos',
        data: proyeccion.map(p => p.totalGastosARS + (p.totalGastosUSD * dolar)),
        borderColor: 'rgb(239, 68, 68)',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        fill: true,
        tension: 0.4
      },
      ...(showIngresos ? [{
        label: 'Ingresos',
        data: proyeccion.map(p => p.totalIngresosARS + (p.totalIngresosUSD * dolar)),
        borderColor: 'rgb(16, 185, 129)',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        fill: true,
        tension: 0.4
      }] : []),
      ...(showIngresos ? [{
        label: 'Balance',
        data: proyeccion.map(p => p.balanceARS),
        borderColor: 'rgb(99, 102, 241)',
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
        fill: false,
        tension: 0.4,
        borderDash: [5, 5]
      }] : [])
    ]
  }
  
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: 'Proyección de 12 meses'
      },
      tooltip: {
        callbacks: {
          label: function(context: any) {
            return `${context.dataset.label}: ${formatMoney(context.parsed.y)}`
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: function(value: any) {
            return formatMoney(value)
          }
        }
      }
    }
  }

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  }

  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={containerVariants}
      className="space-y-6"
    >
      <motion.div variants={itemVariants}>
        <h1 className="text-2xl font-bold">Proyección</h1>
        <p className="text-slate-500">
          <><span className="text-indigo-600 font-medium">{currentWorkspace?.name || (profile?.personal_workspace_name || 'Espacio Personal')}</span> · </>
          Mirá cómo vienen los próximos 12 meses
        </p>
      </motion.div>

      {/* Gráfico de Proyección */}
      {showIngresos && (
        <motion.div variants={itemVariants} className="card p-5">
          <h3 className="font-bold mb-4">📈 Proyección de Ingresos vs Gastos (12 meses)</h3>
          <div className="h-80">
            <Line data={chartData} options={chartOptions} />
          </div>
        </motion.div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Próximos 12 meses */}
        <motion.div variants={itemVariants} className="card p-5">
          <h3 className="font-bold mb-4">📅 Próximos 12 Meses</h3>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {proyeccion.map(p => (
              <div key={p.mesKey} className="py-3 border-b border-slate-100 last:border-0">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-slate-600 font-medium">{getMonthName(p.mes)}</span>
                  <div className="text-right">
                    <div className="font-bold text-red-600">{formatMoney(p.totalGastosARS + (p.totalGastosUSD * dolar))}</div>
                    {showIngresos && (
                      <>
                        <div className="text-sm font-semibold text-emerald-600">
                          + {formatMoney(p.totalIngresosARS + (p.totalIngresosUSD * dolar))}
                        </div>
                        <div className={`text-xs font-bold ${p.balanceARS >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          Balance: {formatMoney(p.balanceARS)}
                        </div>
                      </>
                    )}
                  </div>
                </div>
                {(p.totalGastosUSD > 0 || (showIngresos && p.totalIngresosUSD > 0)) && (
                  <div className="flex justify-end gap-2 text-xs text-slate-500">
                    {p.totalGastosUSD > 0 && (
                      <span>Gastos USD: {formatMoney(p.totalGastosUSD, 'USD')}</span>
                    )}
                    {showIngresos && p.totalIngresosUSD > 0 && (
                      <span>Ingresos USD: {formatMoney(p.totalIngresosUSD, 'USD')}</span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </motion.div>

        {/* Gastos Fijos */}
        <motion.div variants={itemVariants} className="card p-5">
          <h3 className="font-bold mb-4">🔄 Gastos Fijos</h3>
          {fijos.length === 0 ? (
            <p className="text-slate-400 text-center py-8">Sin gastos fijos</p>
          ) : (
            <>
              <div className="space-y-2 mb-4">
                {fijos.map(g => (
                  <div key={g.id} className="flex justify-between items-center py-3 border-b border-slate-100 last:border-0">
                    <span className="text-slate-600">{g.descripcion}</span>
                    <span className={`font-bold ${g.moneda === 'USD' ? 'text-emerald-600' : ''}`}>
                      {formatMoney(g.monto, g.moneda)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="bg-indigo-50 rounded-xl p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="font-semibold text-indigo-700">Total ARS</span>
                  <span className="font-bold text-indigo-700">{formatMoney(totalFijosARS)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold text-indigo-700">Total USD</span>
                  <span className="font-bold text-indigo-700">{formatMoney(totalFijosUSD, 'USD')}</span>
                </div>
              </div>
            </>
          )}
        </motion.div>
      </div>

      {/* Cuotas Pendientes */}
      <motion.div variants={itemVariants} className="card overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200">
          <h3 className="font-bold">📊 Cuotas Pendientes</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50">
                <th className="text-left p-4 text-xs font-bold text-slate-500 uppercase">Descripción</th>
                <th className="text-left p-4 text-xs font-bold text-slate-500 uppercase">Cuota</th>
                <th className="text-left p-4 text-xs font-bold text-slate-500 uppercase">Valor</th>
                <th className="text-left p-4 text-xs font-bold text-slate-500 uppercase">Restante</th>
                <th className="text-left p-4 text-xs font-bold text-slate-500 uppercase">Finaliza</th>
              </tr>
            </thead>
            <tbody>
              {cuotas.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-400">Sin cuotas pendientes</td>
                </tr>
              ) : cuotas.map(g => {
                const valorCuota = g.monto / g.cuotas
                const start = new Date(g.mes_facturacion + '-01')
                const diff = (currentMonth.getFullYear() - start.getFullYear()) * 12 + currentMonth.getMonth() - start.getMonth()
                const cuotaActual = Math.min(diff + 1, g.cuotas)
                const restante = (g.cuotas - cuotaActual) * valorCuota
                const finMes = new Date(start)
                finMes.setMonth(finMes.getMonth() + g.cuotas - 1)

                return (
                  <tr key={g.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="p-4 font-semibold">{g.descripcion}</td>
                    <td className="p-4">
                      <span className="tag bg-indigo-100 text-indigo-700">
                        {cuotaActual}/{g.cuotas}
                      </span>
                    </td>
                    <td className={`p-4 font-bold ${g.moneda === 'USD' ? 'text-emerald-600' : ''}`}>
                      {formatMoney(valorCuota, g.moneda)}
                    </td>
                    <td className={`p-4 font-bold ${g.moneda === 'USD' ? 'text-emerald-600' : ''}`}>
                      {formatMoney(restante, g.moneda)}
                    </td>
                    <td className="p-4 text-slate-600">{getMonthName(finMes)}</td>
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
