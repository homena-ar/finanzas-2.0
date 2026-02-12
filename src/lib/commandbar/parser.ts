// ============================================
// COMMAND BAR - LOCAL PARSER (Regex + Heuristics)
// ============================================
// Parses preprocessed input into structured intents WITHOUT AI.
// Only falls back to AI when no local pattern matches.

import type { ParsedCommand, CommandIntent, ClarificationField } from './types'
import { preprocess, detectPeriod, extractDescription, detectRecurrence } from './preprocessor'

// --- Pattern definitions for each intent ---

interface IntentPattern {
  intent: CommandIntent
  type: 'action' | 'query' | 'navigation'
  patterns: RegExp[]
  extract: (text: string, preprocessed: ReturnType<typeof preprocess>) => {
    params: Record<string, any>
    confidence: number
    needs_clarification: ClarificationField[]
  }
}

const INTENT_PATTERNS: IntentPattern[] = [
  // =====================================
  // FINANZAS - GASTOS
  // =====================================
  {
    intent: 'create_expense',
    type: 'action',
    patterns: [
      /(?:agrega|agregá|agregar|nuevo|nueva|crear|crea|creá|registr[aá]|anot[aá])\s+(?:un\s+)?gasto/i,
      /gasto\s+(?:de\s+)?\$?\s*[\d.,]+/i,
      /gast[eé]\s+\$?\s*[\d.,]+/i,
      /(?:pagu[eé]|compré|compr[eé])\s+/i,
    ],
    extract: (text, pre) => {
      const params: Record<string, any> = {}
      const clarifications: ClarificationField[] = []

      // Amount
      if (pre.amounts.length > 0) {
        params.amount = pre.amounts[0].value
      } else {
        clarifications.push({
          field: 'amount',
          message: '¿Cuánto fue el gasto?',
        })
      }

      // Currency
      params.currency = pre.currency || 'ARS'

      // Date
      if (pre.dates.length > 0) {
        params.date = pre.dates[0].value
      } else {
        params.date = new Date().toISOString().split('T')[0]
      }

      // Description/merchant
      const amountStrs = pre.amounts.map(a => a.raw)
      const dateStrs = pre.dates.map(d => d.raw)
      const desc = extractDescription(text, [...amountStrs, ...dateStrs])
      if (desc) {
        params.merchant = desc
      } else if (!clarifications.some(c => c.field === 'amount')) {
        clarifications.push({
          field: 'merchant',
          message: '¿Dónde o qué descripción?',
          options: [
            { label: 'Supermercado', value: 'Supermercado' },
            { label: 'Comida', value: 'Comida' },
            { label: 'Transporte', value: 'Transporte' },
            { label: 'Servicios', value: 'Servicios' },
          ],
        })
      }

      // Payment method detection
      const lower = text.toLowerCase()
      if (/\btarjeta\b/.test(lower)) params.payment_method = 'tarjeta'
      else if (/\befectivo\b/.test(lower)) params.payment_method = 'efectivo'
      else if (/\bd[eé]bito\b/.test(lower)) params.payment_method = 'debito'
      else if (/\btransferencia\b/.test(lower)) params.payment_method = 'transferencia'

      const confidence = params.amount ? (params.merchant ? 0.95 : 0.80) : 0.60
      return { params, confidence, needs_clarification: clarifications }
    },
  },

  // =====================================
  // FINANZAS - INGRESOS
  // =====================================
  {
    intent: 'create_income',
    type: 'action',
    patterns: [
      /(?:agrega|agregá|agregar|nuevo|nueva|crear|crea|creá|registr[aá]|anot[aá])\s+(?:un\s+)?ingreso/i,
      /ingreso\s+(?:de\s+)?\$?\s*[\d.,]+/i,
      /cobr[eé]\s+/i,
      /(?:me\s+)?(?:pagaron|depositaron|entraron|transfirieron)\s+/i,
    ],
    extract: (text, pre) => {
      const params: Record<string, any> = {}
      const clarifications: ClarificationField[] = []

      if (pre.amounts.length > 0) {
        params.amount = pre.amounts[0].value
      } else {
        clarifications.push({ field: 'amount', message: '¿Cuánto fue el ingreso?' })
      }

      params.currency = pre.currency || 'ARS'

      if (pre.dates.length > 0) {
        params.date = pre.dates[0].value
      } else {
        params.date = new Date().toISOString().split('T')[0]
      }

      const amountStrs = pre.amounts.map(a => a.raw)
      const dateStrs = pre.dates.map(d => d.raw)
      const desc = extractDescription(text, [...amountStrs, ...dateStrs])
      if (desc) params.description = desc

      const confidence = params.amount ? 0.90 : 0.60
      return { params, confidence, needs_clarification: clarifications }
    },
  },

  // =====================================
  // FINANZAS - AHORROS
  // =====================================
  {
    intent: 'add_saving',
    type: 'action',
    patterns: [
      /(?:ahorr[eé]|ahorrá|ahorrar)\s+/i,
      /(?:pas[aá]|pasar|mover|mové)\s+.*(?:ahorro|ahorros)\b/i,
      /(?:agrega|agregá)\s+.*(?:ahorro|ahorros)\b/i,
      /(?:sumar?|sumá)\s+.*(?:ahorro|ahorros)\b/i,
    ],
    extract: (text, pre) => {
      const params: Record<string, any> = {}
      const clarifications: ClarificationField[] = []

      if (pre.amounts.length > 0) {
        params.amount = pre.amounts[0].value
      } else {
        clarifications.push({ field: 'amount', message: '¿Cuánto querés ahorrar?' })
      }

      // For savings, currency is especially important
      if (pre.currency) {
        params.currency = pre.currency
        params.tipo = pre.currency === 'USD' ? 'usd' : 'pesos'
      } else {
        params.currency = 'ARS'
        params.tipo = 'pesos'
      }

      const amountStrs = pre.amounts.map(a => a.raw)
      const desc = extractDescription(text, amountStrs)
      if (desc) params.description = desc

      const confidence = params.amount ? 0.90 : 0.60
      return { params, confidence, needs_clarification: clarifications }
    },
  },

  // =====================================
  // FINANZAS - METAS
  // =====================================
  {
    intent: 'create_goal',
    type: 'action',
    patterns: [
      /(?:crear|crea|creá|nueva)\s+meta\b/i,
      /(?:agregar|agrega|agregá)\s+(?:una\s+)?meta\b/i,
    ],
    extract: (text, pre) => {
      const params: Record<string, any> = {}
      const clarifications: ClarificationField[] = []

      if (pre.amounts.length > 0) {
        params.objetivo = pre.amounts[0].value
      } else {
        clarifications.push({ field: 'objetivo', message: '¿Cuál es el objetivo de la meta?' })
      }

      params.currency = pre.currency || 'ARS'

      // Extract name in quotes
      const nameMatch = text.match(/['"""]([^'"""]+)['"""]/)
      if (nameMatch) {
        params.nombre = nameMatch[1]
      } else {
        // Try to extract name after "meta"
        const afterMeta = text.match(/meta\s+(?:de\s+)?(.+?)(?:\s+\d|\s*$)/i)
        if (afterMeta) {
          const name = afterMeta[1].replace(/\$?\s*[\d.,]+\s*k?/g, '').replace(/\b(usd|ars|dólares?|dolares?|pesos?)\b/gi, '').trim()
          if (name) params.nombre = name.charAt(0).toUpperCase() + name.slice(1)
        }
        if (!params.nombre) {
          clarifications.push({ field: 'nombre', message: '¿Cómo querés llamar a la meta?' })
        }
      }

      const confidence = params.nombre && params.objetivo ? 0.90 : 0.60
      return { params, confidence, needs_clarification: clarifications }
    },
  },
  {
    intent: 'contribute_goal',
    type: 'action',
    patterns: [
      /(?:sumar?|sumá|agregar|agregá|aportar?|aportá)\s+.*(?:a\s+)?meta\b/i,
      /(?:sumar?|sumá|agregar|agregá|aportar?|aportá)\s+.*(?:a\s+)meta\s+/i,
    ],
    extract: (text, pre) => {
      const params: Record<string, any> = {}
      const clarifications: ClarificationField[] = []

      if (pre.amounts.length > 0) {
        params.amount = pre.amounts[0].value
      } else {
        clarifications.push({ field: 'amount', message: '¿Cuánto querés sumar a la meta?' })
      }

      // Extract goal name
      const nameMatch = text.match(/meta\s+(.+?)(?:\s*$)/i)
      if (nameMatch) {
        const name = nameMatch[1].replace(/\$?\s*[\d.,]+\s*k?/g, '').trim()
        if (name) params.goal_name = name
      }

      if (!params.goal_name) {
        clarifications.push({ field: 'goal_name', message: '¿A qué meta querés sumar?' })
      }

      const confidence = params.amount && params.goal_name ? 0.90 : 0.60
      return { params, confidence, needs_clarification: clarifications }
    },
  },
  {
    intent: 'goal_status',
    type: 'query',
    patterns: [
      /(?:cu[aá]nto\s+falta|progreso|estado)\s+(?:para\s+|de\s+)?(?:la\s+)?meta/i,
      /(?:ver|mostrar|mostr[aá])\s+(?:progreso|estado)\s+(?:de\s+)?(?:las?\s+)?metas?/i,
      /(?:c[oó]mo\s+(?:va|van)|estado\s+de)\s+(?:la\s+)?metas?/i,
    ],
    extract: (text, _pre) => {
      const params: Record<string, any> = {}
      const nameMatch = text.match(/meta\s+(.+?)(?:\s*$)/i)
      if (nameMatch) {
        const name = nameMatch[1].replace(/\?/g, '').trim()
        if (name) params.goal_name = name
      }
      return { params, confidence: 0.90, needs_clarification: [] }
    },
  },

  // =====================================
  // RECORDATORIOS
  // =====================================
  {
    intent: 'create_reminder',
    type: 'action',
    patterns: [
      /(?:recordame|recordá|recorda|recordar)\s+/i,
      /(?:crear|crea|creá|nuevo|nueva)\s+(?:un\s+)?recordatorio/i,
      /(?:agregar|agrega|agregá)\s+(?:un\s+)?recordatorio/i,
    ],
    extract: (text, pre) => {
      const params: Record<string, any> = {}
      const clarifications: ClarificationField[] = []

      // Date
      if (pre.dates.length > 0) {
        params.date = pre.dates[0].value
      } else {
        clarifications.push({ field: 'date', message: '¿Para cuándo es el recordatorio?' })
      }

      // Recurrence
      const recurrence = detectRecurrence(text)
      if (recurrence) {
        params.recurrence = recurrence
      }

      // Title - extract everything after the command keyword
      let title = text
        .replace(/(?:recordame|recordá|recorda|recordar|crear?|crea|creá|nuevo|nueva|agregar?|agrega|agregá)\s+(?:un\s+)?(?:recordatorio\s+(?:de\s+|para\s+)?)?/i, '')
        .replace(/\b(hoy|ayer|mañana)\b/gi, '')
        .replace(/(?:el|dia|día)\s+\d{1,2}/gi, '')
        .replace(/(?:todos?\s+los?\s+meses?\s+(?:el\s+)?\d{1,2})/gi, '')
        .replace(/(?:cada\s+(?:mes\s+(?:el\s+)?\d{1,2}|lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo))/gi, '')
        .replace(/\d{1,2}:\d{2}/g, '')
        .replace(/\s+/g, ' ')
        .trim()

      if (title) {
        params.title = title.charAt(0).toUpperCase() + title.slice(1)
      } else {
        clarifications.push({ field: 'title', message: '¿Qué querés recordar?' })
      }

      // Time detection (HH:MM)
      const timeMatch = text.match(/(\d{1,2}):(\d{2})/)
      if (timeMatch) {
        params.time = `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}`
      }

      const confidence = params.title && params.date ? 0.90 : (params.title ? 0.75 : 0.50)
      return { params, confidence, needs_clarification: clarifications }
    },
  },
  {
    intent: 'list_reminders',
    type: 'query',
    patterns: [
      /(?:ver|mostrar|mostr[aá]|listar|list[aá])\s+(?:los?\s+)?recordatorios/i,
      /(?:qu[eé]\s+)?recordatorios\s+(?:tengo|hay)/i,
      /(?:cu[aá]ntos?\s+)?recordatorios?\s+(?:tengo|hay)/i,
    ],
    extract: (text, pre) => {
      const params: Record<string, any> = {}
      if (pre.dates.length > 0) {
        params.date = pre.dates[0].value
      }
      params.period = detectPeriod(text)
      return { params, confidence: 0.90, needs_clarification: [] }
    },
  },

  // =====================================
  // LISTAS DE COMPRAS
  // =====================================
  {
    intent: 'create_shopping_list',
    type: 'action',
    patterns: [
      /(?:crear|crea|creá|nueva)\s+lista\s+(?:de\s+compras?\s+)?/i,
    ],
    extract: (text, _pre) => {
      const params: Record<string, any> = {}
      const clarifications: ClarificationField[] = []

      const nameMatch = text.match(/(?:lista\s+(?:de\s+compras?\s+)?)['"""]?([^'"""]+?)['"""]?\s*$/i)
      if (nameMatch) {
        const name = nameMatch[1].trim()
        if (name && name.length > 0) {
          params.list_name = name.charAt(0).toUpperCase() + name.slice(1)
        }
      }

      if (!params.list_name) {
        clarifications.push({
          field: 'list_name',
          message: '¿Cómo querés llamar a la lista?',
          options: [
            { label: 'Supermercado', value: 'Supermercado' },
            { label: 'Verdulería', value: 'Verdulería' },
            { label: 'Ferretería', value: 'Ferretería' },
            { label: 'Farmacia', value: 'Farmacia' },
          ],
        })
      }

      return { params, confidence: params.list_name ? 0.90 : 0.70, needs_clarification: clarifications }
    },
  },
  {
    intent: 'add_shopping_items',
    type: 'action',
    patterns: [
      /(?:en|a)\s+(?:la\s+)?(?:lista\s+(?:de\s+compras?\s+)?)?(?:de\s+)?(?:supermercado|super|farmacia|ferreter[ií]a|verdule?r[ií]a|kiosco|almac[eé]n|carnicer[ií]a)\s+(?:agrega|agregá|agregar|sum[aá]|pone|poné)\s+/i,
      /(?:agrega|agregá|agregar|sum[aá]|pone|poné)\s+(?:a\s+)?(?:la\s+)?(?:lista\s+(?:de\s+compras?\s+)?)?(?:de\s+)?(?:supermercado|super|farmacia|ferreter[ií]a)\s+/i,
      /(?:agrega|agregá|agregar|sum[aá]|pone|poné)\s+.+\s+(?:a\s+)?(?:la\s+)?lista\s+(?:de\s+compras?\s+)?/i,
    ],
    extract: (text, _pre) => {
      const params: Record<string, any> = {}
      const clarifications: ClarificationField[] = []

      // Detect list name
      const listNames = ['supermercado', 'super', 'farmacia', 'ferretería', 'ferreteria', 'verdulería', 'verduleria', 'kiosco', 'almacén', 'almacen', 'carnicería', 'carniceria']
      const lower = text.toLowerCase()
      for (const name of listNames) {
        if (lower.includes(name)) {
          params.list_name = name === 'super' ? 'Supermercado' : name.charAt(0).toUpperCase() + name.slice(1)
          break
        }
      }

      // Or detect by "lista X" pattern
      if (!params.list_name) {
        const listMatch = text.match(/lista\s+(?:de\s+compras?\s+)?(?:de\s+)?['"""]?([^'"""]+?)['"""]?(?:\s+agrega|$)/i)
        if (listMatch) {
          params.list_name = listMatch[1].trim()
        }
      }

      if (!params.list_name) {
        clarifications.push({ field: 'list_name', message: '¿A qué lista de compras?' })
      }

      // Extract items (comma/y separated)
      let itemsText = text
        .replace(/(?:en|a)\s+(?:la\s+)?(?:lista\s+(?:de\s+compras?\s+)?)?(?:de\s+)?\w+\s+(?:agrega|agregá|agregar|sum[aá]|pone|poné)\s+/i, '')
        .replace(/(?:agrega|agregá|agregar|sum[aá]|pone|poné)\s+(?:a\s+)?(?:la\s+)?(?:lista\s+(?:de\s+compras?\s+)?)?(?:de\s+)?\w+\s+/i, '')
        .replace(/(?:agrega|agregá|agregar|sum[aá]|pone|poné)\s+/i, '')
        .replace(/\s+(?:a\s+)?(?:la\s+)?lista\s+(?:de\s+compras?\s+)?(?:de\s+)?\w+/i, '')
        .trim()

      if (itemsText) {
        const itemNames = itemsText
          .split(/\s*(?:,|(?:\s+y\s+))\s*/)
          .map(s => s.trim())
          .filter(Boolean)

        params.items = itemNames.map(name => ({
          name: name.charAt(0).toUpperCase() + name.slice(1),
          qty: 1,
          unit: 'u',
        }))
      }

      if (!params.items || params.items.length === 0) {
        clarifications.push({ field: 'items', message: '¿Qué querés agregar a la lista?' })
      }

      const confidence = params.list_name && params.items?.length ? 0.90 : 0.60
      return { params, confidence, needs_clarification: clarifications }
    },
  },
  {
    intent: 'clear_completed_items',
    type: 'action',
    patterns: [
      /(?:vaciar|limpiar|borrar|eliminar)\s+(?:los?\s+)?completados?\s+(?:en|de)\s+(?:la\s+)?(?:lista\s+(?:de\s+compras?\s+)?)?/i,
      /(?:vaciar|limpiar|borrar|eliminar)\s+(?:los?\s+)?(?:items?\s+)?(?:comprados?|tachados?)\s+(?:en|de)\s+/i,
    ],
    extract: (text, _pre) => {
      const params: Record<string, any> = {}
      const nameMatch = text.match(/(?:en|de)\s+(?:la\s+)?(?:lista\s+(?:de\s+compras?\s+)?)?(?:de\s+)?['"""]?(\w+)['"""]?\s*$/i)
      if (nameMatch) {
        params.list_name = nameMatch[1].charAt(0).toUpperCase() + nameMatch[1].slice(1)
      }
      const clarifications: ClarificationField[] = []
      if (!params.list_name) {
        clarifications.push({ field: 'list_name', message: '¿De qué lista querés vaciar los completados?' })
      }
      return { params, confidence: params.list_name ? 0.90 : 0.70, needs_clarification: clarifications }
    },
  },

  // =====================================
  // CONSULTAS / REPORTES
  // =====================================
  {
    intent: 'query_expense_total',
    type: 'query',
    patterns: [
      /(?:cu[aá]nto\s+gast[eé]|total\s+(?:de\s+)?gastos?|gastos?\s+(?:de[l]?\s+)?(?:este\s+)?mes)/i,
      /(?:dame|decime|mostr[aá]|ver)\s+(?:el\s+)?total\s+(?:de\s+)?gastos?/i,
      /(?:total|suma)\s+(?:de\s+)?(?:lo\s+)?(?:que\s+)?gast[eé]/i,
    ],
    extract: (text, pre) => {
      const params: Record<string, any> = {
        period: detectPeriod(text),
        currency: pre.currency || 'ARS',
      }

      // Category filter
      const lower = text.toLowerCase()
      const categoryMatch = lower.match(/(?:en|de)\s+(supermercado|comida|transporte|servicios|entretenimiento|salud|educaci[oó]n|ropa|hogar)/i)
      if (categoryMatch) {
        params.category = categoryMatch[1].charAt(0).toUpperCase() + categoryMatch[1].slice(1)
      }

      return { params, confidence: 0.95, needs_clarification: [] }
    },
  },
  {
    intent: 'query_income_total',
    type: 'query',
    patterns: [
      /(?:total\s+(?:de\s+)?ingresos?|ingresos?\s+(?:de[l]?\s+)?(?:este\s+)?mes)/i,
      /(?:cu[aá]nto\s+(?:cobr[eé]|ingres[eé]|entr[oó]))/i,
      /(?:dame|decime|mostr[aá]|ver)\s+(?:el\s+)?total\s+(?:de\s+)?ingresos?/i,
    ],
    extract: (text, pre) => {
      return {
        params: {
          period: detectPeriod(text),
          currency: pre.currency || 'ARS',
        },
        confidence: 0.95,
        needs_clarification: [],
      }
    },
  },
  {
    intent: 'query_balance',
    type: 'query',
    patterns: [
      /\bbalance\b/i,
      /\bsaldo\b/i,
      /(?:cu[aá]nto\s+(?:me\s+)?(?:queda|sobra))/i,
      /(?:ingresos?\s+(?:menos|vs|contra)\s+gastos?)/i,
      /(?:diferencia\s+(?:entre\s+)?ingresos?\s+y\s+gastos?)/i,
    ],
    extract: (text, pre) => {
      return {
        params: {
          period: detectPeriod(text),
          currency: pre.currency || 'ARS',
        },
        confidence: 0.95,
        needs_clarification: [],
      }
    },
  },
  {
    intent: 'query_top_expenses',
    type: 'query',
    patterns: [
      /(?:top|mayores?|principales?|m[aá]s?\s+(?:grandes?|altos?|caros?))\s+(?:\d+\s+)?gastos?/i,
      /gastos?\s+(?:m[aá]s?\s+(?:grandes?|altos?|caros?)|principales?|top)/i,
    ],
    extract: (text, pre) => {
      const limitMatch = text.match(/(?:top|primeros?)\s+(\d+)/i)
      return {
        params: {
          period: detectPeriod(text),
          currency: pre.currency || 'ARS',
          limit: limitMatch ? parseInt(limitMatch[1], 10) : 5,
        },
        confidence: 0.90,
        needs_clarification: [],
      }
    },
  },
  {
    intent: 'query_savings_total',
    type: 'query',
    patterns: [
      /(?:total\s+(?:de\s+)?ahorros?|cu[aá]nto\s+(?:tengo\s+)?(?:en\s+)?ahorros?|ahorros?\s+totale?s?)/i,
      /(?:cu[aá]nto\s+ahorr[eé])/i,
    ],
    extract: (text, pre) => {
      return {
        params: { currency: pre.currency },
        confidence: 0.90,
        needs_clarification: [],
      }
    },
  },
  {
    intent: 'query_reminders_count',
    type: 'query',
    patterns: [
      /(?:cu[aá]ntos?\s+)?recordatorios?\s+(?:tengo|hay)\s+(?:para\s+)?/i,
      /recordatorios?\s+(?:de|para)\s+(?:hoy|mañana|esta\s+semana)/i,
    ],
    extract: (text, pre) => {
      const params: Record<string, any> = {}
      if (pre.dates.length > 0) params.date = pre.dates[0].value
      params.period = detectPeriod(text)
      return { params, confidence: 0.90, needs_clarification: [] }
    },
  },

  // =====================================
  // NAVIGATION
  // =====================================
  {
    intent: 'navigate',
    type: 'navigation',
    patterns: [
      /(?:ir\s+a|abrir?|abr[ií]|mostrar?|mostr[aá]|ver)\s+(?:la?\s+)?(?:p[aá]gina\s+(?:de\s+)?)?(resumen|dashboard|gastos|ingresos|cuentas|tarjetas|ahorro|ahorros|proyecci[oó]n|recordatorios|listas?(?:\s+de\s+compras)?|config(?:uraci[oó]n)?)/i,
    ],
    extract: (text, _pre) => {
      const lower = text.toLowerCase()
      const routes: Record<string, string> = {
        'resumen': '/dashboard',
        'dashboard': '/dashboard',
        'gastos': '/dashboard/gastos',
        'ingresos': '/dashboard/ingresos',
        'cuentas': '/dashboard/tarjetas',
        'tarjetas': '/dashboard/tarjetas',
        'ahorro': '/dashboard/ahorros',
        'ahorros': '/dashboard/ahorros',
        'proyeccion': '/dashboard/proyeccion',
        'proyección': '/dashboard/proyeccion',
        'recordatorios': '/dashboard/recordatorios',
        'listas': '/dashboard/listas',
        'listas de compras': '/dashboard/listas',
        'lista de compras': '/dashboard/listas',
        'config': '/dashboard/config',
        'configuracion': '/dashboard/config',
        'configuración': '/dashboard/config',
      }

      for (const [key, route] of Object.entries(routes)) {
        if (lower.includes(key)) {
          return {
            params: { route, label: key.charAt(0).toUpperCase() + key.slice(1) },
            confidence: 0.95,
            needs_clarification: [],
          }
        }
      }

      return { params: {}, confidence: 0.50, needs_clarification: [] }
    },
  },
]

// --- Main Parse Function ---

export function parseCommand(rawInput: string): ParsedCommand | null {
  if (!rawInput || rawInput.trim().length === 0) return null

  const preprocessed = preprocess(rawInput)
  const text = preprocessed.normalized

  // Try each intent pattern
  for (const intentDef of INTENT_PATTERNS) {
    for (const pattern of intentDef.patterns) {
      if (pattern.test(text)) {
        const { params, confidence, needs_clarification } = intentDef.extract(text, preprocessed)

        return {
          type: intentDef.type,
          intent: intentDef.intent,
          confidence,
          params,
          needs_clarification,
          suggested_followups: getSuggestedFollowups(intentDef.intent),
          raw_input: rawInput,
        }
      }
    }
  }

  // --- Ambiguity detection ---
  // "agregar leche" without specifying domain
  const addItemAmbiguous = text.match(/(?:agrega|agregá|agregar|sum[aá]|pone|poné)\s+(.+)/i)
  if (addItemAmbiguous) {
    const itemText = addItemAmbiguous[1].trim()
    return {
      type: 'action',
      intent: 'add_shopping_items',
      confidence: 0.40,
      params: { items: [{ name: itemText, qty: 1, unit: 'u' }] },
      needs_clarification: [{
        field: 'domain',
        message: `¿Dónde querés agregar "${itemText}"?`,
        options: [
          { label: 'Lista de compras', value: 'shopping_list' },
          { label: 'Crear gasto', value: 'expense' },
          { label: 'Cancelar', value: 'cancel' },
        ],
      }],
      suggested_followups: [],
      raw_input: rawInput,
    }
  }

  return null
}

// --- Suggested followups by intent ---

function getSuggestedFollowups(intent: CommandIntent): string[] {
  const followups: Record<string, string[]> = {
    create_expense: ['Total de gastos del mes', 'Balance del mes'],
    create_income: ['Total de ingresos del mes', 'Balance del mes'],
    add_saving: ['Total de ahorros', 'Ver metas'],
    create_goal: ['Ver progreso de metas'],
    create_reminder: ['Ver recordatorios'],
    add_shopping_items: ['Ver lista de compras'],
    query_expense_total: ['Top 5 gastos del mes', 'Balance del mes'],
    query_income_total: ['Balance del mes'],
    query_balance: ['Top 5 gastos del mes'],
  }
  return followups[intent] || []
}
