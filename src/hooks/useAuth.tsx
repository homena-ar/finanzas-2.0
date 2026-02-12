'use client'

import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react'
import {
  User,
  signInWithEmailAndPassword,
  signInWithCustomToken,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  sendEmailVerification as firebaseSendEmailVerification,
  getIdToken
} from 'firebase/auth'
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore'
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

// Fetch con timeout para evitar que requests cuelguen indefinidamente
const FETCH_TIMEOUT_MS = 15000
function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = FETCH_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timeout))
}

// Claves para almacenamiento de respaldo de sesión (iOS Safari puede perder IndexedDB)
const SESSION_BACKUP_KEY = 'fincontrol:auth_session_backup'
const SESSION_BACKUP_TIMESTAMP_KEY = 'fincontrol:auth_session_timestamp'
// Maximum age for session backup to be considered valid (7 days)
const SESSION_BACKUP_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

// Guardar sesión en localStorage como respaldo (para iOS)
async function backupSession(user: User) {
  if (typeof window === 'undefined') return
  try {
    const token = await getIdToken(user)
    const sessionData = {
      uid: user.uid,
      email: user.email,
      emailVerified: user.emailVerified,
      token: token,
      timestamp: Date.now()
    }
    localStorage.setItem(SESSION_BACKUP_KEY, JSON.stringify(sessionData))
    localStorage.setItem(SESSION_BACKUP_TIMESTAMP_KEY, String(Date.now()))
    console.log('💾 [Firebase useAuth] Sesión guardada en respaldo')
  } catch (error) {
    console.error('❌ [Firebase useAuth] Error guardando respaldo de sesión:', error)
  }
}

// Verificar si existe un respaldo de sesión válido (no expirado)
function hasValidSessionBackup(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const timestamp = localStorage.getItem(SESSION_BACKUP_TIMESTAMP_KEY)
    if (!timestamp) return false
    const age = Date.now() - Number(timestamp)
    if (age > SESSION_BACKUP_MAX_AGE_MS) return false
    const data = localStorage.getItem(SESSION_BACKUP_KEY)
    if (!data) return false
    const parsed = JSON.parse(data)
    return !!(parsed.uid && parsed.email)
  } catch {
    return false
  }
}

// Limpiar respaldo de sesión.
// IMPORTANT: Only call on EXPLICIT sign-out, never when onAuthStateChanged fires null.
// On iOS PWA, persistence can briefly report null when the app is restored from background
// and we must NOT destroy the backup in that scenario.
function clearSessionBackup() {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(SESSION_BACKUP_KEY)
    localStorage.removeItem(SESSION_BACKUP_TIMESTAMP_KEY)
    console.log('🗑️ [Firebase useAuth] Respaldo de sesión limpiado')
  } catch (error) {
    console.error('❌ [Firebase useAuth] Error limpiando respaldo:', error)
  }
}

// ─── Remote logger: forwards client logs to Railway via /api/debug-log ───
const _remoteLogQueue: Array<{level: string, message: string, platform: string}> = []
let _remoteLogTimer: ReturnType<typeof setTimeout> | null = null

function getPlatformTag(): string {
  if (typeof window === 'undefined') return 'server'
  const ua = navigator.userAgent
  const standalone = (window.navigator as any).standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches
  if (/iPad|iPhone|iPod/.test(ua)) return standalone ? 'iOS-PWA' : 'iOS-Safari'
  if (/Android/.test(ua)) return standalone ? 'Android-PWA' : 'Android-Browser'
  return 'Desktop'
}

function remoteLog(level: 'info'|'warn'|'error', message: string) {
  console.log(`[AUTH-DEBUG] ${message}`)
  if (typeof window === 'undefined') return
  _remoteLogQueue.push({ level, message, platform: getPlatformTag() })
  if (!_remoteLogTimer) {
    _remoteLogTimer = setTimeout(() => {
      const batch = _remoteLogQueue.splice(0)
      _remoteLogTimer = null
      fetch('/api/debug-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logs: batch })
      }).catch(() => {})
    }, 500)
  }
}

// ─── Cookie-based session: more reliable than localStorage on iOS PWA ───

