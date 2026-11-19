import { createInitialState, normalizeState, loadState } from '../data.js';
import { readRecord, mutateRecord, readWorkspace, scope, setScope, flushWrites, pendingWrites, acceptRecord, acknowledge, backupRecord, removeAccountCache, releaseGuestCopy } from '../local-store.js';
import { equal, mergeStates, hasData } from './model.js';
import { packMedia, unpackMedia } from './media.js';

export function createSyncEngine(client, hooks) {
  const backedUpRemote = new Set();
  let session = null, running = false, paused = false, conflict = null, timer;
  let status = { kind: client ? 'connecting' : 'disabled', email: '', pending: false };
  const emit = (kind, extra={}) => { status = { ...status, kind, ...extra }; hooks.status(status); };
  const stillUser = uid => !paused && uid === scope() && uid === session?.user.id && uid === (localStorage.getItem('upa-active-user')||'');
  async function apply(uid) { if (uid === scope()) hooks.apply(await loadState()); }
  async function account(next) {
    if (paused) return;
    session = next;
    if (!next) { emit(scope() ? 'reauth' : 'guest', { email: '', pending: Boolean((await readRecord())?.dirty) }); return; }
    const uid = next.user.id;
    if (scope() !== uid) {
      await (hooks.flush?.() || flushWrites());
      if (hooks.hasDraft() && !confirm('Changer de compte et quitter la saisie en cours ?')) { emit('reauth'); return; }
      let record = await readRecord(uid);
      if (!record) {
        const guest = await readRecord('');
        const state = guest?.state || createInitialState();
        await mutateRecord(uid, old => old || { state, base:null, revision:0, localRev:0, dirty:true, guestRev:guest?.localRev ?? null, approval:hasData(state,createInitialState()) });
      }
      setScope(uid); await apply(uid);
    }
    emit(conflict?'choice':'pending', { email:next.user.email || '', pending:Boolean((await readRecord(uid))?.dirty) });
    schedule(0);
  }
  function schedule(delay=700) { clearTimeout(timer); timer=setTimeout(()=>sync(),delay); }
  async function remoteState(uid, local) {
    const {error:ensureError} = await client.rpc('upa_ensure_account');
    if (ensureError) throw ensureError;
    const {data,error} = await client.from('user_app_state').select('data,revision,schema_version').eq('user_id',uid).maybeSingle();
    if (error) throw error;
    if (data?.schema_version > 5) throw new Error('Une version plus récente de Pas à Pas est nécessaire.');
    if(data && data.schema_version < 5 && !backedUpRemote.has(uid)) { await backupRecord(uid,data.data);backedUpRemote.add(uid); }
    return data ? { state:normalizeState(await unpackMedia(client,uid,data.data,local)), revision:data.revision } : null;
  }
  async function send(uid, record, expectedRevision) {
    const data = await packMedia(client,uid,record.state);
    if (!stillUser(uid)) return false;
    const { data:result, error } = await client.rpc('upa_save_state', { p_owner:uid, p_data:data, p_expected_revision:expectedRevision, p_schema_version:5 });
    if (error) throw error;
    if (!result?.ok) { schedule(100); return false; }
    await acknowledge(uid, record, result.revision);
    return true;
  }
  async function perform() {
    const uid=session?.user.id;
    if (!uid || !stillUser(uid)) return;
    let local=await readRecord(uid);
    if (!local) return;
    if (navigator.onLine === false) { emit('offline',{pending:local.dirty}); return; }
    emit('syncing',{pending:local.dirty});
    const {error:identityError}=await client.auth.getUser();
    if(identityError) {
      if(identityError.code === 'user_not_found') { await removeAccountCache(uid); setScope(''); await apply(''); session=null; emit('removed',{pending:false,email:''}); }
      else emit('reauth',{pending:local.dirty});
      return;
    }
    const remote=await remoteState(uid,local.state);
    if (!stillUser(uid)) return;
    const fresh=await readRecord(uid);
    if (fresh.localRev !== local.localRev) { schedule(100); return; }
    if (local.approval || (!local.base && remote && !equal(local.state,remote.state) && hasData(local.state,createInitialState()))) {
      conflict={uid,local,remote,initial:true}; emit('choice',{pending:true,conflict}); return;
    }
    if (!remote) {
      if (local.revision > 0) { emit('removed',{pending:local.dirty}); return; }
      await send(uid,local,0);
    } else if (equal(local.state,remote.state)) {
      await acknowledge(uid,local,remote.revision);
    } else if (!local.dirty || !hasData(local.state,createInitialState())) {
      if (hooks.hasDraft() || pendingWrites()) { emit('waiting',{pending:local.dirty}); return; }
      if (await acceptRecord(uid,local.localRev,remote.state,remote.state,remote.revision)) await apply(uid);
    } else {
      const merged = mergeStates(local.base ? normalizeState(local.base) : null,normalizeState(local.state),remote.state);
      if (!merged.state) { conflict={uid,local,remote,initial:false}; emit('choice',{pending:true,conflict}); return; }
      if (hooks.hasDraft() || pendingWrites()) { emit('waiting',{pending:true}); return; }
      // Stage the merge locally before sending it, guarded against another tab's edit.
      let staged=false;
      const result=await mutateRecord(uid,old => {
        if(old.localRev !== local.localRev)return old;
        staged=true;return {...old,state:merged.state,localRev:old.localRev+1,dirty:true};
      });
      if (!staged) { schedule(100); return; }
      await apply(uid); local=result;
      await send(uid,local,remote.revision);
    }
    if (!stillUser(uid)) return;
    const saved=await readRecord(uid);
    emit(saved.dirty?'pending':'synced',{pending:saved.dirty,lastSync:saved.lastSync,conflict:null});
    if (saved.dirty) schedule(1000);
  }
  async function sync() {
    if (!client || running || paused || conflict) return;
    running=true;
    try {
      if (navigator.locks) await navigator.locks.request(`upa-sync:${scope()}`,{ifAvailable:true},lock=>lock?perform():undefined);
      else await perform(); // Server revision checks still serialize writes.
    } catch (err) {
      console.warn('Synchronisation interrompue',err.message);
      emit(navigator.onLine===false?'offline':'error',{message:err.message,pending:Boolean((await readRecord())?.dirty)});
    } finally { running=false; }
  }
  async function resolve(choice) {
    if (!conflict || running) return;
    const {uid}=conflict;
    if (!stillUser(uid)) return;
    if (hooks.hasDraft() && !confirm('Quitter la saisie en cours pour résoudre la synchronisation ?')) return;
    running=true;
    try {
      await (hooks.flush?.() || flushWrites()); const local=await readRecord(uid); const remote=await remoteState(uid,local.state);
      await backupRecord(uid,local.state); if (remote) await backupRecord(uid,remote.state);
      if (choice==='remote') {
        const data=remote?.state || createInitialState();
        if (await acceptRecord(uid,local.localRev,data,data,remote?.revision||0)) await apply(uid);
      } else {
        // This explicit choice replaces the cloud snapshot, with a saved copy of both.
        await send(uid,local,remote?.revision||0);
      }
      if(local.guestRev !== null && local.guestRev !== undefined) await releaseGuestCopy(local.guestRev);
      conflict=null; emit('pending',{conflict:null});
    } catch(err) { emit('error',{message:err.message}); }
    finally { running=false; schedule(0); }
  }
  async function login() {
    if (!client) return;
    if (hooks.hasDraft() && !confirm('Se connecter et quitter la saisie en cours ?')) return;
    await (hooks.flush?.() || flushWrites());
    const url=new URL(location.href); url.hash=''; url.search='';
    const {error}=await client.auth.signInWithOAuth({provider:'google',options:{redirectTo:url.href,queryParams:{prompt:'select_account'}}});
    if(error) throw error;
  }
  async function logout(remove=false) {
    await (hooks.flush?.() || flushWrites());
    if (running) throw new Error('Attends la fin de la synchronisation avant de te déconnecter.');
    const uid=scope();
    if(remove && (await readRecord(uid))?.dirty) throw new Error('Des changements restent à envoyer. Conserve la copie locale ou synchronise avant de la supprimer.');
    paused=true; clearTimeout(timer);
    const {error}=await client.auth.signOut({scope:'local'});
    if(error) { paused=false; throw error; }
    if(remove) await removeAccountCache(uid);
    session=null; conflict=null; setScope(''); await apply(''); paused=false;
    emit('guest',{email:'',pending:false,conflict:null});
  }
  async function deleteAccount() {
    if (running) throw new Error('Attends la fin de la synchronisation.');
    if (!session || navigator.onLine===false) throw new Error('Reconnecte-toi à Internet et à ton compte pour le supprimer.');
    await (hooks.flush?.() || flushWrites());
    paused=true; clearTimeout(timer);
    try {
      const {data,error}=await client.functions.invoke('delete-account',{body:{confirm:true,owner:scope()}});
      if(error || !data?.deleted) throw error || new Error('Suppression non confirmée. Réessaie.');
      const uid=scope(); await client.auth.signOut({scope:'local'});
      await removeAccountCache(uid); session=null; conflict=null; setScope(''); await apply('');
      emit('guest',{email:'',pending:false,conflict:null});
    } finally { paused=false; }
  }
  function retry() { conflict=null; schedule(0); }
  let authSubscription, interval;
  const listeners = new AbortController();
  if (client) {
    authSubscription=client.auth.onAuthStateChange((_event,next)=>setTimeout(()=>account(next).catch(err=>emit('error',{message:err.message})),0))?.data?.subscription;
    window.addEventListener('upa:saved',()=>{if(session&&stillUser(session.user.id)){emit(conflict?'choice':navigator.onLine===false?'offline':'pending',{pending:true});schedule();}},{signal:listeners.signal});
    window.addEventListener('online',()=>schedule(0),{signal:listeners.signal});
    window.addEventListener('offline',()=>emit('offline'),{signal:listeners.signal});
    document.addEventListener('visibilitychange',()=>{if(!document.hidden) schedule(0);},{signal:listeners.signal});
    interval=setInterval(()=>{if(!document.hidden) schedule(0);},30000);
  }
  return { login, logout, deleteAccount, resolve, retry, sync, destroy(){paused=true;clearTimeout(timer);clearInterval(interval);listeners.abort();authSubscription?.unsubscribe();}, get status(){return status;} };
}
