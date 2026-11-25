import { readFile,writeFile,mkdir,readdir,copyFile,rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';
import path from 'node:path';
const root=new URL('../',import.meta.url).pathname;
process.chdir(root);
await mkdir('vendor',{recursive:true});
if(!process.argv.includes("--reuse-vendor"))await build({stdin:{contents:"export { createClient } from '@supabase/supabase-js';",resolveDir:root},bundle:true,format:'esm',platform:'browser',outfile:'vendor/supabase.js',minify:true,legalComments:'eof'});
const all=[];
async function collect(dir){for(const e of await readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())await collect(p);else all.push(p);}}
await collect('src');await collect('vendor');
try { await collect('screenshots'); } catch {}
for(const name of await readdir('.'))if(/\.(png|svg|css)$/.test(name)||name==='manifest.json'||['presentation.html','confidentialite.html'].includes(name))all.push(name);
const hash=createHash('sha256');
for(const f of all.sort())hash.update(f).update(await readFile(f));
hash.update(await readFile('index.html')).update(await readFile('sw.js'));
const release=hash.digest('hex').slice(0,16), base=`releases/${release}`;
await rm('_site',{recursive:true,force:true});await mkdir(`_site/${base}`,{recursive:true});
const files=[];
for(const f of all){const data=await readFile(f);await mkdir(path.dirname(`_site/${base}/${f}`),{recursive:true});await writeFile(`_site/${base}/${f}`,data);files.push({url:`./${base}/${f}`,alias:`./${f}`,integrity:'sha256-'+createHash('sha256').update(data).digest('base64')});}
let html=await readFile('index.html','utf8');
html=html.replace('href="styles.css"',`href="${base}/styles.css"`).replace('src="src/app.js"',`src="${base}/src/app.js"`);
await writeFile('_site/index.html',html);await writeFile(`_site/${base}/index.html`,html);
files.push({url:`./${base}/index.html`,integrity:'sha256-'+createHash('sha256').update(html).digest('base64')});
for(const f of all.filter(f=>!f.includes('/')||f.startsWith('screenshots/'))){await mkdir(path.dirname(`_site/${f}`),{recursive:true});await copyFile(f,`_site/${f}`);}
let sw=await readFile('sw.js','utf8');
sw=sw.replace("const RELEASE = 'development';",`const RELEASE = '${release}';`).replace('const FILES = [];',`const FILES = ${JSON.stringify(files)};`).replace("const SHELL = './index.html';",`const SHELL = './${base}/index.html';`);
await writeFile('_site/sw.js',sw);
console.log(`Version ${release} : ${files.length} fichiers vérifiés, prêts dans _site/`);
