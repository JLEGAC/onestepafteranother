// The production builder replaces this block with immutable release URLs + integrity hashes.
const RELEASE = 'development';
const FILES = [];
const SHELL = './index.html';
const PREFIX = 'upa-' + new URL(self.registration.scope).pathname.replaceAll('/', '_') + '-release-';
const versions = new Map();
const PREDECESSORS = new URL('./__upa_cache_predecessors__', self.registration.scope).href;
async function cleanUnused() {
  const clients=(await self.clients.matchAll({type:'window',includeUncontrolled:true})).filter(c=>c.url.startsWith(self.registration.scope));
  if(!clients.length || clients.some(c=>versions.get(c.id)!==RELEASE))return;
  // Only retire caches recorded BEFORE this worker installed. A cache created
  // later may belong to the next version currently installing or waiting.
  // Persist this list: service worker globals can disappear between events.
  const metadata=await (await caches.open(CACHE)).match(PREDECESSORS);
  if(!metadata)return; // No history: preserve rather than guess cache age.
  const predecessors=await metadata.json();
  for(const name of predecessors) {
    if(name!==CACHE && (name.startsWith(PREFIX)||name.startsWith('un-pas-apres-lautre-')))await caches.delete(name);
  }
}
const CACHE = PREFIX + RELEASE;
const absolute = path => new URL(path, self.registration.scope).href;
self.addEventListener('install', event => event.waitUntil((async()=>{
  if(!FILES.length)return; // Development uses the network; build for offline tests.
  const predecessors=(await caches.keys()).filter(name=>name!==CACHE &&
    (name.startsWith(PREFIX)||name.startsWith('un-pas-apres-lautre-')));
  const cache=await caches.open(CACHE);
  try {
    const results=await Promise.allSettled(FILES.map(async file=>{
      const response=await fetch(new Request(absolute(file.url),{cache:'reload',integrity:file.integrity}));
      if(!response.ok)throw new Error('Release incomplète');
      await cache.put(absolute(file.url),response);
    }));
    const failed=results.find(result=>result.status==='rejected');
    if(failed)throw failed.reason;
    await cache.put(PREDECESSORS,new Response(JSON.stringify(predecessors),{headers:{'Content-Type':'application/json'}}));
  }catch(err){await caches.delete(CACHE);throw err;}
})()));
self.addEventListener('message',event=>{
  if(event.data?.type==='RELEASE_READY') { versions.set(event.source.id,event.data.release);event.waitUntil(cleanUnused());return; }
  if(event.data?.type!=='ACTIVATE_UPDATE')return;
  event.waitUntil((async()=>{
    const clients=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    const own=clients.filter(c=>c.url.startsWith(self.registration.scope));
    if(own.length>1){event.ports[0]?.postMessage({ok:false});return;}
    event.ports[0]?.postMessage({ok:true}); await self.skipWaiting();
  })());
});
self.addEventListener('activate',event=>event.waitUntil((async()=>{await self.clients.claim();for(const c of await self.clients.matchAll({type:'window'}))c.postMessage({type:'WHAT_RELEASE'});})()));
// Keep older release caches: an older open page may still import its own modules.
// Only this application's caches are examined. User data never lives in these caches.
self.addEventListener('fetch',event=>{
  const request=event.request; const url=new URL(request.url);
  if(request.method!=='GET'||url.origin!==self.location.origin||!FILES.length)return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    if(request.mode==='navigate')return await cache.match(absolute(SHELL)) || new Response('Application indisponible hors connexion.',{status:503});
    const alias=FILES.find(f=>f.alias&&absolute(f.alias)===url.href);
    const found=await cache.match(alias?absolute(alias.url):request);
    if(found)return found;
    if(url.pathname.includes('/releases/')){
      for(const name of await caches.keys()){
        if(!name.startsWith(PREFIX)||name===CACHE)continue;
        const old=await (await caches.open(name)).match(request);if(old)return old;
      }
    }
    try{return await fetch(request);}catch{return new Response('Ressource indisponible hors connexion.',{status:503});}
  })());
});
