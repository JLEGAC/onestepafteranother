import { equal } from "./model.js";
import { cloudConfig } from './config.js';

const TOKEN_KEY = 'upa-dropbox-token';
const VERIFIER_KEY = 'upa-dropbox-pkce';
const MODE_KEY = 'upa-cloud-provider';
const SNAPSHOT = '/pas-a-pas-latest.json';

const enc = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const text = value => new TextEncoder().encode(value);
const token = () => { try { return JSON.parse(localStorage.getItem(TOKEN_KEY)||'null'); } catch { return null; } };
export const dropboxMode = () => localStorage.getItem(MODE_KEY)==='dropbox';
export const setCloudMode = mode => localStorage.setItem(MODE_KEY,mode==='dropbox'?'dropbox':'supabase');
export const dropboxConnected = () => Boolean(token()?.refresh_token || token()?.access_token);

async function requestToken(fields) {
  const response=await fetch('https://api.dropboxapi.com/oauth2/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(fields)});
  const body=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(body.error_description||body.error||`Dropbox a répondu ${response.status}.`);
  return body;
}
async function accessToken() {
  const saved=token(); if(!saved)throw new Error('Connecte d’abord ton compte Dropbox.');
  if(saved.access_token && saved.expires_at>Date.now()+60000)return saved.access_token;
  if(!saved.refresh_token)throw new Error('Autorisation Dropbox expirée. Reconnecte ton compte.');
  const refreshed=await requestToken({grant_type:'refresh_token',refresh_token:saved.refresh_token,client_id:cloudConfig.dropboxAppKey});
  localStorage.setItem(TOKEN_KEY,JSON.stringify({...saved,...refreshed,refresh_token:saved.refresh_token,expires_at:Date.now()+Number(refreshed.expires_in||14400)*1000}));
  return refreshed.access_token;
}
async function api(path,body,content=false) {
  const bearer=await accessToken();
  const response=await fetch(`https://api.dropboxapi.com/2/${path}`,{method:'POST',headers:{Authorization:`Bearer ${bearer}`,'Content-Type':content?'application/octet-stream':'application/json',...(content?{'Dropbox-API-Arg':JSON.stringify(body)}:{})},body:content?body:JSON.stringify(body)});
  const data=await response.json().catch(()=>({}));
  if (!response.ok) {
    if (data.error?.['.tag'] === 'missing_scope') throw new Error('Autorisation Dropbox manquante. Déconnecte puis reconnecte ton compte Dropbox.');
    throw new Error(data.error_summary || `Erreur Dropbox (${response.status}).`);
  }
  return data;
}
export async function connectDropbox() {
  if(!cloudConfig.dropboxAppKey)throw new Error('Identifiant Dropbox manquant dans src/cloud/config.js.');
  const verifier=enc(crypto.getRandomValues(new Uint8Array(64)));
  const challenge=enc(await crypto.subtle.digest('SHA-256',text(verifier)));
  localStorage.setItem(VERIFIER_KEY,verifier);
  const redirect=location.origin+location.pathname;
  const url=new URL('https://www.dropbox.com/oauth2/authorize');
  Object.entries({client_id:cloudConfig.dropboxAppKey,response_type:'code',code_challenge:challenge,code_challenge_method:'S256',token_access_type:'offline',scope:'files.metadata.read files.content.read files.content.write',redirect_uri:redirect}).forEach(([k,v])=>url.searchParams.set(k,v));
  location.assign(url.href);
}
export async function finishDropboxOAuth() {
  const params=new URLSearchParams(location.search); const code=params.get('code');
  if(!code)return false;
  const verifier=localStorage.getItem(VERIFIER_KEY); if(!verifier)throw new Error('Connexion Dropbox interrompue. Recommence la connexion.');
  const redirect=location.origin+location.pathname;
  const result=await requestToken({code,grant_type:'authorization_code',client_id:cloudConfig.dropboxAppKey,code_verifier:verifier,redirect_uri:redirect});
  localStorage.setItem(TOKEN_KEY,JSON.stringify({...result,expires_at:Date.now()+Number(result.expires_in||14400)*1000}));
  localStorage.removeItem(VERIFIER_KEY); history.replaceState({},'',location.pathname+location.hash); return true;
}
export function disconnectDropbox(){localStorage.removeItem(TOKEN_KEY);}
async function upload(path,value,mode='add',autorename=false) {
  const bearer=await accessToken();
  const response=await fetch('https://content.dropboxapi.com/2/files/upload',{method:'POST',headers:{Authorization:`Bearer ${bearer}`,'Content-Type':'application/octet-stream','Dropbox-API-Arg':JSON.stringify({path,mode,autorename,mute:true,strict_conflict:true})},body:text(value)});
  const data=await response.json().catch(()=>({})); if(!response.ok){if(response.status===409&&path===SNAPSHOT)throw Error('La sauvegarde distante a changé. Compare les versions avant de réessayer.');throw new Error(data.error_summary||`Erreur Dropbox (${response.status}).`);}return data;
}
async function download(path) {
  const bearer=await accessToken();
  const response=await fetch('https://content.dropboxapi.com/2/files/download',{method:'POST',headers:{Authorization:`Bearer ${bearer}`,'Dropbox-API-Arg':JSON.stringify({path})}});
  if(!response.ok){const err=await response.json().catch(()=>({}));throw new Error(err.error_summary||`Erreur Dropbox (${response.status}).`);}
  // files/download returns the file bytes as the response body, not a JSON API envelope.
  return response.text();
}
const notFound=e=>/path\/not_found/.test(e.message);
const weekly=/^pas-a-pas\.(\d{4}-\d{2}-\d{2})T\d{2}-\d{2}-\d{2}\.bak\.json$/i;
const safety=/^pas-a-pas-avant-restauration-.*\.json$/i;
const legacy=/^pas-a-pas-\d{4}-\d{2}-\d{2}T[\d-]+Z\.json$/i;
const revisionKey=()=>'upa-db-revision:'+(token()?.account_id||'default')+':'+(localStorage.getItem('upa-active-user')||'guest');
const known=new Map();
export function baseRevision(){const k=revisionKey();if(!known.has(k))known.set(k,localStorage.getItem(k)||null);return known.get(k);}
export function acceptRevision(rev){const k=revisionKey();known.set(k,rev);if(rev)localStorage.setItem(k,rev);else localStorage.removeItem(k);}
export async function currentRevision(){try{return (await api('files/get_metadata',{path:SNAPSHOT})).rev;}catch(e){if(notFound(e))return null;throw e;}}
async function list(path){let result;try{result=await api('files/list_folder',{path,recursive:false});}catch(e){if(path&&notFound(e))return [];throw e;}
 const entries=[...result.entries];while(result.has_more){result=await api('files/list_folder/continue',{cursor:result.cursor});entries.push(...result.entries);}return entries.filter(e=>e['.tag']==='file');}
export async function listDropboxSnapshots(){const [root,archive]=await Promise.all([list(''),list('/Backups')]);return [...root.filter(e=>'/'+e.name===SNAPSHOT),...[...archive.filter(e=>weekly.test(e.name)||safety.test(e.name)),...root.filter(e=>legacy.test(e.name))].sort((a,b)=>String(b.server_modified).localeCompare(String(a.server_modified)))];}
const envelope=(data,now)=>JSON.stringify({app:'un-pas-apres-lautre',exportVersion:5,exportedAt:now.toISOString(),data});
const stamp=now=>now.toISOString().slice(0,19).replaceAll(':','-');
export function weekStart(now){const d=new Date(now);d.setUTCHours(0,0,0,0);return +d-((d.getUTCDay()+6)%7)*86400000;}
export async function safetyCopy(data){const now=new Date();await upload('/Backups/pas-a-pas-avant-restauration-'+stamp(now).replace('T','_')+'.json',envelope(data,now),'add',true);}
export async function readDropboxSnapshot(path=SNAPSHOT){return JSON.parse(await download(path));}
export async function saveDropboxSnapshot(state){
 state=structuredClone(state);
 const expected=baseRevision(),actual=await currentRevision(),now=new Date();let changed=true,remote;
 if(actual){remote=await readDropboxSnapshot('rev:'+actual);changed=!equal(remote.data,state);}
 if(actual!==expected && changed)throw Error('La sauvegarde distante a changé. Ouvre « Restaurer depuis Dropbox » pour comparer les versions et choisir une fusion ou un remplacement.');
 const copy=envelope(state,now);
 if(changed){const meta=await upload(SNAPSHOT,copy,actual?{'.tag':'update',update:actual}:'add');acceptRevision(meta.rev);}
 else acceptRevision(actual);
 const archive=await list('/Backups'),start=weekStart(now);
 const weeks=archive.filter(e=>weekly.test(e.name));
 // Retry a missed archive after an interrupted save, using the latest file’s timestamp.
 const saved=changed?now:new Date(remote.exportedAt);
 if(weekStart(saved)===start&&!weeks.some(e=>weekStart(weekly.exec(e.name)[1])===start))await upload('/Backups/pas-a-pas.'+stamp(saved)+'.bak.json',envelope(state,saved));
 for(const e of weeks)if(weekStart(weekly.exec(e.name)[1])<start-11*7*86400000)await api('files/delete_v2',{path:e.path_lower});
 return now.toISOString();
}
