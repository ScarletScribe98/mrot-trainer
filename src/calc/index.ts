/** Money is an integer number of kopecks; coefficients stay rational. */
export type RoundingMode = 'half-up' | 'down';
// TODO(Эрика): правило округления по методичке v5
export const calculationConfig: { rounding: RoundingMode } = { rounding: 'half-up' };
export function money(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0) throw new RangeError('Сумма должна быть целым неотрицательным числом копеек');
  return value;
}
function safeNumber(value: bigint): number {
  if (value < 0n || value > BigInt(Number.MAX_SAFE_INTEGER)) throw new RangeError('Сумма выходит за безопасный диапазон');
  return Number(value);
}
export function roundMoney(numerator: bigint, denominator: bigint, mode: RoundingMode = calculationConfig.rounding): number {
  if (numerator < 0n || denominator <= 0n) throw new RangeError('Недопустимая дробь');
  const whole = numerator / denominator;
  return safeNumber(whole + (mode === 'half-up' && (numerator % denominator) * 2n >= denominator ? 1n : 0n));
}
export function decimal(value: string | number): [bigint, bigint] {
  const text = String(value).replace(',', '.');
  if (!/^\d+(?:\.\d{1,6})?$/.test(text)) throw new RangeError('Коэффициент должен быть неотрицательной десятичной дробью');
  const [whole, fraction = ''] = text.split('.');
  return [BigInt(whole + fraction), 10n ** BigInt(fraction.length)];
}
export function selectBase(federal: number, regional?: number | null): number {
  money(federal); return regional == null ? federal : Math.max(federal, money(regional));
}
export function applicableMinimum(B: number, k: string | number, s: string | number, rounding = calculationConfig.rounding): number {
  money(B); const [kn, kd] = decimal(k), [sn, sd] = decimal(s);
  return roundMoney(BigInt(B) * (kn * sd + sn * kd), kd * sd, rounding);
}
export function underpayment(salary: number, minimum: number): number { return Math.max(0, money(minimum) - money(salary)); }
export function parseAmount(text: string): number | null {
  const normalized = text.replace(/[ \u00a0\u202f]/g, '').replace(',', '.');
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;
  const [whole, fraction = ''] = normalized.split('.');
  const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
  return cents <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(cents) : null;
}
export function formatAmount(cents: number): string {
  money(cents); return `${Math.floor(cents / 100).toLocaleString('ru-RU')},${String(cents % 100).padStart(2, '0')}`;
}
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => { state = (state + 0x6D2B79F5) | 0; let t = Math.imul(state ^ (state >>> 15), 1 | state); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export interface Task { id: string; name: string; position: string; company: string; region: string; federal: number; regional: number | null; k: string; s: string; salary: number; }
const workers = [
 ['Вера Соколова', 'Специалист по снабжению', 'Мастерская «Северный лист»', 'Северный край'],
 ['Марк Лебедев', 'Оператор оборудования', 'Артель «Тихая гавань»', 'Озёрный округ'],
 ['Алина Белова', 'Техник производства', 'Бюро «Полярная линия»', 'Полярная долина'],
 ['Роман Мельников', 'Кладовщик', 'Мануфактура «Медный берег»', 'Медный округ'],
 ['Нина Орлова', 'Диспетчер', 'Мастерская «Северный лист»', 'Северный край'],
];
export function generateTasks(seed: number): Task[] {
 const random = mulberry32(seed);
 return workers.map(([name, position, company, region], index) => {
  // Fictional teaching values. TODO(Эрика): реальные данные — отдельно от демо.
  const federal = (18000 + Math.floor(random() * 8) * 1000) * 100;
  const regional = index % 2 === 0 ? federal + 200000 : index === 3 ? federal - 100000 : null;
  const k = ['1.15', '1.20', '1.30'][Math.floor(random() * 3)];
  const s = ['0.10', '0.20', '0.25'][Math.floor(random() * 3)];
  const minimum = applicableMinimum(selectBase(federal, regional), k, s);
  const gap = (1000 + Math.floor(random() * 8) * 250) * 100 + (index === 2 ? 25 : 0);
  const salary = minimum + (index % 2 === 0 ? -gap : index === 1 ? 0 : gap);
  return { id: `03-${index + 1}`, name, position, company, region, federal, regional, k, s, salary };
 });
}
