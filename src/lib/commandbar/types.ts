// ============================================
// COMMAND BAR - TYPE DEFINITIONS
// ============================================

// --- Intent Catalog ---

export type FinanceIntent =
  | 'create_expense'
  | 'update_expense'
  | 'delete_expense'
  | 'create_income'
  | 'update_income'
  | 'delete_income'
  | 'add_saving'
  | 'withdraw_saving'
  | 'create_goal'
  | 'contribute_goal'
  | 'goal_status'

export type ReminderIntent =
  | 'create_reminder'
  | 'update_reminder'
  | 'delete_reminder'
  | 'list_reminders'

export type ShoppingListIntent =
  | 'create_shopping_list'
  | 'add_shopping_items'
  | 'update_shopping_item'
  | 'delete_shopping_item'
  | 'duplicate_shopping_list'
  | 'rename_shopping_list'
  | 'clear_completed_items'
  | 'sort_shopping_list'
  | 'shopping_list_summary'

export type QueryIntent =
  | 'query_income_total'
  | 'query_expense_total'
  | 'query_balance'
  | 'query_top_expenses'
  | 'query_savings_total'
  | 'query_goal_progress'
  | 'query_reminders_count'

export type NavigationIntent =
  | 'navigate'

export type CommandIntent =
  | FinanceIntent
  | ReminderIntent
  | ShoppingListIntent
  | QueryIntent
  | NavigationIntent

// --- Parsed Result ---

export type CommandType = 'action' | 'query' | 'navigation'

export interface ParsedCommand {
  type: CommandType
  intent: CommandIntent
  confidence: number
  params: Record<string, any>
  needs_clarification: ClarificationField[]
  suggested_followups: string[]
  raw_input: string
}

export interface ClarificationField {
  field: string
  message: string
  options?: ClarificationOption[]
}

export interface ClarificationOption {
  label: string
  value: any
}

// --- Execution Result ---

export interface CommandResult {
  success: boolean
  message: string
  data?: any
  undo_action?: UndoAction
  navigate_to?: string
}

export interface UndoAction {
  label: string
  execute: () => Promise<void>
}

// --- Command History ---

export interface CommandHistoryEntry {
  id: string
  input: string
  parsed: ParsedCommand | null
  result: CommandResult | null
  timestamp: number
}

// --- Preprocessor Output ---

export interface PreprocessedInput {
  normalized: string
  original: string
  amounts: ParsedAmount[]
  currency: 'ARS' | 'USD' | null
  dates: ParsedDate[]
  tokens: string[]
}

export interface ParsedAmount {
  value: number
  raw: string
  position: number
}

export interface ParsedDate {
  value: string // YYYY-MM-DD
  raw: string
  type: 'absolute' | 'relative'
}

// --- Period for queries ---

export type QueryPeriod =
  | 'today'
  | 'yesterday'
  | 'this_week'
  | 'last_week'
  | 'this_month'
  | 'last_month'
  | 'this_year'
  | 'last_year'
  | 'all'

// --- Command Bar State ---

export interface CommandBarState {
  isOpen: boolean
  input: string
  loading: boolean
  history: CommandHistoryEntry[]
  lastResult: CommandResult | null
  clarification: ClarificationField[] | null
  pendingCommand: ParsedCommand | null
}

// --- Corrections Dictionary ---

export type CorrectionsDictionary = Record<string, string>

// --- Metrics ---

export interface CommandMetrics {
  totalCommands: number
  resolvedLocally: number
  resolvedByAI: number
  failedCommands: number
  intentCounts: Record<string, number>
}
