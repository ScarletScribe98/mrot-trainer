import { formatAmount } from './calc';
import type { FinalSheet } from './calc/final';
import { rank, type InspectionAct } from './game';

export const actDisclaimer = 'Учебный документ. Тренажёр по курсу «Минимальная оплата труда».';
const legacyColumns = ['Работник', 'Начислено', 'Применимый минимум', 'Недоплата'];
const payrollColumns = ['Работник', 'Начислено до доплаты', 'Минимум с учётом ставки', 'Доплата'];
export const actStamp = 'Проверка завершена';
const rubles = (cents: number) => formatAmount(cents) + ' ₽';

type ActSheet = Pick<FinalSheet, 'organization' | 'region' | 'total'> & {
  rows: Pick<FinalSheet['rows'][number], 'name' | 'salary' | 'minimum' | 'due'>[];
};
export function makeActData(sheet: ActSheet, act: InspectionAct, name: string) {
  return {
    number: '001',
    columns: act.method === 5 ? payrollColumns : legacyColumns,
    date: act.date.split('-').reverse().join('.'),
    details: [
      ['Организация', sheet.organization], ['Учебный регион', sheet.region],
      ['Проверяющий', name.trim() || 'Имя не указано'], ['Звание', rank(act.xp)],
    ],
    rows: sheet.rows.map(row => [row.name, rubles(row.salary), rubles(row.minimum), rubles(row.due)]),
    total: rubles(sheet.total),
    conclusion: sheet.total > 0 ? 'Нарушения выявлены' : 'Нарушения не выявлены',
    summary: [
      ['Общий опыт', act.xp.toLocaleString('ru-RU') + ' XP'],
      ['Дел с первой попытки', String(act.cleanCases)],
      ['За финал', '+' + act.reward + ' XP'],
      ...(act.bonus ? [['За все доступные уровни', '+' + act.bonus + ' XP']] : []),
    ],
  };
}

export type ActData = ReturnType<typeof makeActData>;

export async function saveActPng(act: ActData) {
  await document.fonts.ready;
  const canvas = document.createElement('canvas');
  canvas.width = 1600;
  canvas.height = 1420;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas is unavailable');
  const ctx = context;

  const ink = '#243128', mute = '#465745', rule = '#879580';
  const sans = 'Golos, Arial, sans-serif', serif = '"Source Serif", Georgia, serif';
  const mono = '"Plex Mono", Consolas, monospace';
  function text(value: string, x: number, y: number, size: number, font = sans, color = ink, maxWidth = 1360) {
    ctx.font = size + 'px ' + font;
    ctx.fillStyle = color;
    ctx.fillText(value, x, y, maxWidth);
  }
  function line(y: number) {
    ctx.fillStyle = rule;
    ctx.fillRect(112, y, 1376, 2);
  }
  ctx.fillStyle = '#e8e9dd';
  ctx.fillRect(0, 0, 1600, 1420);
  ctx.strokeStyle = rule;
  ctx.lineWidth = 2;
  ctx.strokeRect(48, 48, 1504, 1324);
  ctx.strokeRect(60, 60, 1480, 1300);

  text('УЧЕБНЫЙ АРХИВ  /  ДЕЛО № ' + act.number, 112, 135, 27, mono, mute);
  ctx.textAlign = 'right';
  text(act.date, 1488, 135, 27, mono, mute);
  ctx.textAlign = 'left';
  line(154);
  text('Акт проверки № ' + act.number, 107, 272, 83, serif);
  text(actDisclaimer, 112, 333, 27, sans, mute);
  for (const [i, [label, value]] of act.details.entries()) {
    const x = i % 2 === 0 ? 112 : 815;
    const y = i < 2 ? 408 : 500;
    text(label, x, y, 25, sans, mute);
    text(value, x, y + 39, 33, sans, ink, 670);
  }

  const columns = [131, 767, 1135, 1468];
  ctx.fillStyle = '#d8ddca';
  ctx.fillRect(112, 585, 1376, 65);
  act.columns.forEach((label, i) => {
    ctx.textAlign = i === 0 ? 'left' : 'right';
    text(label, columns[i], 625, 24, sans, ink, i === 0 ? 360 : 315);
  });
  act.rows.forEach((row, i) => {
    const top = 650 + 67 * i;
    line(top + 66);
    row.forEach((value, col) => {
      ctx.textAlign = col === 0 ? 'left' : 'right';
      text(value, columns[col], top + 43, 31, col === 0 ? sans : mono);
    });
  });

  ctx.textAlign = 'left';
  ctx.fillStyle = '#d8ddca';
  ctx.fillRect(112, 954, 1376, 102);
  text(act.conclusion, 135, 1015, 37, serif);
  ctx.textAlign = 'right';
  text('Общая недоплата', 1465, 991, 25, sans, mute);
  text(act.total, 1465, 1032, 36, mono);
  ctx.textAlign = 'left';

  act.summary.forEach(([label, value], i) => {
    const x = i % 2 === 0 ? 112 : 450;
    const y = i < 2 ? 1132 : 1232;
    text(label, x, y, 23, sans, mute, 325);
    text(value, x, y + 40, 33, mono);
  });
  ctx.save();
  ctx.translate(1138, 1177);
  ctx.rotate(-0.052);
  ctx.strokeStyle = '#763c40';
  ctx.lineWidth = 4;
  ctx.strokeRect(-294, -53, 588, 106);
  ctx.lineWidth = 1.5;
  ctx.strokeRect(-283, -43, 566, 86);
  ctx.textAlign = 'center';
  text(actStamp.toUpperCase(), 0, 10, 32, mono, '#763c40', 530);
  ctx.restore();

  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('PNG export failed');
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'akt-proverki-' + act.number + '.png';
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10000);
}
