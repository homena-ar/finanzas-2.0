'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Mail, Lock, Loader2, X } from 'lucide-react'

export default function LoginPage() {
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('')
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false)
  const [forgotPasswordSuccess, setForgotPasswordSuccess] = useState('')

  const { signIn, signUp, user, loading: authLoading, sendPasswordReset } = useAuth()
  const router = useRouter()

  // Redirect to dashboard when user is authenticated
  useEffect(() => {
    if (!authLoading && user) {
      router.push('/dashboard/gastos')
    }
  }, [user, authLoading, router])

  // Manejar query params para recuperación de contraseña
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const resetPassword = params.get('resetPassword')
    const oobCode = params.get('oobCode')
    const mode = params.get('mode')
    
    if (resetPassword || (oobCode && mode === 'resetPassword')) {
      // Redirigir a la página de restablecer contraseña
      router.push(`/restablecer-contraseña${oobCode ? `?oobCode=${oobCode}&mode=${mode}` : ''}`)
    }
  }, [router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    if (isLogin) {
      const { error, needsVerification } = await signIn(email, password)
      if (error) {
        const message = error instanceof Error ? error.message : String(error)
        setError(message)
        setLoading(false)
      } else if (needsVerification) {
        // Redirigir a la página de verificación
        router.push('/verificar-email')
        setLoading(false)
      }
      // Don't navigate here - let useEffect handle it when user is ready
    } else {
      const { error } = await signUp(email, password)
      if (error) {
        const message = error instanceof Error ? error.message : String(error)
        setError(message)
      } else {
        setSuccess('¡Cuenta creada! Revisá tu email para confirmar tu cuenta.')
        // Redirigir a la página de verificación después del registro
        setTimeout(() => {
          router.push('/verificar-email')
        }, 2000)
      }
      setLoading(false)
    }
  }

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setForgotPasswordSuccess('')
    setError('')
    setForgotPasswordLoading(true)

    if (!forgotPasswordEmail) {
      setError('Por favor ingresá tu email')
      setForgotPasswordLoading(false)
      return
    }

    const { error } = await sendPasswordReset(forgotPasswordEmail)
    if (error) {
      const message = error instanceof Error ? error.message : String(error)
      // Traducir mensajes específicos
      if (message.includes('user-not-found') || message.includes('no existe una cuenta')) {
        setError('No existe una cuenta con este correo electrónico')
      } else if (message.includes('too-many-requests') || message.includes('demasiados intentos')) {
        setError('Demasiados intentos. Por favor esperá unos minutos antes de intentar nuevamente.')
      } else {
        setError(message)
      }
    } else {
      setForgotPasswordSuccess('¡Correo enviado! Revisá tu bandeja de entrada (y la carpeta de spam) para restablecer tu contraseña.')
      setForgotPasswordEmail('')
    }
    setForgotPasswordLoading(false)
  }


  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white/20 backdrop-blur rounded-2xl mb-4">
            <svg className="w-12 h-12" viewBox="0 0 100 100" fill="none">
              <g fill="white">
                <rect x="25" y="45" width="10" height="30" rx="2"/>
                <rect x="45" y="35" width="10" height="40" rx="2"/>
                <rect x="65" y="25" width="10" height="50" rx="2"/>
                <path d="M 22 55 L 38 45 L 52 35 L 72 20" stroke="white" strokeWidth="3" fill="none" strokeLinecap="round"/>
                <circle cx="72" cy="20" r="4" fill="white"/>
              </g>
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white">FinControl</h1>
          <p className="text-white/80 mt-2">Controlá tus finanzas personales</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-2xl p-8">
          <h2 className="text-2xl font-bold text-center mb-6">
            {isLogin ? 'Iniciar Sesión' : 'Crear Cuenta'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div>
              <label className="label">Email</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input pl-12"
                  placeholder="tu@email.com"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="label mb-0">Contraseña</label>
                {isLogin && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowForgotPassword(true)
                      setError('')
                      setSuccess('')
                    }}
                    className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                )}
              </div>
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

            {/* Error */}
            {error && (
              <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl text-sm">
                {error}
              </div>
            )}

            {/* Success */}
            {success && (
              <div className="bg-emerald-50 text-emerald-600 px-4 py-3 rounded-xl text-sm">
                {success}
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
              ) : isLogin ? (
                'Ingresar'
              ) : (
                'Crear Cuenta'
              )}
            </button>
          </form>

          {/* Toggle */}
          <div className="mt-6 text-center">
            <button
              onClick={() => {
                setIsLogin(!isLogin)
                setError('')
                setSuccess('')
                setShowForgotPassword(false)
              }}
              className="text-indigo-600 hover:text-indigo-700 font-medium"
            >
              {isLogin ? '¿No tenés cuenta? Registrate' : '¿Ya tenés cuenta? Ingresá'}
            </button>
          </div>
        </div>

        {/* Forgot Password Modal */}
        {showForgotPassword && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-md">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold">Recuperar Contraseña</h2>
                <button
                  onClick={() => {
                    setShowForgotPassword(false)
                    setForgotPasswordEmail('')
                    setError('')
                    setForgotPasswordSuccess('')
                  }}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleForgotPassword} className="space-y-5">
                <div>
                  <label className="label">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type="email"
                      value={forgotPasswordEmail}
                      onChange={(e) => setForgotPasswordEmail(e.target.value)}
                      className="input pl-12"
                      placeholder="tu@email.com"
                      required
                    />
                  </div>
                </div>

                {forgotPasswordSuccess && (
                  <div className="bg-emerald-50 text-emerald-600 px-4 py-3 rounded-xl text-sm">
                    {forgotPasswordSuccess}
                  </div>
                )}

                {error && showForgotPassword && (
                  <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl text-sm">
                    {error}
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowForgotPassword(false)
                      setForgotPasswordEmail('')
                      setError('')
                      setForgotPasswordSuccess('')
                    }}
                    className="btn btn-secondary flex-1"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={forgotPasswordLoading}
                    className="btn btn-primary flex-1 justify-center"
                  >
                    {forgotPasswordLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      'Enviar'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Footer */}
        <p className="text-center text-white/60 mt-6 text-sm">
          © 2025 FinControl
        </p>
      </div>
    </div>
  )
}
