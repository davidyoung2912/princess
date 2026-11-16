/* Alerts from the server (next-level plan N3.1). Loaded by the generated service worker with importScripts, so it must stay plain script.
   A push shows a notification; a tap opens the screen the notice is about. Safety notices stay on screen until the guest acts. */
self.addEventListener('push', (event) => {
  let data = null
  try { data = event.data ? event.data.json() : null } catch { data = null }
  if (!data || typeof data.title !== 'string') return
  const safe = (p) => typeof p === 'string' && p.startsWith('/') && !p.startsWith('//')
  const path = safe(data.path) ? data.path : '/'
  // Buttons are links to the app's own screens: a title and a path, at most two.
  const actions = Array.isArray(data.actions) ? data.actions.filter((a) => a && typeof a.title === 'string' && safe(a.path)).slice(0, 2) : []
  event.waitUntil(Promise.all([
    self.registration.showNotification(data.title, {
      body: typeof data.body === 'string' ? data.body : '',
      // A notice may name a tag of its own so several collapse into one (a busy chat); otherwise each is its own.
      tag: typeof data.tag === 'string' ? data.tag : typeof data.id === 'string' ? data.id : undefined,
      renotify: typeof data.tag === 'string',
      requireInteraction: data.critical === true,
      icon: '/icon-192.png',
      actions: actions.map((a, i) => ({ action: `a${i}`, title: a.title })),
      data: { path, id: typeof data.id === 'string' ? data.id : null, actions: actions.map((a) => a.path) },
    }),
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const c of clients) c.postMessage({ type: 'princess-push', id: data.id, kind: data.kind })
    }),
  ]))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const data = event.notification.data || {}
  // A button opens its own screen; a tap on the body opens the one the notice is about.
  const pick = /^a(\d)$/.exec(event.action || '')
  const own = pick && Array.isArray(data.actions) ? data.actions[Number(pick[1])] : null
  const path = typeof own === 'string' ? own : data.path ? data.path : '/'
  const id = event.notification.data && typeof event.notification.data.id === 'string' ? event.notification.data.id : null
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
    for (const c of clients) {
      if ('focus' in c) { c.postMessage({ type: 'princess-open', path, id }); return c.focus() }
    }
    return self.clients.openWindow ? self.clients.openWindow(path) : undefined
  }))
})
