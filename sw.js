const CACHE='borctakip-v5';
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

self.addEventListener('push',event=>{
 let payload={title:'BorçTakip ödeme hatırlatması',body:'Yaklaşan bir ödeme tarihin var.',url:'./'};
 try{if(event.data){const incoming=event.data.json();payload={...payload,...incoming};}}catch(error){
  try{if(event.data)payload.body=event.data.text();}catch(ignore){}
 }
 event.waitUntil(self.registration.showNotification(payload.title,{
  body:payload.body,
  icon:'./icon.svg',
  badge:'./icon.svg',
  tag:payload.tag||'borctakip-push',
  data:{url:payload.url||'./'},
  renotify:false
 }));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 const target=event.notification.data?.url||'./';
 event.waitUntil((async()=>{
  const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  for(const client of windows){if('focus' in client){await client.focus();if('navigate' in client)await client.navigate(target);return;}}
  if(self.clients.openWindow)await self.clients.openWindow(target);
 })());
});
