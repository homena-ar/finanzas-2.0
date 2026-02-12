// ============================================
// COMMAND BAR - PARSER (AI-Powered + Local Fallback)
// ============================================
// Primary: Calls Gemini via /api/parse-command for natural language parsing.
// Fallback: Regex-based local parsing for offline/error scenarios.

import type { ParsedCommand, CommandIntent, ClarificationField } from './types'
import { preprocess, detectPeriod, extractDescription, detectRecurrence } from './preprocessor'

// --- AI-Powered Parser (Primary) ---

export async function parseCommandAI(
  rawInput: string,
  context?: { categories?: string[]; shoppingLists?: string[]; goals?: string[] }
): Promise<ParsedCommand | null> {
  try {
    const response = await fetch('/api/parse-command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: rawInput, context }),
    })

    if (!response.ok) {
      console.warn('[CommandBar] AI parse HTTP error:', response.status)
      return null
    }

    const parsed = await response.json()

    if (parsed.error) {
      console.warn('[CommandBar] AI parse returned error:', parsed.error)
      return null
    }

    // Normalize and validate the response
    return {
      type: parsed.type || 'action',
      intent: parsed.intent || 'navigate',
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0,
      params: parsed.params || {},
      needs_clarification: Array.isArray(parsed.needs_clarification) ? parsed.needs_clarification : [],
      suggested_followups: Array.isArray(parsed.suggested_followups) ? parsed.suggested_followups : [],
      raw_input: rawInput,
      actions: parsed.actions?.map((a: any) => ({
        type: a.type || 'action',
        intent: a.intent,
        confidence: typeof a.confidence === 'number' ? a.confidence : parsed.confidence ?? 0.9,
        params: a.params || {},
        needs_clarification: Array.isArray(a.needs_clarification) ? a.needs_clarification : [],
        suggested_followups: Array.isArray(a.suggested_followups) ? a.suggested_followups : [],
        raw_input: rawInput,
      })),
    }
  } catch (error) {
    console.warn('[CommandBar] AI parse exception:', error)
    return null
  }
}

