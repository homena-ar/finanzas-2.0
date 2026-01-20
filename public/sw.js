// Service Worker para FinControl PWA
const CACHE_NAME = 'fincontrol-v1'
const urlsToCache = [
  '/',
  '/dashboard',
  '/dashboard/gastos',
  '/manifest.json',
]

// Instalación del Service Worker
self.addEventListener('install', (event) => {
  // Activar inmediatamente sin esperar a que se cierren otras pestañas
  self.skipWaiting()
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('📦 [SW] Cache abierto')
        return cache.addAll(urlsToCache).catch((err) => {
          console.warn('⚠️ [SW] Error cacheando algunas URLs:', err)
          // Continuar aunque falle alguna URL
        })
      })
  )
})

// Activación del Service Worker
self.addEventListener('activate', (event) => {
  // Tomar control inmediatamente de todas las páginas
  event.waitUntil(
    Promise.all([
      // Limpiar caches antiguos
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log('🗑️ [SW] Eliminando cache antiguo:', cacheName)
              return caches.delete(cacheName)
            }
          })
        )
      }),
      // Tomar control de todas las páginas abiertas
      self.clients.claim()
    ])
  )
  console.log('✅ [SW] Service Worker activado')
})

// Estrategia: Network First, luego Cache
self.addEventListener('fetch', (event) => {
  // Solo cachear requests GET
  if (event.request.method !== 'GET') {
    return
  }

  // Ignorar requests de extensiones de Chrome y otros esquemas no soportados
  const url = new URL(event.request.url)
  if (url.protocol === 'chrome-extension:' || 
      url.protocol === 'chrome:' || 
      url.protocol === 'moz-extension:' ||
      url.protocol === 'edge:') {
    return // No procesar estos requests
  }

  // Solo cachear requests del mismo origen
  if (url.origin !== self.location.origin) {
    return
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Si la respuesta es válida, clonarla y guardarla en cache
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone()
          caches.open(CACHE_NAME).then((cache) => {
            try {
              cache.put(event.request, responseToCache)
            } catch (error) {
              // Ignorar errores de cache (puede ser por esquemas no soportados)
              console.warn('⚠️ [SW] Error cacheando:', error)
            }
          })
        }
        return response
      })
      .catch(() => {
        // Si falla la red, intentar desde cache
        return caches.match(event.request)
      })
  )
})
