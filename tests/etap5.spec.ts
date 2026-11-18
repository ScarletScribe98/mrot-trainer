import { expect, test, type Locator, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { assessRegion, drawRegions, historyPairs, MAP_SEED, regionCases, sortKey, sortStart } from '../src/data/real/study';
import { formatAmount } from '../src/calc';
import { initialProgress, STORAGE_KEY, type Progress } from '../src/game';

test.use({ actionTimeout: 5000 });

const shots = process.env.ETAP5_SCREEN_ROOT;
const tambov = regionCases[0];
const selected = drawRegions(MAP_SEED);
const check = (page: Page) => page.getByRole('button', { name: 'Проверить', exact: true });
const key = (page: Page) => page.locator('details.region-review');
const topup = (page: Page) => page.getByRole('textbox', { name: 'Доплата по формуле (3)', exact: true });
const select = (page: Page, name: string) => page.getByRole('combobox', { name, exact: true });
const field = (page: Page, name: string) => select(page, name).or(page.getByRole('textbox', { name, exact: true }));

async function prepare(page: Page, setup: (progress: Progress) => void = () => {}) {
  const progress = initialProgress();
  progress.sound = false;
  setup(progress);
  await page.addInitScript(({ key, value }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, value);
  }, { key: STORAGE_KEY, value: JSON.stringify(progress) });
}

const saved = (page: Page): Promise<Progress> => page.evaluate(key => JSON.parse(localStorage.getItem(key)!), STORAGE_KEY);

async function openRegion(page: Page, id: number, status = 'К проверке') {
  await page.getByRole('button', { name: regionCases[id - 1].short + ' ' + status, exact: true }).click();
}

async function amountOrOption(field: Locator, value: string) {
  if (await field.evaluate(element => element.tagName === 'SELECT')) await field.selectOption(value);
  else await field.fill(value);
}

async function answerBase(page: Page, id: number) {
  const { base } = assessRegion(regionCases[id - 1]);
  await select(page, 'База B').selectOption(base.source);
  await select(page, 'Причина выбора').selectOption(base.reason);
  await check(page).click();
}

async function answerMinimum(page: Page, id: number) {
  const item = regionCases[id - 1];
  await amountOrOption(field(page, 'Районный коэффициент k'), item.factors.k);
  await amountOrOption(field(page, 'Северная надбавка s (доля)'), item.factors.s);
  await amountOrOption(field(page, 'Применимый минимум M'), formatAmount(assessRegion(item).full));
  await check(page).click();
}

async function answerTopup(page: Page, id: number) {
  const { complies, due } = assessRegion(regionCases[id - 1]);
  await select(page, 'Минимум соблюдён?').selectOption(complies ? 'yes' : 'no');
  await topup(page).fill(due ? formatAmount(due) : '0');
  await check(page).click();
}

async function capture(page: Page, name: string, anchor?: Locator) {
  if (!shots) return;
  mkdirSync(shots, { recursive: true });
  await page.evaluate(() => document.fonts.ready);
  if (anchor) await anchor.evaluate(element => {
    window.scrollTo(0, Math.max(0, element.getBoundingClientRect().top + window.scrollY - 16));
  }); else await page.evaluate(() => window.scrollTo(0, 0));
  const { width, height } = page.viewportSize()!;
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  await page.screenshot({ path: `${shots}/${name}-${width}x${height}.png`, animations: 'disabled' });
}

test('Уровень 2: свой свёрнутый ключ на каждом шаге, XP и продолжение после перезагрузки', async ({ page }) => {
  expect(selected).toContain(tambov.id);
  await prepare(page);
  await page.goto('/#map');
  await openRegion(page, tambov.id);
  const wrongInputs = [
    async () => {
      await select(page, 'База B').selectOption('regional');
      await select(page, 'Причина выбора').selectOption('higher-regional');
    },
    async () => {
      await field(page, 'Районный коэффициент k').fill('1');
      await field(page, 'Северная надбавка s (доля)').fill('0');
      await field(page, 'Применимый минимум M').fill('0');
    },
    async () => {
      await select(page, 'Минимум соблюдён?').selectOption('no');
      await topup(page).fill('0');
    },
  ];
  const expectedKeys = ['Отдельная региональная', 'нет (0)', '593,00'];
  for (const [step, enterWrong] of wrongInputs.entries()) {
    await enterWrong();
    await check(page).click();
    await expect(page.getByText('На что обратить внимание', { exact: true })).toBeVisible();
    await expect(key(page)).toHaveCount(0);
    await check(page).click();
    await expect(key(page)).toBeVisible();
    await expect(key(page)).not.toHaveAttribute('open');
    await expect(key(page).locator('p').first()).toBeHidden();
    if (step === 0) expect((await saved(page)).study.map.cases[0].hint).toBeUndefined();
    await key(page).getByText('Сверить расчёт по ключу').press('Enter');
    await expect(key(page)).toHaveAttribute('open', '');
    await expect(key(page).locator('p').first()).toContainText(expectedKeys[step]);
    expect((await saved(page)).study.map.cases[0].hint).toBe(true);
    if (step === 0) {
      await page.reload();
      await openRegion(page, tambov.id);
      await expect(key(page)).not.toHaveAttribute('open');
      expect((await saved(page)).study.map.cases[0].hint).toBe(true);
      expect((await saved(page)).xp).toBe(0);
    }
    await [answerBase, answerMinimum, answerTopup][step](page, tambov.id);
    await expect(key(page)).toHaveCount(0);
  }
  await expect(page.getByText('+50 XP (с подсказкой)', { exact: false })).toBeVisible();
  expect((await saved(page)).xp).toBe(50);
});

