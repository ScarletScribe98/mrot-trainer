import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatAmount } from './index';
import { AUDIT_SEED, ENABLE_ROUNDING_ERRORS, auditFields, checkAuditAnswer, generateAuditSheet, generateAuditSheets, parseAuditAmount, type AuditError, type AuditSheet } from './audit';
import { assessWorker } from './training';
import { showMoney } from './payroll';
import { advanceAudit, initialProgress, loadProgress, requestAuditHint, submitAudit, validateProgress, type Progress } from '../game';

const kinds: AuditError[] = ['wrong_base', 'k_s_misapplied', 'arithmetic', 'rounding',
  'w_includes_excluded', 'rate_ignored', 'coef_in_minimum'];
const seeds = Array.from({ length: 50 }, (_, i) => i * 73893);
const answerValue = ({ row, correct }: AuditSheet) => row === 3 ? correct.source : formatAmount(correct[auditFields[row]]) + ' ₽';

describe('Ведомость с подложенной ошибкой по v5', () => {
  it.each(kinds)('%s: первая неверная строка, расчёт, ответ и вывод на 50 зёрнах', kind => {
    const labels = new Set<string>();
    const rows = new Set<number>();
    for (const [i, seed] of seeds.entries()) {
      const sheet = generateAuditSheet(seed, i % 5, kind);
      const { task, correct, shown, explanations } = sheet;
      const result = assessWorker(task);
      expect(correct).toEqual({
        source: result.base.source, base: result.base.amount, w: result.w,
        full: showMoney(result.full), minimum: showMoney(result.minimum), accrued: showMoney(result.accrued),
        due: showMoney(result.due), violation: !result.complies,
      });
      const differences = [
        shown.base !== correct.base || shown.source !== correct.source ? 3 : null,
        shown.w !== correct.w ? 7 : null, shown.full !== correct.full ? 8 : null,
        shown.minimum !== correct.minimum ? 9 : null, shown.accrued !== correct.accrued ? 10 : null,
        shown.due !== correct.due ? 11 : null, shown.violation !== correct.violation ? 12 : null,
      ].filter(row => row !== null);
      expect(differences[0]).toBe(sheet.row);
      expect(shown.violation).toBe(shown.due > 0);
      if (kind === 'rounding') {
        expect(differences).toEqual([9]);
        expect(correct.minimum - shown.minimum).toBe(1);
      } else expect(Math.abs(shown.due - correct.due)).toBeGreaterThanOrEqual(10000);
      if (kind === 'wrong_base') expect(shown.base).toBe(Math.min(task.federal, task.regional));
      if (kind === 'w_includes_excluded') {
        expect(shown.w - correct.w).toBe(task.payments.find(item => !item.inW)?.cents);
        expect(shown.violation).toBe(false);
      }
      if (kind === 'rate_ignored') expect(shown.minimum).toBe(correct.full);
      if (kind === 'coef_in_minimum') expect(shown.due).toBe(0);
      if (sheet.row === 8) {
        const k = Math.round(Number(task.k) * 100);
        const s = Math.round(Number(task.s) * 100);
        const justCoefficient = Math.round(correct.base * k / 100);
        const variants = [Math.round(correct.base * k * (100 + s) / 10000), justCoefficient + s, justCoefficient];
        expect(variants.includes(shown.full)).toBe(kind === 'k_s_misapplied');
      }
      expect(explanations).toHaveLength(4);
      expect(new Set(explanations.map(option => option.id)).size).toBe(4);
      labels.add(explanations.find(option => option.id === kind)!.label);
      rows.add(sheet.row);
      expect(checkAuditAnswer(sheet, { step: 'row', value: sheet.row })).toBe(true);
      expect(checkAuditAnswer(sheet, { step: 'row', value: 12 })).toBe(false);
      expect(checkAuditAnswer(sheet, { step: 'row', value: 1 })).toBe(false);
      expect(checkAuditAnswer(sheet, { step: 'explanation', value: kind })).toBe(true);
      expect(checkAuditAnswer(sheet, { step: 'explanation', value: explanations.find(option => option.id !== kind)!.id })).toBe(false);
      expect(checkAuditAnswer(sheet, { step: 'correction', value: answerValue(sheet) })).toBe(true);
      const incorrect = sheet.row === 3 ? shown.source : formatAmount(shown[auditFields[sheet.row]]);
      expect(checkAuditAnswer(sheet, { step: 'correction', value: incorrect })).toBe(false);
    }
    if (kind === 'arithmetic') expect(rows).toEqual(new Set([8, 11]));
    if (kind === 'k_s_misapplied') expect(labels.size).toBe(3);
  });

  it('выдаёт пять разных листов, три новых ошибки и округление по каждому зерну', () => {
    expect(ENABLE_ROUNDING_ERRORS).toBe(true);
    const optionOrders = new Set<string>();
    const observed = new Set<AuditError>();
    for (const seed of seeds) {
      const sheets = generateAuditSheets(seed);
      expect(sheets).toEqual(generateAuditSheets(seed));
      expect(sheets).toHaveLength(5);
      expect(new Set(sheets.map(({ task }) => task.name)).size).toBe(5);
      const types = sheets.map(({ error }) => error);
      expect(new Set(types).size).toBe(5);
      expect(types).toEqual(expect.arrayContaining(kinds.slice(3)));
      for (const { error, explanations } of sheets) {
        observed.add(error);
        optionOrders.add(explanations.map(({ id }) => id).join(','));
      }
    }
    expect(observed).toEqual(new Set(kinds));
    expect(optionOrders.size).toBeGreaterThan(1);
    expect(generateAuditSheets(AUDIT_SEED)).not.toEqual(generateAuditSheets(AUDIT_SEED + 1));
  });

  it('принимает рубли с пробелами, запятой и знаком ₽', () => {
    for (const amount of ['12 345,67 ₽', '12\u00a0345,67\u202f₽', '₽ 12\u202f345,67', '12345.67']) {
      expect(parseAuditAmount(amount)).toBe(1234567);
    }
    for (const amount of ['-1 ₽', '₽1₽', '12,345 ₽', '₽', '1e5', '1 ₽ 2', '90071992547410']) {
      expect(parseAuditAmount(amount)).toBeNull();
    }
  });
});

