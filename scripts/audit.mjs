import lighthouse from 'lighthouse';
import { launch } from 'chrome-launcher';
import { preview } from 'vite';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const chromePath = `${process.env['PROGRAMFILES(X86)']}\\Microsoft\\Edge\\Application\\msedge.exe`;
const profile = `work/lighthouse-scene-${Date.now()}`;
const directory = process.env.AUDIT_OUTPUT_DIR || 'work/etap1/lighthouse';
const scores=[];
mkdirSync(profile, { recursive:true });
mkdirSync(directory, { recursive:true });
const server = await preview({ preview: { port:4174, strictPort:true, host:'127.0.0.1' } });
const chrome = await launch({ chromePath, userDataDir:resolve(profile), chromeFlags:['--headless=new','--no-first-run','--disable-extensions'] });
try {
 for (const [name, hash] of [['title','#title'], ['levels','#levels'], ['level3','#game'], ['level4','#audit']]) {
  const result = await lighthouse(`http://127.0.0.1:4174/${hash}`, { port:chrome.port, output:['html','json'], onlyCategories:['performance','accessibility'], formFactor:'mobile', screenEmulation:{mobile:true,width:360,height:740,deviceScaleFactor:1,disabled:false}, logLevel:'error' });
  writeFileSync(`${directory}/lighthouse-${name}.html`,result.report[0]);
  writeFileSync(`${directory}/lighthouse-${name}.json`,result.report[1]);
  console.log(`${name}: Performance ${Math.round(result.lhr.categories.performance.score*100)}, Accessibility ${Math.round(result.lhr.categories.accessibility.score*100)}`);
  const refs=new Set(result.lhr.categories.accessibility.auditRefs.map(ref=>ref.id));
  const failed = Object.values(result.lhr.audits).filter(a=>refs.has(a.id) && a.score !== null && a.score<1 && a.details?.items?.length);
  scores.push({screen:name,performance:Math.round(result.lhr.categories.performance.score*100),accessibility:Math.round(result.lhr.categories.accessibility.score*100),failed:failed.map(a=>a.id)});
  console.log(JSON.stringify(failed,null,2));
 }
 writeFileSync(`${directory}/lighthouse-scores.json`,JSON.stringify(scores,null,2)+'\n');
 if(scores.some(s=>s.performance<85||s.accessibility<90))process.exitCode=1;
} finally { await chrome.kill(); await new Promise(resolve=>server.httpServer.close(resolve)); }
