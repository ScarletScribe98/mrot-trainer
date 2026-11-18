import { expect, it, vi } from 'vitest';
import { auditFields, generateAuditSheets } from './calc/audit';
import { generateFinalSheet } from './calc/final';
import { showMoney, type Payment } from './calc/payroll';
import { assessWorker, generatePayrollTasks } from './calc/training';
import { assessRegion, drawRegions, regionCases } from './data/real/study';
import { assignedRegions, initialProgress, loadProgress, STORAGE_KEY, submitRegional, validateProgress, type Progress } from './game';
import { isVariant, parseVariant, randomVariant, variantSeeds } from './variants';

const numbers = Array.from({ length: 1000 }, (_, index) => index + 1);
const historicalSeeds = { map: 73107, workers: 73103, audit: 73104, final: 73105 };
const initialSeeds = (progress: Progress) => ({
  map: progress.study.map.seed, workers: progress.run.seed, audit: progress.audit.seed, final: progress.final.seed,
});

function hundredths(value: string) {
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
}
function expected(base: number, w: number, k: string, s: string, q: string) {
  const b = BigInt(base), paid = BigInt(w), factor = hundredths(k) + hundredths(s), rate = hundredths(q);
  const gap = b * rate - paid * 100n;
  return {
    full: Number((b * factor + 50n) / 100n),
    minimum: Number((b * factor * rate + 5000n) / 10000n),
    accrued: Number((paid * factor + 50n) / 100n),
    due: gap > 0n ? Number((gap * factor + 5000n) / 10000n) : 0,
  };
}
function positiveCents(values: number[]) {
  return values.every(value => Number.isSafeInteger(value) && value > 0);
}
function checkPayments(payments: Payment[], w: number) {
  expect(positiveCents(payments.map(item => item.cents))).toBe(true);
  expect(payments.filter(item => item.inW).reduce((total, item) => total + item.cents, 0)).toBe(w);
}
function numericPayroll(items: ReturnType<typeof generatePayrollTasks>) {
  return items.map(({ federal, regional, k, s, q, payments }) => [federal, regional, k, s, q, ...payments.map(item => item.cents)]);
}
function numericAudit(sheets: ReturnType<typeof generateAuditSheets>) {
  return [numericPayroll(sheets.map(sheet => sheet.task)), sheets.map(sheet => [
    sheet.shown.base, sheet.shown.w, sheet.shown.full, sheet.shown.minimum, sheet.shown.due,
  ])];
}
function numericFinal(sheet: ReturnType<typeof generateFinalSheet>) {
  return [sheet.federal, sheet.regional, sheet.k, sheet.total,
    ...sheet.rows.map(({ s, w, due }) => [s, w, due])];
}

it('разбирает ручной номер варианта только в пределах 1–9999', () => {
  for (const variant of [1, 42, 9999]) {
    expect(parseVariant(new URLSearchParams(`variant=${variant}`).get('variant'))).toBe(variant);
  }
  for (const invalid of [null, undefined, '', '0', '10000', '-1', '01', '+1', '1e2', '1.5', '1\n', ' 42 ', 'строка']) {
    expect(parseVariant(invalid)).toBeUndefined();
  }
  const samples = Array.from({ length: 128 }, () => randomVariant(42));
  expect(samples.every(number => isVariant(number) && number !== 42)).toBe(true);
});

it('игнорирует ссылку преподавателя при загрузке сохранения с его прежними зёрнами', () => {
  const legacy = initialProgress();
  legacy.run.seed += 1777;
  legacy.xp = 350;
  const getItem = vi.fn(() => JSON.stringify(legacy));
  vi.stubGlobal('localStorage', { getItem });
  try {
    const onNewGame = vi.fn(() => initialProgress(42));
    expect(loadProgress(onNewGame)).toEqual(legacy);
    expect(getItem).toHaveBeenCalledWith(STORAGE_KEY);
    expect(onNewGame).not.toHaveBeenCalled();
    getItem.mockReturnValueOnce('null');
    expect(loadProgress(onNewGame).variant).toBe(42);
    expect(onNewGame).toHaveBeenCalledOnce();
    expect(validateProgress({ ...legacy, variant: 10000 })).toBe(false);
  } finally {
    vi.unstubAllGlobals();
  }
});

