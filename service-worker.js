const CACHE='personal-growth-app-v8-academic-canvas';
const ASSETS=['./','./index.html','./manifest.webmanifest','./academic-model.js','./academic-ui.js','./growth-model.js','./growth-ui.js','./culture-model.js','./culture-ui.js','./yi-integration.js','./japanese-transfer.js','./japanese-ui.js','./cs-curriculum.js','./cs-transfer.js','./cs-ui.js'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('personal-growth-app-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(event.request.method!=='GET'||url.origin!==self.location.origin||!url.href.startsWith(self.registration.scope))return;
  event.respondWith(fetch(event.request).then(response=>{const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));return response}).catch(()=>caches.match(event.request).then(hit=>hit||caches.match('./index.html'))));
});