// Create server-side session cookie after successful login
async function createSessionCookie(user: User): Promise<void> {
  try {
    const idToken = await getIdToken(user, true)
    const res = await fetch('/api/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken })
    })
    if (res.ok) {
      remoteLog('info', `Session cookie created for uid=${user.uid}`)
    } else {
      const body = await res.text()
      remoteLog('warn', `Session cookie creation failed: ${res.status} ${body}`)
    }
  } catch (error: any) {
    remoteLog('warn', `Session cookie creation error: ${error.message}`)
  }
}

// Try to recover session from server-side cookie when Firebase persistence fails
async function recoverSessionFromCookie(): Promise<User | null> {
  try {
    remoteLog('info', 'Attempting session recovery from cookie...')
    const res = await fetch('/api/session', { method: 'GET' })
    if (!res.ok) {
      remoteLog('info', `Cookie recovery: no valid cookie (${res.status})`)
      return null
    }
    const data = await res.json()
    if (!data.customToken) {
      remoteLog('warn', 'Cookie recovery: response missing customToken')
      return null
    }
    remoteLog('info', `Cookie recovery: got custom token for uid=${data.uid}, signing in...`)
    const cred = await signInWithCustomToken(auth, data.customToken)
    remoteLog('info', `Cookie recovery: SUCCESS, uid=${cred.user.uid}`)
    return cred.user
  } catch (error: any) {
    remoteLog('error', `Cookie recovery failed: ${error.message}`)
    return null
  }
}

// Clear server-side session cookie
async function clearSessionCookie(): Promise<void> {
  try {
    await fetch('/api/session', { method: 'DELETE' })
  } catch { /* best-effort */ }
}

