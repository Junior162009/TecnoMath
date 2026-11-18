const CACHE_NAME='tecnomath-offline-v27-theme-decorations';
const OFFLINE_FALLBACK_PAGE='/index.html';
const PRECACHE_ASSETS=['/','/index.html','/js/shared.js','/js/i18n.js','/locales/index.json','/locales/es/common.json','/locales/en/common.json','/js/firebase-config.js','/js/tecnomath-auth.js','/js/admin-guard.js','/js/theme-sync.js?v=20','/css/amor-amistad.css?v=4','/css/theme-global.css?v=3','/css/admin.css','/manifest.json','/pages/auth.html','/pages/admin/index.html','/pages/admin/games-manager.html','/js/class-a-direct-publisher.js','/pages/admin/voting-order.html','/pages/game.html','/pages/eco-collector.html','/pages/animalandia.html','/pages/ods-2048.html','/pages/coral-guardian.html','/pages/eco-barrio.html','/pages/emoji-math.html','/img/icon-192.png','/img/icon-512.png'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(PRECACHE_ASSETS).catch(err=>console.warn('Precaché parcial:',err))));self.skipWaiting()});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(names=>Promise.all(names.filter(name=>name.startsWith('tecnomath-offline-')&&name!==CACHE_NAME).map(name=>caches.delete(name)))));self.clients.claim()});
if(self.registration.navigationPreload)self.registration.navigationPreload.enable().catch(()=>{});
async function injectThemeScripts(response){
  if(!response||!response.ok)return response;
  const type=response.headers.get('content-type')||'';
  if(!type.includes('text/html'))return response;
  try{
    let html=await response.text();
    html=html.replace(/<script\b[^>]*src=["'][^"']*\/js\/theme-sync\.js[^"']*["'][^>]*>\s*<\/script>/gi,'');
    html=html.replace(/<\/body>/i,'<script src="/js/theme-sync.js?v=20"></script><script>if("serviceWorker" in navigator)navigator.serviceWorker.register("/sw.js",{scope:"/"}).catch(function(){});</script></body>');
    if(!html.includes('/js/i18n.js'))html=html.replace(/<\/head>/i,'<script src="/js/i18n.js" defer></script></head>');
    const headers=new Headers(response.headers);
    headers.set('content-type','text/html; charset=utf-8');
    return new Response(html,{status:response.status,statusText:response.statusText,headers});
  }catch(_){return response}
}
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin)return;
  // Los catálogos cambian desde el panel: siempre se intenta obtener la versión actual.
  if(url.pathname.endsWith('/data/games.json')||url.pathname.endsWith('/games/published-games.json')){
    event.respondWith(fetch(event.request,{cache:'no-store'}).catch(()=>caches.match(event.request)));
    return;
  }
  const isStatic=/\.(?:css|js|mjs|svg|png|jpe?g|webp|avif|gif|woff2?|ttf|mp3|ogg|wav|ico)$/i.test(url.pathname);
  if(isStatic){
    const updatePromise=fetch(event.request).then(async response=>{
      if(response&&response.status===200){const cache=await caches.open(CACHE_NAME);await cache.put(event.request,response.clone())}
      return response;
    }).catch(()=>null);
    event.waitUntil(updatePromise.then(()=>undefined));
    event.respondWith((async()=>{
      const cached=await caches.match(event.request);
      if(cached)return cached;
      return await updatePromise||new Response('Recurso no disponible sin conexión',{status:503});
    })());
    return;
  }
  // HTML y datos no versionados: red primero para mantener el contenido actualizado.
  event.respondWith((async()=>{
    try{
      const response=await injectThemeScripts(await fetch(event.request));
      if(response&&response.status===200){const cache=await caches.open(CACHE_NAME);await cache.put(event.request,response.clone())}
      return response;
    }catch(_){
      let cached=await caches.match(event.request);
      if(cached)return injectThemeScripts(cached);
      if(event.request.mode==='navigate'){
        cached=await caches.match(OFFLINE_FALLBACK_PAGE);
        if(cached)return injectThemeScripts(cached);
      }
      return new Response('Sin conexión',{status:503});
    }
  })());
});
self.addEventListener('sync',event=>{if(event.tag==='sync-tecnomath')event.waitUntil(self.clients.matchAll().then(clients=>clients.forEach(c=>c.postMessage({type:'background-sync',tag:event.tag}))));});
self.addEventListener('periodicsync',event=>{if(event.tag==='periodic-tecnomath')event.waitUntil(self.clients.matchAll().then(clients=>clients.forEach(c=>c.postMessage({type:'periodic-sync',tag:event.tag}))));});
self.addEventListener('push',event=>{let data={title:'Tecnomath',body:'¡Nuevo minijuego disponible!',icon:'/img/icon-192.png'};if(event.data){try{data={...data,...event.data.json()}}catch(_){}}event.waitUntil(self.registration.showNotification(data.title,{body:data.body,icon:data.icon,badge:'/img/icon-96.png',vibrate:[200,100,200],data:{url:'/'}}))});
self.addEventListener('notificationclick',event=>{event.notification.close();event.waitUntil(self.clients.matchAll({type:'window'}).then(list=>{for(const client of list)if(client.url==='/'&&'focus'in client)return client.focus();if(self.clients.openWindow)return self.clients.openWindow('/')}))});
self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')self.skipWaiting()});
