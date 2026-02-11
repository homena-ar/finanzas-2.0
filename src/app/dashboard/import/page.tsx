'use client'

import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { db } from '@/lib/firebase'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { Download, CheckCircle, AlertCircle, Loader } from 'lucide-react'
import { AlertModal } from '@/components/Modal'

interface ImportProgress {
  collection: string
  status: 'pending' | 'loading' | 'success' | 'error'
  count: number
  error?: string
}

interface ModalState {
  isOpen: boolean
  title: string
  message: string
  variant: 'success' | 'error' | 'warning' | 'info'
}

export default function ImportPage() {
  const { user, profile } = useAuth()
  const [supabaseUrl, setSupabaseUrl] = useState('https://yzhmctutglxnamzgwyrp.supabase.co')
  const [supabaseKey, setSupabaseKey] = useState('')
  const [importing, setImporting] = useState(false)
  const [testing, setTesting] = useState(false)
  const [progress, setProgress] = useState<ImportProgress[]>([])
  const [log, setLog] = useState<string[]>([])
  const [modal, setModal] = useState<ModalState>({
    isOpen: false,
    title: '',
    message: '',
    variant: 'info'
  })

  const showModal = (title: string, message: string, variant: ModalState['variant'] = 'info') => {
    setModal({ isOpen: true, title, message, variant })
  }

  const closeModal = () => {
    setModal(prev => ({ ...prev, isOpen: false }))
  }

  const addLog = (message: string) => {
    console.log(message)
    setLog(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`])
  }

  const updateProgress = (collection: string, status: ImportProgress['status'], count: number = 0, error?: string) => {
    setProgress(prev => {
      const existing = prev.find(p => p.collection === collection)
      if (existing) {
        return prev.map(p => p.collection === collection ? { ...p, status, count, error } : p)
      }
      return [...prev, { collection, status, count, error }]
    })
  }

  const fetchFromSupabase = async (table: string) => {
    addLog(`Fetching ${table} from Supabase...`)

    // Try without RLS filter first (using service_role key should bypass RLS)
    const response = await fetch(
      `${supabaseUrl}/rest/v1/${table}?select=*`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`
        }
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      addLog(`❌ HTTP Error ${response.status}: ${errorText}`)
      throw new Error(`Failed to fetch ${table}: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    addLog(`✅ Found ${data.length} records in ${table}`)

    if (data.length > 0 && table === 'gastos') {
      // Log a sample to help debug user_id issues
      const sample = data[0]
      addLog(`📋 Sample gasto: user_id=${sample.user_id}, descripcion=${sample.descripcion}`)
    }

    return data
  }

  const importToFirestore = async (collectionName: string, data: any[]) => {
    if (!user) return 0

    addLog(`Importing ${data.length} records to ${collectionName}...`)
    const collectionRef = collection(db, collectionName)
    let imported = 0

    for (const item of data) {
      try {
        // Remove id from Supabase and add Firebase user_id
        const { id, created_at, updated_at, ...rest } = item
        const firebaseData = {
          ...rest,
          user_id: user.uid,
          created_at: created_at ? new Date(created_at).toISOString() : new Date().toISOString()
        }

        await addDoc(collectionRef, firebaseData)
        imported++
      } catch (error) {
        console.error(`Error importing to ${collectionName}:`, error)
      }
    }

    addLog(`✅ Imported ${imported}/${data.length} records to ${collectionName}`)
    return imported
  }

  const testConnection = async () => {
    if (!supabaseKey) {
      showModal('Falta información', 'Por favor ingresá la Supabase Key', 'warning')
      return
    }

    setTesting(true)
    setLog([])
    addLog('🔍 Probando conexión a Supabase...')

    try {
      // Test connection with gastos table
      addLog(`Consultando tabla 'gastos'...`)
      const response = await fetch(
        `${supabaseUrl}/rest/v1/gastos?select=count`,
        {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Prefer': 'count=exact'
          }
        }
      )

      if (!response.ok) {
        const errorText = await response.text()
        addLog(`❌ Error de conexión: ${response.status} ${response.statusText}`)
        addLog(`Detalles: ${errorText}`)
        showModal(
          'Error de conexión',
          `Error: ${response.status} - ${response.statusText}\n\nVerificá que la clave sea correcta (debe ser Service Role Key, no Anon Key)`,
          'error'
        )
        setTesting(false)
        return
      }

      const contentRange = response.headers.get('content-range')
      const count = contentRange ? parseInt(contentRange.split('/')[1]) : 0

      addLog(`✅ Conexión exitosa!`)
      addLog(`📊 Se encontraron ${count} gastos en Supabase`)

      if (count === 0) {
        addLog(`⚠️ ADVERTENCIA: La tabla gastos está vacía o RLS está bloqueando el acceso`)
        addLog(`💡 Asegurate de usar la "Service Role Key" (no la Anon Key)`)
        addLog(`💡 La Service Role Key comienza con "eyJ..." y es más larga`)
        showModal(
          'Conexión exitosa',
          'Conexión exitosa, pero no se encontraron gastos.\n\nVerificá:\n1. Que estés usando la Service Role Key (no Anon Key)\n2. Que haya datos en Supabase',
          'warning'
        )
      } else {
        showModal(
          '¡Conexión exitosa!',
          `Se encontraron ${count} gastos.\n\nYa podés iniciar la importación.`,
          'success'
        )
      }
    } catch (error: any) {
      console.error('Test error:', error)
      const message = error instanceof Error ? error.message : String(error)
      addLog(`❌ Error: ${message}`)
      showModal('Error de conexión', `Error de conexión: ${message}`, 'error')
    } finally {
      setTesting(false)
    }
  }

  const startImport = async () => {
    if (!user || !profile) {
      showModal('No autenticado', 'Debes estar logueado para importar', 'warning')
      return
    }

    if (!supabaseKey) {
      showModal('Falta información', 'Por favor ingresá la Supabase Key', 'warning')
      return
    }

    setImporting(true)
    setProgress([])
    setLog([])
    addLog('🚀 Iniciando importación desde Supabase...')

    try {
      // Definir qué colecciones importar
      const collections = [
        { supabase: 'gastos', firebase: 'gastos' },
        { supabase: 'impuestos', firebase: 'impuestos' },
        { supabase: 'tarjetas', firebase: 'tarjetas' },
        { supabase: 'metas', firebase: 'metas' },
        { supabase: 'categorias', firebase: 'categorias' },
        { supabase: 'movimientos_ahorro', firebase: 'movimientos_ahorro' },
        { supabase: 'tags', firebase: 'tags' }
      ]

      for (const { supabase, firebase } of collections) {
        try {
          updateProgress(firebase, 'loading')

          // Fetch from Supabase
          const data = await fetchFromSupabase(supabase)

          // Import to Firestore
          const count = await importToFirestore(firebase, data)

          updateProgress(firebase, 'success', count)
        } catch (error: any) {
          console.error(`Error importing ${firebase}:`, error)
          const message = error instanceof Error ? error.message : String(error)
          updateProgress(firebase, 'error', 0, message)
          addLog(`❌ Error en ${firebase}: ${message}`)
        }
      }

      addLog('🎉 ¡Importación completada!')
      showModal('¡Importación completada!', 'Refrescá la página para ver tus datos.', 'success')
    } catch (error: any) {
      console.error('Import error:', error)
      const message = error instanceof Error ? error.message : String(error)
      addLog(`❌ Error general: ${message}`)
      showModal('Error', `Error: ${message}`, 'error')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Importar desde Supabase</h1>
        <p className="text-slate-500">Importá todos tus datos históricos de Supabase a Firebase</p>
      </div>

      {/* Credentials */}
      <div className="card p-6">
        <h3 className="font-bold mb-4">Credenciales de Supabase</h3>
        <div className="space-y-4">
          <div>
            <label className="label">Supabase URL</label>
            <input
              type="text"
              className="input"
              value={supabaseUrl}
              onChange={e => setSupabaseUrl(e.target.value)}
              placeholder="https://xxxxx.supabase.co"
            />
          </div>
          <div>
            <label className="label">Supabase Service Role Key (Secret)</label>
            <input
              type="password"
              className="input"
              value={supabaseKey}
              onChange={e => setSupabaseKey(e.target.value)}
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
            />
            <p className="text-xs text-slate-500 mt-1">
              <strong>⚠️ Usá la Service Role Key (no la Anon Key)</strong> - Encontrala en: Supabase Dashboard → Settings → API → service_role (secret)
            </p>
          </div>
        </div>
      </div>

      {/* Status Cards */}
      <div className="grid md:grid-cols-3 gap-4">
        <div className="card p-4">
          <div className="text-sm text-slate-500 mb-1">Usuario</div>
          <div className="font-semibold">{profile?.email || 'No logueado'}</div>
        </div>
        <div className="card p-4">
          <div className="text-sm text-slate-500 mb-1">Origen</div>
          <div className="font-semibold">Supabase</div>
        </div>
        <div className="card p-4">
          <div className="text-sm text-slate-500 mb-1">Destino</div>
          <div className="font-semibold">Firebase</div>
        </div>
      </div>

      {/* Import Button */}
      <div className="card p-6">
        <div className="mb-4">
          <h3 className="font-bold mb-2">¿Qué se va a importar?</h3>
          <ul className="text-sm text-slate-600 space-y-1">
            <li>✅ Todos los gastos (histórico completo)</li>
            <li>✅ Todos los impuestos</li>
            <li>✅ Todas las tarjetas</li>
            <li>✅ Todas las metas</li>
            <li>✅ Todas las categorías</li>
            <li>✅ Todos los movimientos de ahorro</li>
            <li>✅ Todos los tags</li>
          </ul>
        </div>

        <div className="flex gap-3">
          <button
            onClick={testConnection}
            disabled={testing || importing || !supabaseKey}
            className="btn btn-secondary flex-1 justify-center"
          >
            {testing ? (
              <>
                <Loader className="w-5 h-5 animate-spin" />
                Probando...
              </>
            ) : (
              <>
                <CheckCircle className="w-5 h-5" />
                Probar Conexión
              </>
            )}
          </button>

          <button
            onClick={startImport}
            disabled={importing || testing || !user || !supabaseKey}
            className="btn btn-primary flex-1 justify-center"
          >
            {importing ? (
              <>
                <Loader className="w-5 h-5 animate-spin" />
                Importando...
              </>
            ) : (
              <>
                <Download className="w-5 h-5" />
                Iniciar Importación
              </>
            )}
          </button>
        </div>
      </div>

      {/* Progress */}
      {progress.length > 0 && (
        <div className="card p-6">
          <h3 className="font-bold mb-4">Progreso</h3>
          <div className="space-y-3">
            {progress.map(p => (
              <div key={p.collection} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div className="flex items-center gap-3">
                  {p.status === 'loading' && <Loader className="w-5 h-5 animate-spin text-primary" />}
                  {p.status === 'success' && <CheckCircle className="w-5 h-5 text-emerald-600" />}
                  {p.status === 'error' && <AlertCircle className="w-5 h-5 text-red-600" />}
                  {p.status === 'pending' && <div className="w-5 h-5 rounded-full bg-slate-300" />}
                  <div>
                    <div className="font-semibold capitalize">{p.collection}</div>
                    {p.error && <div className="text-xs text-red-600">{p.error}</div>}
                  </div>
                </div>
                <div className="font-bold text-slate-600">
                  {p.count > 0 ? `${p.count} registros` : ''}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Log */}
      {log.length > 0 && (
        <div className="card p-6">
          <h3 className="font-bold mb-4">Log de Importación</h3>
          <div className="bg-slate-900 text-slate-100 p-4 rounded-lg font-mono text-xs max-h-96 overflow-y-auto">
            {log.map((line, i) => (
              <div key={i}>{line}</div>
            ))}
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="card p-6 bg-amber-50 border border-amber-200">
        <h3 className="font-bold mb-2 text-amber-900">⚠️ Importante</h3>
        <ul className="text-sm text-amber-800 space-y-1">
          <li>• <strong>IMPORTANTE:</strong> Usá la <strong>Service Role Key</strong> (no la Anon Key)</li>
          <li>• La Service Role Key la encontrás en: Supabase Dashboard → Settings → API → service_role key (secret)</li>
          <li>• La Service Role Key es necesaria para evitar restricciones de RLS (Row Level Security)</li>
          <li>• Probá la conexión antes de importar usando el botón "Probar Conexión"</li>
          <li>• Los datos se importarán asociados a tu usuario actual de Firebase</li>
          <li>• Refrescá la página después de importar para ver los datos</li>
          <li>• Si algo falla, podés volver a ejecutar la importación</li>
          <li>• Esta página es temporal - podés borrarla después de importar</li>
        </ul>
      </div>

      {/* Modal */}
      <AlertModal
        isOpen={modal.isOpen}
        onClose={closeModal}
        title={modal.title}
        message={modal.message}
        variant={modal.variant}
      />
    </div>
  )
}
