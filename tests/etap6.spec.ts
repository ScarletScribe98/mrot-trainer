import { expect, test, type Locator, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { formatAmount } from '../src/calc';
import { generateFinalSheet } from '../src/calc/final';
import { historyRatioCaption, milestones } from '../src/data/real/study';
import { initialProgress, STORAGE_KEY, type Progress } from '../src/game';
import { isVariant, variantSeeds } from '../src/variants';

const shots = process.env.ETAP6_SCREEN_ROOT;
const saved = (page: Page): Promise<Progress> => page.evaluate(key => JSON.parse(localStorage.getItem(key)!), STORAGE_KEY);

async function startWith(page: Page, progress: Progress) {
  await page.addInitScript(({ key, value }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, value);
  }, { key: STORAGE_KEY, value: JSON.stringify(progress) });
}

async function capture(page: Page, name: string, anchor?: Locator) {
  if (!shots) return;
  mkdirSync(shots, { recursive: true });
  await page.evaluate(() => document.fonts.ready);
  if (anchor) await anchor.evaluate(element => {
    window.scrollTo(0, Math.max(0, element.getBoundingClientRect().top + window.scrollY - 16));
  });
  else await page.evaluate(() => window.scrollTo(0, 0));
  const { width, height } = page.viewportSize()!;
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  await page.screenshot({ path: `${shots}/${name}-${width}x${height}.png`, animations: 'disabled' });
}

async function resetDialog(page: Page) {
  await page.getByRole('button', { name: 'Начать заново', exact: true }).click();
  return page.getByRole('dialog');
}

test('Ссылка преподавателя воспроизводит два варианта и ждёт подтверждённого сброса', async ({ page, browser }) => {
  const replica = await browser.newPage();
  try {
    const origin = 'http://127.0.0.1:4173';
    await page.goto('/?variant=1#game');
    await replica.goto(origin + '/?variant=42#game');
    const values = (screen: Page) => screen.locator('.data-table dd, .document-stage .pay-line dd').allTextContents();
    await expect(page.locator('.sidebar .variant-number')).toHaveText('Вариант № 1');
    await expect(replica.locator('.sidebar .variant-number')).toHaveText('Вариант № 42');
    const first = await values(page);
    const second = await values(replica);
    expect(first).not.toEqual(second);

    await page.getByRole('radio', { name: 'Нарушения нет', exact: true }).check();
    await page.getByRole('button', { name: 'Завершить проверку' }).click();
    await page.goto('/?variant=42#game');
    expect(await values(page)).toEqual(first);
    expect((await saved(page)).variant).toBe(1);
    expect((await saved(page)).run.cards[0].attempts).toBe(1);
    await page.goto('/?variant=42#about');
    await (await resetDialog(page)).getByRole('button', { name: 'Отмена' }).click();
    expect((await saved(page)).variant).toBe(1);
    await (await resetDialog(page)).getByRole('button', { name: 'Начать заново', exact: true }).click();
    await expect(page.locator('.sidebar .variant-number')).toHaveText('Вариант № 42');
    await page.goto('/?variant=42#game');
    expect(await values(page)).toEqual(second);
    const progress = await saved(page);
    expect(progress.run.cards[0].attempts).toBe(0);
    const seeds = variantSeeds(42);
    expect([progress.study.map.seed, progress.run.seed, progress.audit.seed, progress.final.seed])
      .toEqual([seeds.map, seeds.workers, seeds.audit, seeds.final]);
  } finally {
    await replica.context().close();
  }
});

