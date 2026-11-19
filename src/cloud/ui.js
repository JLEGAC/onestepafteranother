import { makeClient } from './client.js';
import { createSyncEngine } from './engine.js';
import { exportObject } from '../data.js';
import { listBackups, scope, readRecord } from '../local-store.js';
import { dropboxMode } from './dropbox.js';
const labels={disabled:'Sauvegarde sur cet appareil',guest:'Mode local',connecting:'Connexion…',pending:'Changements en attente',syncing:'Synchronisation…',synced:'Synchronisé',offline:'Hors connexion',error:'Synchronisation à réessayer',choice:'Choix nécessaire',waiting:'Données disponibles après ta saisie',reauth:'Connexion à renouveler',removed:'Compte cloud indisponible'};
const esc=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function download(state,name='sauvegarde') {
  const url=URL.createObjectURL(new Blob([JSON.stringify(exportObject(state),null,2)],{type:'application/json'}));
  const a=document.createElement('a'); a.href=url; a.download=`pas-a-pas-${name}-${Date.now()}.json`; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export function initCloud(hooks) {
  let client;
  try { client=dropboxMode()?null:makeClient(); } catch(err) { console.error(err.message); }
  let engine;
  function draw(status=engine?.status) {
    if (!status) return;
    let indicator=document.querySelector('#cloud-indicator');
    if(!indicator) { indicator=document.createElement('button'); indicator.id='cloud-indicator'; indicator.className='cloud-indicator'; indicator.type='button'; document.body.append(indicator); indicator.onclick=()=>hooks.openProfile(); }
    indicator.textContent=labels[status.kind] || 'Sauvegarde locale'; indicator.dataset.kind=status.kind;
    indicator.title=status.pending?'Des changements restent à envoyer.':'Ouvrir mon compte';
    const host=document.querySelector('#cloud-account'); if(!host)return;
    host.hidden=dropboxMode(); if(dropboxMode())return;
    const connected=Boolean(scope());
    const conflict=status.conflict;
    host.innerHTML=`<h2>Mon compte et mes données</h2><p role="status">${esc(labels[status.kind])}${status.pending?' · changements conservés sur cet appareil':''}</p>
      ${status.email?`<p>${esc(status.email)}</p>`:''}
      ${status.lastSync?`<small>Dernière synchronisation : ${esc(new Date(status.lastSync).toLocaleString('fr-FR'))}</small>`:''}
      ${!client?'<p>La connexion Google sera disponible après la configuration du service de sauvegarde.</p>':`<div class="cloud-buttons">${!connected||status.kind==='reauth'?'<button class="button button-primary" data-cloud="login">Se connecter avec Google</button>':'<button class="button button-outline" data-cloud="retry">Synchroniser maintenant</button><button class="button button-outline" data-cloud="logout">Se déconnecter</button>'}</div>`}
      ${conflict?`<div class="cloud-choice"><h3>${conflict.initial?'Des données existent déjà':'Deux versions à départager'}</h3><p>${conflict.remote?'Les données de cet appareil et celles du compte sont différentes. Choisis la version à garder.':'Envoyer les données de cet appareil vers ton compte ?'}</p><p>Une copie des versions remplacées sera conservée dans les sauvegardes de sécurité de cet appareil.</p><div class="cloud-buttons"><button class="button button-primary" data-cloud="local">${conflict.remote?'Garder cet appareil et remplacer le cloud':'Envoyer mes données'}</button><button class="button button-outline" data-cloud="remote">${conflict.remote?'Utiliser les données du compte':'Commencer avec un compte vide'}</button><button class="button button-outline" data-cloud="export-local">Exporter la version locale</button>${conflict.remote?'<button class="button button-outline" data-cloud="export-remote">Exporter la version cloud</button>':''}</div></div>`:''}
      <div class="cloud-buttons"><button class="text-button" data-cloud="backups">Mes sauvegardes de sécurité</button>${connected&&client?'<button class="danger-link" data-cloud="delete">Supprimer mon compte et mes données</button>':''}</div>
      <p class="form-hint">Sans compte, tes données restent sur cet appareil. Avec un compte, elles sont aussi sauvegardées dans ton espace privé.</p>`;
    host.querySelectorAll('[data-cloud]').forEach(b=>b.onclick=async()=>{
      b.disabled=true;
      try {
        const action=b.dataset.cloud;
        if(action==='login') await engine.login();
        if(action==='retry') engine.retry();
        if(action==='local'||action==='remote') {
          if(confirm('Confirmer ce choix ? Les copies remplacées seront sauvegardées sur cet appareil.')) await engine.resolve(action);
        }
        if(action==='export-local') download((await readRecord()).state,'locale');
        if(action==='export-remote') download(conflict.remote.state,'cloud');
        if(action==='backups') {
          const rows=await listBackups();
          const box=document.createElement('div');
          if(!rows.length) box.textContent='Aucune sauvegarde de sécurité pour cet espace.';
          for(const row of rows) { const link=document.createElement('button'); link.className='button button-outline'; link.textContent=new Date(row.createdAt).toLocaleString('fr-FR'); link.onclick=()=>download(row.state,'securite'); box.append(link); }
          host.append(box);
        }
        if(action==='logout') {
          if(hooks.hasDraft()&&!confirm('Quitter la saisie en cours et se déconnecter ?'))return;
          if(!confirm('Te déconnecter ? Les changements non envoyés resteront sur cet appareil, associés à ton compte.'))return;
          let remove=false;
          if(!engine.status.pending) remove=confirm('Supprimer aussi la copie locale de ce compte sur cet appareil ? Annuler permet de la conserver.');
          await engine.logout(remove);
        }
        if(action==='delete' && confirm('Supprimer définitivement ton compte Pas à Pas, ses données et ses images cloud ? Ton compte Google ne sera pas supprimé.') && prompt('Pour confirmer, écris SUPPRIMER')==='SUPPRIMER') await engine.deleteAccount();
      }catch(err){alert(err.message||'Cette opération n’a pas abouti. Tes données locales sont conservées.');}
      finally {b.disabled=false;}
    });
  }
  engine=createSyncEngine(client,{...hooks,status:draw}); draw();
  return { draw, engine };
}
