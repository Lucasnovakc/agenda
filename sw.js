// Service worker da Agenda: mostra as notificações e trata os toques nelas.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

const janelas = () => self.clients.matchAll({ type: 'window', includeUncontrolled: true })

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { title: 'Lembrete', body: event.data ? event.data.text() : '' }
  }
  const options = {
    body: data.body || '',
    tag: data.tag,
    renotify: true,
    requireInteraction: true,
    icon: 'icons/icon-192.png',
    badge: 'icons/badge-72.png',
    data,
    actions: data.item_id
      ? [
          { action: 'concluir', title: 'Concluído' },
          { action: 'abrir', title: 'Abrir' },
        ]
      : [],
  }
  event.waitUntil(
    (async () => {
      await self.registration.showNotification(data.title || 'Lembrete', options)
      for (const c of await janelas()) c.postMessage({ type: 'push', payload: data })
    })(),
  )
})

self.addEventListener('notificationclick', (event) => {
  const data = event.notification.data || {}
  event.notification.close()
  event.waitUntil(
    (async () => {
      if (event.action === 'concluir' && data.complete_url) {
        try {
          const r = await fetch(data.complete_url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ item_id: data.item_id, user_id: data.user_id, token: data.token }),
          })
          if (!r.ok) throw new Error(`HTTP ${r.status}`)
          for (const c of await janelas()) c.postMessage({ type: 'refresh' })
          return
        } catch {
          // falhou (ex.: sem internet): abre o app no item para concluir por lá
        }
      }
      const hash = data.item_id ? `#/item/${data.item_id}` : '#/hoje'
      for (const c of await janelas()) {
        if ('focus' in c) {
          await c.focus()
          c.postMessage({ type: 'navigate', hash })
          return
        }
      }
      const url = new URL(self.registration.scope)
      url.hash = hash
      await self.clients.openWindow(url.href)
    })(),
  )
})
