'use client'

import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Mail, Lock, Loader2, X, Check } from 'lucide-react'

// Password requirements
const PASSWORD_RULES = [
  { key: 'length', label: 'Mínimo 6 caracteres', test: (p: string) => p.length >= 6 },
  { key: 'upper', label: 'Una letra mayúscula', test: (p: string) => /[A-Z]/.test(p) },
  { key: 'lower', label: 'Una letra minúscula', test: (p: string) => /[a-z]/.test(p) },
  { key: 'number', label: 'Un número', test: (p: string) => /[0-9]/.test(p) },
]

export default function LoginPage() {
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('')
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false)
  const [forgotPasswordSuccess, setForgotPasswordSuccess] = useState('')

  const { signIn, signUp, user, loading: authLoading, sendPasswordReset } = useAuth()
  const router = useRouter()

  // Real-time password validation
  const passwordChecks = useMemo(() =>
    PASSWORD_RULES.map(rule => ({ ...rule, passed: rule.test(password) })),
    [password]
  )
  const allPasswordChecksPassed = passwordChecks.every(c => c.passed)
  const passwordsMatch = password.length > 0 && confirmPassword.length > 0 && password === confirmPassword

  // Redirect to dashboard when user is authenticated AND email is verified
  useEffect(() => {
    if (!authLoading && user) {
      if (!user.emailVerified) {
        router.push('/verificar-email')
      } else {
        router.push('/dashboard/gastos')
      }
    }
  }, [user, authLoading, router])

  // Manejar query params para recuperación de contraseña
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const resetPassword = params.get('resetPassword')
    const oobCode = params.get('oobCode')
    const mode = params.get('mode')

    if (resetPassword || (oobCode && mode === 'resetPassword')) {
      router.push(`/restablecer-password${oobCode ? `?oobCode=${oobCode}&mode=${mode}` : ''}`)
    }
  }, [router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (isLogin) {
      setLoading(true)
      const { error, needsVerification } = await signIn(email, password)
      if (error) {
        const message = error instanceof Error ? error.message : String(error)
        setError(message)
        setLoading(false)
      } else if (needsVerification) {
        router.push('/verificar-email')
        setLoading(false)
      }
    } else {
      // Registration validation
      if (!allPasswordChecksPassed) {
        setError('La contraseña no cumple todos los requisitos')
        return
      }
      if (password !== confirmPassword) {
        setError('Las contraseñas no coinciden')
        return
      }

      setLoading(true)
      const { error } = await signUp(email, password)
      if (error) {
        const message = error instanceof Error ? error.message : String(error)
        setError(message)
      } else {
        setSuccess('¡Cuenta creada! Revisá tu email para confirmar tu cuenta.')
        router.push('/verificar-email')
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
    <div className="min-h-screen bg-gradient-to-br from-primary-600 via-accent-600 to-pink-500 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl mb-4 shadow-lg shadow-black/10">
            <svg className="w-9 h-9" viewBox="0 0 100 100" fill="none">
              <g fill="white">
                <rect x="25" y="45" width="10" height="30" rx="2"/>
                <rect x="45" y="35" width="10" height="40" rx="2"/>
                <rect x="65" y="25" width="10" height="50" rx="2"/>
                <path d="M 22 55 L 38 45 L 52 35 L 72 20" stroke="white" strokeWidth="3" fill="none" strokeLinecap="round"/>
                <circle cx="72" cy="20" r="4" fill="white"/>
              </g>
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white">FinControl</h1>
          <p className="text-white/70 mt-1 text-sm">Controlá tus finanzas personales</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl shadow-black/20 overflow-hidden">
          {/* Tab Toggle */}
          <div className="flex border-b border-slate-100">
            <button
              onClick={() => { setIsLogin(true); setError(''); setSuccess('') }}
              className={`flex-1 py-3.5 text-sm font-semibold transition-colors ${
                isLogin ? 'text-primary border-b-2 border-primary' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              Iniciar sesión
            </button>
            <button
              onClick={() => { setIsLogin(false); setError(''); setSuccess('') }}
              className={`flex-1 py-3.5 text-sm font-semibold transition-colors ${
                !isLogin ? 'text-primary border-b-2 border-primary' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              Crear cuenta
            </button>
          </div>

          <div className="p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email */}
              <div>
                <label className="label">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input pl-10"
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
                      className="text-xs text-primary hover:text-primary-700 font-medium"
                    >
                      ¿Olvidaste tu contraseña?
                    </button>
                  )}
                </div>
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

              {/* Password Requirements - only in registration mode */}
              {!isLogin && password.length > 0 && (
                <div className="bg-slate-50 rounded-xl p-3 space-y-1.5">
                  {passwordChecks.map(check => (
                    <div key={check.key} className="flex items-center gap-2">
                      <div className={`w-4 h-4 rounded-full flex items-center justify-center transition-colors ${
                        check.passed ? 'bg-emerald-500' : 'bg-slate-200'
                      }`}>
                        {check.passed && <Check className="w-2.5 h-2.5 text-white" />}
                      </div>
                      <span className={`text-xs ${check.passed ? 'text-emerald-600 font-medium' : 'text-slate-500'}`}>
                        {check.label}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Confirm Password - only in registration mode */}
              {!isLogin && (
                <div>
                  <label className="label">Confirmar contraseña</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className={`input pl-10 pr-10 ${
                        confirmPassword.length > 0
                          ? passwordsMatch
                            ? 'border-emerald-300 focus:border-emerald-400 focus:ring-emerald-100'
                            : 'border-red-300 focus:border-red-400 focus:ring-red-100'
                          : ''
                      }`}
                      placeholder="••••••••"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {confirmPassword.length > 0 && !passwordsMatch && (
                    <p className="text-xs text-red-500 mt-1">Las contraseñas no coinciden</p>
                  )}
                </div>
              )}

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
                disabled={loading || (!isLogin && (!allPasswordChecksPassed || !passwordsMatch))}
                className="btn btn-primary w-full justify-center py-3"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : isLogin ? (
                  'Ingresar'
                ) : (
                  'Crear cuenta'
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Forgot Password Modal */}
        {showForgotPassword && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md">
              <div className="flex items-center justify-between mb-5">
                <h2 className="section-title">Recuperar contraseña</h2>
                <button
                  onClick={() => {
                    setShowForgotPassword(false)
                    setForgotPasswordEmail('')
                    setError('')
                    setForgotPasswordSuccess('')
                  }}
                  className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4 text-slate-400" />
                </button>
              </div>

              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div>
                  <label className="label">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="email"
                      value={forgotPasswordEmail}
                      onChange={(e) => setForgotPasswordEmail(e.target.value)}
                      className="input pl-10"
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
        <p className="text-center text-white/50 mt-6 text-xs">
          © {new Date().getFullYear()} FinControl
        </p>
      </div>
    </div>
  )
}
