import { decimal, generateTasks, mulberry32, type Task } from './index';
import { calculatePayroll, chooseBase, payment, qualifyingPay, type Payment } from './payroll';

export type PayrollTask = Omit<Task, 'salary'> & { q: string; payments: Payment[] };

export function splitPay(w: number, bonus: number, excluded?: Payment): Payment[] {
  return [payment('salary', w - bonus), payment('bonus', bonus), ...(excluded ? [excluded] : [])];
}

// The training bases and rates are chosen so this synthetic pay target is an integer number of kopecks.
export function payAtRate(base: number, q: string): number {
  const [n, d] = decimal(q);
  const product = BigInt(base) * n;
  if (product % d !== 0n) throw new RangeError('Учебная база для генератора должна делиться без остатка');
  return Number(product / d);
}

export function generatePayrollTasks(seed: number): PayrollTask[] {
  const random = mulberry32(seed ^ 0x187A32F2);
  return generateTasks(seed).map(({ salary: _salary, ...person }, index) => {
    const q = index === 0 ? '0.5' : index === 2 ? '0.75' : '1';
    const base = chooseBase(person.federal, person.regional);
    const gap = (900 + Math.floor(random() * 2100)) * 100;
    const w = payAtRate(base.amount, q) + (index % 2 === 0 ? -gap : index === 1 ? 0 : gap);
    const bonus = (650 + Math.floor(random() * 1100)) * 100;
    const excluded = index === 0 ? payment('night', 182500) : index === 3 ? payment('combination', 150000) : undefined;
    return { ...person, q, payments: splitPay(w, bonus, excluded) };
  });
}

export function assessWorker(task: PayrollTask) {
  const base = chooseBase(task.federal, task.regional);
  return { base, ...calculatePayroll(base.amount, task.k, task.s, task.q, qualifyingPay(task.payments)) };
}
