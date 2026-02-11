'use client'

import { useEffect, useState } from 'react'
import { Download, X } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { isMobileDevice, pwaPreferences } from '@/lib/utils'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function InstallPWA() {
  const { user } = useAuth()
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showInstallButton, setShowInstallButton] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)

  useEffect(() => {
    // Solo mostrar en mobile
    if (!isMobileDevice()) {
      return
    }

    // Verificar si ya está instalado (según preferencias guardadas)
    if (pwaPreferences.isInstalled()) {
      setIsInstalled(true)
      return
    }

    // Verificar si ya está instalado (según display mode)
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true)
      pwaPreferences.setInstalled()
      return
    }

    // Verificar preferencias guardadas (dismissed, installed)
    if (!pwaPreferences.shouldShow()) {
      return
    }

    // Escuchar el evento beforeinstallprompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      if (pwaPreferences.shouldShow()) {
        setShowInstallButton(true)
      }
    }

    // Escuchar cuando se instala la app
    const handleAppInstalled = () => {
      setIsInstalled(true)
      pwaPreferences.setInstalled()
      setShowInstallButton(false)
      setDeferredPrompt(null)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)

    // Verificar si el prompt ya está disponible después de un delay
    const timeoutId = window.setTimeout(() => {
      if (pwaPreferences.shouldShow() && !deferredPrompt && !isInstalled) {
        // Si no hay prompt automático pero la app es instalable, mostrar botón manual
        if ('serviceWorker' in navigator && window.matchMedia('(display-mode: browser)').matches) {
          setShowInstallButton(true)
        }
      }
    }, 3000)

    return () => {
      window.clearTimeout(timeoutId)
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [deferredPrompt, isInstalled])

  const handleDismiss = () => {
    // Guardar preferencia: banner cerrado
    pwaPreferences.setDismissed()
    setShowInstallButton(false)
    setDeferredPrompt(null)
  }

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      // Si no hay prompt automático, mostrar instrucciones
      alert(
        'Para instalar FinControl:\n\n' +
        'Chrome/Edge: Ícono (➕) en la barra de direcciones, o Menú (⋮) → "Instalar FinControl" / "Instalar app"\n\n' +
        'Android: Menú (⋮) > "Instalar app" o "Agregar a pantalla de inicio"\n\n' +
        'iOS: Compartir (□↑) > "Agregar a pantalla de inicio"'
      )
      return
    }

    // Mostrar el prompt de instalación
    deferredPrompt.prompt()

    // Esperar la respuesta del usuario
    const { outcome } = await deferredPrompt.userChoice

    if (outcome === 'accepted') {
      console.log('✅ Usuario aceptó instalar la app')
      // La preferencia se guardará cuando se dispare el evento 'appinstalled'
    } else {
      console.log('❌ Usuario rechazó instalar la app')
      // Si rechaza, no guardamos nada (puede cambiar de opinión más tarde)
    }

    setDeferredPrompt(null)
    setShowInstallButton(false)
  }

  if (isInstalled) {
    return null
  }

  if (!showInstallButton) {
    return null
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-4 max-w-sm">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-primary-600 to-primary-500 rounded-xl flex items-center justify-center shrink-0">
            <Download className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-slate-900 mb-1">Instalar FinControl</h3>
            <p className="text-sm text-slate-600 mb-3">
              Instalá la app para acceso rápido y funcionamiento offline
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleInstallClick}
                className="btn btn-primary text-sm py-2 px-4 flex-1"
              >
                Instalar
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
