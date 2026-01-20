'use client'

import { useEffect } from 'react'

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return
    }

    const registerSW = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/'
        })
        
        console.log('✅ [PWA] Service Worker registrado:', registration.scope)
        
        // Verificar si hay una actualización disponible
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('🔄 [PWA] Nueva versión disponible. Recarga la página para actualizar.')
              }
            })
          }
        })

        // Verificar actualizaciones periódicamente (cada hora)
        setInterval(() => {
          registration.update()
        }, 60 * 60 * 1000)

        // Manejar cuando el SW está listo
        if (registration.active) {
          console.log('✅ [PWA] Service Worker activo')
        }
      } catch (error) {
        console.error('❌ [PWA] Error registrando Service Worker:', error)
      }
    }

    // Registrar inmediatamente si la página ya está cargada
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      registerSW()
    } else {
      // Si no está lista, esperar al evento load
      window.addEventListener('load', registerSW)
    }
  }, [])

  return null
}
