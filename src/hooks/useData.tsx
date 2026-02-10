'use client'

import { useState, useEffect, useCallback, useRef, createContext, useContext, ReactNode } from 'react'
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  orderBy,
  Timestamp
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from './useAuth'
import { useWorkspace } from './useWorkspace'
import { MovimientoAhorro, Meta, Tarjeta, Gasto, Impuesto, Categoria, Tag, MedioPago, Ingreso, CategoriaIngreso, TagIngreso, WorkspacePermissions } from '@/types'

type DataContextType = {
  movimientos: MovimientoAhorro[]
  metas: Meta[]
  tarjetas: Tarjeta[]
  gastos: Gasto[]
  impuestos: Impuesto[]
  categorias: Categoria[]
  tags: Tag[]
  mediosPago: MedioPago[]
  ingresos: Ingreso[]
  categoriasIngresos: CategoriaIngreso[]
  tagsIngresos: TagIngreso[]
  loading: boolean
  currentMonth: Date
  monthKey: string
  fetchAll: () => Promise<void>
  changeMonth: (delta: number) => void
  addMovimiento: (tipo: 'pesos' | 'usd', monto: number, descripcion?: string) => Promise<{ error: any }>
  updateMovimiento: (id: string, data: any) => Promise<{ error: any }>
  deleteMovimiento: (id: string) => Promise<{ error: any }>
  addMeta: (data: any) => Promise<{ error: any }>
  updateMeta: (id: string, data: any) => Promise<{ error: any }>
  deleteMeta: (id: string) => Promise<{ error: any }>
  addTag: (nombre: string) => Promise<{ error: any }>
  deleteTag: (id: string) => Promise<{ error: any }>
    addCategoria: (data: any) => Promise<{ error: any; id?: string }>
  updateCategoria: (id: string, data: any) => Promise<{ error: any }>
  deleteCategoria: (id: string) => Promise<{ error: any }>
  addGasto: (data: any) => Promise<{ error: any, data?: Gasto }>
  updateGasto: (id: string, data: any) => Promise<{ error: any }>
  deleteGasto: (id: string) => Promise<{ error: any }>
  addTarjeta: (data: any) => Promise<{ error: any; id?: string }>
  updateTarjeta: (id: string, data: any) => Promise<{ error: any }>
  deleteTarjeta: (id: string) => Promise<{ error: any }>
  addImpuesto: (data: any) => Promise<{ error: any }>
  updateImpuesto: (id: string, data: any) => Promise<{ error: any }>
  deleteImpuesto: (id: string) => Promise<{ error: any }>
  addMedioPago: (nombre: string) => Promise<{ error: any }>
  deleteMedioPago: (id: string) => Promise<{ error: any }>
  addIngreso: (data: any) => Promise<{ error: any, data?: Ingreso }>
  updateIngreso: (id: string, data: any) => Promise<{ error: any }>
  deleteIngreso: (id: string) => Promise<{ error: any }>
  addTagIngreso: (nombre: string) => Promise<{ error: any }>
  deleteTagIngreso: (id: string) => Promise<{ error: any }>
  addCategoriaIngreso: (data: any) => Promise<{ error: any; id?: string }>
  updateCategoriaIngreso: (id: string, data: any) => Promise<{ error: any }>
  deleteCategoriaIngreso: (id: string) => Promise<{ error: any }>
  getIngresosMes: (mes: string) => Ingreso[]
  getGastosMes: (mes: string) => Gasto[]
  getImpuestosMes: (mes: string) => Impuesto[]
  getGastosNoProximoMes: (mesActual: string) => any
  getDiferenciaMeses: (mesActual: string, dolar: number) => any
}

const DataContext = createContext<DataContextType | undefined>(undefined)

