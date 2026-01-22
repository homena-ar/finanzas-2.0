export function formatMoney(amount: number, currency: 'ARS' | 'USD' = 'ARS'): string {
  // Redondear pesos, mantener decimales en USD
  const rounded = currency === 'ARS' ? Math.round(amount) : amount
  const formatted = Math.abs(rounded).toLocaleString('es-AR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: currency === 'ARS' ? 0 : 2
  })
  return currency === 'USD' ? `U$S ${formatted}` : `$ ${formatted}`
}

export function getMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export function getMonthName(date: Date): string {
  const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
                  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
  return `${months[date.getMonth()]} ${date.getFullYear()}`
}

export function parseMonthKey(key: string): Date {
  const [year, month] = key.split('-').map(Number)
  return new Date(year, month - 1, 1)
}

/**
 * Parsea una fecha en formato YYYY-MM-DD de forma segura, sin problemas de timezone.
 * Crea un Date en timezone local para evitar que se corra al día anterior.
 * 
 * @param dateStr - Fecha en formato YYYY-MM-DD
 * @returns Date object en timezone local
 */
export function parseDateSafe(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number)
  // Crear Date en timezone local (no UTC) para evitar corrimientos
  return new Date(year, month - 1, day)
}

/**
 * Extrae el mes (YYYY-MM) de una fecha en formato YYYY-MM-DD sin usar Date,
 * evitando problemas de timezone.
 * 
 * @param dateStr - Fecha en formato YYYY-MM-DD
 * @returns Mes en formato YYYY-MM
 */
export function getMonthFromDateString(dateStr: string): string {
  // Si ya está en formato YYYY-MM-DD, extraer directamente
  if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return dateStr.substring(0, 7) // Retorna YYYY-MM
  }
  // Si no, intentar parsear de forma segura
  const date = parseDateSafe(dateStr)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

/**
 * Convierte una fecha a formato YYYY-MM-DD de forma segura, sin problemas de timezone.
 * Si la fecha viene como string YYYY-MM-DD, la retorna directamente.
 * Si viene en otro formato, la parsea de forma segura.
 * 
 * @param dateInput - Fecha como string o Date
 * @returns Fecha en formato YYYY-MM-DD
 */
export function formatDateSafe(dateInput: string | Date): string {
  if (typeof dateInput === 'string') {
    // Si ya está en formato YYYY-MM-DD, retornar directamente
    if (dateInput.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return dateInput
    }
    // Si no, parsear de forma segura
    const date = parseDateSafe(dateInput)
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  } else {
    // Si es Date, formatear en timezone local
    return `${dateInput.getFullYear()}-${String(dateInput.getMonth() + 1).padStart(2, '0')}-${String(dateInput.getDate()).padStart(2, '0')}`
  }
}

export function getCategoryIcon(nombre: string): string {
  const icons: Record<string, string> = {
    'Supermercado': '🛒',
    'Transporte': '🚗',
    'Comida': '🍔',
    'Servicios': '📞',
    'Suscripción': '📱',
    'Compras': '🛍️',
    'Trabajo': '💼',
    'Otros': '💰'
  }
  return icons[nombre] || '💰'
}

export function getCardTypeClass(tipo: string): string {
  const classes: Record<string, string> = {
    'visa': 'bg-gradient-to-br from-blue-800 to-blue-500',
    'mastercard': 'bg-gradient-to-br from-red-800 to-red-500',
    'amex': 'bg-gradient-to-br from-emerald-800 to-emerald-500',
    'other': 'bg-gradient-to-br from-slate-700 to-slate-500'
  }
  return classes[tipo] || classes.other
}

export function getTagClass(tipo: string): string {
  const classes: Record<string, string> = {
    'visa': 'bg-blue-100 text-blue-700',
    'mastercard': 'bg-red-100 text-red-700',
    'amex': 'bg-emerald-100 text-emerald-700',
    'other': 'bg-slate-100 text-slate-700'
  }
  return classes[tipo] || classes.other
}

export async function fetchDolar(): Promise<number> {
  try {
    const res = await fetch('https://dolarapi.com/v1/dolares/oficial')
    const data = await res.json()
    return data.venta || 1050
  } catch {
    return 1050
  }
}

/**
 * Detecta si el dispositivo es mobile (tablet o teléfono)
 * @returns true si es mobile, false si es desktop
 */
export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false
  
  // Verificar por user agent
  const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera
  const mobileRegex = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i
  const isMobileUA = mobileRegex.test(userAgent.toLowerCase())
  
  // Verificar por tamaño de pantalla (más confiable en algunos casos)
  const isMobileScreen = window.innerWidth <= 768
  
  // Verificar por touch support (dispositivos táctiles)
  const hasTouchScreen = 'ontouchstart' in window || navigator.maxTouchPoints > 0
  
  // Es mobile si: (user agent indica mobile) O (pantalla pequeña Y tiene touch)
  return isMobileUA || (isMobileScreen && hasTouchScreen)
}

/**
 * Gestión de preferencias de notificaciones en localStorage
 */