test('«Начать заново» выдаёт другой случайный номер без ссылки преподавателя', async ({ page }) => {
  await page.goto('/#about');
  const before = await saved(page);
  expect(isVariant(before.variant)).toBe(true);
  await (await resetDialog(page)).getByRole('button', { name: 'Начать заново', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Начать дело', exact: true })).toBeVisible();
  const after = await saved(page);
  expect(isVariant(after.variant)).toBe(true);
  expect(after.variant).not.toBe(before.variant);
  await expect(page.locator('.sidebar .variant-number')).toHaveText(`Вариант № ${after.variant}`);
  await page.reload();
  expect((await saved(page)).variant).toBe(after.variant);
});

for (const viewport of [{ width: 1366, height: 768 }, { width: 360, height: 740 }]) {
  test(`Пояснения к 1992 и 2018, таблица и «Об игре» · ${viewport.width}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await startWith(page, { ...initialProgress(), sound: false });
    await page.goto('/#history');
    await expect(page.locator('.history-caption')).toHaveText(historyRatioCaption);
    const comparison = page.locator('.history-comparison');
    for (const [index, answer] of ['Ниже', 'Выше', 'Ниже', 'Выше'].entries()) {
      await page.getByRole('button', { name: answer, exact: true }).click();
      if (index === 0 || index === 3) {
        const years = index === 0 ? [1992, 1997] : [2018, 2021];
        await expect(comparison.getByRole('heading', { level: 3 })).toHaveText(years.map(String));
        const note = comparison.locator('.history-ratio-note');
        await expect(note).not.toHaveAttribute('open');
        await note.getByText(`${years[0]} · Почему не сходится?`, { exact: true }).click();
        await expect(note.locator('p')).toHaveText(milestones.find(item => item.year === years[0])!.ratioNote!);
        await expect(note.locator('p')).toBeVisible();
        await capture(page, index === 0 ? '01-history-1992-1997' : '02-history-2018-2021',
          viewport.width === 360 ? comparison : page.locator('.real-task'));
      }
      await page.getByRole('button', { name: 'Следующий ход', exact: true }).click();
    }
    await page.getByText('Показать вехи таблицы 7', { exact: true }).click();
    const table = page.locator('.history-table');
    for (const year of [1992, 2018]) {
      await table.getByText(`${year} · Почему не сходится?`, { exact: true }).click();
      await expect(table.locator('.history-ratio-note[open]').getByText(milestones.find(item => item.year === year)!.ratioNote!)).toBeVisible();
    }
    await page.goto('/#about');
    const about = page.locator('.about-document');
    await expect(about.getByText(historyRatioCaption, { exact: false })).toBeVisible();
    await capture(page, '03-about', viewport.width === 360 ? about : undefined);
  });

  test(`Номер в панели, ведомости, акте, PNG и печати · ${viewport.width}`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    const progress = { ...initialProgress(42), completed: [3, 4], xp: 1660, sound: false };
    await startWith(page, progress);
    await page.goto('/?variant=42#final');
    const panel = page.locator(viewport.width === 360 ? '.mobile-tools' : '.sidebar .xp-panel');
    await expect(panel.getByText('Вариант № 42', { exact: true })).toBeVisible();
    if (viewport.width !== 360) {
      await expect(panel.locator('.xp-value > span').first()).toHaveText(/^1\s660 XP$/);
      await expect(panel.locator('.xp-value > span').first()).toHaveCSS('white-space', 'nowrap');
    }
    await expect(page.locator('.final-organization').getByText('Вариант № 42', { exact: true })).toBeVisible();
    await capture(page, '04-variant-panel', viewport.width === 360 ? panel : page.locator('.final-paper'));
    await page.evaluate(() => window.scrollTo(0, 0));
    await capture(page, '05-variant-final', viewport.width === 360 ? page.locator('.final-paper') : undefined);

    const sheet = generateFinalSheet(progress.final.seed);
    await page.locator(sheet.baseSource === 'federal' ? '#final-base' : '#final-base-regional').check();
    for (const [index, row] of sheet.rows.entries()) {
      await page.locator(`#final-row-${index}-verdict`).selectOption(row.violation ? 'yes' : 'no');
      if (row.violation) await page.locator(`#final-row-${index}-amount`).fill(formatAmount(row.due));
    }
    await page.locator('#final-total').fill(formatAmount(sheet.total));
    await page.locator('#final-conclusion').selectOption('yes');
    await page.getByRole('button', { name: 'Подписать акт' }).click();
    const actVariant = page.locator('.act-paper-head').getByText('Вариант № 42', { exact: true });
    await expect(actVariant).toBeVisible();
    await expect(page.locator('.act-total')).toContainText(formatAmount(sheet.total));
    await capture(page, '06-variant-act', viewport.width === 360 ? page.locator('.act-paper') : undefined);

    await page.evaluate(() => {
      const original = CanvasRenderingContext2D.prototype.fillText;
      CanvasRenderingContext2D.prototype.fillText = function (text, x, y, maxWidth) {
        if (text.startsWith('Вариант № ')) document.documentElement.dataset.drawnVariant = text;
        original.call(this, text, x, y, maxWidth);
      };
    });
    const [download] = await Promise.all([
      page.waitForEvent('download'), page.getByRole('button', { name: 'Сохранить как изображение' }).click(),
    ]);
    expect(await download.failure()).toBeNull();
    if (shots && viewport.width === 1366) await download.saveAs(testInfo.outputPath('act-variant-42.png'));
    await expect(page.locator('html')).toHaveAttribute('data-drawn-variant', 'Вариант № 42');
    await page.emulateMedia({ media: 'print' });
    await expect(actVariant).toBeVisible();
  });
}
