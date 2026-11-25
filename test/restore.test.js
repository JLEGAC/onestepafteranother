import test from 'node:test';import assert from 'node:assert/strict';
import {mergeSnapshots} from '../src/cloud/restore.js';
import {weekStart} from '../src/cloud/dropbox.js';
test('merge keeps linked records and counts shared XP only once',()=>{
 const local={stones:[{id:'A',title:'local'}],xp:{total:3,events:[{key:'same',amount:3}]}},remote={stones:[{id:'A',title:'remote'},{id:'B'}],xp:{total:5,events:[{key:'same',amount:3},{key:'other',amount:2}]}};
 const r=mergeSnapshots(local,remote);assert.deepEqual(r.conflicts,['stones.A.title']);assert.equal(r.data.xp.total,5);assert.equal(r.data.stones.length,2);assert.equal(local.stones.length,1);assert.equal(mergeSnapshots(local,remote,'remote').data.stones[0].title,'remote');
});
test('UTC weeks cross year boundaries',()=>{assert.equal(weekStart('2026-12-31'),weekStart('2027-01-03'));assert.equal(weekStart('2027-01-04')-weekStart('2026-12-31'),7*86400000);});
