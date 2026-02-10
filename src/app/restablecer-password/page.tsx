'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { confirmPasswordReset, verifyPasswordResetCode } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { Lock, CheckCircle2, XCircle, Loader2, Eye, EyeOff } from 'lucide-react'
import Link from 'next/link'

function RestablecerContraseñaContent() {
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
    <div className="min-h-screen bg-gradient-to-br from-primary-600 via-accent-600 to-pink-500 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl mb-4 shadow-lg shadow-black/10">
            <Lock className="w-9 h-9 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Restablecer contraseña</h1>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl shadow-black/20 overflow-hidden p-6">
          {status === 'verifying' && (
            <div className="text-center py-8">
              <Loader2 className="w-12 h-12 text-primary mx-auto mb-4 animate-spin" />
              <h2 className="text-lg font-semibold mb-1">Verificando enlace...</h2>
              <p className="text-slate-500 text-sm">Por favor esperá un momento.</p>
            </div>
          )}

          {status === 'error' && (
            <div className="text-center py-4">
              <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <h2 className="text-lg font-semibold mb-1 text-red-600">Error</h2>
              <p className="text-slate-500 text-sm mb-6">{message}</p>
              <div className="space-y-3">
                <Link href="/" className="btn btn-primary w-full justify-center">
                  Solicitar nuevo enlace
                </Link>
                <Link href="/" className="btn btn-secondary w-full justify-center">
                  Volver al inicio
                </Link>
              </div>
            </div>
          )}

          {status === 'success' && (
            <div className="text-center py-8">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
              <h2 className="text-lg font-semibold mb-1 text-emerald-600">Contraseña restablecida</h2>
              <p className="text-slate-500 text-sm mb-4">{message}</p>
              <p className="text-xs text-slate-400">Redirigiendo al inicio de sesión...</p>
            </div>
          )}

          {status === 'ready' && (
            <>
              <div className="text-center mb-5">
                <h2 className="text-lg font-semibold mb-1">Nueva contraseña</h2>
                <p className="text-slate-500 text-sm">
                  Para: <strong className="text-slate-700">{email}</strong>
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="label">Nueva contraseña</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="input pl-10 pr-10"
                      placeholder="••••••••"
                      required
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="label">Confirmar contraseña</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="input pl-10 pr-10"
                      placeholder="••••••••"
                      required
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {message && (
                  <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl text-sm">
                    {message}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="btn btn-primary w-full justify-center py-3"
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    'Restablecer contraseña'
                  )}
                </button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-white/50 mt-6 text-xs">
          &copy; {new Date().getFullYear()} FinControl
        </p>
      </div>
    </div>
  )
}

export default function RestablecerContraseñaPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-primary-600 via-accent-600 to-pink-500 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-2xl shadow-black/20 p-6 text-center">
            <Loader2 className="w-12 h-12 text-primary mx-auto mb-4 animate-spin" />
            <h2 className="text-lg font-semibold mb-1">Cargando...</h2>
          </div>
        </div>
      </div>
    }>
      <RestablecerContraseñaContent />
    </Suspense>
  )
}
