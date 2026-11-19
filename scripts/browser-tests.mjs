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
let stage='initialisation';
const events=[];
function mark(message){stage=message;console.log(message);}
function observe(ctx){
 ctx.on('page',p=>{
  p.on('console',m=>{if(m.type()==='error')events.push({type:'console',message:m.text()});});
  p.on('pageerror',e=>events.push({type:'pageerror',message:e.message}));
  p.on('requestfailed',r=>events.push({type:'requestfailed',url:r.url(),message:r.failure()?.errorText}));
  p.on('response',r=>{if(r.status()>=400)events.push({type:'http',status:r.status(),url:r.url()});});
 });
}
observe(context);
async function diagnostics(error){
 const report={stage,error:error.stack||String(error),servedVersion:version,events:events.slice(-60),pages:[]};
 for(const ctx of browser.contexts())for(const p of ctx.pages()) {
  try{report.pages.push(await p.evaluate(async()=>{
   const reg=await navigator.serviceWorker.getRegistration();
   const describe=w=>w?{state:w.state,script:w.scriptURL}:null;
   return {url:location.href,scriptAttribute:document.querySelector('script[type=module]')?.getAttribute('src'),
    scriptURL:document.querySelector('script[type=module]')?.src,appLoaded:!!document.querySelector('#cloud-indicator'),
    bannerVisible:!!document.querySelector('.update-banner:not([hidden])'),
    controller:describe(navigator.serviceWorker.controller),active:describe(reg?.active),waiting:describe(reg?.waiting),installing:describe(reg?.installing),
    caches:await caches.keys(),text:document.body.innerText.slice(0,800)};
  }));}catch(e){report.pages.push({url:p.url(),diagnosticError:e.message});}
 }
 console.error('PWA DEBUG '+JSON.stringify(report,null,2));
 await mkdir('test-results',{recursive:true});
 await writeFile('test-results/browser-debug.json',JSON.stringify(report,null,2));
}
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
 mark('✓ première installation, saisie et conservation de la vision');
 mark('Vérification des identités, étapes et dépendances');
 await page.locator('.bottom-nav [data-page="cible"]').click();
 await page.locator('.page-title-row [data-action="new-stone"]').click();
 await page.locator('#stone-form [name="title"]').fill('Je suis une super maman');
 await page.locator('#stone-form [name="description"]').fill('Présente et attentive');
 await page.locator('button[form="stone-form"]').click();
 await page.locator('[data-action="new-pillar"]').click();
 await page.locator('#pillar-form [name="title"]').fill('Transmission');
 await page.locator('button[form="pillar-form"]').click();
 await page.locator('[data-action="new-step"]').click();
 await page.locator('#step-form [name="title"]').fill('Organiser les papiers');
 await page.locator('button[form="step-form"]').click();
 await page.locator('[data-action="new-action"]').click();
 await page.locator('#action-form [name="title"]').fill('Rassembler la corbeille');
 await page.locator('button[form="action-form"]').click();
 await page.locator('[data-action="new-action"]').click();
 await page.locator('#action-form [name="title"]').fill('Classer les factures');
 await page.locator('#action-form [name="dependsOnActionId"]').selectOption({label:'Rassembler la corbeille'});
 await page.locator('button[form="action-form"]').click();
 const dependent=page.locator('.action-card').filter({has:page.getByRole('heading',{name:'Classer les factures',exact:true})});
 assert.equal(await dependent.locator('[data-action="complete-action"]').isDisabled(),true);
 await dependent.locator('[data-action="plan-action"]').click();
 await page.getByRole('button',{name:'Planifier d’abord l’action préalable',exact:true}).click();
 const dates=await page.locator('#schedule-action-form [name="date"] option').evaluateAll(options=>options.map(o=>o.value).filter(Boolean));
 await page.locator('#schedule-action-form [name="date"]').selectOption(dates[0]);
 await page.locator('#schedule-action-form [name="slot"]').selectOption('morning');
 await page.locator('button[form="schedule-action-form"]').click();
 await dependent.locator('[data-action="plan-action"]').click();
 await page.locator('#schedule-action-form [name="date"]').selectOption(dates[0]);
 await page.locator('#schedule-action-form [name="slot"]').selectOption('morning');
 await page.locator('button[form="schedule-action-form"]').click();
 const previous=page.locator('.action-card').filter({has:page.getByRole('heading',{name:'Rassembler la corbeille',exact:true})});
 await previous.locator('[data-action="complete-action"]').click();
 await page.waitForFunction(()=>{const cards=[...document.querySelectorAll('.action-card')];return cards.find(c=>c.querySelector('h3')?.textContent==='Classer les factures')?.querySelector('[data-action="complete-action"]')?.disabled===false;});
 await dependent.locator('[data-action="complete-action"]').click();
 await page.locator('[data-action="edit-step"]').click();
 await page.locator('#step-form [name="title"]').fill('Les papiers sont organisés');
 await page.locator('button[form="step-form"]').click();
 await page.getByText('Les papiers sont organisés',{exact:true}).first().waitFor();
 await page.locator('.step-tools [data-action="new-step"]').click();
 await page.locator('#step-form [name="title"]').fill('Préparer le dossier bébé');
 await page.locator('button[form="step-form"]').click();
 await page.locator('.identity-step .identity-step').filter({hasText:'Préparer le dossier bébé'}).waitFor();
 assert.equal(await page.locator('.identity-step .identity-step').count(),1);
 await mkdir('test-results',{recursive:true});await page.screenshot({path:'test-results/identites-mobile.png',fullPage:true});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.setViewportSize({width:1280,height:900});await page.screenshot({path:'test-results/identites-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});
 await page.locator('.bottom-nav [data-page="home"]').click();
 await page.locator('#win-form [name="win"]').fill('J’ai organisé les papiers');
 await page.locator('#win-form [name="related"]').selectOption({label:'🎯 Je suis une super maman'});
 await page.getByRole('button',{name:'Enregistrer ma victoire',exact:true}).click();
 await page.locator('.win-item').filter({hasText:'J’ai organisé les papiers'}).waitFor();
 assert.equal(await page.locator('#win-form [name="win"]').inputValue(),'');
 assert.match(await page.locator('.win-item').first().innerText(),/Je suis une super maman/);
 await page.locator('.header-icon[data-page="profile"]').click();
 await page.locator('[data-setting="autoUpdates"]').uncheck();
 await page.getByText('Préférence désactivée.',{exact:true}).waitFor();
 await page.reload();await ready(page);
 assert.equal(await page.locator('[data-setting="autoUpdates"]').isChecked(),false);
 await page.getByRole('button',{name:'Vérifier maintenant',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('#update-check-status')?.textContent.includes('à jour'));
 await page.locator('[data-setting="autoUpdates"]').check();
 await page.locator('.bottom-nav [data-page="home"]').click();
 mark('✓ création et modification, sous-étape, dépendance, planification, victoire et préférences');

 await context.setOffline(true);await page.reload();await ready(page);
 assert.match(await page.locator('#app').innerText(),/Avancer sereinement/);
 await page.evaluate(()=>{location.hash='profile';window.dispatchEvent(new PopStateEvent('popstate'));});
 await page.getByRole('heading',{name:'Mon compte et mes données'}).waitFor();
 assert.match(await page.locator('#cloud-account').innerText(),/configuration du service|Se connecter avec Google/);
 await context.setOffline(false);
 mark('✓ ouverture hors connexion et profil avec configuration cloud absente');
 version='b';
 await page.evaluate(async()=>{await (await navigator.serviceWorker.ready).update();});
 await page.locator('.update-banner:not([hidden])').waitFor();
 await page.locator('.update-banner').getByRole('button',{name:'Plus tard',exact:true}).click();
 assert.equal(await page.locator('.update-banner').isVisible(),false);
 // Keep one old-version client alive: otherwise the browser may legitimately
 // activate the waiting worker when the last window closes.
 const keeper=await context.newPage();await keeper.goto(url);await ready(keeper);
 await page.close();page=await context.newPage();await page.goto(url);await ready(page);
 await page.locator('.update-banner:not([hidden])').waitFor();
 await keeper.close();
 mark('✓ report puis reproposition à la réouverture tant que la version attend');
 // An unsaved input exercises the application's actual draft detector.
 await page.evaluate(()=>{const i=document.createElement('input');i.id='test-draft';i.value='saisie non enregistrée';document.querySelector('#app').append(i);});
 page.once('dialog',d=>d.dismiss());
 await page.locator('.update-banner').getByRole('button',{name:'Mettre à jour',exact:true}).click();
 assert.equal(await page.locator('#test-draft').inputValue(),'saisie non enregistrée');
 await page.locator('#test-draft').evaluate(el=>el.remove());
 const second=await context.newPage();await second.goto(url);await ready(second);
 let alertText='';page.once('dialog',d=>{alertText=d.message();d.accept();});
 await page.locator('.update-banner').getByRole('button',{name:'Mettre à jour',exact:true}).click();
 await page.waitForFunction(()=>!document.querySelector('[data-update]').disabled);
 assert.match(alertText,/autres fenêtres/);await second.close();
 await Promise.all([page.waitForEvent('load'),page.locator('.update-banner').getByRole('button',{name:'Mettre à jour',exact:true}).click()]);
 await page.waitForFunction(expected=>document.querySelector('script[type=module]')?.src.includes(expected),next);
 await page.waitForSelector('#cloud-indicator');
 assert.match(await page.locator('#app').innerText(),/Avancer sereinement/);
 mark('✓ protection de saisie et autres fenêtres ; activation, rechargement, données préservées');
 await context.setOffline(true);await page.close();page=await context.newPage();await page.goto(url);
 await page.waitForSelector('#cloud-indicator');
 assert.match(await page.locator('#app').innerText(),/Avancer sereinement/);
 const caches=await page.evaluate(()=>window.caches.keys());assert.ok(caches.some(c=>c.endsWith(next)));
 await mkdir('test-results',{recursive:true});await page.screenshot({path:'test-results/pwa-mobile.png',fullPage:true});
 assert.deepEqual(errors,[]);
 mark('✓ réouverture hors connexion après mise à jour ; aucune erreur JavaScript');
 // Independently test closing ALL clients after deferring an update. Both
 // browser outcomes are valid: automatic activation, or a still-waiting worker.
 await context.setOffline(false);
 version='a';
 const reopening=await browser.newContext({viewport:{width:390,height:844}});
 observe(reopening);
 let reopened=await reopening.newPage();
 try {
  mark('DEBUG : installation du contexte indépendant en version A');
  await reopened.goto(url);await ready(reopened);
  await reopened.keyboard.press('Escape');
  await reopened.evaluate(()=>navigator.serviceWorker.ready);
  await reopened.waitForFunction(()=>!!navigator.serviceWorker.controller);
  await reopened.reload();await ready(reopened);
  mark('DEBUG : recherche de la version B dans le contexte indépendant');
  version='b';
  await reopened.evaluate(async()=>{await (await navigator.serviceWorker.ready).update();});
  await reopened.locator('.update-banner:not([hidden])').waitFor();
  await reopened.locator('.update-banner').getByRole('button',{name:'Plus tard',exact:true}).click();
  mark('DEBUG : fermeture de toutes les fenêtres après Plus tard');
  await reopened.close();
  reopened=await reopening.newPage();await reopened.goto(url);await ready(reopened);
  await reopened.waitForFunction(expected=>
   document.querySelector('script[type=module]')?.src.includes('/releases/'+expected+'/') ||
   !!document.querySelector('.update-banner:not([hidden])'),next);
  const current=await reopened.locator('script[type=module]').getAttribute('src');
  // getAttribute returns the relative HTML spelling (releases/...), whereas
  // element.src is absolute. Normalize before deciding whether activation is needed.
  const currentPath=new URL(current,reopened.url()).pathname;
  console.log('DEBUG : version après réouverture',JSON.stringify({current,currentPath,expected:next}));
  if(!currentPath.includes('/releases/'+next+'/')) {
   mark('DEBUG : version encore en attente, activation explicite');
   await Promise.all([reopened.waitForEvent('load'),reopened.locator('.update-banner').getByRole('button',{name:'Mettre à jour',exact:true}).click()]);
   await ready(reopened);
  }
  await reopened.waitForFunction(expected=>document.querySelector('script[type=module]')?.src.includes('/releases/'+expected+'/'),next);
  mark('✓ fermeture complète après report : version activée ou mise à jour proposée');
 } catch(error){await diagnostics(error);throw error;} finally {await reopening.close();}

} catch(error){await diagnostics(error);throw error;} finally {
 await browser.close();await new Promise(r=>server.close(r));await rm(temporary,{recursive:true,force:true});
}
