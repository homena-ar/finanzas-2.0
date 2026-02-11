'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { Mail, Loader2, CheckCircle2, AlertCircle, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function VerificarEmailPage() {
  const { user, resendVerificationEmail, signOut } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(false)

  // Si el usuario ya está verificado, redirigir al dashboard
  useEffect(() => {
    if (user?.emailVerified) {
      router.push('/dashboard/gastos')
    }
  }, [user, router])

  // Si no hay usuario, redirigir al login
  useEffect(() => {
    if (!user) {
      router.push('/')
    }
  }, [user, router])

  const handleResendVerification = async () => {
    // Prevenir múltiples llamadas
    if (loading) return
    
    setLoading(true)
    setError('')
    setSuccess('')
    
    try {
      const { error } = await resendVerificationEmail()
      if (error) {
        const message = error instanceof Error ? error.message : String(error)
        // Traducir mensaje de "too-many-requests"
        if (message.includes('too-many-requests') || message.includes('demasiados intentos')) {
          setError('Demasiados intentos. Por favor esperá unos minutos antes de intentar nuevamente.')
        } else {
          setError(message)
        }
      } else {
        setSuccess('¡Correo reenviado! Revisá tu bandeja de entrada (y la carpeta de spam).')
      }
    } catch (err: any) {
      setError(err.message || 'Error al reenviar el correo. Por favor intentá nuevamente.')
    } finally {
      setLoading(false)
    }
  }

  const handleCheckVerification = async () => {
    setChecking(true)
    setError('')
    
    // Recargar el usuario para verificar si ya verificó su correo
    if (user) {
      try {
        await user.reload()
        // Esperar un momento para que el listener de auth se actualice
        await new Promise(resolve => setTimeout(resolve, 500))
        
        // Verificar nuevamente el estado
        if (user.emailVerified) {
          setSuccess('¡Correo verificado! Redirigiendo...')
          setTimeout(() => {
            router.push('/dashboard/gastos')
          }, 1500)
        } else {
          setError('El correo aún no está verificado. Asegurate de haber hecho clic en el enlace del correo y esperá unos segundos antes de verificar.')
        }
      } catch (error) {
        console.error('Error al recargar usuario:', error)
        setError('Error al verificar el estado. Por favor intentá nuevamente.')
      }
    }
    setChecking(false)
  }

  const handleSignOut = async () => {
    await signOut()
    router.push('/')
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-800 via-primary-600 to-primary-400 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white/20 backdrop-blur rounded-2xl mb-4">
            <Mail className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">Verificá tu Correo</h1>
          <p className="text-white/80 mt-2">Necesitamos confirmar tu dirección de correo</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-2xl p-8">
          <div className="text-center mb-6">
            <AlertCircle className="w-16 h-16 text-amber-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Correo no verificado</h2>
            <p className="text-slate-600 text-sm">
              Enviamos un correo de verificación a:
            </p>
            <p className="text-slate-900 font-semibold mt-1">{user.email}</p>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
            <div className="text-sm text-amber-800 space-y-2">
              <p className="font-semibold">📧 Pasos para verificar:</p>
              <ol className="list-decimal list-inside space-y-1 ml-2">
                <li>Revisá tu bandeja de entrada</li>
                <li>Buscá el correo de "FinControl" o "Firebase"</li>
                <li>Revisá también la carpeta de spam</li>
                <li>Hacé clic en el enlace de verificación</li>
                <li>Volvé aquí y hacé clic en "Ya verifiqué mi correo"</li>
              </ol>
            </div>
          </div>

          {/* Success */}
          {success && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-xl text-sm mb-4">
              {success}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm mb-4">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="space-y-3">
            <button
              onClick={handleCheckVerification}
              disabled={checking}
              className="btn btn-primary w-full justify-center py-3"
            >
              {checking ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Verificando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5" />
                  Ya verifiqué mi correo
                </>
              )}
            </button>

            <button
              onClick={handleResendVerification}
              disabled={loading}
              className="btn btn-secondary w-full justify-center py-3"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Mail className="w-5 h-5" />
                  Reenviar correo de verificación
                </>
              )}
            </button>

            <button
              onClick={handleSignOut}
              className="btn btn-secondary w-full justify-center py-3 text-slate-600"
            >
              <ArrowLeft className="w-5 h-5" />
              Volver al inicio de sesión
            </button>
          </div>

          {/* Help */}
          <div className="mt-6 pt-6 border-t border-slate-200">
            <p className="text-xs text-center text-slate-500">
              ¿No recibiste el correo? Revisá tu carpeta de spam o intentá reenviarlo.
              <br />
              Si el problema persiste, contactá al soporte.
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-white/60 mt-6 text-sm">
          © 2025 FinControl
        </p>
      </div>
    </div>
  )
}
