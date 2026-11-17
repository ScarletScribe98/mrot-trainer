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
 page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`)});
 await page.goto('http://127.0.0.1:4175/mrot-trainer/#game'); await page.getByRole('heading',{name:'Карточки работников',exact:true}).waitFor(); await page.evaluate(()=>document.fonts.ready);
 await page.evaluate(async()=>{await navigator.serviceWorker.ready;if(!navigator.serviceWorker.controller)await new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true}));});
 await context.setOffline(true); await page.reload(); await page.getByRole('radio',{name:'Есть нарушение',exact:true}).waitFor();
 if(errors.length)throw new Error(errors.join('\n'));
 console.log('PAGES BASE: /mrot-trainer/ loads fonts, scripts and PWA; offline reload passes; no HTTP errors');
 await context.close();
} finally {await dev?.close();if(server)await new Promise(resolve=>server.httpServer.close(resolve));await browser.close();}
