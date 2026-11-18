import lighthouse from 'lighthouse';
import { launch } from 'chrome-launcher';
import { preview } from 'vite';
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const chromePath = `${process.env['PROGRAMFILES(X86)']}\\Microsoft\\Edge\\Application\\msedge.exe`;
const profile = `work/lighthouse-scene-${Date.now()}`;
const directory = process.env.AUDIT_OUTPUT_DIR || 'work/etap2/lighthouse';
const scores=[];
async function seedFinal(context, hash) {
 const page = await context.newPage();
 const origin = 'http://127.0.0.1:4174';
 try {
  await page.goto(origin + '/#levels');
  await page.locator('.levels-screen').waitFor();
  await page.evaluate(signed => {
   const key = 'inspektor-truda-v1';
   const progress = JSON.parse(localStorage.getItem(key));
   progress.completed = signed ? [3, 4, 5] : [3, 4];
   progress.xp = signed ? 1350 : 1100;
   progress.allLevelsBonusAwarded = signed;
   if (signed) {
    const now = new Date();
    const date = [now.getFullYear(), now.getMonth() + 1, now.getDate()].map(n => String(n).padStart(2, '0')).join('-');
    progress.final.act = { date, xp: 1350, reward: 100, bonus: 150, cleanCases: 11 };
    progress.final.draft.name = 'Александра Рябова';
   }
   localStorage.setItem(key, JSON.stringify(progress));
  }, hash === '#act');
  await page.goto(origin + '/icon.svg');
  await page.goto(origin + '/' + hash);
  await page.locator(hash === '#act' ? '.act-paper' : '.final-paper').waitFor();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Storage.clearDataForOrigin', { origin, storageTypes: 'service_workers,cache_storage' });
  await cdp.send('Network.clearBrowserCache');
 } finally { await page.close(); }
}
mkdirSync(profile, { recursive:true });
mkdirSync(directory, { recursive:true });
const server = await preview({ preview: { port:4174, strictPort:true, host:'127.0.0.1' } });
const chrome = await launch({ chromePath, userDataDir:resolve(profile), chromeFlags:['--headless=new','--no-first-run','--disable-extensions'] });
try {
 const browser = await chromium.connectOverCDP('http://127.0.0.1:' + chrome.port);
 for (const [name, hash] of [['title','#title'], ['levels','#levels'], ['level3','#game'], ['level4','#audit'], ['final','#final'], ['act','#act']]) {
  const seeded = hash === '#final' || hash === '#act';
  if (seeded) await seedFinal(browser.contexts()[0], hash);
  const result = await lighthouse(`http://127.0.0.1:4174/${hash}`, { port:chrome.port, output:['html','json'], onlyCategories:['performance','accessibility'], disableStorageReset: seeded, formFactor:'mobile', screenEmulation:{mobile:true,width:360,height:740,deviceScaleFactor:1,disabled:false}, logLevel:'error' });
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
