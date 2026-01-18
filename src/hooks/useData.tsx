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
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('lastViewedMonth')
      if (saved) {
        try {
          // Validar que el formato sea correcto (YYYY-MM)
          const dateMatch = saved.match(/^\d{4}-\d{2}$/)
          if (dateMatch) {
            const parsedDate = new Date(saved + '-01')
            // Validar que la fecha sea válida
            if (!isNaN(parsedDate.getTime())) {
              return parsedDate
            }
          }
        } catch (e) {
          console.error('Error parsing saved month:', e)
        }
      }
    }
    return new Date()
  })

  const monthKey = currentMonth.toISOString().slice(0, 7)

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
  const fetchAll = useCallback(async () => {
    console.log('📊 [Firebase useData] fetchAll called')
    
    // 1. Limpieza de estados para evitar "fantasmas" al cambiar de usuario/workspace
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

    setLoading(true)
    try {
      if (!user) {
        setLoading(false)
        return
      }

      console.log('📊 [Firebase useData] Fetching data for workspace:', currentWorkspace?.name || 'Personal')
      const startTime = Date.now()

      const isWorkspaceMode = currentWorkspace !== null
      const workspaceFilter = isWorkspaceMode
        ? where('workspace_id', '==', currentWorkspace.id)
        : where('user_id', '==', user.uid)

      // 2. OBTENER PERMISOS
      let permissions: WorkspacePermissions = { 
        gastos: 'admin', 
        ingresos: 'admin', 
        ahorros: 'admin', 
        tarjetas: 'admin' 
      };

      if (isWorkspaceMode) {
        // Si el usuario es el dueño del workspace, tiene permisos de admin automáticamente
        const isOwner = currentWorkspace.owner_id === user.uid;
        
        if (isOwner) {
          // El dueño siempre tiene permisos de admin
          permissions = { gastos: 'admin', ingresos: 'admin', ahorros: 'admin', tarjetas: 'admin' };
          console.log('🔒 [useData] Usuario es dueño - Permisos admin aplicados');
        } else {
          // Si no es dueño, verificar permisos en workspace_members
          try {
            const memberQuery = query(
              collection(db, 'workspace_members'),
              where('workspace_id', '==', currentWorkspace.id),
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

      // --- AHORROS (Movimientos y Metas) ---
      if (permissions.ahorros !== 'ninguno') {
        // Movimientos
        const movimientosRef = collection(db, 'movimientos_ahorro')
        const movimientosQuery = query(movimientosRef, workspaceFilter, orderBy('created_at', 'desc'))
        const movimientosSnap = await getDocs(movimientosQuery)
        
        let movimientosDocs = isWorkspaceMode ? movimientosSnap.docs : movimientosSnap.docs.filter(d => !d.data().workspace_id)
        
        let movimientosData = movimientosDocs.map(doc => {
          const data = doc.data();
          let fecha: string
          if (data.created_at instanceof Timestamp) {
            fecha = data.created_at.toDate().toISOString()
          } else if (typeof data.created_at === 'string') {
            fecha = data.created_at
          } else {
            fecha = new Date().toISOString()
          }
          return { 
            id: doc.id, 
            tipo: data.tipo, 
            monto: data.monto, 
            user_id: data.user_id, 
            fecha, 
            descripcion: data.descripcion,
            created_by: data.created_by,
            workspace_id: data.workspace_id
          } as MovimientoAhorro
        })

        if (isWorkspaceMode && permissions.ahorros === 'solo_propios') {
          movimientosData = movimientosData.filter(m => m.user_id === user.uid)
        }
        setMovimientos(movimientosData)

        // Metas
        const metasRef = collection(db, 'metas')
        const metasQuery = query(metasRef, workspaceFilter, orderBy('created_at', 'desc'))
        const metasSnap = await getDocs(metasQuery)
        let metasDocs = isWorkspaceMode ? metasSnap.docs : metasSnap.docs.filter(d => !d.data().workspace_id)
        
        let metasData = metasDocs.map(doc => {
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
            created_at: data.created_at instanceof Timestamp ? data.created_at.toDate().toISOString() : data.created_at,
            created_by: data.created_by,
            workspace_id: data.workspace_id
          }
        }) as Meta[]

        if (isWorkspaceMode && permissions.ahorros === 'solo_propios') {
          metasData = metasData.filter(m => m.user_id === user.uid)
        }
        setMetas(metasData)
      }

      // --- TARJETAS ---
      if (permissions.tarjetas !== 'ninguno') {
        const tarjetasRef = collection(db, 'tarjetas')
        const tarjetasQuery = query(tarjetasRef, workspaceFilter, orderBy('created_at', 'desc'))
        const tarjetasSnap = await getDocs(tarjetasQuery)
        let tarjetasDocs = isWorkspaceMode ? tarjetasSnap.docs : tarjetasSnap.docs.filter(d => !d.data().workspace_id)

        let tarjetasData = tarjetasDocs.map(doc => {
          const data = doc.data()
          return {
            id: doc.id,
            user_id: data.user_id,
            nombre: data.nombre,
            tipo: data.tipo,
            banco: data.banco || null,
            digitos: data.digitos || null,
            cierre: data.cierre || null,
            created_at: data.created_at instanceof Timestamp ? data.created_at.toDate().toISOString() : data.created_at
          }
        }) as Tarjeta[]

        if (isWorkspaceMode && permissions.tarjetas === 'solo_propios') {
          tarjetasData = tarjetasData.filter(t => t.user_id === user.uid)
        }
        setTarjetas(tarjetasData)
      }

      // --- GASTOS E IMPUESTOS ---
      if (permissions.gastos !== 'ninguno') {
        // Gastos
        const gastosRef = collection(db, 'gastos')
        const gastosQuery = query(gastosRef, workspaceFilter, orderBy('created_at', 'desc'))
        const gastosSnap = await getDocs(gastosQuery)
        let gastosDocs = isWorkspaceMode ? gastosSnap.docs : gastosSnap.docs.filter(d => !d.data().workspace_id)

        let gastosData = gastosDocs.map(doc => {
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
            fecha_pago: data.fecha_pago || null,
            medio_pago: data.medio_pago || null,
            comprobante_url: data.comprobante_url || null,
            comprobante_nombre: data.comprobante_nombre || null,
            created_at: data.created_at instanceof Timestamp ? data.created_at.toDate().toISOString() : data.created_at
          }
        }) as Gasto[]

        if (isWorkspaceMode && permissions.gastos === 'solo_propios') {
          gastosData = gastosData.filter(g => g.user_id === user.uid)
        }
        setGastos(gastosData)

        // Impuestos
        const impuestosRef = collection(db, 'impuestos')
        const impuestosQuery = query(impuestosRef, workspaceFilter, orderBy('created_at', 'desc'))
        const impuestosSnap = await getDocs(impuestosQuery)
        let impuestosDocs = isWorkspaceMode ? impuestosSnap.docs : impuestosSnap.docs.filter(d => !d.data().workspace_id)

        let impuestosData = impuestosDocs.map(doc => {
          const data = doc.data()
          return {
            id: doc.id,
            user_id: data.user_id,
            tarjeta_id: data.tarjeta_id || null,
            descripcion: data.descripcion,
            monto: data.monto,
            mes: data.mes,
            created_at: data.created_at instanceof Timestamp ? data.created_at.toDate().toISOString() : data.created_at
          }
        }) as Impuesto[]

        if (isWorkspaceMode && permissions.gastos === 'solo_propios') {
          impuestosData = impuestosData.filter(i => i.user_id === user.uid)
        }
        setImpuestos(impuestosData)
      }

      // --- CONFIGURACIÓN (Categorías y Tags) ---
      const categoriasRef = collection(db, 'categorias')
      const categoriasQuery = query(categoriasRef, workspaceFilter, orderBy('created_at', 'desc'))
      const categoriasSnap = await getDocs(categoriasQuery)
      let categoriasDocs = isWorkspaceMode ? categoriasSnap.docs : categoriasSnap.docs.filter(d => !d.data().workspace_id)

      let categoriasData = categoriasDocs.map(doc => ({
          id: doc.id,
          user_id: doc.data().user_id,
          nombre: doc.data().nombre,
          icono: doc.data().icono,
          color: doc.data().color,
          created_at: doc.data().created_at instanceof Timestamp ? doc.data().created_at.toDate().toISOString() : doc.data().created_at
      })) as Categoria[]

      // Crear categorías por defecto si no existen (y tengo permiso de admin o es personal o soy dueño)
      const isOwner = isWorkspaceMode && currentWorkspace.owner_id === user.uid
      const canCreateCategories = !isWorkspaceMode || permissions.gastos === 'admin' || isOwner
      
      if (categoriasData.length === 0 && canCreateCategories) {
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
        // Fetch again
        const categoriasSnapNew = await getDocs(categoriasQuery)
        categoriasDocs = isWorkspaceMode ? categoriasSnapNew.docs : categoriasSnapNew.docs.filter(d => !d.data().workspace_id)
        categoriasData = categoriasDocs.map(doc => ({
            id: doc.id,
            user_id: doc.data().user_id,
            nombre: doc.data().nombre,
            icono: doc.data().icono,
            color: doc.data().color,
            created_at: doc.data().created_at instanceof Timestamp ? doc.data().created_at.toDate().toISOString() : doc.data().created_at
        })) as Categoria[]
      }
      setCategorias(categoriasData)

      // Tags
      const tagsRef = collection(db, 'tags')
      const tagsQuery = query(tagsRef, workspaceFilter, orderBy('created_at', 'desc'))
      const tagsSnap = await getDocs(tagsQuery)
      const tagsDocs = isWorkspaceMode ? tagsSnap.docs : tagsSnap.docs.filter(d => !d.data().workspace_id)
      const tagsData = tagsDocs.map(doc => ({
          id: doc.id,
          user_id: doc.data().user_id,
          nombre: doc.data().nombre,
          created_at: doc.data().created_at instanceof Timestamp ? doc.data().created_at.toDate().toISOString() : doc.data().created_at
      })) as Tag[]
      setTags(tagsData)

      // Medios Pago
      let mediosPagoData: MedioPago[] = []
      try {
        const mediosPagoRef = collection(db, 'medios_pago')
        const mediosPagoQuery = query(mediosPagoRef, workspaceFilter, orderBy('created_at', 'desc'))
        const mediosPagoSnap = await getDocs(mediosPagoQuery)
        const mediosPagoDocs = isWorkspaceMode ? mediosPagoSnap.docs : mediosPagoSnap.docs.filter(d => !d.data().workspace_id)
        mediosPagoData = mediosPagoDocs.map(doc => ({
            id: doc.id,
            user_id: doc.data().user_id,
            nombre: doc.data().nombre,
            created_at: doc.data().created_at instanceof Timestamp ? doc.data().created_at.toDate().toISOString() : doc.data().created_at
        })) as MedioPago[]
      } catch (e) {
        console.warn('Medios pago fetch failed', e)
      }
      setMediosPago(mediosPagoData)

      // --- INGRESOS ---
      if (permissions.ingresos !== 'ninguno') {
        const ingresosRef = collection(db, 'ingresos')
        const ingresosQuery = query(ingresosRef, workspaceFilter, orderBy('created_at', 'desc'))
        const ingresosSnap = await getDocs(ingresosQuery)
        let ingresosDocs = isWorkspaceMode ? ingresosSnap.docs : ingresosSnap.docs.filter(d => !d.data().workspace_id)

        let ingresosData = ingresosDocs.map(doc => {
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
            created_at: data.created_at instanceof Timestamp ? data.created_at.toDate().toISOString() : data.created_at
          }
        }) as Ingreso[]

        if (isWorkspaceMode && permissions.ingresos === 'solo_propios') {
          ingresosData = ingresosData.filter(i => i.user_id === user.uid)
        }
        setIngresos(ingresosData)
      }

      // Configuración de Ingresos (Categorías y Tags)
      const categoriasIngresosRef = collection(db, 'categorias_ingresos')
      const categoriasIngresosQuery = query(categoriasIngresosRef, workspaceFilter, orderBy('created_at', 'desc'))
      const categoriasIngresosSnap = await getDocs(categoriasIngresosQuery)
      let categoriasIngresosDocs = isWorkspaceMode ? categoriasIngresosSnap.docs : categoriasIngresosSnap.docs.filter(d => !d.data().workspace_id)
      
      let categoriasIngresosData = categoriasIngresosDocs.map(doc => ({
          id: doc.id,
          user_id: doc.data().user_id,
          nombre: doc.data().nombre,
          icono: doc.data().icono,
          color: doc.data().color,
          created_at: doc.data().created_at instanceof Timestamp ? doc.data().created_at.toDate().toISOString() : doc.data().created_at
      })) as CategoriaIngreso[]

      const canCreateCategoriasIngresos = !isWorkspaceMode || permissions.ingresos === 'admin' || isOwner
      if (categoriasIngresosData.length === 0 && canCreateCategoriasIngresos) {
         const defaultCategoriasIngresos = [
          { nombre: 'Salario', icono: '💼', color: '#3b82f6' },
          { nombre: 'Freelance', icono: '💻', color: '#8b5cf6' },
          { nombre: 'Inversiones', icono: '📈', color: '#10b981' },
          { nombre: 'Alquiler', icono: '🏠', color: '#f59e0b' },
          { nombre: 'Ventas', icono: '🛍️', color: '#ec4899' },
          { nombre: 'Otros', icono: '💵', color: '#6b7280' }
        ]
        const catIngRef = collection(db, 'categorias_ingresos')
        for (const categoria of defaultCategoriasIngresos) {
          const docData: any = { ...categoria, user_id: user.uid, created_at: serverTimestamp() }
          if (isWorkspaceMode) { docData.workspace_id = currentWorkspace.id; docData.created_by = user.uid }
          await addDoc(catIngRef, docData)
        }
        const newSnap = await getDocs(categoriasIngresosQuery)
        categoriasIngresosDocs = isWorkspaceMode ? newSnap.docs : newSnap.docs.filter(d => !d.data().workspace_id)
        categoriasIngresosData = categoriasIngresosDocs.map(doc => ({
            id: doc.id,
            user_id: doc.data().user_id,
            nombre: doc.data().nombre,
            icono: doc.data().icono,
            color: doc.data().color,
            created_at: doc.data().created_at instanceof Timestamp ? doc.data().created_at.toDate().toISOString() : doc.data().created_at
        })) as CategoriaIngreso[]
      }
      setCategoriasIngresos(categoriasIngresosData)

      const tagsIngresosRef = collection(db, 'tags_ingresos')
      const tagsIngresosQuery = query(tagsIngresosRef, workspaceFilter, orderBy('created_at', 'desc'))
      const tagsIngresosSnap = await getDocs(tagsIngresosQuery)
      const tagsIngresosDocs = isWorkspaceMode ? tagsIngresosSnap.docs : tagsIngresosSnap.docs.filter(d => !d.data().workspace_id)
      const tagsIngresosData = tagsIngresosDocs.map(doc => ({
          id: doc.id,
          user_id: doc.data().user_id,
          nombre: doc.data().nombre,
          created_at: doc.data().created_at instanceof Timestamp ? doc.data().created_at.toDate().toISOString() : doc.data().created_at
      })) as TagIngreso[]
      setTagsIngresos(tagsIngresosData)

      const endTime = Date.now()
      console.log('📊 [Firebase useData] Data fetched successfully in', endTime - startTime, 'ms')
      setLoading(false)

    } catch (error) {
      console.error('📊 [Firebase useData] Error fetching data:', error)
      setLoading(false)
    }
  }, [user, currentWorkspace])
  // --- FIN FETCHALL ---

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
    const insertData: any = {
      tipo,
      monto,
      user_id: user.uid,
      created_at: new Date().toISOString()
    }
    if (descripcion) insertData.descripcion = descripcion
    if (currentWorkspace) {
      insertData.workspace_id = currentWorkspace.id
      insertData.created_by = user.uid
    }

    try {
      await addDoc(collection(db, 'movimientos_ahorro'), insertData)
      await fetchAll()
      return { error: null }
    } catch (error) {
      return { error }
    }
  }, [user, currentWorkspace, fetchAll])

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
      const insertData: any = { ...data, user_id: user.uid, completada: false, created_at: serverTimestamp() }
      if (currentWorkspace) { insertData.workspace_id = currentWorkspace.id; insertData.created_by = user.uid }
      await addDoc(collection(db, 'metas'), insertData); await fetchAll(); return { error: null }
    } catch (error) { return { error } }
  }, [user, currentWorkspace, fetchAll])

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
      const insertData: any = { nombre, user_id: user.uid, created_at: serverTimestamp() }
      if (currentWorkspace) { insertData.workspace_id = currentWorkspace.id; insertData.created_by = user.uid }
      await addDoc(collection(db, 'tags'), insertData); await fetchAll(); return { error: null }
    } catch (error) { return { error } }
  }, [user, currentWorkspace, fetchAll])

  const deleteTag = useCallback(async (id: string) => {
    if (!user) return { error: new Error('No user') }
    try { await deleteDoc(doc(db, 'tags', id)); await fetchAll(); return { error: null } } catch (error) { return { error } }
  }, [user, fetchAll])

  const addCategoria = useCallback(async (data: any) => {
    if (!user) return { error: new Error('No user') }
    try {
      const insertData: any = { ...data, user_id: user.uid, created_at: serverTimestamp() }
      if (currentWorkspace) { insertData.workspace_id = currentWorkspace.id; insertData.created_by = user.uid }
      await addDoc(collection(db, 'categorias'), insertData); await fetchAll(); return { error: null }
    } catch (error) { return { error } }
  }, [user, currentWorkspace, fetchAll])

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
      const insertData: any = { ...data, user_id: user.uid, created_at: serverTimestamp() }
      if (currentWorkspace) { insertData.workspace_id = currentWorkspace.id; insertData.created_by = user.uid }
      const docRef = await addDoc(collection(db, 'gastos'), insertData); await fetchAll(); return { error: null, data: { id: docRef.id, ...data } }
    } catch (error) { return { error } }
  }, [user, currentWorkspace, fetchAll])

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
      const insertData: any = { ...data, user_id: user.uid, created_at: serverTimestamp() }
      if (currentWorkspace) { insertData.workspace_id = currentWorkspace.id; insertData.created_by = user.uid }
      await addDoc(collection(db, 'tarjetas'), insertData); await fetchAll(); return { error: null }
    } catch (error) { return { error } }
  }, [user, currentWorkspace, fetchAll])

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
      const insertData: any = { ...data, user_id: user.uid, created_at: serverTimestamp() }
      if (currentWorkspace) { insertData.workspace_id = currentWorkspace.id; insertData.created_by = user.uid }
      await addDoc(collection(db, 'impuestos'), insertData); await fetchAll(); return { error: null }
    } catch (error) { return { error } }
  }, [user, currentWorkspace, fetchAll])

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
      const insertData: any = { nombre, user_id: user.uid, created_at: serverTimestamp() }
      if (currentWorkspace) { insertData.workspace_id = currentWorkspace.id; insertData.created_by = user.uid }
      await addDoc(collection(db, 'medios_pago'), insertData); await fetchAll(); return { error: null }
    } catch (error) { return { error } }
  }, [user, currentWorkspace, fetchAll])

  const deleteMedioPago = useCallback(async (id: string) => {
    if (!user) return { error: new Error('No user') }
    try { await deleteDoc(doc(db, 'medios_pago', id)); await fetchAll(); return { error: null } } catch (error) { return { error } }
  }, [user, fetchAll])

  const addIngreso = useCallback(async (data: any) => {
    if (!user) return { error: new Error('No user') }
    try {
      const insertData: any = { ...data, user_id: user.uid, created_at: serverTimestamp() }
      if (currentWorkspace) { insertData.workspace_id = currentWorkspace.id; insertData.created_by = user.uid }
      const docRef = await addDoc(collection(db, 'ingresos'), insertData); await fetchAll(); return { error: null, data: { id: docRef.id, ...data } }
    } catch (error) { return { error } }
  }, [user, currentWorkspace, fetchAll])

  const updateIngreso = useCallback(async (id: string, data: any) => {
    if (!user) return { error: new Error('No user') }
    try { await updateDoc(doc(db, 'ingresos', id), data); await fetchAll(); return { error: null } } catch (error) { return { error } }
  }, [user, fetchAll])

  const deleteIngreso = useCallback(async (id: string) => {
    if (!user) return { error: new Error('No user') }
    try { await deleteDoc(doc(db, 'ingresos', id)); await fetchAll(); return { error: null } } catch (error) { return { error } }
  }, [user, fetchAll])

  const addTagIngreso = useCallback(async (nombre: string) => {
    if (!user) return { error: new Error('No user') }
    try {
      const insertData: any = { nombre, user_id: user.uid, created_at: serverTimestamp() }
      if (currentWorkspace) { insertData.workspace_id = currentWorkspace.id; insertData.created_by = user.uid }
      await addDoc(collection(db, 'tags_ingresos'), insertData); await fetchAll(); return { error: null }
    } catch (error) { return { error } }
  }, [user, currentWorkspace, fetchAll])

  const deleteTagIngreso = useCallback(async (id: string) => {
    if (!user) return { error: new Error('No user') }
    try { await deleteDoc(doc(db, 'tags_ingresos', id)); await fetchAll(); return { error: null } } catch (error) { return { error } }
  }, [user, fetchAll])

  const addCategoriaIngreso = useCallback(async (data: any) => {
    if (!user) return { error: new Error('No user') }
    try {
      const insertData: any = { ...data, user_id: user.uid, created_at: serverTimestamp() }
      if (currentWorkspace) { insertData.workspace_id = currentWorkspace.id; insertData.created_by = user.uid }
      await addDoc(collection(db, 'categorias_ingresos'), insertData); await fetchAll(); return { error: null }
    } catch (error) { return { error } }
  }, [user, currentWorkspace, fetchAll])

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
    return ingresos.filter(i => i.mes === mes)
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
