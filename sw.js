/* 우리 캘린더 서비스 워커
   - 앱 파일: 네트워크 우선(항상 최신) → 실패/지연 시 캐시 (오프라인 실행)
   - Firebase SDK(버전 고정 URL): 캐시 우선
   - 그 외 외부 요청(지도·날씨·Firestore 통신)은 건드리지 않음 */
const CACHE = 'couple-cal-v3';
const KEEP = ['couple-cal-ext-v1']; // 외부 라이브러리 캐시는 앱을 업데이트해도 유지
const SHELL = [
  './', './index.html', './styles.css', './app.js', './manifest.webmanifest',
  './icons/icon-180.png', './icons/icon-192.png', './icons/icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE && KEEP.indexOf(k) < 0).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function networkFirst(req) {
  return caches.open(CACHE).then(cache => {
    const fromNet = fetch(req).then(res => {
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    });
    const fallback = () => cache.match(req, { ignoreSearch: true })
      .then(hit => hit || (req.mode === 'navigate' ? cache.match('./index.html') : undefined));
    const slow = new Promise(resolve => setTimeout(resolve, 3500)).then(fallback);
    return Promise.race([fromNet.catch(fallback), slow.then(hit => hit || fromNet)])
      .then(res => res || fromNet);
  });
}

function cacheFirst(req) {
  return caches.open(KEEP[0]).then(cache =>
    cache.match(req).then(hit => hit || fetch(req).then(res => {
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    }))
  );
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) e.respondWith(networkFirst(req));
  else if (url.hostname === 'www.gstatic.com' && url.pathname.indexOf('/firebasejs/') === 0) e.respondWith(cacheFirst(req));
  // 누끼 라이브러리·모델(버전 고정, 약 20MB): 한 번 받으면 다시 받지 않음
  else if ((url.hostname === 'cdn.jsdelivr.net' && url.pathname.indexOf('/npm/@mediapipe/tasks-vision@') === 0) ||
           (url.hostname === 'storage.googleapis.com' && url.pathname.indexOf('/mediapipe-models/') === 0)) e.respondWith(cacheFirst(req));
});
