import { describe, expect, it } from 'vitest';
import { applicableMinimum, selectBase, underpayment, roundMoney, parseAmount, formatAmount, generateTasks } from './index';
describe('Применимый минимум: учебный контракт', () => {
 it('умножает базу на сумму коэффициента и надбавки', () => expect(applicableMinimum(2000000, '1.2', '0.3')).toBe(3000000));
 it('не перемножает коэффициент с надбавкой', () => expect(applicableMinimum(1000000, '1.5', '0.5')).toBe(2000000));
 it.each([[100, null, 100], [100, 90, 100], [100, 150, 150], [100, 100, 100], [100, undefined, 100]])('выбирает большую заданную базу: %s / %s', (f, r, expected) => expect(selectBase(f, r)).toBe(expected));
 it.each([[300, 200, 0], [200, 200, 0], [125, 200, 75]])('недоплата неотрицательна', (salary, min, expected) => expect(underpayment(salary, min)).toBe(expected));
 it('не теряет копейки из-за floating point', () => { expect(applicableMinimum(10, '0.1', '0.2')).toBe(3); expect(applicableMinimum(1999999, '1.15', '0.25')).toBe(2799999); });
 it('округляет ровно половину вверх, в одном месте', () => { expect(roundMoney(1005n, 10n)).toBe(101); expect(roundMoney(1004n, 10n)).toBe(100); expect(roundMoney(1005n, 10n, 'down')).toBe(100); expect(applicableMinimum(1, '1', '0.5')).toBe(2); });
 it('отклоняет отрицательные и небезопасные суммы', () => { expect(() => selectBase(-1)).toThrow(); expect(() => underpayment(0.1, 1)).toThrow(); expect(() => applicableMinimum(100, '-1', '0')).toThrow(); expect(() => applicableMinimum(Number.MAX_SAFE_INTEGER, 2, 0)).toThrow(); });
 it('принимает рубли с пробелами, но не скрытое округление и мусор', () => { expect(parseAmount('12 345,67')).toBe(1234567); expect(parseAmount('0,01')).toBe(1); for (const s of ['-1', '1.001', '1e3', '', 'abc', '1,2,3']) expect(parseAmount(s)).toBeNull(); expect(formatAmount(1234567).replace(/\s/g, ' ')).toBe('12 345,67'); });
 it('одинаковый seed воспроизводит карточки, другой меняет числа', () => { expect(generateTasks(42)).toEqual(generateTasks(42)); expect(generateTasks(42)).not.toEqual(generateTasks(43)); });
 it('генератор сохраняет контракт для множества seed', () => { for (let seed = 0; seed < 200; seed++) { const tasks = generateTasks(seed); expect(tasks).toHaveLength(5); const gaps = tasks.map(t => underpayment(t.salary, applicableMinimum(selectBase(t.federal, t.regional), t.k, t.s))); expect(gaps.filter(g => g > 0)).toHaveLength(3); expect(gaps.every(Number.isSafeInteger)).toBe(true); } });
});
