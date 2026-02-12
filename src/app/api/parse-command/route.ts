import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { text, context } = body

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'No se proporcionó texto' }, { status: 400 })
    }

    const apiKey = process.env.GOOGLE_GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'IA no configurada' }, { status: 500 })
    }

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

    const today = new Date().toISOString().split('T')[0]
    const dayOfWeek = new Date().toLocaleDateString('es-AR', { weekday: 'long' })

    const systemPrompt = `Sos un parser de comandos para una app financiera argentina (FinControl). Tu ÚNICA tarea es interpretar texto en español y devolver SOLAMENTE JSON válido. No agregues texto, explicaciones ni markdown.

FECHA DE HOY: ${today} (${dayOfWeek})

═══════════════════════════════════════
INTENTS DISPONIBLES Y SUS PARÁMETROS:
═══════════════════════════════════════

FINANZAS:
- create_expense: { amount: number, currency: "ARS"|"USD", date: "YYYY-MM-DD", merchant: string, category?: string, payment_method?: string }
- create_income: { amount: number, currency: "ARS"|"USD", date: "YYYY-MM-DD", description: string }
- add_saving: { amount: number, tipo: "pesos"|"usd", description?: string }
- create_goal: { nombre: string, objetivo: number, currency: "ARS"|"USD" }
- contribute_goal: { amount: number, goal_name: string }
- goal_status: { goal_name?: string }

RECORDATORIOS:
- create_reminder: { title: string, date: "YYYY-MM-DD", time?: string, recurrence?: { type: "monthly"|"weekly", dayOfMonth?: number, dayOfWeek?: string } }
- list_reminders: {}

LISTAS DE COMPRAS:
- create_shopping_list: { list_name: string, icon?: string }
- add_shopping_items: { list_name: string, items: [{ name: string, qty?: number, unit?: string }] }
- clear_completed_items: { list_name: string }

CONSULTAS:
- query_expense_total: { period: "today"|"yesterday"|"this_week"|"last_week"|"this_month"|"last_month"|"this_year"|"all", currency?: string, category?: string }
- query_income_total: { period: string }
- query_balance: { period: string }
- query_top_expenses: { period: string, limit?: number }
- query_savings_total: {}
- query_reminders_count: { date?: "YYYY-MM-DD" }

NAVEGACIÓN:
- navigate: { route: string, label: string }
  Rutas válidas: /dashboard, /dashboard/gastos, /dashboard/ingresos, /dashboard/tarjetas, /dashboard/ahorros, /dashboard/proyeccion, /dashboard/recordatorios, /dashboard/listas, /dashboard/config

═══════════════════════════════════════
REGLAS CRÍTICAS:
═══════════════════════════════════════

1. MONEDA: ARS por defecto. USD SOLO si el usuario dice explícitamente "dólares", "usd", "u$s", "dolares"
2. FECHAS: Interpretar relativas a hoy (${today}). "hoy" = ${today}. "ayer" = día anterior. "mañana" = día siguiente. "el 10" = día 10 del mes actual. "el lunes" = próximo lunes.
3. MONTOS ARGENTINOS: "." = separador de miles, "," = decimales. Ej: "2.500" = 2500, "2,50" = 2.50, "2k" = 2000, "$15.000" = 15000
4. MULTI_ACTION: Si el comando tiene 2+ acciones DISTINTAS (ej: "creá una lista de ferretería y agregá clavos"), usar type "multi_action" con array de actions.
   - Importante: "creá una lista de ferretería" es UNA acción (create_shopping_list con list_name "Ferretería"), NO dos.
   - "creá una lista de ferretería y agregá clavos y tornillos" son DOS acciones: crear lista + agregar items.
5. CONFIANZA: 0.0 a 1.0. Si algo es ambiguo (ej: "cafe" puede ser gasto o item de lista), bajar confidence y agregar needs_clarification.
6. NOMBRES DE LISTA: Extraer SOLO el nombre propio de la lista. Ej: "lista de ferretería" → list_name: "Ferretería" (no "de ferretería").
7. ITEMS: Separar items por "y", comas, o conectores. Ej: "clavos y tornillos" → [{ name: "Clavos" }, { name: "Tornillos" }]
8. Si NO entendés el comando, devolver intent "navigate" con confidence 0 y needs_clarification.
${context?.categories ? `\nCATEGORÍAS DE GASTOS DISPONIBLES: ${context.categories.join(', ')}` : ''}
${context?.shoppingLists ? `\nLISTAS DE COMPRAS EXISTENTES: ${context.shoppingLists.join(', ')}` : ''}
${context?.goals ? `\nMETAS DE AHORRO EXISTENTES: ${context.goals.join(', ')}` : ''}

═══════════════════════════════════════
FORMATO DE SALIDA (SOLO JSON, sin markdown):
═══════════════════════════════════════

Acción simple:
{"type":"action","intent":"create_expense","confidence":0.95,"params":{"amount":2000,"currency":"ARS","date":"${today}","merchant":"Carrefour"},"needs_clarification":[],"suggested_followups":["cuanto gaste este mes"],"raw_input":"gasto 2000 carrefour"}

Múltiples acciones:
{"type":"multi_action","intent":"multi_action","confidence":0.90,"params":{},"actions":[{"type":"action","intent":"create_shopping_list","confidence":0.95,"params":{"list_name":"Ferretería","icon":"🔧"},"needs_clarification":[],"suggested_followups":[],"raw_input":""},{"type":"action","intent":"add_shopping_items","confidence":0.95,"params":{"list_name":"Ferretería","items":[{"name":"Clavos","qty":1,"unit":"u"}]},"needs_clarification":[],"suggested_followups":[],"raw_input":""}],"needs_clarification":[],"suggested_followups":["agrega tornillos a la lista de ferretería"],"raw_input":"crea una lista de ferretería y agrega clavos"}

Consulta:
{"type":"query","intent":"query_balance","confidence":0.95,"params":{"period":"this_month"},"needs_clarification":[],"suggested_followups":["cuanto gaste este mes","top 5 gastos"],"raw_input":"balance del mes"}`

    const result = await model.generateContent([
      { text: systemPrompt },
      { text: `Comando del usuario: "${text}"` },
    ])

    const responseText = result.response.text().trim()

    // Parse the JSON response
    let parsed
    try {
      // Remove potential markdown code block markers
      const cleanJson = responseText
        .replace(/^```json?\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim()
      parsed = JSON.parse(cleanJson)
    } catch {
      console.error('[parse-command] Failed to parse AI response:', responseText)
      return NextResponse.json({
        type: 'action',
        intent: 'navigate',
        confidence: 0,
        params: {},
        needs_clarification: [{ field: 'intent', message: 'No pude procesar el comando. Probá con algo como "gasto 2000 Carrefour" o "balance del mes".' }],
        suggested_followups: [],
        raw_input: text,
      })
    }

    // Ensure raw_input is set correctly
    if (!parsed.raw_input || parsed.raw_input === '...') {
      parsed.raw_input = text
    }
    if (parsed.actions) {
      for (const a of parsed.actions) {
        if (!a.raw_input || a.raw_input === '...') a.raw_input = text
        // Ensure sub-actions have required fields
        a.needs_clarification = a.needs_clarification || []
        a.suggested_followups = a.suggested_followups || []
        a.params = a.params || {}
      }
    }

    // Ensure top-level fields
    parsed.needs_clarification = parsed.needs_clarification || []
    parsed.suggested_followups = parsed.suggested_followups || []
    parsed.params = parsed.params || {}

    return NextResponse.json(parsed)
  } catch (error: any) {
    console.error('[parse-command] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Error interno' },
      { status: 500 }
    )
  }
}
