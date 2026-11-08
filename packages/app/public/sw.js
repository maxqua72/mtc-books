// Service worker del Taccuino: prima la rete, la copia in cache solo senza connessione.
// Così online si usa sempre l'ultima versione pubblicata e offline il Taccuino si apre lo stesso.
const CACHE = 'mtc-books-v1'

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key)
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return
  event.respondWith((async () => {
    try {
      const response = await fetch(request)
      if (response.ok) {
        const copy = response.clone()
        event.waitUntil(caches.open(CACHE).then((cache) => cache.put(request, copy)))
      }
      return response
    } catch (error) {
      const cached = await caches.match(request, { ignoreSearch: true })
      if (cached) return cached
      // Navigazione senza rete verso un indirizzo mai visto: la pagina principale
      if (request.mode === 'navigate') {
        const home = await caches.match(new URL('./', self.registration.scope).href)
        if (home) return home
      }
      throw error
    }
  })())
})
