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
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('📦 [SW] Cache abierto')
        return cache.addAll(urlsToCache)
      })
  )
})

// Activación del Service Worker
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('🗑️ [SW] Eliminando cache antiguo:', cacheName)
            return caches.delete(cacheName)
          }
        })
      )
    })
  )
})

// Estrategia: Network First, luego Cache
self.addEventListener('fetch', (event) => {
  // Solo cachear requests GET
  if (event.request.method !== 'GET') {
    return
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Si la respuesta es válida, clonarla y guardarla en cache
        if (response && response.status === 200) {
          const responseToCache = response.clone()
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache)
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
