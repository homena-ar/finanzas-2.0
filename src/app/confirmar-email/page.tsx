'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { applyActionCode } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { CheckCircle2, XCircle, Loader2, Mail } from 'lucide-react'
import Link from 'next/link'

export default function ConfirmarEmailPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')
  const [oobCode, setOobCode] = useState<string | null>(null)

  useEffect(() => {
    // Extraer el código de acción de la URL
    const code = searchParams.get('oobCode') || searchParams.get('code')
    const mode = searchParams.get('mode')

    if (!code) {
      setStatus('error')
      setMessage('Código de verificación no válido o expirado.')
      return
    }

    setOobCode(code)

    // Verificar el código de acción
    const verifyEmail = async () => {
      try {
        if (mode === 'verifyEmail') {
          await applyActionCode(auth, code)
          setStatus('success')
          setMessage('¡Email verificado exitosamente!')
          
          // El correo de bienvenida se enviará automáticamente cuando el listener de auth detecte el cambio
          // No lo enviamos aquí para evitar duplicados

          // Redirigir al dashboard después de 2 segundos
          setTimeout(() => {
            router.push('/dashboard/gastos')
          }, 2000)
        } else {
          setStatus('error')
          setMessage('Acción no válida.')
        }
      } catch (error: any) {
        console.error('Error verificando email:', error)
        setStatus('error')
        
        if (error.code === 'auth/expired-action-code') {
          setMessage('El enlace de verificación ha expirado. Por favor solicitá uno nuevo.')
        } else if (error.code === 'auth/invalid-action-code') {
          setMessage('El enlace de verificación no es válido o ya fue usado.')
        } else {
          setMessage('Error al verificar el email. Por favor intentá nuevamente.')
        }
      }
    }

    verifyEmail()
  }, [searchParams, router, user])

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white/20 backdrop-blur rounded-2xl mb-4">
            <Mail className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">Verificando Email</h1>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-2xl p-8">
          {status === 'loading' && (
            <div className="text-center">
              <Loader2 className="w-16 h-16 text-indigo-600 mx-auto mb-4 animate-spin" />
              <h2 className="text-2xl font-bold mb-2">Verificando tu email...</h2>
              <p className="text-slate-600">Por favor esperá un momento.</p>
            </div>
          )}

          {status === 'success' && (
            <div className="text-center">
              <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2 text-emerald-600">¡Email Verificado!</h2>
              <p className="text-slate-600 mb-6">{message}</p>
              <p className="text-sm text-slate-500">Redirigiendo al dashboard...</p>
            </div>
          )}

          {status === 'error' && (
            <div className="text-center">
              <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2 text-red-600">Error</h2>
              <p className="text-slate-600 mb-6">{message}</p>
              <div className="space-y-3">
                <Link
                  href="/verificar-email"
                  className="btn btn-primary w-full justify-center"
                >
                  Solicitar nuevo enlace
                </Link>
                <Link
                  href="/"
                  className="btn btn-secondary w-full justify-center"
                >
                  Volver al inicio
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
