// ============================================
// COMMAND BAR - INTENT EXECUTOR
// ============================================
// Maps parsed intents to actual app operations.
// Uses useData hook methods + direct Firestore for shopping lists/reminders.

import type { ParsedCommand, CommandResult, UndoAction } from './types'
import { formatMoney } from '@/lib/utils'

// --- Types for the data context the executor needs ---

export interface ExecutorContext {
  // useData methods
  addGasto: (data: any) => Promise<{ error: any; data?: any }>
  deleteGasto: (id: string) => Promise<{ error: any }>
  addIngreso: (data: any) => Promise<{ error: any; data?: any }>
  deleteIngreso: (id: string) => Promise<{ error: any }>
  addMovimiento: (tipo: 'pesos' | 'usd', monto: number, descripcion?: string) => Promise<{ error: any }>
  addMeta: (data: any) => Promise<{ error: any }>
  updateMeta: (id: string, data: any) => Promise<{ error: any }>

  // Data for queries
  gastos: any[]
  ingresos: any[]
  movimientos: any[]
  metas: any[]
  categorias: any[]
  monthKey: string
  getGastosMes: (mes: string) => any[]
  getIngresosMes: (mes: string) => any[]

  // Shopping lists (direct Firestore operations)
  addShoppingList: (name: string, icon: string) => Promise<{ id: string } | null>
  addShoppingItems: (listId: string, items: any[]) => Promise<boolean>
  findShoppingList: (name: string) => { id: string; nombre: string } | null
  clearCompletedItems: (listId: string) => Promise<boolean>
  getShoppingListStats: (listId: string) => Promise<{ total: number; completed: number; estimated: number }>

  // Reminders
  addReminder: (data: any) => Promise<{ id: string } | null>
  getRemindersForDate: (date: string) => any[]
  getActiveReminders: () => any[]

  // Navigation
  navigate: (path: string) => void

  // Dollar rate for currency conversion
  dolarRate: number
}

// --- Main Executor ---

export async function executeCommand(
  command: ParsedCommand,
  ctx: ExecutorContext
): Promise<CommandResult> {
  // Don't execute if confidence too low or needs clarification
  if (command.confidence < 0.75 || command.needs_clarification.length > 0) {
    return {
      success: false,
      message: 'Necesito más información para ejecutar este comando.',
    }
  }

  try {
    switch (command.intent) {
      // =====================================
      // GASTOS
      // =====================================
      case 'create_expense':
        return await executeCreateExpense(command, ctx)

      // =====================================
      // INGRESOS
      // =====================================
      case 'create_income':
        return await executeCreateIncome(command, ctx)

      // =====================================
      // AHORROS
      // =====================================
      case 'add_saving':
        return await executeAddSaving(command, ctx)

      // =====================================
      // METAS
      // =====================================
      case 'create_goal':
        return await executeCreateGoal(command, ctx)
      case 'contribute_goal':
        return await executeContributeGoal(command, ctx)
      case 'goal_status':
        return executeGoalStatus(command, ctx)

      // =====================================
      // RECORDATORIOS
      // =====================================
      case 'create_reminder':
        return await executeCreateReminder(command, ctx)
      case 'list_reminders':
        return executeListReminders(command, ctx)

      // =====================================
      // LISTAS DE COMPRAS
      // =====================================
      case 'create_shopping_list':
        return await executeCreateShoppingList(command, ctx)
      case 'add_shopping_items':
        return await executeAddShoppingItems(command, ctx)
      case 'clear_completed_items':
        return await executeClearCompleted(command, ctx)

      // =====================================
      // CONSULTAS
      // =====================================
      case 'query_expense_total':
        return executeQueryExpenseTotal(command, ctx)
      case 'query_income_total':
        return executeQueryIncomeTotal(command, ctx)
      case 'query_balance':
        return executeQueryBalance(command, ctx)
      case 'query_top_expenses':
        return executeQueryTopExpenses(command, ctx)
      case 'query_savings_total':
        return executeQuerySavingsTotal(command, ctx)
      case 'query_reminders_count':
        return executeQueryRemindersCount(command, ctx)

      // =====================================
      // NAVIGATION
      // =====================================
      case 'navigate':
        return executeNavigation(command, ctx)

      default:
        return {
          success: false,
          message: 'No sé cómo ejecutar ese comando todavía.',
        }
    }
  } catch (error: any) {
    console.error('[CommandBar] Execution error:', error)
    return {
      success: false,
      message: `Error al ejecutar: ${error.message || 'Error desconocido'}`,
    }
  }
}

// --- Individual Intent Executors ---

