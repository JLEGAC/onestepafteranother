import test from 'node:test';
import assert from 'node:assert/strict';
import {indexedDB} from 'fake-indexeddb';
const storage=new Map();
globalThis.indexedDB=indexedDB;
globalThis.localStorage={getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)};
globalThis.window=new EventTarget();globalThis.document=new EventTarget();document.hidden=false;
Object.defineProperty(globalThis,'navigator',{value:{onLine:true},configurable:true});
globalThis.confirm=()=>true;
const store=await import('../src/local-store.js');
const {createInitialState}=await import('../src/data.js');
const {createSyncEngine}=await import('../src/cloud/engine.js');
const pause=()=>new Promise(r=>setTimeout(r,5));
async function until(f){for(let i=0;i<400;i++){if(await f())return;await pause();}throw Error('condition not reached');}
test('migration, offline queue, reconnection, independent merge, conflicts and safe logout',async()=>{
 let state=createInitialState();state.profile.vision='Mon espace existant';
 await store.readWorkspace();await store.writeWorkspace(state);
 let remote=null,authCallback;const uid='00000000-0000-0000-0000-000000000001';
 const client={
  auth:{onAuthStateChange:cb=>{authCallback=cb;return {data:{subscription:{unsubscribe(){}}}};},getUser:async()=>({data:{user:{id:uid}},error:null}),signOut:async()=>({error:null})},
  rpc:async(name,args)=>{
   if(name==='upa_ensure_account')return {error:null};
   assert.equal(args.p_owner,uid);
   if((remote?.revision||0)!==args.p_expected_revision)return {data:{ok:false}};
   remote={data:structuredClone(args.p_data),revision:(remote?.revision||0)+1,schema_version:args.p_schema_version};return {data:{ok:true,revision:remote.revision}};
  },
  from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:structuredClone(remote),error:null})})})})
 };
 let draft=false;
 const engine=createSyncEngine(client,{hasDraft:()=>draft,apply:s=>{state=s;},status:()=>{}});
 try{
  authCallback('SIGNED_IN',{user:{id:uid,email:'test@example.com'}});
  await until(()=>engine.status.kind==='choice');assert.equal(remote,null);
  await engine.resolve('local');await until(()=>engine.status.kind==='synced');
  assert.equal(remote.data.profile.vision,'Mon espace existant');assert.equal((await store.readRecord('')).state,null);
  assert.equal((await store.listBackups(uid)).length,1);
  navigator.onLine=false;state.profile.vision='Modifié sans réseau';await store.writeWorkspace(state);
  await engine.sync();assert.equal(engine.status.kind,'offline');assert.equal(remote.data.profile.vision,'Mon espace existant');
  assert.equal((await store.readRecord()).dirty,true);
  await assert.rejects(engine.logout(true),/changements restent/);
  navigator.onLine=true;await engine.sync();assert.equal(remote.data.profile.vision,'Modifié sans réseau');assert.equal((await store.readRecord()).dirty,false);
  state.preferences.darkMode=true;await store.writeWorkspace(state);
  remote.data.profile.story='Récit sur autre appareil';remote.revision++;
  await engine.sync();assert.equal(state.profile.story,'Récit sur autre appareil');assert.equal(remote.data.preferences.darkMode,true);
  state.profile.story='Version locale';await store.writeWorkspace(state);
  remote.data.profile.story='Version distante';remote.revision++;
  await engine.sync();assert.equal(engine.status.kind,'choice');assert.equal(state.profile.story,'Version locale');
  await engine.resolve('remote');await until(()=>engine.status.kind==='synced');assert.equal(state.profile.story,'Version distante');
  assert.equal((await store.listBackups()).length,3);
  remote.data.profile.vision='Ne pas interrompre';remote.revision++;draft=true;
  await engine.sync();assert.equal(engine.status.kind,'waiting');assert.equal(state.profile.vision,'Modifié sans réseau');
  draft=false;await engine.sync();assert.equal(state.profile.vision,'Ne pas interrompre');
  await engine.logout(false);assert.equal(store.scope(),'');assert.equal(state.profile.vision,'');assert.ok(await store.readRecord(uid));
 }finally{engine.destroy();}
});
