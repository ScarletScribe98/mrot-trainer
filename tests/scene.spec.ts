import { test, expect, type Page } from '@playwright/test';
import { captureV5, workerDue } from './payroll-helpers';
const key='inspektor-truda-v1';
const screenRoot=process.env.SCENE_SCREEN_ROOT || 'work/etap0_6_1-regression-screens';
async function saved(page:Page){return page.evaluate(key=>JSON.parse(localStorage.getItem(key)!),key);}

async function correct(page:Page){
 const due=await workerDue(page);
 await page.getByRole('radio',{name:due?'Есть нарушение':'Нарушения нет',exact:true}).check();
 if(due)await page.getByLabel('Сумма недоплаты',{exact:true}).fill(`${due/100n},${String(due%100n).padStart(2,'0')}`);
 await page.getByRole('button',{name:'Завершить проверку',exact:true}).click();
 await expect(page.locator('.stamp')).toBeVisible();
}
async function projector(page:Page){
 const tiny=await page.evaluate(()=>{
  const walker=document.createTreeWalker(document.querySelector('.app-shell')!,NodeFilter.SHOW_TEXT),result:{text:string;size:number}[]=[];
  let n:Node|null;
  while((n=walker.nextNode())){
   const p=n.parentElement;if(!p||!n.textContent?.trim()||p.closest('svg,[aria-hidden=true],.skip-link'))continue;
   const r=p.getBoundingClientRect(),s=getComputedStyle(p);
   if(!r.width||!r.height||r.bottom<0||r.top>=innerHeight||s.visibility==='hidden'||s.display==='none')continue;
   if(parseFloat(s.fontSize)<14)result.push({text:n.textContent.trim(),size:parseFloat(s.fontSize)});
  }return result;
 });expect(tiny).toEqual([]);
}
async function capture(page:Page,name:string,width:number,focus?:string){
 await page.evaluate(()=>Promise.all([document.fonts.ready,...Array.from(document.images).map(img=>img.decode())]));
 if(width===360&&focus)await page.locator(focus).scrollIntoViewIfNeeded();else await page.evaluate(()=>scrollTo(0,0));
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 const size=width===1920?'1920x1080':'360x740';
 await page.screenshot({path:`${screenRoot}/${name}-${size}.png`,animations:'disabled'});
 await page.screenshot({path:`${screenRoot}/${name}-${size}-full.png`,fullPage:true,animations:'disabled'});
 if(width===1920)await projector(page);
}
for(const viewport of [{width:1920,height:1080},{width:360,height:740}])test(`Кабинет: пять состояний и прохождение ${viewport.width}`,async({page})=>{
 await page.setViewportSize(viewport);
 const errors:string[]=[],external:string[]=[],failed:string[]=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('request',r=>{if(!r.url().startsWith('http://127.0.0.1:4173')&&!r.url().startsWith('data:'))external.push(r.url());});
 page.on('response',r=>{if(r.status()>=400)failed.push(r.url());});
 await page.goto('/#title');
 await expect(page.getByText('Архив доступен без интернета',{exact:true})).toBeVisible();
 await capture(page,'01-title',viewport.width);
 await page.getByRole('button',{name:'Начать дело',exact:true}).click();
 await capture(page,'02-levels',viewport.width);
 await expect(page.locator('.level-art')).toHaveCount(5);
 await page.getByRole('button',{name:'Открыть дело',exact:true}).click();
 await capture(page,'03-question',viewport.width,'.inspection-panel');
 await expect(page.locator('.data-table dd').nth(4)).toHaveText('0,5');
 await expect(page.locator('.pay-line[data-kind=night]')).toContainText('Сверх минимума');
 await captureV5(page, '01-card-q-w', viewport.width === 360 ? '.data-table' : '.document-stage', true);
 await page.getByRole('radio',{name:'Нарушения нет',exact:true}).check();
 await page.getByRole('button',{name:'Завершить проверку',exact:true}).click();
 await expect(page.getByRole('complementary',{name:'Подсказка',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Завершить проверку',exact:true}).click();
 await expect(page.getByRole('complementary',{name:'Пошаговый разбор',exact:true})).toBeVisible();
 await capture(page,'05-walkthrough',viewport.width,'.hint--detailed');
 await correct(page);await capture(page,'04-stamp',viewport.width,'.accepted');
 await expect(page.getByText('Есть ли нарушение?',{exact:true})).toBeHidden();
 await page.reload();expect((await saved(page)).xp).toBe(50);
 for(let i=1;i<5;i++){await page.getByRole('button',{name:'Следующая карточка',exact:true}).click();await correct(page);}
 await page.getByRole('button',{name:'Подвести итоги',exact:true}).click();
 expect((await saved(page)).xp).toBe(500);expect((await saved(page)).completed).toEqual([3]);
 expect(errors).toEqual([]);expect(external).toEqual([]);expect(failed).toEqual([]);
});
test('Единственное оформление: старые параметры не выбирают темы',async({page})=>{
 for(const old of ['a','b','c']){
  await page.goto(`/?theme=${old}&case=demo#about`);
  expect(new URL(page.url()).searchParams.has('theme')).toBe(false);
  expect(new URL(page.url()).searchParams.get('case')).toBe('demo');
  expect(await page.locator('html').getAttribute('data-theme')).toBeNull();
  await expect(page.locator('.theme-lab')).toHaveCount(0);
  expect(await page.locator('html').evaluate(el=>getComputedStyle(el).getPropertyValue('--bg').trim())).toBe('#081511');
 }
 await expect(page.locator('.portrait-catalog .worker-portrait')).toHaveCount(6);
 const ids=await page.locator('.portrait-catalog img').evaluateAll(nodes=>nodes.map(el=>el.getAttribute('src')));
 expect(new Set(ids).size).toBe(6);
 await page.locator('.portrait-catalog').screenshot({path:`${screenRoot}/06-portraits.png`});
});
test('Офлайн: новые слои в кеше, пять карточек и результат после перезапуска',async({page,context})=>{
 await page.goto('/');
 await page.evaluate(async()=>{await navigator.serviceWorker.ready;if(!navigator.serviceWorker.controller)await new Promise<void>(resolve=>navigator.serviceWorker.addEventListener('controllerchange',()=>resolve(),{once:true}));});
 const cache=await page.evaluate(async()=>{const names=await caches.keys();return(await Promise.all(names.map(async name=>(await(await caches.open(name)).keys()).map(r=>new URL(r.url).pathname)))).flat();});
 for(const file of [...Array.from({length:6},(_,i)=>`portraits/portrait-${i+1}.webp`),'scene-room.svg','scene-desk.svg','scene-lamp.svg','scene-light.svg','scene-props.svg','open-case.svg','paper-fibres.svg','archive.svg'])expect(cache).toContain(`/assets/${file}`);
 await context.setOffline(true);await page.reload();
 await page.locator('.worker-portrait img').evaluateAll(imgs=>Promise.all(imgs.map(img=>(img as HTMLImageElement).decode())));
 expect(await page.locator('.worker-portrait img').evaluateAll(imgs=>imgs.every(img=>(img as HTMLImageElement).naturalWidth===320))).toBe(true);
 expect(await page.locator('.office-scene img').evaluateAll(imgs=>imgs.every(img=>(img as HTMLImageElement).complete&&(img as HTMLImageElement).naturalWidth>0))).toBe(true);
 await page.getByRole('button',{name:'Начать дело',exact:true}).click();await page.getByRole('button',{name:'Открыть дело',exact:true}).click();
 for(let i=0;i<5;i++){await correct(page);await page.getByRole('button',{name:i===4?'Подвести итоги':'Следующая карточка',exact:true}).click();}
 expect((await saved(page)).xp).toBe(550);await page.reload();await expect(page.getByRole('heading',{name:'Пять карточек проверены',exact:true})).toBeVisible();
});
test('Движение: максимум 6,81 px, документы неподвижны; reduced-motion статичен',async({page})=>{
 await page.setViewportSize({width:1920,height:1080});await page.emulateMedia({reducedMotion:'no-preference'});await page.goto('/#game');
 await expect(page.locator('.office-scene')).toHaveAttribute('data-motion','on');
 await page.locator('.screen').evaluate(async el=>{await Promise.all(el.getAnimations({subtree:true}).map(a=>a.finished.catch(()=>{})));});
 const before=await page.locator('.document').boundingBox();
 await page.mouse.move(1910,1060);
 await expect.poll(()=>page.locator('.office-scene').evaluate(el=>parseFloat((el as HTMLElement).style.getPropertyValue('--scene-x')))).toBeGreaterThan(1);
 const offset=await page.locator('.office-scene').evaluate(el=>Math.hypot(parseFloat((el as HTMLElement).style.getPropertyValue('--scene-x')),parseFloat((el as HTMLElement).style.getPropertyValue('--scene-y'))));
 expect(offset).toBeLessThanOrEqual(6.81);
 expect(await page.locator('.document').boundingBox()).toEqual(before);
 const animated=await page.locator('.office-scene').evaluate(el=>el.getAnimations({subtree:true}).flatMap(a=>(a.effect as KeyframeEffect).getKeyframes().flatMap(k=>Object.keys(k).filter(key=>!['offset','computedOffset','easing','composite'].includes(key)))));
 expect(animated.every(key=>key==='opacity'||key==='transform')).toBe(true);
 await page.emulateMedia({reducedMotion:'reduce'});await expect(page.locator('.office-scene')).toHaveAttribute('data-motion','off');
 for(const selector of ['.scene-light','.scene-dust i','.scene-lamp']){
  const style=await page.locator(selector).first().evaluate(el=>({animation:getComputedStyle(el).animationName,transform:getComputedStyle(el).transform}));
  expect(style.animation).toBe('none');expect(style.transform).toBe('none');
 }
 await page.mouse.move(1,1);expect(await page.locator('.office-scene').evaluate(el=>(el as HTMLElement).style.getPropertyValue('--scene-x'))).toBe('0.00px');
});
