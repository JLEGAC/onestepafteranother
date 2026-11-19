import test from 'node:test';
import assert from 'node:assert/strict';
import {indexedDB} from 'fake-indexeddb';
const storage=new Map();globalThis.indexedDB=indexedDB;
globalThis.localStorage={getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)};
globalThis.window=new EventTarget();
const store=await import('../src/local-store.js');
const {loadState}=await import('../src/data.js');
test('migration checkpoints the original scope once before persisting schema 5',async()=>{
 const old={schemaVersion:4,stones:[{id:'i',title:'Maman',success:'Présente'}],steps:[{id:'s',stoneId:'i',title:'Papiers'}],actions:[{id:'a',stoneId:'i',stepId:'s',status:'weekly',weekId:'2026-11-16'}],profile:{vision:'Avancer'},xp:{total:89,events:[]}};
 await store.readWorkspace();await store.writeWorkspace(old);
 const migrated=await loadState();assert.equal(migrated.schemaVersion,5);assert.equal((await store.readRecord()).state.schemaVersion,5);
 const backups=await store.listBackups();assert.equal(backups.length,1);assert.deepEqual(backups[0].state,old);
 await loadState();assert.equal((await store.listBackups()).length,1);
 store.setScope('second-user');await store.readWorkspace();await store.writeWorkspace({...old,profile:{vision:'Autre compte'}});await loadState();
 assert.equal((await store.listBackups('')).length,1);assert.equal((await store.listBackups('second-user'))[0].state.profile.vision,'Autre compte');
});