it('проверяет сложность и ROUND_HALF_UP на вариантах 1–1000 и прежних зёрнах', () => {
  const correctChoices = new Set<number>();
  const finalBases = new Set<string>();
  const samples = [...numbers.map(number => [number, variantSeeds(number)] as const), [0, historicalSeeds] as const];
  for (const [number, seeds] of samples) {
    const state = initialProgress(number || undefined);
    expect(initialSeeds(state), `Вариант ${number}`).toEqual(seeds);

    const ids = drawRegions(seeds.map, true);
    expect(new Set(ids).size).toBe(5);
    expect(ids.every(id => id >= 1 && id <= 10)).toBe(true);
    // The saved stage 5 map has five cases with a top-up. Only numbered games apply the mixed draw.
    if (number) expect(assignedRegions(state)).toEqual(ids);
    else expect(assignedRegions(state)).toEqual([1, 9, 8, 7, 5]);
    const regions = ids.map(id => regionCases[id - 1]);
    const regionResults = regions.map(assessRegion);
    expect(new Set(regionResults.map(result => result.complies))).toEqual(new Set([true, false]));
    for (const [i, item] of regions.entries()) {
      const result = regionResults[i];
      expect(positiveCents([result.base.amount, result.full, result.minimum, result.w])).toBe(true);
      expect(result.due).toBe(expected(result.base.amount, result.w, item.factors.k, item.factors.s, item.wages.q).due);
    }
    let progress = state;
    for (const [i, id] of assignedRegions(state).entries()) {
      for (let step = 0; step < 3; step++) progress = submitRegional(progress, id, true);
      expect(progress.completed.includes(2)).toBe(i === 4);
    }

    const workers = generatePayrollTasks(seeds.workers);
    const results = workers.map(assessWorker);
    expect(workers).toHaveLength(5);
    expect(new Set(results.map(result => result.complies))).toEqual(new Set([true, false]));
    expect(new Set(results.map(result => result.base.source))).toEqual(new Set(['federal', 'regional']));
    for (const [index, task] of workers.entries()) {
      const { base, w, full, minimum, accrued, due } = results[index];
      expect(positiveCents([task.federal, task.regional ?? task.federal, base.amount, w])).toBe(true);
      checkPayments(task.payments, w);
      expect({ full: showMoney(full), minimum: showMoney(minimum), accrued: showMoney(accrued), due: showMoney(due) })
        .toEqual(expected(base.amount, w, task.k, task.s, task.q));
    }

    const audit = generateAuditSheets(seeds.audit);
    expect(audit).toHaveLength(5);
    const types = audit.map(sheet => sheet.error);
    expect(new Set(types).size).toBe(5);
    expect(types).toEqual(expect.arrayContaining(['rounding', 'w_includes_excluded', 'rate_ignored', 'coef_in_minimum']));
    expect(types.filter(type => ['wrong_base', 'k_s_misapplied', 'arithmetic'].includes(type))).toHaveLength(1);
    for (const sheet of audit) {
      const { correct, shown, task, explanations, error, row } = sheet;
      expect(positiveCents([task.federal, task.regional, correct.base, correct.w, correct.due])).toBe(true);
      checkPayments(task.payments, correct.w);
      expect(correct).toMatchObject(expected(correct.base, correct.w, task.k, task.s, task.q));
      if (row === 3) expect(shown.source).not.toBe(correct.source);
      else expect(shown[auditFields[row]]).not.toBe(correct[auditFields[row]]);
      if (error === 'rounding') {
        expect(row).toBe(9);
        const numerator = BigInt(correct.base) * (hundredths(task.k) + hundredths(task.s)) * hundredths(task.q);
        expect(numerator % 10000n).toBe(5000n);
        expect(numerator / 10000n % 2n).toBe(0n);
        expect(correct.minimum - shown.minimum).toBe(1);
      }
      expect(explanations).toHaveLength(4);
      expect(new Set(explanations.map(option => option.id)).size).toBe(4);
      expect(new Set(explanations.map(option => option.label)).size).toBe(4);
      const correctPosition = explanations.findIndex(option => option.id === error);
      expect(correctPosition).toBeGreaterThanOrEqual(0);
      correctChoices.add(correctPosition);
    }

    const final = generateFinalSheet(seeds.final);
    finalBases.add(final.baseSource);
    expect(positiveCents([final.federal, final.regional, final.base, final.total])).toBe(true);
    expect(final.rows).toHaveLength(4);
    expect(new Set(final.rows.map(row => row.violation))).toEqual(new Set([true, false]));
    for (const row of final.rows) {
      checkPayments(row.payments, row.w);
      const result = expected(final.base, row.w, final.k, row.s, row.q);
      expect([row.minimum, row.salary, row.due]).toEqual([result.minimum, result.accrued, result.due]);
    }
    expect(final.total).toBe(final.rows.reduce((sum, row) => sum + row.due, 0));
    if (!number) expect(final.total).toBe(449625);
  }
  expect(correctChoices).toEqual(new Set([0, 1, 2, 3]));
  expect(finalBases).toEqual(new Set(['federal', 'regional']));
});

it('воспроизводит числа по номеру и различает уровни 3, 4 и финал на 1000 парах', () => {
  const numbersFor = (number: number) => {
    const seeds = variantSeeds(number);
    return [
      numericPayroll(generatePayrollTasks(seeds.workers)),
      numericAudit(generateAuditSheets(seeds.audit)),
      numericFinal(generateFinalSheet(seeds.final)),
    ].map(payload => JSON.stringify(payload));
  };
  const variants = numbers.map(numbersFor);
  for (const [index, variant] of variants.entries()) {
    expect(numbersFor(index + 1)).toEqual(variant);
    const next = variants[(index + 1) % variants.length];
    for (const [level, payload] of variant.entries()) expect(payload).not.toEqual(next[level]);
  }
  for (const level of [0, 1, 2]) expect(new Set(variants.map(variant => variant[level])).size).toBe(1000);
});

it('подбирает смешанную пятёрку и уникальные зёрна на всём диапазоне 1–9999', () => {
  const mapSeeds = new Set<number>();
  const outcomes = regionCases.map(item => assessRegion(item).complies);
  for (let number = 1; number <= 9999; number++) {
    const { map } = variantSeeds(number);
    mapSeeds.add(map);
    const cases = drawRegions(map, true).map(id => outcomes[id - 1]);
    expect(new Set(cases), `Вариант ${number}`).toEqual(new Set([true, false]));
  }
  expect(mapSeeds.size).toBe(9999);
});
