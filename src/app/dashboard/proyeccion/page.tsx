'use client'

import { useData } from '@/hooks/useData'
import { formatMoney, getMonthName, getTagClass } from '@/lib/utils'
import { motion } from 'framer-motion'

export default function ProyeccionPage() {
  const { gastos, tarjetas, currentMonth } = useData()

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

  // Cuotas pendientes
  const cuotas = gastos.filter(g => g.cuotas > 1 && !g.es_fijo)

  // Proyección 6 meses
  const proyeccion = []
  for (let i = 0; i < 6; i++) {
    const mes = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + i, 1)
    const mesKey = `${mes.getFullYear()}-${String(mes.getMonth() + 1).padStart(2, '0')}`

    // Empezar con los gastos fijos
    let totalARS = totalFijosARS
    let totalUSD = totalFijosUSD

    // Sumar las cuotas correspondientes a este mes
    cuotas.forEach(g => {
      const start = new Date(g.mes_facturacion + '-01')
      const diff = (mes.getFullYear() - start.getFullYear()) * 12 + mes.getMonth() - start.getMonth()
      if (diff >= 0 && diff < g.cuotas) {
        const cuotaMonto = g.monto / g.cuotas
        if (g.moneda === 'USD') {
          totalUSD += cuotaMonto
        } else {
          totalARS += cuotaMonto
        }
      }
    })

    proyeccion.push({ mes, mesKey, totalARS, totalUSD })
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
        <p className="text-slate-500">Mirá cómo vienen los próximos meses</p>
      </motion.div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Próximos 6 meses */}
        <motion.div variants={itemVariants} className="card p-5">
          <h3 className="font-bold mb-4">📅 Próximos 6 Meses (con gastos fijos)</h3>
          <div className="space-y-2">
            {proyeccion.map(p => (
              <div key={p.mesKey} className="py-3 border-b border-slate-100 last:border-0">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-slate-600 font-medium">{getMonthName(p.mes)}</span>
                  <span className="font-bold">{formatMoney(p.totalARS)}</span>
                </div>
                {p.totalUSD > 0 && (
                  <div className="flex justify-end">
                    <span className="text-sm text-emerald-600 font-semibold">+ {formatMoney(p.totalUSD, 'USD')}</span>
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
