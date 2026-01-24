'use client'

import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react'
import {
  User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  sendEmailVerification as firebaseSendEmailVerification
} from 'firebase/auth'
import { doc, getDoc, setDoc, updateDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { Profile } from '@/types'
import { sendEmailVerification } from 'firebase/auth'
import { getWelcomeEmailTemplate, getEmailVerificationTemplate } from '@/lib/email-templates'

interface AuthContextType {
  user: User | null
  profile: Profile | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: any; needsVerification?: boolean }>
  signUp: (email: string, password: string) => Promise<{ error: any }>
  signOut: () => Promise<void>
  updateProfile: (data: Partial<Profile>) => Promise<void>
  sendPasswordReset: (email: string) => Promise<{ error: any }>
  resendVerificationEmail: () => Promise<{ error: any }>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Función para traducir errores de Firebase a mensajes amigables en español
function getFirebaseErrorMessage(error: any): string {
  if (!error) return 'Ocurrió un error desconocido'
  
  const errorCode = error.code || ''
  const errorMessage = error.message || String(error)
  
  // Traducir códigos de error comunes de Firebase
  switch (errorCode) {
    case 'auth/invalid-email':
      return 'El correo electrónico no es válido'
    case 'auth/user-disabled':
      return 'Esta cuenta ha sido deshabilitada'
    case 'auth/user-not-found':
      return 'No existe una cuenta con este correo electrónico'
    case 'auth/wrong-password':
      return 'La contraseña es incorrecta'
    case 'auth/invalid-credential':
    case 'auth/invalid-login-credentials':
      return 'Email o contraseña incorrectos'
    case 'auth/email-already-in-use':
      return 'Ya existe una cuenta con este correo electrónico'
    case 'auth/weak-password':
      return 'La contraseña es muy débil. Debe tener al menos 6 caracteres'
    case 'auth/operation-not-allowed':
      return 'Esta operación no está permitida'
    case 'auth/too-many-requests':
      return 'Demasiados intentos. Por favor intentá más tarde'
    case 'auth/network-request-failed':
      return 'Error de conexión. Verificá tu internet'
    case 'auth/popup-closed-by-user':
      return 'La ventana de autenticación fue cerrada'
    case 'auth/cancelled-popup-request':
      return 'La solicitud de autenticación fue cancelada'
    default:
      // Si el mensaje ya está en español o es un mensaje personalizado, devolverlo tal cual
      if (errorMessage.includes('Email o contraseña') || 
          errorMessage.includes('correo') || 
          errorMessage.includes('contraseña')) {
        return errorMessage
      }
      // Si es un mensaje genérico de Firebase, devolver uno más amigable
      if (errorMessage.includes('Invalid login credentials') || 
          errorMessage.includes('invalid-credential')) {
        return 'Email o contraseña incorrectos'
      }
      // Mensaje genérico para otros errores
      return 'Ocurrió un error. Por favor intentá nuevamente'
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const welcomeAttemptedRef = useRef<Set<string>>(new Set())

  const fetchProfile = async (userId: string) => {
    try {
      console.log('🔐 [Firebase useAuth] Fetching profile for user:', userId)
      const profileRef = doc(db, 'profiles', userId)
      const profileSnap = await getDoc(profileRef)

      if (profileSnap.exists()) {
        console.log('🔐 [Firebase useAuth] Profile found')
        return profileSnap.data() as Profile
      } else {
        console.log('🔐 [Firebase useAuth] Profile not found - creating default')
        // Create default profile if it doesn't exist
        const defaultProfile: Profile = {
          id: userId,
          email: auth.currentUser?.email || '',
          nombre: auth.currentUser?.email?.split('@')[0] || '',
          budget_ars: 0,
          budget_usd: 0,
          ahorro_pesos: 0,
          ahorro_usd: 0,
          ingresos_habilitado: false,
          personal_workspace_icono: null,
          personal_workspace_logo: null,
          created_at: new Date().toISOString()
        }
        await setDoc(profileRef, defaultProfile)
        return defaultProfile
      }
    } catch (error) {
      console.error('🔐 [Firebase useAuth] Error fetching profile:', error)
      return null
    }
  }

  useEffect(() => {
    console.log('🔐 [Firebase useAuth] Setting up auth listener')

    let previousEmailVerified: boolean | null = null

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log('🔐 [Firebase useAuth] Auth state changed:', firebaseUser ? 'USER LOGGED IN' : 'NO USER')

      if (firebaseUser) {
        // Recargar el usuario para obtener el estado más reciente de emailVerified
        await firebaseUser.reload()
        
        // Verificar si el correo se acaba de verificar (cambió de false a true)
        // previousEmailVerified === null significa primera carga, no contar como verificación nueva
        const emailJustVerified = previousEmailVerified === false && firebaseUser.emailVerified
        
        // Verificar si el correo está verificado
        // NOTA: No cerramos la sesión aquí para permitir acceso a /verificar-email
        // El bloqueo de acceso al dashboard se hace en el layout
        setUser(firebaseUser)
        
        // Solo cargar el perfil si el correo está verificado
        if (firebaseUser.emailVerified) {
          const profileData = await fetchProfile(firebaseUser.uid)
          setProfile(profileData)
          
          const welcomeAlreadySent = !!profileData?.welcome_email_sent
          const shouldAttemptWelcome =
            !!firebaseUser.email &&
            !!firebaseUser.uid &&
            // Caso A: se acaba de verificar en esta sesión
            (emailJustVerified ||
              // Caso B: ya está verificado, pero nunca enviamos welcome (ej: verificó en otro browser/deslogueado)
              !welcomeAlreadySent)

          // Evitar spamear en re-renders: 1 intento por uid por sesión
          if (shouldAttemptWelcome && !welcomeAttemptedRef.current.has(firebaseUser.uid)) {
            welcomeAttemptedRef.current.add(firebaseUser.uid)
            try {
              const userName = firebaseUser.email.split('@')[0]
              console.log('🎉 [Firebase useAuth] Enviando correo de bienvenida (post-verificación o faltante)...', {
                emailJustVerified,
                welcomeAlreadySent,
                uid: firebaseUser.uid
              })
              const welcomeResponse = await fetch('/api/send-welcome-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  to: firebaseUser.email,
                  userName: userName,
                  userId: firebaseUser.uid
                })
              })
              
              if (welcomeResponse.ok) {
                const result = await welcomeResponse.json()
                if (result.alreadySent) {
                  console.log('ℹ️ [Firebase useAuth] Correo de bienvenida ya fue enviado anteriormente')
                } else {
                  console.log('✅ [Firebase useAuth] Correo de bienvenida enviado después de verificación')
                }

                // Fallback: marcar en el perfil desde el cliente (por si Admin SDK no pudo actualizar)
                try {
                  await updateDoc(doc(db, 'profiles', firebaseUser.uid), {
                    welcome_email_sent: true,
                    welcome_email_sent_at: new Date().toISOString(),
                  } as any)
                  setProfile(prev => (prev ? { ...prev, welcome_email_sent: true, welcome_email_sent_at: new Date().toISOString() } : prev))
                } catch (e) {
                  // No bloquear si no se puede actualizar el perfil
                  console.warn('⚠️ [Firebase useAuth] No se pudo marcar welcome_email_sent en perfil (no crítico):', e)
                }
              } else {
                console.error('⚠️ [Firebase useAuth] Error enviando correo de bienvenida:', await welcomeResponse.text())
              }
            } catch (welcomeError) {
              console.error('⚠️ [Firebase useAuth] Error enviando correo de bienvenida:', welcomeError)
              // No fallar si el email falla
            }
          }
        } else {
          // Si no está verificado, no cargar el perfil pero mantener el usuario
          setProfile(null)
        }
        
        // Actualizar el estado previo
        previousEmailVerified = firebaseUser.emailVerified
      } else {
        setUser(null)
        setProfile(null)
        previousEmailVerified = null
      }

      setLoading(false)
    })

    return () => {
      console.log('🔐 [Firebase useAuth] Cleanup - unsubscribing')
      unsubscribe()
    }
  }, [])

  // Listener adicional para restaurar sesión cuando la app vuelve a estar visible
  // Esto es especialmente importante en iOS cuando la PWA se cierra y se vuelve a abrir
  useEffect(() => {
    if (typeof window === 'undefined') return

    let isRestoring = false

    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && !isRestoring) {
        console.log('🔐 [Firebase useAuth] App visible - verificando sesión')
        
        // Si hay un usuario actual pero no está en el estado, intentar restaurar
        if (auth.currentUser && !user) {
          isRestoring = true
          console.log('🔐 [Firebase useAuth] Restaurando sesión desde auth.currentUser')
          try {
            // Recargar el usuario para obtener el estado más reciente
            await auth.currentUser.reload()
            setUser(auth.currentUser)
            
            // Cargar el perfil si el correo está verificado
            if (auth.currentUser.emailVerified) {
              const profileData = await fetchProfile(auth.currentUser.uid)
              setProfile(profileData)
            }
          } catch (error) {
            console.error('🔐 [Firebase useAuth] Error restaurando sesión:', error)
          } finally {
            isRestoring = false
          }
        }
      }
    }

    // Escuchar cambios de visibilidad
    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    // También escuchar cuando la página se vuelve a enfocar (útil para PWAs)
    window.addEventListener('focus', handleVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleVisibilityChange)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]) // fetchProfile está definido en el mismo componente, no necesita estar en dependencias

  const signIn = async (email: string, password: string) => {
    console.log('🔐 [Firebase useAuth] signIn called')
    setLoading(true)
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password)
      console.log('🔐 [Firebase useAuth] signIn SUCCESS')
      
      // Recargar el usuario para obtener el estado más reciente
      await userCredential.user.reload()
      
      // Verificar si el correo está verificado
      const needsVerification = !userCredential.user.emailVerified
      if (needsVerification) {
        console.log('⚠️ [Firebase useAuth] Email no verificado')
        // No cerramos la sesión aquí, permitimos acceso a /verificar-email
        // El bloqueo de acceso al dashboard se hace en el layout
        setLoading(false)
        return { error: null, needsVerification: true }
      }
      
      return { error: null, needsVerification: false }
    } catch (error: any) {
      console.error('🔐 [Firebase useAuth] signIn ERROR:', error)
      setLoading(false)
      // Traducir el error a un mensaje amigable
      const friendlyError = new Error(getFirebaseErrorMessage(error))
      return { error: friendlyError }
    }
  }

  const createDefaultCategorias = async (userId: string) => {
    console.log('📂 [Firebase useAuth] Creating default categorias for user:', userId)

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
        user_id: userId,
        created_at: serverTimestamp()
      })
    }

    console.log('✅ [Firebase useAuth] Default categorias created')
  }

  const signUp = async (email: string, password: string) => {
    console.log('🔐 [Firebase useAuth] signUp called')
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password)
      const userName = email.split('@')[0]
      
      // Create profile document
      const defaultProfile: Profile = {
        id: userCredential.user.uid,
        email: email,
        nombre: userName,
        budget_ars: 0,
        budget_usd: 0,
        ahorro_pesos: 0,
        ahorro_usd: 0,
        ingresos_habilitado: false,
        personal_workspace_icono: null,
        personal_workspace_logo: null,
        created_at: new Date().toISOString()
      }
      await setDoc(doc(db, 'profiles', userCredential.user.uid), defaultProfile)

      // Create default categorias
      await createDefaultCategorias(userCredential.user.uid)

      // Enviar correo de verificación personalizado (en lugar del de Firebase)
      // Esperar un momento para asegurar que Firebase Admin SDK pueda encontrar el usuario
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      let emailSent = false
      let lastError: any = null
      
      // Intentar enviar correo personalizado con retry
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          console.log(`📧 [Firebase useAuth] Intento ${attempt}/3 de enviar correo personalizado...`)
          
          // Generar link de verificación usando nuestro endpoint
          const linkResponse = await fetch('/api/generate-verification-link', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
          })
          
          const linkResponseText = await linkResponse.text()
          console.log('📧 [Firebase useAuth] Respuesta del endpoint de link:', linkResponse.status, linkResponseText.substring(0, 200))
          
          if (!linkResponse.ok) {
            const errorData = JSON.parse(linkResponseText)
            console.error(`❌ [Firebase useAuth] Error generando link (intento ${attempt}):`, errorData)
            lastError = errorData
            
            // Si es "user-not-found" y aún hay intentos, esperar y reintentar
            if (errorData.error?.includes('no encontrado') && attempt < 3) {
              const waitTime = attempt * 1000 // 1s, 2s
              console.log(`⏳ [Firebase useAuth] Esperando ${waitTime}ms antes de reintentar...`)
              await new Promise(resolve => setTimeout(resolve, waitTime))
              continue
            }
            throw new Error(`Error al generar link: ${errorData.error || 'Error desconocido'}`)
          }
          
          const linkData = JSON.parse(linkResponseText)
          const verificationLink = linkData.verificationLink
          
          if (!verificationLink) {
            console.error('❌ [Firebase useAuth] No se recibió verificationLink en la respuesta')
            throw new Error('No se pudo generar el link de verificación')
          }
          
          console.log('📧 [Firebase useAuth] Link generado correctamente, enviando correo...')
          
          // Enviar correo de verificación personalizado
          const verificationResponse = await fetch('/api/send-verification-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to: email,
              userName: userName,
              verificationLink: verificationLink
            })
          })
          
          const verificationResponseText = await verificationResponse.text()
          console.log('📧 [Firebase useAuth] Respuesta del endpoint de correo:', verificationResponse.status, verificationResponseText.substring(0, 200))
          
          if (!verificationResponse.ok) {
            const errorData = JSON.parse(verificationResponseText)
            console.error(`❌ [Firebase useAuth] Error enviando correo (intento ${attempt}):`, errorData)
            lastError = errorData
            throw new Error(`Error al enviar correo: ${errorData.error || 'Error desconocido'}`)
          }
          
          console.log('✅ [Firebase useAuth] Correo de verificación personalizado enviado exitosamente')
          emailSent = true
          break // Salir del loop si se envió correctamente
          
        } catch (emailError: any) {
          console.error(`❌ [Firebase useAuth] Error en intento ${attempt}:`, emailError)
          lastError = emailError
          
          // Si es el último intento, usar fallback
          if (attempt === 3) {
            console.warn('⚠️ [Firebase useAuth] Todos los intentos fallaron, usando correo de Firebase como último recurso')
            try {
              await sendEmailVerification(userCredential.user)
              console.log('✅ [Firebase useAuth] Email de verificación de Firebase enviado (último recurso)')
              emailSent = true
            } catch (fallbackError) {
              console.error('❌ [Firebase useAuth] Error crítico: No se pudo enviar ningún correo de verificación:', fallbackError)
              // No lanzar error aquí - el registro fue exitoso, solo el correo falló
            }
          } else {
            // Esperar antes del siguiente intento
            const waitTime = attempt * 1000
            console.log(`⏳ [Firebase useAuth] Esperando ${waitTime}ms antes del siguiente intento...`)
            await new Promise(resolve => setTimeout(resolve, waitTime))
          }
        }
      }
      
      if (!emailSent) {
        console.error('❌ [Firebase useAuth] No se pudo enviar el correo de verificación después de todos los intentos')
        console.error('❌ [Firebase useAuth] Último error:', lastError)
      }

      // NO enviar correo de bienvenida aquí - se enviará cuando el usuario verifique su email
      // Esto evita enviar el correo antes de que el usuario verifique su cuenta

      console.log('🔐 [Firebase useAuth] signUp SUCCESS')
      return { error: null }
    } catch (error: any) {
      console.error('🔐 [Firebase useAuth] signUp ERROR:', error)
      // Traducir el error a un mensaje amigable
      const friendlyError = new Error(getFirebaseErrorMessage(error))
      return { error: friendlyError }
    }
  }

  const signOut = async () => {
    console.log('🔐 [Firebase useAuth] signOut called')
    await firebaseSignOut(auth)
    setUser(null)
    setProfile(null)
    setLoading(false)
  }

  const updateProfile = async (data: Partial<Profile>) => {
    if (!user) return

    console.log('🔧 [Firebase updateProfile] Starting update...', data)

    try {
      const profileRef = doc(db, 'profiles', user.uid)
      await updateDoc(profileRef, data)

      console.log('✅ [Firebase updateProfile] Completed successfully')
      setProfile(prev => prev ? { ...prev, ...data } : null)
    } catch (error) {
      console.error('❌ [Firebase updateProfile] Failed:', error)
      throw error
    }
  }

  const sendPasswordReset = async (email: string) => {
    console.log('🔐 [Firebase useAuth] sendPasswordReset called')
    
    const userName = email.split('@')[0]
    
    try {
      console.log('🔑 [Firebase useAuth] Intentando enviar correo de recuperación personalizado...')
      
      // Generar link de recuperación usando nuestro endpoint
      const linkResponse = await fetch('/api/generate-password-reset-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      })
      
      const linkResponseText = await linkResponse.text()
      console.log('🔑 [Firebase useAuth] Respuesta del endpoint de link:', linkResponse.status, linkResponseText.substring(0, 200))
      
      if (linkResponse.ok) {
        const linkData = JSON.parse(linkResponseText)
        const resetLink = linkData.resetLink
        
        if (!resetLink) {
          console.error('❌ [Firebase useAuth] No se recibió resetLink en la respuesta')
          throw new Error('No se pudo generar el link de recuperación')
        }
        
        console.log('🔑 [Firebase useAuth] Link generado correctamente, enviando correo...')
        
        // Enviar correo de recuperación personalizado
        const resetResponse = await fetch('/api/send-password-reset-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: email,
            userName: userName,
            resetLink: resetLink
          })
        })
        
        const resetResponseText = await resetResponse.text()
        console.log('🔑 [Firebase useAuth] Respuesta del endpoint de correo:', resetResponse.status, resetResponseText.substring(0, 200))
        
        if (resetResponse.ok) {
          console.log('✅ [Firebase useAuth] Correo de recuperación personalizado enviado exitosamente')
          return { error: null }
        } else {
          const errorData = JSON.parse(resetResponseText)
          console.error('❌ [Firebase useAuth] Error enviando correo de recuperación:', errorData)
          throw new Error(`Error al enviar correo: ${errorData.error || 'Error desconocido'}`)
        }
      } else {
        let errorData
        try {
          errorData = JSON.parse(linkResponseText)
        } catch (parseError) {
          console.error('❌ [Firebase useAuth] Error parseando respuesta:', linkResponseText)
          throw new Error(`Error al generar link: ${linkResponseText.substring(0, 200)}`)
        }
        console.error('❌ [Firebase useAuth] Error generando link de recuperación:', errorData)
        const errorMessage = errorData.error || 'Error desconocido'
        const errorDetails = errorData.details ? ` - ${errorData.details}` : ''
        throw new Error(`${errorMessage}${errorDetails}`)
      }
    } catch (error: any) {
      console.error('❌ [Firebase useAuth] Error completo en proceso de recuperación:', error)
      // Fallback: usar correo de Firebase como último recurso
      console.warn('⚠️ [Firebase useAuth] Usando correo de Firebase como último recurso')
      try {
        await sendPasswordResetEmail(auth, email)
        console.log('✅ [Firebase useAuth] Email de recuperación de Firebase enviado (último recurso)')
        return { error: null }
      } catch (fallbackError: any) {
        console.error('❌ [Firebase useAuth] Error crítico: No se pudo enviar ningún correo de recuperación:', fallbackError)
        // Traducir el error a un mensaje amigable
        const friendlyError = new Error(getFirebaseErrorMessage(fallbackError))
        return { error: friendlyError }
      }
    }
  }

  const resendVerificationEmail = async () => {
    console.log('🔐 [Firebase useAuth] resendVerificationEmail called')
    if (!auth.currentUser || !auth.currentUser.email) {
      return { error: new Error('No hay usuario autenticado') }
    }
    
    const email = auth.currentUser.email
    const userName = email.split('@')[0]
    
    try {
      // Generar link de verificación usando nuestro endpoint
      const linkResponse = await fetch('/api/generate-verification-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      })
      
      if (linkResponse.ok) {
        const linkData = await linkResponse.json()
        const verificationLink = linkData.verificationLink
        
        // Enviar correo de verificación personalizado
        const verificationResponse = await fetch('/api/send-verification-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: email,
            userName: userName,
            verificationLink: verificationLink
          })
        })
        
        if (verificationResponse.ok) {
          console.log('✅ [Firebase useAuth] Correo de verificación personalizado reenviado')
          return { error: null }
        } else {
          console.error('⚠️ [Firebase useAuth] Error enviando correo de verificación:', await verificationResponse.text())
          // Fallback: usar correo de Firebase
          await firebaseSendEmailVerification(auth.currentUser)
          console.log('✅ [Firebase useAuth] Email de verificación de Firebase reenviado (fallback)')
          return { error: null }
        }
      } else {
        console.error('⚠️ [Firebase useAuth] Error generando link de verificación:', await linkResponse.text())
        // Fallback: usar correo de Firebase
        await firebaseSendEmailVerification(auth.currentUser)
        console.log('✅ [Firebase useAuth] Email de verificación de Firebase reenviado (fallback)')
        return { error: null }
      }
    } catch (error: any) {
      console.error('❌ [Firebase useAuth] resendVerificationEmail ERROR:', error)
      // Fallback: usar correo de Firebase si hay un error
      try {
        await firebaseSendEmailVerification(auth.currentUser)
        console.log('✅ [Firebase useAuth] Email de verificación de Firebase reenviado (fallback)')
        return { error: null }
      } catch (fallbackError: any) {
        // Traducir el error a un mensaje amigable
        const friendlyError = new Error(getFirebaseErrorMessage(fallbackError))
        return { error: friendlyError }
      }
    }
  }

  return (
    <AuthContext.Provider value={{
      user, profile, loading,
      signIn, signUp, signOut, updateProfile,
      sendPasswordReset, resendVerificationEmail
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
