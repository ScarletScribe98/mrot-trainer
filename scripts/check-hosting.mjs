import { build, preview, createServer } from 'vite';
import { chromium } from '@playwright/test';
const browser = await chromium.launch({ channel:'msedge' });
let dev, server;
try {
 dev = await createServer({server:{host:'127.0.0.1',port:5175,strictPort:true}}); await dev.listen();
 const devPage = await browser.newPage(); await devPage.goto('http://127.0.0.1:5175'); await devPage.getByRole('heading',{level:1}).waitFor(); console.log('DEV: title renders; Preact + Vite available'); await devPage.close(); await dev.close(); dev = null;
 process.env.NODE_ENV = 'production';
 const config = {base:'/mrot-trainer/',build:{outDir:'work/base-dist',emptyOutDir:true}};
 await build(config);
 server = await preview({...config,preview:{port:4175,strictPort:true,host:'127.0.0.1'}});
 const context = await browser.newContext(); const page = await context.newPage(); const errors=[];
 const origin = 'http://127.0.0.1:4175';
 const base = origin + config.base;
 page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`)});
 await page.goto(base + '#game'); await page.getByRole('heading',{name:'Карточки работников',exact:true}).waitFor(); await page.evaluate(()=>document.fonts.ready);
 const pwa = await page.evaluate(async () => {
  const registration = await navigator.serviceWorker.ready;
  if (!navigator.serviceWorker.controller) await new Promise(resolve => navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }));
  const manifestUrl = document.querySelector('link[rel="manifest"]').href;
  const manifest = await (await fetch(manifestUrl)).json();
  const icons = await Promise.all(manifest.icons.map(async icon => {
   const response = await fetch(new URL(icon.src, manifestUrl));
   if (!response.ok || !response.headers.get('content-type')?.includes('image/png')) throw new Error('Недоступна иконка ' + response.url);
   return response.url;
  }));
  return { manifestUrl, icons, scope: registration.scope, worker: navigator.serviceWorker.controller.scriptURL,
   start: new URL(manifest.start_url, manifestUrl).href, manifestScope: new URL(manifest.scope, manifestUrl).href };
 });
 if (pwa.manifestUrl !== base + 'manifest.webmanifest' || pwa.worker !== base + 'sw.js' ||
  [pwa.start, pwa.scope, pwa.manifestScope].some(url => url !== base) ||
  !pwa.icons.includes(base + 'icon-192.png') || !pwa.icons.includes(base + 'icon-512.png')) throw new Error(JSON.stringify(pwa));
 await context.setOffline(true); await page.reload(); await page.getByRole('radio',{name:'Есть нарушение',exact:true}).waitFor();
 if(errors.length)throw new Error(errors.join('\n'));
 const method = await page.goto(base + 'method-v5.html');
 if (!method?.ok()) throw new Error('Offline method-v5.html failed');
 console.log('PAGES BASE: /mrot-trainer/ loads fonts and scripts, scoped manifest and SW, both PNG icons and offline HTML; no HTTP errors');
 await context.close();
} finally {await dev?.close();if(server)await new Promise(resolve=>server.httpServer.close(resolve));await browser.close();}
