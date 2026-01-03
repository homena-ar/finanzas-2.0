'use client'

import { useState, useEffect, useCallback, createContext, useContext, ReactNode, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { useAuth } from './useAuth'
import { Tarjeta, Gasto, Impuesto, Categoria, Tag, Meta, MovimientoAhorro } from '@/types'
import { getMonthKey } from '@/lib/utils'

type DataContextType = {
  tarjetas: Tarjeta[]
  gastos: Gasto[]
  impuestos: Impuesto[]
  categorias: Categoria[]
  tags: Tag[]
  metas: Meta[]
  movimientos: MovimientoAhorro[]
  loading: boolean
  currentMonth: Date
  monthKey: string
  fetchAll: () => Promise<void>
  changeMonth: (delta: number) => void
  addTarjeta: (data: Omit<Tarjeta, 'id' | 'user_id' | 'created_at'>) => Promise<{ error: any }>
  updateTarjeta: (id: string, data: Partial<Tarjeta>) => Promise<{ error: any }>
  deleteTarjeta: (id: string) => Promise<{ error: any }>
  addGasto: (data: Omit<Gasto, 'id' | 'user_id' | 'created_at' | 'tarjeta' | 'categoria' | 'tags'>) => Promise<{ error: any, data?: Gasto }>
  updateGasto: (id: string, data: Partial<Gasto>) => Promise<{ error: any }>
  deleteGasto: (id: string) => Promise<{ error: any }>
  addImpuesto: (data: Omit<Impuesto, 'id' | 'user_id' | 'created_at' | 'tarjeta'>) => Promise<{ error: any }>
  updateImpuesto: (id: string, data: Partial<Impuesto>) => Promise<{ error: any }>
  deleteImpuesto: (id: string) => Promise<{ error: any }>
  addTag: (nombre: string) => Promise<{ error: any }>
  deleteTag: (id: string) => Promise<{ error: any }>
  addMeta: (data: Omit<Meta, 'id' | 'user_id' | 'created_at' | 'completada'>) => Promise<{ error: any }>
  updateMeta: (id: string, data: Partial<Meta>) => Promise<{ error: any }>
  deleteMeta: (id: string) => Promise<{ error: any }>
  addMovimiento: (tipo: 'pesos' | 'usd', monto: number) => Promise<{ error: any }>
  getGastosMes: (mes: string) => Gasto[]
  getImpuestosMes: (mes: string) => Impuesto[]
  getGastosNoProximoMes: (mesActual: string) => {
    gastos: Gasto[]
    cantidad: number
    totalARS: number
    totalUSD: number
  }
  getDiferenciaMeses: (mesActual: string, dolar: number) => {
    actual: { ars: number; usd: number; imp: number; total: number }
    proximo: { ars: number; usd: number; imp: number; total: number }
    diferencia: number
    diferenciaARS: number
    diferenciaUSD: number
  }
}

const DataContext = createContext<DataContextType | undefined>(undefined)

// Counter to detect infinite loops
let fetchAllCallCount = 0

export function DataProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth()
  const supabase = useMemo(() => createClient(), [])

  // Use ref to maintain stable reference to user
  const userRef = useRef(user)
  useEffect(() => {
    userRef.current = user
  }, [user])

  console.log('📊 [DataProvider] RENDER - authLoading:', authLoading, 'user:', user?.id || 'NULL')

  const [tarjetas, setTarjetas] = useState<Tarjeta[]>([])
  const [gastos, setGastos] = useState<Gasto[]>([])
  const [impuestos, setImpuestos] = useState<Impuesto[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [metas, setMetas] = useState<Meta[]>([])
  const [movimientos, setMovimientos] = useState<MovimientoAhorro[]>([])
  const [loading, setLoading] = useState(true)
  const [currentMonth, setCurrentMonth] = useState(new Date())

  const fetchAll = useCallback(async () => {
    const currentUser = userRef.current
    fetchAllCallCount++
    console.log('📊 [useData] fetchAll called #' + fetchAllCallCount + ' - Setting loading to TRUE')
    console.log('📊 [useData] fetchAll - Current user.id:', currentUser?.id)

    if (fetchAllCallCount > 10) {
      console.error('🚨 [useData] fetchAll called more than 10 times! Infinite loop detected!')
      console.trace('Stack trace:')
      return
    }

    setLoading(true)
    try {
      if (!currentUser) {
        console.log('📊 [useData] No user - Clearing data and setting loading to FALSE')
        setTarjetas([])
        setGastos([])
        setImpuestos([])
        setCategorias([])
        setTags([])
        setMetas([])
        setMovimientos([])
        setLoading(false)
        return
      }

      console.log('📊 [useData] Fetching data for user:', currentUser.id)
      const startTime = Date.now()

      // Try simple queries first - without joins
      console.log('📊 [useData] Fetching tarjetas...')
      const { data: tarjetasData, error: tarjetasError } = await supabase
        .from('tarjetas')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('created_at')
      console.log('📊 [useData] Tarjetas result:', tarjetasData?.length || 0, 'rows', tarjetasError ? 'ERROR: ' + JSON.stringify(tarjetasError) : '')

      console.log('📊 [useData] Fetching categorias...')
      const { data: categoriasData, error: categoriasError } = await supabase
        .from('categorias')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('nombre')
      console.log('📊 [useData] Categorias result:', categoriasData?.length || 0, 'rows', categoriasError ? 'ERROR: ' + JSON.stringify(categoriasError) : '')

      console.log('📊 [useData] Fetching gastos with joins...')
      const { data: gastosData, error: gastosError } = await supabase
        .from('gastos')
        .select('*, tarjeta:tarjetas(*), categoria:categorias(*)')
        .eq('user_id', currentUser.id)
        .order('fecha', { ascending: false })
      console.log('📊 [useData] Gastos result:', gastosData?.length || 0, 'rows', gastosError ? 'ERROR: ' + JSON.stringify(gastosError) : '')

      console.log('📊 [useData] Fetching impuestos...')
      const { data: impuestosData, error: impuestosError } = await supabase
        .from('impuestos')
        .select('*, tarjeta:tarjetas(*)')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false })
      console.log('📊 [useData] Impuestos result:', impuestosData?.length || 0, 'rows', impuestosError ? 'ERROR: ' + JSON.stringify(impuestosError) : '')

      console.log('📊 [useData] Fetching tags...')
      const { data: tagsData, error: tagsError} = await supabase
        .from('tags')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('nombre')
      console.log('📊 [useData] Tags result:', tagsData?.length || 0, 'rows', tagsError ? 'ERROR: ' + JSON.stringify(tagsError) : '')

      console.log('📊 [useData] Fetching metas...')
      const { data: metasData, error: metasError } = await supabase
        .from('metas')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('created_at')
      console.log('📊 [useData] Metas result:', metasData?.length || 0, 'rows', metasError ? 'ERROR: ' + JSON.stringify(metasError) : '')

      console.log('📊 [useData] Fetching movimientos...')
      const { data: movimientosData, error: movimientosError } = await supabase
        .from('movimientos_ahorro')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('fecha', { ascending: false })
        .limit(20)
      console.log('📊 [useData] Movimientos result:', movimientosData?.length || 0, 'rows', movimientosError ? 'ERROR: ' + JSON.stringify(movimientosError) : '')

      console.log('📊 [useData] All queries completed!')

      // Log any errors
      if (tarjetasError) console.error('📊 [useData] Error fetching tarjetas:', tarjetasError)
      if (gastosError) console.error('📊 [useData] Error fetching gastos:', gastosError)
      if (impuestosError) console.error('📊 [useData] Error fetching impuestos:', impuestosError)
      if (categoriasError) console.error('📊 [useData] Error fetching categorias:', categoriasError)
      if (tagsError) console.error('📊 [useData] Error fetching tags:', tagsError)
      if (metasError) console.error('📊 [useData] Error fetching metas:', metasError)
      if (movimientosError) console.error('📊 [useData] Error fetching movimientos:', movimientosError)

      const elapsed = Date.now() - startTime
      console.log('📊 [useData] Data fetched successfully in', elapsed, 'ms')
      console.log('📊 [useData] Fetched:', tarjetasData?.length || 0, 'tarjetas,', gastosData?.length || 0, 'gastos')
      setTarjetas(tarjetasData || [])
      setGastos(gastosData || [])
      setImpuestos(impuestosData || [])
      setCategorias(categoriasData || [])
      setTags(tagsData || [])
      setMetas(metasData || [])
      setMovimientos(movimientosData || [])
    } catch (error) {
      console.error('📊 [useData] Error fetching data', error)
      console.error('📊 [useData] Error stack:', error instanceof Error ? error.stack : 'No stack')
      setTarjetas([])
      setGastos([])
      setImpuestos([])
      setCategorias([])
      setTags([])
      setMetas([])
      setMovimientos([])
    } finally {
      console.log('📊 [useData] Setting loading to FALSE')
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase])

  useEffect(() => {
    console.log('📊 [useData] useEffect triggered - authLoading:', authLoading, 'user:', user?.id || 'NULL')

    // If we have a user, fetch data regardless of authLoading
    // authLoading might be true while fetching profile, but we can still fetch data
    if (user) {
      console.log('📊 [useData] User exists - Calling fetchAll regardless of authLoading')
      fetchAll()
      return
    }

    // If no user and auth is still loading, wait
    if (authLoading) {
      console.log('📊 [useData] No user and auth still loading - Setting loading to TRUE and waiting')
      setLoading(true)
      return
    }

    // If no user and auth finished loading, clear data
    console.log('📊 [useData] No user and auth finished - Calling fetchAll to clear data')
    fetchAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user?.id])

  useEffect(() => {
    if (user) {
      setCurrentMonth(new Date())
    }
  }, [user])

  // Tarjetas CRUD
  const addTarjeta = useCallback(async (data: Omit<Tarjeta, 'id' | 'user_id' | 'created_at'>) => {
    console.log('💳 [useData] addTarjeta called with data:', data)
    const { data: newTarjeta, error } = await supabase
      .from('tarjetas')
      .insert({ ...data, user_id: userRef.current!.id })
      .select()
      .single()
    if (!error && newTarjeta) setTarjetas(prev => [...prev, newTarjeta])
    return { error }
  }, [supabase])

  const updateTarjeta = useCallback(async (id: string, data: Partial<Tarjeta>) => {
    console.log('💳 [useData] updateTarjeta called for id:', id)
    const { error } = await supabase.from('tarjetas').update(data).eq('id', id)
    if (!error) setTarjetas(prev => prev.map(t => t.id === id ? { ...t, ...data } : t))
    return { error }
  }, [supabase])

  const deleteTarjeta = useCallback(async (id: string) => {
    console.log('💳 [useData] deleteTarjeta called for id:', id)
    const { error } = await supabase.from('tarjetas').delete().eq('id', id)
    if (!error) setTarjetas(prev => prev.filter(t => t.id !== id))
    return { error }
  }, [supabase])

  // Gastos CRUD
  const addGasto = useCallback(async (data: Omit<Gasto, 'id' | 'user_id' | 'created_at' | 'tarjeta' | 'categoria' | 'tags'>) => {
    console.log('💰 [useData] addGasto called with data:', data)
    console.log('💰 [useData] addGasto - user.id:', userRef.current?.id)

    try {
      const insertData = { ...data, user_id: userRef.current!.id }
      console.log('💰 [useData] addGasto - Inserting:', insertData)

      const { data: newGasto, error } = await supabase
        .from('gastos')
        .insert(insertData)
        .select('*, tarjeta:tarjetas(*), categoria:categorias(*)')
        .single()

      console.log('💰 [useData] addGasto - Result:', { newGasto, error })

      if (error) {
        console.error('💰 [useData] addGasto ERROR:', error)
        console.error('💰 [useData] addGasto ERROR details:', JSON.stringify(error, null, 2))
        return { error, data: undefined }
      }

      if (newGasto) {
        console.log('💰 [useData] addGasto SUCCESS - Adding to state')
        setGastos(prev => [newGasto, ...prev])
      }

      return { error: null, data: newGasto }
    } catch (err) {
      console.error('💰 [useData] addGasto EXCEPTION:', err)
      return { error: err as any, data: undefined }
    }
  }, [supabase])

  const updateGasto = useCallback(async (id: string, data: Partial<Gasto>) => {
    console.log('💰 [useData] updateGasto called for id:', id)
    const { error } = await supabase.from('gastos').update(data).eq('id', id)
    if (!error) {
      const { data: updated } = await supabase
        .from('gastos')
        .select('*, tarjeta:tarjetas(*), categoria:categorias(*)')
        .eq('id', id)
        .single()
      if (updated) setGastos(prev => prev.map(g => g.id === id ? updated : g))
    }
    return { error }
  }, [supabase])

  const deleteGasto = useCallback(async (id: string) => {
    console.log('💰 [useData] deleteGasto called for id:', id)
    const { error } = await supabase.from('gastos').delete().eq('id', id)
    if (!error) setGastos(prev => prev.filter(g => g.id !== id))
    return { error }
  }, [supabase])

  // Impuestos CRUD
  const addImpuesto = useCallback(async (data: Omit<Impuesto, 'id' | 'user_id' | 'created_at' | 'tarjeta'>) => {
    console.log('📝 [useData] addImpuesto called with data:', data)
    const { data: newImp, error } = await supabase
      .from('impuestos')
      .insert({ ...data, user_id: userRef.current!.id })
      .select('*, tarjeta:tarjetas(*)')
      .single()
    if (!error && newImp) setImpuestos(prev => [newImp, ...prev])
    return { error }
  }, [supabase])

  const updateImpuesto = useCallback(async (id: string, data: Partial<Impuesto>) => {
    console.log('📝 [useData] updateImpuesto called for id:', id)
    const { error } = await supabase.from('impuestos').update(data).eq('id', id)
    if (!error) {
      const { data: updated } = await supabase
        .from('impuestos')
        .select('*, tarjeta:tarjetas(*)')
        .eq('id', id)
        .single()
      if (updated) setImpuestos(prev => prev.map(i => i.id === id ? updated : i))
    }
    return { error }
  }, [supabase])

  const deleteImpuesto = useCallback(async (id: string) => {
    console.log('📝 [useData] deleteImpuesto called for id:', id)
    const { error } = await supabase.from('impuestos').delete().eq('id', id)
    if (!error) setImpuestos(prev => prev.filter(i => i.id !== id))
    return { error }
  }, [supabase])

  // Tags CRUD
  const addTag = useCallback(async (nombre: string) => {
    console.log('🏷️ [useData] addTag called with nombre:', nombre)
    const { data: newTag, error } = await supabase
      .from('tags')
      .insert({ nombre, user_id: userRef.current!.id })
      .select()
      .single()
    if (!error && newTag) setTags(prev => [...prev, newTag])
    return { error }
  }, [supabase])

  const deleteTag = useCallback(async (id: string) => {
    console.log('🏷️ [useData] deleteTag called for id:', id)
    const { error } = await supabase.from('tags').delete().eq('id', id)
    if (!error) setTags(prev => prev.filter(t => t.id !== id))
    return { error }
  }, [supabase])

  // Metas CRUD
  const addMeta = useCallback(async (data: Omit<Meta, 'id' | 'user_id' | 'created_at' | 'completada'>) => {
    console.log('🎯 [useData] addMeta called with data:', data)
    const { data: newMeta, error } = await supabase
      .from('metas')
      .insert({ ...data, user_id: userRef.current!.id })
      .select()
      .single()
    if (!error && newMeta) setMetas(prev => [...prev, newMeta])
    return { error }
  }, [supabase])

  const updateMeta = useCallback(async (id: string, data: Partial<Meta>) => {
    console.log('🎯 [useData] updateMeta called for id:', id)
    const { error } = await supabase.from('metas').update(data).eq('id', id)
    if (!error) setMetas(prev => prev.map(m => m.id === id ? { ...m, ...data } : m))
    return { error }
  }, [supabase])

  const deleteMeta = useCallback(async (id: string) => {
    console.log('🎯 [useData] deleteMeta called for id:', id)
    const { error } = await supabase.from('metas').delete().eq('id', id)
    if (!error) setMetas(prev => prev.filter(m => m.id !== id))
    return { error }
  }, [supabase])

  // Ahorros
  const addMovimiento = useCallback(async (tipo: 'pesos' | 'usd', monto: number) => {
    console.log('💵 [useData] addMovimiento called - tipo:', tipo, 'monto:', monto)
    console.log('💵 [useData] addMovimiento - user.id:', userRef.current?.id)

    try {
      const insertData = { tipo, monto, user_id: userRef.current!.id }
      console.log('💵 [useData] addMovimiento - Inserting:', insertData)

      const { error } = await supabase
        .from('movimientos_ahorro')
        .insert(insertData)

      console.log('💵 [useData] addMovimiento - Result error:', error)

      if (error) {
        console.error('💵 [useData] addMovimiento ERROR:', error)
        console.error('💵 [useData] addMovimiento ERROR details:', JSON.stringify(error, null, 2))
        return { error }
      }

      console.log('💵 [useData] addMovimiento SUCCESS - Calling fetchAll')
      fetchAll()
      return { error: null }
    } catch (err) {
      console.error('💵 [useData] addMovimiento EXCEPTION:', err)
      return { error: err as any }
    }
  }, [supabase, fetchAll])

  // CORREGIDO: Filtrar gastos por mes correctamente
  const getGastosMes = useCallback((mes: string) => {
    return gastos.filter(g => {
      // Gastos fijos siempre aparecen (pero solo si tienen ese mes_facturacion o anterior)
      if (g.es_fijo) {
        // Solo mostrar fijos si el mes_facturacion es igual o anterior al mes consultado
        const mesFact = new Date(g.mes_facturacion + '-01')
        const mesConsulta = new Date(mes + '-01')
        return mesFact <= mesConsulta
      }

      // Gastos en cuotas
      if (g.cuotas > 1) {
        const start = new Date(g.mes_facturacion + '-01')
        const current = new Date(mes + '-01')
        const diff = (current.getFullYear() - start.getFullYear()) * 12 + current.getMonth() - start.getMonth()
        return diff >= 0 && diff < g.cuotas
      }

      // Gastos normales: solo en su mes de facturación
      return g.mes_facturacion === mes
    })
  }, [gastos])

  const getImpuestosMes = useCallback((mes: string) => {
    return impuestos.filter(i => i.mes === mes)
  }, [impuestos])

  // NUEVO: Calcular gastos que NO vienen el próximo mes
  const getGastosNoProximoMes = useCallback((mesActual: string) => {
    const gastosActuales = getGastosMes(mesActual)
    const nextMonth = new Date(mesActual + '-01')
    nextMonth.setMonth(nextMonth.getMonth() + 1)
    const nextMonthKey = getMonthKey(nextMonth)
    const gastosProximo = getGastosMes(nextMonthKey)

    // Gastos que están en el mes actual pero NO en el próximo (excluyendo fijos)
    const noVienen = gastosActuales.filter(g => {
      if (g.es_fijo) return false // Los fijos siempre vienen
      return !gastosProximo.some(gp => gp.id === g.id)
    })

    let totalARS = 0
    let totalUSD = 0
    noVienen.forEach(g => {
      const monto = g.cuotas > 1 ? g.monto / g.cuotas : g.monto
      if (g.moneda === 'USD') totalUSD += monto
      else totalARS += monto
    })

    return {
      gastos: noVienen,
      cantidad: noVienen.length,
      totalARS,
      totalUSD
    }
  }, [getGastosMes])

  // NUEVO: Calcular diferencia entre mes actual y próximo
  const getDiferenciaMeses = useCallback((mesActual: string, dolar: number) => {
    const gastosActuales = getGastosMes(mesActual)
    const impuestosActuales = getImpuestosMes(mesActual)

    const nextMonth = new Date(mesActual + '-01')
    nextMonth.setMonth(nextMonth.getMonth() + 1)
    const nextMonthKey = getMonthKey(nextMonth)

    const gastosProximo = getGastosMes(nextMonthKey)
    const impuestosProximo = getImpuestosMes(nextMonthKey)

    // Total actual
    let totalActualARS = 0
    let totalActualUSD = 0
    gastosActuales.forEach(g => {
      const monto = g.cuotas > 1 ? g.monto / g.cuotas : g.monto
      if (g.moneda === 'USD') totalActualUSD += monto
      else totalActualARS += monto
    })
    const totalImpActual = impuestosActuales.reduce((s, i) => s + i.monto, 0)

    // Total próximo
    let totalProximoARS = 0
    let totalProximoUSD = 0
    gastosProximo.forEach(g => {
      const monto = g.cuotas > 1 ? g.monto / g.cuotas : g.monto
      if (g.moneda === 'USD') totalProximoUSD += monto
      else totalProximoARS += monto
    })
    const totalImpProximo = impuestosProximo.reduce((s, i) => s + i.monto, 0)

    const totalActual = totalActualARS + totalImpActual + (totalActualUSD * dolar)
    const totalProximo = totalProximoARS + totalImpProximo + (totalProximoUSD * dolar)

    return {
      actual: { ars: totalActualARS, usd: totalActualUSD, imp: totalImpActual, total: totalActual },
      proximo: { ars: totalProximoARS, usd: totalProximoUSD, imp: totalImpProximo, total: totalProximo },
      diferencia: totalActual - totalProximo,
      diferenciaARS: totalActualARS - totalProximoARS,
      diferenciaUSD: totalActualUSD - totalProximoUSD
    }
  }, [getGastosMes, getImpuestosMes])

  const changeMonth = useCallback((delta: number) => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + delta, 1))
  }, [])

  const value: DataContextType = useMemo(() => {
    console.log('📊 [useData] Creating context value - loading:', loading, 'tarjetas:', tarjetas.length, 'gastos:', gastos.length)
    return {
      tarjetas, gastos, impuestos, categorias, tags, metas, movimientos,
      loading, currentMonth, monthKey: getMonthKey(currentMonth),
      fetchAll, changeMonth,
      addTarjeta, updateTarjeta, deleteTarjeta,
      addGasto, updateGasto, deleteGasto,
      addImpuesto, updateImpuesto, deleteImpuesto,
      addTag, deleteTag,
      addMeta, updateMeta, deleteMeta,
      addMovimiento,
      getGastosMes, getImpuestosMes,
      getGastosNoProximoMes, getDiferenciaMeses
    }
  }, [
    tarjetas, gastos, impuestos, categorias, tags, metas, movimientos,
    loading, currentMonth,
    fetchAll, changeMonth,
    addTarjeta, updateTarjeta, deleteTarjeta,
    addGasto, updateGasto, deleteGasto,
    addImpuesto, updateImpuesto, deleteImpuesto,
    addTag, deleteTag,
    addMeta, updateMeta, deleteMeta,
    addMovimiento,
    getGastosMes, getImpuestosMes,
    getGastosNoProximoMes, getDiferenciaMeses
  ])

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  )
}

export function useData() {
  const context = useContext(DataContext)
  if (!context) {
    throw new Error('useData must be used within DataProvider')
  }
  return context
}
