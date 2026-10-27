const { chromium } = require('playwright');
const fs = require('node:fs');
(async () => {
 const browser = await chromium.launch({headless:true});
 const captures = [
  ['accueil-mobile',390,844,'home','narrow','Accueil de Pas à Pas'],
  ['cap-desktop',1280,800,'week','wide','Cap Hebdo sur ordinateur']
 ];
 fs.mkdirSync('screenshots',{recursive:true});
 const entries=[];
 try {
  for(const [name,width,height,route,factor,label] of captures) {
   const page=await browser.newPage({viewport:{width,height}});
   await page.goto('http://127.0.0.1:8765/#'+route);
   await page.waitForSelector('#page-content');
   await page.evaluate(()=>document.fonts.ready);
   await page.screenshot({path:`screenshots/${name}.png`});
   entries.push({src:`screenshots/${name}.png`,sizes:`${width}x${height}`,type:'image/png',form_factor:factor,label});
   await page.close();
  }
  const manifest=JSON.parse(fs.readFileSync('manifest.json','utf8'));
  manifest.screenshots=entries;
  fs.writeFileSync('manifest.json',JSON.stringify(manifest,null,2)+'\n');
 } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exit(1)});
