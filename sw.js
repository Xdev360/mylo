/* Mylo service worker.

   This exists for one reason above all others: iOS has never supported
   `new Notification(...)`, not even inside an installed PWA. The ONLY way to
   raise a notification on an iPhone is through a service worker registration's
   showNotification(). The app used the constructor, which is why alerts worked
   on a laptop and did nothing at all on a phone.

   It also carries the `push` handler, so once a sender is wired up with a VAPID
   key the same worker delivers notifications while the app is fully closed. */

const TAG = 'mylo-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

/* The page asks us to raise a notification — this is the path that works on iOS. */
self.addEventListener('message', event => {
  const d = event.data || {};
  if (d.type !== 'notify') return;
  event.waitUntil(
    self.registration.showNotification(d.title || 'Mylo', {
      body: d.body || '',
      tag: d.tag || undefined,
      icon: 'assets/icon-192.png',
      badge: 'assets/icon-192.png',
      data: { url: d.url || '/' },
      renotify: !!d.tag
    })
  );
});

/* Sent by a server holding the VAPID private key; works with the app closed. */
self.addEventListener('push', event => {
  let d = {};
  try{ d = event.data ? event.data.json() : {}; }catch(_){
    d = { title: 'Mylo', body: event.data ? event.data.text() : '' };
  }
  event.waitUntil(
    self.registration.showNotification(d.title || 'Mylo', {
      body: d.body || '',
      tag: d.tag || undefined,
      icon: 'assets/icon-192.png',
      badge: 'assets/icon-192.png',
      data: { url: d.url || '/' }
    })
  );
});

/* Focus a tab that is already open rather than piling up new ones. */
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all){
      if ('focus' in c){
        try{ await c.navigate(url); }catch(_){}
        return c.focus();
      }
    }
    if (self.clients.openWindow) return self.clients.openWindow(url);
  })());
});
