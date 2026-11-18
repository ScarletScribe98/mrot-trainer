import { describe, expect, it } from 'vitest';
import historyFixture from '../../../docs/data/DATA_v5_dlya_Kaya.md?raw';
import conditionFixture from '../../../docs/data/USLOVIYA_variantov_v5.md?raw';
import fixtures from '../../../docs/data/etalon_examples_v5.json';
import { formatAmount, parseAmount } from '../../calc';
import { finishLevel, initialProgress, nextHistory, submitHistory, submitRegional, validateProgress } from '../../game';
import { assessRegion, checkBasis, checkMinimum, checkTopup, chronological, drawRegions, historyPairs,
  milestones, ratioHigher, regionCases, sortKey, sortStart } from './study';

const columns = (line: string) => line.trim().slice(1, -1).split('|').map(value => value.trim());
const splitBlock = (text: string, first: string, last: string) => text.split(first)[1].split(last)[0];

describe('Исторические данные методички', () => {
  it('переносит все 14 строк таблицы 7 дословно, включая отношения, примечания и проект', () => {
    const block = splitBlock(historyFixture, '### 3.1.', '### 3.2.');
    const rawRows = block.split('\n').filter(line => /^\|\s*\d{4}/.test(line)).map(columns);
    expect(rawRows).toHaveLength(14);
    expect(milestones.map(row => [
      row.year + (row.project ? ', проект' : ''), row.mrot, row.pm, row.ratio, row.event,
    ])).toEqual(rawRows);
    expect(milestones.filter(m => m.denominated).map(m => m.year)).toEqual([1992, 1997]);
    expect(milestones.every(row => row.source === 'п. 2.4, табл. 7')).toBe(true);
  });
  it('пять сравнений обходятся без равных отношений и незаполненных пар', () => {
    expect(historyPairs).toHaveLength(5);
    expect(historyPairs.every(([a, b]) => a.year > 1991 && b.year > 1991 && a.ratio !== b.ratio)).toBe(true);
    expect(historyPairs.map(([a,b]) => ratioHigher(a,b))).toEqual([false,true,false,true,false]);
    expect(chronological(sortStart)).toBe(false);
    expect(chronological(sortKey)).toBe(true);
  });
});

describe('Карта минимумов', () => {
  it('проверяет десять условий, источники табл. 9 и четыре суммы из табл. 12', () => {
    const reference = fixtures.examples.filter(example => example.id.startsWith('var'));
    expect(reference).toHaveLength(10);
    expect(regionCases).toHaveLength(10);
    const context = splitBlock(historyFixture, '### 4.3.', '## 5. Эталонные')
      .split('\n').filter(line => line.startsWith('|')).slice(2).map(columns);
    expect(context).toHaveLength(10);
    for (const [i, item] of regionCases.entries()) {
      const example = reference[i];
      const raw = conditionFixture.split('### Вариант ' + item.id + '. ')[1].split('|')[0];
      const paragraphs = raw.split('\n').filter(line => line.startsWith('> ')).slice(0, 2).map(line => line.trim().slice(2));
      expect(item.condition).toEqual(paragraphs);
      expect(item.source).toContain('п. 4.2');
      expect(context).toContainEqual([item.context.region, item.context.load, item.context.relative, item.context.baskets ?? '—']);
      expect(item.context.source).toContain('табл. 9');
      const result = assessRegion(item);
      const expected = (value: number | null | undefined) => parseAmount(String(value));
      expect(result.base.amount, example.id).toBe(expected(example.B));
      expect(result.base.reason, example.id).toBe(item.agreement.reason);
      expect(result.w, example.id).toBe(expected(example.salary));
      expect(result.full, example.id).toBe(expected(example.applicable_min));
      expect(result.minimum, example.id).toBe(expected(example.min_with_rate));
      expect(result.due, example.id).toBe(expected(example.underpay));
      expect(result.complies, example.id).toBe(example.corresponds);
      expect(checkBasis(item, result.base.source, result.base.reason)).toBe(true);
      expect(checkTopup(item, result.complies ? 'yes' : 'no', formatAmount(result.due))).toBe(true);
    }
    expect(assessRegion(regionCases[7]).due).toBe(27313);
    expect(regionCases[2].mistakes?.minimum).toBeUndefined();
    expect(regionCases[7].mistakes?.due).toBeUndefined();
  });
  it('не пропускает ошибочный порядок s или коэффициент k в варианте 9', () => {
    const item = regionCases[8];
    expect(item.mistakes?.minimum).toContain(5418600);
    expect(checkMinimum(item, '1,7', '0,3', '54 186,00')).toBe(false);
    expect(checkMinimum(item, '1,5', '0,5', '54 186,00')).toBe(false);
    expect(checkMinimum(item, '1,7', '0,3', '48 767,40')).toBe(false);
    expect(checkMinimum(item, '1,5', '0,3', '48 767,40 ₽')).toBe(true);
  });
  it('выбирает пять разных доступных регионов по seed', () => {
    const touched = new Set<number>();
    for (let seed = 0; seed < 50; seed++) {
      const ids = drawRegions(seed);
      expect(ids).toEqual(drawRegions(seed));
      expect(new Set(ids).size).toBe(5);
      for (const id of ids) touched.add(id);
    }
    expect(touched.size).toBe(10);
  });
});

describe('Опыт двух новых уровней', () => {
  it('даёт 100 / 70 / 50 XP и включает уровни 1 и 2 в однократный общий бонус', () => {
    let p = [3, 4, 5].reduce(finishLevel, initialProgress());
    expect(p.xp).toBe(0);
    p = submitHistory(submitHistory(p, false), true);
    expect(p.xp).toBe(70);
    expect(submitHistory(p, true)).toBe(p);
    p = nextHistory(p);
    for (let i = 1; i <= 5; i++) p = nextHistory(submitHistory(p, true));
    expect(p.completed).toContain(1);
    expect(p.xp).toBe(570);
    const ids = drawRegions(p.study.map.seed);
    p = submitRegional(submitRegional(p, ids[0], false), ids[0], false);
    for (const id of ids) {
      for (let step = 0; step < 3; step++) p = submitRegional(p, id, true);
      expect(submitRegional(p, id, true)).toBe(p);
    }
    expect(p.xp).toBe(1170);
    expect(p.completed).toContain(2);
    expect(finishLevel(p, 2).xp).toBe(1170);
    expect(validateProgress(p)).toBe(true);
    const legacy = { ...initialProgress(), completed: [3, 4, 5], xp: 1350, allLevelsBonusAwarded: true };
    expect(finishLevel(finishLevel(legacy, 1), 2).xp).toBe(1350);
  });
});
