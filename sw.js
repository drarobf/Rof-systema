// Service Worker do Sistema ROF™
// Só habilita a instalação como app. NÃO guarda nada em cache:
// tudo vem sempre da internet, então o sistema nunca fica desatualizado.
self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  event.respondWith(fetch(event.request));
});
