'use client'

import { useState, useEffect, useCallback, createContext, useContext, ReactNode } from 'react'
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
  Timestamp,
  or
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from './useAuth'
import { useWorkspace } from './useWorkspace'
import { MovimientoAhorro, Meta, Tarjeta, Gasto, Impuesto, Categoria, Tag, MedioPago, Ingreso, CategoriaIngreso, TagIngreso } from '@/types'

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
  addCategoria: (data: any) => Promise<{ error: any }>
  updateCategoria: (id: string, data: any) => Promise<{ error: any }>
  deleteCategoria: (id: string) => Promise<{ error: any }>
  addGasto: (data: any) => Promise<{ error: any, data?: Gasto }>
  updateGasto: (id: string, data: any) => Promise<{ error: any }>
  deleteGasto: (id: string) => Promise<{ error: any }>
  addTarjeta: (data: any) => Promise<{ error: any }>
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
  addCategoriaIngreso: (data: any) => Promise<{ error: any }>
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
  const { currentWorkspace } = useWorkspace()

  console.log('📊 [Firebase DataProvider] RENDER - authLoading:', authLoading, 'user:', user?.uid || 'NULL', 'workspace:', currentWorkspace?.id || 'PERSONAL')

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
  const [currentMonth, setCurrentMonth] = useState(() => {
    // Restore last viewed month from localStorage
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('lastViewedMonth')
      if (saved) {
        return new Date(saved + '-01')
      }
    }
    return new Date()
  })

  const monthKey = currentMonth.toISOString().slice(0, 7)

  // Save current month to localStorage when it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('lastViewedMonth', monthKey)
    }
  }, [monthKey])

  const fetchAll = useCallback(async () => {
    console.log('📊 [Firebase useData] fetchAll called')
    console.log('📊 [Firebase useData] Current user.uid:', user?.uid)
    console.log('📊 [Firebase useData] Current workspace:', currentWorkspace?.id || 'PERSONAL')

    // 🟢 AGREGAR ESTE BLOQUE DE LIMPIEZA
    // Esto borra la pantalla antes de intentar cargar datos nuevos
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
    // ----------------------------------

    setLoading(true)
    try {
      if (!user) {
        console.log('📊 [Firebase useData] No user - Clearing data')
        setMovimientos([])
        setLoading(false)
        return
      }

      console.log('📊 [Firebase useData] Fetching data for workspace:', currentWorkspace?.name || 'Personal')
      const startTime = Date.now()

      // Determine query filter based on workspace
      const isWorkspaceMode = currentWorkspace !== null
      const workspaceFilter = isWorkspaceMode
        ? where('workspace_id', '==', currentWorkspace.id)
        : where('user_id', '==', user.uid)

      console.log('📊 [Firebase useData] Query mode:', isWorkspaceMode ? 'WORKSPACE' : 'PERSONAL')

      // Fetch movimientos
      const movimientosRef = collection(db, 'movimientos_ahorro')
      const movimientosQuery = query(
        movimientosRef,
        workspaceFilter,
        orderBy('created_at', 'desc')
      )
      const movimientosSnap = await getDocs(movimientosQuery)
      // Filter manually if in personal mode to exclude workspace items
      const movimientosDocs = isWorkspaceMode ? movimientosSnap.docs : movimientosSnap.docs.filter(d => !d.data().workspace_id)
      
      const movimientosData = movimientosDocs.map(doc => {
        const data = doc.data()
        let fecha: string
        if (data.created_at instanceof Timestamp) {
          fecha = data.created_at.toDate().toISOString()
        } else if (typeof data.created_at === 'string') {
          fecha = data.created_at
        } else {
          // Fallback para documentos sin fecha válida
          fecha = new Date().toISOString()
        }
        const movimiento: MovimientoAhorro = {
          id: doc.id,
          tipo: data.tipo,
          monto: data.monto,
          user_id: data.user_id,
          fecha
        }
        if (data.descripcion) {
          movimiento.descripcion = data.descripcion
        }
        return movimiento
      }) as MovimientoAhorro[]

      console.log('📊 [Firebase useData] Movimientos result:', movimientosData.length, 'rows')

      // Fetch metas
      const metasRef = collection(db, 'metas')
      const metasQuery = query(
        metasRef,
        workspaceFilter,
        orderBy('created_at', 'desc')
      )
      const metasSnap = await getDocs(metasQuery)
      const metasDocs = isWorkspaceMode ? metasSnap.docs : metasSnap.docs.filter(d => !d.data().workspace_id)

      const metasData = metasDocs.map(doc => {
        const data = doc.data()
        return {
          id: doc.id,
          user_id: data.user_id,
          nombre: data.nombre,
          icono: data.icono,
          objetivo: data.objetivo,
          progreso: data.progreso,
          moneda: data.moneda,
          completada: data.completada || false,
          fecha_limite: data.fecha_limite || null,
          created_at: data.created_at instanceof Timestamp
            ? data.created_at.toDate().toISOString()
            : data.created_at
        }
      }) as Meta[]

      console.log('📊 [Firebase useData] Metas result:', metasData.length, 'rows')

      // Fetch tarjetas
      const tarjetasRef = collection(db, 'tarjetas')
      const tarjetasQuery = query(
        tarjetasRef,
        workspaceFilter,
        orderBy('created_at', 'desc')
      )
      const tarjetasSnap = await getDocs(tarjetasQuery)
      const tarjetasDocs = isWorkspaceMode ? tarjetasSnap.docs : tarjetasSnap.docs.filter(d => !d.data().workspace_id)

      const tarjetasData = tarjetasDocs.map(doc => {
        const data = doc.data()
        return {
          id: doc.id,
          user_id: data.user_id,
          nombre: data.nombre,
          tipo: data.tipo,
          banco: data.banco || null,
          digitos: data.digitos || null,
          cierre: data.cierre || null,
          created_at: data.created_at instanceof Timestamp
            ? data.created_at.toDate().toISOString()
            : data.created_at
        }
      }) as Tarjeta[]

      console.log('📊 [Firebase useData] Tarjetas result:', tarjetasData.length, 'rows')

      // Fetch gastos
      const gastosRef = collection(db, 'gastos')
      const gastosQuery = query(
        gastosRef,
        workspaceFilter,
        orderBy('created_at', 'desc')
      )
      const gastosSnap = await getDocs(gastosQuery)
      const gastosDocs = isWorkspaceMode ? gastosSnap.docs : gastosSnap.docs.filter(d => !d.data().workspace_id)

      const gastosData = gastosDocs.map(doc => {
        const data = doc.data()
        return {
          id: doc.id,
          user_id: data.user_id,
          tarjeta_id: data.tarjeta_id || null,
          categoria_id: data.categoria_id || null,
          descripcion: data.descripcion,
          monto: data.monto,
          moneda: data.moneda,
          cuotas: data.cuotas,
          cuota_actual: data.cuota_actual,
          fecha: data.fecha,
          mes_facturacion: data.mes_facturacion,
          es_fijo: data.es_fijo,
          tag_ids: data.tag_ids || [],
          pagado: data.pagado || false,
          // Campos de pago
          fecha_pago: data.fecha_pago || null,
          medio_pago: data.medio_pago || null,
          comprobante_url: data.comprobante_url || null,
          comprobante_nombre: data.comprobante_nombre || null,
          created_at: data.created_at instanceof Timestamp
            ? data.created_at.toDate().toISOString()
            : data.created_at
        }
      }) as Gasto[]

      console.log('📊 [Firebase useData] Gastos result:', gastosData.length, 'rows')

      // Fetch impuestos
      const impuestosRef = collection(db, 'impuestos')
      const impuestosQuery = query(
        impuestosRef,
        workspaceFilter,
        orderBy('created_at', 'desc')
      )
      const impuestosSnap = await getDocs(impuestosQuery)
      const impuestosDocs = isWorkspaceMode ? impuestosSnap.docs : impuestosSnap.docs.filter(d => !d.data().workspace_id)

      const impuestosData = impuestosDocs.map(doc => {
        const data = doc.data()
        return {
          id: doc.id,
          user_id: data.user_id,
          tarjeta_id: data.tarjeta_id || null,
          descripcion: data.descripcion,
          monto: data.monto,
          mes: data.mes,
          created_at: data.created_at instanceof Timestamp
            ? data.created_at.toDate().toISOString()
            : data.created_at
        }
      }) as Impuesto[]

      console.log('📊 [Firebase useData] Impuestos result:', impuestosData.length, 'rows')

      // Fetch categorias
      const categoriasRef = collection(db, 'categorias')
      const categoriasQuery = query(
        categoriasRef,
        workspaceFilter,
        orderBy('created_at', 'desc')
      )
      const categoriasSnap = await getDocs(categoriasQuery)
      const categoriasDocs = isWorkspaceMode ? categoriasSnap.docs : categoriasSnap.docs.filter(d => !d.data().workspace_id)

      let categoriasData = categoriasDocs.map(doc => {
        const data = doc.data()
        return {
          id: doc.id,
          user_id: data.user_id,
          nombre: data.nombre,
          icono: data.icono,
          color: data.color,
          created_at: data.created_at instanceof Timestamp
            ? data.created_at.toDate().toISOString()
            : data.created_at
        }
      }) as Categoria[]

      console.log('📊 [Firebase useData] Categorias result:', categoriasData.length, 'rows')

      // Si no hay categorías, crear las estándar automáticamente
      if (categoriasData.length === 0) {
        console.log('📂 [Firebase useData] No categories found - Creating default categories')

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

        const categoriasRef = collection(db, 'categorias')
        for (const categoria of defaultCategorias) {
          const docData: any = {
            ...categoria,
            user_id: user.uid,
            created_at: serverTimestamp()
          }
          if (isWorkspaceMode) {
            docData.workspace_id = currentWorkspace.id
            docData.created_by = user.uid
          }
          await addDoc(categoriasRef, docData)
        }

        console.log('✅ [Firebase useData] Default categories created - Fetching again')

        // Volver a obtener las categorías
        const categoriasSnapNew = await getDocs(categoriasQuery)
        // Apply filter again to the new snapshot
        const categoriasDocsNew = isWorkspaceMode ? categoriasSnapNew.docs : categoriasSnapNew.docs.filter(d => !d.data().workspace_id)
        
        categoriasData = categoriasDocsNew.map(doc => {
          const data = doc.data()
          return {
            id: doc.id,
            user_id: data.user_id,
            nombre: data.nombre,
            icono: data.icono,
            color: data.color,
            created_at: data.created_at instanceof Timestamp
              ? data.created_at.toDate().toISOString()
              : data.created_at
          }
        }) as Categoria[]

        console.log('📊 [Firebase useData] Categorias after creation:', categoriasData.length, 'rows')
      }

      // Fetch tags
      const tagsRef = collection(db, 'tags')
      const tagsQuery = query(
        tagsRef,
        workspaceFilter,
        orderBy('created_at', 'desc')
      )
      const tagsSnap = await getDocs(tagsQuery)
      const tagsDocs = isWorkspaceMode ? tagsSnap.docs : tagsSnap.docs.filter(d => !d.data().workspace_id)

      const tagsData = tagsDocs.map(doc => {
        const data = doc.data()
        return {
          id: doc.id,
          user_id: data.user_id,
          nombre: data.nombre,
          created_at: data.created_at instanceof Timestamp
            ? data.created_at.toDate().toISOString()
            : data.created_at
        }
      }) as Tag[]

      console.log('📊 [Firebase useData] Tags result:', tagsData.length, 'rows')

      // Fetch medios_pago (wrapped in try-catch to not break existing data)
      let mediosPagoData: MedioPago[] = []
      try {
        const mediosPagoRef = collection(db, 'medios_pago')
        const mediosPagoQuery = query(
          mediosPagoRef,
          workspaceFilter,
          orderBy('created_at', 'desc')
        )
        const mediosPagoSnap = await getDocs(mediosPagoQuery)
        const mediosPagoDocs = isWorkspaceMode ? mediosPagoSnap.docs : mediosPagoSnap.docs.filter(d => !d.data().workspace_id)

        mediosPagoData = mediosPagoDocs.map(doc => {
          const data = doc.data()
          return {
            id: doc.id,
            user_id: data.user_id,
            nombre: data.nombre,
            created_at: data.created_at instanceof Timestamp
              ? data.created_at.toDate().toISOString()
              : data.created_at
          }
        }) as MedioPago[]

        console.log('📊 [Firebase useData] Medios Pago result:', mediosPagoData.length, 'rows')
      } catch (mediosPagoError) {
        console.error('⚠️ [Firebase useData] Error fetching medios_pago (non-critical):', mediosPagoError)
        console.log('📊 [Firebase useData] Continuing without medios_pago...')
      }

      // Fetch categorias_ingresos (wrapped in try-catch to not break existing data)
      let categoriasIngresosData: CategoriaIngreso[] = []
      let tagsIngresosData: TagIngreso[] = []
      let ingresosData: Ingreso[] = []

      try {
        const categoriasIngresosRef = collection(db, 'categorias_ingresos')
        const categoriasIngresosQuery = query(
          categoriasIngresosRef,
          workspaceFilter,
          orderBy('created_at', 'desc')
        )
        const categoriasIngresosSnap = await getDocs(categoriasIngresosQuery)
        const categoriasIngresosDocs = isWorkspaceMode ? categoriasIngresosSnap.docs : categoriasIngresosSnap.docs.filter(d => !d.data().workspace_id)

        categoriasIngresosData = categoriasIngresosDocs.map(doc => {
        const data = doc.data()
        return {
          id: doc.id,
          user_id: data.user_id,
          nombre: data.nombre,
          icono: data.icono,
          color: data.color,
          created_at: data.created_at instanceof Timestamp
            ? data.created_at.toDate().toISOString()
            : data.created_at
        }
      }) as CategoriaIngreso[]

      console.log('📊 [Firebase useData] Categorias Ingresos result:', categoriasIngresosData.length, 'rows')

      // Si no hay categorías de ingresos, crear las estándar automáticamente
      if (categoriasIngresosData.length === 0) {
        console.log('📂 [Firebase useData] No income categories found - Creating default categories')

        const defaultCategoriasIngresos = [
          { nombre: 'Salario', icono: '💼', color: '#3b82f6' },
          { nombre: 'Freelance', icono: '💻', color: '#8b5cf6' },
          { nombre: 'Inversiones', icono: '📈', color: '#10b981' },
          { nombre: 'Alquiler', icono: '🏠', color: '#f59e0b' },
          { nombre: 'Ventas', icono: '🛍️', color: '#ec4899' },
          { nombre: 'Otros', icono: '💵', color: '#6b7280' }
        ]

        const categoriasIngresosRef = collection(db, 'categorias_ingresos')
        for (const categoria of defaultCategoriasIngresos) {
          const docData: any = {
            ...categoria,
            user_id: user.uid,
            created_at: serverTimestamp()
          }
          if (isWorkspaceMode) {
            docData.workspace_id = currentWorkspace.id
            docData.created_by = user.uid
          }
          await addDoc(categoriasIngresosRef, docData)
        }

        console.log('✅ [Firebase useData] Default income categories created - Fetching again')

        // Volver a obtener las categorías
        const categoriasIngresosSnapNew = await getDocs(categoriasIngresosQuery)
        const categoriasIngresosDocsNew = isWorkspaceMode ? categoriasIngresosSnapNew.docs : categoriasIngresosSnapNew.docs.filter(d => !d.data().workspace_id)

        categoriasIngresosData = categoriasIngresosDocsNew.map(doc => {
          const data = doc.data()
          return {
            id: doc.id,
            user_id: data.user_id,
            nombre: data.nombre,
            icono: data.icono,
            color: data.color,
            created_at: data.created_at instanceof Timestamp
              ? data.created_at.toDate().toISOString()
              : data.created_at
          }
        }) as CategoriaIngreso[]

        console.log('📊 [Firebase useData] Categorias Ingresos after creation:', categoriasIngresosData.length, 'rows')
      }

        // Fetch tags_ingresos
        const tagsIngresosRef = collection(db, 'tags_ingresos')
        const tagsIngresosQuery = query(
          tagsIngresosRef,
          workspaceFilter,
          orderBy('created_at', 'desc')
        )
        const tagsIngresosSnap = await getDocs(tagsIngresosQuery)
        const tagsIngresosDocs = isWorkspaceMode ? tagsIngresosSnap.docs : tagsIngresosSnap.docs.filter(d => !d.data().workspace_id)

        tagsIngresosData = tagsIngresosDocs.map(doc => {
        const data = doc.data()
        return {
          id: doc.id,
          user_id: data.user_id,
          nombre: data.nombre,
          created_at: data.created_at instanceof Timestamp
            ? data.created_at.toDate().toISOString()
            : data.created_at
        }
      }) as TagIngreso[]

        console.log('📊 [Firebase useData] Tags Ingresos result:', tagsIngresosData.length, 'rows')

        // Fetch ingresos
        const ingresosRef = collection(db, 'ingresos')
        const ingresosQuery = query(
          ingresosRef,
          workspaceFilter,
          orderBy('created_at', 'desc')
        )
        const ingresosSnap = await getDocs(ingresosQuery)
        const ingresosDocs = isWorkspaceMode ? ingresosSnap.docs : ingresosSnap.docs.filter(d => !d.data().workspace_id)

        ingresosData = ingresosDocs.map(doc => {
        const data = doc.data()
        return {
          id: doc.id,
          user_id: data.user_id,
          categoria_id: data.categoria_id || null,
          descripcion: data.descripcion,
          monto: data.monto,
          moneda: data.moneda,
          fecha: data.fecha,
          mes: data.mes,
          tag_ids: data.tag_ids || [],
          created_at: data.created_at instanceof Timestamp
            ? data.created_at.toDate().toISOString()
            : data.created_at
        }
      }) as Ingreso[]

        console.log('📊 [Firebase useData] Ingresos result:', ingresosData.length, 'rows')
      } catch (ingresosError) {
        console.error('⚠️ [Firebase useData] Error fetching ingresos data (non-critical):', ingresosError)
        console.log('📊 [Firebase useData] Continuing with existing data...')
      }

      const endTime = Date.now()
      console.log('📊 [Firebase useData] Data fetched successfully in', endTime - startTime, 'ms')

      setMovimientos(movimientosData)
      setMetas(metasData)
      setTarjetas(tarjetasData)
      setGastos(gastosData)
      setImpuestos(impuestosData)
      setCategorias(categoriasData)
      setTags(tagsData)
      setMediosPago(mediosPagoData)
      setIngresos(ingresosData)
      setCategoriasIngresos(categoriasIngresosData)
      setTagsIngresos(tagsIngresosData)
      setLoading(false)
    } catch (error) {
      console.error('📊 [Firebase useData] Error fetching data:', error)
      setLoading(false)
    }
  }, [user, currentWorkspace])

  useEffect(() => {
    console.log('📊 [Firebase useData] useEffect triggered - authLoading:', authLoading, 'user:', user?.uid || 'NULL')

    if (!authLoading && user) {
      console.log('📊 [Firebase useData] User exists - Calling fetchAll')
      fetchAll()
    } else if (!authLoading && !user) {
      console.log('📊 [Firebase useData] No user and auth done loading - Setting loading to FALSE')
      setLoading(false)
    } else {
      console.log('📊 [Firebase useData] Auth still loading - waiting...')
    }
  }, [user, authLoading, fetchAll])

  const addMovimiento = useCallback(async (tipo: 'pesos' | 'usd', monto: number, descripcion?: string) => {
    if (!user) {
      console.error('💵 [Firebase addMovimiento] No user!')
      return { error: new Error('No user') }
    }

    console.log('💵 [Firebase addMovimiento] called - tipo:', tipo, 'monto:', monto, 'descripcion:', descripcion)
    console.log('💵 [Firebase addMovimiento] user.uid:', user.uid)

    const insertData: any = {
      tipo,
      monto,
      user_id: user.uid,
      created_at: new Date().toISOString()
    }

    if (descripcion) {
      insertData.descripcion = descripcion
    }

    // Add workspace fields if in workspace mode
    if (currentWorkspace) {
      insertData.workspace_id = currentWorkspace.id
      insertData.created_by = user.uid
    }

    console.log('💵 [Firebase addMovimiento] Inserting:', insertData)

    try {
      const movimientosRef = collection(db, 'movimientos_ahorro')
      await addDoc(movimientosRef, insertData)

      console.log('💵 [Firebase addMovimiento] SUCCESS - Calling fetchAll')
      await fetchAll()

      return { error: null }
    } catch (error) {
      console.error('💵 [Firebase addMovimiento] ERROR:', error)
      return { error }
    }
  }, [user, currentWorkspace, fetchAll])

  const updateMovimiento = useCallback(async (id: string, data: any) => {
    if (!user) {
      console.error('💵 [Firebase updateMovimiento] No user!')
      return { error: new Error('No user') }
    }

    console.log('💵 [Firebase updateMovimiento] called', id, data)

    try {
      const movimientoRef = doc(db, 'movimientos_ahorro', id)
      await updateDoc(movimientoRef, data)

      console.log('💵 [Firebase updateMovimiento] SUCCESS - Calling fetchAll')
      await fetchAll()

      return { error: null }
    } catch (error) {
      console.error('💵 [Firebase updateMovimiento] ERROR:', error)
      return { error }
    }
  }, [user, fetchAll])

  const deleteMovimiento = useCallback(async (id: string) => {
    if (!user) {
      console.error('💵 [Firebase deleteMovimiento] No user!')
      return { error: new Error('No user') }
    }

    console.log('💵 [Firebase deleteMovimiento] called', id)

    try {
      const movimientoRef = doc(db, 'movimientos_ahorro', id)
      await deleteDoc(movimientoRef)

      console.log('💵 [Firebase deleteMovimiento] SUCCESS - Calling fetchAll')
      await fetchAll()

      return { error: null }
    } catch (error) {
      console.error('💵 [Firebase deleteMovimiento] ERROR:', error)
      return { error }
    }
  }, [user, fetchAll])

  const changeMonth = useCallback((delta: number) => {
    console.log('📅 [Firebase] changeMonth called with delta:', delta)
    setCurrentMonth(prev => {
      const newDate = new Date(prev)
      newDate.setMonth(newDate.getMonth() + delta)
      const monthKey = newDate.toISOString().slice(0, 7)
      console.log('📅 [Firebase] Changed month from', prev.toISOString().slice(0, 7), 'to', monthKey)

      // Save to localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('lastViewedMonth', monthKey)
        console.log('📅 [Firebase] Saved to localStorage:', monthKey)
      }

      return newDate
    })
  }, [])

  const addMeta = useCallback(async (data: any) => {
    if (!user) {
      console.error('🎯 [Firebase addMeta] No user!')
      return { error: new Error('No user') }
    }

    console.log('🎯 [Firebase addMeta] called', data)

    try {
      const insertData: any = {
        ...data,
        user_id: user.uid,
        completada: false,
        created_at: serverTimestamp()
      }

      // Add workspace fields if in workspace mode
      if (currentWorkspace) {
        insertData.workspace_id = currentWorkspace.id
        insertData.created_by = user.uid
      }

      const metasRef = collection(db, 'metas')
      await addDoc(metasRef, insertData)

      console.log('🎯 [Firebase addMeta] SUCCESS - Calling fetchAll')
      await fetchAll()

      return { error: null }
    } catch (error) {
      console.error('🎯 [Firebase addMeta] ERROR:', error)
      return { error }
    }
  }, [user, currentWorkspace, fetchAll])

  const updateMeta = useCallback(async (id: string, data: any) => {
    if (!user) {
      console.error('🎯 [Firebase updateMeta] No user!')
      return { error: new Error('No user') }
    }

    console.log('🎯 [Firebase updateMeta] called', id, data)

    try {
      const metaRef = doc(db, 'metas', id)
      await updateDoc(metaRef, data)

      console.log('🎯 [Firebase updateMeta] SUCCESS - Calling fetchAll')
      await fetchAll()

      return { error: null }
    } catch (error) {
      console.error('🎯 [Firebase updateMeta] ERROR:', error)
      return { error }
    }
  }, [user, fetchAll])

  const deleteMeta = useCallback(async (id: string) => {
    if (!user) {
      console.error('🎯 [Firebase deleteMeta] No user!')
      return { error: new Error('No user') }
    }

    console.log('🎯 [Firebase deleteMeta] called', id)

    try {
      const metaRef = doc(db, 'metas', id)
      await deleteDoc(metaRef)

      console.log('🎯 [Firebase deleteMeta] SUCCESS - Calling fetchAll')
      await fetchAll()

      return { error: null }
    } catch (error) {
      console.error('🎯 [Firebase deleteMeta] ERROR:', error)
      return { error }
    }
  }, [user, fetchAll])

  const addTag = useCallback(async (nombre: string) => {
    if (!user) {
      console.error('🏷️ [Firebase addTag] No user!')
      return { error: new Error('No user') }
    }

    console.log('🏷️ [Firebase addTag] called', nombre)

    try {
      const insertData: any = {
        nombre,
        user_id: user.uid,
        created_at: serverTimestamp()
      }

      // Add workspace fields if in workspace mode
      if (currentWorkspace) {
        insertData.workspace_id = currentWorkspace.id
        insertData.created_by = user.uid
      }

      const tagsRef = collection(db, 'tags')
      await addDoc(tagsRef, insertData)

      console.log('🏷️ [Firebase addTag] SUCCESS - Calling fetchAll')
      await fetchAll()

      return { error: null }
    } catch (error) {
      console.error('🏷️ [Firebase addTag] ERROR:', error)
      return { error }
    }
  }, [user, currentWorkspace, fetchAll])

  const deleteTag = useCallback(async (id: string) => {
    if (!user) {
      console.error('🏷️ [Firebase deleteTag] No user!')
      return { error: new Error('No user') }
    }

    console.log('🏷️ [Firebase deleteTag] called', id)

    try {
      const tagRef = doc(db, 'tags', id)
      await deleteDoc(tagRef)

      console.log('🏷️ [Firebase deleteTag] SUCCESS - Calling fetchAll')
      await fetchAll()

      return { error: null }
    } catch (error) {
      console.error('🏷️ [Firebase deleteTag] ERROR:', error)
      return { error }
    }
  }, [user, fetchAll])

  const addCategoria = useCallback(async (data: any) => {
    if (!user) {
      console.error('📂 [Firebase addCategoria] No user!')
      return { error: new Error('No user') }
    }

    console.log('📂 [Firebase addCategoria] called', data)

    try {
      const insertData: any = {
        ...data,
        user_id: user.uid,
        created_at: serverTimestamp()
      }

      // Add workspace fields if in workspace mode
      if (currentWorkspace) {
        insertData.workspace_id = currentWorkspace.id
        insertData.created_by = user.uid
      }

      const categoriasRef = collection(db, 'categorias')
      await addDoc(categoriasRef, insertData)

      console.log('📂 [Firebase addCategoria] SUCCESS - Calling fetchAll')
      await fetchAll()

      return { error: null }
    } catch (error) {
      console.error('📂 [Firebase addCategoria] ERROR:', error)
      return { error }
    }
  }, [user, currentWorkspace, fetchAll])

  const updateCategoria = useCallback(async (id: string, data: any) => {
    if (!user) {
      console.error('📂 [Firebase updateCategoria] No user!')
      return { error: new Error('No user') }
    }

    console.log('📂 [Firebase updateCategoria] called', id, data)

    try {
      const categoriaRef = doc(db, 'categorias', id)
      await updateDoc(categoriaRef, data)

      console.log('📂 [Firebase updateCategoria] SUCCESS - Calling fetchAll')
      await fetchAll()

      return { error: null }
    } catch (error) {
      console.error('📂 [Firebase updateCategoria] ERROR:', error)
      return { error }
    }
  }, [user, fetchAll])

  const deleteCategoria = useCallback(async (id: string) => {
    if (!user) {
      console.error('📂 [Firebase deleteCategoria] No user!')
      return { error: new Error('No user') }
    }

    console.log('📂 [Firebase deleteCategoria] called', id)

    try {
      const categoriaRef = doc(db, 'categorias', id)
      await deleteDoc(categoriaRef)

      console.log('📂 [Firebase deleteCategoria] SUCCESS - Calling fetchAll')
      await fetchAll()

      return { error: null }
    } catch (error) {
      console.error('📂 [Firebase deleteCategoria] ERROR:', error)
      return { error }
    }
  }, [user, fetchAll])

  const addGasto = useCallback(async (data: any) => {
    if (!user) {
      console.error('💰 [Firebase addGasto] No user!')
      return { error: new Error('No user') }
    }

    console.log('💰 [Firebase addGasto] called', data)

    try {
      const insertData: any = {
        ...data,
        user_id: user.uid,
        created_at: serverTimestamp()
      }

      // Add workspace fields if in workspace mode
      if (currentWorkspace) {
        insertData.workspace_id = currentWorkspace.id
        insertData.created_by = user.uid
      }

      const gastosRef = collection(db, 'gastos')
      const docRef = await addDoc(gastosRef, insertData)

      console.log('💰 [Firebase addGasto] SUCCESS - Calling fetchAll')
      await fetchAll()

      return { error: null, data: { id: docRef.id, ...data } }
    } catch (error) {
      console.error('💰 [Firebase addGasto] ERROR:', error)
      return { error }
    }
  }, [user, currentWorkspace, fetchAll])

  const updateGasto = useCallback(async (id: string, data: any) => {
    if (!user) {
      console.error('💰 [Firebase updateGasto] No user!')
      return { error: new Error('No user') }
    }

    console.log('💰 [Firebase updateGasto] called', id, data)

    try {
      const gastoRef = doc(db, 'gastos', id)
      await updateDoc(gastoRef, data)

      console.log('💰 [Firebase updateGasto] SUCCESS - Calling fetchAll')
      await fetchAll()

      return { error: null }
    } catch (error) {
      console.error('💰 [Firebase updateGasto] ERROR:', error)
      return { error }
    }
  }, [user, fetchAll])

  const deleteGasto = useCallback(async (id: string) => {
    if (!user) {
      console.error('💰 [Firebase deleteGasto] No user!')
      return { error: new Error('No user') }
    }

    console.log('💰 [Firebase deleteGasto] called', id)

    try {
      const gastoRef = doc(db, 'gastos', id)
      await deleteDoc(gastoRef)

      console.log('💰 [Firebase deleteGasto] SUCCESS - Calling fetchAll')
      await fetchAll()

      return { error: null }
    } catch (error) {
      console.error('💰 [Firebase deleteGasto] ERROR:', error)
      return { error }
    }
  }, [user, fetchAll])

  const addTarjeta = useCallback(async (data: any) => {
    if (!user) {
      console.error('💳 [Firebase addTarjeta] No user!')
      return { error: new Error('No user') }
    }

    console.log('💳 [Firebase addTarjeta] called', data)

    try {
      const insertData: any = {
        ...data,
        user_id: user.uid,
        created_at: serverTimestamp()
      }

      // Add workspace fields if in workspace mode
      if (currentWorkspace) {
        insertData.workspace_id = currentWorkspace.id
        insertData.created_by = user.uid
      }

      const tarjetasRef = collection(db, 'tarjetas')
      await addDoc(tarjetasRef, insertData)

      console.log('💳 [Firebase addTarjeta] SUCCESS - Calling fetchAll')
      await fetchAll()

      return { error: null }
    } catch (error) {
      console.error('💳 [Firebase addTarjeta] ERROR:', error)
      return { error }
    }
  }, [user, currentWorkspace, fetchAll])

  const updateTarjeta = useCallback(async (id: string, data: any) => {
    if (!user) {
      console.error('💳 [Firebase updateTarjeta] No user!')
      return { error: new Error('No user') }
    }

    console.log('💳 [Firebase updateTarjeta] called', id, data)

    try {
      const tarjetaRef = doc(db, 'tarjetas', id)
      await updateDoc(tarjetaRef, data)

      console.log('💳 [Firebase updateTarjeta] SUCCESS - Calling fetchAll')
      await fetchAll()

      return { error: null }
    } catch (error) {
      console.error('💳 [Firebase updateTarjeta] ERROR:', error)
      return { error }
    }
  }, [user, fetchAll])

  const deleteTarjeta = useCallback(async (id: string) => {
    if (!user) {
      console.error('💳 [Firebase deleteTarjeta] No user!')
      return { error: new Error('No user') }
    }

    console.log('💳 [Firebase deleteTarjeta] called', id)

    try {
      const tarjetaRef = doc(db, 'tarjetas', id)
      await deleteDoc(tarjetaRef)

      console.log('💳 [Firebase deleteTarjeta] SUCCESS - Calling fetchAll')
      await fetchAll()

      return { error: null }
    } catch (error) {
      console.error('💳 [Firebase deleteTarjeta] ERROR:', error)
      return { error }
    }
  }, [user, fetchAll])

  const addImpuesto = useCallback(async (data: any) => {
    if (!user) {
      console.error('🧾 [Firebase addImpuesto] No user!')
      return { error: new Error('No user') }
    }

    console.log('🧾 [Firebase addImpuesto] called', data)

    try {
      const insertData: any = {
        ...data,
        user_id: user.uid,
        created_at: serverTimestamp()
      }

      // Add workspace fields if in workspace mode
      if (currentWorkspace) {
        insertData.workspace_id = currentWorkspace.id
        insertData.created_by = user.uid
      }

      const impuestosRef = collection(db, 'impuestos')
      await addDoc(impuestosRef, insertData)

      console.log('🧾 [Firebase addImpuesto] SUCCESS - Calling fetchAll')
      await fetchAll()

      return { error: null }
    } catch (error) {
      console.error('🧾 [Firebase addImpuesto] ERROR:', error)
      return { error }
    }
  }, [user, currentWorkspace, fetchAll])

  const updateImpuesto = useCallback(async (id: string, data: any) => {
    if (!user) {
      console.error('🧾 [Firebase updateImpuesto] No user!')
      return { error: new Error('No user') }
    }

    console.log('🧾 [Firebase updateImpuesto] called', id, data)

    try {
      const impuestoRef = doc(db, 'impuestos', id)
      await updateDoc(impuestoRef, data)

      console.log('🧾 [Firebase updateImpuesto] SUCCESS - Calling fetchAll')
      await fetchAll()

      return { error: null }
    } catch (error) {
      console.error('🧾 [Firebase updateImpuesto] ERROR:', error)
      return { error }
    }
  }, [user, fetchAll])

  const deleteImpuesto = useCallback(async (id: string) => {
    if (!user) {
      console.error('🧾 [Firebase deleteImpuesto] No user!')
      return { error: new Error('No user') }
    }

    console.log('🧾 [Firebase deleteImpuesto] called', id)

    try {
      const impuestoRef = doc(db, 'impuestos', id)
      await deleteDoc(impuestoRef)

      console.log('🧾 [Firebase deleteImpuesto] SUCCESS - Calling fetchAll')
      await fetchAll()

      return { error: null }
    } catch (error) {
      console.error('🧾 [Firebase deleteImpuesto] ERROR:', error)
      return { error }
    }
  }, [user, fetchAll])

  const addMedioPago = useCallback(async (nombre: string) => {
    if (!user) {
      console.error('💳 [Firebase addMedioPago] No user!')
      return { error: new Error('No user') }
    }

    console.log('💳 [Firebase addMedioPago] called', nombre)

    try {
      const insertData: any = {
        nombre,
        user_id: user.uid,
        created_at: serverTimestamp()
      }

      // Add workspace fields if in workspace mode
      if (currentWorkspace) {
        insertData.workspace_id = currentWorkspace.id
        insertData.created_by = user.uid
      }

      const mediosPagoRef = collection(db, 'medios_pago')
      await addDoc(mediosPagoRef, insertData)

      console.log('💳 [Firebase addMedioPago] SUCCESS - Calling fetchAll')
      await fetchAll()

      return { error: null }
    } catch (error) {
      console.error('💳 [Firebase addMedioPago] ERROR:', error)
      return { error }
    }
  }, [user, currentWorkspace, fetchAll])

  const deleteMedioPago = useCallback(async (id: string) => {
    if (!user) {
      console.error('💳 [Firebase deleteMedioPago] No user!')
      return { error: new Error('No user') }
    }

    console.log('💳 [Firebase deleteMedioPago] called', id)

    try {
      const medioPagoRef = doc(db, 'medios_pago', id)
      await deleteDoc(medioPagoRef)

      console.log('💳 [Firebase deleteMedioPago] SUCCESS - Calling fetchAll')
      await fetchAll()

      return { error: null }
    } catch (error) {
      console.error('💳 [Firebase deleteMedioPago] ERROR:', error)
      return { error }
    }
  }, [user, fetchAll])

  const addIngreso = useCallback(async (data: any) => {
    if (!user) {
      console.error('💵 [Firebase addIngreso] No user!')
      return { error: new Error('No user') }
    }

    console.log('💵 [Firebase addIngreso] called', data)

    try {
      const insertData: any = {
        ...data,
        user_id: user.uid,
        created_at: serverTimestamp()
      }

      // Add workspace fields if in workspace mode
      if (currentWorkspace) {
        insertData.workspace_id = currentWorkspace.id
        insertData.created_by = user.uid
      }

      const ingresosRef = collection(db, 'ingresos')
      const docRef = await addDoc(ingresosRef, insertData)

      console.log('💵 [Firebase addIngreso] SUCCESS - Calling fetchAll')
      await fetchAll()

      return { error: null, data: { id: docRef.id, ...data } }
    } catch (error) {
      console.error('💵 [Firebase addIngreso] ERROR:', error)
      return { error }
    }
  }, [user, currentWorkspace, fetchAll])

  const updateIngreso = useCallback(async (id: string, data: any) => {
    if (!user) {
      console.error('💵 [Firebase updateIngreso] No user!')
      return { error: new Error('No user') }
    }

    console.log('💵 [Firebase updateIngreso] called', id, data)

    try {
      const ingresoRef = doc(db, 'ingresos', id)
      await updateDoc(ingresoRef, data)

      console.log('💵 [Firebase updateIngreso] SUCCESS - Calling fetchAll')
      await fetchAll()

      return { error: null }
    } catch (error) {
      console.error('💵 [Firebase updateIngreso] ERROR:', error)
      return { error }
    }
  }, [user, fetchAll])

  const deleteIngreso = useCallback(async (id: string) => {
    if (!user) {
      console.error('💵 [Firebase deleteIngreso] No user!')
      return { error: new Error('No user') }
    }

    console.log('💵 [Firebase deleteIngreso] called', id)

    try {
      const ingresoRef = doc(db, 'ingresos', id)
      await deleteDoc(ingresoRef)

      console.log('💵 [Firebase deleteIngreso] SUCCESS - Calling fetchAll')
      await fetchAll()

      return { error: null }
    } catch (error) {
      console.error('💵 [Firebase deleteIngreso] ERROR:', error)
      return { error }
    }
  }, [user, fetchAll])

  const addTagIngreso = useCallback(async (nombre: string) => {
    if (!user) {
      console.error('🏷️ [Firebase addTagIngreso] No user!')
      return { error: new Error('No user') }
    }

    console.log('🏷️ [Firebase addTagIngreso] called', nombre)

    try {
      const insertData: any = {
        nombre,
        user_id: user.uid,
        created_at: serverTimestamp()
      }

      // Add workspace fields if in workspace mode
      if (currentWorkspace) {
        insertData.workspace_id = currentWorkspace.id
        insertData.created_by = user.uid
      }

      const tagsIngresosRef = collection(db, 'tags_ingresos')
      await addDoc(tagsIngresosRef, insertData)

      console.log('🏷️ [Firebase addTagIngreso] SUCCESS - Calling fetchAll')
      await fetchAll()

      return { error: null }
    } catch (error) {
      console.error('🏷️ [Firebase addTagIngreso] ERROR:', error)
      return { error }
    }
  }, [user, currentWorkspace, fetchAll])

  const deleteTagIngreso = useCallback(async (id: string) => {
    if (!user) {
      console.error('🏷️ [Firebase deleteTagIngreso] No user!')
      return { error: new Error('No user') }
    }

    console.log('🏷️ [Firebase deleteTagIngreso] called', id)

    try {
      const tagIngresoRef = doc(db, 'tags_ingresos', id)
      await deleteDoc(tagIngresoRef)

      console.log('🏷️ [Firebase deleteTagIngreso] SUCCESS - Calling fetchAll')
      await fetchAll()

      return { error: null }
    } catch (error) {
      console.error('🏷️ [Firebase deleteTagIngreso] ERROR:', error)
      return { error }
    }
  }, [user, fetchAll])

  const addCategoriaIngreso = useCallback(async (data: any) => {
    if (!user) {
      console.error('📂 [Firebase addCategoriaIngreso] No user!')
      return { error: new Error('No user') }
    }

    console.log('📂 [Firebase addCategoriaIngreso] called', data)

    try {
      const insertData: any = {
        ...data,
        user_id: user.uid,
        created_at: serverTimestamp()
      }

      // Add workspace fields if in workspace mode
      if (currentWorkspace) {
        insertData.workspace_id = currentWorkspace.id
        insertData.created_by = user.uid
      }

      const categoriasIngresosRef = collection(db, 'categorias_ingresos')
      await addDoc(categoriasIngresosRef, insertData)

      console.log('📂 [Firebase addCategoriaIngreso] SUCCESS - Calling fetchAll')
      await fetchAll()

      return { error: null }
    } catch (error) {
      console.error('📂 [Firebase addCategoriaIngreso] ERROR:', error)
      return { error }
    }
  }, [user, currentWorkspace, fetchAll])

  const updateCategoriaIngreso = useCallback(async (id: string, data: any) => {
    if (!user) {
      console.error('📂 [Firebase updateCategoriaIngreso] No user!')
      return { error: new Error('No user') }
    }

    console.log('📂 [Firebase updateCategoriaIngreso] called', id, data)

    try {
      const categoriaIngresoRef = doc(db, 'categorias_ingresos', id)
      await updateDoc(categoriaIngresoRef, data)

      console.log('📂 [Firebase updateCategoriaIngreso] SUCCESS - Calling fetchAll')
      await fetchAll()

      return { error: null }
    } catch (error) {
      console.error('📂 [Firebase updateCategoriaIngreso] ERROR:', error)
      return { error }
    }
  }, [user, fetchAll])

  const deleteCategoriaIngreso = useCallback(async (id: string) => {
    if (!user) {
      console.error('📂 [Firebase deleteCategoriaIngreso] No user!')
      return { error: new Error('No user') }
    }

    console.log('📂 [Firebase deleteCategoriaIngreso] called', id)

    try {
      const categoriaIngresoRef = doc(db, 'categorias_ingresos', id)
      await deleteDoc(categoriaIngresoRef)

      console.log('📂 [Firebase deleteCategoriaIngreso] SUCCESS - Calling fetchAll')
      await fetchAll()

      return { error: null }
    } catch (error) {
      console.error('📂 [Firebase deleteCategoriaIngreso] ERROR:', error)
      return { error }
    }
  }, [user, fetchAll])

  const getIngresosMes = useCallback((mes: string) => {
    console.log('📊 [Firebase getIngresosMes] called - mes:', mes, 'total ingresos:', ingresos.length)
    return ingresos.filter(i => i.mes === mes)
  }, [ingresos])

  const getGastosMes = useCallback((mes: string) => {
    console.log('📊 [Firebase getGastosMes] called - mes:', mes, 'total gastos:', gastos.length)

    return gastos.filter(g => {
      // Si es un gasto del mes exacto (coincide mes_facturacion)
      if (g.mes_facturacion === mes) return true

      // Si es fijo y fue creado antes de este mes, incluirlo en todos los meses siguientes
      if (g.es_fijo && g.mes_facturacion < mes) return true

      // Si tiene cuotas, verificar si está en el rango de cuotas
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

  console.log('📊 [Firebase useData] Creating context value - loading:', loading, 'movimientos:', movimientos.length)

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
