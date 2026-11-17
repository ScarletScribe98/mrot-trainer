import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
const root='docs/screens/themes';
const themes=[['a','Графит','Холодная бумага · графит · винный штамп'],['b','Зелёная лампа','Бутылочный зелёный · сукно · мягкий свет'],['c','Нуар-редакция','Тёплый серый · контрастный набор · зерно']];
const style=`*{box-sizing:border-box}body{margin:0;background:#111315;color:#eee;font-family:Arial,sans-serif;padding:28px}.top{display:flex;justify-content:space-between;align-items:center;margin:0 0 24px}h1{margin:0;font-size:32px;font-weight:400}.top p{color:#bec2c3;font-size:18px;margin:0}.grid{display:grid;grid-template-columns:repeat(3,1280px);gap:24px}.theme{border:1px solid #4c5256;background:#191c1f}.caption{padding:20px 24px;display:flex;align-items:center;gap:20px;min-height:85px}.letter{font:30px Georgia,serif;border:1px solid #697277;width:46px;height:46px;text-align:center;line-height:44px}.name{font:28px Georgia,serif}.description{font-size:17px;color:#bec2c3;margin-top:5px}img{display:block;width:1280px;height:720px}.bottom{display:flex;justify-content:space-between;margin:22px 0 0;color:#bec2c3;font-size:18px}`;
function content(embed){return `<!doctype html><html lang="ru"><meta charset="utf-8"><style>${style}</style><body><div class="top"><h1>Инспектор труда · три темы оформления</h1><p>Этап 0.5 / один экран, одинаковые учебные данные</p></div><div class="grid">${themes.map(([id,name,description])=>{const src=embed?`data:image/png;base64,${readFileSync(`${root}/${id}/03-question-1920x1080.png`).toString('base64')}`:`${id}/03-question-1920x1080.png`;return `<section class="theme"><div class="caption"><div class="letter">${id.toUpperCase()}</div><div><div class="name">${name}</div><div class="description">${description}</div></div></div><img src="${src}" alt="Тема ${name}: карточка работника"></section>`}).join('')}</div><div class="bottom"><span>Палитра, свет, фактура и типографические акценты меняются. Механика общая.</span><span>Полные снимки: 1920×1080 / 360×740</span></div></body></html>`;}
writeFileSync(`${root}/compare.html`,content(false));
const browser=await chromium.launch({channel:'msedge'});
try {
 const page=await browser.newPage({viewport:{width:3944,height:950},deviceScaleFactor:1});
 await page.setContent(content(true));
 await page.evaluate(()=>Promise.all(Array.from(document.images).map(img=>img.decode())));
 await page.screenshot({path:`${root}/compare.png`,fullPage:true});
 console.log('Created compare.png: three original 1920×1080 screenshots side by side (scaled to 1280×720 each)');
 const stats=await page.evaluate(()=>Array.from(document.images).map(img=>{const canvas=document.createElement('canvas');canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0);const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;let yellow=0,red=0;for(let i=0;i<pixels.length;i+=4){const[r,g,b]=[pixels[i],pixels[i+1],pixels[i+2]];if(r>110&&g>90&&r/b>1.25&&g/b>1.2&&Math.abs(r-g)<55)yellow++;if(r>90&&r>g*1.35&&r>b*1.2)red++;}return{theme:img.alt,yellowOchrePercent:Number((yellow/(canvas.width*canvas.height)*100).toFixed(3)),wineRedPercent:Number((red/(canvas.width*canvas.height)*100).toFixed(3))}}));
 writeFileSync('docs/verification/etap0_5/accent-pixel-check.json',JSON.stringify(stats,null,2)+'\n');
 console.log(JSON.stringify(stats,null,2));
} finally {await browser.close();}