async function executeCreateExpense(command: ParsedCommand, ctx: ExecutorContext): Promise<CommandResult> {
  const { amount, currency = 'ARS', date, merchant, payment_method } = command.params

  const monthKey = date ? date.substring(0, 7) : ctx.monthKey

  const gastoData: any = {
    descripcion: merchant || 'Gasto sin descripción',
    monto: amount,
    moneda: currency,
    fecha: date || new Date().toISOString().split('T')[0],
    mes_facturacion: monthKey,
    cuotas: 1,
    cuota_actual: 1,
    es_fijo: false,
    tag_ids: [],
    pagado: false,
    tarjeta_id: null,
    categoria_id: null,
  }

  if (payment_method) gastoData.medio_pago = payment_method

  // Try to match category
  if (merchant) {
    const matchedCat = ctx.categorias.find(c =>
      c.nombre.toLowerCase() === merchant.toLowerCase()
    )
    if (matchedCat) gastoData.categoria_id = matchedCat.id
  }

  const result = await ctx.addGasto(gastoData)
  if (result.error) {
    return { success: false, message: 'No se pudo crear el gasto. Intentá de nuevo.' }
  }

  const gastoId = result.data?.id
  const undo: UndoAction | undefined = gastoId
    ? {
        label: 'Deshacer gasto',
        execute: async () => { await ctx.deleteGasto(gastoId) },
      }
    : undefined

  return {
    success: true,
    message: `Gasto de ${formatMoney(amount, currency)} ${merchant ? `en ${merchant}` : ''} registrado`,
    undo_action: undo,
  }
}

async function executeCreateIncome(command: ParsedCommand, ctx: ExecutorContext): Promise<CommandResult> {
  const { amount, currency = 'ARS', date, description } = command.params

  const monthKey = date ? date.substring(0, 7) : ctx.monthKey

  const ingresoData: any = {
    descripcion: description || 'Ingreso sin descripción',
    monto: amount,
    moneda: currency,
    fecha: date || new Date().toISOString().split('T')[0],
    mes: monthKey,
    tag_ids: [],
    categoria_id: null,
    pendiente_cobro: false,
  }

  const result = await ctx.addIngreso(ingresoData)
  if (result.error) {
    return { success: false, message: 'No se pudo registrar el ingreso. Intentá de nuevo.' }
  }

  const ingresoId = result.data?.id
  const undo: UndoAction | undefined = ingresoId
    ? {
        label: 'Deshacer ingreso',
        execute: async () => { await ctx.deleteIngreso(ingresoId) },
      }
    : undefined

  return {
    success: true,
    message: `Ingreso de ${formatMoney(amount, currency)} ${description ? `(${description})` : ''} registrado`,
    undo_action: undo,
  }
}

async function executeAddSaving(command: ParsedCommand, ctx: ExecutorContext): Promise<CommandResult> {
  const { amount, tipo = 'pesos', description } = command.params

  const result = await ctx.addMovimiento(tipo, amount, description)
  if (result.error) {
    return { success: false, message: 'No se pudo registrar el ahorro. Intentá de nuevo.' }
  }

  const currencyLabel = tipo === 'usd' ? 'USD' : 'ARS'
  return {
    success: true,
    message: `Ahorro de ${formatMoney(amount, currencyLabel as any)} registrado`,
  }
}

async function executeCreateGoal(command: ParsedCommand, ctx: ExecutorContext): Promise<CommandResult> {
  const { nombre, objetivo, currency = 'ARS' } = command.params

  const result = await ctx.addMeta({
    nombre,
    objetivo,
    progreso: 0,
    moneda: currency,
    icono: '🎯',
  })

  if (result.error) {
    return { success: false, message: 'No se pudo crear la meta. Intentá de nuevo.' }
  }

  return {
    success: true,
    message: `Meta "${nombre}" creada con objetivo de ${formatMoney(objetivo, currency)}`,
    navigate_to: '/dashboard/ahorros',
  }
}

async function executeContributeGoal(command: ParsedCommand, ctx: ExecutorContext): Promise<CommandResult> {
  const { amount, goal_name } = command.params

  // Find the goal by name (fuzzy)
  const goal = ctx.metas.find(m =>
    m.nombre.toLowerCase().includes(goal_name.toLowerCase())
  )

  if (!goal) {
    return {
      success: false,
      message: `No encontré una meta con el nombre "${goal_name}"`,
    }
  }

  const newProgress = goal.progreso + amount
  const result = await ctx.updateMeta(goal.id, { progreso: newProgress })

  if (result.error) {
    return { success: false, message: 'No se pudo actualizar la meta.' }
  }

  const remaining = Math.max(0, goal.objetivo - newProgress)
  return {
    success: true,
    message: `Sumaste ${formatMoney(amount, goal.moneda)} a "${goal.nombre}". ${remaining > 0 ? `Faltan ${formatMoney(remaining, goal.moneda)}` : '¡Meta completada!'}`,
  }
}

