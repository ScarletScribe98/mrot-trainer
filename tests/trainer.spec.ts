import { test, expect, type Page } from '@playwright/test';
import { workerDue } from './payroll-helpers';
const key = 'inspektor-truda-v1';
async function stored(page: Page) { return page.evaluate(key => JSON.parse(localStorage.getItem(key)!), key); }

async function correct(page: Page) {
 const due = await workerDue(page);
 await page.getByRole('radio', { name: due > 0n ? 'Есть нарушение' : 'Нарушения нет', exact: true }).check();
 if (due > 0n) await page.getByLabel('Сумма недоплаты', { exact: true }).fill(`${due / 100n},${String(due % 100n).padStart(2, '0')}`);
 await page.getByRole('button', { name: 'Завершить проверку', exact: true }).click();
 await expect(page.locator('.stamp')).toBeVisible();
}
async function shot(page: Page, name: string, width: number, focus?: string) {
 await page.evaluate(() => document.fonts.ready);
 if (focus && width === 360) await page.locator(focus).scrollIntoViewIfNeeded(); else await page.evaluate(() => scrollTo(0, 0));
 await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
 await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
 const suffix = width === 360 ? '360x740' : '1920x1080';
 await page.screenshot({ path: `${process.env.SCREEN_ROOT || 'docs/screens'}/${name}-${suffix}.png`, animations: 'disabled' });
 await page.screenshot({ path: `${process.env.SCREEN_ROOT || 'docs/screens'}/${name}-${suffix}-full.png`, fullPage: true, animations: 'disabled' });
}
for (const viewport of [{ width: 1920, height: 1080 }, { width: 360, height: 740 }]) {
 test(`Пять карточек, подсказки, сохранение, снимки ${viewport.width}`, async ({ page }) => {
  await page.setViewportSize(viewport);
  const errors: string[] = [], external: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('request', r => { if (!r.url().startsWith('http://127.0.0.1:4173') && !r.url().startsWith('data:')) external.push(r.url()); });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Инспектор');
  await shot(page, '01-title', viewport.width);
  await page.getByRole('button', { name: 'Начать дело', exact: true }).click();
  await expect(page.locator('.level-card')).toHaveCount(5);
  await shot(page, '02-levels', viewport.width);
  await page.getByRole('button', { name: 'Открыть дело', exact: true }).click();
  await shot(page, '03-question', viewport.width, '.inspection-panel');
  await page.getByRole('radio', { name: 'Нарушения нет', exact: true }).check();
  await page.getByRole('button', { name: 'Завершить проверку', exact: true }).click();
  await expect(page.getByRole('complementary', { name: 'Подсказка', exact: true })).toBeVisible();
  await shot(page, '04-hint', viewport.width, '.hint');
  await page.reload();
  await expect(page.getByRole('complementary', { name: 'Подсказка', exact: true })).toBeVisible();
  await page.getByRole('radio', { name: 'Нарушения нет', exact: true }).check();
  await page.getByRole('button', { name: 'Завершить проверку', exact: true }).click();
  await expect(page.getByRole('complementary', { name: 'Пошаговый разбор', exact: true })).toBeVisible();
  await expect(page.locator('.hint')).not.toContainText(String((await workerDue(page)) / 100n));
  await shot(page, '05-walkthrough', viewport.width, '.hint--detailed');
  await correct(page);
  await shot(page, '06-stamp', viewport.width, '.accepted');
  await page.reload();
  await expect(page.locator('.stamp')).toBeVisible();
  expect((await stored(page)).xp).toBe(50);
  for (let i = 1; i < 5; i++) { await page.getByRole('button', { name: 'Следующая карточка', exact: true }).click(); await correct(page); }
  await page.getByRole('button', { name: 'Подвести итоги', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Пять карточек проверены', exact: true })).toBeVisible();
  expect((await stored(page)).xp).toBe(500);
  expect((await stored(page)).completed).toEqual([3]);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Пять карточек проверены', exact: true })).toBeVisible();
  await shot(page, '07-result', viewport.width);
  await page.getByRole('button', { name: 'Новое учебное дело', exact: true }).click();
  expect((await stored(page)).run.seed).not.toBe(73103);
  expect(errors).toEqual([]); expect(external).toEqual([]);
 });
}
test('Чистое прохождение: 550 опыта, звук, музыка и сброс', async ({ page }) => {
 await page.goto('/#game');
 for (let i=0;i<5;i++) { await correct(page); await page.getByRole('button', { name: i===4 ? 'Подвести итоги' : 'Следующая карточка', exact:true }).click(); }
 expect((await stored(page)).xp).toBe(550);
 await page.locator('.sidebar').getByRole('button', { name:'Звуки: включены' }).click();
 await page.locator('.sidebar').getByRole('button', { name:'Музыка: выключена' }).click();
 await page.reload(); expect((await stored(page)).sound).toBe(false); expect((await stored(page)).music).toBe(true);
 await page.getByRole('button', { name:'Об игре', exact:true }).first().click();
 await page.getByRole('button', { name:'Начать заново', exact:true }).click();
 await page.getByRole('dialog').getByRole('button', { name:'Начать заново', exact:true }).click();
 expect((await stored(page)).xp).toBe(0); expect((await stored(page)).music).toBe(false);
});
test('PWA: холодное открытие без сети и прохождение пяти карточек', async ({ page, context }) => {
 await page.goto('/');
 await page.evaluate(async () => { await navigator.serviceWorker.ready; if (!navigator.serviceWorker.controller) await new Promise<void>(resolve => navigator.serviceWorker.addEventListener('controllerchange',()=>resolve(),{once:true})); });
 await expect(page.getByText('Архив доступен без интернета', { exact:true })).toBeVisible();
 await context.setOffline(true);
 await page.reload();
 await page.getByRole('button', { name:'Начать дело', exact:true }).click();
 await page.getByRole('button', { name:'Открыть дело', exact:true }).click();
 for (let i=0;i<5;i++) { await correct(page); await page.getByRole('button',{name:i===4?'Подвести итоги':'Следующая карточка',exact:true}).click(); }
 expect((await stored(page)).xp).toBe(550);
 await page.reload(); await expect(page.getByRole('heading',{name:'Пять карточек проверены',exact:true})).toBeVisible();
});
test('Повреждённое и недоступное хранилище', async ({ page }) => {
 await page.addInitScript(key => localStorage.setItem(key, '{broken'), key);
 await page.goto('/#game'); await expect(page.locator('.worker-heading h2')).toHaveText('Вера Соколова');
 await page.evaluate(() => { Storage.prototype.setItem = () => { throw new Error('Storage unavailable'); }; });
 await page.getByRole('button', { name: 'Нужна подсказка?', exact:false }).click();
 await expect(page.getByRole('alert')).toContainText('не сохранится');
 await correct(page); await expect(page.locator('.stamp')).toBeVisible();
});

test('Ввод не округляет ответ молча; самостоятельное исправление даёт 70', async ({ page }) => {
 await page.goto('/#game');
 await page.getByRole('button',{name:'Завершить проверку',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('Сначала выберите');
 await page.getByRole('radio',{name:'Есть нарушение',exact:true}).check();
 for(const invalid of ['1,001','-1']) {
  await page.getByLabel('Сумма недоплаты',{exact:true}).fill(invalid);
  await page.getByRole('button',{name:'Завершить проверку',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('Введите сумму');
  expect((await stored(page)).run.cards[0].attempts).toBe(0);
 }
 await page.getByLabel('Сумма недоплаты',{exact:true}).fill('0');
 await page.getByRole('button',{name:'Завершить проверку',exact:true}).click();
 await correct(page); expect((await stored(page)).xp).toBe(70);
});