export function DataProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth()
  const { currentWorkspace, initWorkspaceReady } = useWorkspace()

  // Debug render log removed to reduce console noise during workspace switch

  const [movimientos, setMovimientos] = useState<MovimientoAhorro[]>([])
  const [metas, setMetas] = useState<Meta[]>([])
  const [tarjetas, setTarjetas] = useState<Tarjeta[]>([])
  const [gastos, setGastos] = useState<Gasto[]>([])
  const [impuestos, setImpuestos] = useState<Impuesto[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [mediosPago, setMediosPago] = useState<MedioPago[]>([])
  const [ingresos, setIngresos] = useState<Ingreso[]>([])
  const [categoriasIngresos, setCategoriasIngresos] = useState<CategoriaIngreso[]>([])
  const [tagsIngresos, setTagsIngresos] = useState<TagIngreso[]>([])
  const [loading, setLoading] = useState(true)
  // Siempre inicializar al mes actual, no usar el mes guardado
  const [currentMonth, setCurrentMonth] = useState(() => {
    const today = new Date()
    // Establecer al primer día del mes actual para consistencia
    return new Date(today.getFullYear(), today.getMonth(), 1)
  })

  const monthKey = currentMonth.toISOString().slice(0, 7)

  // Actualizar al mes actual cuando se carga la página (solo una vez al inicio)
  useEffect(() => {
    if (typeof window !== 'undefined' && !authLoading && user) {
      const today = new Date()
      const currentMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
      const currentMonthDate = new Date(today.getFullYear(), today.getMonth(), 1)
      
      // Comparar el mes actual con el que estamos viendo
      const viewingMonthKey = currentMonth.toISOString().slice(0, 7)
      
      // Si el mes actual es diferente al que estamos viendo, actualizar al mes actual
      if (viewingMonthKey !== currentMonthKey) {
        setCurrentMonth(currentMonthDate)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user]) // Solo ejecutar cuando termine de cargar la autenticación y haya usuario

  useEffect(() => {
    if (typeof window !== 'undefined' && monthKey) {
      try {
        // Validar que monthKey sea válido antes de guardar
        const dateMatch = monthKey.match(/^\d{4}-\d{2}$/)
        if (dateMatch) {
          const testDate = new Date(monthKey + '-01')
          if (!isNaN(testDate.getTime())) {
            localStorage.setItem('lastViewedMonth', monthKey)
          }
        }
      } catch (e) {
        console.error('Error saving month to localStorage:', e)
      }
    }
  }, [monthKey])

  // --- FUNCIÓN FETCHALL PRINCIPAL ---
  // clearFirst: solo true al cambiar de workspace/usuario, false en CRUD (evita flash vacío)
  const fetchAllInternal = useCallback(async (clearFirst: boolean) => {
    // Usar el workspace del closure (no el ref mutable) para evitar race conditions
    const latestWorkspace = currentWorkspace
    const fetchForWorkspaceId = latestWorkspace?.id || null

    console.log('📊 [useData] fetchAll -', {
      userId: user?.uid,
      workspaceId: latestWorkspace?.id,
      clearFirst
    })

    // NO limpiar datos antes del fetch - se reemplazan atómicamente al recibir resultados
    // Esto evita el flash de "datos vacíos" durante la carga
    setLoading(true)
    try {
      if (!user || !user.uid) {
        console.warn('📊 [Firebase useData] No user or user.uid, aborting fetchAll')
        setLoading(false)
        return
      }

      console.log('📊 [Firebase useData] Fetching data for workspace:', latestWorkspace?.name || 'Personal', {
        workspaceId: latestWorkspace?.id,
        userId: user.uid
      })
      const startTime = Date.now()

      // Validar que latestWorkspace tenga id válido antes de usarlo
      const isWorkspaceMode = latestWorkspace !== null && 
                              latestWorkspace.id !== undefined && 
                              latestWorkspace.id !== null &&
                              typeof latestWorkspace.id === 'string' &&
                              latestWorkspace.id.length > 0
      
      console.log('📊 [Firebase useData] Workspace mode:', {
        isWorkspaceMode,
        latestWorkspace: latestWorkspace ? {
          id: latestWorkspace.id,
          name: latestWorkspace.name,
          owner_id: latestWorkspace.owner_id
        } : null
      })
      
      const workspaceFilter = isWorkspaceMode && latestWorkspace?.id
        ? where('workspace_id', '==', latestWorkspace.id)
        : where('user_id', '==', user.uid)
      
      console.log('📊 [Firebase useData] Workspace filter type:', isWorkspaceMode ? 'workspace_id' : 'user_id')

      // 2. OBTENER PERMISOS
      let permissions: WorkspacePermissions = { 
        gastos: 'admin', 
        ingresos: 'admin', 
        ahorros: 'admin', 
        tarjetas: 'admin' 
      };

      // Determinar si el usuario es dueño del workspace (para usar en toda la función)
        const isOwner = isWorkspaceMode && latestWorkspace?.id && latestWorkspace.owner_id === user.uid

      if (isWorkspaceMode && latestWorkspace?.id) {
        // Si el usuario es el dueño del workspace, tiene permisos de admin automáticamente
        
        if (isOwner) {
          // El dueño siempre tiene permisos de admin
          permissions = { gastos: 'admin', ingresos: 'admin', ahorros: 'admin', tarjetas: 'admin' };
          console.log('🔒 [useData] Usuario es dueño - Permisos admin aplicados');
        } else {
          // Si no es dueño, verificar permisos en workspace_members
          try {
            const memberQuery = query(
              collection(db, 'workspace_members'),
              where('workspace_id', '==', latestWorkspace.id),
              where('user_id', '==', user.uid)
            );
            const memberSnap = await getDocs(memberQuery);
            
            if (!memberSnap.empty) {
              permissions = memberSnap.docs[0].data().permissions as WorkspacePermissions;
              console.log('🔒 [useData] Permisos aplicados:', permissions);
            } else {
              // Si no hay ficha, asumimos 'ninguno' por seguridad
              permissions = { gastos: 'ninguno', ingresos: 'ninguno', ahorros: 'ninguno', tarjetas: 'ninguno' };
              console.log('🔒 [useData] No se encontró registro de miembro - Permisos: ninguno');
            }
          } catch (e) {
            console.error('Error fetching permissions', e);
            // En caso de error, asumimos 'ninguno' por seguridad
            permissions = { gastos: 'ninguno', ingresos: 'ninguno', ahorros: 'ninguno', tarjetas: 'ninguno' };
          }
        }
      }

      // --- FETCH PARALELO DE TODAS LAS COLECCIONES ---
      // Preparar todas las queries independientes
      const queries: Record<string, ReturnType<typeof getDocs> | null> = {}

      if (permissions.ahorros !== 'ninguno') {
        queries.movimientos = getDocs(query(collection(db, 'movimientos_ahorro'), workspaceFilter, orderBy('created_at', 'desc')))
        queries.metas = getDocs(query(collection(db, 'metas'), workspaceFilter, orderBy('created_at', 'desc')))
      }
      if (permissions.tarjetas !== 'ninguno') {
        queries.tarjetas = getDocs(query(collection(db, 'tarjetas'), workspaceFilter, orderBy('created_at', 'desc')))
      }
      if (permissions.gastos !== 'ninguno') {
        queries.gastos = getDocs(query(collection(db, 'gastos'), workspaceFilter, orderBy('created_at', 'desc')))
        queries.impuestos = getDocs(query(collection(db, 'impuestos'), workspaceFilter, orderBy('created_at', 'desc')))
      }
      if (permissions.ingresos !== 'ninguno') {
        queries.ingresos = getDocs(query(collection(db, 'ingresos'), workspaceFilter, orderBy('created_at', 'desc')))
      }
      queries.categorias = getDocs(query(collection(db, 'categorias'), workspaceFilter, orderBy('created_at', 'desc')))
      queries.tags = getDocs(query(collection(db, 'tags'), workspaceFilter, orderBy('created_at', 'desc')))
      queries.mediosPago = getDocs(query(collection(db, 'medios_pago'), workspaceFilter, orderBy('created_at', 'desc')))
      queries.categoriasIngresos = getDocs(query(collection(db, 'categorias_ingresos'), workspaceFilter, orderBy('created_at', 'desc')))
      queries.tagsIngresos = getDocs(query(collection(db, 'tags_ingresos'), workspaceFilter, orderBy('created_at', 'desc')))

      // Ejecutar todas en paralelo
      const keys = Object.keys(queries)
      const promises = Object.values(queries).filter(Boolean) as Promise<any>[]
      const results = await Promise.allSettled(promises)

      // Mapear resultados por nombre
      const snaps: Record<string, any> = {}
      let resultIdx = 0
      for (const key of keys) {
        if (queries[key]) {
          const r = results[resultIdx++]
          if (r.status === 'fulfilled') {
            snaps[key] = r.value
          } else {
            console.error(`❌ [Firebase useData] Error fetching ${key}:`, r.reason?.message)
          }
        }
      }

      console.log('📊 [useData] Fetch complete:', Object.keys(snaps).map(k => `${k}: ${snaps[k]?.docs?.length ?? 0}`).join(', '))

      // Staleness guard: if workspace changed during async fetch, discard results
      if (currentWorkspaceIdRef.current !== fetchForWorkspaceId) {
        console.log('⚠️ [useData] Workspace changed during fetch, discarding stale results')
        setLoading(false)
        return
      }

      // --- PROCESAR RESULTADOS ---

      // Movimientos
      if (snaps.movimientos) {
        let movimientosData = snaps.movimientos.docs.map((doc: any) => {
          const data = doc.data()
          let fecha: string
          if (data.created_at instanceof Timestamp) {
            fecha = data.created_at.toDate().toISOString()
          } else if (typeof data.created_at === 'string') {
            fecha = data.created_at
          } else {
            fecha = new Date().toISOString()
          }
          return { id: doc.id, tipo: data.tipo, monto: data.monto, user_id: data.user_id, fecha, descripcion: data.descripcion, created_by: data.created_by, workspace_id: data.workspace_id } as MovimientoAhorro
        })
        if (isWorkspaceMode && permissions.ahorros === 'solo_propios') {
          movimientosData = movimientosData.filter((m: MovimientoAhorro) => m.user_id === user.uid)
        }
        setMovimientos(movimientosData)
      }

      // Metas
      if (snaps.metas) {
        let metasData = snaps.metas.docs.map((doc: any) => {
          const data = doc.data()
          return { id: doc.id, user_id: data.user_id, nombre: data.nombre, icono: data.icono, objetivo: data.objetivo, progreso: data.progreso, moneda: data.moneda, completada: data.completada || false, fecha_limite: data.fecha_limite || null, created_at: data.created_at instanceof Timestamp ? data.created_at.toDate().toISOString() : data.created_at, created_by: data.created_by, workspace_id: data.workspace_id }
        }) as Meta[]
        if (isWorkspaceMode && permissions.ahorros === 'solo_propios') {
          metasData = metasData.filter(m => m.user_id === user.uid)
        }
        setMetas(metasData)
      }

      // Tarjetas
      if (snaps.tarjetas) {
        let tarjetasData = snaps.tarjetas.docs.map((doc: any) => {
          const data = doc.data()
          return { id: doc.id, user_id: data.user_id, nombre: data.nombre, tipo: data.tipo, banco: data.banco || null, digitos: data.digitos || null, cierre: data.cierre || null, created_at: data.created_at instanceof Timestamp ? data.created_at.toDate().toISOString() : data.created_at }
        }) as Tarjeta[]
        if (isWorkspaceMode && permissions.tarjetas === 'solo_propios') {
          tarjetasData = tarjetasData.filter(t => t.user_id === user.uid)
        }
        setTarjetas(tarjetasData)
      }

      // Gastos
      if (snaps.gastos) {
        let gastosData = snaps.gastos.docs.map((doc: any) => {
          const data = doc.data()
          return { id: doc.id, user_id: data.user_id, tarjeta_id: data.tarjeta_id || null, categoria_id: data.categoria_id || null, descripcion: data.descripcion, monto: data.monto, moneda: data.moneda, cuotas: data.cuotas, cuota_actual: data.cuota_actual, fecha: data.fecha, mes_facturacion: data.mes_facturacion, es_fijo: data.es_fijo, tag_ids: data.tag_ids || [], pagado: data.pagado || false, fecha_pago: data.fecha_pago || null, medio_pago: data.medio_pago || null, comprobante_url: data.comprobante_url || null, comprobante_nombre: data.comprobante_nombre || null, created_at: data.created_at instanceof Timestamp ? data.created_at.toDate().toISOString() : data.created_at }
        }) as Gasto[]
        if (isWorkspaceMode && permissions.gastos === 'solo_propios') {
          gastosData = gastosData.filter(g => g.user_id === user.uid)
        }
        setGastos(gastosData)
      }

      // Impuestos
      if (snaps.impuestos) {
        let impuestosData = snaps.impuestos.docs.map((doc: any) => {
          const data = doc.data()
          return { id: doc.id, user_id: data.user_id, tarjeta_id: data.tarjeta_id || null, categoria_id: data.categoria_id || null, descripcion: data.descripcion, monto: data.monto, moneda: data.moneda || 'ARS', mes: data.mes, es_fijo: data.es_fijo || false, tag_ids: data.tag_ids || [], pagado: data.pagado !== undefined ? data.pagado : false, fecha_pago: data.fecha_pago || null, medio_pago: data.medio_pago || null, comprobante_url: data.comprobante_url || null, comprobante_nombre: data.comprobante_nombre || null, workspace_id: data.workspace_id || null, created_by: data.created_by || null, created_at: data.created_at instanceof Timestamp ? data.created_at.toDate().toISOString() : data.created_at }
        }) as Impuesto[]
        if (isWorkspaceMode && permissions.gastos === 'solo_propios') {
          impuestosData = impuestosData.filter(i => i.user_id === user.uid)
        }
        setImpuestos(impuestosData)
      }

      // Ingresos
      if (snaps.ingresos) {
        let ingresosData = snaps.ingresos.docs.map((doc: any) => {
          const data = doc.data()
          return { id: doc.id, user_id: data.user_id, categoria_id: data.categoria_id || null, descripcion: data.descripcion, monto: data.monto, moneda: data.moneda, fecha: data.fecha, mes: data.mes, tag_ids: data.tag_ids || [], created_at: data.created_at instanceof Timestamp ? data.created_at.toDate().toISOString() : data.created_at, pendiente_cobro: data.pendiente_cobro === true || data.pendiente_cobro === 'true' || data.pendiente_cobro === 1 || false, fecha_cobro_esperada: data.fecha_cobro_esperada || null, fecha_cobro_confirmada: data.fecha_cobro_confirmada || null, cuenta_bancaria_id: data.cuenta_bancaria_id || null, comprobante_url: data.comprobante_url || null, comprobante_nombre: data.comprobante_nombre || null, notificar_correo: data.notificar_correo !== undefined ? (data.notificar_correo === true || data.notificar_correo === 'true' || data.notificar_correo === 1) : false, es_fijo: data.es_fijo === true || data.es_fijo === 'true' || data.es_fijo === 1 || false }
        }) as Ingreso[]
        if (isWorkspaceMode && permissions.ingresos === 'solo_propios') {
          ingresosData = ingresosData.filter(i => i.user_id === user.uid)
        }
        setIngresos(ingresosData)
      }

      // Tags
      if (snaps.tags) {
        setTags(snaps.tags.docs.map((doc: any) => ({ id: doc.id, user_id: doc.data().user_id, nombre: doc.data().nombre, created_at: doc.data().created_at instanceof Timestamp ? doc.data().created_at.toDate().toISOString() : doc.data().created_at })) as Tag[])
      }

      // Medios Pago
      if (snaps.mediosPago) {
        setMediosPago(snaps.mediosPago.docs.map((doc: any) => ({ id: doc.id, user_id: doc.data().user_id, nombre: doc.data().nombre, created_at: doc.data().created_at instanceof Timestamp ? doc.data().created_at.toDate().toISOString() : doc.data().created_at })) as MedioPago[])
      }

      // Tags Ingresos
      if (snaps.tagsIngresos) {
        setTagsIngresos(snaps.tagsIngresos.docs.map((doc: any) => ({ id: doc.id, user_id: doc.data().user_id, nombre: doc.data().nombre, created_at: doc.data().created_at instanceof Timestamp ? doc.data().created_at.toDate().toISOString() : doc.data().created_at })) as TagIngreso[])
      }

      // --- CATEGORÍAS (pueden necesitar crear defaults) ---
      if (snaps.categorias) {
        let categoriasData = snaps.categorias.docs.map((doc: any) => ({ id: doc.id, user_id: doc.data().user_id, nombre: doc.data().nombre, icono: doc.data().icono, color: doc.data().color, created_at: doc.data().created_at instanceof Timestamp ? doc.data().created_at.toDate().toISOString() : doc.data().created_at })) as Categoria[]

        const canCreateCategories = !isWorkspaceMode || permissions.gastos === 'admin' || isOwner
        if (categoriasData.length === 0 && canCreateCategories && latestWorkspace?.id) {
          const defaultCategorias = [
            { nombre: 'Comida', icono: '🍔', color: '#f97316' },
            { nombre: 'Hogar', icono: '🏠', color: '#3b82f6' },
            { nombre: 'Transporte', icono: '🚗', color: '#10b981' },
            { nombre: 'Entretenimiento', icono: '🎮', color: '#8b5cf6' },
            { nombre: 'Ropa', icono: '👕', color: '#ec4899' },
            { nombre: 'Salud', icono: '💊', color: '#ef4444' },
            { nombre: 'Educación', icono: '📚', color: '#06b6d4' },
            { nombre: 'Otros', icono: '💰', color: '#6b7280' }
          ]
          const catRef = collection(db, 'categorias')
          for (const cat of defaultCategorias) {
            const docData: any = { ...cat, user_id: user.uid, created_at: serverTimestamp(), workspace_id: latestWorkspace.id, created_by: user.uid }
            await addDoc(catRef, docData)
          }
          const newSnap = await getDocs(query(collection(db, 'categorias'), workspaceFilter, orderBy('created_at', 'desc')))
          categoriasData = newSnap.docs.map((doc: any) => ({ id: doc.id, user_id: doc.data().user_id, nombre: doc.data().nombre, icono: doc.data().icono, color: doc.data().color, created_at: doc.data().created_at instanceof Timestamp ? doc.data().created_at.toDate().toISOString() : doc.data().created_at })) as Categoria[]
        }
        setCategorias(categoriasData)
      }

      // Categorías Ingresos (pueden necesitar crear defaults)
      if (snaps.categoriasIngresos) {
        let categoriasIngresosData = snaps.categoriasIngresos.docs.map((doc: any) => ({ id: doc.id, user_id: doc.data().user_id, nombre: doc.data().nombre, icono: doc.data().icono, color: doc.data().color, created_at: doc.data().created_at instanceof Timestamp ? doc.data().created_at.toDate().toISOString() : doc.data().created_at })) as CategoriaIngreso[]

        const canCreateCategoriasIngresos = !isWorkspaceMode || permissions.ingresos === 'admin' || isOwner
        if (categoriasIngresosData.length === 0 && canCreateCategoriasIngresos && latestWorkspace?.id) {
          const defaultCategoriasIngresos = [
            { nombre: 'Salario', icono: '💼', color: '#3b82f6' },
            { nombre: 'Freelance', icono: '💻', color: '#8b5cf6' },
            { nombre: 'Inversiones', icono: '📈', color: '#10b981' },
            { nombre: 'Alquiler', icono: '🏠', color: '#f59e0b' },
            { nombre: 'Ventas', icono: '🛍️', color: '#ec4899' },
            { nombre: 'Otros', icono: '💵', color: '#6b7280' }
          ]
          const catIngRef = collection(db, 'categorias_ingresos')
          for (const cat of defaultCategoriasIngresos) {
            const docData: any = { ...cat, user_id: user.uid, created_at: serverTimestamp(), workspace_id: latestWorkspace.id, created_by: user.uid }
            await addDoc(catIngRef, docData)
          }
          const newSnap = await getDocs(query(collection(db, 'categorias_ingresos'), workspaceFilter, orderBy('created_at', 'desc')))
          categoriasIngresosData = newSnap.docs.map((doc: any) => ({ id: doc.id, user_id: doc.data().user_id, nombre: doc.data().nombre, icono: doc.data().icono, color: doc.data().color, created_at: doc.data().created_at instanceof Timestamp ? doc.data().created_at.toDate().toISOString() : doc.data().created_at })) as CategoriaIngreso[]
        }
        setCategoriasIngresos(categoriasIngresosData)
      }

      // Limpiar colecciones que no se consultaron (por permisos)
      // Esto evita que queden datos del workspace anterior en colecciones sin acceso
      if (!snaps.movimientos) setMovimientos([])
      if (!snaps.metas) setMetas([])
      if (!snaps.tarjetas) setTarjetas([])
      if (!snaps.gastos) setGastos([])
      if (!snaps.impuestos) setImpuestos([])
      if (!snaps.ingresos) setIngresos([])

      // --- AUTO-MIGRACIÓN: parchear documentos huérfanos (sin workspace_id) ---
      // Solo para el workspace personal del owner, migrar docs viejos que solo tienen user_id
      // Run-once guard: solo ejecutar una vez por workspace por sesión de app
      if (isWorkspaceMode && latestWorkspace?.id && latestWorkspace.owner_id === user.uid
          && migrationDoneForRef.current !== latestWorkspace.id) {
        migrationDoneForRef.current = latestWorkspace.id
        const wsId = latestWorkspace.id
        const orphanCollections = [
          'movimientos_ahorro', 'metas', 'gastos', 'impuestos', 'ingresos',
          'tarjetas', 'categorias', 'categorias_ingresos', 'tags', 'tags_ingresos', 'medios_pago'
        ]
        // Ejecutar migración en background (no bloquear UI)
        ;(async () => {
          let totalMigrated = 0
          try {
            const counts = await Promise.all(orphanCollections.map(async (colName) => {
              try {
                const orphanSnap = await getDocs(query(
                  collection(db, colName),
                  where('user_id', '==', user.uid)
                ))
                const orphanDocs = orphanSnap.docs.filter(d => !d.data().workspace_id)
                if (orphanDocs.length > 0) {
                  console.log(`🔧 [Migration] Patching ${orphanDocs.length} orphan docs in ${colName}`)
                  await Promise.all(orphanDocs.map(d =>
                    updateDoc(doc(db, colName, d.id), {
                      workspace_id: wsId,
                      created_by: d.data().created_by || user.uid
                    })
                  ))
                  return orphanDocs.length
                }
                return 0
              } catch (e) { return 0 }
            }))
            totalMigrated = counts.reduce((a, b) => a + b, 0)
          } catch (e) { /* silently ignore */ }
          // Only refetch if orphans were actually patched AND workspace hasn't changed
          if (totalMigrated > 0 && isMountedRef.current && currentWorkspaceIdRef.current === fetchForWorkspaceId) {
            console.log(`🔧 [Migration] ${totalMigrated} orphans patched, refetching data`)
            fetchAllInternal(false)
          }
        })()
      }

      const endTime = Date.now()
      console.log('✅ [Firebase useData] Data fetched successfully in', endTime - startTime, 'ms')

      setLoading(false)

    } catch (error: any) {
      console.error('❌ [Firebase useData] Error general en fetchAll:', {
        error: error.message,
        code: error.code,
        stack: error.stack,
        workspaceId: latestWorkspace?.id,
        workspaceName: latestWorkspace?.name,
        userId: user?.uid,
        isWorkspaceMode: currentWorkspace !== null
      })
      // No propagar el error para evitar que rompa la UI
      // Solo loguear y mantener el estado de loading en false
      setLoading(false)
      // Opcional: Mostrar notificación al usuario si es necesario
      // Pero no lanzar el error para evitar que el ErrorBoundary lo capture
    }
  }, [user, currentWorkspace])

  // Public fetchAll: no limpia estado (para CRUD refetch)
  const fetchAll = useCallback(async () => {
    return fetchAllInternal(false)
  }, [fetchAllInternal])
  // --- FIN FETCHALL ---

  // Usar useRef para rastrear si el componente está montado
  const isMountedRef = useRef(true)
  // Rastrear el último workspace ID que se cargó EXITOSAMENTE
  // undefined = nunca cargó, null = personal, string = workspace ID
  const lastLoadedWorkspaceIdRef = useRef<string | null | undefined>(undefined)
  // Rastrear si hay un fetch en progreso (evitar fetches concurrentes)
  const fetchInProgressRef = useRef(false)
  // Run-once guard for orphan migration (per workspace per session)
  const migrationDoneForRef = useRef<string | null>(null)
  // Always-current workspace ID for staleness checks in async callbacks
  const currentWorkspaceIdRef = useRef<string | null>(null)
  currentWorkspaceIdRef.current = currentWorkspace?.id || null

  useEffect(() => {
    isMountedRef.current = true

    return () => {
      isMountedRef.current = false
    }
  }, [])

  useEffect(() => {
    console.log('📊 [Firebase useData] useEffect triggered - authLoading:', authLoading, 'user:', user?.uid || 'NULL', 'workspace:', currentWorkspace?.id || 'NULL', 'initWorkspaceReady:', initWorkspaceReady)

    // Si la autenticación aún está cargando, esperar
    if (authLoading) {
      console.log('📊 [Firebase useData] Auth still loading - waiting...')
      return
    }

    // Si no hay usuario, limpiar datos y resetear refs
    if (!user) {
      console.log('📊 [Firebase useData] No user and auth done loading - Clearing data and setting loading to FALSE')
      if (isMountedRef.current) {
        setMovimientos([])
        setMetas([])
        setTarjetas([])
        setGastos([])
        setImpuestos([])
        setCategorias([])
        setTags([])
        setIngresos([])
        setCategoriasIngresos([])
        setTagsIngresos([])
        setMediosPago([])
        setLoading(false)
        lastLoadedWorkspaceIdRef.current = undefined
        fetchInProgressRef.current = false
      }
      return
    }

    // Si hay usuario pero el workspace aún no está inicializado, esperar
    if (!initWorkspaceReady) {
      console.log('📊 [Firebase useData] Workspace not ready yet - waiting for initWorkspaceReady...')
      return
    }

    // Obtener el workspace ID actual (null para modo personal)
    const currentWorkspaceId = currentWorkspace?.id || null

    // Verificar si ya cargamos datos EXITOSAMENTE para este workspace
    // undefined = nunca cargó, null = personal cargado, string = workspace cargado
    const alreadyLoaded = lastLoadedWorkspaceIdRef.current !== undefined &&
                          lastLoadedWorkspaceIdRef.current === currentWorkspaceId

    if (alreadyLoaded) {
      console.log('📊 [Firebase useData] Data already loaded for workspace:', currentWorkspaceId || 'PERSONAL')
      return
    }

    // Si hay un fetch en progreso, no lanzar otro
    if (fetchInProgressRef.current) {
      console.log('📊 [Firebase useData] Fetch already in progress, skipping')
      return
    }

    // Cargar datos
    console.log('📊 [Firebase useData] User and workspace ready - Calling fetchAll', {
      workspaceId: currentWorkspaceId || 'PERSONAL (no workspace_id)',
      workspaceName: currentWorkspace?.name || 'Personal',
      userId: user.uid
    })

    fetchInProgressRef.current = true

    fetchAllInternal(true)
      .then(() => {
        if (isMountedRef.current) {
          // Marcar como cargado SOLO después de éxito
          lastLoadedWorkspaceIdRef.current = currentWorkspaceId ?? null
          console.log('📊 [Firebase useData] Fetch completed successfully for workspace:', currentWorkspaceId || 'PERSONAL')
        }
      })
      .catch((error) => {
        if (isMountedRef.current) {
          console.error('📊 [Firebase useData] Error en fetchAll:', error)
          // NO marcar como cargado - permitir reintento
        }
      })
      .finally(() => {
        fetchInProgressRef.current = false
      })
  }, [user, authLoading, fetchAllInternal, currentWorkspace?.id, initWorkspaceReady])

  // Resetear refs cuando cambia el workspace (para forzar refetch)
  useEffect(() => {
    // Cuando workspace cambia, invalidar el último cargado para forzar nuevo fetch
    const currentWsId = currentWorkspace?.id || null
    if (lastLoadedWorkspaceIdRef.current !== undefined &&
        lastLoadedWorkspaceIdRef.current !== (currentWsId ?? null)) {
      console.log('📊 [useData] Workspace changed, clearing stale data:', lastLoadedWorkspaceIdRef.current, '->', currentWsId)
      lastLoadedWorkspaceIdRef.current = undefined
      migrationDoneForRef.current = null
      // Clear stale data IMMEDIATELY to prevent cross-workspace leaks
      setMovimientos([])
      setMetas([])
      setTarjetas([])
      setGastos([])
      setImpuestos([])
      setCategorias([])
      setTags([])
      setMediosPago([])
      setIngresos([])
      setCategoriasIngresos([])
      setTagsIngresos([])
      setLoading(true)
    }
  }, [currentWorkspace?.id])

  // Resetear refs cuando cambia el usuario
  useEffect(() => {
    if (!user) {
      lastLoadedWorkspaceIdRef.current = undefined
      fetchInProgressRef.current = false
    }
  }, [user?.uid])

  // State-change debug log removed to reduce console noise during workspace switch

  // Helper: obtener workspace_id obligatorio para inserción
  // Bloquea creación si el workspace no está listo (previene documentos huérfanos)
  const getWorkspaceFields = useCallback(() => {
    if (!currentWorkspace?.id) {
      throw new Error('Workspace no inicializado. Esperá a que cargue antes de agregar datos.')
    }
    return { workspace_id: currentWorkspace.id, created_by: user?.uid || '' }
  }, [currentWorkspace, user])

  const addMovimiento = useCallback(async (tipo: 'pesos' | 'usd', monto: number, descripcion?: string) => {
    if (!user) return { error: new Error('No user') }
    try {
      const wsFields = getWorkspaceFields()
      const insertData: any = {
        tipo, monto, user_id: user.uid,
        created_at: new Date().toISOString(),
        ...wsFields
      }
      if (descripcion) insertData.descripcion = descripcion
      await addDoc(collection(db, 'movimientos_ahorro'), insertData)
      await fetchAll()
      return { error: null }
    } catch (error) { return { error } }
  }, [user, getWorkspaceFields, fetchAll])

  const updateMovimiento = useCallback(async (id: string, data: any) => {
    if (!user) return { error: new Error('No user') }
    try {
      await updateDoc(doc(db, 'movimientos_ahorro', id), data)
      await fetchAll()
      return { error: null }
    } catch (error) {
      return { error }
    }
  }, [user, fetchAll])

  const deleteMovimiento = useCallback(async (id: string) => {
    if (!user) return { error: new Error('No user') }
    try {
      await deleteDoc(doc(db, 'movimientos_ahorro', id))
      await fetchAll()
      return { error: null }
    } catch (error) {
      return { error }
    }
  }, [user, fetchAll])

  const changeMonth = useCallback((delta: number) => {
    setCurrentMonth(prev => {
      const newDate = new Date(prev)
      const currentMonth = newDate.getMonth()
      const currentYear = newDate.getFullYear()
      
      // Calcular el nuevo mes y año de forma más segura
      let newMonth = currentMonth + delta
      let newYear = currentYear
      
      // Manejar desbordamiento de meses
      while (newMonth < 0) {
        newMonth += 12
        newYear -= 1
      }
      while (newMonth > 11) {
        newMonth -= 12
        newYear += 1
      }
      
      newDate.setFullYear(newYear)
      newDate.setMonth(newMonth)
      newDate.setDate(1) // Asegurar que siempre sea el día 1
      
      return newDate
    })
  }, [])

  const addMeta = useCallback(async (data: any) => {
    if (!user) return { error: new Error('No user') }
    try {
      const wsFields = getWorkspaceFields()
      const insertData: any = { ...data, user_id: user.uid, completada: false, created_at: serverTimestamp(), ...wsFields }
      await addDoc(collection(db, 'metas'), insertData); await fetchAll(); return { error: null }
    } catch (error) { return { error } }
  }, [user, getWorkspaceFields, fetchAll])

  const updateMeta = useCallback(async (id: string, data: any) => {
    if (!user) return { error: new Error('No user') }
    try { await updateDoc(doc(db, 'metas', id), data); await fetchAll(); return { error: null } } catch (error) { return { error } }
  }, [user, fetchAll])

  const deleteMeta = useCallback(async (id: string) => {
    if (!user) return { error: new Error('No user') }
    try { await deleteDoc(doc(db, 'metas', id)); await fetchAll(); return { error: null } } catch (error) { return { error } }
  }, [user, fetchAll])

  const addTag = useCallback(async (nombre: string) => {
    if (!user) return { error: new Error('No user') }
    try {
      const wsFields = getWorkspaceFields()
      const insertData: any = { nombre, user_id: user.uid, created_at: serverTimestamp(), ...wsFields }
      await addDoc(collection(db, 'tags'), insertData); await fetchAll(); return { error: null }
    } catch (error) { return { error } }
  }, [user, getWorkspaceFields, fetchAll])

  const deleteTag = useCallback(async (id: string) => {
    if (!user) return { error: new Error('No user') }
    try { await deleteDoc(doc(db, 'tags', id)); await fetchAll(); return { error: null } } catch (error) { return { error } }
  }, [user, fetchAll])

  const addCategoria = useCallback(async (data: any) => {
    if (!user) return { error: new Error('No user') }
    try {
      const wsFields = getWorkspaceFields()
      const insertData: any = { ...data, user_id: user.uid, created_at: serverTimestamp(), ...wsFields }
      const docRef = await addDoc(collection(db, 'categorias'), insertData)
      await fetchAll()
      return { error: null, id: docRef.id }
    } catch (error) { return { error } }
  }, [user, getWorkspaceFields, fetchAll])

  const updateCategoria = useCallback(async (id: string, data: any) => {
    if (!user) return { error: new Error('No user') }
    try { await updateDoc(doc(db, 'categorias', id), data); await fetchAll(); return { error: null } } catch (error) { return { error } }
  }, [user, fetchAll])

  const deleteCategoria = useCallback(async (id: string) => {
    if (!user) return { error: new Error('No user') }
    try { await deleteDoc(doc(db, 'categorias', id)); await fetchAll(); return { error: null } } catch (error) { return { error } }
  }, [user, fetchAll])

  const addGasto = useCallback(async (data: any) => {
    if (!user) return { error: new Error('No user') }
    try {
      const wsFields = getWorkspaceFields()
      const insertData: any = { ...data, user_id: user.uid, created_at: serverTimestamp(), ...wsFields }
      const docRef = await addDoc(collection(db, 'gastos'), insertData); await fetchAll(); return { error: null, data: { id: docRef.id, ...data } }
    } catch (error) { return { error } }
  }, [user, getWorkspaceFields, fetchAll])

  const updateGasto = useCallback(async (id: string, data: any) => {
    if (!user) return { error: new Error('No user') }
    try { await updateDoc(doc(db, 'gastos', id), data); await fetchAll(); return { error: null } } catch (error) { return { error } }
  }, [user, fetchAll])

  const deleteGasto = useCallback(async (id: string) => {
    if (!user) return { error: new Error('No user') }
    try { await deleteDoc(doc(db, 'gastos', id)); await fetchAll(); return { error: null } } catch (error) { return { error } }
  }, [user, fetchAll])

const addTarjeta = useCallback(async (data: any) => {
    if (!user) return { error: new Error('No user') }
    try {
      const wsFields = getWorkspaceFields()
      const insertData: any = { ...data, user_id: user.uid, created_at: serverTimestamp(), ...wsFields }
      const docRef = await addDoc(collection(db, 'tarjetas'), insertData)
      await fetchAll()
      return { error: null, id: docRef.id }
    } catch (error) { return { error } }
  }, [user, getWorkspaceFields, fetchAll])

  const updateTarjeta = useCallback(async (id: string, data: any) => {
    if (!user) return { error: new Error('No user') }
    try { await updateDoc(doc(db, 'tarjetas', id), data); await fetchAll(); return { error: null } } catch (error) { return { error } }
  }, [user, fetchAll])

  const deleteTarjeta = useCallback(async (id: string) => {
    if (!user) return { error: new Error('No user') }
    try { await deleteDoc(doc(db, 'tarjetas', id)); await fetchAll(); return { error: null } } catch (error) { return { error } }
  }, [user, fetchAll])

  const addImpuesto = useCallback(async (data: any) => {
    if (!user) return { error: new Error('No user') }
    try {
      const wsFields = getWorkspaceFields()
      const insertData: any = {
        ...data,
        pagado: data.pagado !== undefined ? data.pagado : false,
        user_id: user.uid,
        created_at: serverTimestamp(),
        ...wsFields
      }
      await addDoc(collection(db, 'impuestos'), insertData); await fetchAll(); return { error: null }
    } catch (error) { return { error } }
  }, [user, getWorkspaceFields, fetchAll])

  const updateImpuesto = useCallback(async (id: string, data: any) => {
    if (!user) return { error: new Error('No user') }
    try { await updateDoc(doc(db, 'impuestos', id), data); await fetchAll(); return { error: null } } catch (error) { return { error } }
  }, [user, fetchAll])

  const deleteImpuesto = useCallback(async (id: string) => {
    if (!user) return { error: new Error('No user') }
    try { await deleteDoc(doc(db, 'impuestos', id)); await fetchAll(); return { error: null } } catch (error) { return { error } }
  }, [user, fetchAll])

  const addMedioPago = useCallback(async (nombre: string) => {
    if (!user) return { error: new Error('No user') }
    try {
      const wsFields = getWorkspaceFields()
      const insertData: any = { nombre, user_id: user.uid, created_at: serverTimestamp(), ...wsFields }
      await addDoc(collection(db, 'medios_pago'), insertData); await fetchAll(); return { error: null }
    } catch (error) { return { error } }
  }, [user, getWorkspaceFields, fetchAll])

  const deleteMedioPago = useCallback(async (id: string) => {
    if (!user) return { error: new Error('No user') }
    try { await deleteDoc(doc(db, 'medios_pago', id)); await fetchAll(); return { error: null } } catch (error) { return { error } }
  }, [user, fetchAll])

  const addIngreso = useCallback(async (data: any) => {
    if (!user) return { error: new Error('No user') }
    try {
      const wsFields = getWorkspaceFields()
      const insertData: any = {
        ...data,
        pendiente_cobro: data.pendiente_cobro === true,
        user_id: user.uid,
        created_at: serverTimestamp(),
        ...wsFields
      }
      const docRef = await addDoc(collection(db, 'ingresos'), insertData)
      await fetchAll()
      return { error: null, data: { id: docRef.id, ...insertData } }
    } catch (error) {
      console.error('❌ [useData] Error agregando ingreso:', error)
      return { error }
    }
  }, [user, getWorkspaceFields, fetchAll])

  const updateIngreso = useCallback(async (id: string, data: any) => {
    if (!user) return { error: new Error('No user') }
    try {
      // Asegurar que pendiente_cobro sea boolean si está presente
      const updateData: any = { ...data }
      if ('pendiente_cobro' in data) {
        updateData.pendiente_cobro = data.pendiente_cobro === true
      }
      // Asegurar que es_fijo sea boolean si está presente
      if ('es_fijo' in data) {
        updateData.es_fijo = data.es_fijo === true
      }
      
      console.log('🔵 [useData] Actualizando ingreso:', id, {
        descripcion: updateData.descripcion,
        pendiente_cobro: updateData.pendiente_cobro,
        pendiente_cobro_type: typeof updateData.pendiente_cobro,
        es_fijo: updateData.es_fijo,
        es_fijo_type: typeof updateData.es_fijo,
        fecha_cobro_esperada: updateData.fecha_cobro_esperada,
        fecha_cobro_confirmada: updateData.fecha_cobro_confirmada,
        cuenta_bancaria_id: updateData.cuenta_bancaria_id,
        notificar_correo: updateData.notificar_correo
      })
      
      await updateDoc(doc(db, 'ingresos', id), updateData)
      
      console.log('✅ [useData] Ingreso actualizado exitosamente en Firestore:', id, {
        pendiente_cobro: updateData.pendiente_cobro,
        es_fijo: updateData.es_fijo,
        fecha_cobro_esperada: updateData.fecha_cobro_esperada
      })
      
      await fetchAll()
      
      console.log('✅ [useData] Datos refrescados después de actualizar ingreso')
      
      return { error: null }
    } catch (error) { 
      console.error('❌ [useData] Error actualizando ingreso:', error)
      return { error } 
    }
  }, [user, fetchAll])

  const deleteIngreso = useCallback(async (id: string) => {
    if (!user) return { error: new Error('No user') }
    try { await deleteDoc(doc(db, 'ingresos', id)); await fetchAll(); return { error: null } } catch (error) { return { error } }
  }, [user, fetchAll])

  const addTagIngreso = useCallback(async (nombre: string) => {
    if (!user) return { error: new Error('No user') }
    try {
      const wsFields = getWorkspaceFields()
      const insertData: any = { nombre, user_id: user.uid, created_at: serverTimestamp(), ...wsFields }
      await addDoc(collection(db, 'tags_ingresos'), insertData); await fetchAll(); return { error: null }
    } catch (error) { return { error } }
  }, [user, getWorkspaceFields, fetchAll])

  const deleteTagIngreso = useCallback(async (id: string) => {
    if (!user) return { error: new Error('No user') }
    try { await deleteDoc(doc(db, 'tags_ingresos', id)); await fetchAll(); return { error: null } } catch (error) { return { error } }
  }, [user, fetchAll])

  const addCategoriaIngreso = useCallback(async (data: any) => {
    if (!user) return { error: new Error('No user') }
    try {
      const wsFields = getWorkspaceFields()
      const insertData: any = { ...data, user_id: user.uid, created_at: serverTimestamp(), ...wsFields }
      const docRef = await addDoc(collection(db, 'categorias_ingresos'), insertData)
      await fetchAll()
      return { error: null, id: docRef.id }
    } catch (error) { return { error } }
  }, [user, getWorkspaceFields, fetchAll])

  const updateCategoriaIngreso = useCallback(async (id: string, data: any) => {
    if (!user) return { error: new Error('No user') }
    try { await updateDoc(doc(db, 'categorias_ingresos', id), data); await fetchAll(); return { error: null } } catch (error) { return { error } }
  }, [user, fetchAll])

  const deleteCategoriaIngreso = useCallback(async (id: string) => {
    if (!user) return { error: new Error('No user') }
    try { await deleteDoc(doc(db, 'categorias_ingresos', id)); await fetchAll(); return { error: null } } catch (error) { return { error } }
  }, [user, fetchAll])

  const getIngresosMes = useCallback((mes: string) => {
    console.log('📊 [Firebase getIngresosMes] called - mes:', mes, 'total ingresos:', ingresos.length)
    
    return ingresos.filter(i => {
      // Si el ingreso es del mes actual, mostrarlo
      if (i.mes === mes) {
        console.log('✅ [getIngresosMes] Ingreso incluido (mes actual):', i.id, i.descripcion, 'mes:', i.mes, 'es_fijo:', (i as any).es_fijo)
        return true
      }
      // Si es fijo y su mes es anterior al mes consultado, también mostrarlo
      if ((i as any).es_fijo === true && i.mes < mes) {
        console.log('✅ [getIngresosMes] Ingreso fijo incluido (mes anterior):', i.id, i.descripcion, 'mes:', i.mes, 'mes consultado:', mes)
        return true
      }
      return false
    })
  }, [ingresos])

  const getGastosMes = useCallback((mes: string) => {
    console.log('📊 [Firebase getGastosMes] called - mes:', mes, 'total gastos:', gastos.length)

    return gastos.filter(g => {
      if (g.mes_facturacion === mes) return true
      if (g.es_fijo && g.mes_facturacion < mes) return true
      if (g.cuotas > 1 && !g.es_fijo) {
        const start = new Date(g.mes_facturacion + '-01')
        const current = new Date(mes + '-01')
        const diff = (current.getFullYear() - start.getFullYear()) * 12 + current.getMonth() - start.getMonth()
        if (diff >= 0 && diff < g.cuotas) return true
      }
      return false
    })
  }, [gastos])

  const getImpuestosMes = useCallback((mes: string) => {
    console.log('📊 [Firebase getImpuestosMes] called - mes:', mes, 'total impuestos:', impuestos.length)
    return impuestos.filter(i => i.mes === mes)
  }, [impuestos])

  const getGastosNoProximoMes = useCallback((mesActual: string) => {
    return { gastos: [], cantidad: 0, totalARS: 0, totalUSD: 0 }
  }, [])

  const getDiferenciaMeses = useCallback((mesActual: string, dolar: number) => {
    return {
      actual: { ars: 0, usd: 0, imp: 0, total: 0 },
      proximo: { ars: 0, usd: 0, imp: 0, total: 0 },
      diferencia: 0,
      diferenciaARS: 0,
      diferenciaUSD: 0
    }
  }, [])

  const value: DataContextType = {
    movimientos,
    metas,
    tarjetas,
    gastos,
    impuestos,
    categorias,
    tags,
    mediosPago,
    ingresos,
    categoriasIngresos,
    tagsIngresos,
    loading,
    currentMonth,
    monthKey,
    fetchAll,
    changeMonth,
    addMovimiento,
    updateMovimiento,
    deleteMovimiento,
    addMeta,
    updateMeta,
    deleteMeta,
    addTag,
    deleteTag,
    addCategoria,
    updateCategoria,
    deleteCategoria,
    addGasto,
    updateGasto,
    deleteGasto,
    addTarjeta,
    updateTarjeta,
    deleteTarjeta,
    addImpuesto,
    updateImpuesto,
    deleteImpuesto,
    addMedioPago,
    deleteMedioPago,
    addIngreso,
    updateIngreso,
    deleteIngreso,
    addTagIngreso,
    deleteTagIngreso,
    addCategoriaIngreso,
    updateCategoriaIngreso,
    deleteCategoriaIngreso,
    getIngresosMes,
    getGastosMes,
    getImpuestosMes,
    getGastosNoProximoMes,
    getDiferenciaMeses
  }

  // Context value creation log removed to reduce console noise

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  )
}

export function useData() {
  const context = useContext(DataContext)
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider')
  }
  return context
}