function solve(progress: Progress, sheet: AuditSheet): Progress {
  const row = submitAudit(progress, sheet, { step: 'row', value: sheet.row }).progress;
  const explained = submitAudit(row, sheet, { step: 'explanation', value: sheet.error }).progress;
  return submitAudit(explained, sheet, { step: 'correction', value: answerValue(sheet) }).progress;
}

describe('Прогресс аудита', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('начисляет XP за три верных шага, серию и завершение без повторного зачёта', () => {
    let progress = initialProgress();
    const sheets = generateAuditSheets(progress.audit.seed);
    expect(advanceAudit(progress)).toBe(progress);
    for (const [index, sheet] of sheets.entries()) {
      const skipped = submitAudit(progress, sheet, { step: 'correction', value: answerValue(sheet) });
      expect(skipped.correct).toBe(false);
      expect(skipped.progress).toBe(progress);
      progress = solve(progress, sheet);
      expect(progress.audit.cards[index].reward).toBe(index === 2 ? 150 : 100);
      expect(solve(progress, sheet)).toBe(progress);
      progress = advanceAudit(progress);
    }
    expect(progress.xp).toBe(550);
    expect(progress.audit.earned).toBe(550);
    expect(progress.audit.completed).toBe(true);
    expect(progress.completed).toEqual([4]);
    expect(progress.run).toEqual(initialProgress().run);
  });

  it('считает ошибки по шагам и отличает исправление, подсказку и разбор', () => {
    const initial = initialProgress();
    const sheet = generateAuditSheets(initial.audit.seed)[0];
    const first = submitAudit(initial, sheet, { step: 'row', value: 12 }).progress;
    expect(first.audit.cards[0]).toMatchObject({ attempts: 1, hint: false, step: 'row' });
    expect(solve(first, sheet).xp).toBe(70);
    expect(solve(requestAuditHint(initial), sheet).xp).toBe(50);
    const found = submitAudit(first, sheet, { step: 'row', value: sheet.row }).progress;
    const wrongExplanation = sheet.explanations.find(option => option.id !== sheet.error)!.id;
    const repeated = submitAudit(found, sheet, { step: 'explanation', value: wrongExplanation }).progress;
    expect(repeated.audit.cards[0]).toMatchObject({ attempts: 2, hint: true, step: 'explanation' });
    const explained = submitAudit(repeated, sheet, { step: 'explanation', value: sheet.error }).progress;
    expect(submitAudit(explained, sheet, { step: 'correction', value: answerValue(sheet) }).progress.xp).toBe(50);
  });

  it('читает старое сохранение уровня 3 и сохраняет новые шаги независимо', () => {
    const levelThree = initialProgress();
    const old = { ...levelThree, xp: 50, audit: undefined, methodVersion: undefined };
    vi.stubGlobal('localStorage', { getItem: () => JSON.stringify(old) });
    const migrated = loadProgress();
    expect(migrated.xp).toBe(50);
    expect(migrated.run).toEqual(levelThree.run);
    expect(migrated.audit).toEqual(levelThree.audit);
    const sheet = generateAuditSheets(migrated.audit.seed)[0];
    const found = submitAudit(migrated, sheet, { step: 'row', value: sheet.row }).progress;
    vi.stubGlobal('localStorage', { getItem: () => JSON.stringify(found) });
    expect(loadProgress()).toEqual(found);
    expect(validateProgress({ ...found, audit: { ...found.audit, cards: [null] } })).toBe(false);
  });
});
