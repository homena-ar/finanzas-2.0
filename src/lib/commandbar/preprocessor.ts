// ============================================
// COMMAND BAR - TEXT PREPROCESSOR
// ============================================
// Handles: normalization, typo correction, amount/currency/date extraction
// Runs BEFORE the parser, with zero AI usage.

import type { PreprocessedInput, ParsedAmount, ParsedDate, CorrectionsDictionary } from './types'

// --- Corrections Dictionary (editable) ---
const CORRECTIONS: CorrectionsDictionary = {
  // Stores
  'carreforur': 'carrefour',
  'carrefur': 'carrefour',
  'carefor': 'carrefour',
  'carefour': 'carrefour',
  'cotoo': 'coto',
  'wallmart': 'walmart',
  'walmar': 'walmart',
  'walmrt': 'walmart',
  'jumpo': 'jumbo',
  'jmbo': 'jumbo',
  'dismol': 'disco',
  // Common items
  'huevoss': 'huevos',
  'hueos': 'huevos',
  'lehe': 'leche',
  'leceh': 'leche',
  'azucar': 'azucar',
  'azcar': 'azucar',
  // Actions
  'agrega': 'agrega',
  'agrga': 'agrega',
  'agregá': 'agrega',
  'agrgá': 'agrega',
  'crea': 'crea',
  'elimna': 'elimina',
  'elimnar': 'eliminar',
  'recoradme': 'recordame',
  'recordme': 'recordame',
  'recrdame': 'recordame',
  'ingrseo': 'ingreso',
  'gsto': 'gasto',
  'gsato': 'gasto',
  'ahorre': 'ahorre',
  'ahorré': 'ahorre',
}

// --- Currency detection patterns ---
const CURRENCY_PATTERNS = {
  usd: [
    /\busd\b/i,
    /\bu\$s\b/i,
    /\bus\$/i,
    /\bdólar(?:es)?\b/i,
    /\bdolar(?:es)?\b/i,
    /\ben\s+dolares\b/i,
    /\ben\s+dólares\b/i,
  ],
  ars: [
    /\bars\b/i,
    /\bpesos?\b/i,
    /\ben\s+pesos\b/i,
  ],
}

// --- Amount patterns ---
// Matches: 2000, 2.000, 2,000, 2.5k, 2k, $2000, $2.000
const AMOUNT_PATTERNS = [
  // $2.000 or $2,000 (thousand separators)
  /\$\s*([\d]{1,3}(?:[.,]\d{3})+)/g,
  // $2000
  /\$\s*([\d]+(?:[.,]\d{1,2})?)/g,
  // 2.5k, 2k
  /([\d]+(?:[.,]\d+)?)\s*k\b/gi,
  // Plain numbers with thousand separators: 2.000, 2,000 (only if > 999)
  /\b([\d]{1,3}(?:\.\d{3})+)\b/g,
  // Plain numbers: 2000, 500.50 (at least 2 digits to avoid matching "1" or single digits in dates)
  /\b(\d{2,}(?:,\d{1,2})?)\b/g,
  // Smaller numbers with decimal: 2,50
  /\b(\d+,\d{1,2})\b/g,
]

// --- Relative date patterns (Spanish) ---
const TODAY = () => {
  const d = new Date()
  return formatDate(d)
}

const YESTERDAY = () => {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return formatDate(d)
}

