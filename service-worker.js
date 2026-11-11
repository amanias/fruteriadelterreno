const CACHE_NAME = "fruteria-del-terreno-v";
const APP_SHELL = [
  "./",
  "./index.html",
  "./index.css",
  "./app.js",
  "./manifest.webmanifest",
  "./icons/apple-touch-icon.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./img/fondo-movil.avif",
  "./img/fondo-movil.jpg",
  "./img/fondo-pc.avif",
  "./img/fondo-pc.jpg",
  "./img/fondo-4k.avif",
  "./img/fondo-4k.jpg",
  "./img/Naranjas.jpeg",
  "./img/naranjas-480.avif",
  "./img/naranjas-480.jpg",
  "./img/naranjas-960.avif",
  "./img/oferta.jpg",
  "./img/whatsapp.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(APP_SHELL);
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames
        .filter((name) => name.startsWith("fruteria-del-terreno-") && name !== CACHE_NAME)
        .map((name) => caches.delete(name))
    );
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const requestUrl = new URL(request.url);

  if (request.method !== "GET" || requestUrl.origin !== self.location.origin) {
    return;
  }

  event.respondWith((async () => {
    try {
      const response = await fetch(request);

      if (response.ok && response.status === 200) {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(request, response.clone());
      }

      return response;
    } catch (error) {
      const cachedResponse = await caches.match(request);
      if (cachedResponse) {
        return cachedResponse;
      }

      if (request.mode === "navigate") {
        const cachedPage = await caches.match("./index.html");
        if (cachedPage) {
          return cachedPage;
        }
      }

      throw error;
    }
  })());
});