function executeGoalStatus(command: ParsedCommand, ctx: ExecutorContext): CommandResult {
  const { goal_name } = command.params

  if (goal_name) {
    const goal = ctx.metas.find(m =>
      m.nombre.toLowerCase().includes(goal_name.toLowerCase())
    )
    if (!goal) {
      return { success: false, message: `No encontré una meta con el nombre "${goal_name}"` }
    }

    const pct = goal.objetivo > 0 ? Math.round((goal.progreso / goal.objetivo) * 100) : 0
    const remaining = Math.max(0, goal.objetivo - goal.progreso)
    return {
      success: true,
      message: `${goal.icono} ${goal.nombre}: ${formatMoney(goal.progreso, goal.moneda)} / ${formatMoney(goal.objetivo, goal.moneda)} (${pct}%)${remaining > 0 ? ` — Faltan ${formatMoney(remaining, goal.moneda)}` : ' — ¡Completada!'}`,
      navigate_to: '/dashboard/ahorros',
    }
  }

  // Show all goals
  if (ctx.metas.length === 0) {
    return { success: true, message: 'No tenés metas creadas todavía.' }
  }

  const lines = ctx.metas.map(m => {
    const pct = m.objetivo > 0 ? Math.round((m.progreso / m.objetivo) * 100) : 0
    return `${m.icono} ${m.nombre}: ${pct}% (${formatMoney(m.progreso, m.moneda)} / ${formatMoney(m.objetivo, m.moneda)})`
  })

  return {
    success: true,
    message: lines.join('\n'),
    navigate_to: '/dashboard/ahorros',
  }
}

async function executeCreateReminder(command: ParsedCommand, ctx: ExecutorContext): Promise<CommandResult> {
  const { title, date, time, recurrence } = command.params

  const reminderData: any = {
    titulo: title,
    descripcion: '',
    fecha: date,
    dias_antes: [0],
    canales: ['push'],
    status: 'activo',
  }

  const result = await ctx.addReminder(reminderData)
  if (!result) {
    return { success: false, message: 'No se pudo crear el recordatorio. Intentá de nuevo.' }
  }

  let msg = `Recordatorio "${title}" creado`
  if (date) {
    const d = new Date(date + 'T12:00:00')
    msg += ` para el ${d.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' })}`
  }
  if (time) msg += ` a las ${time}`

  return {
    success: true,
    message: msg,
    navigate_to: '/dashboard/recordatorios',
  }
}

function executeListReminders(_command: ParsedCommand, ctx: ExecutorContext): CommandResult {
  const reminders = ctx.getActiveReminders()

  if (reminders.length === 0) {
    return { success: true, message: 'No tenés recordatorios activos.' }
  }

  const lines = reminders.slice(0, 5).map((r: any) => {
    const d = new Date(r.fecha + 'T12:00:00')
    return `${r.titulo} — ${d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}`
  })

  const suffix = reminders.length > 5 ? `\n...y ${reminders.length - 5} más` : ''
  return {
    success: true,
    message: lines.join('\n') + suffix,
    navigate_to: '/dashboard/recordatorios',
  }
}

async function executeCreateShoppingList(command: ParsedCommand, ctx: ExecutorContext): Promise<CommandResult> {
  const { list_name } = command.params

  const result = await ctx.addShoppingList(list_name, '🛒')
  if (!result) {
    return { success: false, message: 'No se pudo crear la lista. Intentá de nuevo.' }
  }

  return {
    success: true,
    message: `Lista de compras "${list_name}" creada`,
    navigate_to: '/dashboard/listas',
  }
}

