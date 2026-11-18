import { afterEach, describe, expect, it, vi } from 'vitest';
import { applicableMinimum, calculationConfig, formatAmount, selectBase, underpayment } from './index';
import { AUDIT_SEED, ENABLE_ROUNDING_ERRORS, checkAuditAnswer, generateAuditSheet, generateAuditSheets, parseAuditAmount, type AuditError, type AuditSheet } from './audit';
import { advanceAudit, initialProgress, loadProgress, requestAuditHint, submitAudit, validateProgress, type Progress } from '../game';

const kinds: AuditError[] = ['wrong_base', 'k_s_misapplied', 'arithmetic', 'rounding'];
const seeds = Array.from({ length: 50 }, (_, i) => i * 73893);
const answerValue = ({ row, correct }: AuditSheet) => row === 3 ? correct.source : formatAmount(row === 6 ? correct.minimum : correct.due) + ' ₽';

describe('Ведомость с подложенной ошибкой', () => {
  it.each(kinds)('%s: первая неверная строка и пересчёт на 50 зернах', kind => {
    const rows = new Set<number>();
    const labels = new Set<string>();
    const baseDirections = new Set<string>();
    for (const [i, seed] of seeds.entries()) {
      const sheet = generateAuditSheet(seed, i % 5, kind);
      const { task, correct, shown, explanations } = sheet;
      const federalOrRegional = selectBase(task.federal, task.regional);
      const minimum = applicableMinimum(federalOrRegional, task.k, task.s);
      const due = underpayment(task.salary, minimum);
      expect(correct).toEqual({
        source: federalOrRegional === task.federal ? 'federal' : 'regional',
        base: federalOrRegional, minimum, due, violation: due > 0,
      });
      const different = [
        shown.base !== correct.base || shown.source !== correct.source ? 3 : null,
        shown.minimum !== correct.minimum ? 6 : null,
        shown.due !== correct.due ? 8 : null,
        shown.violation !== correct.violation ? 9 : null,
      ].filter(row => row !== null);
      expect(different[0]).toBe(sheet.row);
      expect(shown.violation).toBe(shown.due > 0);
      if (kind === 'rounding') expect(Math.abs(shown.due - due)).toBe(1);
      else expect(Math.abs(shown.due - due)).toBeGreaterThanOrEqual(10000);
      if (sheet.row !== 8) expect(shown.due).toBe(underpayment(task.salary, shown.minimum));
      if (kind === 'wrong_base') {
        expect(sheet.row).toBe(3);
        expect(shown.base).toBe(Math.min(task.federal, task.regional));
        expect(shown.minimum).toBe(applicableMinimum(shown.base, task.k, task.s));
        baseDirections.add(correct.source);
      }
      if (kind === 'k_s_misapplied' || kind === 'rounding') expect(sheet.row).toBe(6);
      if (sheet.row === 6 && (kind === 'k_s_misapplied' || kind === 'arithmetic')) {
        const k = Math.round(Number(task.k) * 100);
        const s = Math.round(Number(task.s) * 100);
        const withExtraFactor = Math.round(correct.base * k * (100 + s) / 10000);
        const justCoefficient = Math.round(correct.base * k / 100);
        const misapplied = [withExtraFactor, justCoefficient + s, justCoefficient];
        expect(misapplied.includes(shown.minimum)).toBe(kind === 'k_s_misapplied');
      }
      expect(shown.source === 'federal' ? task.federal : task.regional).toBe(shown.base);
      expect(explanations).toHaveLength(kind === 'rounding' ? 4 : 3);
      expect(new Set(explanations.map(option => option.id)).size).toBe(explanations.length);
      labels.add(explanations.find(option => option.id === kind)!.label);
      rows.add(sheet.row);

      expect(checkAuditAnswer(sheet, { step: 'row', value: sheet.row })).toBe(true);
      expect(checkAuditAnswer(sheet, { step: 'row', value: 9 })).toBe(false);
      expect(checkAuditAnswer(sheet, { step: 'row', value: 1 })).toBe(false);
      expect(checkAuditAnswer(sheet, { step: 'explanation', value: kind })).toBe(true);
      expect(checkAuditAnswer(sheet, { step: 'explanation', value: explanations.find(option => option.id !== kind)!.id })).toBe(false);
      expect(checkAuditAnswer(sheet, { step: 'correction', value: answerValue(sheet) })).toBe(true);
      const incorrect = sheet.row === 3 ? shown.source : formatAmount(sheet.row === 6 ? shown.minimum : shown.due);
      expect(checkAuditAnswer(sheet, { step: 'correction', value: incorrect })).toBe(false);
    }
    if (kind === 'arithmetic') expect(rows).toEqual(new Set([6, 8]));
    if (kind === 'k_s_misapplied') expect(labels.size).toBe(3);
    if (kind === 'wrong_base') expect(baseDirections).toEqual(new Set(['federal', 'regional']));
  });

  it('выдаёт пять разных листов и три включённых типа по каждому зерну', () => {
    expect(ENABLE_ROUNDING_ERRORS).toBe(false);
    const optionOrders = new Set<string>();
    for (const seed of seeds) {
      const sheets = generateAuditSheets(seed);
      expect(sheets).toEqual(generateAuditSheets(seed));
      expect(sheets).toHaveLength(5);
      expect(new Set(sheets.map(({ task }) => task.name)).size).toBe(5);
      expect(new Set(sheets.map(({ error }) => error))).toEqual(new Set(kinds.slice(0, 3)));
      expect(sheets.every(sheet => sheet.explanations.every(({ id }) => id !== 'rounding'))).toBe(true);
      for (const { explanations } of sheets) optionOrders.add(explanations.map(({ id }) => id).join(','));
    }
    expect(optionOrders.size).toBeGreaterThan(1);
    expect(generateAuditSheets(AUDIT_SEED)).not.toEqual(generateAuditSheets(AUDIT_SEED + 1));
  });

  it('ошибка округления использует альтернативу и при настройке down', () => {
    const rounding = calculationConfig.rounding;
    try {
      calculationConfig.rounding = 'down';
      const sheet = generateAuditSheet(AUDIT_SEED, 0, 'rounding');
      expect(sheet.shown.minimum - sheet.correct.minimum).toBe(1);
    } finally { calculationConfig.rounding = rounding; }
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
    const first = submitAudit(initial, sheet, { step: 'row', value: 9 }).progress;
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
    const old = { ...levelThree, xp: 50, audit: undefined };
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
