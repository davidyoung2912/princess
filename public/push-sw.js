/* Alerts from the server (next-level plan N3.1). Loaded by the generated service worker with importScripts, so it must stay plain script.
   A push shows a notification; a tap opens the screen the notice is about. Safety notices stay on screen until the guest acts. */
self.addEventListener('push', (event) => {
  let data = null
  try { data = event.data ? event.data.json() : null } catch { data = null }
  if (!data || typeof data.title !== 'string') return
  const path = typeof data.path === 'string' && data.path.startsWith('/') && !data.path.startsWith('//') ? data.path : '/'
  event.waitUntil(Promise.all([
    self.registration.showNotification(data.title, {
      body: typeof data.body === 'string' ? data.body : '',
      tag: typeof data.id === 'string' ? data.id : undefined,
      requireInteraction: data.critical === true,
      icon: '/icon-192.png',
      data: { path, id: typeof data.id === 'string' ? data.id : null },
    }),
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const c of clients) c.postMessage({ type: 'princess-push', id: data.id, kind: data.kind })
    }),
  ]))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const path = event.notification.data && event.notification.data.path ? event.notification.data.path : '/'
  const id = event.notification.data && typeof event.notification.data.id === 'string' ? event.notification.data.id : null
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
    for (const c of clients) {
      if ('focus' in c) { c.postMessage({ type: 'princess-open', path, id }); return c.focus() }
    }
    return self.clients.openWindow ? self.clients.openWindow(path) : undefined
  }))
})
