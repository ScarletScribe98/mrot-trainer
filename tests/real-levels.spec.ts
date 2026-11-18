import { expect, test, type Locator, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { formatAmount } from '../src/calc';
import { assessRegion, drawRegions, findMilestone, MAP_SEED, regionCases, sortKey, sortStart, type RegionCase } from '../src/data/real/study';
import { STORAGE_KEY } from '../src/game';

const sizes = [{ width: 1920, height: 1080 }, { width: 360, height: 740 }];
const gallery = process.env.ETAP4_SCREEN_ROOT;
const saved = (page: Page) => page.evaluate(key => JSON.parse(localStorage.getItem(key)!), STORAGE_KEY);

async function capture(page: Page, id: string, target: string, full = false) {
  const { width, height } = page.viewportSize()!;
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  if (!gallery) return;
  mkdirSync(gallery, { recursive: true });
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(selector => {
    const y = document.querySelector(selector)!.getBoundingClientRect().top + window.scrollY;
    window.scrollTo(0, Math.max(0, y - 12));
  }, target);
  const file = gallery + '/' + id + '-' + width + 'x' + height;
  await page.screenshot({ path: file + '.png', animations: 'disabled' });
  if (width === 360 && full) await page.screenshot({ path: file + '-full.png', fullPage: true, animations: 'disabled' });
}

async function setValue(field: Locator, value: string) {
  if (await field.evaluate(el => el.tagName.toLowerCase()) === 'select') await field.selectOption(value);
  else await field.fill(value);
}
const formField = (page: Page, name: string) => page.getByRole('combobox', { name, exact: true })
  .or(page.getByRole('textbox', { name, exact: true }));
const check = (page: Page) => page.getByRole('button', { name: 'Проверить', exact: true }).click();

async function finishRegion(page: Page, item: RegionCase) {
  const result = assessRegion(item);
  await formField(page, 'База B').selectOption(result.base.source);
  await formField(page, 'Причина выбора').selectOption(result.base.reason);
  await check(page);
  await expect(page.getByRole('heading', { name: 'Рассчитайте минимум M' })).toBeVisible();
  if (item.id === 9) {
    for (const [k, s] of [['1.7', '0.3'], ['1.5', '0.5']]) {
      await setValue(formField(page, 'Районный коэффициент k'), k);
      await setValue(formField(page, 'Северная надбавка s (доля)'), s);
      await setValue(formField(page, 'Применимый минимум M'), formatAmount(5418600));
      await check(page);
      await expect(page.getByRole('heading', { name: 'Рассчитайте минимум M' })).toBeVisible();
    }
  }
  await setValue(formField(page, 'Районный коэффициент k'), item.factors.k);
  await setValue(formField(page, 'Северная надбавка s (доля)'), item.factors.s);
  await setValue(formField(page, 'Применимый минимум M'), formatAmount(result.full));
  await check(page);
  await expect(page.getByRole('heading', { name: 'Проверьте соблюдение минимума' })).toBeVisible();
  await formField(page, 'Минимум соблюдён?').selectOption(result.complies ? 'yes' : 'no');
  await setValue(formField(page, 'Доплата по формуле (3)'), formatAmount(result.due));
  await check(page);
}

for (const viewport of sizes) {
  test('Машина времени и карта: полный офлайн-проход · ' + viewport.width, async ({ page, context }) => {
    await page.setViewportSize(viewport);
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/#levels');
    await expect(page.getByText('Архив доступен без интернета')).toBeVisible();
    await page.getByRole('button', { name: 'Открыть шкалу' }).click();
    await expect(page.getByRole('heading', { name: 'Машина времени' })).toBeVisible();
    await expect(page.locator('.main')).not.toContainText(/Демо/i);
    await page.getByText('Показать вехи таблицы 7', { exact: true }).click();
    await expect(page.locator('.history-table tbody tr')).toHaveCount(14);
    await expect(page.locator('.history-table')).toContainText('2027 · проект');
    await capture(page, '01-timeline', '.history-paper', true);
    await page.getByText('Показать вехи таблицы 7', { exact: true }).click();

    await page.getByRole('button', { name: 'Выше', exact: true }).click();
    await expect(page.getByRole('complementary', { name: 'Подсказка', exact: true })).toBeVisible();
    await context.setOffline(true);
    const [method] = await Promise.all([page.waitForEvent('popup'),
      page.getByRole('link', { name: 'Часть 2, п. 2.1–2.4', exact: true }).click()]);
    await expect(method.locator('#p2-1-4')).toContainText('вехи МРОТ и ПМ');
    await method.close();
    const answers = ['Ниже', 'Выше', 'Ниже', 'Выше', 'Ниже'];
    for (const [i, answer] of answers.entries()) {
      await page.getByRole('button', { name: answer, exact: true }).click();
      await expect(page.locator('.history-comparison .history-ratio')).toHaveCount(2);
      if (i === 0) {
        await expect(page.locator('.history-comparison .history-ratio')).toHaveText(['0,36', '0,18']);
        await capture(page, '02-higher-lower', viewport.width === 360 ? '.real-task' : '.history-screen', true);
        await page.reload();
        await expect(page.locator('.history-comparison .history-ratio')).toHaveCount(2);
      }
      await page.getByRole('button', { name: 'Следующий ход' }).click();
    }
    await expect(page.getByRole('heading', { name: 'Расставьте события' })).toBeVisible();
    const order = [...sortStart];
    for (const [target, year] of sortKey.entries()) {
      const name = 'Поднять: ' + findMilestone(year).event;
      for (let current = order.indexOf(year); current > target; current--) {
        await page.getByRole('button', { name, exact: true }).click();
        [order[current - 1], order[current]] = [order[current], order[current - 1]];
      }
    }
    await page.getByRole('button', { name: 'Проверить порядок' }).click();
    await page.getByRole('button', { name: 'Завершить уровень' }).click();
    await expect(page.locator('.stamp')).toContainText('Историк МРОТ');
    expect((await saved(page)).xp).toBe(570);

    await page.getByRole('button', { name: 'Вернуться в архив' }).click();
    await page.getByRole('button', { name: 'Открыть карту' }).click();
    await expect(page.locator('.main')).not.toContainText(/Демо/i);
    await expect(page.locator('.region-map button')).toHaveCount(10);
    await expect(page.locator('.region-map button:enabled')).toHaveCount(5);
    await capture(page, '03-map', '.map-paper', true);
    const assigned = drawRegions(MAP_SEED);
    expect(assigned).toContain(9);
    expect(assigned).toContain(8);
    for (const id of [9, 8, ...assigned.filter(i => i !== 9 && i !== 8)]) {
      const item = regionCases[id - 1];
      await page.getByRole('button', { name: item.short + ' К проверке', exact: true }).click();
      await expect(page.locator('.region-condition')).toContainText(item.condition[0]);
      if (id === 9) {
        await page.getByText('О регионе · показатели 2025 года', { exact: true }).click();
        await expect(page.locator('.region-context')).toContainText('0,97');
        await capture(page, '04-region-case', '.region-paper', true);
        await formField(page, 'База B').selectOption('regional');
        await formField(page, 'Причина выбора').selectOption('higher-regional');
        await check(page);
        await expect(page.getByRole('complementary', { name: 'Подсказка', exact: true })).toBeVisible();
        await check(page);
        const feedback = page.getByRole('complementary', { name: 'Пошаговый разбор' });
        await expect(feedback).toBeVisible();
        await feedback.getByText('Сверить расчёт по ключу').click();
        await expect(feedback).toContainText('п. 5.1, табл. 12');
        await capture(page, '05-region-review', viewport.width === 360 ? '.region-questions' : '.region-case', true);
      }
      await finishRegion(page, item);
      await expect(page.getByRole('heading', { name: 'Дело зачтено' })).toBeVisible();
      if (id === 8) await expect(page.locator('.region-questions')).toContainText('273,13');
      await page.getByRole('button', { name: 'К карте', exact: true }).click();
    }
    await expect(page.locator('.map-paper .stamp')).toContainText('Региональный эксперт');
    await expect(page.locator('.region-map button:enabled')).toHaveCount(10);
    expect((await saved(page)).completed).toEqual([1, 2]);
    expect((await saved(page)).xp).toBe(1020);
    await page.reload();
    await expect(page.locator('.map-paper .stamp')).toContainText('Региональный эксперт');
    await page.getByRole('button', { name: 'Дагестан Практика', exact: true }).click();
    await finishRegion(page, regionCases[2]);
    await expect(page.getByRole('heading', { name: 'Практика завершена' })).toBeVisible();
    expect((await saved(page)).xp).toBe(1020);
    expect(errors).toEqual([]);
  });
}
