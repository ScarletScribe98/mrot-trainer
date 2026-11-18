import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { formatAmount } from '../src/calc';
import { initialProgress, STORAGE_KEY, type Progress } from '../src/game';

const shots = process.env.FINAL_SCREEN_ROOT;
const viewports = [{ width: 1920, height: 1080 }, { width: 360, height: 740 }];

function cents(text: string) {
  const [whole, fraction] = text.split(',').map(part => Number(part.replace(/\D/g, '')));
  return whole * 100 + (fraction ?? 0);
}

async function prepare(page: Page, completed: number[] = [3, 4]) {
  const progress = initialProgress();
  progress.completed = completed;
  progress.sound = false;
  for (const [level, state] of [[3, progress.run], [4, progress.audit]] as const) {
    if (!completed.includes(level)) continue;
    state.completed = true;
    state.index = 4;
    state.earned = 550;
    for (const [i, card] of state.cards.entries()) {
      Object.assign(card, { answered: true, reward: i === 2 ? 150 : 100 });
      if ('step' in card) card.step = 'correction';
    }
    progress.xp += state.earned;
  }
  await page.addInitScript(({ key, value }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, value);
  }, { key: STORAGE_KEY, value: JSON.stringify(progress) });
}
async function saved(page: Page): Promise<Progress> {
  return page.evaluate(key => JSON.parse(localStorage.getItem(key)!), STORAGE_KEY);
}

async function readWorksheet(page: Page) {
  const [mrot, regional] = (await page.locator('.final-base .money').allTextContents()).map(cents);
  const k = Number((await page.locator('.final-organization strong').innerText()).replace(',', ''));
  const salaries = (await page.locator('.final-salary .money').allTextContents()).map(cents);
  const allowances = await page.locator('.final-allowance span:last-child').allTextContents();
  for (const value of allowances) expect(value).toMatch(/^\d+ % \(0,\d{2}\)$/u);
  const rows = salaries.map((salary, i) => Math.max(0, Math.round(Math.max(mrot, regional) * (k + Number(allowances[i].split(' %')[0])) / 100) - salary));
  expect(rows.some(due => due > 0)).toBe(true);
  expect(rows.some(due => due === 0)).toBe(true);
  return { base: mrot > regional ? '#final-base' : '#final-base-regional', wrongBase: mrot > regional ? '#final-base-regional' : '#final-base',
    rows, total: rows.reduce((sum, due) => sum + due, 0) };
}

async function fillWorksheet(page: Page, answer: Awaited<ReturnType<typeof readWorksheet>>) {
  await page.locator(answer.base).check();
  for (const [i, due] of answer.rows.entries()) {
    await page.locator('#final-row-' + i + '-verdict').selectOption(due > 0 ? 'yes' : 'no');
    if (due) await page.locator('#final-row-' + i + '-amount').fill('₽ ' + formatAmount(due));
    else await expect(page.locator('#final-row-' + i + '-amount')).toBeDisabled();
  }
  await page.getByLabel('Общая сумма недоплаты', { exact: true }).fill(formatAmount(answer.total) + ' ₽');
  await page.getByLabel('Общий вывод', { exact: true }).selectOption('yes');
}

async function capture(page: Page, state: string, selector: string, mobileFull = false) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
  if (!shots) return;
  mkdirSync(shots, { recursive: true });
  await page.evaluate(() => Promise.all([document.fonts.ready, ...Array.from(document.images).map(image => image.decode())]));
  await page.evaluate(target => {
    const top = document.querySelector(target)!.getBoundingClientRect().top + scrollY;
    scrollTo(0, Math.max(0, top - 14));
  }, selector);
  const { width, height } = page.viewportSize()!;
  const file = shots + '/' + state + '-' + width + 'x' + height;
  await page.screenshot({ path: file + '.png', animations: 'disabled' });
  if (mobileFull && width === 360) await page.screenshot({ path: file + '-full.png', fullPage: true, animations: 'disabled' });
}

