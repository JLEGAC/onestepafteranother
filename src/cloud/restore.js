import { dependencyError } from "../identity.js";
// Merge by stable record id (XP uses key), retaining records unique to either side.
export function mergeSnapshots(local,remote,prefer='local'){
 const conflicts=[];const key=v=>v&&typeof v==='object'?(v.id||v.key||JSON.stringify(v)):JSON.stringify(v);
 function join(a,b,path){
  if(a===undefined)return structuredClone(b);if(b===undefined||JSON.stringify(a)===JSON.stringify(b))return structuredClone(a);
  if(Array.isArray(a)&&Array.isArray(b)){const records=new Map(b.map(v=>[key(v),v]));return [...a.map(v=>{const k=key(v),other=records.get(k);records.delete(k);return join(v,other,path+'.'+k);}),...structuredClone([...records.values()])];}
  if(a&&b&&typeof a==='object'&&typeof b==='object'&&!Array.isArray(a)&&!Array.isArray(b))return Object.fromEntries([...new Set([...Object.keys(a),...Object.keys(b)])].map(k=>[k,join(Object.hasOwn(a,k)?a[k]:undefined,Object.hasOwn(b,k)?b[k]:undefined,path?path+'.'+k:k)]));
  if(!['xp.total','createdAt','updatedAt'].includes(path))conflicts.push(path);return structuredClone(prefer==='local'?a:b);
 }
 const data=join(local,remote,'');if(data.xp){const sum=x=>(x.events||[]).reduce((n,e)=>n+(Number(e.amount)||0),0);data.xp.total=sum(data.xp)+Math.max(0,local.xp.total-sum(local.xp),remote.xp.total-sum(remote.xp));}return {data,conflicts};
}

export function checkRestore(data){const issue=dependencyError(data);if(issue)throw Error('Cette version contient des liens incompatibles : '+issue);return data;}