const NOTIFICATION_KEYS = {
  PROMPT_DISMISSED: 'fincontrol:notification_prompt_dismissed',
  ENABLED: 'fincontrol:notifications_enabled',
  DENIED: 'fincontrol:notifications_denied',
} as const

const NOTIFICATION_COOLDOWN_DAYS = 30
const NOTIFICATION_COOLDOWN_MS = 1000 * 60 * 60 * 24 * NOTIFICATION_COOLDOWN_DAYS

export const notificationPreferences = {
  /**
   * Verifica si el usuario cerró el banner (dismissed)
   */
  isDismissed(): boolean {
    if (typeof window === 'undefined') return false
    try {
      const dismissedAt = localStorage.getItem(NOTIFICATION_KEYS.PROMPT_DISMISSED)
      if (!dismissedAt) return false
      const timestamp = Number(dismissedAt)
      if (!Number.isFinite(timestamp)) return false
      // Si pasó el cooldown, permitir mostrar de nuevo
      return Date.now() - timestamp < NOTIFICATION_COOLDOWN_MS
    } catch {
      return false
    }
  },

  /**
   * Marca el banner como cerrado (dismissed)
   */
  setDismissed(): void {
    if (typeof window === 'undefined') return
    try {
      localStorage.setItem(NOTIFICATION_KEYS.PROMPT_DISMISSED, String(Date.now()))
    } catch {
      // ignore
    }
  },

  /**
   * Verifica si las notificaciones están habilitadas
   */
  isEnabled(): boolean {
    if (typeof window === 'undefined') return false
    try {
      return localStorage.getItem(NOTIFICATION_KEYS.ENABLED) === 'true'
    } catch {
      return false
    }
  },

  /**
   * Marca las notificaciones como habilitadas
   */
  setEnabled(): void {
    if (typeof window === 'undefined') return
    try {
      localStorage.setItem(NOTIFICATION_KEYS.ENABLED, 'true')
      // Limpiar otros estados
      localStorage.removeItem(NOTIFICATION_KEYS.PROMPT_DISMISSED)
      localStorage.removeItem(NOTIFICATION_KEYS.DENIED)
    } catch {
      // ignore
    }
  },

  /**
   * Verifica si el usuario rechazó las notificaciones
   */
  isDenied(): boolean {
    if (typeof window === 'undefined') return false
    try {
      return localStorage.getItem(NOTIFICATION_KEYS.DENIED) === 'true'
    } catch {
      return false
    }
  },

  /**
   * Marca las notificaciones como rechazadas
   */
  setDenied(): void {
    if (typeof window === 'undefined') return
    try {
      localStorage.setItem(NOTIFICATION_KEYS.DENIED, 'true')
      // Limpiar otros estados
      localStorage.removeItem(NOTIFICATION_KEYS.PROMPT_DISMISSED)
    } catch {
      // ignore
    }
  },

  /**
   * Verifica si se debe mostrar el banner
   */
  shouldShow(): boolean {
    return !this.isDismissed() && !this.isEnabled() && !this.isDenied()
  },
}

/**
 * Gestión de preferencias de PWA install en localStorage
 */
const PWA_KEYS = {
  PROMPT_DISMISSED: 'fincontrol:pwa_prompt_dismissed',
  INSTALLED: 'fincontrol:pwa_installed',
} as const

const PWA_COOLDOWN_DAYS = 30
const PWA_COOLDOWN_MS = 1000 * 60 * 60 * 24 * PWA_COOLDOWN_DAYS

export const pwaPreferences = {
  /**
   * Verifica si el usuario cerró el banner (dismissed)
   */
  isDismissed(): boolean {
    if (typeof window === 'undefined') return true
    try {
      const dismissedAt = localStorage.getItem(PWA_KEYS.PROMPT_DISMISSED)
      if (!dismissedAt) return false
      const timestamp = Number(dismissedAt)
      if (!Number.isFinite(timestamp)) return false
      // Si pasó el cooldown, permitir mostrar de nuevo
      return Date.now() - timestamp < PWA_COOLDOWN_MS
    } catch {
      return false
    }
  },

  /**
   * Marca el banner como cerrado (dismissed)
   */
  setDismissed(): void {
    if (typeof window === 'undefined') return
    try {
      localStorage.setItem(PWA_KEYS.PROMPT_DISMISSED, String(Date.now()))
    } catch {
      // ignore
    }
  },

  /**
   * Verifica si la PWA está instalada (según preferencias guardadas)
   */
  isInstalled(): boolean {
    if (typeof window === 'undefined') return false
    try {
      return localStorage.getItem(PWA_KEYS.INSTALLED) === 'true'
    } catch {
      return false
    }
  },

  /**
   * Marca la PWA como instalada
   */
  setInstalled(): void {
    if (typeof window === 'undefined') return
    try {
      localStorage.setItem(PWA_KEYS.INSTALLED, 'true')
      // Limpiar otros estados
      localStorage.removeItem(PWA_KEYS.PROMPT_DISMISSED)
    } catch {
      // ignore
    }
  },

  /**
   * Verifica si se debe mostrar el banner
   */
  shouldShow(): boolean {
    return !this.isDismissed() && !this.isInstalled()
  },
}
