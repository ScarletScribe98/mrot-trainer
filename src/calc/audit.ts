import { decimal, mulberry32, parseAmount } from './index';
import {
  addExact, calculatePayroll, chooseBase, multiplyExact, payment, payrollFactor, qualifyingPay, showMoney,
  type BaseSource, type Exact,
} from './payroll';
import { generatePayrollTasks, payAtRate, splitPay, type PayrollTask } from './training';

export { baseLabels, type BaseSource } from './payroll';
export const ENABLE_ROUNDING_ERRORS = true;
export const AUDIT_SEED = 73104;
const originalErrors = ['wrong_base', 'k_s_misapplied', 'arithmetic'] as const;
const newerErrors = ['w_includes_excluded', 'rate_ignored', 'coef_in_minimum'] as const;
export type AuditError = (typeof originalErrors)[number] | (typeof newerErrors)[number] | 'rounding';
export const auditFields = { 7: 'w', 8: 'full', 9: 'minimum', 10: 'accrued', 11: 'due' } as const;
export const derivedRows = [3, 7, 8, 9, 10, 11, 12] as const;
export type DerivedRow = (typeof derivedRows)[number];
export type AuditRow = Exclude<DerivedRow, 10 | 12>;

interface Calculation {
  source: BaseSource;
  base: number;
  w: number;
  full: number;
  minimum: number;
  accrued: number;
  due: number;
  violation: boolean;
}
interface Explanation { id: AuditError; label: string }
export interface AuditSheet {
  task: PayrollTask & { regional: number };
  correct: Calculation;
  shown: Calculation;
  error: AuditError;
  row: AuditRow;
  explanations: Explanation[];
}
export type AuditAnswer =
  | { step: 'row'; value: number }
  | { step: 'explanation'; value: AuditError }
  | { step: 'correction'; value: string };

const explanations: Record<AuditError, string> = {
  wrong_base: 'Взята неверная база B',
  k_s_misapplied: 'Коэффициент и надбавка применены неверно',
  arithmetic: 'Допущена ошибка в вычислении',
  rounding: 'Применено неверное округление до копеек',
  w_includes_excluded: 'В W включили выплату сверх минимума',
  rate_ignored: 'Полный минимум не пересчитали на долю ставки',
  coef_in_minimum: 'Начисление с коэффициентом сравнили с B × q',
};
const misapplicationLabels = [
  'Базу умножили на k, затем на (1 + s)',
  'Долю s прибавили к минимуму как сумму в рублях',
  'В минимуме учли только районный коэффициент',
];

function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function wrongMinimum(base: number, k: string, s: string, variant: number): Exact {
  const product = multiplyExact([BigInt(base), 1n], decimal(k));
  if (variant === 0) return multiplyExact(product, addExact([1n, 1n], decimal(s)));
  if (variant === 1) return addExact(product, multiplyExact(decimal(s), [100n, 1n]));
  return product;
}

function display(source: BaseSource, base: number, payroll: ReturnType<typeof calculatePayroll>): Calculation {
  return { source, base, w: payroll.w, full: showMoney(payroll.full), minimum: showMoney(payroll.minimum),
    accrued: showMoney(payroll.accrued), due: showMoney(payroll.due), violation: !payroll.complies };
}

function recalculateFromWrongMinimum(shown: Calculation, full: Exact, q: string, [an, ad]: Exact) {
  const [n, d] = multiplyExact(full, decimal(q));
  const difference = n * ad - an * d;
  shown.full = showMoney(full);
  shown.minimum = showMoney([n, d]);
  shown.due = difference > 0n ? showMoney([difference, d * ad]) : 0;
  shown.violation = difference > 0n;
}

function roundHalfEven([n, d]: Exact) {
  const floor = n / d;
  return (n % d) * 2n === d && floor % 2n === 0n ? Number(floor) : showMoney([n, d]);
}

