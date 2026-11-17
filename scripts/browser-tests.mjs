import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFile,writeFile,cp,mkdtemp,rm,readdir,rename,mkdir} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const temporary=await mkdtemp(path.join(tmpdir(),'pasapas-browser-'));
await cp('_site',path.join(temporary,'a'),{recursive:true});
await cp('_site',path.join(temporary,'b'),{recursive:true});
const old=(await readdir(path.join(temporary,'a/releases')))[0],next=old+'b';
await rename(path.join(temporary,'b/releases',old),path.join(temporary,'b/releases',next));
let shell=(await readFile(path.join(temporary,'b/index.html'),'utf8')).replaceAll(old,next);
await writeFile(path.join(temporary,'b/index.html'),shell);
await writeFile(path.join(temporary,'b/releases',next,'index.html'),shell);
let sw=(await readFile(path.join(temporary,'b/sw.js'),'utf8')).replaceAll(old,next);
const match=sw.match(/const FILES = (\[.*\]);/);
const files=JSON.parse(match[1]);
for(const f of files)if(f.url.endsWith('/index.html'))f.integrity='sha256-'+createHash('sha256').update(shell).digest('base64');
sw=sw.replace(match[0],`const FILES = ${JSON.stringify(files)};`);
await writeFile(path.join(temporary,'b/sw.js'),sw);
let version='a';
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp'};
const server=createServer(async(req,res)=>{
 try {
 const url=new URL(req.url,'http://localhost');
 const relative=decodeURIComponent(url.pathname).replace(/^\//,'')||'index.html';
 const file=path.resolve(temporary,version,relative);
 if(!file.startsWith(path.join(temporary,version)+path.sep))throw Error('path');
 res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.setHeader('Cache-Control','no-store');
 res.end(await readFile(file));
 }catch{res.statusCode=404;res.end('not found');}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const url=`http://127.0.0.1:${server.address().port}/`;
const browser=await chromium.launch({headless:true,...(existsSync('/usr/bin/chromium')?{executablePath:'/usr/bin/chromium',args:['--no-sandbox']}:{} )});
const context=await browser.newContext({viewport:{width:390,height:844}});
const errors=[];context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));
let page=await context.newPage();
const ready=async p=>{await p.waitForSelector('#cloud-indicator');};
try {
 await page.goto(url);await page.waitForSelector('#vision-form input');
 await page.locator('#vision-form input').fill('Avancer sereinement');
 await page.getByRole('button',{name:/Poser ma vision/}).click();
 await page.waitForFunction(()=>!document.querySelector('#vision-form'));
 await page.evaluate(()=>navigator.serviceWorker.ready);await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
 await page.reload();await ready(page);
 assert.match(await page.locator('#app').innerText(),/Avancer sereinement/);
 console.log('✓ première installation, saisie et conservation de la vision');
 await context.setOffline(true);await page.reload();await ready(page);
 assert.match(await page.locator('#app').innerText(),/Avancer sereinement/);
 await page.evaluate(()=>{location.hash='profile';window.dispatchEvent(new PopStateEvent('popstate'));});
 await page.getByRole('heading',{name:'Mon compte et mes données'}).waitFor();
 assert.match(await page.locator('#cloud-account').innerText(),/configuration du service|Se connecter avec Google/);
 await context.setOffline(false);
 console.log('✓ ouverture hors connexion et profil avec configuration cloud absente');
 version='b';
 await page.evaluate(async()=>{await (await navigator.serviceWorker.ready).update();});
 await page.locator('.update-banner:not([hidden])').waitFor();
 await page.getByRole('button',{name:'Plus tard',exact:true}).click();
 assert.equal(await page.locator('.update-banner').isVisible(),false);
 // Keep one old-version client alive: otherwise the browser may legitimately
 // activate the waiting worker when the last window closes.
 const keeper=await context.newPage();await keeper.goto(url);await ready(keeper);
 await page.close();page=await context.newPage();await page.goto(url);await ready(page);
 await page.locator('.update-banner:not([hidden])').waitFor();
 await keeper.close();
 console.log('✓ report puis reproposition à la réouverture tant que la version attend');
 // An unsaved input exercises the application's actual draft detector.
 await page.evaluate(()=>{const i=document.createElement('input');i.id='test-draft';i.value='saisie non enregistrée';document.querySelector('#app').append(i);});
 page.once('dialog',d=>d.dismiss());
 await page.getByRole('button',{name:'Mettre à jour',exact:true}).click();
 assert.equal(await page.locator('#test-draft').inputValue(),'saisie non enregistrée');
 await page.locator('#test-draft').evaluate(el=>el.remove());
 const second=await context.newPage();await second.goto(url);await ready(second);
 let alertText='';page.once('dialog',d=>{alertText=d.message();d.accept();});
 await page.getByRole('button',{name:'Mettre à jour',exact:true}).click();
 await page.waitForFunction(()=>!document.querySelector('[data-update]').disabled);
 assert.match(alertText,/autres fenêtres/);await second.close();
 await Promise.all([page.waitForEvent('load'),page.getByRole('button',{name:'Mettre à jour',exact:true}).click()]);
 await page.waitForFunction(expected=>document.querySelector('script[type=module]').src.includes(expected),next);
 await page.waitForSelector('#cloud-indicator');
 assert.match(await page.locator('#app').innerText(),/Avancer sereinement/);
 console.log('✓ protection de saisie et autres fenêtres ; activation, rechargement, données préservées');
 await context.setOffline(true);await page.close();page=await context.newPage();await page.goto(url);
 await page.waitForSelector('#cloud-indicator');
 assert.match(await page.locator('#app').innerText(),/Avancer sereinement/);
 const caches=await page.evaluate(()=>window.caches.keys());assert.ok(caches.some(c=>c.endsWith(next)));
 await mkdir('test-results',{recursive:true});await page.screenshot({path:'test-results/pwa-mobile.png',fullPage:true});
 assert.deepEqual(errors,[]);
 console.log('✓ réouverture hors connexion après mise à jour ; aucune erreur JavaScript');
 // Independently test closing ALL clients after deferring an update. Both
 // browser outcomes are valid: automatic activation, or a still-waiting worker.
 await context.setOffline(false);
 version='a';
 const reopening=await browser.newContext({viewport:{width:390,height:844}});
 let reopened=await reopening.newPage();
 try {
  await reopened.goto(url);await ready(reopened);
  await reopened.keyboard.press('Escape');
  await reopened.evaluate(()=>navigator.serviceWorker.ready);
  await reopened.waitForFunction(()=>!!navigator.serviceWorker.controller);
  await reopened.reload();await ready(reopened);
  version='b';
  await reopened.evaluate(async()=>{await (await navigator.serviceWorker.ready).update();});
  await reopened.locator('.update-banner:not([hidden])').waitFor();
  await reopened.getByRole('button',{name:'Plus tard',exact:true}).click();
  await reopened.close();
  reopened=await reopening.newPage();await reopened.goto(url);await ready(reopened);
  await reopened.waitForFunction(expected=>
   document.querySelector('script[type=module]').src.includes('/releases/'+expected+'/') ||
   !!document.querySelector('.update-banner:not([hidden])'),next);
  const current=await reopened.locator('script[type=module]').getAttribute('src');
  if(!current.includes('/releases/'+next+'/')) {
   await Promise.all([reopened.waitForEvent('load'),reopened.getByRole('button',{name:'Mettre à jour',exact:true}).click()]);
   await ready(reopened);
  }
  await reopened.waitForFunction(expected=>document.querySelector('script[type=module]').src.includes('/releases/'+expected+'/'),next);
  console.log('✓ fermeture complète après report : version activée ou mise à jour proposée');
 } finally {await reopening.close();}

} finally {
 await browser.close();await new Promise(r=>server.close(r));await rm(temporary,{recursive:true,force:true});
}
