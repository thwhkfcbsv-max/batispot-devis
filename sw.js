/* Service worker minimal — cache app shell pour usage hors-ligne (chantier sans réseau). */
const CACHE = "devix-v20";
const ASSETS = [
  "index.html",
  "css/app.css",
  "js/vendor/supabase.js",
  "js/auth.js",
  "js/track.js",
  "js/pricing-peinture.js",
  "js/pricing-plomberie.js",
  "js/parser.js",
  "js/parser-plomberie.js",
  "js/signature.js",
  "js/wizard.js",
  "js/app.js",
  "manifest.json",
];
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  // Navigation (ouverture de l'URL nue /devis/ hors-ligne) → sert index.html en cache.
  if (e.request.mode === "navigate") {
    e.respondWith(caches.match("index.html").then((r) => r || fetch(e.request)));
    return;
  }
  e.respondWith(
    caches.match(e.request).then((cached) => cached || fetch(e.request).then((res) => {
      // Ne mettre en cache runtime QUE le même-origine et les réponses OK (évite l'empoisonnement
      // persistant d'une ressource tierce/opaque).
      try {
        const url = new URL(e.request.url);
        if (url.origin === self.location.origin && res.ok && res.type === "basic") {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
        }
      } catch (_) {}
      return res;
    }).catch(() => cached))
  );
});
