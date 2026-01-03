'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import {
  User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged
} from 'firebase/auth'
import { doc, getDoc, setDoc, updateDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { Profile } from '@/types'

interface AuthContextType {
  user: User | null
  profile: Profile | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: any }>
  signUp: (email: string, password: string) => Promise<{ error: any }>
  signOut: () => Promise<void>
  updateProfile: (data: Partial<Profile>) => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

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

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log('🔐 [Firebase useAuth] Auth state changed:', firebaseUser ? 'USER LOGGED IN' : 'NO USER')

      if (firebaseUser) {
        setUser(firebaseUser)
        const profileData = await fetchProfile(firebaseUser.uid)
        setProfile(profileData)
      } else {
        setUser(null)
        setProfile(null)
      }

      setLoading(false)
    })

    return () => {
      console.log('🔐 [Firebase useAuth] Cleanup - unsubscribing')
      unsubscribe()
    }
  }, [])

  const signIn = async (email: string, password: string) => {
    console.log('🔐 [Firebase useAuth] signIn called')
    setLoading(true)
    try {
      await signInWithEmailAndPassword(auth, email, password)
      console.log('🔐 [Firebase useAuth] signIn SUCCESS')
      return { error: null }
    } catch (error: any) {
      console.error('🔐 [Firebase useAuth] signIn ERROR:', error)
      setLoading(false)
      return { error }
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
      // Create profile document
      const defaultProfile: Profile = {
        id: userCredential.user.uid,
        email: email,
        nombre: email.split('@')[0],
        budget_ars: 0,
        budget_usd: 0,
        ahorro_pesos: 0,
        ahorro_usd: 0,
        created_at: new Date().toISOString()
      }
      await setDoc(doc(db, 'profiles', userCredential.user.uid), defaultProfile)

      // Create default categorias
      await createDefaultCategorias(userCredential.user.uid)

      console.log('🔐 [Firebase useAuth] signUp SUCCESS')
      return { error: null }
    } catch (error: any) {
      console.error('🔐 [Firebase useAuth] signUp ERROR:', error)
      return { error }
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

  return (
    <AuthContext.Provider value={{
      user, profile, loading,
      signIn, signUp, signOut, updateProfile
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
