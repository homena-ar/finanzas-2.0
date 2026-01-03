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
