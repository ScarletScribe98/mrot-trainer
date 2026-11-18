import { applicableMinimum, decimal, generateTasks, mulberry32, parseAmount, roundMoney, selectBase, underpayment, calculationConfig, type Task } from './index';

// TODO(Эрика): включить после подтверждения правила округления по методичке.
export const ENABLE_ROUNDING_ERRORS = false;
export const AUDIT_SEED = 73104;
const activeErrors = ['wrong_base', 'k_s_misapplied', 'arithmetic'] as const;
export type AuditError = (typeof activeErrors)[number] | 'rounding';
export type AuditRow = 3 | 6 | 8;
export type BaseSource = 'federal' | 'regional';
export const baseLabels: Record<BaseSource, string> = { federal: 'МРОТ', regional: 'Региональный минимум' };

interface Calculation {
  source: BaseSource;
  base: number;
  minimum: number;
  due: number;
  violation: boolean;
}
interface Explanation { id: AuditError; label: string }
export interface AuditSheet {
  task: Task & { regional: number };
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
  wrong_base: 'Взята меньшая из двух баз',
  k_s_misapplied: 'Коэффициент и надбавка применены неверно',
  arithmetic: 'Допущена ошибка в вычислении',
  rounding: 'Копейки округлены неверно',
};
const misapplicationLabels = [
  'Базу умножили на k, затем на (1 + s)',
  'Долю s прибавили как сумму в рублях',
  'В расчёте учли только районный коэффициент',
];

function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function misappliedMinimum(task: Task, base: number, variant: number): number {
  const [kn, kd] = decimal(task.k);
  const [sn, sd] = decimal(task.s);
  const product = BigInt(base) * kn;
  if (variant === 0) return roundMoney(product * (sd + sn), kd * sd);
  if (variant === 1) return roundMoney(product * sd + sn * kd * 100n, kd * sd);
  return roundMoney(product, kd);
}

function makeSheet(profile: Task, index: number, error: AuditError, random: () => number): AuditSheet {
  const federal = profile.federal + (error === 'rounding' ? 3 : 0);
  const regional = federal + (index % 2 === 0 ? 200000 : -100000);
  const k = error === 'rounding' ? '1.20' : profile.k;
  const s = error === 'rounding' ? '0.30' : profile.s;
  const base = selectBase(federal, regional);
  const minimum = applicableMinimum(base, k, s);
  // A gap of at least 1,000 ₽ keeps a change visible even if the wrong minimum falls below salary.
  const salary = minimum - (100000 + Math.floor(random() * 8000) * 25);
  const task = { ...profile, id: '04-' + (index + 1), federal, regional, k, s, salary };
  const source = base === regional ? 'regional' : 'federal';
  const due = underpayment(salary, minimum);
  const correct: Calculation = { source, base, minimum, due, violation: due > 0 };

  const shown = { ...correct };
  let row: AuditRow = 6;
  let explanation = explanations[error];
  switch (error) {
    case 'wrong_base':
      row = 3;
      shown.source = source === 'federal' ? 'regional' : 'federal';
      shown.base = shown.source === 'regional' ? regional : federal;
      shown.minimum = applicableMinimum(shown.base, k, s);
      break;
    case 'k_s_misapplied': {
      const variant = Math.floor(random() * misapplicationLabels.length);
      shown.minimum = misappliedMinimum(task, base, variant);
      explanation = misapplicationLabels[variant];
      break;
    }
    case 'arithmetic': {
      row = random() < 0.5 ? 6 : 8;
      let rubles = 100 + Math.floor(random() * 1901);
      const direction = random() < 0.5 ? -100 : 100;
      if (row === 6) {
        const otherErrors = misapplicationLabels.map((_, variant) => misappliedMinimum(task, base, variant));
        // An arithmetic error must be distinguishable from the three incorrect formulas.
        while (otherErrors.includes(minimum + rubles * direction)) rubles = rubles === 2000 ? 100 : rubles + 1;
        shown.minimum += rubles * direction;
      } else shown.due = Math.max(0, due + rubles * direction);
      break;
    }
    case 'rounding': {
      const alternate = calculationConfig.rounding === 'half-up' ? 'down' : 'half-up';
      shown.minimum = applicableMinimum(base, k, s, alternate);
      break;
    }
  }
  if (row !== 8) shown.due = underpayment(salary, shown.minimum);
  shown.violation = shown.due > 0;

  const choices: AuditError[] = [...activeErrors];
  if (ENABLE_ROUNDING_ERRORS || error === 'rounding') choices.push('rounding');
  return {
    task, correct, shown, error, row,
    explanations: shuffle(choices, random).map(id => ({ id, label: id === error ? explanation : explanations[id] })),
  };
}

export function generateAuditSheet(seed: number, index: number, error: AuditError): AuditSheet {
  const random = mulberry32(seed ^ Math.imul(index + 1, 0x9E3779B9));
  return makeSheet(generateTasks(seed)[index], index, error, random);
}

export function generateAuditSheets(seed: number): AuditSheet[] {
  const random = mulberry32(seed);
  const pool: AuditError[] = [...activeErrors];
  if (ENABLE_ROUNDING_ERRORS) pool.push('rounding');
  const errors = [...pool];
  while (errors.length < 5) errors.push(pool[Math.floor(random() * pool.length)]);
  const profiles = generateTasks(seed);
  return shuffle(errors, random).map((error, index) => makeSheet(profiles[index], index, error, random));
}

export function parseAuditAmount(value: string): number | null {
  return parseAmount(value.trim().replace(/^(₽\s*)|(\s*₽)$/u, ''));
}

export function checkAuditAnswer(sheet: AuditSheet, answer: AuditAnswer): boolean {
  if (answer.step === 'row') return answer.value === sheet.row;
  if (answer.step === 'explanation') return answer.value === sheet.error;
  if (sheet.row === 3) return answer.value === sheet.correct.source;
  return parseAuditAmount(answer.value) === (sheet.row === 6 ? sheet.correct.minimum : sheet.correct.due);
}
