import { decimal, money, roundMoney, selectBase } from './index';

export type Exact = readonly [numerator: bigint, denominator: bigint];
export type BaseSource = 'federal' | 'regional';
export const baseLabels: Record<BaseSource, string> = { federal: 'МРОТ', regional: 'Региональный минимум' };
type BaseException = 'federal-budget' | 'excluded-from-agreement' | 'refusal';

export function chooseBase(federal: number, regional?: number | null, exception?: BaseException) {
  const higher = selectBase(federal, regional);
  if (exception) return { amount: federal, source: 'federal' as const, reason: exception };
  if (higher > federal) return { amount: higher, source: 'regional' as const, reason: 'higher-regional' as const };
  return { amount: federal, source: 'federal' as const, reason: regional == null ? 'no-regional' as const : 'regional-not-higher' as const };
}

export const paymentLabels = {
  salary: 'Оклад с учётом ставки',
  bonus: 'Ежемесячная премия',
  district: 'Районный коэффициент',
  northern: 'Северная надбавка',
  night: 'Ночные',
  overtime: 'Сверхурочные',
  combination: 'Доплата за совмещение',
};
export interface Payment {
  kind: keyof typeof paymentLabels;
  cents: number;
  inW: boolean;
}

export function payment(kind: Payment['kind'], cents: number): Payment {
  return { kind, cents: money(cents), inW: kind === 'salary' || kind === 'bonus' };
}

export function qualifyingPay(payments: readonly Payment[]): number {
  return money(payments.filter(item => item.inW).reduce((sum, item) => sum + item.cents, 0));
}

export function addExact([an, ad]: Exact, [bn, bd]: Exact): Exact {
  return [an * bd + bn * ad, ad * bd];
}

export function multiplyExact([an, ad]: Exact, [bn, bd]: Exact): Exact {
  return [an * bn, ad * bd];
}

export function showMoney([n, d]: Exact): number {
  return roundMoney(n, d, 'half-up');
}

export function payrollFactor(k: string, s: string): Exact {
  return addExact(decimal(k), decimal(s));
}

export function fullMinimum(base: number, k: string, s: string): Exact {
  return multiplyExact([BigInt(money(base)), 1n], payrollFactor(k, s));
}

export function calculatePayroll(base: number, k: string, s: string, q: string, w: number) {
  const factor = payrollFactor(k, s);
  const rate = decimal(q);
  const [requiredW, denominator] = multiplyExact([BigInt(money(base)), 1n], rate);
  const countedW = BigInt(money(w));
  const missing = requiredW - countedW * denominator;
  const full = multiplyExact([BigInt(base), 1n], factor);
  return {
    w,
    full,
    minimum: multiplyExact(full, rate),
    accrued: multiplyExact([countedW, 1n], factor),
    due: multiplyExact([missing > 0n ? missing : 0n, denominator], factor),
    complies: missing <= 0n,
  };
}

export function takeHome(amount: Exact): Exact {
  return multiplyExact(amount, [87n, 100n]);
}
