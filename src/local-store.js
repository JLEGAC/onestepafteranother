// Same database/store as V2: the original workspace remains the guest workspace.
const DB = 'un-pas-apres-lautre';
const ACTIVE = 'upa-active-user';
let currentScope = typeof localStorage === 'undefined' ? '' : (localStorage.getItem(ACTIVE) || '');
export const scope = () => currentScope;
export function setScope(uid) { currentScope=uid; uid ? localStorage.setItem(ACTIVE, uid) : localStorage.removeItem(ACTIVE); }
const key = uid => uid ? `account:${uid}` : 'workspace';
const fallback = uid => uid ? `upa-account:${uid}` : 'upa-fallback-record';
let expected = new Map();
let writes = Promise.resolve();
let failure = null;
let pending = 0;
export const pendingWrites = () => pending;
export async function flushWrites() { await writes; if (failure) throw failure; }
function open() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 4);
    req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains('workspace')) req.result.createObjectStore('workspace', { keyPath: 'id' }); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
function envelope(raw) {
  return raw ? { base: null, revision: 0, localRev: 0, dirty: true, approval: false, ...raw } : null;
}
export async function readRecord(uid = scope()) {
  // A newer emergency copy takes precedence even if IndexedDB becomes usable again.
  const emergency = localStorage.getItem(fallback(uid));
  if (emergency) return envelope(JSON.parse(emergency));
  let db;
  try {
    db = await open();
    return await new Promise((resolve, reject) => {
      const req = db.transaction('workspace').objectStore('workspace').get(key(uid));
      req.onsuccess = () => {
        const legacy = !uid && !req.result && localStorage.getItem('upa-fallback');
        resolve(envelope(req.result || (legacy ? {state:JSON.parse(legacy)} : null)));
      }; req.onerror = () => reject(req.error);
    });
  } catch (err) {
    const old = !uid && localStorage.getItem('upa-fallback');
    if (old) return envelope({ state: JSON.parse(old) });
    throw err; // Never silently initialize over an unreadable existing database.
  } finally { db?.close(); }
}
export async function mutateRecord(uid, transform) {
  let db;
  const emergency = localStorage.getItem(fallback(uid));
  try { if (!emergency) db = await open(); } catch { /* durable fallback below */ }
  let result;
  if (!db) {
    const old = emergency ? envelope(JSON.parse(emergency)) : (!uid && localStorage.getItem('upa-fallback') ? envelope({ state: JSON.parse(localStorage.getItem('upa-fallback')) }) : null);
    result = transform(old);
    localStorage.setItem(fallback(uid), JSON.stringify({ ...result, id: key(uid) }));
  } else {
    try {
      result = await new Promise((resolve, reject) => {
        const tx = db.transaction('workspace', 'readwrite');
        const store = tx.objectStore('workspace'); const req = store.get(key(uid));
        let next;
        req.onsuccess = () => {
          try { next = transform(envelope(req.result)); store.put({ ...next, id: key(uid) }); }
          catch (err) { tx.abort(); reject(err); }
        };
        tx.oncomplete = () => resolve(next);
        tx.onabort = tx.onerror = () => reject(tx.error || new Error('Écriture locale interrompue.'));
      });
    } finally { db.close(); }
  }
  return result;
}
export async function readWorkspace(uid = scope()) {
  const record = await readRecord(uid);
  expected.set(uid, record?.localRev || 0);
  return record?.state || null;
}
export function writeWorkspace(state) {
  const uid = scope(); const snapshot = structuredClone(state); pending++;
  const job = writes.catch(() => {}).then(async () => {
    if ((localStorage.getItem(ACTIVE)||'') !== uid) throw new Error('Le compte a changé dans une autre fenêtre. Recharge cette fenêtre.');
    const result = await mutateRecord(uid, old => {
      if ((old?.localRev || 0) !== (expected.get(uid) || 0)) throw new Error('Une autre fenêtre a modifié les données. Exporte ta sauvegarde avant de recharger.');
      return { ...envelope(old || {}), state: snapshot, localRev: (old?.localRev || 0) + 1, dirty: true };
    });
    expected.set(uid, result.localRev); failure = null;
    window.dispatchEvent(new CustomEvent('upa:saved', { detail: { uid } }));
  }).catch(err => { failure = err; window.dispatchEvent(new CustomEvent('upa:save-error', { detail: err })); throw err; }).finally(() => pending--);
  writes = job; return job;
}
export async function acceptRecord(uid, localRev, state, base, revision) {
  let accepted=false;
  await mutateRecord(uid, old => {
    if ((old?.localRev || 0) !== localRev) return old; // An edit arrived during a download.
    accepted=true;
    return { ...old, state, base, revision, dirty: false, approval: false, localRev: localRev + 1, lastSync: new Date().toISOString() };
  });
  return accepted;
}
export async function acknowledge(uid, sent, revision) {
  return mutateRecord(uid, old => ({ ...old, base: sent.state, revision, approval: false,
    dirty: old.localRev !== sent.localRev, lastSync: new Date().toISOString() }));
}
export async function removeAccountCache(uid) {
  if (!uid) return;
  const db = await open();
  await new Promise((resolve, reject) => {
    const tx = db.transaction('workspace', 'readwrite'); const store=tx.objectStore('workspace'); store.delete(key(uid));
    const req=store.openCursor(); req.onsuccess=()=>{const cur=req.result;if(cur){if(cur.key.startsWith(`backup:${uid}:`))cur.delete();cur.continue();}};
    tx.oncomplete = resolve; tx.onerror = () => reject(tx.error);
  });
  db.close(); localStorage.removeItem(fallback(uid)); expected.delete(uid);
}
export async function backupRecord(uid, state) {
  const id = `backup:${uid || 'guest'}:${crypto.randomUUID()}`;
  const db = await open();
  await new Promise((resolve, reject) => {
    const tx = db.transaction('workspace', 'readwrite'); tx.objectStore('workspace').put({id, state, createdAt:new Date().toISOString()});
    tx.oncomplete = resolve; tx.onerror = () => reject(tx.error);
  }); db.close();
}
export async function listBackups(uid = scope()) {
  const db = await open();
  const rows = await new Promise((resolve, reject) => {
    const r = db.transaction('workspace').objectStore('workspace').getAll(); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error);
  }); db.close();
  return rows.filter(r => r.id.startsWith(`backup:${uid || 'guest'}:`));
}

export async function releaseGuestCopy(localRev) {
  await mutateRecord('',old => !old || old.localRev !== localRev ? old : {...old,state:null,localRev:old.localRev+1,dirty:false});
  localStorage.removeItem('upa-fallback');
}
