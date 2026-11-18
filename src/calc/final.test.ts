import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeActData } from '../act';
import { ALL_LEVELS_XP, FINAL_LEVEL } from '../config';
import { canOpenFinal, finishLevel, initialProgress, loadProgress, submitFinal, validateProgress } from '../game';
import { formatAmount, selectBase } from './index';
import { calculatePayroll, qualifyingPay, showMoney } from './payroll';
import { checkFinalAnswers, formatAllowance, generateFinalSheet, generateLegacyFinalSheet, newFinalDraft, type FinalDraft, type FinalSheet } from './final';

function solved(sheet: FinalSheet): FinalDraft {
  return {
    base: sheet.baseSource,
    rows: sheet.rows.map(row => ({ verdict: row.due > 0 ? 'yes' : 'no', amount: '₽ ' + formatAmount(row.due) })),
    total: formatAmount(sheet.total) + ' ₽',
    conclusion: sheet.total ? 'yes' : 'no',
    name: 'Александра Рябова',
  };
}

describe('Расчёт финальной ведомости', () => {
  it('по каждому из 50 зёрен воспроизводит смешанный результат и сумму строк', () => {
    const sources = new Set();
    for (let seed = 0; seed < 50; seed++) {
      const sheet = generateFinalSheet(seed * 47819);
      expect(sheet).toEqual(generateFinalSheet(seed * 47819));
      expect(sheet.rows).toHaveLength(4);
      expect(new Set(sheet.rows.map(row => row.name)).size).toBe(4);
      expect(sheet.rows.some(row => row.due > 0)).toBe(true);
      expect(sheet.rows.some(row => row.due === 0)).toBe(true);
      sources.add(sheet.baseSource);
      const base = selectBase(sheet.federal, sheet.regional);
      expect(sheet.base).toBe(base);
      for (const row of sheet.rows) {
        const result = calculatePayroll(base, sheet.k, row.s, row.q, qualifyingPay(row.payments));
        expect(row.minimum).toBe(showMoney(result.minimum));
        expect(row.salary).toBe(showMoney(result.accrued));
        expect(row.due).toBe(showMoney(result.due));
        expect(row.violation).toBe(!result.complies);
      }
      expect(new Set(sheet.rows.map(row => row.q))).toEqual(new Set(['1', '0.5', '0.75']));
      expect(sheet.total).toBe(sheet.rows.reduce((sum, row) => sum + row.due, 0));
      expect(checkFinalAnswers(sheet, solved(sheet))).toEqual([]);
    }
    expect(sources).toEqual(new Set(['federal', 'regional']));
    expect(generateFinalSheet(0)).not.toEqual(generateFinalSheet(1));
  });

  it('при неверной базе указывает только её, а при верной проверяет отдельные ячейки', () => {
    const sheet = generateFinalSheet(1);
    const draft = solved(sheet);
    expect(checkFinalAnswers(sheet, newFinalDraft())).toEqual(['base']);
    const incorrectBase = draft.base === 'federal' ? 'regional' : 'federal';
    expect(checkFinalAnswers(sheet, { ...newFinalDraft(), base: incorrectBase })).toEqual(['base']);

    const owes = sheet.rows.findIndex(row => row.due > 0);
    const noDebt = sheet.rows.findIndex(row => row.due === 0);
    draft.rows[owes].amount = '1,123 ₽';
    draft.rows[noDebt].verdict = 'yes';
    draft.total = '500 ₽';
    draft.conclusion = 'no';
    expect(new Set(checkFinalAnswers(sheet, draft))).toEqual(new Set([
      'row-' + owes + '-amount', 'row-' + noDebt + '-verdict', 'total', 'conclusion',
    ]));
    expect(formatAllowance('0.20')).toBe('20 % (0,20)');
    expect(formatAllowance('0,15')).toBe('15 % (0,15)');
  });
});

