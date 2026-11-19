import { cloudConfig } from './config.js';

const TOKEN_KEY = 'upa-dropbox-token';
const VERIFIER_KEY = 'upa-dropbox-pkce';
const MODE_KEY = 'upa-cloud-provider';
const SNAPSHOT = '/pas-a-pas-latest.json';
const PREFIX = '/pas-a-pas-';
const KEEP = 20;
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
  if(!response.ok)throw new Error(data.error_summary||`Erreur Dropbox (${response.status}).`);
  return data;
}
export async function connectDropbox() {
  if(!cloudConfig.dropboxAppKey)throw new Error('Identifiant Dropbox manquant dans src/cloud/config.js.');
  const verifier=enc(crypto.getRandomValues(new Uint8Array(64)));
  const challenge=enc(await crypto.subtle.digest('SHA-256',text(verifier)));
  localStorage.setItem(VERIFIER_KEY,verifier);
  const redirect=location.origin+location.pathname;
  const url=new URL('https://www.dropbox.com/oauth2/authorize');
  Object.entries({client_id:cloudConfig.dropboxAppKey,response_type:'code',code_challenge:challenge,code_challenge_method:'S256',token_access_type:'offline',scope:'files.content.read files.content.write',redirect_uri:redirect}).forEach(([k,v])=>url.searchParams.set(k,v));
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
async function upload(path,value) {
  const bearer=await accessToken();
  const response=await fetch('https://content.dropboxapi.com/2/files/upload',{method:'POST',headers:{Authorization:`Bearer ${bearer}`,'Content-Type':'application/octet-stream','Dropbox-API-Arg':JSON.stringify({path,mode:'overwrite',autorename:false,mute:true})},body:text(value)});
  const data=await response.json().catch(()=>({})); if(!response.ok)throw new Error(data.error_summary||`Erreur Dropbox (${response.status}).`); return data;
}
async function download(path) {
  const bearer=await accessToken();
  const response=await fetch('https://content.dropboxapi.com/2/files/download',{method:'POST',headers:{Authorization:`Bearer ${bearer}`,'Dropbox-API-Arg':JSON.stringify({path})}});
  if(!response.ok){const err=await response.json().catch(()=>({}));throw new Error(err.error_summary||`Erreur Dropbox (${response.status}).`);}
  return response.json();
}
export async function listDropboxBackups() {
  const result=await api('files/list_folder',{path:'',recursive:false,include_deleted:false});
  return result.entries.filter(e=>e['.tag']==='file'&&e.name.startsWith('pas-a-pas-')&&e.name.endsWith('.json')).sort((a,b)=>b.name.localeCompare(a.name));
}
export async function saveDropboxSnapshot(state) {
  const stamp=new Date().toISOString().replace(/[:.]/g,'-');
  const snapshot=JSON.stringify({app:'un-pas-apres-lautre',exportVersion:5,exportedAt:new Date().toISOString(),data:state});
  await upload(`${PREFIX}${stamp}.json`,snapshot);
  await upload(SNAPSHOT,snapshot);
  const old=await listDropboxBackups();
  for(const entry of old.slice(KEEP)) await api('files/delete_v2',{path:entry.path_lower});
  return new Date().toISOString();
}
export async function readDropboxSnapshot(path=SNAPSHOT) { return JSON.parse(await download(path)); }
export async function listDropboxSnapshots() { return listDropboxBackups(); }
