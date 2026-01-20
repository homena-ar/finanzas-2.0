'use client'

import { useEffect } from 'react'

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      // Registrar el service worker cuando la app esté lista
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/sw.js')
          .then((registration) => {
            console.log('✅ [PWA] Service Worker registrado:', registration.scope)
            
            // Verificar actualizaciones periódicamente
            setInterval(() => {
              registration.update()
            }, 60 * 60 * 1000) // Cada hora
          })
          .catch((error) => {
            console.error('❌ [PWA] Error registrando Service Worker:', error)
          })
      })
    }
  }, [])

  return null
}
