'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useData } from '@/hooks/useData'
import { useAuth } from '@/hooks/useAuth'
import { useWorkspace } from '@/hooks/useWorkspace'
import { formatMoney, getMonthName, fetchDolar, getTagClass, getMonthKey } from '@/lib/utils'
import { Download, TrendingUp, CreditCard, Receipt, Pin, DollarSign, Calendar, X, ChevronRight, ArrowUpCircle } from 'lucide-react'
import { Chart as ChartJS, ArcElement, Tooltip, Legend, BarElement, CategoryScale, LinearScale } from 'chart.js'
import { Doughnut, Bar } from 'react-chartjs-2'
import * as XLSX from 'xlsx'
import { Timestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { WorkspacePermissions } from '@/types'

ChartJS.register(ArcElement, Tooltip, Legend, BarElement, CategoryScale, LinearScale)

// Paleta de colores consistente para categorías
const CATEGORY_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e',
  '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#06b6d4', '#3b82f6', '#a855f7', '#64748b',
]

export default function DashboardPage() {
  const router = useRouter()
  const { profile, user } = useAuth()
  const { currentWorkspace, members, loading: workspaceLoading } = useWorkspace()
  const {
    tarjetas, categorias, categoriasIngresos,
    gastos, ingresos,
    loading, currentMonth, monthKey,
    getGastosMes, getImpuestosMes, getIngresosMes
  } = useData()
  const [dolar, setDolar] = useState(1050)
  const [showEndingModal, setShowEndingModal] = useState(false)
  const [currencyFilter, setCurrencyFilter] = useState<'ARS' | 'USD' | 'AMBOS'>('ARS')

  console.log('📄 [ResumenPage] Render - loading:', loading)

  // Create lookup maps for categorias and tarjetas
  const categoriaMap = Object.fromEntries(categorias.map(c => [c.id, c]))
  const categoriaIngresoMap = Object.fromEntries(categoriasIngresos.map(c => [c.id, c]))
  const tarjetaMap = Object.fromEntries(tarjetas.map(t => [t.id, t]))

  useEffect(() => {
    fetchDolar()
      .then(setDolar)
      .catch(err => console.error('Error al obtener cotización del dólar:', err))
  }, [])

  const hasAccess = (section: keyof WorkspacePermissions) => {
    // Espacio Personal: siempre "permiso", lo que manda es la config (ingresos_habilitado)
    if (!currentWorkspace) return true
    // Dueño del workspace: acceso total
    if (currentWorkspace.owner_id === user?.uid) return true
    // Mientras carga, evitar ocultar por flicker
    if (workspaceLoading) return true
    // Colaborador: buscar membership del usuario actual en ese workspace
    const member = members.find(m => m.workspace_id === currentWorkspace.id && m.user_id === user?.uid)
    return !!member && member.permissions?.[section] !== 'ninguno'
  }

  // Mostrar ingresos en resumen:
  // - En espacio personal: depende de ingresos_habilitado
  // - En workspace: depende de permisos de ingresos (o dueño)
  const showIngresos = currentWorkspace
    ? (currentWorkspace.ingresos_habilitado && hasAccess('ingresos'))
    : !!profile?.ingresos_habilitado

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

    const ingresosData = showIngresos ? ingresosMes.map(i => ({
      'Fecha': i.fecha,
      'Descripción': i.descripcion,
      'Categoría': categoriaIngresoMap[i.categoria_id || '']?.nombre || 'Sin categoría',
      'Monto': i.monto,
      'Moneda': i.moneda
    })) : []

    // Create workbook
    const wb = XLSX.utils.book_new()

    // Add Gastos sheet
    const wsGastos = XLSX.utils.json_to_sheet(gastosData)
    XLSX.utils.book_append_sheet(wb, wsGastos, 'Gastos')

    // Add Impuestos sheet
    const wsImpuestos = XLSX.utils.json_to_sheet(impuestosData)
    XLSX.utils.book_append_sheet(wb, wsImpuestos, 'Impuestos')

    if (showIngresos) {
      const wsIngresos = XLSX.utils.json_to_sheet(ingresosData)
      XLSX.utils.book_append_sheet(wb, wsIngresos, 'Ingresos')
    }

    // Add Summary sheet
    const summaryData = [
      { 'Concepto': 'Gastos ARS', 'Monto': totalARS },
      { 'Concepto': 'Gastos USD', 'Monto': totalUSD },
      { 'Concepto': 'Impuestos', 'Monto': totalImpuestos },
      { 'Concepto': 'Total a Pagar (ARS)', 'Monto': totalPagar },
      ...(showIngresos ? [
        { 'Concepto': 'Ingresos ARS', 'Monto': totalIngresosARS },
        { 'Concepto': 'Ingresos USD', 'Monto': totalIngresosUSD },
        { 'Concepto': 'Ingresos total (ARS aprox.)', 'Monto': ingresosTotalEnPesos },
        { 'Concepto': 'Balance (ARS aprox.)', 'Monto': balanceEnPesos },
      ] : []),
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
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    )
  }

  console.log('📄 [ResumenPage] Rendering content - loading is FALSE')

  const gastosMes = getGastosMes(monthKey)
  const impuestosMes = getImpuestosMes(monthKey)
  const ingresosMes = getIngresosMes(monthKey)

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

  // Budget check (solo si está habilitado) - usar workspace o perfil según corresponda
  const budgetARS = currentWorkspace ? (currentWorkspace.budget_ars || 0) : (profile?.budget_ars || 0)
  const budgetUSD = currentWorkspace ? (currentWorkspace.budget_usd || 0) : (profile?.budget_usd || 0)
  const hasBudget = budgetARS > 0 || budgetUSD > 0

  // Calcular presupuesto total y gastado total en ARS
  const budgetTotalARS = budgetARS + (budgetUSD * dolar)
  const gastadoTotalARS = totalPagar + (totalUSD * dolar)
  const budgetPct = hasBudget ? (gastadoTotalARS / budgetTotalARS) * 100 : 0
  const budgetStatus = budgetPct >= 100 ? 'danger' : budgetPct >= 80 ? 'warning' : 'ok'

  // Chart data por categoría - respetar selector de moneda
  const catTotalsARS: Record<string, number> = {}
  const catTotalsUSD: Record<string, number> = {}

  gastosMes.filter(g => !g.pagado).forEach(g => {
    const catName = categoriaMap[g.categoria_id || '']?.nombre || 'Otros'
    const monto = g.cuotas > 1 ? g.monto / g.cuotas : g.monto

    if (currencyFilter === 'ARS' && g.moneda === 'ARS') {
      catTotalsARS[catName] = (catTotalsARS[catName] || 0) + monto
    } else if (currencyFilter === 'USD' && g.moneda === 'USD') {
      catTotalsUSD[catName] = (catTotalsUSD[catName] || 0) + monto
    } else if (currencyFilter === 'AMBOS') {
      if (g.moneda === 'ARS') {
        catTotalsARS[catName] = (catTotalsARS[catName] || 0) + monto
      } else {
        catTotalsUSD[catName] = (catTotalsUSD[catName] || 0) + monto
      }
    }
  })

  // Ordenar categorías de mayor a menor para los gráficos de barras
  const sortedCatARS = Object.entries(catTotalsARS).sort((a, b) => b[1] - a[1])
  const sortedCatUSD = Object.entries(catTotalsUSD).sort((a, b) => b[1] - a[1])

  const barOptionsBase = {
    indexAxis: 'y' as const,
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: any) => {
            const currency = currencyFilter === 'USD' ? 'USD' : 'ARS'
            return ` ${formatMoney(ctx.raw, currency)}`
          }
        }
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          callback: (value: any) => {
            if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`
            if (value >= 1000) return `${(value / 1000).toFixed(0)}K`
            return value
          },
          font: { size: 11 },
          color: '#94a3b8',
        },
        border: { display: false },
      },
      y: {
        grid: { display: false },
        ticks: {
          font: { size: 12, weight: 'bold' as const },
          color: '#334155',
        },
        border: { display: false },
      }
    }
  }

  const chartBarDataARS = {
    labels: sortedCatARS.map(([name]) => name),
    datasets: [{
      data: sortedCatARS.map(([, val]) => val),
      backgroundColor: sortedCatARS.map((_, i) => CATEGORY_COLORS[i % CATEGORY_COLORS.length]),
      borderRadius: 6,
      barThickness: 24,
    }]
  }

  const chartBarDataUSD = {
    labels: sortedCatUSD.map(([name]) => name),
    datasets: [{
      data: sortedCatUSD.map(([, val]) => val),
      backgroundColor: sortedCatUSD.map((_, i) => CATEGORY_COLORS[i % CATEGORY_COLORS.length]),
      borderRadius: 6,
      barThickness: 24,
    }]
  }

  // Doughnut para vista general de distribución (más pequeño y limpio)
  const doughnutData = {
    labels: sortedCatARS.slice(0, 6).map(([name]) => name).concat(sortedCatARS.length > 6 ? ['Otros'] : []),
    datasets: [{
      data: sortedCatARS.slice(0, 6).map(([, val]) => val).concat(
        sortedCatARS.length > 6 ? [sortedCatARS.slice(6).reduce((s, [, v]) => s + v, 0)] : []
      ),
      backgroundColor: CATEGORY_COLORS.slice(0, Math.min(sortedCatARS.length, 7)),
      borderWidth: 0,
      hoverOffset: 4,
    }]
  }

  // ===================== INGRESOS (si aplica) =====================
  // Filtrar ingresos pendientes: solo sumar confirmados o ingresos normales (sin estado pendiente)
  const totalIngresosARS = showIngresos
    ? ingresosMes.filter(i => i.moneda === 'ARS' && (!(i as any).pendiente_cobro || (i as any).fecha_cobro_confirmada)).reduce((s, i) => s + i.monto, 0)
    : 0
  const totalIngresosUSD = showIngresos
    ? ingresosMes.filter(i => i.moneda === 'USD' && (!(i as any).pendiente_cobro || (i as any).fecha_cobro_confirmada)).reduce((s, i) => s + i.monto, 0)
    : 0
  const ingresosUsdEnPesos = totalIngresosUSD * dolar
  const ingresosTotalEnPesos = totalIngresosARS + ingresosUsdEnPesos
  const balanceEnPesos = ingresosTotalEnPesos - totalActual

  // Chart data ingresos por categoría - respetar selector de moneda - excluir pendientes
  const ingCatTotalsARS: Record<string, number> = {}
  const ingCatTotalsUSD: Record<string, number> = {}

  if (showIngresos) {
    ingresosMes.filter(i => (!(i as any).pendiente_cobro || (i as any).fecha_cobro_confirmada)).forEach(i => {
      const catName = categoriaIngresoMap[i.categoria_id || '']?.nombre || 'Otros'

      if (currencyFilter === 'ARS' && i.moneda === 'ARS') {
        ingCatTotalsARS[catName] = (ingCatTotalsARS[catName] || 0) + i.monto
      } else if (currencyFilter === 'USD' && i.moneda === 'USD') {
        ingCatTotalsUSD[catName] = (ingCatTotalsUSD[catName] || 0) + i.monto
      } else if (currencyFilter === 'AMBOS') {
        if (i.moneda === 'ARS') {
          ingCatTotalsARS[catName] = (ingCatTotalsARS[catName] || 0) + i.monto
        } else {
          ingCatTotalsUSD[catName] = (ingCatTotalsUSD[catName] || 0) + i.monto
        }
      }
    })
  }

  const sortedIngCatARS = Object.entries(ingCatTotalsARS).sort((a, b) => b[1] - a[1])
  const sortedIngCatUSD = Object.entries(ingCatTotalsUSD).sort((a, b) => b[1] - a[1])

  const ingresosBarDataARS = {
    labels: sortedIngCatARS.map(([name]) => name),
    datasets: [{
      data: sortedIngCatARS.map(([, val]) => val),
      backgroundColor: sortedIngCatARS.map((_, i) => ['#10b981', '#22c55e', '#14b8a6', '#059669', '#0d9488', '#6366f1', '#8b5cf6'][i % 7]),
      borderRadius: 6,
      barThickness: 24,
    }]
  }

  const ingresosBarDataUSD = {
    labels: sortedIngCatUSD.map(([name]) => name),
    datasets: [{
      data: sortedIngCatUSD.map(([, val]) => val),
      backgroundColor: sortedIngCatUSD.map((_, i) => ['#10b981', '#22c55e', '#14b8a6', '#059669', '#0d9488', '#6366f1', '#8b5cf6'][i % 7]),
      borderRadius: 6,
      barThickness: 24,
    }]
  }

  // Top 5 ingresos (ordenados por ARS aprox) - excluir pendientes
  const topIngresos = showIngresos
    ? [...ingresosMes]
      .filter(i => !(i as any).pendiente_cobro || (i as any).fecha_cobro_confirmada)
      .sort((a, b) => {
        const aArs = a.moneda === 'USD' ? a.monto * dolar : a.monto
        const bArs = b.moneda === 'USD' ? b.monto * dolar : b.monto
        return bArs - aArs
      })
      .slice(0, 5)
    : []

  // Top 5 gastos (sin contar pagados) - respetar selector de moneda
  const topGastos = [...gastosMes]
    .filter(g => {
      if (g.pagado) return false
      if (currencyFilter === 'ARS') return g.moneda === 'ARS'
      if (currencyFilter === 'USD') return g.moneda === 'USD'
      return true // AMBOS: incluir todos
    })
    .sort((a, b) => {
      const montoA = a.cuotas > 1 ? a.monto / a.cuotas : a.monto
      const montoB = b.cuotas > 1 ? b.monto / b.cuotas : b.monto
      return montoB - montoA
    })
    .slice(0, 5)

  // Helper para currency toggle
  const CurrencyToggle = ({ variant = 'primary' }: { variant?: 'primary' | 'success' }) => (
    <div className="currency-toggle">
      {(['ARS', 'USD', 'AMBOS'] as const).map(c => (
        <button
          key={c}
          onClick={() => setCurrencyFilter(c)}
          className={currencyFilter === c ? 'active' : ''}
        >
          {c === 'AMBOS' ? 'Ambos' : c}
        </button>
      ))}
    </div>
  )

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="page-title">Resumen</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            <span className="text-primary font-medium">{currentWorkspace?.name || (profile?.personal_workspace_name || 'Espacio Personal')}</span>
            {' · '}
            {getMonthName(currentMonth)}
          </p>
        </div>
        <button onClick={exportToExcel} className="btn btn-secondary btn-sm">
          <Download className="w-3.5 h-3.5" />
          Exportar Excel
        </button>
      </div>

      {/* Budget Progress - Solo si está habilitado */}
      {hasBudget && (
        <div className="card overflow-hidden">
          <div className="bg-gradient-to-r from-primary to-accent p-5 text-white">
            <div className="text-xs font-medium uppercase tracking-wider opacity-80 mb-3">Presupuesto del mes</div>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div>
                <div className="text-xs opacity-70">Gastado</div>
                <div className="text-stat-value">{formatMoney(totalPagar)}</div>
                {totalUSD > 0 && (
                  <div className="text-xs opacity-70">+{formatMoney(totalUSD, 'USD')}</div>
                )}
              </div>
              <div>
                <div className="text-xs opacity-70">Límite</div>
                {budgetARS > 0 && (
                  <div className="text-stat-value">{formatMoney(budgetARS)}</div>
                )}
                {budgetUSD > 0 && (
                  <div className={budgetARS > 0 ? "text-xs opacity-70" : "text-stat-value"}>
                    {budgetARS > 0 ? '+' : ''}{formatMoney(budgetUSD, 'USD')}
                  </div>
                )}
              </div>
              <div>
                <div className="text-xs opacity-70">{budgetTotalARS - gastadoTotalARS >= 0 ? 'Disponible' : 'Excedido'}</div>
                <div className="text-stat-value">{formatMoney(Math.abs(budgetTotalARS - gastadoTotalARS))}</div>
              </div>
            </div>
            <div className="bg-white/20 h-2.5 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  budgetStatus === 'danger' ? 'bg-red-400' :
                  budgetStatus === 'warning' ? 'bg-amber-400' : 'bg-emerald-400'
                }`}
                style={{ width: `${Math.min(budgetPct, 100)}%` }}
              />
            </div>
            <div className="text-xs mt-1.5 opacity-70">{budgetPct.toFixed(1)}% usado</div>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="stat-card">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 bg-red-50 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-red-500" />
            </div>
            <div className="text-stat-label text-slate-400 uppercase">Total a pagar</div>
          </div>
          <div className="text-stat-value text-red-600">{formatMoney(totalPagar)}</div>
        </div>

        <div className="stat-card">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 bg-primary-50 rounded-xl flex items-center justify-center">
              <CreditCard className="w-4 h-4 text-primary" />
            </div>
            <div className="text-stat-label text-slate-400 uppercase">Consumos ARS</div>
          </div>
          <div className="text-stat-value">{formatMoney(totalARS)}</div>
        </div>

        <div className="stat-card">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 bg-emerald-50 rounded-xl flex items-center justify-center">
              <DollarSign className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-stat-label text-slate-400 uppercase">Consumos USD</div>
          </div>
          <div className="text-stat-value text-emerald-600">{formatMoney(totalUSD, 'USD')}</div>
          {totalUSD > 0 && <div className="text-xs text-slate-400 mt-0.5">{formatMoney(usdEnPesos)}</div>}
        </div>

        <div className="stat-card">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center">
              <Receipt className="w-4 h-4 text-blue-500" />
            </div>
            <div className="text-stat-label text-slate-400 uppercase">Impuestos</div>
          </div>
          <div className="text-stat-value">{formatMoney(totalImpuestos)}</div>
        </div>

        <div className="stat-card">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 bg-accent-50 rounded-xl flex items-center justify-center">
              <Pin className="w-4 h-4 text-accent" />
            </div>
            <div className="text-stat-label text-slate-400 uppercase">Fijos</div>
          </div>
          <div className="text-stat-value text-accent">{formatMoney(totalFijos)}</div>
          {totalFijosUSD > 0 && <div className="text-xs text-slate-400 mt-0.5">{formatMoney(totalFijosUSD, 'USD')}</div>}
        </div>
      </div>

      {/* Ingresos - Resumen (solo si está habilitado / con permisos) */}
      {showIngresos && (
        <>
          <div className="flex items-center justify-between gap-3">
            <h2 className="section-title flex items-center gap-2">
              <ArrowUpCircle className="w-5 h-5 text-emerald-500" />
              Ingresos
            </h2>
            <div className="flex items-center gap-2">
              <CurrencyToggle variant="success" />
              <button
                onClick={() => router.push('/dashboard/ingresos')}
                className="btn btn-secondary btn-sm"
              >
                Ver todo
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="stat-card">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 bg-emerald-50 rounded-xl flex items-center justify-center">
                  <ArrowUpCircle className="w-4 h-4 text-emerald-500" />
                </div>
                <div className="text-stat-label text-slate-400 uppercase">Ingresos ARS</div>
              </div>
              <div className="text-stat-value text-emerald-600">{formatMoney(totalIngresosARS)}</div>
            </div>

            <div className="stat-card">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 bg-emerald-50 rounded-xl flex items-center justify-center">
                  <DollarSign className="w-4 h-4 text-emerald-500" />
                </div>
                <div className="text-stat-label text-slate-400 uppercase">Ingresos USD</div>
              </div>
              <div className="text-stat-value text-emerald-600">{formatMoney(totalIngresosUSD, 'USD')}</div>
              {totalIngresosUSD > 0 && <div className="text-xs text-slate-400 mt-0.5">{formatMoney(ingresosUsdEnPesos)}</div>}
            </div>

            <div className="stat-card">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 bg-slate-50 rounded-xl flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-slate-500" />
                </div>
                <div className="text-stat-label text-slate-400 uppercase">Total ingresos</div>
              </div>
              <div className="text-stat-value">{formatMoney(ingresosTotalEnPesos)}</div>
              <div className="text-xs text-slate-400 mt-0.5">ARS aprox.</div>
            </div>

            <div className="stat-card">
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${balanceEnPesos >= 0 ? 'bg-emerald-50' : 'bg-red-50'}`}>
                  <TrendingUp className={`w-4 h-4 ${balanceEnPesos >= 0 ? 'text-emerald-500' : 'text-red-500'}`} />
                </div>
                <div className="text-stat-label text-slate-400 uppercase">Balance</div>
              </div>
              <div className={`text-stat-value ${balanceEnPesos >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {balanceEnPesos >= 0 ? '+' : '-'}{formatMoney(Math.abs(balanceEnPesos))}
              </div>
              <div className="text-xs text-slate-400 mt-0.5">ARS aprox.</div>
            </div>
          </div>

          {/* Ingresos charts */}
          <div className="grid lg:grid-cols-2 gap-4">
            {currencyFilter === 'AMBOS' ? (
              <>
                <div className="card p-5">
                  <h3 className="card-title mb-4">Ingresos por categoría (ARS)</h3>
                  <div style={{ height: Math.max(160, sortedIngCatARS.length * 40) }}>
                    {sortedIngCatARS.length > 0 ? (
                      <Bar data={ingresosBarDataARS} options={barOptionsBase} />
                    ) : (
                      <div className="flex items-center justify-center h-full text-sm text-slate-400">
                        Sin ingresos ARS este mes
                      </div>
                    )}
                  </div>
                </div>
                <div className="card p-5">
                  <h3 className="card-title mb-4">Ingresos por categoría (USD)</h3>
                  <div style={{ height: Math.max(160, sortedIngCatUSD.length * 40) }}>
                    {sortedIngCatUSD.length > 0 ? (
                      <Bar data={ingresosBarDataUSD} options={barOptionsBase} />
                    ) : (
                      <div className="flex items-center justify-center h-full text-sm text-slate-400">
                        Sin ingresos USD este mes
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="card p-5">
                <h3 className="card-title mb-4">Ingresos por categoría ({currencyFilter})</h3>
                <div style={{ height: Math.max(160, (currencyFilter === 'ARS' ? sortedIngCatARS : sortedIngCatUSD).length * 40) }}>
                  {(currencyFilter === 'ARS' ? sortedIngCatARS.length : sortedIngCatUSD.length) > 0 ? (
                    <Bar
                      data={currencyFilter === 'ARS' ? ingresosBarDataARS : ingresosBarDataUSD}
                      options={barOptionsBase}
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-sm text-slate-400">
                      Sin ingresos {currencyFilter} este mes
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="card p-5">
              <h3 className="card-title mb-4">Mayores ingresos</h3>
              <div className="space-y-2">
                {topIngresos.length > 0 ? topIngresos.map((ing, i) => (
                  <div key={ing.id} className="flex items-center gap-3 p-2.5 bg-slate-50 rounded-xl">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold text-xs ${
                      i === 0 ? 'bg-emerald-500' :
                      i === 1 ? 'bg-emerald-400' :
                      i === 2 ? 'bg-teal-400' :
                      'bg-slate-400'
                    }`}>
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate text-slate-800">{ing.descripcion}</div>
                      <div className="text-xs text-slate-400">{categoriaIngresoMap[ing.categoria_id || '']?.nombre || 'Sin categoría'}</div>
                    </div>
                    <div className="font-semibold text-sm text-emerald-600">{formatMoney(ing.monto, ing.moneda)}</div>
                  </div>
                )) : (
                  <div className="text-center text-sm text-slate-400 py-8">Sin ingresos este mes</div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Gastos por categoría + Top gastos */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Bar Chart - mucho más claro que Doughnut */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="card-title">Gastos por categoría</h3>
            <CurrencyToggle />
          </div>
          {currencyFilter === 'AMBOS' ? (
            <div className="space-y-6">
              <div>
                <div className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Pesos (ARS)</div>
                <div style={{ height: Math.max(120, sortedCatARS.length * 36) }}>
                  {sortedCatARS.length > 0 ? (
                    <Bar data={chartBarDataARS} options={barOptionsBase} />
                  ) : (
                    <div className="flex items-center justify-center h-full text-sm text-slate-400">Sin gastos ARS</div>
                  )}
                </div>
              </div>
              <div>
                <div className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Dólares (USD)</div>
                <div style={{ height: Math.max(120, sortedCatUSD.length * 36) }}>
                  {sortedCatUSD.length > 0 ? (
                    <Bar data={chartBarDataUSD} options={barOptionsBase} />
                  ) : (
                    <div className="flex items-center justify-center h-full text-sm text-slate-400">Sin gastos USD</div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ height: Math.max(180, (currencyFilter === 'ARS' ? sortedCatARS : sortedCatUSD).length * 36) }}>
              {(currencyFilter === 'ARS' ? sortedCatARS.length : sortedCatUSD.length) > 0 ? (
                <Bar
                  data={currencyFilter === 'ARS' ? chartBarDataARS : chartBarDataUSD}
                  options={barOptionsBase}
                />
              ) : (
                <div className="flex items-center justify-center h-full text-sm text-slate-400">
                  Sin datos {currencyFilter} este mes
                </div>
              )}
            </div>
          )}
        </div>

        {/* Top Gastos */}
        <div className="card p-5">
          <h3 className="card-title mb-4">
            Mayores gastos
            <span className="text-xs font-normal text-slate-400 ml-1.5">
              ({currencyFilter === 'AMBOS' ? 'ARS y USD' : currencyFilter})
            </span>
          </h3>
          <div className="space-y-2">
            {topGastos.length > 0 ? topGastos.map((g, i) => {
              const monto = g.cuotas > 1 ? g.monto / g.cuotas : g.monto
              return (
                <div key={g.id} className="flex items-center gap-3 p-2.5 bg-slate-50 rounded-xl">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold text-xs ${
                    i === 0 ? 'bg-primary' :
                    i === 1 ? 'bg-primary-400' :
                    i === 2 ? 'bg-accent' :
                    'bg-slate-400'
                  }`}>
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate text-slate-800">{g.descripcion}</div>
                    <div className="text-xs text-slate-400">{categoriaMap[g.categoria_id || '']?.nombre || 'Sin categoría'}</div>
                  </div>
                  <div className="font-semibold text-sm">{formatMoney(monto, g.moneda)}</div>
                </div>
              )
            }) : (
              <div className="text-center text-sm text-slate-400 py-8">Sin gastos este mes</div>
            )}
          </div>

          {/* Mini doughnut de distribución si hay datos ARS */}
          {sortedCatARS.length > 0 && currencyFilter !== 'USD' && (
            <div className="mt-5 pt-4 border-t border-slate-100">
              <div className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">Distribución general</div>
              <div className="h-40">
                <Doughnut
                  data={doughnutData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '65%',
                    plugins: {
                      legend: {
                        position: 'right',
                        labels: { boxWidth: 8, padding: 8, font: { size: 11 }, color: '#64748b' }
                      }
                    }
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Proyección próximo mes */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-4 h-4 text-primary" />
          <h3 className="card-title">Proyección {getMonthName(nextMonth)}</h3>
        </div>

        <div className="grid md:grid-cols-3 gap-3 mb-4">
          {/* Gastos que terminan */}
          <div
            className={`rounded-xl p-4 border transition-colors ${gastosTerminan.length > 0 ? 'bg-emerald-50/50 border-emerald-100 cursor-pointer hover:bg-emerald-50' : 'bg-slate-50 border-slate-100'}`}
            onClick={() => gastosTerminan.length > 0 && setShowEndingModal(true)}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-stat-label text-emerald-600 uppercase">Terminan este mes</span>
              {gastosTerminan.length > 0 && <ChevronRight className="w-3.5 h-3.5 text-emerald-400" />}
            </div>
            <div className="text-2xl font-bold text-emerald-700">{gastosTerminan.length}</div>
            <div className="text-xs text-emerald-500 mt-1">
              {formatMoney(terminanARS)} + {formatMoney(terminanUSD, 'USD')}
            </div>
          </div>

          {/* Gastos fijos que siguen */}
          <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4">
            <div className="text-stat-label text-blue-600 uppercase mb-2">Fijos continúan</div>
            <div className="text-lg font-bold text-blue-700">{formatMoney(fijosSiguenARS)}</div>
            <div className="text-xs text-blue-500 mt-0.5">{formatMoney(fijosSiguenUSD, 'USD')}</div>
          </div>

          {/* Diferencia */}
          <div className={`rounded-xl p-4 border ${diferenciaARS > 0 ? 'bg-emerald-50/50 border-emerald-100' : 'bg-red-50/50 border-red-100'}`}>
            <div className="text-stat-label text-slate-500 uppercase mb-1">
              Diferencia
            </div>
            <div className="text-xs text-slate-400 mb-1">
              Cuánto {diferenciaARS > 0 ? 'menos' : 'más'} vas a gastar
            </div>
            <div className={`text-lg font-bold ${diferenciaARS > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {diferenciaARS > 0 ? '-' : '+'}{formatMoney(Math.abs(diferenciaARS))}
            </div>
            <div className={`text-xs mt-0.5 ${diferenciaUSD >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
              {diferenciaUSD >= 0 ? '-' : '+'}{formatMoney(Math.abs(diferenciaUSD), 'USD')}
            </div>
          </div>
        </div>

        {/* Comparación detallada */}
        <div className="bg-slate-50 rounded-xl p-4">
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <div className="text-stat-label text-slate-400 uppercase mb-1">Este mes ({getMonthName(currentMonth).split(' ')[0]})</div>
              <div className="text-xl font-bold text-slate-800">{formatMoney(totalARS + totalImpuestos)}</div>
              {totalUSD > 0 && <div className="text-xs text-slate-400">+ {formatMoney(totalUSD, 'USD')}</div>}
            </div>
            <div>
              <div className="text-stat-label text-slate-400 uppercase mb-1">Próximo ({getMonthName(nextMonth).split(' ')[0]})</div>
              <div className="text-xl font-bold text-slate-800">{formatMoney(proximoARS + proximoImpuestos)}</div>
              {proximoUSD > 0 && <div className="text-xs text-slate-400">+ {formatMoney(proximoUSD, 'USD')}</div>}
            </div>
          </div>
          <div className="text-center text-sm mt-3 pt-3 border-t border-slate-200">
            {diferenciaTotal > 0
              ? <span className="text-emerald-600 font-medium">Vas a gastar {formatMoney(diferenciaTotal)} menos</span>
              : diferenciaTotal < 0
                ? <span className="text-red-600 font-medium">Vas a gastar {formatMoney(Math.abs(diferenciaTotal))} más</span>
                : <span className="text-slate-500">Mismo gasto proyectado</span>
            }
          </div>
        </div>
      </div>

      {/* Desglose por Tarjeta */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100">
          <h3 className="card-title">Desglose por tarjeta</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[500px]">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="text-left px-5 py-3 text-stat-label text-slate-400 uppercase">Tarjeta</th>
                <th className="text-left px-5 py-3 text-stat-label text-slate-400 uppercase">ARS</th>
                <th className="text-left px-5 py-3 text-stat-label text-slate-400 uppercase">USD</th>
                <th className="text-left px-5 py-3 text-stat-label text-slate-400 uppercase">Imp.</th>
                <th className="text-left px-5 py-3 text-stat-label text-slate-400 uppercase">Total</th>
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
                      className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors cursor-pointer"
                      onClick={() => router.push(`/dashboard/gastos?tarjeta=efectivo&mes=${monthKey}`)}
                      role="link"
                      tabIndex={0}
                      onKeyDown={e => { if (e.key === 'Enter') router.push(`/dashboard/gastos?tarjeta=efectivo&mes=${monthKey}`) }}
                    >
                      <td className="px-5 py-3">
                        <span className="tag bg-emerald-50 text-emerald-700">Efectivo</span>
                      </td>
                      <td className="px-5 py-3 font-medium text-sm whitespace-nowrap">{formatMoney(efectivoARS)}</td>
                      <td className="px-5 py-3 font-medium text-sm text-emerald-600 whitespace-nowrap">
                        {efectivoUSD > 0 ? formatMoney(efectivoUSD, 'USD') : '-'}
                      </td>
                      <td className="px-5 py-3 font-medium text-sm whitespace-nowrap">{formatMoney(efectivoImp)}</td>
                      <td className="px-5 py-3 font-semibold text-sm whitespace-nowrap">{formatMoney(efectivoARS + efectivoImp)}</td>
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
                    className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors cursor-pointer"
                    onClick={() => router.push(`/dashboard/gastos?tarjeta=${t.id}`)}
                    role="link"
                    tabIndex={0}
                    onKeyDown={e => { if (e.key === 'Enter') router.push(`/dashboard/gastos?tarjeta=${t.id}`) }}
                  >
                    <td className="px-5 py-3">
                      <span className={`tag ${getTagClass(t.tipo)}`}>{t.nombre}</span>
                    </td>
                    <td className="px-5 py-3 font-medium text-sm whitespace-nowrap">{formatMoney(cARS)}</td>
                    <td className="px-5 py-3 font-medium text-sm text-emerald-600 whitespace-nowrap">
                      {cUSD > 0 ? formatMoney(cUSD, 'USD') : '-'}
                    </td>
                    <td className="px-5 py-3 font-medium text-sm whitespace-nowrap">{formatMoney(cImp)}</td>
                    <td className="px-5 py-3 font-semibold text-sm whitespace-nowrap">{formatMoney(cARS + cImp)}</td>
                  </tr>
                )
              }) : (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-sm text-slate-400">No hay tarjetas configuradas</td>
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
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="section-title text-emerald-700">Gastos que terminan este mes</h3>
              <button onClick={() => setShowEndingModal(false)} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>
            <div className="p-5 max-h-96 overflow-y-auto">
              <p className="text-sm text-slate-500 mb-4">
                Estos gastos no aparecerán en {getMonthName(nextMonth)}:
              </p>
              <div className="space-y-2">
                {gastosTerminan
                  .sort((a, b) => {
                    if (a.moneda === 'USD' && b.moneda !== 'USD') return -1
                    if (a.moneda !== 'USD' && b.moneda === 'USD') return 1
                    const montoA = a.cuotas > 1 ? a.monto / a.cuotas : a.monto
                    const montoB = b.cuotas > 1 ? b.monto / b.cuotas : b.monto
                    return montoB - montoA
                  })
                  .map(g => {
                  const monto = g.cuotas > 1 ? g.monto / g.cuotas : g.monto
                  return (
                    <div key={g.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
                      <div>
                        <div className="font-medium text-sm text-slate-800">{g.descripcion}</div>
                        <div className="text-xs text-slate-400 mt-0.5">
                          {tarjetaMap[g.tarjeta_id || '']?.nombre || 'Sin tarjeta'} · {categoriaMap[g.categoria_id || '']?.nombre || 'Sin categoría'}
                          {g.cuotas > 1 && ` · Última cuota`}
                        </div>
                      </div>
                      <div className={`font-semibold text-sm ${g.moneda === 'USD' ? 'text-emerald-600' : 'text-slate-800'}`}>
                        {formatMoney(monto, g.moneda)}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
            <div className="px-5 py-4 bg-emerald-50/50 border-t border-emerald-100 rounded-b-2xl">
              <div className="grid grid-cols-2 gap-4 text-center">
                <div>
                  <div className="text-stat-label text-emerald-500 uppercase mb-0.5">Total ARS</div>
                  <div className="text-lg font-bold text-emerald-700">{formatMoney(terminanARS)}</div>
                </div>
                <div>
                  <div className="text-stat-label text-emerald-500 uppercase mb-0.5">Total USD</div>
                  <div className="text-lg font-bold text-emerald-700">{formatMoney(terminanUSD, 'USD')}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
