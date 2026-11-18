import { applicableMinimum, mulberry32, selectBase, underpayment } from './index';
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

export function generateFinalSheet(seed: number) {
  const random = mulberry32(seed);
  const federal = (19000 + Math.floor(random() * 5) * 1000) * 100;
  const regional = federal + (random() < 0.5 ? -1 : 1) * (1000 + Math.floor(random() * 6) * 250) * 100;
  const base = selectBase(federal, regional);
  const baseSource: BaseSource = base === federal ? 'federal' : 'regional';
  const k = ['1.15', '1.20', '1.30'][Math.floor(random() * 3)];
  const offsets = random() < 0.5 ? [-1, 1, -1, 0] : [0, 1, 1, -1];
  const rotation = Math.floor(random() * workers.length);
  const allowances = ['0.10', '0.15', '0.20', '0.25'];
  const rows = workers.map((worker, index) => {
    const s = allowances[(index + rotation) % allowances.length];
    const minimum = applicableMinimum(base, k, s);
    const gap = 67500 + Math.floor(random() * 8700) * 25;
    const salary = minimum + gap * offsets[(index + rotation) % offsets.length];
    return { ...worker, s, minimum, salary, due: underpayment(salary, minimum) };
  });
  const total = rows.reduce((sum, row) => sum + row.due, 0);
  return {
    organization: 'Мастерская «Полярный чертёж»',
    region: 'Полярная долина',
    period: 'Октябрь · учебный месяц',
    federal, regional, base, baseSource, k, rows, total,
  };
}

export type FinalSheet = ReturnType<typeof generateFinalSheet>;

export function checkFinalAnswers(sheet: FinalSheet, draft: FinalDraft): FinalCell[] {
  if (draft.base !== sheet.baseSource) return ['base'];
  const issues: FinalCell[] = [];
  sheet.rows.forEach((row, index) => {
    const answer = draft.rows[index];
    const violation = row.due > 0;
    if (answer?.verdict !== (violation ? 'yes' : 'no')) issues.push(`row-${index}-verdict`);
    if (violation && answer?.verdict === 'yes' && parseAuditAmount(answer.amount) !== row.due) {
      issues.push(`row-${index}-amount`);
    }
  });
  if (parseAuditAmount(draft.total) !== sheet.total) issues.push('total');
  if (draft.conclusion !== (sheet.total > 0 ? 'yes' : 'no')) issues.push('conclusion');
  return issues;
}

export function formatAllowance(s: string) {
  const fraction = Number(s.replace(',', '.'));
  const percentLabel = (fraction * 100).toLocaleString('ru-RU', { maximumFractionDigits: 4 });
  const fractionLabel = fraction.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 6 });
  return percentLabel + ' % (' + fractionLabel + ')';
}