async function executeAddShoppingItems(command: ParsedCommand, ctx: ExecutorContext): Promise<CommandResult> {
  const { list_name, items } = command.params

  // Find the list
  const list = ctx.findShoppingList(list_name)
  if (!list) {
    // Auto-create list
    const newList = await ctx.addShoppingList(list_name, '🛒')
    if (!newList) {
      return { success: false, message: `No se pudo crear la lista "${list_name}"` }
    }

    const success = await ctx.addShoppingItems(newList.id, items)
    if (!success) {
      return { success: false, message: 'No se pudieron agregar los items.' }
    }

    const itemNames = items.map((i: any) => i.name).join(', ')
    return {
      success: true,
      message: `Lista "${list_name}" creada con ${items.length} item${items.length > 1 ? 's' : ''}: ${itemNames}`,
      navigate_to: '/dashboard/listas',
    }
  }

  const success = await ctx.addShoppingItems(list.id, items)
  if (!success) {
    return { success: false, message: 'No se pudieron agregar los items.' }
  }

  const itemNames = items.map((i: any) => i.name).join(', ')
  return {
    success: true,
    message: `${items.length} item${items.length > 1 ? 's' : ''} agregado${items.length > 1 ? 's' : ''} a "${list.nombre}": ${itemNames}`,
    navigate_to: '/dashboard/listas',
  }
}

async function executeClearCompleted(command: ParsedCommand, ctx: ExecutorContext): Promise<CommandResult> {
  const { list_name } = command.params

  const list = ctx.findShoppingList(list_name)
  if (!list) {
    return { success: false, message: `No encontré la lista "${list_name}"` }
  }

  const success = await ctx.clearCompletedItems(list.id)
  if (!success) {
    return { success: false, message: 'No se pudieron limpiar los items completados.' }
  }

  return {
    success: true,
    message: `Items completados eliminados de "${list.nombre}"`,
  }
}

// =====================================
// QUERY EXECUTORS
// =====================================

function executeQueryExpenseTotal(command: ParsedCommand, ctx: ExecutorContext): CommandResult {
  const { period, currency, category } = command.params

  const monthKey = getMonthKeyForPeriod(period, ctx.monthKey)
  let expenses = ctx.getGastosMes(monthKey)

  if (category) {
    const cat = ctx.categorias.find((c: any) => c.nombre.toLowerCase() === category.toLowerCase())
    if (cat) {
      expenses = expenses.filter((g: any) => g.categoria_id === cat.id)
    }
  }

  const totalARS = expenses
    .filter((g: any) => g.moneda === 'ARS')
    .reduce((sum: number, g: any) => sum + g.monto, 0)

  const totalUSD = expenses
    .filter((g: any) => g.moneda === 'USD')
    .reduce((sum: number, g: any) => sum + g.monto, 0)

  const periodLabel = getPeriodLabel(period)
  let message = `Gastos ${category ? `en ${category} ` : ''}${periodLabel}:`

  if (totalARS > 0) message += `\n${formatMoney(totalARS, 'ARS')}`
  if (totalUSD > 0) message += `\n${formatMoney(totalUSD, 'USD')}`
  if (totalARS === 0 && totalUSD === 0) message += '\nSin gastos registrados'

  return {
    success: true,
    message,
    data: { totalARS, totalUSD, count: expenses.length },
    navigate_to: '/dashboard/gastos',
  }
}

function executeQueryIncomeTotal(command: ParsedCommand, ctx: ExecutorContext): CommandResult {
  const { period } = command.params
  const monthKey = getMonthKeyForPeriod(period, ctx.monthKey)
  const incomes = ctx.getIngresosMes(monthKey)

  const totalARS = incomes
    .filter((i: any) => i.moneda === 'ARS')
    .reduce((sum: number, i: any) => sum + i.monto, 0)

  const totalUSD = incomes
    .filter((i: any) => i.moneda === 'USD')
    .reduce((sum: number, i: any) => sum + i.monto, 0)

  const periodLabel = getPeriodLabel(period)
  let message = `Ingresos ${periodLabel}:`
  if (totalARS > 0) message += `\n${formatMoney(totalARS, 'ARS')}`
  if (totalUSD > 0) message += `\n${formatMoney(totalUSD, 'USD')}`
  if (totalARS === 0 && totalUSD === 0) message += '\nSin ingresos registrados'

  return {
    success: true,
    message,
    data: { totalARS, totalUSD, count: incomes.length },
    navigate_to: '/dashboard/ingresos',
  }
}