function makeSheet(profile: PayrollTask, index: number, error: AuditError, random: () => number): AuditSheet {
  const federal = profile.federal;
  const regional = federal + (error === 'rounding' ? 147500 : index % 2 === 0 ? 200000 : -100000);
  const k = error === 'rounding' ? '1.15' : profile.k;
  const s = error === 'rounding' ? '0' : profile.s;
  const q = error === 'rounding' ? '0.5' : error === 'rate_ignored' ? (random() < .5 ? '0.5' : '0.75')
    : error === 'coef_in_minimum' ? '1' : profile.q;
  const { source, amount: base } = chooseBase(federal, regional);
  const gap = (1600 + Math.floor(random() * 401)) * 100;
  const w = payAtRate(base, q) - gap;
  const excluded = error === 'w_includes_excluded'
    ? payment(index % 2 ? 'combination' : 'night', gap + 30000)
    : profile.payments.find(item => !item.inW);
  const payments = splitPay(w, 86000, excluded);
  const task = { ...profile, id: '04-' + (index + 1), federal, regional, k, s, q, payments };
  const exact = calculatePayroll(base, k, s, q, qualifyingPay(payments));
  const correct = display(source, base, exact);
  let shown = { ...correct };
  let row: AuditRow = 8;
  let explanation = explanations[error];
  switch (error) {
    case 'wrong_base': {
      row = 3;
      const other = source === 'federal' ? 'regional' : 'federal';
      const otherBase = task[other];
      shown = display(other, otherBase, calculatePayroll(otherBase, k, s, q, w));
      break;
    }
    case 'k_s_misapplied': {
      const variant = Math.floor(random() * misapplicationLabels.length);
      recalculateFromWrongMinimum(shown, wrongMinimum(base, k, s, variant), q, exact.accrued);
      explanation = misapplicationLabels[variant];
      break;
    }
    case 'arithmetic': {
      row = random() < 0.5 ? 8 : 11;
      let rubles = 100 + Math.floor(random() * 1901);
      if (row === 8) {
        const alternatives = misapplicationLabels.map((_, i) => showMoney(wrongMinimum(base, k, s, i)));
        while (alternatives.includes(correct.full + rubles * 100)) rubles = rubles === 2000 ? 100 : rubles + 1;
        recalculateFromWrongMinimum(shown, addExact(exact.full, [BigInt(rubles) * 100n, 1n]), q, exact.accrued);
      } else shown.due += rubles * 100;
      break;
    }
    case 'rounding':
      row = 9;
      // The base ends in 475 rubles. At k=1.15 and q=0.5 the exact value is half a kopeck above an even integer.
      shown.minimum = roundHalfEven(exact.minimum);
      break;
    case 'w_includes_excluded':
      row = 7;
      shown = display(source, base, calculatePayroll(base, k, s, q, w + excluded!.cents));
      break;
    case 'rate_ignored':
      row = 9;
      shown = display(source, base, calculatePayroll(base, k, s, '1', w));
      break;
    case 'coef_in_minimum': {
      row = 11;
      // The deliberately wrong comparison uses accrued pay with k+s against the bare B*q.
      const [bn, bd] = multiplyExact([BigInt(base), 1n], decimal(q));
      const [an, ad] = exact.accrued;
      const difference = bn * ad - an * bd;
      shown.due = difference > 0n ? showMoney(multiplyExact([difference, bd * ad], payrollFactor(k, s))) : 0;
      shown.violation = difference > 0n;
      break;
    }
  }
  const others: AuditError[] = [...originalErrors, ...newerErrors];
  if (ENABLE_ROUNDING_ERRORS) others.push('rounding');
  const choices = shuffle([error, ...shuffle(others.filter(option => option !== error), random).slice(0, 3)], random);
  return {
    task, correct, shown, error, row,
    explanations: choices.map(id => ({ id, label: id === error ? explanation : explanations[id] })),
  };
}

export function generateAuditSheet(seed: number, index: number, error: AuditError): AuditSheet {
  const random = mulberry32(seed ^ Math.imul(index + 1, 0x9E3779B9));
  return makeSheet(generatePayrollTasks(seed)[index], index, error, random);
}

export function generateAuditSheets(seed: number): AuditSheet[] {
  const random = mulberry32(seed);
  const errors: AuditError[] = [...newerErrors];
  if (ENABLE_ROUNDING_ERRORS) errors.push('rounding');
  errors.push(...shuffle(originalErrors, random).slice(0, 5 - errors.length));
  const profiles = generatePayrollTasks(seed);
  return shuffle(errors, random).map((error, index) => makeSheet(profiles[index], index, error, random));
}

export function parseAuditAmount(value: string): number | null {
  return parseAmount(value.trim().replace(/^(₽\s*)|(\s*₽)$/u, ''));
}

export function checkAuditAnswer(sheet: AuditSheet, answer: AuditAnswer): boolean {
  if (answer.step === 'row') return answer.value === sheet.row;
  if (answer.step === 'explanation') return answer.value === sheet.error;
  if (sheet.row === 3) return answer.value === sheet.correct.source;
  return parseAuditAmount(answer.value) === sheet.correct[auditFields[sheet.row]];
}
