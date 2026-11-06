const CACHE='borctakip-v4';
const APP_SHELL=['./','./index.html','./manifest.webmanifest','./icon.svg'];

self.addEventListener('install',event=>{
 event.waitUntil((async()=>{
  const cache=await caches.open(CACHE);
  await cache.addAll(APP_SHELL);
  await self.skipWaiting();
 })());
});

self.addEventListener('activate',event=>{
 event.waitUntil((async()=>{
  const keys=await caches.keys();
  await Promise.all(keys.filter(key=>key.startsWith('borctakip-')&&key!==CACHE).map(key=>caches.delete(key)));
  await self.clients.claim();
 })());
});

self.addEventListener('fetch',event=>{
 const request=event.request;
 if(request.method!=='GET')return;
 const url=new URL(request.url);
 if(url.origin!==self.location.origin)return;

 if(request.mode==='navigate'){
  event.respondWith((async()=>{
   const cache=await caches.open(CACHE);
   try{
    const response=await fetch(request);
    if(response&&response.ok)await cache.put('./index.html',response.clone());
    return response;
   }catch(error){
    return (await cache.match(request))||(await cache.match('./index.html'))||Response.error();
   }
  })());
  return;
 }

 event.respondWith((async()=>{
  const cache=await caches.open(CACHE);
  const cached=await cache.match(request);
  if(cached)return cached;
  try{
   const response=await fetch(request);
   if(response&&response.ok&&response.type==='basic')await cache.put(request,response.clone());
   return response;
  }catch(error){
   return Response.error();
  }
 })());
});