test('Уровень 2: свободный ввод доплаты во всех десяти делах и корректное принятие нуля', async ({ page }) => {
  await prepare(page, progress => { progress.completed = [2]; });
  await page.goto('/#map');
  expect(regionCases).toHaveLength(10);
  for (const item of regionCases) {
    await openRegion(page, item.id, 'Практика');
    await answerBase(page, item.id);
    await answerMinimum(page, item.id);
    await expect(topup(page)).toHaveAttribute('inputmode', 'decimal');
    if (item.id === 1) {
      await select(page, 'Минимум соблюдён?').selectOption('no');
      await topup(page).fill('0');
      await check(page).click();
      await expect(topup(page)).toHaveValue('0');
      await expect(page.getByText('На что обратить внимание', { exact: true })).toBeVisible();
    }
    await answerTopup(page, item.id);
    await expect(page.getByRole('heading', { name: 'Практика завершена' })).toBeVisible();
    await page.getByRole('button', { name: 'К карте', exact: true }).click();
  }
  expect((await saved(page)).xp).toBe(0);
});

test('Архив обновляет зачёт уровня 2. Вторую попытку и первую показывает в XP', async ({ page }) => {
  await prepare(page, progress => {
    for (const id of selected.slice(0, 3)) progress.study.map.cases[id - 1].step = 3;
  });
  await page.goto('/#levels');
  const card = page.locator('.level-card').filter({ has: page.getByRole('heading', { name: 'Карта минимумов' }) });
  await expect(card.getByText('3 / 5 дел к зачёту')).toBeVisible();
  await expect(card.getByText('После зачёта откроются все 10 дел для практики.')).toBeVisible();
  await card.getByRole('button', { name: 'Открыть карту' }).click();
  for (const [index, id] of selected.slice(3).entries()) {
    await openRegion(page, id);
    if (index === 0) {
      const { base } = assessRegion(regionCases[id - 1]);
      await select(page, 'База B').selectOption(base.source === 'federal' ? 'regional' : 'federal');
      await select(page, 'Причина выбора').selectOption(base.reason);
      await check(page).click();
    }
    await answerBase(page, id);
    await answerMinimum(page, id);
    await answerTopup(page, id);
    await expect(page.locator('.region-questions')).toContainText(index === 0
      ? '+70 XP (со второй попытки)' : '+100 XP (с первой попытки)');
    await page.getByRole('button', { name: 'К карте', exact: true }).click();
  }
  await page.locator('.game-breadcrumb').getByRole('button', { name: 'Архив дел' }).click();
  await expect(card.getByText('Пройдено', { exact: true })).toBeVisible();
  await expect(card.locator('.level-achievement')).toHaveText('Региональный эксперт');
  expect((await saved(page)).xp).toBe(170);
});

test('Машина времени: вторая ошибка отмечает события на неверных позициях', async ({ page }) => {
  await prepare(page, progress => { progress.study.history.turn = historyPairs.length; });
  await page.goto('/#history');
  const sort = page.getByRole('button', { name: 'Проверить порядок' });
  await sort.click();
  await expect(page.getByRole('status')).toContainText('Неверно');
  await expect(page.locator('.history-misplaced')).toHaveCount(0);
  await sort.click();
  await expect(page.getByRole('status')).toContainText('отмечены в списке');
  await expect(page.getByText('Не на своём месте', { exact: true })).toHaveCount(
    sortStart.filter((year, index) => year !== sortKey[index]).length);
});