describe('Зачёт и сохранение итогового акта', () => {
  const today = new Date(2026, 10, 18, 23, 0, 0);
  afterEach(() => vi.unstubAllGlobals());

  it('открывает финал после уровней 3 и 4 и начисляет +100 и общий бонус один раз', () => {
    const blank = initialProgress();
    const one = finishLevel(blank, 3);
    expect(canOpenFinal(one)).toBe(false);
    expect(submitFinal(one, today)).toBe(one);
    const ready = finishLevel(one, 4);
    expect(canOpenFinal(ready)).toBe(true);
    expect(ready.xp).toBe(0);
    const sheet = generateFinalSheet(ready.final.seed);
    const signed = submitFinal({ ...ready, final: { ...ready.final, draft: solved(sheet) } }, today);
    expect(signed.completed).toEqual([3, 4, FINAL_LEVEL]);
    expect(signed.xp).toBe(100 + ALL_LEVELS_XP);
    expect(signed.allLevelsBonusAwarded).toBe(true);
    expect(signed.final.act).toEqual({ date: '2026-11-18', xp: 250, reward: 100, bonus: ALL_LEVELS_XP, cleanCases: 1, method: 5 });
    expect(submitFinal(signed, today)).toBe(signed);
    expect(finishLevel(signed, FINAL_LEVEL).xp).toBe(signed.xp);
    const data = makeActData(sheet, signed.final.act!, signed.final.draft.name);
    expect(data.date).toBe('18.11.2026');
    expect(data.details).toContainEqual(['Проверяющий', 'Александра Рябова']);
    expect(data.total).toBe(formatAmount(sheet.total) + ' ₽');
  });

  it('зачисляет +70 после первой ошибки и +50 после разбора или запрошенной подсказки', () => {
    const eligible = { ...initialProgress(), completed: [4, 3] };
    const draft = solved(generateFinalSheet(eligible.final.seed));
    const first = submitFinal(eligible, today);
    expect(first.final.attempts).toBe(1);
    expect(first.final.issues).toEqual(['base']);
    expect(first.xp).toBe(0);
    const second = submitFinal(first, today);
    expect(second.final.attempts).toBe(2);
    for (const [progress, reward] of [[first, 70], [second, 50], [
      { ...eligible, final: { ...eligible.final, hint: true } }, 50,
    ]] as const) {
      const signed = submitFinal({ ...progress, final: { ...progress.final, draft } }, today);
      expect(signed.final.act?.reward).toBe(reward);
      expect(signed.xp).toBe(reward + 150);
    }
  });

  it('обновляет лишь незаконченные расчёты и сохраняет старый подписанный акт', () => {
    const progress = initialProgress();
    progress.xp = 550;
    progress.completed = [3];
    progress.run.cards[0].answered = true;
    progress.audit.cards[0].step = 'explanation';
    progress.final.draft = { ...progress.final.draft, base: 'regional', total: '12', name: 'Ирина' };
    const old = { ...progress, methodVersion: undefined };
    vi.stubGlobal('localStorage', { getItem: () => JSON.stringify(old) });
    const migrated = loadProgress();
    expect(migrated.xp).toBe(550);
    expect(migrated.completed).toEqual([3]);
    expect(migrated.run.cards[0].answered).toBe(false);
    expect(migrated.audit.cards[0].step).toBe('row');
    expect(migrated.final.draft).toEqual({ ...newFinalDraft(), name: 'Ирина' });
    expect(migrated.migrationNotice).toBe(true);
    const act = { date: '2026-11-18', xp: 1350, reward: 100, bonus: 150, cleanCases: 11 };
    old.final.act = act;
    vi.stubGlobal('localStorage', { getItem: () => JSON.stringify(old) });
    const archived = loadProgress();
    expect(archived.final.act).toEqual(act);
    const sheet = generateLegacyFinalSheet(archived.final.seed);
    expect(sheet.total).toBe(340300);
    expect(makeActData(sheet, archived.final.act!, archived.final.draft.name).columns[1]).toBe('Начислено');
  });

  it('загружает прежнее сохранение, имя и черновик без потери прошлых уровней', () => {
    const blank = initialProgress();
    const old = { ...blank, final: undefined, allLevelsBonusAwarded: undefined, completed: [3, 4], xp: 865 };
    vi.stubGlobal('localStorage', { getItem: () => JSON.stringify(old) });
    const progress = loadProgress();
    expect(progress.xp).toBe(865);
    expect(canOpenFinal(progress)).toBe(true);
    expect(progress.final).toEqual(blank.final);
    const named = { ...progress, final: { ...progress.final, draft: { ...progress.final.draft, name: 'Ирина' } } };
    vi.stubGlobal('localStorage', { getItem: () => JSON.stringify(named) });
    expect(loadProgress()).toEqual(named);
    expect(validateProgress({ ...named, final: { ...named.final, draft: { rows: null } } })).toBe(false);
  });
});
