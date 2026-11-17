import { readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
async function walk(dir){for(const e of await readdir(dir,{withFileTypes:true})){const p=`${dir}/${e.name}`;if(e.isDirectory())await walk(p);else if(/\.(js|mjs|cjs)$/.test(p)){const r=spawnSync(process.execPath,['--check',p],{stdio:'inherit'});if(r.status)process.exit(r.status);}}}
await walk('src');await walk('scripts');
const r=spawnSync(process.execPath,['--check','sw.js'],{stdio:'inherit'});process.exitCode=r.status;
