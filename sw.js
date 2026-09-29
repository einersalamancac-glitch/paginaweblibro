// ============================================================
// sw.js — guarda en caché los archivos propios de la app (no los
// libros: esos ya viven en IndexedDB) para poder abrirla sin
// conexión una vez que se usó al menos una vez con internet.
//
// Importar un PDF nuevo sigue necesitando internet (se usa una
// librería externa para leer el PDF), pero abrir la app y leer
// los libros que ya importaste funciona sin conexión.
// ============================================================
const CACHE_NAME = "mi-biblioteca-shell-v1";

const PRECACHE = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/style.css",
  "./js/db.js",
  "./js/pdf-extract.js",
  "./js/paginator.js",
  "./js/page-turn.js",
  "./js/reader.js",
  "./js/library.js",
  "./js/app.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  // Sólo controlamos los archivos propios de la app. La librería de
  // lectura de PDF (en una CDN externa) se deja pasar directo a la
  // red: sin internet no estará disponible, pero eso sólo afecta a
  // "importar un libro nuevo", no a leer los que ya tienes.
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
        }
        return res;
      }).catch(() => cached);
    })
  );
});
