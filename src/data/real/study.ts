import historyData from './history.json' with { type: 'json' };
import regionData from './regions.json' with { type: 'json' };
import { decimal, mulberry32 } from '../../calc';
import { parseAuditAmount } from '../../calc/audit';
import { calculatePayroll, chooseBase, payment, qualifyingPay, showMoney, type BaseSource } from '../../calc/payroll';
import { payAtRate } from '../../calc/training';

export const { milestones, supplements } = historyData;
export const historyRatioCaption = 'МРОТ — на конец года, ПМ и отношение — в среднем за год (примечание к табл. 7)';
export type Milestone = typeof milestones[number];
export const findMilestone = (year: number) => milestones.find(row => row.year === year)!;
export const historyPairs = [[1992, 1997], [1999, 2001], [2009, 2015], [2018, 2021], [2027, 2023]]
  .map(([a, b]) => [findMilestone(a), findMilestone(b)] as const);
export const sortStart = [2018, 1997, 2021, 2007, 2001];
export const sortKey = [...sortStart].sort((a, b) => a - b);

export function ratioHigher(a: Milestone, b: Milestone) {
  const [an, ad] = decimal(a.ratio);
  const [bn, bd] = decimal(b.ratio);
  return bn * ad > an * bd;
}

export function chronological(order: readonly number[]) {
  return order.length === sortKey.length && order.every((year, i) => year === sortKey[i]);
}

type Reason = ReturnType<typeof chooseBase>['reason'];
type InputCase = typeof regionData.cases[number];
export type RegionCase = Omit<InputCase, 'agreement'> & {
  agreement: { source: string; regional: number | null; reason: Reason; exception?: Parameters<typeof chooseBase>[2] };
};

export const regionCases = regionData.cases as RegionCase[];
export const federal = regionData.federal;
export const MAP_SEED = 73107;
export const REGION_COUNT = 5;
export const reasonLabels: Record<Reason, string> = {
  'no-regional': 'Отдельная региональная МЗ не установлена',
  'regional-not-higher': 'Региональная МЗ равна федеральному МРОТ',
  'higher-regional': 'Более высокая МЗ распространяется на работодателя',
  'federal-budget': 'Работодатель финансируется из федерального бюджета',
  'excluded-from-agreement': 'Работодатель находится вне сферы соглашения',
  refusal: 'Если действует соглашение о МЗ, работодатель направил отказ',
};

export function drawRegions(seed: number, mixed = false) {
  const ids = regionCases.map(item => item.id);
  const random = mulberry32(seed);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  const assigned = ids.slice(0, REGION_COUNT);
  if (mixed) {
    const complies = (id: number) => assessRegion(regionCases[id - 1]).complies;
    const first = complies(assigned[0]);
    if (assigned.every(id => complies(id) === first)) {
      const alternate = ids.slice(REGION_COUNT).find(id => complies(id) !== first);
      if (alternate !== undefined) assigned[REGION_COUNT - 1] = alternate;
    }
  }
  return assigned;
}

export function assessRegion(item: RegionCase) {
  const { regional, exception } = item.agreement;
  const { k, s } = item.factors;
  const { q, salary, bonus } = item.wages;
  const base = chooseBase(federal.cents, regional, exception);
  const payroll = [payment('salary', payAtRate(salary, q)), ...(bonus === null ? [] : [payment('bonus', bonus)])];
  const w = qualifyingPay(payroll);
  const exact = calculatePayroll(base.amount, k, s, q, w);
  return {
    base, payroll, w, complies: exact.complies,
    full: showMoney(exact.full), minimum: showMoney(exact.minimum), due: showMoney(exact.due),
  };
}

function sameDecimal(value: string, expected: string) {
  try {
    const [an, ad] = decimal(value.trim());
    const [bn, bd] = decimal(expected);
    return an * bd === bn * ad;
  } catch { return false; }
}

export function checkBasis(item: RegionCase, basis: BaseSource | '', reason: string) {
  const { base } = assessRegion(item);
  return basis === base.source && reason === base.reason;
}
export function checkMinimum(item: RegionCase, k: string, s: string, amount: string) {
  return sameDecimal(k, item.factors.k) && sameDecimal(s, item.factors.s) &&
    parseAuditAmount(amount) === assessRegion(item).full;
}
export function checkTopup(item: RegionCase, conclusion: string, amount: string) {
  const { complies, due } = assessRegion(item);
  return conclusion === (complies ? 'yes' : 'no') && parseAuditAmount(amount) === due;
}
