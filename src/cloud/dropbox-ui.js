import { exportObject, validateImport } from '../data.js';
import { cloudConfig } from './config.js';
import { connectDropbox, disconnectDropbox, dropboxConnected, dropboxMode, finishDropboxOAuth, listDropboxSnapshots, readDropboxSnapshot, saveDropboxSnapshot, setCloudMode } from './dropbox.js';

const LAST='upa-dropbox-last-success';
const esc=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date=s=>s?new Date(s).toLocaleString('fr-FR'):'Jamais';
const counts=data=>({identités:data.stones?.length||0,piliers:data.pillars?.length||0,étapes:data.steps?.length||0,actions:data.actions?.length||0,habitudes:data.habits?.length||0});
const summary=data=>Object.entries(counts(data)).map(([k,v])=>`${v} ${k}`).join(' · ');

export async function initDropboxUI(hooks) {
  let error=''; let timer; let busy=false; let last=localStorage.getItem(LAST)||'';
  try { if(await finishDropboxOAuth()) { error='Dropbox est connecté. Choisis-le comme service cloud pour synchroniser tes données.'; } } catch(e) { error=e.message; }
  function draw(){
    const mode=document.querySelector('#provider-settings');
    if(mode) mode.innerHTML=`<div class="section-heading"><div><div class="eyebrow">STOCKAGE CLOUD</div><h2>Choisir un service</h2></div></div><p>Un seul service cloud est actif à la fois.</p><div class="cloud-buttons"><button class="button ${!dropboxMode()?'button-primary':'button-outline'}" data-provider="supabase">Supabase</button><button class="button ${dropboxMode()?'button-primary':'button-outline'}" data-provider="dropbox">Dropbox</button>${!dropboxConnected()&&cloudConfig.dropboxAppKey?'<button class="button button-outline" data-connect-dropbox>Connecter Dropbox</button>':''}</div><p class="form-hint">Changer de service transfère une copie de tes données après confirmation.</p>`;
    const host=document.querySelector('#dropbox-account'); if(!host)return;
    host.hidden=!dropboxMode(); if(!dropboxMode())return;
    host.innerHTML=`<h2>Dropbox</h2><p role="status">${dropboxConnected()?'Connecté à Dropbox':'Non connecté'}</p>${cloudConfig.dropboxAppKey?'':`<p class="form-hint">Configure d’abord l’identifiant public de l’application Dropbox dans <code>src/cloud/config.js</code>.</p>`}${error?`<p role="alert">${esc(error)}</p>`:''}<p>Dernière sauvegarde réussie : ${date(last)}</p><div class="cloud-buttons">${dropboxConnected()?'<button class="button button-primary" data-db="save">Sauvegarder maintenant</button><button class="button button-outline" data-db="restore">Restaurer depuis Dropbox</button><button class="button button-outline" data-db="disconnect">Déconnecter Dropbox</button>':`<button class="button button-primary" data-db="connect" ${cloudConfig.dropboxAppKey?'':'disabled'}>Connecter Dropbox</button>`}</div><p class="form-hint">Les sauvegardes contiennent ton espace complet, y compris les images de vision. Jusqu’à 20 versions datées sont conservées.</p>`;
    host.querySelectorAll('[data-db]').forEach(b=>b.onclick=async()=>{
      b.disabled=true; error=''; draw();
      try { if(b.dataset.db==='connect') await connectDropbox();
        if(b.dataset.db==='save') { await hooks.flush(); last=await saveDropboxSnapshot(exportObject(hooks.getState()).data);localStorage.setItem(LAST,last); }
        if(b.dataset.db==='restore') await restore();
        if(b.dataset.db==='disconnect'&&confirm('Déconnecter Dropbox ? Les données déjà enregistrées dans le cloud seront conservées.'))disconnectDropbox();
      } catch(e){error=`Échec Dropbox : ${e.message}`;}
      draw();
    });
    async function restore(){
      const entries=await listDropboxSnapshots(); if(!entries.length)throw new Error('Aucune sauvegarde trouvée.');
      const selected=prompt(`Versions Dropbox :\n${entries.map((x,i)=>`${i+1}. ${x.name}`).join('\n')}\n\nSaisis le numéro de la version à restaurer :`);
      if(selected===null)return; const entry=entries[Number(selected)-1];if(!entry)throw new Error('Numéro de sauvegarde invalide.');
      const parsed=await readDropboxSnapshot(entry.path_lower); const restored=validateImport(parsed); const preview=summary(restored);
      if(!confirm(`Aperçu de la sauvegarde du ${date(parsed.exportedAt)}\n${preview}\n\nUne copie locale actuelle sera conservée. Remplacer les données de cette application ?`))return;
      await hooks.flush(); await hooks.backup(); await hooks.replace(restored); await hooks.flush();
    }
  }
  document.addEventListener('click',async e=>{
    if(e.target.closest('[data-connect-dropbox]')){try{await connectDropbox();}catch(err){error=err.message;draw();}return;}
    const b=e.target.closest('[data-provider]');if(!b)return;
    const target=b.dataset.provider;if((target==='dropbox')===dropboxMode())return;
    try {
      await hooks.flush();const current=hooks.getState();
      if(!confirm(`Aperçu du transfert : ${summary(current)}.\n\n${target==='dropbox'?'Copier ces données vers Dropbox puis activer Dropbox ?':'Activer Supabase avec les données actuelles de cet appareil ?'}`))return;
      if(target==='dropbox'){
        if(!dropboxConnected())throw new Error('Connecte d’abord Dropbox.');
        await saveDropboxSnapshot(exportObject(current).data);
      }
      setCloudMode(target);location.reload();
    }catch(err){error=err.message;draw();}
  });
  if(dropboxMode()&&dropboxConnected()){
    try{
      const latest=await readDropboxSnapshot();const remote=validateImport(latest);const local=hooks.getState();
      if(JSON.stringify(exportObject(remote).data)!==JSON.stringify(exportObject(local).data)&&confirm(`Une sauvegarde Dropbox du ${date(latest.exportedAt)} est disponible.\n${summary(remote)}\n\nRemplacer les données de cet appareil par cette version ?`)){
        await hooks.flush();await hooks.backup();await hooks.replace(remote);await hooks.flush();
      }
    }catch(e){error=`Lecture Dropbox impossible : ${e.message}`;}
  }
  window.addEventListener('upa:saved',()=>{if(!dropboxMode()||!dropboxConnected())return;clearTimeout(timer);timer=setTimeout(async()=>{if(busy)return;busy=true;try{last=await saveDropboxSnapshot(exportObject(hooks.getState()).data);localStorage.setItem(LAST,last);error='';}catch(e){error=`Échec Dropbox : ${e.message}`;}finally{busy=false;draw();}},2500);});
  window.addEventListener('storage',e=>{if(e.key===LAST){last=e.newValue||'';draw();}});
  draw();return {draw};
}
