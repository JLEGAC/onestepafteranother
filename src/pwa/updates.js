export function initUpdates({hasDraft,flush,enabled=()=>true,onStatus=()=>{}}) {
  if(!('serviceWorker' in navigator))return {status:'Les mises à jour ne sont pas disponibles dans ce navigateur.',check:async()=>{}};
  let status='', checking;
  const report=message=>{status=message;onStatus(message);};
  const release=import.meta.url.match(/\/releases\/([^/]+)\//)?.[1] || 'development';
  const announce=()=>navigator.serviceWorker.controller?.postMessage({type:'RELEASE_READY',release});
  navigator.serviceWorker.ready.then(announce);
  navigator.serviceWorker.addEventListener('message',e=>{if(e.data?.type==='WHAT_RELEASE')announce();});
  let registration, dismissed=false, applying=false, reloaded=false, lastCheck=0;
  const banner=document.createElement('aside'); banner.className='update-banner'; banner.hidden=true; banner.setAttribute('aria-label','Mise à jour de l’application');
  banner.innerHTML='<span role="status">Une mise à jour est disponible</span><button class="button button-primary button-small" data-update>Mettre à jour</button><button class="text-button" data-later>Plus tard</button>';
  document.body.append(banner);
  const show=()=>{if(registration?.waiting){report('Une mise à jour est disponible. Tu peux l’installer avec le bouton « Mettre à jour ».');if(!dismissed)banner.hidden=false;}};
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
  async function check(manual=false){
    if(!manual&&!enabled())return;
    if(checking)return checking;
    if(!manual&&Date.now()-lastCheck<60000)return;
    if(navigator.onLine===false){report('Hors ligne : reconnecte-toi pour vérifier les mises à jour.');return;}
    checking=(async()=>{
      report('Vérification en cours…');
      try {
        await registered;
        if(!registration)throw new Error('Enregistrement indisponible');
        lastCheck=Date.now();if(manual)dismissed=false;
        await registration.update();
        const worker=registration.installing;
        if(worker)await new Promise((resolve,reject)=>{
          const timeout=setTimeout(()=>finish(new Error('Installation toujours en cours')),30000);
          const listener=()=>{if(['installed','activated'].includes(worker.state))finish();else if(worker.state==='redundant')finish(new Error('Téléchargement interrompu'));};
          function finish(error){clearTimeout(timeout);worker.removeEventListener('statechange',listener);error?reject(error):resolve();}
          worker.addEventListener('statechange',listener);listener();
        });
        if(registration.waiting)show();else report('Ton application est à jour.');
      }catch{report(navigator.onLine===false?'Hors ligne : la vérification n’a pas pu aboutir.':'Vérification impossible pour le moment. Réessaie dans quelques instants.');}
    })();
    try{await checking;}finally{checking=null;}
  }
  const registered=navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'}).then(reg=>{
    registration=reg;watch(reg.installing);reg.addEventListener('updatefound',()=>watch(reg.installing));show();
  }).catch(()=>{report('Vérification impossible : le service de mise à jour n’est pas disponible.');});
  registered.then(()=>check());
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)check();});
  window.addEventListener('pageshow',()=>check());window.addEventListener('online',()=>check());
  return {check,get status(){return status;}};
}