// --- Local Regex-Based Parser (Fallback) ---

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
  // GASTOS
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
      if (pre.amounts.length > 0) {
        params.amount = pre.amounts[0].value
      } else {
        clarifications.push({ field: 'amount', message: '¿Cuánto fue el gasto?' })
      }
      params.currency = pre.currency || 'ARS'
      params.date = pre.dates.length > 0 ? pre.dates[0].value : new Date().toISOString().split('T')[0]
      const amountStrs = pre.amounts.map(a => a.raw)
      const dateStrs = pre.dates.map(d => d.raw)
      const desc = extractDescription(text, [...amountStrs, ...dateStrs])
      if (desc) params.merchant = desc
      const lower = text.toLowerCase()
      if (/\btarjeta\b/.test(lower)) params.payment_method = 'tarjeta'
      else if (/\befectivo\b/.test(lower)) params.payment_method = 'efectivo'
      else if (/\bd[eé]bito\b/.test(lower)) params.payment_method = 'debito'
      else if (/\btransferencia\b/.test(lower)) params.payment_method = 'transferencia'
      const confidence = params.amount ? (params.merchant ? 0.95 : 0.80) : 0.60
      return { params, confidence, needs_clarification: clarifications }
    },
  },
  // INGRESOS
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
      if (pre.amounts.length > 0) params.amount = pre.amounts[0].value
      else clarifications.push({ field: 'amount', message: '¿Cuánto fue el ingreso?' })
      params.currency = pre.currency || 'ARS'
      params.date = pre.dates.length > 0 ? pre.dates[0].value : new Date().toISOString().split('T')[0]
      const amountStrs = pre.amounts.map(a => a.raw)
      const dateStrs = pre.dates.map(d => d.raw)
      const desc = extractDescription(text, [...amountStrs, ...dateStrs])
      if (desc) params.description = desc
      return { params, confidence: params.amount ? 0.90 : 0.60, needs_clarification: clarifications }
    },
  },
  // AHORROS
  {
    intent: 'add_saving',
    type: 'action',
    patterns: [
      /(?:ahorr[eé]|ahorrá|ahorrar)\s+/i,
      /(?:pas[aá]|pasar|mover|mové)\s+.*(?:ahorro|ahorros)\b/i,
      /(?:agrega|agregá)\s+.*(?:ahorro|ahorros)\b/i,
    ],
    extract: (text, pre) => {
      const params: Record<string, any> = {}
      const clarifications: ClarificationField[] = []
      if (pre.amounts.length > 0) params.amount = pre.amounts[0].value
      else clarifications.push({ field: 'amount', message: '¿Cuánto querés ahorrar?' })
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
      return { params, confidence: params.amount ? 0.90 : 0.60, needs_clarification: clarifications }
    },
  },
  // METAS
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
      if (pre.amounts.length > 0) params.objetivo = pre.amounts[0].value
      else clarifications.push({ field: 'objetivo', message: '¿Cuál es el objetivo de la meta?' })
      params.currency = pre.currency || 'ARS'
      const nameMatch = text.match(/['"""]([^'"""]+)['"""]/)
      if (nameMatch) {
        params.nombre = nameMatch[1]
      } else {
        const afterMeta = text.match(/meta\s+(?:de\s+)?(.+?)(?:\s+\d|\s*$)/i)
        if (afterMeta) {
          const name = afterMeta[1].replace(/\$?\s*[\d.,]+\s*k?/g, '').replace(/\b(usd|ars|dólares?|dolares?|pesos?)\b/gi, '').trim()
          if (name) params.nombre = name.charAt(0).toUpperCase() + name.slice(1)
        }
        if (!params.nombre) clarifications.push({ field: 'nombre', message: '¿Cómo querés llamar a la meta?' })
      }
      return { params, confidence: params.nombre && params.objetivo ? 0.90 : 0.60, needs_clarification: clarifications }
    },
  },
  // RECORDATORIOS
  {
    intent: 'create_reminder',
    type: 'action',
    patterns: [
      /(?:recordame|recordá|recorda|recordar)\s+/i,
      /(?:crear|crea|creá|nuevo|nueva)\s+(?:un\s+)?recordatorio/i,
    ],
    extract: (text, pre) => {
      const params: Record<string, any> = {}
      const clarifications: ClarificationField[] = []
      if (pre.dates.length > 0) params.date = pre.dates[0].value
      else clarifications.push({ field: 'date', message: '¿Para cuándo es el recordatorio?' })
      const recurrence = detectRecurrence(text)
      if (recurrence) params.recurrence = recurrence
      let title = text
        .replace(/(?:recordame|recordá|recorda|recordar|crear?|creá|nuevo|nueva|agregar?|agrega|agregá)\s+(?:un\s+)?(?:recordatorio\s+(?:de\s+|para\s+)?)?/i, '')
        .replace(/\b(hoy|ayer|mañana)\b/gi, '')
        .replace(/(?:el|dia|día)\s+\d{1,2}/gi, '')
        .replace(/\s+/g, ' ')
        .trim()
      if (title) params.title = title.charAt(0).toUpperCase() + title.slice(1)
      else clarifications.push({ field: 'title', message: '¿Qué querés recordar?' })
      const timeMatch = text.match(/(\d{1,2}):(\d{2})/)
      if (timeMatch) params.time = `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}`
      return { params, confidence: params.title && params.date ? 0.90 : 0.50, needs_clarification: clarifications }
    },
  },
  // LISTAS DE COMPRAS
  {
    intent: 'add_shopping_items',
    type: 'action',
    patterns: [
      /(?:en|a)\s+(?:la\s+)?(?:lista\s+(?:de\s+compras?\s+)?)?(?:de\s+)?\w+\s+(?:agrega|agregá|agregar|sum[aá]|pone|poné)\s+/i,
      /(?:agrega|agregá|agregar|sum[aá]|pone|poné)\s+.+\s+(?:a\s+)?(?:la\s+)?lista/i,
    ],
    extract: (text, _pre) => {
      const params: Record<string, any> = {}
      const clarifications: ClarificationField[] = []
      const listNames = ['supermercado', 'farmacia', 'ferretería', 'ferreteria', 'verdulería', 'verduleria', 'kiosco']
      const lower = text.toLowerCase()
      for (const name of listNames) {
        if (lower.includes(name)) {
          params.list_name = name.charAt(0).toUpperCase() + name.slice(1)
          break
        }
      }
      if (!params.list_name) {
        const listMatch = text.match(/lista\s+(?:de\s+)?['"""]?(\w+)['"""]?/i)
        if (listMatch) params.list_name = listMatch[1].charAt(0).toUpperCase() + listMatch[1].slice(1)
      }
      if (!params.list_name) clarifications.push({ field: 'list_name', message: '¿A qué lista?' })
      let itemsText = text.replace(/.*(?:agrega|agregá|agregar|sum[aá]|pone|poné)\s+/i, '').replace(/\s+(?:a\s+)?(?:la\s+)?lista.*/i, '').trim()
      if (itemsText) {
        const itemNames = itemsText.split(/\s*(?:,|(?:\s+y\s+))\s*/).map(s => s.trim()).filter(Boolean)
        params.items = itemNames.map(name => ({ name: name.charAt(0).toUpperCase() + name.slice(1), qty: 1, unit: 'u' }))
      }
      if (!params.items || params.items.length === 0) clarifications.push({ field: 'items', message: '¿Qué querés agregar?' })
      return { params, confidence: params.list_name && params.items?.length ? 0.85 : 0.55, needs_clarification: clarifications }
    },
  },
  // CONSULTAS
  {
    intent: 'query_expense_total',
    type: 'query',
    patterns: [
      /(?:cu[aá]nto\s+gast[eé]|total\s+(?:de\s+)?gastos?)/i,
      /(?:dame|decime|mostr[aá]|ver)\s+(?:el\s+)?total\s+(?:de\s+)?gastos?/i,
    ],
    extract: (text, pre) => ({
      params: { period: detectPeriod(text), currency: pre.currency || 'ARS' },
      confidence: 0.95,
      needs_clarification: [],
    }),
  },
  {
    intent: 'query_balance',
    type: 'query',
    patterns: [
      /\bbalance\b/i,
      /\bsaldo\b/i,
      /(?:cu[aá]nto\s+(?:me\s+)?(?:queda|sobra))/i,
    ],
    extract: (text, pre) => ({
      params: { period: detectPeriod(text), currency: pre.currency || 'ARS' },
      confidence: 0.95,
      needs_clarification: [],
    }),
  },
  {
    intent: 'query_top_expenses',
    type: 'query',
    patterns: [
      /(?:top|mayores?|principales?)\s+(?:\d+\s+)?gastos?/i,
    ],
    extract: (text, pre) => {
      const limitMatch = text.match(/(?:top|primeros?)\s+(\d+)/i)
      return {
        params: { period: detectPeriod(text), currency: pre.currency || 'ARS', limit: limitMatch ? parseInt(limitMatch[1], 10) : 5 },
        confidence: 0.90,
        needs_clarification: [],
      }
    },
  },
  // NAVIGATION
  {
    intent: 'navigate',
    type: 'navigation',
    patterns: [
      /(?:ir\s+a|abrir?|abr[ií]|mostrar?|mostr[aá]|ver)\s+(?:la?\s+)?(?:p[aá]gina\s+(?:de\s+)?)?(resumen|dashboard|gastos|ingresos|cuentas|tarjetas|ahorro|ahorros|proyecci[oó]n|recordatorios|listas?|config)/i,
    ],
    extract: (text, _pre) => {
      const lower = text.toLowerCase()
      const routes: Record<string, string> = {
        'resumen': '/dashboard', 'dashboard': '/dashboard', 'gastos': '/dashboard/gastos',
        'ingresos': '/dashboard/ingresos', 'cuentas': '/dashboard/tarjetas', 'tarjetas': '/dashboard/tarjetas',
        'ahorro': '/dashboard/ahorros', 'ahorros': '/dashboard/ahorros', 'proyeccion': '/dashboard/proyeccion',
        'proyección': '/dashboard/proyeccion', 'recordatorios': '/dashboard/recordatorios',
        'listas': '/dashboard/listas', 'config': '/dashboard/config',
      }
      for (const [key, route] of Object.entries(routes)) {
        if (lower.includes(key)) {
          return { params: { route, label: key.charAt(0).toUpperCase() + key.slice(1) }, confidence: 0.95, needs_clarification: [] }
        }
      }
      return { params: {}, confidence: 0.50, needs_clarification: [] }
    },
  },
]

// Local regex-based parser (used as fallback when AI is unavailable)
export function parseCommandLocal(rawInput: string): ParsedCommand | null {
  if (!rawInput || rawInput.trim().length === 0) return null
  const preprocessed = preprocess(rawInput)
  const text = preprocessed.normalized

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

  return null
}

// Keep the old export name for backwards compatibility
export const parseCommand = parseCommandLocal

function getSuggestedFollowups(intent: CommandIntent): string[] {
  const followups: Record<string, string[]> = {
    create_expense: ['Total de gastos del mes', 'Balance del mes'],
    create_income: ['Total de ingresos del mes', 'Balance del mes'],
    add_saving: ['Total de ahorros', 'Ver metas'],
    create_goal: ['Ver progreso de metas'],
    create_reminder: ['Ver recordatorios'],
    add_shopping_items: ['Ver lista de compras'],
    query_expense_total: ['Top 5 gastos del mes', 'Balance del mes'],
    query_balance: ['Top 5 gastos del mes'],
  }
  return followups[intent] || []
}
