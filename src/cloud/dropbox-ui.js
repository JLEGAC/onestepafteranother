import { mergeSnapshots,checkRestore } from "./restore.js";
import { baseRevision, currentRevision, acceptRevision, safetyCopy } from "./dropbox.js";
import { exportObject, validateImport } from '../data.js';
import { cloudConfig } from './config.js';
import { connectDropbox, disconnectDropbox, dropboxConnected, dropboxMode, finishDropboxOAuth, listDropboxSnapshots, readDropboxSnapshot, saveDropboxSnapshot, setCloudMode } from './dropbox.js';

const LAST='upa-dropbox-last-success';
const esc=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date=s=>s?new Date(s).toLocaleString('fr-FR'):'Jamais';
const counts=data=>({identités:data.stones?.length||0,piliers:data.pillars?.length||0,étapes:data.steps?.length||0,actions:data.actions?.length||0,habitudes:data.habits?.length||0});
const summary=data=>Object.entries(counts(data)).map(([k,v])=>`${v} ${k}`).join(' · ');

export async function initDropboxUI(hooks) {
  let error=''; let timer; let queue=Promise.resolve();let restoring=false;const serial=fn=>{const job=queue.then(fn);queue=job.catch(()=>{});return job;}; let last=localStorage.getItem(LAST)||'';
  try { if(await finishDropboxOAuth()) { error='Dropbox est connecté. Choisis-le comme service cloud pour synchroniser tes données.'; } } catch(e) { error=e.message; }
  if(dropboxConnected())baseRevision();
  function draw(){
    const mode=document.querySelector('#provider-settings');
    const privacyOpen=mode?.querySelector('.dropbox-privacy')?.open;
    if(mode) mode.innerHTML=`<div class="section-heading"><div><div class="eyebrow">STOCKAGE CLOUD</div><h2>Choisir un service</h2></div></div><p>Un seul service cloud est actif à la fois.</p><div class="cloud-buttons"><button class="button ${!dropboxMode()?'button-primary':'button-outline'}" data-provider="supabase">Supabase</button><button class="button ${dropboxMode()?'button-primary':'button-outline'}" data-provider="dropbox">Dropbox</button>${!dropboxConnected()&&cloudConfig.dropboxAppKey?'<button class="button button-outline" data-connect-dropbox>Connecter Dropbox</button>':''}</div><p class="form-hint">Changer de service transfère une copie de tes données après confirmation.</p><details class="dropbox-privacy" ${privacyOpen?'open':''}><summary>Que voit le développeur si tu choisis Dropbox ?</summary><p>Ton navigateur envoie les sauvegardes directement dans le dossier dédié à l’application sur ton Dropbox. Ce mode ne m’envoie ni ton adresse e-mail Dropbox ni le contenu de tes sauvegardes. Je ne peux pas ouvrir ton compte Dropbox ni identifier les personnes qui s’y connectent via l’application. La console Dropbox peut afficher des statistiques globales, comme le nombre de comptes reliés.</p><p>Tu peux retirer l’accès dans les <a href="https://help.dropbox.com/integrations/third-party-apps">paramètres des applications connectées de Dropbox</a>. Les sauvegardes déjà présentes restent dans ton dossier tant que tu ne les supprimes pas.</p></details>`;
    const host=document.querySelector('#dropbox-account'); if(!host)return;
    host.hidden=!dropboxMode(); if(!dropboxMode()){if(error&&mode){const note=document.createElement('p');note.setAttribute('role','status');note.textContent=error;mode.append(note);}return;}
    host.innerHTML=`<h2>Dropbox</h2><p role="status">${dropboxConnected()?'Connecté à Dropbox':'Non connecté'}</p>${cloudConfig.dropboxAppKey?'':`<p class="form-hint">Configure d’abord l’identifiant public de l’application Dropbox dans <code>src/cloud/config.js</code>.</p>`}${error?`<p role="alert">${esc(error)}</p>`:''}<p>Dernière sauvegarde réussie : ${date(last)}</p><div class="cloud-buttons">${dropboxConnected()?'<button class="button button-primary" data-db="save">Sauvegarder maintenant</button><button class="button button-outline" data-db="restore">Restaurer depuis Dropbox</button><button class="button button-outline" data-db="disconnect">Déconnecter Dropbox</button>':`<button class="button button-primary" data-db="connect" ${cloudConfig.dropboxAppKey?'':'disabled'}>Connecter Dropbox</button>`}</div><p class="form-hint">Les sauvegardes contiennent ton espace complet, y compris les images de vision. L’historique conserve une copie par semaine modifiée sur 12 semaines glissantes. Une copie distincte protège chaque restauration.</p>`;
    host.querySelectorAll('[data-db]').forEach(b=>b.onclick=async()=>{
      b.disabled=true; error=''; draw();
      try { if(b.dataset.db==='connect') await connectDropbox();
        if(b.dataset.db==='save') { await hooks.flush(); last=await serial(()=>saveDropboxSnapshot(exportObject(hooks.getState()).data));localStorage.setItem(LAST,last); }
        if(b.dataset.db==='restore'&&!restoring){restoring=true;clearTimeout(timer);try{await serial(restore);}finally{restoring=false;}}
        if(b.dataset.db==='disconnect'&&confirm('Déconnecter Dropbox ? Les données déjà enregistrées dans le cloud seront conservées.'))disconnectDropbox();
      } catch(e){error=`Échec Dropbox : ${e.message}`;}
      draw();
    });
    async function restore(){
      await hooks.flush();
      const head=await currentRevision();
      const entries=await listDropboxSnapshots(); if(!entries.length)throw new Error('Aucune sauvegarde trouvée.');
      const selected=prompt('Versions Dropbox :\n'+entries.map((x,i)=>(i+1)+'. '+x.name).join('\n')+'\nNuméro à prévisualiser :','1');
      if(selected===null)return;const entry=entries[Number(selected)-1];if(!entry)throw Error('Version inconnue.');
      const parsed=await readDropboxSnapshot('rev:'+entry.rev), remote=validateImport(parsed);
      const local=structuredClone(hooks.getState()), merge=mergeSnapshots(local,remote);
      const mode=prompt('Sur cet appareil : '+summary(local)+'\nSauvegarde du '+date(parsed.exportedAt)+' : '+summary(remote)+'\nAprès fusion : '+summary(merge.data)+'\n\n1 : Fusionner les deux versions\n2 : Remplacer entièrement les données locales','1');
      if(mode===null)return;if(!['1','2'].includes(mode))throw Error('Choix inconnu.');
      let result=mode==='1'?merge.data:remote;
      if(mode==='1'&&merge.conflicts.length){const side=prompt('Valeurs différentes : '+merge.conflicts.slice(0,12).join(', ')+'.\nPour ces différences, garder : 1 = appareil, 2 = sauvegarde','1');if(side===null)return;if(!['1','2'].includes(side))throw Error('Choix inconnu.');if(side==='2')result=mergeSnapshots(local,remote,'remote').data;}
      if(!confirm((mode==='1'?'Fusionner':'Remplacer')+' après une copie de sécurité locale et Dropbox ?\nRésultat : '+summary(result)))return;
      if(mode==='1')checkRestore(result);
      await hooks.backup();await safetyCopy(local);
      if(head){const previous=entry.rev===head?parsed:await readDropboxSnapshot("rev:"+head);if(JSON.stringify(previous.data)!==JSON.stringify(local)&&JSON.stringify(previous.data)!==JSON.stringify(result))await safetyCopy(previous.data);}
      if(await currentRevision()!==head||JSON.stringify(local)!==JSON.stringify(hooks.getState()))throw Error('Les données ont changé pendant la prévisualisation. Recommence.');
      await hooks.replace(result);await hooks.flush();acceptRevision(head);
      last=await saveDropboxSnapshot(exportObject(hooks.getState()).data);localStorage.setItem(LAST,last);
    }
  }
  document.addEventListener('click',async e=>{
    if(e.target.closest('[data-connect-dropbox]')){try{await connectDropbox();}catch(err){error=err.message;draw();}return;}
    const b=e.target.closest('[data-provider]');if(!b||restoring)return;
    const target=b.dataset.provider;if((target==='dropbox')===dropboxMode())return;
    try {
      await hooks.flush();const current=hooks.getState();
      if(!confirm(`Aperçu du transfert : ${summary(current)}.\n\n${target==='dropbox'?'Copier ces données vers Dropbox puis activer Dropbox ?':'Activer Supabase avec les données actuelles de cet appareil ?'}`))return;
      if(target==='dropbox'){
        if(!dropboxConnected())throw new Error('Connecte d’abord Dropbox.');
        try{last=await serial(()=>saveDropboxSnapshot(exportObject(current).data));}catch(ex){if(!ex.message.includes("a changé")||!confirm("Dropbox contient déjà une sauvegarde. Activer Dropbox sans écraser cette copie pour pouvoir la comparer dans Profil ?"))throw ex;}
        localStorage.setItem(LAST,last);
      }
      setCloudMode(target);location.reload();
    }catch(err){error=err.message;draw();}
  });
  window.addEventListener('upa:saved',()=>{if(restoring||!dropboxMode()||!dropboxConnected())return;clearTimeout(timer);timer=setTimeout(()=>serial(async()=>{if(restoring)return;try{last=await saveDropboxSnapshot(exportObject(hooks.getState()).data);localStorage.setItem(LAST,last);error='';}catch(e){error='Échec Dropbox : '+e.message;}draw();}),2500);});
  window.addEventListener('storage',e=>{if(e.key===LAST){last=e.newValue||'';draw();}});
  if(dropboxMode()&&dropboxConnected())currentRevision().then(rev=>{if(rev&&rev!==baseRevision()){error='Une autre version existe sur Dropbox. Ouvre « Restaurer depuis Dropbox » pour la comparer.';draw();}}).catch(e=>{error='Lecture Dropbox : '+e.message;draw();});
  draw();return {draw};
}
