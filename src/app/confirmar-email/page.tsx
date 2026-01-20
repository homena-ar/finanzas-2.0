'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { applyActionCode } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { CheckCircle2, XCircle, Loader2, Mail } from 'lucide-react'
import Link from 'next/link'

function ConfirmarEmailContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')
  const [oobCode, setOobCode] = useState<string | null>(null)
  const [hasVerified, setHasVerified] = useState(false)

  useEffect(() => {
    // Si ya verificamos, no hacer nada más
    if (hasVerified) return

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
          // PRIMERO: Verificar si el usuario ya tiene el correo verificado
          // Esto evita intentar aplicar un código ya usado y mostrar errores temporales
          if (auth.currentUser) {
            await auth.currentUser.reload()
            if (auth.currentUser.emailVerified) {
              // El correo ya está verificado, tratar como éxito
              setHasVerified(true)
              setStatus('success')
              setMessage('¡Email ya verificado! Redirigiendo...')
              
              // Enviar correo de bienvenida si aún no se envió
              try {
                const currentUser = auth.currentUser
                if (currentUser && currentUser.email && currentUser.uid) {
                  const userName = currentUser.email.split('@')[0]
                  console.log('🎉 [ConfirmarEmail] Email ya verificado, verificando correo de bienvenida...')
                  
                  const welcomeResponse = await fetch('/api/send-welcome-email', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      to: currentUser.email,
                      userName: userName,
                      userId: currentUser.uid
                    })
                  })
                  
                  if (welcomeResponse.ok) {
                    const result = await welcomeResponse.json()
                    if (result.alreadySent) {
                      console.log('ℹ️ [ConfirmarEmail] Correo de bienvenida ya fue enviado anteriormente')
                    } else {
                      console.log('✅ [ConfirmarEmail] Correo de bienvenida enviado')
                    }
                  }
                }
              } catch (welcomeError) {
                console.error('⚠️ [ConfirmarEmail] Error enviando correo de bienvenida:', welcomeError)
              }
              
              setTimeout(() => {
                router.push('/dashboard/gastos')
              }, 1500)
              return
            }
          }
          
          // Si no está verificado, aplicar el código
          await applyActionCode(auth, code)
          
          // Marcar como verificado para evitar ejecuciones múltiples
          setHasVerified(true)
          
          // Recargar el usuario para obtener el estado actualizado
          if (auth.currentUser) {
            await auth.currentUser.reload()
          }
          
          setStatus('success')
          setMessage('¡Email verificado exitosamente!')
          
          // Enviar correo de bienvenida directamente aquí
          try {
            const currentUser = auth.currentUser
            if (currentUser && currentUser.email && currentUser.uid) {
              const userName = currentUser.email.split('@')[0]
              console.log('🎉 [ConfirmarEmail] Enviando correo de bienvenida después de verificación...')
              
              const welcomeResponse = await fetch('/api/send-welcome-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  to: currentUser.email,
                  userName: userName,
                  userId: currentUser.uid
                })
              })
              
              if (welcomeResponse.ok) {
                const result = await welcomeResponse.json()
                if (result.alreadySent) {
                  console.log('ℹ️ [ConfirmarEmail] Correo de bienvenida ya fue enviado anteriormente')
                } else {
                  console.log('✅ [ConfirmarEmail] Correo de bienvenida enviado correctamente')
                }
              } else {
                console.error('⚠️ [ConfirmarEmail] Error enviando correo de bienvenida:', await welcomeResponse.text())
              }
            }
          } catch (welcomeError) {
            console.error('⚠️ [ConfirmarEmail] Error enviando correo de bienvenida:', welcomeError)
            // No fallar si el email falla
          }

          // Redirigir al dashboard después de 1.5 segundos
          setTimeout(() => {
            router.push('/dashboard/gastos')
          }, 1500)
        } else {
          setStatus('error')
          setMessage('Acción no válida.')
        }
      } catch (error: any) {
        console.error('Error verificando email:', error)
        
        // Si el error es porque el código ya fue usado, verificar si el correo está verificado
        if (error.code === 'auth/invalid-action-code') {
          // Recargar usuario para verificar estado actual
          try {
            if (auth.currentUser) {
              await auth.currentUser.reload()
              if (auth.currentUser.emailVerified) {
                // El código ya fue usado pero el correo está verificado, tratar como éxito
                setHasVerified(true)
                setStatus('success')
                setMessage('¡Email ya verificado! Redirigiendo...')
                setTimeout(() => {
                  router.push('/dashboard/gastos')
                }, 1500)
                return
              }
            }
          } catch (reloadError) {
            console.error('Error recargando usuario:', reloadError)
          }
        }
        
        // Si llegamos aquí, es un error real
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
  }, [searchParams, router, user, hasVerified])

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

export default function ConfirmarEmailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-3xl shadow-2xl p-8 text-center">
            <Loader2 className="w-16 h-16 text-indigo-600 mx-auto mb-4 animate-spin" />
            <h2 className="text-2xl font-bold mb-2">Cargando...</h2>
          </div>
        </div>
      </div>
    }>
      <ConfirmarEmailContent />
    </Suspense>
  )
}
