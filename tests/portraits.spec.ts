import { test, expect } from '@playwright/test';
const root='docs/screens/etap0_6_1';
for(const viewport of [{width:1920,height:1080},{width:360,height:740}]) {
 test(`Растровая серия: титул и карточка ${viewport.width}`,async({page})=>{
  await page.setViewportSize(viewport);
  const failed:string[]=[];
  page.on('pageerror',e=>failed.push(e.message));
  page.on('response',r=>{if(r.status()>=400)failed.push(r.url());});
  for(const [name,hash] of [['01-title','title'],['02-level3','game']]) {
   await page.goto(`/#${hash}`);
   await page.evaluate(()=>Promise.all([document.fonts.ready,...Array.from(document.images).map(img=>img.decode())]));
   await expect(page.locator('.worker-portrait img')).toHaveCount(1);
   await expect(page.locator('.worker-portrait svg')).toHaveCount(0);
   expect(await page.locator('.worker-portrait img').evaluate((el)=>{
    const img=el as HTMLImageElement;
    return img.naturalWidth>=img.clientWidth*2&&img.naturalHeight>=img.clientHeight*2&&getComputedStyle(img).objectFit==='cover';
   })).toBe(true);
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
   const size=`${viewport.width}x${viewport.height}`;
   await page.screenshot({path:`${root}/${name}-${size}.png`,animations:'disabled'});
   await page.screenshot({path:`${root}/${name}-${size}-full.png`,fullPage:true,animations:'disabled'});
  }
  expect(failed).toEqual([]);
 });
}
test('Шесть WebP-портретов: декодирование, разрешение 2x и офлайн-каталог',async({page,context})=>{
 await page.goto('/#about');
 await page.evaluate(async()=>{await navigator.serviceWorker.ready;if(!navigator.serviceWorker.controller)await new Promise<void>(resolve=>navigator.serviceWorker.addEventListener('controllerchange',()=>resolve(),{once:true}));});
 await context.setOffline(true);
 await page.reload();
 const images=page.locator('.portrait-catalog img');
 await expect(images).toHaveCount(6);
 await images.evaluateAll(imgs=>Promise.all(imgs.map(img=>(img as HTMLImageElement).decode())));
 const urls=await images.evaluateAll(imgs=>imgs.map(img=>(img as HTMLImageElement).src));
 expect(new Set(urls).size).toBe(6);
 expect(urls.every(url=>/\/assets\/portraits\/portrait-[1-6]\.webp$/.test(url))).toBe(true);
 for(const width of [1920,360]){
  await page.setViewportSize({width,height:width===1920?1080:740});
  const sizes=await images.evaluateAll(imgs=>imgs.map(el=>{
   const img=el as HTMLImageElement;
   return {width:img.naturalWidth,height:img.naturalHeight,renderWidth:img.clientWidth,renderHeight:img.clientHeight};
  }));
  for(const image of sizes){expect(image.width).toBe(320);expect(image.height).toBe(400);expect(image.width).toBeGreaterThanOrEqual(image.renderWidth*2);expect(image.height).toBeGreaterThanOrEqual(image.renderHeight*2);}
 }
});
