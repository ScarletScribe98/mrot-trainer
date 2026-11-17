import lighthouse from 'lighthouse';
import { launch } from 'chrome-launcher';
import { preview } from 'vite';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const chromePath = `${process.env['PROGRAMFILES(X86)']}\\Microsoft\\Edge\\Application\\msedge.exe`;
const profile = `work/lighthouse-${Date.now()}`;
mkdirSync(profile, { recursive:true });
const server = await preview({ preview: { port:4174, strictPort:true, host:'127.0.0.1' } });
const chrome = await launch({ chromePath, userDataDir:resolve(profile), chromeFlags:['--headless=new','--no-first-run','--disable-extensions'] });
try {
 for (const [name, hash] of [['title',''], ['level3','#game']]) {
  const result = await lighthouse(`http://127.0.0.1:4174/${hash}`, { port:chrome.port, output:['html','json'], onlyCategories:['performance','accessibility'], formFactor:'mobile', screenEmulation:{mobile:true,width:360,height:740,deviceScaleFactor:1,disabled:false}, logLevel:'error' });
  writeFileSync(`docs/verification/lighthouse-${name}.html`,result.report[0]);
  writeFileSync(`docs/verification/lighthouse-${name}.json`,result.report[1]);
  console.log(`${name}: Performance ${Math.round(result.lhr.categories.performance.score*100)}, Accessibility ${Math.round(result.lhr.categories.accessibility.score*100)}`);
  const failed = Object.values(result.lhr.audits).filter(a=>a.score !== null && a.score<1 && a.details?.items?.length && ['color-contrast','label','button-name','tap-targets'].includes(a.id));
  console.log(JSON.stringify(failed,null,2));
 }
} finally { await chrome.kill(); await new Promise(resolve=>server.httpServer.close(resolve)); }
