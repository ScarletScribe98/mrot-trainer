import { generateTasks, applicableMinimum, selectBase, underpayment } from './calc';
export type Verdict = 'yes' | 'no';
export interface CardState { attempts: number; hint: boolean; answered: boolean; reward: number; }
export interface Run { seed: number; index: number; cards: CardState[]; streak: number; earned: number; completed: boolean; }
export interface Progress { version: 1; xp: number; completed: number[]; sound: boolean; music: boolean; run: Run; }
export const STORAGE_KEY = 'inspektor-truda-v1';
export function newRun(seed = 73103): Run { return { seed, index: 0, cards: Array.from({ length: 5 }, () => ({ attempts: 0, hint: false, answered: false, reward: 0 })), streak: 0, earned: 0, completed: false }; }
export function initialProgress(): Progress { return { version: 1, xp: 0, completed: [], sound: true, music: false, run: newRun() }; }
export function rank(xp: number): string { return xp >= 1500 ? 'Главный аудитор' : xp >= 800 ? 'Специалист по расчётам' : xp >= 300 ? 'Младший инспектор' : 'Стажёр'; }
export function nextRank(xp: number): number { return [300, 800, 1500].find(n => n > xp) ?? 1500; }
export function submit(progress: Progress, verdict: Verdict, amount: number | null): { progress: Progress; correct: boolean } {
 const run = progress.run, state = run.cards[run.index];
 if (state.answered || run.completed) return { progress, correct: true };
 const task = generateTasks(run.seed)[run.index];
 const due = underpayment(task.salary, applicableMinimum(selectBase(task.federal, task.regional), task.k, task.s));
 const correct = due > 0 ? verdict === 'yes' && amount === due : verdict === 'no';
 const card = { ...state };
 let reward = 0, streak = correct && state.attempts === 0 && !state.hint ? run.streak + 1 : 0;
 if (correct) {
  reward = state.hint || state.attempts >= 2 ? 50 : state.attempts > 0 ? 70 : 100;
  if (streak === 3) { reward += 50; streak = 0; }
  card.answered = true; card.reward = reward;
 } else { card.attempts++; if (card.attempts >= 2) card.hint = true; }
 return { correct, progress: { ...progress, xp: progress.xp + reward, run: { ...run, streak, earned: run.earned + reward, cards: run.cards.map((c, i) => i === run.index ? card : c) } } };
}
export function validateProgress(value: unknown): value is Progress {
 if (!value || typeof value !== 'object') return false;
 const p = value as Progress;
 const integer = (x: unknown, max = Number.MAX_SAFE_INTEGER) => typeof x === 'number' && Number.isSafeInteger(x) && x >= 0 && x <= max;
 return p.version === 1 && integer(p.xp) && Array.isArray(p.completed) && p.completed.every(n => n === 3) && typeof p.sound === 'boolean' && typeof p.music === 'boolean' && !!p.run && integer(p.run.seed, 4294967295) && integer(p.run.index, 4) && integer(p.run.streak, 2) && integer(p.run.earned) && typeof p.run.completed === 'boolean' && Array.isArray(p.run.cards) && p.run.cards.length === 5 && p.run.cards.every(c => c && integer(c.attempts) && typeof c.hint === 'boolean' && typeof c.answered === 'boolean' && integer(c.reward, 150)) && p.run.cards.every((c, i) => i >= p.run.index || c.answered) && (!p.run.completed || p.run.cards.every(c => c.answered));
}
export function loadProgress(): Progress { try { const p: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); return validateProgress(p) ? p : initialProgress(); } catch { return initialProgress(); } }
