export function initUpdates({hasDraft,flush}) {
  if(!('serviceWorker' in navigator))return;
  const release=import.meta.url.match(/\/releases\/([^/]+)\//)?.[1] || 'development';
  const announce=()=>navigator.serviceWorker.controller?.postMessage({type:'RELEASE_READY',release});
  navigator.serviceWorker.ready.then(announce);
  navigator.serviceWorker.addEventListener('message',e=>{if(e.data?.type==='WHAT_RELEASE')announce();});
  let registration, dismissed=false, applying=false, reloaded=false, lastCheck=0;
  const banner=document.createElement('aside'); banner.className='update-banner'; banner.hidden=true; banner.setAttribute('aria-label','Mise à jour de l’application');
  banner.innerHTML='<span role="status">Une mise à jour est disponible</span><button class="button button-primary button-small" data-update>Mettre à jour</button><button class="text-button" data-later>Plus tard</button>';
  document.body.append(banner);
  const show=()=>{if(registration?.waiting&&!dismissed)banner.hidden=false;};
  const watch=worker=>{worker?.addEventListener('statechange',()=>{if(worker.state==='installed'&&navigator.serviceWorker.controller)show();});};
  banner.querySelector('[data-later]').onclick=()=>{dismissed=true;banner.hidden=true;};
  banner.querySelector('[data-update]').onclick=async()=>{
    if(applying||!registration?.waiting)return;
    if(hasDraft()&&!confirm('Une saisie n’est pas enregistrée. La mise à jour la fermera. Continuer ?'))return;
    applying=true; banner.querySelector('[data-update]').disabled=true;
    try {
      await flush();
      const worker=registration.waiting;
      const answer=await new Promise((resolve,reject)=>{
        const channel=new MessageChannel(); const timeout=setTimeout(()=>reject(new Error('La mise à jour n’a pas répondu. Réessaie.')),12000);
        channel.port1.onmessage=e=>{clearTimeout(timeout);channel.port1.close();resolve(e.data);};
        worker.postMessage({type:'ACTIVATE_UPDATE'},[channel.port2]);
      });
      if(!answer.ok) throw new Error('Ferme les autres fenêtres ou onglets de Pas à Pas, puis réessaie. Leurs saisies sont ainsi préservées.');
    }catch(err){applying=false;banner.querySelector('[data-update]').disabled=false;alert(err.message);}
  };
  navigator.serviceWorker.addEventListener('controllerchange',()=>{
    announce();
    if(applying&&!reloaded){reloaded=true;location.reload();}
  });
  async function check(force=false){
    if(!registration||navigator.onLine===false||(!force&&Date.now()-lastCheck<60000))return;
    lastCheck=Date.now(); try{await registration.update();show();}catch{/* offline is normal */}
  }
  navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'}).then(reg=>{
    registration=reg;watch(reg.installing);reg.addEventListener('updatefound',()=>watch(reg.installing));show();check(true);
  }).catch(()=>{});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)check();});
  window.addEventListener('pageshow',()=>check()); window.addEventListener('online',()=>check(true));
}