function executeQueryBalance(command: ParsedCommand, ctx: ExecutorContext): CommandResult {
  const { period } = command.params
  const monthKey = getMonthKeyForPeriod(period, ctx.monthKey)
  const expenses = ctx.getGastosMes(monthKey)
  const incomes = ctx.getIngresosMes(monthKey)

  const expARS = expenses.filter((g: any) => g.moneda === 'ARS').reduce((s: number, g: any) => s + g.monto, 0)
  const expUSD = expenses.filter((g: any) => g.moneda === 'USD').reduce((s: number, g: any) => s + g.monto, 0)
  const incARS = incomes.filter((i: any) => i.moneda === 'ARS').reduce((s: number, i: any) => s + i.monto, 0)
  const incUSD = incomes.filter((i: any) => i.moneda === 'USD').reduce((s: number, i: any) => s + i.monto, 0)

  const balARS = incARS - expARS
  const balUSD = incUSD - expUSD

  const periodLabel = getPeriodLabel(period)
  let message = `Balance ${periodLabel}:`
  message += `\nIngresos: ${formatMoney(incARS, 'ARS')}${incUSD > 0 ? ` + ${formatMoney(incUSD, 'USD')}` : ''}`
  message += `\nGastos: ${formatMoney(expARS, 'ARS')}${expUSD > 0 ? ` + ${formatMoney(expUSD, 'USD')}` : ''}`
  message += `\nSaldo: ${formatMoney(balARS, 'ARS')}${balUSD !== 0 ? ` / ${formatMoney(balUSD, 'USD')}` : ''}`

  return {
    success: true,
    message,
    data: { balARS, balUSD, incARS, incUSD, expARS, expUSD },
    navigate_to: '/dashboard',
  }
}

function executeQueryTopExpenses(command: ParsedCommand, ctx: ExecutorContext): CommandResult {
  const { period, limit = 5 } = command.params
  const monthKey = getMonthKeyForPeriod(period, ctx.monthKey)
  const expenses = ctx.getGastosMes(monthKey)

  const sorted = [...expenses].sort((a: any, b: any) => b.monto - a.monto).slice(0, limit)

  const periodLabel = getPeriodLabel(period)
  if (sorted.length === 0) {
    return { success: true, message: `Sin gastos ${periodLabel}` }
  }

  const lines = sorted.map((g: any, i: number) =>
    `${i + 1}. ${g.descripcion} — ${formatMoney(g.monto, g.moneda)}`
  )

  return {
    success: true,
    message: `Top ${sorted.length} gastos ${periodLabel}:\n${lines.join('\n')}`,
    navigate_to: '/dashboard/gastos',
  }
}

function executeQuerySavingsTotal(_command: ParsedCommand, ctx: ExecutorContext): CommandResult {
  const totalPesos = ctx.movimientos
    .filter((m: any) => m.tipo === 'pesos')
    .reduce((s: number, m: any) => s + m.monto, 0)

  const totalUSD = ctx.movimientos
    .filter((m: any) => m.tipo === 'usd')
    .reduce((s: number, m: any) => s + m.monto, 0)

  let message = 'Total de ahorros:'
  message += `\n${formatMoney(totalPesos, 'ARS')}`
  if (totalUSD > 0) message += `\n${formatMoney(totalUSD, 'USD')}`

  return {
    success: true,
    message,
    data: { totalPesos, totalUSD },
    navigate_to: '/dashboard/ahorros',
  }
}

function executeQueryRemindersCount(command: ParsedCommand, ctx: ExecutorContext): CommandResult {
  const reminders = ctx.getActiveReminders()
  const { date } = command.params

  if (date) {
    const filtered = reminders.filter((r: any) => r.fecha === date)
    const d = new Date(date + 'T12:00:00')
    const dateLabel = d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })
    return {
      success: true,
      message: `Tenés ${filtered.length} recordatorio${filtered.length !== 1 ? 's' : ''} para ${dateLabel}`,
      navigate_to: '/dashboard/recordatorios',
    }
  }

  return {
    success: true,
    message: `Tenés ${reminders.length} recordatorio${reminders.length !== 1 ? 's' : ''} activo${reminders.length !== 1 ? 's' : ''}`,
    navigate_to: '/dashboard/recordatorios',
  }
}

function executeNavigation(command: ParsedCommand, ctx: ExecutorContext): CommandResult {
  const { route, label } = command.params
  if (route) {
    ctx.navigate(route)
    return {
      success: true,
      message: `Navegando a ${label || route}`,
      navigate_to: route,
    }
  }
  return { success: false, message: 'No pude determinar a dónde navegar.' }
}

// --- Helpers ---

function getMonthKeyForPeriod(period: string, currentMonthKey: string): string {
  if (period === 'last_month') {
    const [y, m] = currentMonthKey.split('-').map(Number)
    const d = new Date(y, m - 2, 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  }
  return currentMonthKey
}

function getPeriodLabel(period: string): string {
  const labels: Record<string, string> = {
    today: 'de hoy',
    yesterday: 'de ayer',
    this_week: 'de esta semana',
    last_week: 'de la semana pasada',
    this_month: 'del mes',
    last_month: 'del mes pasado',
    this_year: 'del año',
    last_year: 'del año pasado',
    all: 'totales',
  }
  return labels[period] || 'del mes'
}
