export interface Profile {
  id: string
  email: string
  nombre: string
  budget_ars: number
  budget_usd: number
  ahorro_pesos: number
  ahorro_usd: number
  ingresos_habilitado?: boolean
  personal_workspace_name?: string
  personal_workspace_icono?: string | null
  personal_workspace_logo?: string | null // data URL (PNG/JPG/WebP)
  // Emails
  welcome_email_sent?: boolean
  welcome_email_sent_at?: string
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
  vencimiento: number | null // Día de vencimiento de pago
  notificar_cierre: boolean // Recibir notificación de cierre
  notificar_vencimiento: boolean // Recibir notificación de vencimiento
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
  fecha_pago?: string
  medio_pago?: string
  comprobante_url?: string
  comprobante_nombre?: string
  created_at: string
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
  fecha_limite?: string
  created_at: string
  created_by?: string // ID del usuario que creó la meta (en workspace)
  workspace_id?: string
}

export interface MovimientoAhorro {
  id: string
  user_id: string
  tipo: 'pesos' | 'usd'
  monto: number
  descripcion?: string
  fecha: string
  created_by?: string // ID del usuario que creó el movimiento (en workspace)
  workspace_id?: string
}

export interface MedioPago {
  id: string
  user_id: string
  nombre: string
  created_at: string
}

export interface CategoriaIngreso {
  id: string
  user_id: string
  nombre: string
  icono: string
  color: string
  created_at: string
}

export interface TagIngreso {
  id: string
  user_id: string
  nombre: string
  created_at: string
}

export interface Ingreso {
  id: string
  user_id: string
  categoria_id: string | null
  descripcion: string
  monto: number
  moneda: 'ARS' | 'USD'
  fecha: string
  mes: string
  tag_ids: string[]
  created_at: string
  categoria?: CategoriaIngreso
  tags?: TagIngreso[]
  // Nuevos campos
  pendiente_cobro?: boolean // Si está pendiente de cobro
  fecha_cobro_esperada?: string | null // Fecha esperada de cobro (opcional)
  fecha_cobro_confirmada?: string | null // Fecha en que se confirmó el cobro
  cuenta_bancaria_id?: string | null // ID de la cuenta bancaria o tarjeta de origen
  comprobante_url?: string | null // URL del comprobante (base64)
  comprobante_nombre?: string | null // Nombre del archivo del comprobante
  notificar_celular?: boolean // Si se debe notificar por push/celular
  notificar_correo?: boolean // Si se debe notificar por correo
  es_fijo?: boolean // Si es un ingreso fijo mensual
}

export interface DolarAPI {
  compra: number
  venta: number
  casa: string
  nombre: string
  moneda: string
  fechaActualizacion: string
}

// ============================================
// WORKSPACE TYPES
// ============================================

export type PermissionLevel = 'ninguno' | 'solo_lectura' | 'solo_propios' | 'ver_todo_agregar_propio' | 'admin'

export type WorkspaceSection = 'gastos' | 'ingresos' | 'ahorros' | 'tarjetas'

export interface WorkspacePermissions {
  gastos: PermissionLevel
  ingresos: PermissionLevel
  ahorros: PermissionLevel
  tarjetas: PermissionLevel
}

export interface Workspace {
  id: string
  name: string
  owner_id: string
  icono: string | null // Emoji o URL de imagen para identificar el workspace
  logo?: string | null // data URL (PNG/JPG/WebP)
  ingresos_habilitado?: boolean
  budget_ars?: number
  budget_usd?: number
  created_at: string
}

export interface WorkspaceMember {
  id: string
  workspace_id: string
  user_id: string
  user_email: string
  display_name?: string // Nombre personalizado para mostrar en etiquetas
  permissions: WorkspacePermissions
  created_at: string
}

export interface WorkspaceInvitation {
  id: string
  workspace_id: string
  email: string
  inviter_email?: string  // <--- NUEVO
  workspace_name?: string // <--- NUEVO
  permissions: WorkspacePermissions
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled'
  created_at: string
  workspace?: Workspace
}

// ============================================
// NOTIFICACIONES
// ============================================

export interface Notificacion {
  id: string
  user_id: string
  tipo: 'cierre' | 'vencimiento' | 'presupuesto' | 'sistema'
  titulo: string
  mensaje: string
  icono: string
  leida: boolean
  tarjeta_id?: string | null
  fecha_evento?: string | null // Fecha del cierre/vencimiento
  link?: string | null
  created_at: string
  workspace_id?: string
}
