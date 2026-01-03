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
  Timestamp
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from './useAuth'
import { MovimientoAhorro, Meta, Tarjeta, Gasto, Impuesto, Categoria, Tag } from '@/types'

type DataContextType = {
  movimientos: MovimientoAhorro[]
  metas: Meta[]
  tarjetas: Tarjeta[]
  gastos: Gasto[]
  impuestos: Impuesto[]
  categorias: Categoria[]
  tags: Tag[]
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
  getGastosMes: (mes: string) => Gasto[]
  getImpuestosMes: (mes: string) => Impuesto[]
  getGastosNoProximoMes: (mesActual: string) => any
  getDiferenciaMeses: (mesActual: string, dolar: number) => any
}

const DataContext = createContext<DataContextType | undefined>(undefined)

export function DataProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth()

  console.log('📊 [Firebase DataProvider] RENDER - authLoading:', authLoading, 'user:', user?.uid || 'NULL')

  const [movimientos, setMovimientos] = useState<MovimientoAhorro[]>([])
  const [metas, setMetas] = useState<Meta[]>([])
  const [tarjetas, setTarjetas] = useState<Tarjeta[]>([])
  const [gastos, setGastos] = useState<Gasto[]>([])
  const [impuestos, setImpuestos] = useState<Impuesto[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [tags, setTags] = useState<Tag[]>([])
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

    setLoading(true)
    try {
      if (!user) {
        console.log('📊 [Firebase useData] No user - Clearing data')
        setMovimientos([])
        setLoading(false)
        return
      }

      console.log('📊 [Firebase useData] Fetching movimientos for user:', user.uid)
      const startTime = Date.now()

      // Fetch movimientos
      const movimientosRef = collection(db, 'movimientos_ahorro')
      const movimientosQuery = query(
        movimientosRef,
        where('user_id', '==', user.uid),
        orderBy('created_at', 'desc')
      )
      const movimientosSnap = await getDocs(movimientosQuery)
      const movimientosData = movimientosSnap.docs.map(doc => {
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
        where('user_id', '==', user.uid),
        orderBy('created_at', 'desc')
      )
      const metasSnap = await getDocs(metasQuery)
      const metasData = metasSnap.docs.map(doc => {
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
        where('user_id', '==', user.uid),
        orderBy('created_at', 'desc')
      )
      const tarjetasSnap = await getDocs(tarjetasQuery)
      const tarjetasData = tarjetasSnap.docs.map(doc => {
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
        where('user_id', '==', user.uid),
        orderBy('created_at', 'desc')
      )
      const gastosSnap = await getDocs(gastosQuery)
      const gastosData = gastosSnap.docs.map(doc => {
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
        where('user_id', '==', user.uid),
        orderBy('created_at', 'desc')
      )
      const impuestosSnap = await getDocs(impuestosQuery)
      const impuestosData = impuestosSnap.docs.map(doc => {
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
        where('user_id', '==', user.uid),
        orderBy('created_at', 'desc')
      )
      const categoriasSnap = await getDocs(categoriasQuery)
      let categoriasData = categoriasSnap.docs.map(doc => {
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
          await addDoc(categoriasRef, {
            ...categoria,
            user_id: user.uid,
            created_at: serverTimestamp()
          })
        }

        console.log('✅ [Firebase useData] Default categories created - Fetching again')

        // Volver a obtener las categorías
        const categoriasSnapNew = await getDocs(categoriasQuery)
        categoriasData = categoriasSnapNew.docs.map(doc => {
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
        where('user_id', '==', user.uid),
        orderBy('created_at', 'desc')
      )
      const tagsSnap = await getDocs(tagsQuery)
      const tagsData = tagsSnap.docs.map(doc => {
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

      const endTime = Date.now()
      console.log('📊 [Firebase useData] Data fetched successfully in', endTime - startTime, 'ms')

      setMovimientos(movimientosData)
      setMetas(metasData)
      setTarjetas(tarjetasData)
      setGastos(gastosData)
      setImpuestos(impuestosData)
      setCategorias(categoriasData)
      setTags(tagsData)
      setLoading(false)
    } catch (error) {
      console.error('📊 [Firebase useData] Error fetching data:', error)
      setLoading(false)
    }
  }, [user])

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
  }, [user, fetchAll])

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
      const insertData = {
        ...data,
        user_id: user.uid,
        completada: false,
        created_at: serverTimestamp()
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
  }, [user, fetchAll])

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
      const insertData = {
        nombre,
        user_id: user.uid,
        created_at: serverTimestamp()
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
  }, [user, fetchAll])

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
      const insertData = {
        ...data,
        user_id: user.uid,
        created_at: serverTimestamp()
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
  }, [user, fetchAll])

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
      const insertData = {
        ...data,
        user_id: user.uid,
        created_at: serverTimestamp()
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
  }, [user, fetchAll])

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
      const insertData = {
        ...data,
        user_id: user.uid,
        created_at: serverTimestamp()
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
  }, [user, fetchAll])

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
      const insertData = {
        ...data,
        user_id: user.uid,
        created_at: serverTimestamp()
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
  }, [user, fetchAll])

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
