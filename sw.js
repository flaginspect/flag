// Keeps FLAG on the phone so it opens with no signal. Only sealed files are cached; nothing readable.
// The plate reader (open-source Tesseract, about 8 MB) sits in its own cache that survives app updates.
const V = "flag-2026.11.24-3", OCR = "flag-ocr-v1", PS = "flag-ps-v2";
const FILES = ["./", "index.html", "app.enc", "key.enc", "docx.umd.js", "pdf-lib.min.js", "qr.min.js", "manifest.webmanifest", "icon-192.png", "icon-512.png", "icon-maskable-512.png", "apple-touch-icon.png", "favicon.svg", "favicon.ico"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(V).then((c) => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== V && k !== OCR && k !== PS).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", (e) => {
  const r = e.request;
  if (r.method !== "GET") return;
  const u = new URL(r.url);
  if (u.origin === location.origin && u.pathname.includes("/ps/")) { // photo reader files: saved copy first, new set = new PS name
    e.respondWith(caches.open(PS).then((c) => c.match(r, { ignoreSearch: true }).then((m) => m || fetch(r).then((res) => { if (res.ok) c.put(r, res.clone()); return res; }))));
    return;
  }
  if (u.origin === location.origin && u.pathname.includes("/ocr/")) { // reader files never change for a version: saved copy first
    e.respondWith(caches.open(OCR).then((c) => c.match(r, { ignoreSearch: true }).then((m) => m || fetch(r).then((res) => { if (res.ok) c.put(r, res.clone()); return res; }))));
    return;
  }
  // Network first so a new version arrives when there's signal; the saved copy when there isn't.
  // Weak signal (coverage B2): wait at most LIEFI_MS for the internet, then the saved copy; the download keeps going.
  const LIEFI_MS = 3000;
  if (self.navigator && self.navigator.onLine === false) { e.respondWith(caches.match(r, { ignoreSearch: true }).then((m) => m || (r.mode === "navigate" ? caches.match("index.html") : undefined)).then((m) => m || fetch(r))); return; } // no signal: saved copy right away
  const saved = () => caches.match(r, { ignoreSearch: true }).then((m) => m || (r.mode === "navigate" ? caches.match("index.html") : undefined));
  const net = fetch(r).then((res) => {
    if (res.ok && u.origin === location.origin) { const cp = res.clone(); return caches.open(V).then((c) => c.put(r, cp)).catch(() => {}).then(() => res); }
    return res;
  });
  e.waitUntil(net.catch(() => {}));
  e.respondWith(new Promise((resolve) => {
    let done = false; const give = (x) => { if (!done && x) { done = true; resolve(x); } };
    const t = setTimeout(() => saved().then(give), LIEFI_MS);
    net.then((res) => { clearTimeout(t); give(res); }).catch(() => { clearTimeout(t); saved().then((m) => give(m || Response.error())); });
  }));
});