const TOMORROW = () => {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return formatDate(d)
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function getDateForDayOfMonth(day: number): string {
  const now = new Date()
  const target = new Date(now.getFullYear(), now.getMonth(), day)
  // If the day has already passed this month, it refers to this month still (most natural interpretation)
  return formatDate(target)
}

function getNextWeekday(dayName: string): string {
  const days: Record<string, number> = {
    'lunes': 1, 'martes': 2, 'miercoles': 3, 'miércoles': 3,
    'jueves': 4, 'viernes': 5, 'sabado': 6, 'sábado': 6, 'domingo': 0,
  }
  const targetDay = days[dayName.toLowerCase()]
  if (targetDay === undefined) return TODAY()
  const now = new Date()
  const currentDay = now.getDay()
  let daysUntil = targetDay - currentDay
  if (daysUntil <= 0) daysUntil += 7
  const target = new Date(now)
  target.setDate(now.getDate() + daysUntil)
  return formatDate(target)
}

// --- Main Preprocessor ---

export function preprocess(rawInput: string): PreprocessedInput {
  // 1. Basic normalization
  let normalized = rawInput
    .trim()
    .replace(/\s+/g, ' ')

  const original = normalized

  // Work with lowercase for matching but preserve original for display
  const lower = normalized.toLowerCase()

  // 2. Apply corrections dictionary
  const words = lower.split(/\s+/)
  const correctedWords = words.map(word => {
    const clean = word.replace(/[^a-záéíóúüñ]/gi, '')
    if (CORRECTIONS[clean]) {
      return word.replace(clean, CORRECTIONS[clean])
    }
    return word
  })
  normalized = correctedWords.join(' ')

  // 3. Detect currency
  let currency: 'ARS' | 'USD' | null = null
  for (const pattern of CURRENCY_PATTERNS.usd) {
    if (pattern.test(normalized)) {
      currency = 'USD'
      break
    }
  }
  if (!currency) {
    for (const pattern of CURRENCY_PATTERNS.ars) {
      if (pattern.test(normalized)) {
        currency = 'ARS'
        break
      }
    }
  }

  // 4. Extract amounts
  const amounts = extractAmounts(normalized)

  // 5. Extract dates
  const dates = extractDates(normalized)

  // 6. Tokenize (for parser use)
  const tokens = normalized.split(/\s+/).filter(Boolean)

  return {
    normalized,
    original,
    amounts,
    currency,
    dates,
    tokens,
  }
}

function extractAmounts(text: string): ParsedAmount[] {
  const results: ParsedAmount[] = []
  const seen = new Set<number>()

  // Check for "k" suffix first (2k = 2000, 2.5k = 2500)
  const kPattern = /([\d]+(?:[.,]\d+)?)\s*k\b/gi
  let kMatch
  while ((kMatch = kPattern.exec(text)) !== null) {
    const raw = kMatch[0]
    const numStr = kMatch[1].replace(',', '.')
    const value = parseFloat(numStr) * 1000
    if (!isNaN(value) && value > 0 && !seen.has(kMatch.index)) {
      seen.add(kMatch.index)
      results.push({ value, raw, position: kMatch.index })
    }
  }

  // Check for numbers with $ prefix
  const dollarPattern = /\$\s*([\d]{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?|[\d]+(?:[.,]\d{1,2})?)/g
  let dollarMatch
  while ((dollarMatch = dollarPattern.exec(text)) !== null) {
    if (seen.has(dollarMatch.index)) continue
    const raw = dollarMatch[0]
    const value = parseNumericValue(dollarMatch[1])
    if (!isNaN(value) && value > 0) {
      seen.add(dollarMatch.index)
      results.push({ value, raw, position: dollarMatch.index })
    }
  }

  // Check for plain numbers (at word boundaries, avoiding dates like "el 10")
  // We want numbers that look like amounts, not day numbers
  const plainPattern = /\b(\d{1,3}(?:\.\d{3})+|\d+(?:,\d{1,2})?)\b/g
  let plainMatch
  while ((plainMatch = plainPattern.exec(text)) !== null) {
    if (seen.has(plainMatch.index)) continue
    // Skip if this is likely a date reference ("el 10", "dia 5")
    const before = text.substring(Math.max(0, plainMatch.index - 5), plainMatch.index).toLowerCase()
    if (/(?:el|dia|día|del)\s*$/.test(before)) continue
    // Skip single/double digit numbers that could be dates or quantities
    const numStr = plainMatch[1]
    const value = parseNumericValue(numStr)
    if (!isNaN(value) && value >= 50) {
      // Only consider numbers >= 50 as amounts (to avoid confusing with dates/quantities)
      seen.add(plainMatch.index)
      results.push({ value, raw: plainMatch[0], position: plainMatch.index })
    }
  }

  return results
}

function parseNumericValue(str: string): number {
  // If has dots as thousand separator (e.g., 2.000)
  if (/^\d{1,3}(\.\d{3})+$/.test(str)) {
    return parseInt(str.replace(/\./g, ''), 10)
  }
  // If has commas as thousand separator (e.g., 2,000)
  if (/^\d{1,3}(,\d{3})+$/.test(str)) {
    return parseInt(str.replace(/,/g, ''), 10)
  }
  // If has comma as decimal separator (e.g., 2,50 or 1500,50)
  if (/^\d+,\d{1,2}$/.test(str)) {
    return parseFloat(str.replace(',', '.'))
  }
  // Plain number
  return parseFloat(str)
}

function extractDates(text: string): ParsedDate[] {
  const results: ParsedDate[] = []

  // "hoy"
  if (/\bhoy\b/i.test(text)) {
    results.push({ value: TODAY(), raw: 'hoy', type: 'relative' })
  }

  // "ayer"
  if (/\bayer\b/i.test(text)) {
    results.push({ value: YESTERDAY(), raw: 'ayer', type: 'relative' })
  }

  // "mañana" (as a date, not "morning")
  if (/\bmañana\b/i.test(text) && !/\bde la mañana\b/i.test(text) && !/\bpor la mañana\b/i.test(text)) {
    results.push({ value: TOMORROW(), raw: 'mañana', type: 'relative' })
  }

  // "el 10", "el 5", "dia 15", etc.
  const dayPattern = /(?:el|dia|día)\s+(\d{1,2})\b/gi
  let dayMatch
  while ((dayMatch = dayPattern.exec(text)) !== null) {
    const day = parseInt(dayMatch[1], 10)
    if (day >= 1 && day <= 31) {
      const dateStr = getDateForDayOfMonth(day)
      results.push({ value: dateStr, raw: dayMatch[0], type: 'relative' })
    }
  }

  // Weekday names: "el lunes", "el martes", etc.
  const weekdayPattern = /(?:el\s+)?(lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)\b/gi
  let weekdayMatch
  while ((weekdayMatch = weekdayPattern.exec(text)) !== null) {
    results.push({
      value: getNextWeekday(weekdayMatch[1]),
      raw: weekdayMatch[0],
      type: 'relative',
    })
  }

  // "este mes" - first day of current month (for queries)
  if (/\beste\s+mes\b/i.test(text)) {
    const now = new Date()
    results.push({
      value: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`,
      raw: 'este mes',
      type: 'relative',
    })
  }

  // "mes pasado" / "el mes pasado"
  if (/\b(?:el\s+)?mes\s+pasado\b/i.test(text)) {
    const now = new Date()
    now.setMonth(now.getMonth() - 1)
    results.push({
      value: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`,
      raw: 'mes pasado',
      type: 'relative',
    })
  }

  return results
}

// --- Period Detection (for queries) ---

export function detectPeriod(text: string): string {
  const lower = text.toLowerCase()
  if (/\bhoy\b/.test(lower)) return 'today'
  if (/\bayer\b/.test(lower)) return 'yesterday'
  if (/\besta\s+semana\b/.test(lower)) return 'this_week'
  if (/\bsemana\s+pasada\b/.test(lower)) return 'last_week'
  if (/\beste\s+mes\b/.test(lower)) return 'this_month'
  if (/\b(?:el\s+)?mes\s+pasado\b/.test(lower)) return 'last_month'
  if (/\beste\s+a[ñn]o\b/.test(lower)) return 'this_year'
  if (/\b(?:el\s+)?a[ñn]o\s+pasado\b/.test(lower)) return 'last_year'
  // Default to this month for most queries
  return 'this_month'
}

// --- Extract description/merchant from text after removing known tokens ---

export function extractDescription(text: string, knownTokens: string[]): string {
  let remaining = text.toLowerCase()

  // Remove known tokens and patterns
  for (const token of knownTokens) {
    remaining = remaining.replace(new RegExp(escapeRegex(token), 'gi'), '')
  }

  // Remove common command words
  const commandWords = [
    'agrega', 'agregá', 'agregar', 'nuevo', 'nueva', 'crear', 'crea', 'creá',
    'un', 'una', 'de', 'del', 'en', 'por', 'para', 'con', 'al', 'a', 'el', 'la', 'los', 'las',
    'gasto', 'ingreso', 'ahorro', 'meta', 'recordatorio', 'recordame', 'recordar',
    'lista', 'compras', 'compra',
    'pesos', 'ars', 'usd', 'dolares', 'dólares', 'dólar', 'dolar',
    'hoy', 'ayer', 'mañana',
    'tarjeta', 'efectivo', 'debito', 'débito', 'credito', 'crédito',
  ]

  for (const word of commandWords) {
    remaining = remaining.replace(new RegExp(`\\b${escapeRegex(word)}\\b`, 'gi'), '')
  }

  // Remove amounts
  remaining = remaining.replace(/\$?\s*[\d.,]+\s*k?\b/g, '')

  // Remove date patterns
  remaining = remaining.replace(/(?:el|dia|día)\s+\d{1,2}/gi, '')

  // Clean up
  remaining = remaining.replace(/\s+/g, ' ').trim()

  // Capitalize first letter
  if (remaining.length > 0) {
    remaining = remaining.charAt(0).toUpperCase() + remaining.slice(1)
  }

  return remaining
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// --- Recurrence Detection ---

export interface RecurrenceRule {
  type: 'monthly' | 'weekly'
  dayOfMonth?: number
  dayOfWeek?: string
}

export function detectRecurrence(text: string): RecurrenceRule | null {
  const lower = text.toLowerCase()

  // "todos los meses el 10"
  const monthlyMatch = lower.match(/todos?\s+los?\s+meses?\s+(?:el\s+)?(\d{1,2})/)
  if (monthlyMatch) {
    return { type: 'monthly', dayOfMonth: parseInt(monthlyMatch[1], 10) }
  }

  // "cada mes el 10"
  const cadaMesMatch = lower.match(/cada\s+mes\s+(?:el\s+)?(\d{1,2})/)
  if (cadaMesMatch) {
    return { type: 'monthly', dayOfMonth: parseInt(cadaMesMatch[1], 10) }
  }

  // "cada lunes" / "todos los lunes"
  const weeklyMatch = lower.match(/(?:cada|todos?\s+los?)\s+(lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)/)
  if (weeklyMatch) {
    return { type: 'weekly', dayOfWeek: weeklyMatch[1] }
  }

  return null
}
