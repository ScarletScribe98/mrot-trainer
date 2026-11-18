import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { formatAmount } from '../src/calc';

const storageKey = 'inspektor-truda-v1';
const screenshots = process.env.AUDIT_SCREEN_ROOT;
const viewports = [{ width: 1920, height: 1080 }, { width: 360, height: 740 }];

function row(page: Page, number: number) {
  return page.locator('.audit-row[data-row="' + number + '"]');
}

async function saved(page: Page) {
  return page.evaluate(key => JSON.parse(localStorage.getItem(key)!), storageKey);
}

function cents(text: string): number {
  const [rubles, fraction] = text.trim().split(',').map(part => Number(part.replace(/[^\d]/g, '')));
  return rubles * 100 + (fraction ?? 0);
}

async function correctAnswer(page: Page) {
  const values = await page.locator('.audit-row-value').allTextContents();
  const [federal, regional, displayedBase] = values.slice(0, 3).map(cents);
  const k = Number(values[3].replace(',', ''));
  const s = Number(values[4].replace(/\D/g, ''));
  const [displayedMinimum, salary, displayedDue] = values.slice(5, 8).map(cents);
  const base = Math.max(federal, regional);
  const minimum = Math.round(base * (k + s) / 100);
  const due = Math.max(0, minimum - salary);
  if (base !== displayedBase) return { row: 3, explanation: 'wrong_base', value: base === federal ? 'federal' : 'regional' };
  if (minimum !== displayedMinimum) {
    const alternatives = [Math.round(base * k * (100 + s) / 10000), Math.round(base * k / 100) + s, Math.round(base * k / 100)];
    return { row: 6, explanation: alternatives.includes(displayedMinimum) ? 'k_s_misapplied' : 'arithmetic', value: formatAmount(minimum) + ' ₽' };
  }
  expect(displayedDue).not.toBe(due);
  return { row: 8, explanation: 'arithmetic', value: formatAmount(due) + ' ₽' };
}

async function explain(page: Page, id: string) {
  await page.locator('input[name=audit-explanation][value="' + id + '"]').check();
  await page.getByRole('button', { name: 'Проверить объяснение' }).click();
}

async function correctValue(page: Page, answer: Awaited<ReturnType<typeof correctAnswer>>) {
  if (answer.row === 3) await page.locator('input[name=audit-base][value="' + answer.value + '"]').check();
  else await page.getByLabel('Правильная сумма').fill(answer.value);
  await page.getByRole('button', { name: 'Проверить исправление' }).click();
  await expect(page.getByText('Ошибка найдена', { exact: true })).toBeVisible();
}

async function solve(page: Page) {
  const answer = await correctAnswer(page);
  await row(page, answer.row).click();
  await explain(page, answer.explanation);
  await correctValue(page, answer);
  return answer;
}

async function capture(page: Page, name: string, target: string) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
  if (!screenshots) return;
  mkdirSync(screenshots, { recursive: true });
  await page.evaluate(() => Promise.all([document.fonts.ready, ...Array.from(document.images).map(image => image.decode())]));
  const { width, height } = page.viewportSize()!;
  await page.evaluate(selector => {
    const top = document.querySelector(selector)!.getBoundingClientRect().top + scrollY;
    scrollTo(0, top - 16);
  }, target);
  const path = screenshots + '/' + name + '-' + width + 'x' + height;
  await page.screenshot({ path: path + '.png', animations: 'disabled' });
  if (width === 360 && ['01-levels', '03-explanation'].includes(name)) {
    await page.screenshot({ path: path + '-full.png', fullPage: true, animations: 'disabled' });
  }
}

