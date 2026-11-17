import test from 'node:test';
import assert from 'node:assert/strict';
import {createInitialState,normalizeState} from '../src/data.js';
import {equal,mergeStates} from '../src/cloud/model.js';
// Browser local-store is imported by data.js; supply its tiny synchronous dependency
test('merge independent profile and preference changes without losing either',()=>{
 const base=createInitialState(),local=structuredClone(base),remote=structuredClone(base);
 local.preferences.darkMode=true;remote.profile.vision='Créer';
 const result=mergeStates(base,local,remote);assert.deepEqual(result.conflicts,[]);assert.equal(result.state.preferences.darkMode,true);assert.equal(result.state.profile.vision,'Créer');
});
test('concurrent habit rewards are a conflict, never duplicated or overwritten',()=>{
 const base=createInitialState(),local=structuredClone(base),remote=structuredClone(base);
 local.xp.total=11;local.habitLogs.a={};remote.xp.total=22;remote.actions.push({id:'a'});
 assert.equal(mergeStates(base,local,remote).state,null);
});
test('deletion versus remote editing is not silently resurrected',()=>{
 const base=createInitialState();base.actions=[{id:'a',title:'Avant'}];
 const local=structuredClone(base),remote=structuredClone(base);local.actions=[];remote.actions[0].title='Après';
 assert.equal(mergeStates(base,local,remote).state,null);
});
test('state equality ignores only bookkeeping timestamps; future content remains significant',()=>{
 const a=createInitialState(),b=structuredClone(a);b.updatedAt='today';b.createdAt='yesterday';assert.ok(equal(a,b));b.profile.vision='différent';assert.ok(!equal(a,b));
});
test('invalid image attributes cannot survive backup/cloud normalization',()=>{
 const s=createInitialState();s.profile.resonanceImages=[{dataUrl:'data:image/png;\" onerror=alert(1)'},{dataUrl:'data:image/jpeg;base64,YQ=='}];assert.equal(normalizeState(s).profile.resonanceImages.length,1);
});
