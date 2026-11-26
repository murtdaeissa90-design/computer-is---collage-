/* Students IS — service worker
 * آمن للمنصة: لا يلمس أي طلب خارج نطاق الموقع (Supabase والتخزين والمصادقة تمرّ مباشرة للشبكة)،
 * ولا يخزّن إلا ملفات الواجهة الثابتة. الصفحات: الشبكة أولاً ثم نسخة محفوظة عند انقطاع الإنترنت. */
const VERSION = "v1";
const STATIC_CACHE = "sis-static-" + VERSION;
const PAGE_CACHE = "sis-pages-" + VERSION;
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(PAGE_CACHE).then((c) => c.add(OFFLINE_URL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("sis-") && k !== STATIC_CACHE && k !== PAGE_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Supabase وغيره: مباشرة من الشبكة

  // ملفات الواجهة المُجزّأة بالاسم (لا تتغير): الكاش أولاً
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(STATIC_CACHE).then((c) => c.put(req, copy)); }
        return res;
      }))
    );
    return;
  }

  // الصفحات: الشبكة أولاً، وعند الانقطاع آخر نسخة، ثم صفحة "لا يوجد اتصال"
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(PAGE_CACHE).then((c) => c.put(req, copy)); }
        return res;
      }).catch(() => caches.match(req).then((hit) => hit || caches.match(OFFLINE_URL)))
    );
  }
});
