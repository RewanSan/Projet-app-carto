const APP = "rando-app-v6", TILES = "rando-tiles-v1", MAX_TILES = 2000;
const SHELL = ["./", "index.html", "manifest.webmanifest", "icon-192.png", "icon-512.png",
  "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css",
  "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(APP).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: "reload" })))));
  self.skipWaiting();
});

self.addEventListener("activate", e => e.waitUntil(
  caches.keys()
    .then(ks => Promise.all(ks.filter(k => k.startsWith("rando-app-") && k !== APP).map(k => caches.delete(k))))
    .then(() => clients.claim())
));

async function trim(c) {
  const k = await c.keys();
  if (k.length > MAX_TILES) await Promise.all(k.slice(0, k.length - MAX_TILES).map(x => c.delete(x)));
}

self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  const u = new URL(e.request.url);
  if (/data\.geopf\.fr|tile\.openstreetmap\.org/.test(u.host)) {
    // Tuiles : cache d'abord (rapide, utilisable hors connexion)
    e.respondWith(caches.open(TILES).then(async c => {
      const hit = await c.match(e.request);
      if (hit) return hit;
      const r = await fetch(e.request);
      if (r.ok) { c.put(e.request, r.clone()); trim(c); }
      return r;
    }));
  } else if (u.origin === self.location.origin) {
    // Fichiers de l'application : réseau d'abord, cache seulement hors connexion
    e.respondWith(
      fetch(e.request, { cache: "no-cache" })
        .then(r => { if (r.ok) { const c = r.clone(); caches.open(APP).then(x => x.put(e.request, c)); } return r; })
        .catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match("index.html")))
    );
  } else {
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
  }
});
