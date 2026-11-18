import { expect, type Locator, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';

export function cents(text: string) {
  return BigInt(text.replace(/[^\d,]/g, '').replace(',', ''));
}

export function hundredths(text: string) {
  const [whole, fractional = ''] = text.trim().split(',');
  return BigInt(whole) * 100n + BigInt(fractional.padEnd(2, '0'));
}

export function allowance(text: string) {
  return BigInt(text.split(' %')[0]);
}

export function halfUp(numerator: bigint, denominator: bigint) {
  return (numerator + denominator / 2n) / denominator;
}

export function expectedPayroll(base: bigint, k: bigint, s: bigint, q: bigint, w: bigint) {
  const factor = k + s;
  const difference = base * q - w * 100n;
  return {
    full: halfUp(base * factor, 100n),
    minimum: halfUp(base * factor * q, 10000n),
    accrued: halfUp(w * factor, 100n),
    due: difference > 0n ? halfUp(difference * factor, 10000n) : 0n,
  };
}

export async function displayedW(scope: Locator) {
  const lines = scope.locator('.pay-line[data-kind=salary] dd, .pay-line[data-kind=bonus] dd');
  return (await lines.allTextContents()).map(cents).reduce((sum, amount) => sum + amount, 0n);
}

export async function workerDue(page: Page) {
  const [f, r, k, s, q] = await page.locator('.data-table dd').allTextContents();
  const federal = cents(f), regional = r.includes('Не установлен') ? 0n : cents(r);
  const w = await displayedW(page.locator('.document-stage'));
  return expectedPayroll(federal > regional ? federal : regional, hundredths(k), allowance(s), hundredths(q), w).due;
}

export async function captureV5(page: Page, name: string, target: string, mobileFull = false) {
  const root = process.env.ETAP3_SCREEN_ROOT;
  if (!root) return;
  const { width, height } = page.viewportSize()!;
  mkdirSync(root, { recursive: true });
  await page.evaluate(() => Promise.all([document.fonts.ready, ...Array.from(document.images).map(image => image.decode())]));
  await page.evaluate(selector => scrollTo(0, document.querySelector(selector)!.getBoundingClientRect().top + scrollY - 12), target);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  const path = root + '/' + name + '-' + width + 'x' + height;
  await page.screenshot({ path: path + '.png', animations: 'disabled' });
  if (width === 360 && mobileFull) await page.screenshot({ path: path + '-full.png', fullPage: true, animations: 'disabled' });
}