for (const viewport of viewports) {
  test('Аудит ведомости: пять листов, подсказка, разбор и офлайн · ' + viewport.width, async ({ page, context }) => {
    await page.setViewportSize(viewport);
    const errors: string[] = [];
    const requestsOutsideApp: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => {
      if (!request.url().startsWith('http://127.0.0.1:4173/') && !request.url().startsWith('data:')) {
        requestsOutsideApp.push(request.url());
      }
    });
    await page.goto('/#levels');
    await expect(page.getByText('Архив доступен без интернета', { exact: true })).toBeVisible();
    if (viewport.width === 1920) {
      const precacheBytes = await page.evaluate(async () => {
        const names = (await caches.keys()).filter(name => name.startsWith('workbox-precache'));
        const bytes = await Promise.all(names.map(async name => {
          const cache = await caches.open(name);
          const responses = await Promise.all((await cache.keys()).map(key => cache.match(key)));
          const buffers = await Promise.all(responses.map(response => response!.arrayBuffer()));
          return buffers.reduce((total, buffer) => total + buffer.byteLength, 0);
        }));
        return bytes.reduce((sum, size) => sum + size, 0);
      });
      expect(precacheBytes).toBeGreaterThan(0);
      expect(precacheBytes).toBeLessThanOrEqual(450_000);
    }
    const auditCard = page.locator('.level-card').filter({ has: page.getByRole('heading', { name: 'Аудит ведомости' }) });
    await expect(auditCard.getByText('0/5', { exact: true })).toBeVisible();
    await capture(page, '01-levels', viewport.width === 360 ? '.level-card:nth-child(4)' : '.levels-screen');

    await auditCard.getByRole('button', { name: 'Открыть ведомость' }).click();
    await expect(page.getByRole('heading', { name: 'Аудит ведомости', exact: true })).toBeVisible();
    await expect(page.locator('.audit-row')).toHaveCount(9);
    expect(await page.locator('.audit-row').evaluateAll(rows => rows.every(el => parseFloat(getComputedStyle(el).height) >= 44))).toBe(true);
    await capture(page, '02-sheet', viewport.width === 360 ? '.audit-sheet' : '.audit-screen');
    const first = await correctAnswer(page);
    await row(page, 1).click();
    await expect(row(page, 1)).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('.audit-source-note')).toBeVisible();
    expect((await saved(page)).audit.cards[0].attempts).toBe(0);
    await row(page, 1).click();

    await row(page, first.row).click();
    await expect(row(page, first.row)).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('radio')).toHaveCount(3);
    await capture(page, '03-explanation', viewport.width === 360 ? '.audit-notes' : '.audit-screen');
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Объясните ошибку' })).toBeVisible();
    await expect(row(page, first.row)).toHaveAttribute('aria-pressed', 'true');
    await explain(page, first.explanation);
    await correctValue(page, first);
    await expect(page.getByText('+100 очков опыта')).toBeVisible();
    await capture(page, '05-stamp', viewport.width === 360 ? '.audit-notes' : '.audit-screen');
    await page.reload();
    await expect(page.getByText('Ошибка найдена', { exact: true })).toBeVisible();
    expect((await saved(page)).xp).toBe(100);

    await page.getByRole('button', { name: 'Следующий лист' }).click();
    const second = await correctAnswer(page);
    await row(page, 9).click();
    const hint = page.getByRole('complementary', { name: 'Подсказка', exact: true });
    await expect(hint).toBeVisible();
    await expect(page.getByRole('complementary', { name: 'Пошаговый разбор' })).toHaveCount(0);
    await row(page, 9).click();
    const walkthrough = page.getByRole('complementary', { name: 'Пошаговый разбор' });
    await expect(walkthrough).toBeVisible();
    await expect(walkthrough.getByRole('link', { name: 'Повторить: часть N, п. X методички' })).toHaveAttribute('aria-disabled', 'true');
    await expect(walkthrough.getByRole('table')).toBeHidden();
    await expect(page.getByText('Ошибка найдена', { exact: true })).toHaveCount(0);
    await page.reload();
    await expect(walkthrough).toBeVisible();
    await walkthrough.getByText('Сравнить расчёты').click();
    await expect(walkthrough.getByRole('table')).toBeVisible();
    await expect(walkthrough.locator('.audit-comparison-error')).toContainText('Первая ошибка');
    await capture(page, '04-walkthrough', viewport.width === 360 ? '.hint--detailed' : '.audit-screen');
    await solve(page);
    await expect(page.getByText('+50 очков опыта')).toBeVisible();

    await page.goto('/#levels');
    await expect(auditCard.getByText('2/5', { exact: true })).toBeVisible();
    await context.setOffline(true);
    await page.reload();
    await auditCard.getByRole('button', { name: 'Продолжить аудит' }).click();
    expect((await saved(page)).audit.cards.filter((card: { answered: boolean }) => card.answered)).toHaveLength(2);
    await page.locator('.audit-sheet img').evaluateAll(imgs => Promise.all(imgs.map(img => (img as HTMLImageElement).decode())));
    const methods = [first.explanation, second.explanation];
    for (let index = 2; index < 5; index++) {
      await page.getByRole('button', { name: 'Следующий лист' }).click();
      methods.push((await solve(page)).explanation);
    }
    expect(new Set(methods).size).toBe(3);
    await expect(page.getByText('+150 очков опыта')).toBeVisible();
    await page.getByRole('button', { name: 'Подвести итоги' }).click();
    await expect(page.getByRole('heading', { name: 'Пять ведомостей проверены' })).toBeVisible();
    await page.reload();
    expect((await saved(page)).xp).toBe(500);
    expect((await saved(page)).completed).toEqual([4]);
    await page.getByRole('button', { name: 'Вернуться в архив' }).click();
    await expect(auditCard.getByText('5/5', { exact: true })).toBeVisible();
    expect(errors).toEqual([]);
    expect(requestsOutsideApp).toEqual([]);
  });
}

for (const viewport of [...viewports, { width: 1366, height: 768 }]) {
  test('Уровень 3: счётчик под зелёной лампой · ' + viewport.width, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/#game');
    const counter = page.locator('.card-counter');
    await expect(counter).toContainText('01 / 05');
    if (viewport.width >= 1200) {
      const gap = await counter.evaluate(element => {
        const image = document.querySelector<HTMLImageElement>('.scene-lamp')!.getBoundingClientRect();
        const scale = Math.max(image.width / 1600, image.height / 1000);
        // The glass shade begins at x=1190 in the 1600×1000 artwork.
        const shadeLeft = image.x + (image.width - 1600 * scale) / 2 + 1190 * scale;
        return shadeLeft - element.getBoundingClientRect().right;
      });
      expect(gap).toBeGreaterThan(7); // Enough clearance for the existing 5.5 px horizontal parallax.
    }
    await capture(page, '06-level-three', viewport.width === 360 ? '.game-heading' : '.game-screen');
  });
}
