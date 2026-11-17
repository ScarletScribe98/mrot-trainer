import { test, expect, type Page } from '@playwright/test';
const storageKey = 'inspektor-truda-v1';
const themes = ['a', 'b', 'c'] as const;
async function state(page: Page) { return page.evaluate(key => JSON.parse(localStorage.getItem(key)!), storageKey); }
function cents(text: string) { return BigInt(text.replace(/[^0-9,]/g, '').replace(',', '')); }
async function answer(page: Page) {
  const rows = await page.locator('.data-table dd').allTextContents();
  const base1 = cents(rows[0]);
  const base2 = rows[1].includes('Не установлен') ? 0n : cents(rows[1]);
  const k = BigInt(rows[2].replace(',', '')), s = BigInt(rows[3].replace(',', ''));
  const minimum = ((base1 > base2 ? base1 : base2) * (k + s) + 50n) / 100n;
  const salary = cents(await page.locator('.salary-row strong').innerText());
  const due = minimum > salary ? minimum - salary : 0n;
  await page.getByRole('radio', { name: due ? 'Есть нарушение' : 'Нарушения нет', exact: true }).check();
  if (due) await page.getByLabel('Сумма недоплаты', { exact: true }).fill(`${due/100n},${String(due%100n).padStart(2,'0')}`);
  await page.getByRole('button', { name:'Завершить проверку', exact:true }).click();
  await expect(page.locator('.stamp')).toBeVisible();
}
async function checkProjectorText(page: Page) {
  const small = await page.evaluate(() => {
    const walker = document.createTreeWalker(document.querySelector('.app-shell')!, NodeFilter.SHOW_TEXT);
    const result: { text: string; size: number }[] = [];
    let node: Node | null;
    while ((node=walker.nextNode())) {
      const parent=node.parentElement;
      if (!parent || !node.textContent?.trim() || parent.closest('svg,[aria-hidden=true],.skip-link')) continue;
      const r=parent.getBoundingClientRect(), css=getComputedStyle(parent);
      if (!r.width || !r.height || r.top>=innerHeight || r.bottom<=0 || css.visibility==='hidden' || css.display==='none') continue;
      const size=parseFloat(css.fontSize);
      if (size<14) result.push({text:node.textContent.trim(),size});
    }
    return result;
  });
  expect(small).toEqual([]);
}
async function capture(page: Page, theme: string, name: string, width: number, focus?: string) {
  await page.evaluate(() => document.fonts.ready);
  if (width===360 && focus) await page.locator(focus).scrollIntoViewIfNeeded(); else await page.evaluate(()=>scrollTo(0,0));
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  if(name==='01-title' && width===360) {
    const fits=await page.locator('.hero-folder').evaluate(folder=>folder.querySelector('.hero-folder-inner')!.scrollHeight<=folder.clientHeight);
    expect(fits).toBe(true);
  }
  const size=width===1920?'1920x1080':'360x740';
  await page.screenshot({path:`docs/screens/themes/${theme}/${name}-${size}.png`,animations:'disabled'});
  await page.screenshot({path:`docs/screens/themes/${theme}/${name}-${size}-full.png`,fullPage:true,animations:'disabled'});
  if(width===1920) await checkProjectorText(page);
}
for(const theme of themes) for(const viewport of [{width:1920,height:1080},{width:360,height:740}]) {
  test(`Тема ${theme}: снимки и пять карточек ${viewport.width}`,async({page})=>{
    await page.setViewportSize(viewport);
    const errors:string[]=[], badResponses:string[]=[];
    page.on('pageerror',error=>errors.push(error.message));
    page.on('response',response=>{if(response.status()>=400)badResponses.push(response.url())});
    await page.goto(`/?theme=${theme}#title`);
    await expect(page.locator('html')).toHaveAttribute('data-theme',theme);
    await expect(page.getByText('Архив доступен без интернета',{exact:true})).toBeVisible();
    await capture(page,theme,'01-title',viewport.width);
    await page.getByRole('button',{name:'Открыть архив дел',exact:true}).click();
    await capture(page,theme,'02-levels',viewport.width);
    await page.getByRole('button',{name:'Открыть дело',exact:true}).click();
    await expect(page.locator('.worker-portrait use')).toHaveAttribute('href',/portrait-1$/);
    await capture(page,theme,'03-question',viewport.width,'.inspection-panel');
    await answer(page);
    await expect(page.locator('.inspection-panel')).toContainText('Расчёт принят');
    await expect(page.getByText('Есть ли нарушение?',{exact:true})).toBeHidden();
    await expect(page.locator('.verdict-seal')).toHaveText('Нарушение');
    await capture(page,theme,'04-stamp',viewport.width,'.accepted');
    for(let i=1;i<5;i++){
      await page.getByRole('button',{name:'Следующая карточка',exact:true}).click();
      await answer(page);
      await expect(page.locator('.verdict-seal')).toHaveText(i%2===0?'Нарушение':'Нарушений нет');
    }
    await page.getByRole('button',{name:'Подвести итоги',exact:true}).click();
    expect((await state(page)).xp).toBe(550);
    await page.reload();
    await expect(page.getByRole('heading',{name:'Пять карточек проверены',exact:true})).toBeVisible();
    expect(errors).toEqual([]);expect(badResponses).toEqual([]);
  });
}
test('Переключатель темы не перезагружает страницу и сохраняет игровой прогресс',async({page})=>{
  await page.goto('/?theme=a#game');
  await page.getByRole('radio',{name:'Нарушения нет',exact:true}).check();
  await page.getByRole('button',{name:'Завершить проверку',exact:true}).click();
  const before=await state(page);
  await page.evaluate(()=>{(window as unknown as {__themeProbe:string}).__themeProbe='same-document'});
  await page.getByRole('button',{name:'Об игре',exact:true}).first().click();
  await expect(page.locator('.theme-choice').first()).toBeHidden();
  await page.getByText('Оформление · выбор темы',{exact:true}).click();
  for(const [name,id] of [['Зелёная лампа','b'],['Нуар-редакция','c'],['Графит','a']]){
    await page.locator('.theme-choice').filter({hasText:name}).getByRole('radio').check();
    await expect(page.locator('html')).toHaveAttribute('data-theme',id);
    expect(new URL(page.url()).searchParams.get('theme')).toBe(id);
    expect(await page.evaluate(()=>(window as unknown as {__themeProbe:string}).__themeProbe)).toBe('same-document');
    expect(await state(page)).toEqual(before);
  }
  await expect(page.locator('.portrait-catalog .worker-portrait')).toHaveCount(6);
  await page.screenshot({path:'docs/screens/themes/portraits-and-settings.png',fullPage:true,animations:'disabled'});
});
for(const theme of themes) test(`Тема ${theme}: ассеты и прохождение без сети`,async({page,context})=>{
  await page.goto(`/?theme=${theme}#title`);
  await page.evaluate(async()=>{await navigator.serviceWorker.ready;if(!navigator.serviceWorker.controller)await new Promise<void>(resolve=>navigator.serviceWorker.addEventListener('controllerchange',()=>resolve(),{once:true}));});
  await context.setOffline(true);
  await page.reload();
  await page.getByRole('button',{name:'Открыть архив дел',exact:true}).click();
  await page.getByRole('button',{name:'Открыть дело',exact:true}).click();
  for(let i=0;i<5;i++){await answer(page);await page.getByRole('button',{name:i===4?'Подвести итоги':'Следующая карточка',exact:true}).click();}
  expect((await state(page)).xp).toBe(550);
  expect(await page.locator('html').getAttribute('data-theme')).toBe(theme);
});
test('Reduced-motion отключает свет и все движения интерфейса',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/?theme=b#title');
  expect(await page.locator('.hero-light').evaluate(el=>getComputedStyle(el).animationName)).toBe('none');
  expect(await page.locator('.screen').evaluate(el=>getComputedStyle(el).animationName)).toBe('none');
});
