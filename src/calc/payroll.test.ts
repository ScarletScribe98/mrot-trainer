import { describe, expect, it } from 'vitest';
import raw from '../../docs/data/etalon_examples_v5.json?raw';
import { parseAmount } from './index';
import { calculatePayroll, chooseBase, fullMinimum, payment, qualifyingPay, showMoney, takeHome } from './payroll';

const fields = ['applicable_min', 'min_with_rate', 'accrued_before_topup', 'underpay', 'take_home'] as const;
type Field = typeof fields[number];
type Example = Partial<Record<Field, string | null>> & {
  id: string; B: string; q?: string | null; k: string; s: string; salary: string | null; corresponds?: boolean;
};

function readNumber(_key: string, value: unknown, context?: { source: string }) {
  return typeof value === 'number' ? context!.source : value;
}
const { examples }: { examples: Example[] } = JSON.parse(raw, readNumber);
const auditRows = examples.map(example => {
  const base = parseAmount(example.B)!;
  const full = fullMinimum(base, example.k, example.s);
  const payroll = example.q && example.salary !== null
    ? calculatePayroll(base, example.k, example.s, example.q, parseAmount(example.salary)!) : null;
  const actual = {
    applicable_min: showMoney(full),
    min_with_rate: payroll && showMoney(payroll.minimum),
    accrued_before_topup: payroll && showMoney(payroll.accrued),
    underpay: payroll && showMoney(payroll.due),
    take_home: showMoney(takeHome(full)),
  };
  const values = fields.flatMap(key => example[key] == null ? [] : [{
    key, expected: parseAmount(example[key]!), obtained: actual[key],
  }]);
  return { id: example.id, values, expectedCompliance: example.corresponds, obtainedCompliance: payroll?.complies };
});

describe('Методичка v5, денежные эталоны', () => {
  it.each(auditRows)('$id', ({ values, expectedCompliance, obtainedCompliance }) => {
    expect(values.length).toBeGreaterThan(0);
    for (const { key, expected, obtained } of values) {
      expect(expected, key).not.toBeNull();
      expect(obtained, key).toBe(expected);
    }
    if (expectedCompliance !== undefined) expect(obtainedCompliance).toBe(expectedCompliance);
  });
  it('охватывает ровно 19 эталонов', () => expect(auditRows).toHaveLength(19));
});

describe('Точная арифметика и состав W', () => {
  it('не использует округлённый минимум для ставки и округлённые суммы для доплаты', () => {
    const result = calculatePayroll(99, '1.2', '0', '0.5', 49);
    expect(showMoney(result.full)).toBe(119);
    expect(showMoney(result.minimum)).toBe(59);
    expect(showMoney(result.accrued)).toBe(59);
    expect(showMoney(result.due)).toBe(1);
    expect(result.complies).toBe(false);
  });
  it('включает оклад за ставку и ежемесячную премию, исключает остальные перечисленные выплаты', () => {
    const items = [payment('salary', 2860000), payment('bonus', 190000), payment('night', 240000),
      payment('combination', 200000), payment('district', 100000), payment('northern', 90000), payment('overtime', 80000)];
    expect(qualifyingPay(items)).toBe(3050000);
    expect(showMoney(calculatePayroll(3125000, '1', '0', '1', qualifyingPay(items)).due)).toBe(75000);
    expect(chooseBase(2709300, 3125000, 'federal-budget')).toEqual({ amount: 2709300, source: 'federal', reason: 'federal-budget' });
  });
});
