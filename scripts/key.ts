import { formatAmount } from '../src/calc/index';
import { auditFields, generateAuditSheets } from '../src/calc/audit';
import { generateFinalSheet } from '../src/calc/final';
import { baseLabels, showMoney } from '../src/calc/payroll';
import { assessWorker, generatePayrollTasks } from '../src/calc/training';
import { assessRegion, drawRegions, reasonLabels, regionCases } from '../src/data/real/study';
import { parseVariant, variantSeeds } from '../src/variants';

const rubles = (value: number) => formatAmount(value) + ' ₽';
const verdict = (violation: boolean) => violation ? 'Есть нарушение' : 'Нарушений нет';

export function answerKey(args: string[]): string {
  const variant = parseVariant(args[0]);
  if (args.length !== 1 || variant === undefined) throw new Error('Укажите целый номер от 1 до 9999: npm run key -- N');
  const seeds = variantSeeds(variant);
  const regions = drawRegions(seeds.map, true).map(id => {
    const item = regionCases[id - 1];
    const result = assessRegion(item);
    return `${id}. ${item.region} — ${baseLabels[result.base.source]} ${rubles(result.base.amount)} (${reasonLabels[result.base.reason]}); k = ${item.factors.k}, s = ${item.factors.s}; M = ${rubles(result.full)}; ${verdict(!result.complies)}, доплата ${rubles(result.due)}`;
  });
  const workers = generatePayrollTasks(seeds.workers).map((task, index) => {
    const result = assessWorker(task);
    return `${index + 1}. ${task.name} — ${baseLabels[result.base.source]} ${rubles(result.base.amount)}; ${verdict(!result.complies)}, доплата ${rubles(showMoney(result.due))}`;
  });
  const audit = generateAuditSheets(seeds.audit).map((sheet, index) => {
    const { row, correct, shown, explanations, error } = sheet;
    const choice = explanations.findIndex(option => option.id === error);
    const before = row === 3 ? baseLabels[shown.source] + ' ' + rubles(shown.base) : rubles(shown[auditFields[row]]);
    const after = row === 3 ? baseLabels[correct.source] + ' ' + rubles(correct.base) : rubles(correct[auditFields[row]]);
    return `${index + 1}. ${sheet.task.name} — строка ${row}; ответ ${choice + 1}: ${explanations[choice].label}; ${before} → ${after}`;
  });
  const final = generateFinalSheet(seeds.final);
  const rows = final.rows.map(row =>
    `${row.name} — ${verdict(row.violation)}; начислено ${rubles(row.salary)}, минимум ${rubles(row.minimum)}, доплата ${rubles(row.due)}`);
  return [
    `Ключ преподавателя · вариант № ${variant}`,
    '', 'Уровень 2 · Карта минимумов', ...regions,
    '', 'Уровень 3 · Карточки работников', ...workers,
    '', 'Уровень 4 · Аудит ведомости', ...audit,
    '', 'Финал · Дело № 001', `Общая база — ${baseLabels[final.baseSource]} ${rubles(final.base)}`, ...rows,
    `Акт проверки № 001, вариант № ${variant} — общая недоплата ${rubles(final.total)}. ${final.total > 0 ? 'Нарушения выявлены' : 'Нарушения не выявлены'}.`,
  ].join('\n');
}