test('Служебные метки вне DOM, учебное соглашение и неразрывная строка XP', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 768 });
  await prepare(page, p => { p.xp = 1660; p.completed = [3, 4]; });
  for (const [route, label] of [['history', 'Методичка v5'], ['map', 'Методичка v5'],
    ['game', 'Учебные данные'], ['audit', 'Учебные данные'], ['final', 'Учебные данные']]) {
    await page.goto('/#' + route);
    await expect(page.locator('.data-badge')).toHaveText(label);
    expect(await page.locator('body').textContent()).not.toMatch(/ЗЕРНО|ДЕМО/iu);
  }
  await page.goto('/#game');
  await expect(page.locator('.agreement-condition')).toContainText('работодатель к нему присоединён');
  const xp = page.locator('.xp-value > span').first();
  await expect(xp).toHaveText(/^1\s660 XP$/);
  await expect(xp).toHaveCSS('white-space', 'nowrap');
  await page.goto('/?debug=0#game');
  await expect(page.locator('.debug-seed')).toHaveCount(0);
  await page.goto('/?debug=1#game');
  await expect(page.locator('.debug-seed')).toHaveText('ЗЕРНО ' + initialProgress().run.seed);
});

for (const viewport of [{ width: 1366, height: 768 }, { width: 1366, height: 560 }, { width: 1280, height: 600 }]) {
  test('Кнопки уровня 2 и финала доступны при ' + viewport.width + '×' + viewport.height, async ({ page }) => {
    await page.setViewportSize(viewport);
    await prepare(page, progress => { progress.completed = [3, 4]; });
    await page.goto('/#map');
    await openRegion(page, tambov.id);
    await expect(check(page)).toBeInViewport({ ratio: 1 });
    await answerBase(page, tambov.id);
    await expect(check(page)).toBeInViewport({ ratio: 1 });
    await answerMinimum(page, tambov.id);
    await expect(check(page)).toBeInViewport({ ratio: 1 });
    await answerTopup(page, tambov.id);
    await expect(page.getByRole('button', { name: 'К карте', exact: true })).toBeInViewport({ ratio: 1 });
    await page.goto('/#final');
    await page.evaluate(() => window.scrollTo(0, 0));
    const sign = page.getByRole('button', { name: 'Подписать акт' });
    await expect(sign).toBeInViewport({ ratio: 1 });
    if (viewport.height === 768) await capture(page, '06-final');
    await page.evaluate(() => window.scrollBy(0, 350));
    await expect(sign).toBeInViewport({ ratio: 1 });
    if (viewport.height === 768) await capture(page, '07-final-worksheet', page.locator('.final-paper'));
    await sign.click();
    await expect(page.getByRole('status').filter({ hasText: 'Проверьте общую базу.' })).toBeVisible();
  });
}

for (const viewport of [{ width: 1920, height: 1080 }, { width: 1366, height: 768 }, { width: 360, height: 740 }]) {
  test('Состояния плейтеста · ' + viewport.width, async ({ page }) => {
    await page.setViewportSize(viewport);
    await prepare(page, progress => {
      for (const id of selected.filter(id => id !== tambov.id).slice(0, 3)) progress.study.map.cases[id - 1].step = 3;
    });
    await page.goto('/#levels');
    await expect(page.getByText('3 / 5 дел к зачёту')).toBeVisible();
    const archiveCard = page.locator('.level-card').filter({ hasText: 'Карта минимумов' });
    await capture(page, '01-archive', viewport.width === 360 ? archiveCard : undefined);
    await page.goto('/#history');
    await page.getByRole('button', { name: 'Выше', exact: true }).click();
    const feedback = page.getByRole('status').filter({ hasText: 'Неверно' });
    await expect(feedback).toContainText('Правильный ответ — «Ниже».');
    await expect(feedback).toContainText('0,36');
    await expect(feedback).toContainText('0,18');
    await capture(page, '02-history-wrong', viewport.width === 360 ? page.locator('.real-task') : undefined);
    await page.goto('/#map');
    await openRegion(page, tambov.id);
    await answerBase(page, tambov.id);
    await answerMinimum(page, tambov.id);
    const questions = page.locator('.region-questions');
    await expect(topup(page)).toBeVisible();
    await capture(page, '03-topup', viewport.width === 360 ? questions : undefined);
    await select(page, 'Минимум соблюдён?').selectOption('no');
    await topup(page).fill('0');
    await check(page).click();
    await check(page).click();
    await expect(key(page)).not.toHaveAttribute('open');
    const summary = key(page).getByText('Сверить расчёт по ключу');
    await capture(page, '04-key-closed', key(page));
    await summary.click();
    await expect(key(page).locator('p').first()).toBeVisible();
    await capture(page, '05-key-open', key(page));
  });
}
