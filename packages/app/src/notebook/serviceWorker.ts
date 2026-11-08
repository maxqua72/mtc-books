// Registrazione del service worker (public/sw.js): solo nella build pubblicata, mai in sviluppo
export function registerServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
  if (location.protocol !== 'https:' && location.hostname !== 'localhost') return
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch((e) => {
      console.warn('[sw] registrazione non riuscita', e)
    })
  })
}
