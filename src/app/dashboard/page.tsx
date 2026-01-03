'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useData } from '@/hooks/useData'
import { useAuth } from '@/hooks/useAuth'
import { formatMoney, getMonthName, fetchDolar, getTagClass, getMonthKey } from '@/lib/utils'
import { Download, TrendingUp, CreditCard, Receipt, Pin, DollarSign, Calendar, X, ChevronRight } from 'lucide-react'
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js'
import { Doughnut } from 'react-chartjs-2'
import { AlertModal } from '@/components/Modal'
import * as XLSX from 'xlsx'

ChartJS.register(ArcElement, Tooltip, Legend)

export default function DashboardPage() {
  const router = useRouter()
  const { profile } = useAuth()
  const {
    tarjetas, categorias, gastos, loading, currentMonth, monthKey, changeMonth,
    getGastosMes, getImpuestosMes
  } = useData()
  const [dolar, setDolar] = useState(1050)
  const [showEndingModal, setShowEndingModal] = useState(false)
  const [showMonthAlert, setShowMonthAlert] = useState(false)
  const [hasShownInitialAlert, setHasShownInitialAlert] = useState(false)

  console.log('📄 [ResumenPage] Render - loading:', loading)

  // Create lookup maps for categorias and tarjetas
  const categoriaMap = Object.fromEntries(categorias.map(c => [c.id, c]))
  const tarjetaMap = Object.fromEntries(tarjetas.map(t => [t.id, t]))

  useEffect(() => {
    fetchDolar()
      .then(setDolar)
      .catch(err => console.error('Error al obtener cotización del dólar:', err))
  }, [])

  // Check if viewing a different month than current (AL INICIAR CADA SESIÓN)
  useEffect(() => {
    if (!loading && !hasShownInitialAlert) {
      const today = new Date()
      const currentMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`

      // Siempre mostrar si el mes guardado no es el actual
      if (monthKey !== currentMonthKey) {
        setShowMonthAlert(true)
        sessionStorage.setItem('monthAlertShown', 'true')
      }

      setHasShownInitialAlert(true)
    }
  }, [loading, hasShownInitialAlert, monthKey])

  // Export to Excel function
  const exportToExcel = () => {
    // Prepare gastos data
    const gastosData = gastosMes.map(g => {
      const monto = g.cuotas > 1 ? g.monto / g.cuotas : g.monto
      return {
        'Fecha': g.fecha,
        'Descripción': g.descripcion,
        'Categoría': categoriaMap[g.categoria_id || '']?.nombre || 'Sin categoría',
        'Tarjeta': tarjetaMap[g.tarjeta_id || '']?.nombre || 'Efectivo',
        'Monto': monto,
        'Moneda': g.moneda,
        'Cuotas': g.cuotas > 1 ? `${g.cuota_actual || 1}/${g.cuotas}` : '-',
        'Fijo': g.es_fijo ? 'Sí' : 'No',
        'Pagado': g.pagado ? 'Sí' : 'No'
      }
    })

    // Prepare impuestos data
    const impuestosData = impuestosMes.map(i => ({
      'Descripción': i.descripcion,
      'Tarjeta': tarjetaMap[i.tarjeta_id || '']?.nombre || 'Efectivo',
      'Monto': i.monto,
      'Mes': i.mes
    }))

    // Create workbook
    const wb = XLSX.utils.book_new()

    // Add Gastos sheet
    const wsGastos = XLSX.utils.json_to_sheet(gastosData)
    XLSX.utils.book_append_sheet(wb, wsGastos, 'Gastos')

    // Add Impuestos sheet
    const wsImpuestos = XLSX.utils.json_to_sheet(impuestosData)
    XLSX.utils.book_append_sheet(wb, wsImpuestos, 'Impuestos')

    // Add Summary sheet
    const summaryData = [
      { 'Concepto': 'Gastos ARS', 'Monto': totalARS },
      { 'Concepto': 'Gastos USD', 'Monto': totalUSD },
      { 'Concepto': 'Impuestos', 'Monto': totalImpuestos },
      { 'Concepto': 'Total a Pagar (ARS)', 'Monto': totalPagar },
      { 'Concepto': 'Dólar', 'Monto': dolar }
    ]
    const wsSummary = XLSX.utils.json_to_sheet(summaryData)
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumen')

    // Download
    XLSX.writeFile(wb, `Gastos_${getMonthName(currentMonth).replace(' ', '_')}.xlsx`)
  }

  if (loading) {
    console.log('📄 [ResumenPage] SHOWING LOADING SPINNER - loading is TRUE')
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  console.log('📄 [ResumenPage] Rendering content - loading is FALSE')

  const gastosMes = getGastosMes(monthKey)
  const impuestosMes = getImpuestosMes(monthKey)

  // Próximo mes
  const nextMonth = new Date(currentMonth)
  nextMonth.setMonth(nextMonth.getMonth() + 1)
  const nextMonthKey = getMonthKey(nextMonth)
  const gastosProximoMes = getGastosMes(nextMonthKey)
  const impuestosProximoMes = getImpuestosMes(nextMonthKey)

  // Calcular totales MES ACTUAL (sin contar los pagados)
  let totalARS = 0, totalUSD = 0, totalFijos = 0, totalFijosUSD = 0
  gastosMes.filter(g => !g.pagado).forEach(g => {
    const monto = g.cuotas > 1 ? g.monto / g.cuotas : g.monto
    if (g.moneda === 'USD') {
      totalUSD += monto
      if (g.es_fijo) totalFijosUSD += monto
    } else {
      totalARS += monto
      if (g.es_fijo) totalFijos += monto
    }
  })
  
  const totalImpuestos = impuestosMes.reduce((s, i) => s + i.monto, 0)
  const totalPagar = totalARS + totalImpuestos
  const usdEnPesos = totalUSD * dolar

  // Calcular totales PRÓXIMO MES (sin contar los pagados)
  let proximoARS = 0, proximoUSD = 0, proximoFijosARS = 0, proximoFijosUSD = 0
  gastosProximoMes.filter(g => !g.pagado).forEach(g => {
    const monto = g.cuotas > 1 ? g.monto / g.cuotas : g.monto
    if (g.moneda === 'USD') {
      proximoUSD += monto
      if (g.es_fijo) proximoFijosUSD += monto
    } else {
      proximoARS += monto
      if (g.es_fijo) proximoFijosARS += monto
    }
  })
  const proximoImpuestos = impuestosProximoMes.reduce((s, i) => s + i.monto, 0)

  // GASTOS QUE TERMINAN ESTE MES (no están en próximo mes, excluyendo fijos y pagados)
  const gastosTerminan = gastosMes.filter(g => {
    if (g.es_fijo || g.pagado) return false
    return !gastosProximoMes.some(gp => gp.id === g.id)
  })

  let terminanARS = 0, terminanUSD = 0
  gastosTerminan.forEach(g => {
    const monto = g.cuotas > 1 ? g.monto / g.cuotas : g.monto
    if (g.moneda === 'USD') terminanUSD += monto
    else terminanARS += monto
  })

  // GASTOS FIJOS QUE QUEDAN PARA PRÓXIMO MES
  const fijosSiguenARS = proximoFijosARS
  const fijosSiguenUSD = proximoFijosUSD

  // DIFERENCIAS
  const diferenciaARS = totalARS - proximoARS
  const diferenciaUSD = totalUSD - proximoUSD
  const totalActual = totalARS + totalImpuestos + (totalUSD * dolar)
  const totalProximo = proximoARS + proximoImpuestos + (proximoUSD * dolar)
  const diferenciaTotal = totalActual - totalProximo

  // Budget check (solo si está habilitado)
  const budgetARS = profile?.budget_ars || 0
  const budgetUSD = profile?.budget_usd || 0
  const hasBudget = budgetARS > 0 || budgetUSD > 0

  // Calcular presupuesto total y gastado total en ARS
  const budgetTotalARS = budgetARS + (budgetUSD * dolar)
  const gastadoTotalARS = totalPagar + (totalUSD * dolar)
  const budgetPct = hasBudget ? (gastadoTotalARS / budgetTotalARS) * 100 : 0
  const budgetStatus = budgetPct >= 100 ? 'danger' : budgetPct >= 80 ? 'warning' : 'ok'

  // Alertas
  const alerts: { type: string; icon: string; title: string; desc: string }[] = []
  const today = new Date()
  const day = today.getDate()
  
  tarjetas.forEach(t => {
    if (t.cierre) {
      const diff = t.cierre - day
      if (diff > 0 && diff <= 5) {
        alerts.push({ type: 'warning', icon: '📅', title: `Cierre ${t.nombre}`, desc: `Faltan ${diff} días` })
      } else if (diff === 0) {
        alerts.push({ type: 'danger', icon: '🚨', title: `¡HOY cierra ${t.nombre}!`, desc: 'Último día' })
      }
    }
  })

  if (hasBudget && budgetPct >= 90) {
    alerts.push({
      type: budgetPct >= 100 ? 'danger' : 'warning',
      icon: '💸',
      title: budgetPct >= 100 ? '¡Presupuesto excedido!' : 'Cerca del límite',
      desc: `${formatMoney(totalPagar)} / ${formatMoney(budgetARS)}`
    })
  }

  // Chart data por categoría
  const catTotals: Record<string, number> = {}
  gastosMes.filter(g => g.moneda === 'ARS').forEach(g => {
    const catName = categoriaMap[g.categoria_id || '']?.nombre || 'Otros'
    const monto = g.cuotas > 1 ? g.monto / g.cuotas : g.monto
    catTotals[catName] = (catTotals[catName] || 0) + monto
  })

  const chartData = {
    labels: Object.keys(catTotals),
    datasets: [{
      data: Object.values(catTotals),
      backgroundColor: ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6', '#ec4899'],
      borderWidth: 0
    }]
  }

  // Top 5 gastos (sin contar pagados)
  const topGastos = [...gastosMes]
    .filter(g => g.moneda === 'ARS' && !g.pagado)
    .sort((a, b) => {
      const montoA = a.cuotas > 1 ? a.monto / a.cuotas : a.monto
      const montoB = b.cuotas > 1 ? b.monto / b.cuotas : b.monto
      return montoB - montoA
    })
    .slice(0, 5)

  return (
    <div className="space-y-6">
      {/* Header - CORREGIDO: usa currentMonth */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Resumen</h1>
          <p className="text-slate-500">Vista general de {getMonthName(currentMonth)}</p>
        </div>
        <button onClick={exportToExcel} className="btn btn-success">
          <Download className="w-4 h-4" />
          Exportar Excel
        </button>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((alert, i) => (
            <div 
              key={i}
              className={`flex items-center gap-4 p-4 rounded-xl ${
                alert.type === 'danger' 
                  ? 'bg-red-50 border border-red-200 text-red-800'
                  : 'bg-amber-50 border border-amber-200 text-amber-800'
              }`}
            >
              <span className="text-2xl">{alert.icon}</span>
              <div>
                <div className="font-bold">{alert.title}</div>
                <div className="text-sm opacity-80">{alert.desc}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Budget Progress - Solo si está habilitado */}
      {hasBudget && (
        <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl p-6 text-white">
          <div className="font-bold mb-4">💰 Presupuesto del Mes</div>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <div className="text-sm opacity-80">Gastado</div>
              <div className="text-xl font-bold">{formatMoney(totalPagar)}</div>
              {totalUSD > 0 && (
                <div className="text-sm opacity-80">+{formatMoney(totalUSD, 'USD')}</div>
              )}
            </div>
            <div>
              <div className="text-sm opacity-80">Límite</div>
              {budgetARS > 0 && (
                <div className="text-xl font-bold">{formatMoney(budgetARS)}</div>
              )}
              {budgetUSD > 0 && (
                <div className={budgetARS > 0 ? "text-sm opacity-80" : "text-xl font-bold"}>
                  {budgetARS > 0 ? '+' : ''}{formatMoney(budgetUSD, 'USD')}
                </div>
              )}
            </div>
            <div>
              <div className="text-sm opacity-80">{budgetTotalARS - gastadoTotalARS >= 0 ? 'Disponible' : 'Excedido'}</div>
              <div className="text-xl font-bold">{formatMoney(Math.abs(budgetTotalARS - gastadoTotalARS))}</div>
            </div>
          </div>
          <div className="bg-white/20 h-3 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                budgetStatus === 'danger' ? 'bg-red-400' :
                budgetStatus === 'warning' ? 'bg-amber-400' : 'bg-emerald-400'
              }`}
              style={{ width: `${Math.min(budgetPct, 100)}%` }}
            />
          </div>
          <div className="text-sm mt-2 opacity-80">{budgetPct.toFixed(1)}% usado</div>
        </div>
      )}

      {/* ========== PROYECCIÓN PRÓXIMO MES - MEJORADA ========== */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-5 h-5 text-indigo-600" />
          <h3 className="font-bold text-lg">Proyección {getMonthName(nextMonth)}</h3>
        </div>

        <div className="grid md:grid-cols-3 gap-4 mb-4">
          {/* Gastos que terminan - Clickeable para abrir modal */}
          <div 
            className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 cursor-pointer hover:bg-emerald-100 transition"
            onClick={() => gastosTerminan.length > 0 && setShowEndingModal(true)}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-emerald-700 font-bold text-sm">✅ Terminan este mes</span>
              {gastosTerminan.length > 0 && <ChevronRight className="w-4 h-4 text-emerald-600" />}
            </div>
            <div className="text-2xl font-bold text-emerald-700">{gastosTerminan.length}</div>
            <div className="text-xs text-emerald-600 mt-1">
              {formatMoney(terminanARS)} + {formatMoney(terminanUSD, 'USD')}
            </div>
          </div>

          {/* Gastos fijos que siguen */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="text-blue-700 font-bold text-sm mb-2">📌 Fijos continúan</div>
            <div className="text-lg font-bold text-blue-700">{formatMoney(fijosSiguenARS)}</div>
            <div className="text-xs text-blue-600">{formatMoney(fijosSiguenUSD, 'USD')}</div>
          </div>

          {/* Diferencia */}
          <div className={`rounded-xl p-4 ${diferenciaARS > 0 ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'}`}>
            <div className="text-slate-600 font-bold text-sm mb-2">
              📊 Diferencia
              <div className="text-xs font-normal text-slate-500 mt-1">
                Cuánto {diferenciaARS > 0 ? 'menos' : 'más'} vas a gastar
              </div>
            </div>
            <div className={`text-lg font-bold ${diferenciaARS > 0 ? 'text-emerald-700' : 'text-red-700'}`}>
              {diferenciaARS > 0 ? '-' : '+'}{formatMoney(Math.abs(diferenciaARS))}
            </div>
            <div className={`text-xs ${diferenciaUSD >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {diferenciaUSD >= 0 ? '-' : '+'}{formatMoney(Math.abs(diferenciaUSD), 'USD')}
            </div>
          </div>
        </div>

        {/* Comparación detallada */}
        <div className="bg-slate-50 rounded-xl p-4">
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <div className="text-xs text-slate-500 uppercase font-semibold">Este mes ({getMonthName(currentMonth).split(' ')[0]})</div>
              <div className="text-xl font-bold mt-1">{formatMoney(totalARS + totalImpuestos)}</div>
              <div className="text-xs text-slate-500">(+ {formatMoney(totalUSD, 'USD')} ≈ {formatMoney(usdEnPesos)})</div>
            </div>
            <div>
              <div className="text-xs text-slate-500 uppercase font-semibold">Próximo ({getMonthName(nextMonth).split(' ')[0]})</div>
              <div className="text-xl font-bold mt-1">{formatMoney(proximoARS + proximoImpuestos)}</div>
              <div className="text-xs text-slate-500">(+ {formatMoney(proximoUSD, 'USD')} ≈ {formatMoney(proximoUSD * dolar)})</div>
            </div>
          </div>
          <div className="text-center text-sm text-slate-500 mt-3 pt-3 border-t border-slate-200">
            {diferenciaTotal > 0
              ? `🎉 Vas a gastar ${formatMoney(diferenciaTotal)} menos (total en ARS)`
              : diferenciaTotal < 0
                ? `⚠️ Vas a gastar ${formatMoney(Math.abs(diferenciaTotal))} más (total en ARS)`
                : '➡️ Mismo gasto proyectado'
            }
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="stat-card">
          <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center mb-3">
            <TrendingUp className="w-5 h-5 text-red-600" />
          </div>
          <div className="text-xs text-slate-500 font-semibold uppercase">Total a Pagar</div>
          <div className="text-xl font-bold text-red-600">{formatMoney(totalPagar)}</div>
        </div>

        <div className="stat-card">
          <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center mb-3">
            <CreditCard className="w-5 h-5 text-indigo-600" />
          </div>
          <div className="text-xs text-slate-500 font-semibold uppercase">Consumos ARS</div>
          <div className="text-xl font-bold">{formatMoney(totalARS)}</div>
        </div>

        <div className="stat-card">
          <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center mb-3">
            <DollarSign className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="text-xs text-slate-500 font-semibold uppercase">Consumos USD</div>
          <div className="text-xl font-bold text-emerald-600">{formatMoney(totalUSD, 'USD')}</div>
          <div className="text-xs text-slate-500">≈ {formatMoney(usdEnPesos)}</div>
        </div>

        <div className="stat-card">
          <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center mb-3">
            <Receipt className="w-5 h-5 text-blue-600" />
          </div>
          <div className="text-xs text-slate-500 font-semibold uppercase">Impuestos</div>
          <div className="text-xl font-bold">{formatMoney(totalImpuestos)}</div>
        </div>

        <div className="stat-card">
          <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center mb-3">
            <Pin className="w-5 h-5 text-purple-600" />
          </div>
          <div className="text-xs text-slate-500 font-semibold uppercase">Fijos</div>
          <div className="text-xl font-bold text-purple-600">{formatMoney(totalFijos)}</div>
          {totalFijosUSD > 0 && <div className="text-xs text-slate-500">{formatMoney(totalFijosUSD, 'USD')}</div>}
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Donut Chart */}
        <div className="card p-6">
          <h3 className="font-bold mb-4">📊 Por Categoría</h3>
          <div className="h-64">
            {Object.keys(catTotals).length > 0 ? (
              <Doughnut 
                data={chartData} 
                options={{ 
                  responsive: true, 
                  maintainAspectRatio: false,
                  plugins: { legend: { position: 'right' } }
                }} 
              />
            ) : (
              <div className="flex items-center justify-center h-full text-slate-400">
                Sin datos este mes
              </div>
            )}
          </div>
        </div>

        {/* Top Gastos */}
        <div className="card p-6">
          <h3 className="font-bold mb-4">🔝 Mayores Gastos</h3>
          <div className="space-y-3">
            {topGastos.length > 0 ? topGastos.map((g, i) => {
              const monto = g.cuotas > 1 ? g.monto / g.cuotas : g.monto
              return (
                <div key={g.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                    i === 0 ? 'bg-gradient-to-br from-amber-400 to-amber-600' :
                    i === 1 ? 'bg-gradient-to-br from-slate-400 to-slate-600' :
                    i === 2 ? 'bg-gradient-to-br from-orange-400 to-orange-600' :
                    'bg-indigo-500'
                  }`}>
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate">{g.descripcion}</div>
                    <div className="text-xs text-slate-500">{categoriaMap[g.categoria_id || '']?.nombre || 'Sin categoría'}</div>
                  </div>
                  <div className="font-bold">{formatMoney(monto)}</div>
                </div>
              )
            }) : (
              <div className="text-center text-slate-400 py-8">Sin gastos este mes</div>
            )}
          </div>
        </div>
      </div>

      {/* Desglose por Tarjeta */}
      <div className="card overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200">
          <h3 className="font-bold">Desglose por Tarjeta</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50">
                <th className="text-left p-4 text-xs font-bold text-slate-500 uppercase">Tarjeta</th>
                <th className="text-left p-4 text-xs font-bold text-slate-500 uppercase">ARS</th>
                <th className="text-left p-4 text-xs font-bold text-slate-500 uppercase">USD</th>
                <th className="text-left p-4 text-xs font-bold text-slate-500 uppercase">Imp</th>
                <th className="text-left p-4 text-xs font-bold text-slate-500 uppercase">Total</th>
              </tr>
            </thead>
            <tbody>
              {/* Gastos en efectivo */}
              {(() => {
                const gEfectivo = gastosMes.filter(g => !g.tarjeta_id && !g.pagado)
                const iEfectivo = impuestosMes.filter(i => !i.tarjeta_id)
                let efectivoARS = 0, efectivoUSD = 0
                gEfectivo.forEach(g => {
                  const m = g.cuotas > 1 ? g.monto / g.cuotas : g.monto
                  if (g.moneda === 'USD') efectivoUSD += m
                  else efectivoARS += m
                })
                const efectivoImp = iEfectivo.reduce((s, i) => s + i.monto, 0)

                if (gEfectivo.length > 0 || iEfectivo.length > 0) {
                  return (
                    <tr
                      onClick={() => router.push(`/dashboard/gastos?tarjeta=efectivo&mes=${monthKey}`)}
                      className="border-b border-slate-100 hover:bg-emerald-50 cursor-pointer transition-colors"
                    >
                      <td className="p-4">
                        <span className="tag bg-emerald-100 text-emerald-700">💵 Efectivo</span>
                      </td>
                      <td className="p-4 font-semibold">{formatMoney(efectivoARS)}</td>
                      <td className="p-4 font-semibold text-emerald-600">{efectivoUSD > 0 ? formatMoney(efectivoUSD, 'USD') : '-'}</td>
                      <td className="p-4 font-semibold">{formatMoney(efectivoImp)}</td>
                      <td className="p-4 font-bold">{formatMoney(efectivoARS + efectivoImp)}</td>
                    </tr>
                  )
                }
              })()}

              {/* Tarjetas */}
              {tarjetas.length > 0 ? tarjetas.map(t => {
                const gT = gastosMes.filter(g => g.tarjeta_id === t.id && !g.pagado)
                const iT = impuestosMes.filter(i => i.tarjeta_id === t.id)
                let cARS = 0, cUSD = 0
                gT.forEach(g => {
                  const m = g.cuotas > 1 ? g.monto / g.cuotas : g.monto
                  if (g.moneda === 'USD') cUSD += m
                  else cARS += m
                })
                const cImp = iT.reduce((s, i) => s + i.monto, 0)
                return (
                  <tr
                    key={t.id}
                    className="border-b border-slate-100 hover:bg-indigo-50 cursor-pointer transition-colors"
                    onClick={() => router.push(`/dashboard/gastos?tarjeta=${t.id}`)}
                  >
                    <td className="p-4">
                      <span className={`tag ${getTagClass(t.tipo)}`}>{t.nombre}</span>
                    </td>
                    <td className="p-4 font-semibold">{formatMoney(cARS)}</td>
                    <td className="p-4 font-semibold text-emerald-600">{cUSD > 0 ? formatMoney(cUSD, 'USD') : '-'}</td>
                    <td className="p-4 font-semibold">{formatMoney(cImp)}</td>
                    <td className="p-4 font-bold">{formatMoney(cARS + cImp)}</td>
                  </tr>
                )
              }) : (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-400">No hay tarjetas configuradas</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: Gastos que terminan */}
      {showEndingModal && (
        <div className="modal-overlay" onClick={() => setShowEndingModal(false)}>
          <div className="modal max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-emerald-50">
              <h3 className="font-bold text-lg text-emerald-800">✅ Gastos que terminan este mes</h3>
              <button onClick={() => setShowEndingModal(false)} className="p-1 hover:bg-emerald-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 max-h-96 overflow-y-auto">
              <p className="text-sm text-slate-500 mb-4">
                Estos gastos no aparecerán en {getMonthName(nextMonth)}:
              </p>
              <div className="space-y-2">
                {gastosTerminan
                  .sort((a, b) => {
                    // Primero ordenar por moneda: USD primero
                    if (a.moneda === 'USD' && b.moneda !== 'USD') return -1
                    if (a.moneda !== 'USD' && b.moneda === 'USD') return 1
                    // Luego por monto de mayor a menor
                    const montoA = a.cuotas > 1 ? a.monto / a.cuotas : a.monto
                    const montoB = b.cuotas > 1 ? b.monto / b.cuotas : b.monto
                    return montoB - montoA
                  })
                  .map(g => {
                  const monto = g.cuotas > 1 ? g.monto / g.cuotas : g.monto
                  return (
                    <div key={g.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                      <div>
                        <div className="font-semibold">{g.descripcion}</div>
                        <div className="text-xs text-slate-500">
                          {tarjetaMap[g.tarjeta_id || '']?.nombre || 'Sin tarjeta'} • {categoriaMap[g.categoria_id || '']?.nombre || 'Sin categoría'}
                          {g.cuotas > 1 && ` • Última cuota`}
                        </div>
                      </div>
                      <div className={`font-bold ${g.moneda === 'USD' ? 'text-emerald-600' : ''}`}>
                        {formatMoney(monto, g.moneda)}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
            <div className="p-4 bg-emerald-50 border-t border-emerald-200">
              <div className="grid grid-cols-2 gap-4 text-center">
                <div>
                  <div className="text-xs text-emerald-600 font-semibold">Total ARS</div>
                  <div className="text-lg font-bold text-emerald-700">{formatMoney(terminanARS)}</div>
                </div>
                <div>
                  <div className="text-xs text-emerald-600 font-semibold">Total USD</div>
                  <div className="text-lg font-bold text-emerald-700">{formatMoney(terminanUSD, 'USD')}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Month Alert Modal */}
      <AlertModal
        isOpen={showMonthAlert}
        onClose={() => {
          setShowMonthAlert(false)
          // Optionally navigate to current month
          const today = new Date()
          const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
          if (monthKey !== todayKey) {
            // User can manually go to current month if they want
          }
        }}
        title="📅 Estás viendo un mes anterior"
        message={`Este es el último mes que estuviste revisando: ${getMonthName(currentMonth)}.\n\nRecordá que no es el mes actual. Podés cambiarlo con las flechas si querés ver otro mes.`}
        variant="info"
      />
    </div>
  )
}
