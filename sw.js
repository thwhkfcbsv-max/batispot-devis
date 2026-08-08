/* Service worker — RÉSEAU D'ABORD (fini le "vieille version en cache").
   On sert toujours le frais quand il y a du réseau ; le cache ne sert QUE de repli hors-ligne. */
const CACHE = "devix-v30";
const ASSETS = [
  "index.html",
  "css/app.css",
  "js/vendor/supabase.js",
  "js/auth.js",
  "js/track.js",
  "js/pricing-geo.js",
  "js/pricing-peinture.js",
  "js/pricing-plomberie.js",
  "js/pricing-electricite.js",
  "js/pricing-couverture.js",
  "js/parser.js",
  "js/parser-plomberie.js",
  "js/parser-electricite.js",
  "js/parser-couverture.js",
  "js/signature.js",
  "js/wizard.js",
  "js/app.js",
  "manifest.json",
];
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  let url;
  try { url = new URL(e.request.url); } catch (_) { return; }
  if (url.origin !== self.location.origin) return; // tiers (Supabase, etc.) → réseau direct

  // RÉSEAU D'ABORD : on tente toujours le frais, on rafraîchit le cache, repli cache si hors-ligne.
  e.respondWith(
    fetch(e.request).then((res) => {
      if (res && res.ok && res.type === "basic") {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
      }
      return res;
    }).catch(() =>
      caches.match(e.request).then((r) =>
        r || (e.request.mode === "navigate" ? caches.match("index.html") : Response.error())
      )
    )
  );
});
