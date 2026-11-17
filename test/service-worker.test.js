import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
let script=await readFile(new URL('../sw.js',import.meta.url),'utf8');
const root='https://example.test/app/';
script=script.replace("const RELEASE = 'development';","const RELEASE = 'v2';").replace('const FILES = [];',`const FILES = [{url:'./releases/v2/index.html',integrity:''},{url:'./releases/v2/src/app.js',alias:'./src/app.js',integrity:''}];`).replace("const SHELL = './index.html';","const SHELL = './releases/v2/index.html';");
function worker(fetchImpl,clients=[]){
 const listeners={},maps=new Map();let skipped=0;
 const caches={open:async name=>{if(!maps.has(name))maps.set(name,new Map());const m=maps.get(name);return {put:async(k,v)=>m.set(typeof k==='string'?k:k.url,v.clone()),match:async k=>m.get(typeof k==='string'?k:k.url)?.clone()};},keys:async()=>[...maps.keys()],delete:async k=>maps.delete(k)};
 const self={location:{origin:'https://example.test'},registration:{scope:root},clients:{claim:async()=>{},matchAll:async()=>clients},skipWaiting:async()=>skipped++,addEventListener:(k,fn)=>listeners[k]=fn};
 runInNewContext(script,{self,caches,fetch:fetchImpl,URL,Response,Request,Map});
 return {listeners,caches,maps,get skipped(){return skipped;}};
}
async function fire(w,type,extra={}){let promise;w.listeners[type]({...extra,waitUntil:p=>promise=p,respondWith:p=>promise=p});return promise;}
test('precache completes without immediate activation; root aliases stay on one release',async()=>{
 const w=worker(async req=>new Response(req.url));await fire(w,'install');assert.equal(w.skipped,0);
 const r=await fire(w,'fetch',{request:{method:'GET',url:root+'src/app.js',mode:'cors'}});assert.equal(await r.text(),root+'releases/v2/src/app.js');
 const nav=await fire(w,'fetch',{request:{method:'GET',url:root+'?code=oauth',mode:'navigate'}});assert.equal(await nav.text(),root+'releases/v2/index.html');
});
test('partial download does not leave an installable release cache',async()=>{
 const w=worker(async()=>{throw new Error('offline');});await assert.rejects(fire(w,'install'));assert.equal(w.maps.size,0);
});
test('another open window prevents forced activation',async()=>{
 const w=worker(async()=>new Response('ok'),[{url:root,id:'a'},{url:root,id:'b'}]);let answer;
 await fire(w,'message',{data:{type:'ACTIVATE_UPDATE'},ports:[{postMessage:x=>answer=x}]});assert.equal(answer.ok,false);assert.equal(w.skipped,0);
});
test('old caches removed only after all live clients acknowledge the new release',async()=>{
 const w=worker(async()=>new Response('ok'),[{url:root,id:'a'},{url:root,id:'b'}]);await w.caches.open('upa-_app_-release-v1');await w.caches.open('unrelated-cache');
 await fire(w,'message',{data:{type:'RELEASE_READY',release:'v2'},source:{id:'a'}});assert.ok(w.maps.has('upa-_app_-release-v1'));
 await fire(w,'message',{data:{type:'RELEASE_READY',release:'v2'},source:{id:'b'}});assert.ok(!w.maps.has('upa-_app_-release-v1'));assert.ok(w.maps.has('unrelated-cache'));
});
