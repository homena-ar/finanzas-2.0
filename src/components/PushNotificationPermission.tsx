'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useWorkspace } from '@/hooks/useWorkspace'
import { Bell, X } from 'lucide-react'
import { db } from '@/lib/firebase'
import { collection, doc, setDoc, deleteDoc, query, where, getDocs } from 'firebase/firestore'
import { isMobileDevice, notificationPreferences } from '@/lib/utils'

export function PushNotificationPermission() {
  const { user } = useAuth()
  const { currentWorkspace } = useWorkspace()
  const [showPrompt, setShowPrompt] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission>('default')

  useEffect(() => {
    if (!user) return

    // OPCIÓN A: No mostrar en desktop (PC)
    if (!isMobileDevice()) {
      return
    }

    // Verificar si el navegador soporta notificaciones
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      return
    }

    // Obtener el estado actual del permiso
    setPermission(Notification.permission)

    // Si ya dio permiso o lo rechazó, no mostrar el prompt
    if (Notification.permission !== 'default') {
      // Si ya está habilitado, guardar preferencia
      if (Notification.permission === 'granted') {
        notificationPreferences.setEnabled()
      } else if (Notification.permission === 'denied') {
        notificationPreferences.setDenied()
      }
      return
    }

    // Verificar preferencias guardadas (dismissed, enabled, denied)
    if (!notificationPreferences.shouldShow()) {
      return
    }

    // Esperar un poco antes de mostrar el prompt (para no ser intrusivo)
    const timer = setTimeout(() => {
      setShowPrompt(true)
    }, 5000) // 5 segundos después de cargar

    return () => clearTimeout(timer)
  }, [user])

  const requestPermission = async () => {
    try {
      const permission = await Notification.requestPermission()
      setPermission(permission)

      if (permission === 'granted') {
        // Registrar el token de push
        await subscribeToPushNotifications()
        // Guardar preferencia: notificaciones habilitadas
        notificationPreferences.setEnabled()
        setShowPrompt(false)
      } else if (permission === 'denied') {
        // Guardar preferencia: notificaciones rechazadas
        notificationPreferences.setDenied()
        setShowPrompt(false)
      } else {
        setShowPrompt(false)
      }
    } catch (error) {
      console.error('Error solicitando permiso de notificaciones:', error)
      setShowPrompt(false)
    }
  }

  const handleDismiss = () => {
    // Guardar preferencia: banner cerrado
    notificationPreferences.setDismissed()
    setShowPrompt(false)
  }

  const subscribeToPushNotifications = async () => {
    if (!user) return

    try {
      const registration = await navigator.serviceWorker.ready

      // Obtener el VAPID public key desde las variables de entorno
      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!vapidPublicKey) {
        console.warn('⚠️ VAPID public key no configurada')
        return
      }

      // Convertir la clave VAPID a formato Uint8Array
      const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey)

      // Suscribirse a las notificaciones push
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey
      })

      // Guardar la suscripción en Firestore
      const tokenData: Record<string, unknown> = {
        user_id: user.uid,
        subscription: JSON.parse(JSON.stringify(subscription)),
        user_agent: navigator.userAgent,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      if (currentWorkspace?.id) {
        tokenData.workspace_id = currentWorkspace.id
      }

      // Usar el endpoint como ID único (un dispositivo puede tener múltiples tokens si usa varios workspaces)
      const tokenId = btoa(subscription.endpoint).replace(/[^a-zA-Z0-9]/g, '').substring(0, 100)
      
      await setDoc(doc(db, 'notification_tokens', tokenId), tokenData)

      console.log('✅ Suscripción a push notifications guardada')
    } catch (error) {
      console.error('Error suscribiéndose a push notifications:', error)
    }
  }

  // Función auxiliar para convertir VAPID key
  const urlBase64ToUint8Array = (base64String: string) => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4)
    const base64 = (base64String + padding)
      .replace(/\-/g, '+')
      .replace(/_/g, '/')

    const rawData = window.atob(base64)
    const outputArray = new Uint8Array(rawData.length)

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i)
    }
    return outputArray
  }

  if (!showPrompt || permission !== 'default') {
    return null
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-4 max-w-sm">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-primary-600 to-primary-500 rounded-xl flex items-center justify-center shrink-0">
            <Bell className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-slate-900 mb-1">¿Activar notificaciones?</h3>
            <p className="text-sm text-slate-600 mb-3">
              Recibí alertas de cierres y vencimientos directamente en tu dispositivo
            </p>
            <div className="flex gap-2">
              <button
                onClick={requestPermission}
                className="btn btn-primary text-sm py-2 px-4 flex-1"
              >
                Activar
              </button>
              <button
                onClick={handleDismiss}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
                aria-label="Cerrar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