for (const viewport of viewports) {
  test('Финал с первой попытки, акт, PNG, A4 и перезагрузка офлайн · ' + viewport.width, async ({ page, context }) => {
    await page.setViewportSize(viewport);
    const external: string[] = [], errors: string[] = [];
    page.on('request', request => { if (!request.url().startsWith('http://127.0.0.1:4173/')) external.push(request.url()); });
    page.on('pageerror', error => errors.push(error.message));
    await prepare(page);
    await page.goto('/#levels');
    await expect(page.getByText('Архив доступен без интернета', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Открыть дело № 001' }).click();
    await context.setOffline(true);
    await page.reload();
    await expect(page.locator('.final-worker')).toHaveCount(4);
    expect(await page.locator('.final-worker').first().evaluate(element => getComputedStyle(element).display))
      .toBe(viewport.width === 360 ? 'grid' : 'table-row');
    expect(await page.locator('.final-worker :is(input,select)').evaluateAll(fields => fields.every(field => {
      const box = field.getBoundingClientRect();
      return box.height >= 44 && box.width >= 96;
    }))).toBe(true);
    await capture(page, '01-payroll', viewport.width === 360 ? '.final-paper' : '.final-screen', true);
    const answer = await readWorksheet(page);
    await fillWorksheet(page, answer);
    const name = 'Александра Рябова';
    await page.getByLabel('Имя проверяющего').fill(name);
    await page.reload();
    await expect(page.getByLabel('Имя проверяющего')).toHaveValue(name);
    await expect(page.getByLabel('Общая сумма недоплаты', { exact: true })).toHaveValue(formatAmount(answer.total) + ' ₽');

    if (shots) {
      await page.clock.install();
      await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      await page.getByRole('button', { name: 'Подписать акт' }).click({ force: true });
      await expect(page.getByRole('button', { name: 'Акт подписан' })).toBeVisible();
      await expect(page.locator('.final-sign')).toHaveClass(/final-sign--press/);
      await capture(page, '04-signing', '.final-sign');
      await page.clock.resume();
      await page.emulateMedia({ reducedMotion: 'reduce' });
    } else await page.getByRole('button', { name: 'Подписать акт' }).click();

    await expect(page.getByRole('heading', { name: 'Акт проверки № 001' })).toBeVisible();
    await expect(page.getByText(name, { exact: true })).toBeVisible();
    await expect(page.locator('.act-paper time')).toHaveText(await page.evaluate(() => new Date().toLocaleDateString('ru-RU')));
    await expect(page.locator('.act-total')).toContainText(formatAmount(answer.total));
    await expect(page.locator('.act-summary')).toContainText('+150 XP');
    await expect(page.locator('.act-summary')).toContainText('+100 XP');
    expect((await saved(page)).xp).toBe(1350);
    expect((await saved(page)).final.act?.cleanCases).toBe(11);
    await capture(page, '05-act', '.act-screen', true);

    const downloading = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Сохранить как изображение' }).click();
    const download = await downloading;
    expect(download.suggestedFilename()).toBe('akt-proverki-001.png');
    const png = readFileSync((await download.path())!);
    expect(png.length).toBeGreaterThan(10000);
    expect(png.subarray(1, 4).toString()).toBe('PNG');
    expect(png.readUInt32BE(16)).toBe(1600);
    if (shots && viewport.width === 360) await download.saveAs(shots + '/act-export.png');

    await page.evaluate(() => { window.print = () => { document.body.dataset.printRequested = 'yes'; }; });
    await page.getByRole('button', { name: 'Распечатать' }).click();
    await expect(page.locator('body')).toHaveAttribute('data-print-requested', 'yes');
    await page.emulateMedia({ media: 'print' });
    await expect(page.locator('.topbar')).toBeHidden();
    await expect(page.locator('.office-scene')).toBeHidden();
    await expect(page.locator('.act-toolbar')).toBeHidden();
    await expect(page.locator('.act-paper')).toBeVisible();
    expect(await page.locator('.act-table tbody tr').first().evaluate(row => getComputedStyle(row).display)).toBe('table-row');
    const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: false });
    const printable = pdf.toString('latin1');
    expect([...printable.matchAll(/\/Type\s*\/Page\b/g)]).toHaveLength(1);
    const [, w, h] = /\/MediaBox\s*\[0\s+0\s+([\d.]+)\s+([\d.]+)\]/.exec(printable)!;
    expect(Number(w)).toBeGreaterThan(594);
    expect(Number(w)).toBeLessThan(597);
    expect(Number(h)).toBeGreaterThan(840);
    expect(Number(h)).toBeLessThan(844);
    if (shots && viewport.width === 1920) writeFileSync(shots + '/act-print-a4.pdf', pdf);
    await page.emulateMedia({ media: 'screen' });
    await page.reload();
    await expect(page.getByText(name, { exact: true })).toBeVisible();
    expect((await saved(page)).xp).toBe(1350);
    await page.goBack();
    await expect(page.getByRole('button', { name: 'Открыть акт проверки' })).toBeVisible();
    expect(external).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('Финальная ведомость: подсветка базы, разбор строки и +50 XP · ' + viewport.width, async ({ page }) => {
    await page.setViewportSize(viewport);
    await prepare(page);
    await page.goto('/#final');
    const answer = await readWorksheet(page);
    await page.locator(answer.wrongBase).check();
    await page.getByRole('button', { name: 'Подписать акт' }).click();
    await expect(page.locator('.final-base [aria-invalid=true]')).toHaveCount(2);
    await expect(page.locator('.final-table [aria-invalid=true], .final-totals [aria-invalid=true]')).toHaveCount(0);
    await expect(page.locator('.final-review')).toHaveCount(0);
    await capture(page, '02-error', viewport.width === 360 ? '.final-base' : '.final-paper');
    await page.reload();
    await expect(page.getByText('Проверьте общую базу.')).toBeVisible();
    await fillWorksheet(page, answer);
    const owes = answer.rows.findIndex(due => due > 0);
    const amount = page.locator('#final-row-' + owes + '-amount');
    await amount.fill('0,01');
    await page.getByRole('button', { name: 'Подписать акт' }).click();
    await expect(amount).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('.final-table [aria-invalid=true]')).toHaveCount(1);
    const review = page.locator('.final-review-row details');
    await expect(review.getByText('Верно', { exact: true })).toBeHidden();
    await review.locator('summary').click();
    await expect(review.getByText('Верно', { exact: true })).toBeVisible();
    await expect(review.getByText('В ведомости', { exact: true })).toBeVisible();
    await expect(review.getByRole('link', { name: 'Повторить: раздел о применимом минимуме' })).toHaveAttribute('aria-disabled', 'true');
    await expect(page.locator('body')).not.toContainText('TODO');
    await capture(page, '03-review', viewport.width === 360 ? '.final-worker:has([aria-invalid=true])' : '.final-paper');
    await amount.fill(formatAmount(answer.rows[owes]) + ' ₽');
    await page.getByRole('button', { name: 'Подписать акт' }).click();
    await expect(page.locator('.act-summary')).toContainText('+50 XP');
    expect((await saved(page)).xp).toBe(1300);
  });
}

test('Финал закрыт после одного уровня, служебные метки скрыты в «Об игре»', async ({ page }) => {
  await prepare(page, [3]);
  await page.goto('/#final');
  await expect(page.getByRole('heading', { name: 'Архив дел' })).toBeVisible();
  await expect(page.getByText('Пройдите уровни 3 и 4')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Открыть дело № 001' })).toHaveCount(0);
  await page.goto('/#act');
  await expect(page.getByRole('heading', { name: 'Архив дел' })).toBeVisible();
  await page.goto('/#about');
  await expect(page.getByRole('heading', { name: 'Об игре и источники' })).toBeVisible();
  await expect(page.locator('body')).not.toContainText('TODO');
});
