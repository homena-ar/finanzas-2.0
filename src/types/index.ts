export interface Profile {
  id: string
  email: string
  nombre: string
  budget_ars: number
  budget_usd: number
  ahorro_pesos: number
  ahorro_usd: number
  created_at: string
}

export interface Tarjeta {
  id: string
  user_id: string
  nombre: string
  tipo: 'visa' | 'mastercard' | 'amex' | 'other'
  banco: string | null
  digitos: string | null
  cierre: number | null
  created_at: string
}

export interface Categoria {
  id: string
  user_id: string
  nombre: string
  icono: string
  color: string
  created_at: string
}

export interface Tag {
  id: string
  user_id: string
  nombre: string
  created_at: string
}

export interface Gasto {
  id: string
  user_id: string
  tarjeta_id: string | null
  categoria_id: string | null
  descripcion: string
  monto: number
  moneda: 'ARS' | 'USD'
  cuotas: number
  cuota_actual: number
  fecha: string
  mes_facturacion: string
  es_fijo: boolean
  tag_ids: string[]
  pagado: boolean
  created_at: string
  // Relaciones
  tarjeta?: Tarjeta
  categoria?: Categoria
  tags?: Tag[]
}

export interface Impuesto {
  id: string
  user_id: string
  tarjeta_id: string | null
  descripcion: string
  monto: number
  mes: string
  created_at: string
  tarjeta?: Tarjeta
}

export interface Meta {
  id: string
  user_id: string
  nombre: string
  icono: string
  objetivo: number
  progreso: number
  moneda: 'ARS' | 'USD'
  completada: boolean
  created_at: string
}

export interface MovimientoAhorro {
  id: string
  user_id: string
  tipo: 'pesos' | 'usd'
  monto: number
  descripcion?: string
  fecha: string
}

export interface DolarAPI {
  compra: number
  venta: number
  casa: string
  nombre: string
  moneda: string
  fechaActualizacion: string
}
