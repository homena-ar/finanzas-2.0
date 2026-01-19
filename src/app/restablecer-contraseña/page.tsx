'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { confirmPasswordReset, verifyPasswordResetCode } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { Lock, CheckCircle2, XCircle, Loader2, Eye, EyeOff } from 'lucide-react'
import Link from 'next/link'

export default function RestablecerContraseñaPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [oobCode, setOobCode] = useState<string | null>(null)
  const [email, setEmail] = useState<string>('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [status, setStatus] = useState<'verifying' | 'ready' | 'success' | 'error'>('verifying')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // Extraer el código de acción de la URL
    const code = searchParams.get('oobCode') || searchParams.get('code')
    const mode = searchParams.get('mode')

    if (!code) {
      setStatus('error')
      setMessage('Código de recuperación no válido o expirado.')
      return
    }

    if (mode !== 'resetPassword') {
      setStatus('error')
      setMessage('Acción no válida.')
      return
    }

    setOobCode(code)

    // Verificar que el código sea válido y obtener el email
    const verifyCode = async () => {
      try {
        const emailFromCode = await verifyPasswordResetCode(auth, code)
        setEmail(emailFromCode)
        setStatus('ready')
      } catch (error: any) {
        console.error('Error verificando código:', error)
        setStatus('error')
        
        if (error.code === 'auth/expired-action-code') {
          setMessage('El enlace de recuperación ha expirado. Por favor solicitá uno nuevo.')
        } else if (error.code === 'auth/invalid-action-code') {
          setMessage('El enlace de recuperación no es válido o ya fue usado.')
        } else {
          setMessage('Error al verificar el enlace. Por favor intentá nuevamente.')
        }
      }
    }

    verifyCode()
  }, [searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage('')

    if (!password || !confirmPassword) {
      setMessage('Por favor completá todos los campos')
      return
    }

    if (password.length < 6) {
      setMessage('La contraseña debe tener al menos 6 caracteres')
      return
    }

    if (password !== confirmPassword) {
      setMessage('Las contraseñas no coinciden')
      return
    }

    if (!oobCode) {
      setMessage('Código de recuperación no válido')
      return
    }

    setLoading(true)

    try {
      await confirmPasswordReset(auth, oobCode, password)
      setStatus('success')
      setMessage('¡Contraseña restablecida exitosamente!')
      
      // Redirigir al login después de 2 segundos
      setTimeout(() => {
        router.push('/')
      }, 2000)
    } catch (error: any) {
      console.error('Error restableciendo contraseña:', error)
      setMessage('Error al restablecer la contraseña. Por favor intentá nuevamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white/20 backdrop-blur rounded-2xl mb-4">
            <Lock className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">Restablecer Contraseña</h1>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-2xl p-8">
          {status === 'verifying' && (
            <div className="text-center">
              <Loader2 className="w-16 h-16 text-indigo-600 mx-auto mb-4 animate-spin" />
              <h2 className="text-2xl font-bold mb-2">Verificando enlace...</h2>
              <p className="text-slate-600">Por favor esperá un momento.</p>
            </div>
          )}

          {status === 'error' && (
            <div className="text-center">
              <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2 text-red-600">Error</h2>
              <p className="text-slate-600 mb-6">{message}</p>
              <div className="space-y-3">
                <Link
                  href="/"
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

          {status === 'success' && (
            <div className="text-center">
              <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2 text-emerald-600">¡Contraseña Restablecida!</h2>
              <p className="text-slate-600 mb-6">{message}</p>
              <p className="text-sm text-slate-500">Redirigiendo al inicio de sesión...</p>
            </div>
          )}

          {status === 'ready' && (
            <>
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold mb-2">Nueva Contraseña</h2>
                <p className="text-slate-600 text-sm">
                  Ingresá una nueva contraseña para: <strong>{email}</strong>
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Password */}
                <div>
                  <label className="label">Nueva Contraseña</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="input pl-12 pr-12"
                      placeholder="••••••••"
                      required
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                {/* Confirm Password */}
                <div>
                  <label className="label">Confirmar Contraseña</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="input pl-12 pr-12"
                      placeholder="••••••••"
                      required
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                {/* Error */}
                {message && (
                  <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl text-sm">
                    {message}
                  </div>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={loading}
                  className="btn btn-primary w-full justify-center py-3"
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    'Restablecer Contraseña'
                  )}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
