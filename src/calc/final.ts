import { applicableMinimum, decimal, mulberry32, underpayment } from './index';
import { addExact, calculatePayroll, chooseBase, payment, qualifyingPay, showMoney, type Exact } from './payroll';
import { payAtRate, splitPay } from './training';
import { parseAuditAmount, type BaseSource } from './audit';

export const FINAL_SEED = 73105;
const workers = [
  { name: 'Ирина Ветрова', position: 'Мастер участка' },
  { name: 'Михаил Ланин', position: 'Наладчик оборудования' },
  { name: 'Ольга Синицына', position: 'Контролёр качества' },
  { name: 'Павел Чернов', position: 'Кладовщик' },
];
export type FinalVerdict = '' | 'yes' | 'no';
export interface FinalDraft {
  base: BaseSource | '';
  rows: { verdict: FinalVerdict; amount: string }[];
  total: string;
  conclusion: FinalVerdict;
  name: string;
}
export type FinalCell = 'base' | 'total' | 'conclusion' | `row-${number}-verdict` | `row-${number}-amount`;

export function newFinalDraft(): FinalDraft {
  return { base: '', rows: workers.map(() => ({ verdict: '', amount: '' })), total: '', conclusion: '', name: '' };
}

function finalInputs(seed: number) {
  const random = mulberry32(seed);
  const federal = (19000 + Math.floor(random() * 5) * 1000) * 100;
  const regional = federal + (random() < 0.5 ? -1 : 1) * (1000 + Math.floor(random() * 6) * 250) * 100;
  const { amount: base, source: baseSource } = chooseBase(federal, regional);
  const k = ['1.15', '1.20', '1.30'][Math.floor(random() * 3)];
  const offsets = random() < 0.5 ? [-1, 1, -1, 0] : [0, 1, 1, -1];
  const rotation = Math.floor(random() * workers.length);
  const allowances = ['0.10', '0.15', '0.20', '0.25'];
  const rows = workers.map((worker, index) => {
    const s = allowances[(index + rotation) % allowances.length];
    const gap = 67500 + Math.floor(random() * 8700) * 25;
    return { ...worker, s, gap, direction: offsets[(index + rotation) % offsets.length] };
  });
  return {
    organization: 'Мастерская «Полярный чертёж»',
    region: 'Полярная долина',
    period: 'Октябрь · учебный месяц',
    federal, regional, base, baseSource, k, rows,
  };
}

// Old signed acts keep the original data and amounts when opened from a stage 2 save.
export function generateLegacyFinalSheet(seed: number) {
  const { rows, ...sheet } = finalInputs(seed);
  const legacyRows = rows.map(({ gap, direction, ...worker }) => {
    const minimum = applicableMinimum(sheet.base, sheet.k, worker.s);
    const salary = minimum + gap * direction;
    return { ...worker, minimum, salary, due: underpayment(salary, minimum) };
  });
  return { ...sheet, rows: legacyRows, total: legacyRows.reduce((sum, row) => sum + row.due, 0) };
}

export function generateFinalSheet(seed: number) {
  const { rows, ...sheet } = finalInputs(seed);
  const rates = ['1', '0.75', '0.5', '1'];
  const assessed = rows.map(({ gap, direction, ...worker }, index) => {
    const q = rates[index];
    // Whole-ruble gaps make displayed row amounts and the exact sum agree in the exercise.
    const delta = Number(BigInt(gap) / 100n * 100n) * direction;
    const w = payAtRate(sheet.base, q) + delta;
    const excluded = index === 1 ? payment('night', 192500) : index === 3 ? payment('combination', 175000) : undefined;
    const payments = splitPay(w, 98000 + index * 12000, excluded);
    const result = calculatePayroll(sheet.base, sheet.k, worker.s, q, qualifyingPay(payments));
    return { ...worker, q, payments, result };
  });
  const total = showMoney(assessed.reduce<Exact>((sum, row) => addExact(sum, row.result.due), [0n, 1n]));
  const finalRows = assessed.map(({ result, ...row }) => ({
    ...row, w: result.w, minimum: showMoney(result.minimum), salary: showMoney(result.accrued),
    due: showMoney(result.due), violation: !result.complies,
  }));
  return { ...sheet, rows: finalRows, total };
}

export type FinalSheet = ReturnType<typeof generateFinalSheet>;

export function checkFinalAnswers(sheet: FinalSheet, draft: FinalDraft): FinalCell[] {
  if (draft.base !== sheet.baseSource) return ['base'];
  const issues: FinalCell[] = [];
  sheet.rows.forEach((row, index) => {
    const answer = draft.rows[index];
    const violation = row.violation;
    if (answer?.verdict !== (violation ? 'yes' : 'no')) issues.push(`row-${index}-verdict`);
    if (violation && answer?.verdict === 'yes' && parseAuditAmount(answer.amount) !== row.due) {
      issues.push(`row-${index}-amount`);
    }
  });
  if (parseAuditAmount(draft.total) !== sheet.total) issues.push('total');
  if (draft.conclusion !== (sheet.rows.some(row => row.violation) ? 'yes' : 'no')) issues.push('conclusion');
  return issues;
}

function formatDecimal(n: bigint, d: bigint, minPlaces: number) {
  const fractional = (n % d).toString().padStart(d.toString().length - 1, '0')
    .replace(/0+$/, '').padEnd(minPlaces, '0');
  return (n / d).toString() + (fractional ? ',' + fractional : '');
}

export function formatAllowance(s: string) {
  const [n, d] = decimal(s);
  return formatDecimal(n * 100n, d, 0) + ' % (' + formatDecimal(n, d, 2) + ')';
}
