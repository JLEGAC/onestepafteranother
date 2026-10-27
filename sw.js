const CACHE = "un-pas-apres-lautre-v6";
const CORE = ["./", "./index.html", "./styles.css", "./manifest.json", "./icon.svg", "./icon-192.png", "./icon-512.png", "./icon-192-maskable.png", "./icon-512-maskable.png", "./logo.svg", "./apple-touch-icon.png", "./src/app.js", "./src/data.js", "./src/views.js", "./src/gamification.js", "./src/engagement.js", "./src/engagement-views.js", "./src/planning.js"];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE)));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(key => key.startsWith("un-pas-apres-lautre-") && key !== CACHE).map(key => caches.delete(key))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const response = await fetch(event.request);
      if (!response.ok) {
        return await cache.match(event.request) || response;
      }
      if (response.ok && response.type !== "opaque") {
        try {
          await cache.put(event.request, response.clone());
        } catch {
          // A cache quota or storage error must not hide a valid network response.
        }
      }
      return response;
    } catch {
      const cached = await cache.match(event.request);
      if (cached) return cached;
      if (event.request.mode === "navigate") {
        return await cache.match("./index.html") || new Response("Cette page n’est pas disponible hors connexion.", {
          status: 503,
          headers: { "Content-Type": "text/plain; charset=utf-8" }
        });
      }
      return new Response("Cette ressource n’est pas disponible hors connexion.", {
        status: 503,
        headers: { "Content-Type": "text/plain; charset=utf-8" }
      });
    }
  })());
});