// ─── Diagnostic: dump storage state ───
function dumpStorageState(): string {
  if (typeof window === 'undefined') return 'SSR'
  try {
    const backup = localStorage.getItem(SESSION_BACKUP_KEY)
    const timestamp = localStorage.getItem(SESSION_BACKUP_TIMESTAMP_KEY)
    const backupAge = timestamp ? `${Math.round((Date.now() - Number(timestamp)) / 1000)}s ago` : 'none'
    const backupUid = backup ? JSON.parse(backup).uid?.substring(0, 8) : 'none'
    const firebaseKeys = Object.keys(localStorage).filter(k => k.startsWith('firebase'))
    return `backup=${backupUid}(${backupAge}), firebase_keys=${firebaseKeys.length}, auth.currentUser=${auth.currentUser?.uid?.substring(0, 8) || 'null'}`
  } catch (e: any) {
    return `error: ${e.message}`
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
    remoteLog('info', `Auth listener setup. Storage: ${dumpStorageState()}`)

    let previousEmailVerified: boolean | null = null

    // Track whether this is the very first onAuthStateChanged callback (initial hydration)
    let isFirstCallback = true
    // Guard: after a successful recovery via signInWithCustomToken, Firebase may
    // fire an intermediate onAuthStateChanged(null) before the user callback.
    // We ignore null callbacks for a short window after recovery to prevent
    // the login form from flashing.
    let lastRecoverySuccessTime = 0

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      remoteLog('info', `onAuthStateChanged: ${firebaseUser ? `USER uid=${firebaseUser.uid.substring(0, 8)}` : 'NULL'} (first=${isFirstCallback})`)
      remoteLog('info', `Storage at callback: ${dumpStorageState()}`)

      if (firebaseUser) {
        // Recargar el usuario para obtener el estado más reciente de emailVerified
        await firebaseUser.reload()

        // Guardar sesión en respaldo localStorage + cookie HTTP-only
        await backupSession(firebaseUser)
        await createSessionCookie(firebaseUser)

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
              const welcomeResponse = await fetchWithTimeout('/api/send-welcome-email', {
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
        isFirstCallback = false
      } else {
        // ─── NULL user: attempt recovery ───
        remoteLog('info', `NULL user handler. isFirst=${isFirstCallback}, hasBackup=${hasValidSessionBackup()}`)

        // After a successful signInWithCustomToken recovery, Firebase may fire
        // an intermediate null callback before the real user callback arrives.
        // Ignore null events for a short window after recovery.
        if (lastRecoverySuccessTime && Date.now() - lastRecoverySuccessTime < 5000) {
          remoteLog('info', `Ignoring null callback within 5s of recovery success`)
          return
        }

        if (isFirstCallback) {
          isFirstCallback = false

          // Start cookie recovery fetch in background immediately so the
          // network request runs in parallel with persistence polling.
          const cookieRecoveryPromise = recoverSessionFromCookie().catch(() => null)

          // Strategy 1: Poll for Firebase persistence hydration instead of a
          // fixed 1.5 s wait.  Check every 100 ms; bail after 800 ms.
          if (hasValidSessionBackup()) {
            remoteLog('info', 'Recovery strategy 1: polling for persistence hydration...')
            const POLL_INTERVAL = 100
            const MAX_WAIT = 800
            for (let elapsed = 0; elapsed < MAX_WAIT; elapsed += POLL_INTERVAL) {
              await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL))
              if (auth.currentUser) break
            }
            const recoveredUser = auth.currentUser
            if (recoveredUser) {
              remoteLog('info', `Strategy 1 SUCCESS: uid=${recoveredUser.uid.substring(0, 8)}`)
              lastRecoverySuccessTime = Date.now()
              await recoveredUser.reload()
              await backupSession(recoveredUser)
              await createSessionCookie(recoveredUser)
              setUser(recoveredUser)
              if (recoveredUser.emailVerified) {
                const profileData = await fetchProfile(recoveredUser.uid)
                setProfile(profileData)
              }
              previousEmailVerified = recoveredUser.emailVerified
              setLoading(false)
              return
            }
            remoteLog('warn', 'Strategy 1 failed: still null after polling')
          }

          // Strategy 2: Recover from HTTP-only session cookie (survives iOS
          // storage eviction).  The fetch was already started above, so we just
          // await the result — no extra network latency.
          remoteLog('info', 'Recovery strategy 2: cookie-based session recovery...')
          const cookieUser = await cookieRecoveryPromise
          if (cookieUser) {
            remoteLog('info', `Strategy 2 SUCCESS: uid=${cookieUser.uid.substring(0, 8)}`)
            lastRecoverySuccessTime = Date.now()
            await backupSession(cookieUser)
            setUser(cookieUser)
            if (cookieUser.emailVerified) {
              const profileData = await fetchProfile(cookieUser.uid)
              setProfile(profileData)
            }
            previousEmailVerified = cookieUser.emailVerified
            setLoading(false)
            return
          }

          remoteLog('warn', 'All recovery strategies failed — user is truly logged out')
        }

        isFirstCallback = false
        setUser(null)
        setProfile(null)
        previousEmailVerified = null
        // Do NOT clear session backup or cookie here — only on explicit signOut()
      }

      setLoading(false)
    })

    return () => {
      console.log('🔐 [Firebase useAuth] Cleanup - unsubscribing')
      unsubscribe()
    }
  }, [])

  // Keep a ref so the visibility handler always sees the latest user/loading
  const userRef = useRef<User | null>(null)
  const loadingRef = useRef(true)
  useEffect(() => { userRef.current = user }, [user])
  useEffect(() => { loadingRef.current = loading }, [loading])

  // Session revalidation when the app becomes visible again.
  // Critical for iOS PWA where killing the app from the switcher may
  // cause auth.currentUser to be null in React state while Firebase
  // persistence still holds the session in localStorage/IndexedDB.
  useEffect(() => {
    if (typeof window === 'undefined') return

    let isRestoring = false

    const handleVisibilityChange = async () => {
      if (document.visibilityState !== 'visible') return
      if (isRestoring || loadingRef.current) return
      isRestoring = true

      try {
        const currentUser = auth.currentUser
        if (currentUser) {
          // Validate the token with a force-refresh. This also extends the
          // session lifetime which prevents silent expiration on iOS.
          try {
            await currentUser.getIdToken(true)
          } catch {
            // Token refresh failed → session truly expired
            isRestoring = false
            return
          }

          // If Firebase still has the user but React state lost it
          // (can happen when iOS kills the WebView then restores it)
          if (!userRef.current) {
            await currentUser.reload()
            setUser(currentUser)
            if (currentUser.emailVerified) {
              const profileData = await fetchProfile(currentUser.uid)
              setProfile(profileData)
            }
          }

          // Refresh the localStorage backup token
          await backupSession(currentUser)
        } else if (!userRef.current) {
          // No Firebase user and no React user — try cookie recovery
          remoteLog('info', `Visibility: no user. backup=${hasValidSessionBackup()}, trying cookie recovery...`)

          // Start cookie recovery in parallel with persistence polling
          const visCookiePromise = recoverSessionFromCookie().catch(() => null)

          // Strategy 1: poll for Firebase persistence (up to 600ms)
          for (let i = 0; i < 6; i++) {
            await new Promise(resolve => setTimeout(resolve, 100))
            if (auth.currentUser) break
          }
          let recoveredUser = auth.currentUser
          if (recoveredUser) {
            remoteLog('info', 'Visibility: recovered from persistence')
            await recoveredUser.reload()
            setUser(recoveredUser)
            if (recoveredUser.emailVerified) {
              const profileData = await fetchProfile(recoveredUser.uid)
              setProfile(profileData)
            }
            await backupSession(recoveredUser)
          } else {
            // Strategy 2: cookie-based recovery (already in flight)
            recoveredUser = await visCookiePromise
            if (recoveredUser) {
              remoteLog('info', 'Visibility: recovered from cookie')
              await backupSession(recoveredUser)
              setUser(recoveredUser)
              if (recoveredUser.emailVerified) {
                const profileData = await fetchProfile(recoveredUser.uid)
                setProfile(profileData)
              }
            } else {
              remoteLog('warn', 'Visibility: all recovery failed')
            }
          }
        }
      } catch {
        // Silently fail – next onAuthStateChanged will reconcile
      } finally {
        isRestoring = false
      }
    }

    // Save session state before iOS kills the PWA.
    // pagehide fires reliably on iOS (unlike beforeunload).
    const handlePageHide = () => {
      const hasUser = !!auth.currentUser
      // Sync log (can't await in pagehide)
      console.log(`[AUTH-DEBUG] pagehide: hasUser=${hasUser}`)
      if (auth.currentUser) {
        try {
          const sessionData = {
            uid: auth.currentUser.uid,
            email: auth.currentUser.email,
            emailVerified: auth.currentUser.emailVerified,
            timestamp: Date.now()
          }
          localStorage.setItem(SESSION_BACKUP_KEY, JSON.stringify(sessionData))
          localStorage.setItem(SESSION_BACKUP_TIMESTAMP_KEY, String(Date.now()))
        } catch { /* sync-only, best-effort */ }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleVisibilityChange)
    window.addEventListener('pagehide', handlePageHide)

    // Periodic token refresh while visible (every 20 min).
    // Keeps the Firebase session alive in long PWA usage on iOS.
    const tokenRefreshInterval = setInterval(async () => {
      if (document.visibilityState === 'visible' && auth.currentUser) {
        try {
          await auth.currentUser.getIdToken(true)
          await backupSession(auth.currentUser)
        } catch { /* noop */ }
      }
    }, 20 * 60 * 1000)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleVisibilityChange)
      window.removeEventListener('pagehide', handlePageHide)
      clearInterval(tokenRefreshInterval)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

  // Default categories are created by useData.fetchAllInternal when it detects
  // empty collections - with proper workspace_id. No orphan creation here.

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

      // Las categorías por defecto se crean automáticamente en useData.fetchAllInternal
      // cuando detecta colecciones vacías, ya con el workspace_id correcto

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
          const linkResponse = await fetchWithTimeout('/api/generate-verification-link', {
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
          const verificationResponse = await fetchWithTimeout('/api/send-verification-email', {
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
    remoteLog('info', 'signOut called — clearing all session data')
    await firebaseSignOut(auth)
    setUser(null)
    setProfile(null)
    setLoading(false)
    clearSessionBackup()
    await clearSessionCookie()
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
      const linkResponse = await fetchWithTimeout('/api/generate-password-reset-link', {
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
        const resetResponse = await fetchWithTimeout('/api/send-password-reset-email', {
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
      const linkResponse = await fetchWithTimeout('/api/generate-verification-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      })
      
      if (linkResponse.ok) {
        const linkData = await linkResponse.json()
        const verificationLink = linkData.verificationLink
        
        // Enviar correo de verificación personalizado
        const verificationResponse = await fetchWithTimeout('/api/send-verification-email', {
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
