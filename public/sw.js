/* Nhắc Việc service worker: offline shell, Web Push display and notification actions. */
const CACHE = 'nhac-viec-v4'
const ACTION_URL = 'https://lsznbtcmrbeougdjgnye.supabase.co/functions/v1/notification-action'
const SCOPE = self.registration.scope

/**
 * Same-origin asset URLs (hashed JS/CSS) referenced by an index.html.
 * NOTE: pruning keeps only these. If code splitting (dynamic import) or /assets/ fonts/images are added later,
 * extend this list (e.g. from a Vite manifest) or they will be dropped from the offline cache.
 */
function assetsIn(html) {
  return [...html.matchAll(/(?:src|href)="([^"]*\/assets\/[^"]+)"/g)].map((m) => new URL(m[1], SCOPE).href)
}

/**
 * Cache a fresh shell only once ALL of its assets are cached, then prune assets the shell no longer needs.
 * Calls are serialized so two refreshes (two tabs, stale edge) cannot interleave their prune steps.
 */
let refreshing = Promise.resolve()
function refreshShell(res) {
  refreshing = refreshing.then(() => doRefresh(res)).catch(() => undefined)
  return refreshing
}
async function doRefresh(res) {
  const cache = await caches.open(CACHE)
  const html = await res.clone().text()
  const wanted = assetsIn(html)
  for (const u of wanted) {
    if (await cache.match(u, { ignoreVary: true })) continue
    const a = await fetch(u, { cache: 'no-store' })
    if (!a.ok) throw new Error('asset ' + u) // keep the previous shell + assets intact
    await cache.put(u, a)
  }
  // A redirected response cannot be served for a navigation; store a plain copy.
  const shell = res.redirected ? new Response(await res.blob(), { status: 200, headers: res.headers }) : res
  await cache.put(SCOPE, shell)
  const keys = await cache.keys()
  await Promise.all(keys.filter((k) => k.url.includes('/assets/') && !wanted.includes(k.url)).map((k) => cache.delete(k)))
}

self.addEventListener('install', (event) => {
  // Precache the shell AND its hashed assets so the app opens offline even after a single visit.
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll([SCOPE + 'manifest.webmanifest', SCOPE + 'icon-192.png', SCOPE + 'badge-96.png']))
      .then(() => fetch(SCOPE, { cache: 'no-store' }))
      .then((res) => (res.ok ? refreshShell(res) : undefined))
      .catch(() => undefined),
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return // Supabase, fonts… go straight to the network

  if (req.mode === 'navigate') {
    // Network first so updates show up; fall back to the cached shell offline.
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok && res.headers.get('content-type')?.includes('text/html')) event.waitUntil(refreshShell(res.clone()))
          return res
        })
        .catch(() => caches.match(SCOPE, { ignoreVary: true })),
    )
    return
  }

  // Stale-while-revalidate for same-origin assets.
  event.respondWith(
    caches.open(CACHE).then((cache) =>
      cache.match(req, { ignoreVary: true }).then((hit) => {
        const fresh = fetch(req)
          .then((res) => {
            if (res.ok) cache.put(req, res.clone())
            return res
          })
          .catch(() => hit)
        return hit || fresh
      }),
    ),
  )
})

self.addEventListener('push', (event) => {
  let p = {}
  try {
    p = event.data ? event.data.json() : {}
  } catch {
    p = { title: 'Nhắc việc', body: event.data ? event.data.text() : '' }
  }
  event.waitUntil(
    self.registration.showNotification(p.title || 'Nhắc việc', {
      body: p.body || 'Đến giờ rồi',
      tag: p.taskId,
      renotify: true,
      requireInteraction: true,
      icon: SCOPE + 'icon-192.png',
      badge: SCOPE + 'badge-96.png',
      data: p,
      actions: p.token
        ? [
            { action: 'done', title: 'Xong' },
            { action: 'snooze', title: 'Hoãn 10 phút' },
          ]
        : [],
    }),
  )
})

async function tellClients(message) {
  const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
  all.forEach((c) => c.postMessage(message))
  return all
}

self.addEventListener('notificationclick', (event) => {
  const n = event.notification
  const p = n.data || {}
  n.close()

  if (event.action === 'done' || event.action === 'snooze') {
    event.waitUntil(
      fetch(ACTION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: p.userId, taskId: p.taskId, token: p.token, action: event.action }),
      })
        .then((res) => res.ok)
        .catch(() => false)
        .then((ok) =>
          ok
            ? tellClients({ type: 'sync' })
            : self.registration.showNotification(p.title || 'Nhắc việc', {
                body: 'Chưa thực hiện được (mất mạng hoặc việc đã đổi). Mở app để xử lý.',
                tag: p.taskId,
                icon: SCOPE + 'icon-192.png',
                badge: SCOPE + 'badge-96.png',
                data: { taskId: p.taskId },
              }),
        ),
    )
    return
  }

  event.waitUntil(
    tellClients({ type: 'open-task', taskId: p.taskId }).then((all) => {
      const win = all.find((c) => c.url.startsWith(SCOPE))
      if (win) return win.focus()
      return self.clients.openWindow(SCOPE + (p.taskId ? '?task=' + encodeURIComponent(p.taskId) : ''))
    }),
  )
})
