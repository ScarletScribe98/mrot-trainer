import { generateTasks, applicableMinimum, selectBase, underpayment } from './calc';
import { AUDIT_SEED, checkAuditAnswer, type AuditAnswer, type AuditSheet } from './calc/audit';
export type Verdict = 'yes' | 'no';
export interface CardState { attempts: number; hint: boolean; answered: boolean; reward: number; }
export interface Run { seed: number; index: number; cards: CardState[]; streak: number; earned: number; completed: boolean; }
export type AuditStep = AuditAnswer['step'];
interface AuditCard extends CardState { step: AuditStep; }
interface AuditRun extends Run { cards: AuditCard[]; }
export interface Progress { version: 1; xp: number; completed: number[]; sound: boolean; music: boolean; run: Run; audit: AuditRun; }
type SavedProgress = Omit<Progress, 'audit'> & { audit?: AuditRun };
export const STORAGE_KEY = 'inspektor-truda-v1';
export function newRun(seed = 73103): Run { return { seed, index: 0, cards: Array.from({ length: 5 }, () => ({ attempts: 0, hint: false, answered: false, reward: 0 })), streak: 0, earned: 0, completed: false }; }
export function newAuditRun(seed = AUDIT_SEED): AuditRun {
 const run = newRun(seed);
 return { ...run, cards: run.cards.map(card => ({ ...card, step: 'row' })) };
}
export function initialProgress(): Progress { return { version: 1, xp: 0, completed: [], sound: true, music: false, run: newRun(), audit: newAuditRun() }; }
export function rank(xp: number): string { return xp >= 1500 ? 'Главный аудитор' : xp >= 800 ? 'Специалист по расчётам' : xp >= 300 ? 'Младший инспектор' : 'Стажёр'; }
export function nextRank(xp: number): number { return [300, 800, 1500].find(n => n > xp) ?? 1500; }
export function submit(progress: Progress, verdict: Verdict, amount: number | null): { progress: Progress; correct: boolean } {
 const run = progress.run, state = run.cards[run.index];
 if (state.answered || run.completed) return { progress, correct: true };
 const task = generateTasks(run.seed)[run.index];
 const due = underpayment(task.salary, applicableMinimum(selectBase(task.federal, task.regional), task.k, task.s));
 const correct = due > 0 ? verdict === 'yes' && amount === due : verdict === 'no';
 const { card, reward, streak } = gradeCard(run, state, correct);
 return { correct, progress: { ...progress, xp: progress.xp + reward, run: { ...run, streak, earned: run.earned + reward, cards: run.cards.map((c, i) => i === run.index ? card : c) } } };
}

function gradeCard<T extends CardState>(run: Run, state: T, correct: boolean) {
 const card = { ...state };
 let reward = 0, streak = correct && state.attempts === 0 && !state.hint ? run.streak + 1 : 0;
 if (correct) {
  reward = state.hint || state.attempts >= 2 ? 50 : state.attempts > 0 ? 70 : 100;
  if (streak === 3) { reward += 50; streak = 0; }
  card.answered = true; card.reward = reward;
 } else { card.attempts++; if (card.attempts >= 2) card.hint = true; }
 return { card, reward, streak };
}
const nextStep = { row: 'explanation', explanation: 'correction', correction: 'correction' } as const;

export function submitAudit(progress: Progress, sheet: AuditSheet, answer: AuditAnswer): { progress: Progress; correct: boolean } {
 const audit = progress.audit;
 const state = audit.cards[audit.index];
 if (audit.completed || state.answered || state.step !== answer.step) return { progress, correct: false };
 const correct = checkAuditAnswer(sheet, answer);
 const result = correct && state.step !== 'correction'
  ? { card: { ...state, step: nextStep[state.step] }, reward: 0, streak: audit.streak }
  : gradeCard(audit, state, correct);
 return {
  correct,
  progress: {
   ...progress, xp: progress.xp + result.reward,
   audit: {
    ...audit, earned: audit.earned + result.reward, streak: result.streak,
    cards: audit.cards.map((c, i) => i === audit.index ? result.card : c),
   },
  },
 };
}

export function requestAuditHint(progress: Progress): Progress {
 const audit = progress.audit;
 const state = audit.cards[audit.index];
 if (state.answered || state.hint) return progress;
 return { ...progress, audit: { ...audit, streak: 0,
  cards: audit.cards.map((c, i) => i === audit.index ? { ...state, hint: true } : c),
 } };
}

export function advanceAudit(progress: Progress): Progress {
 const audit = progress.audit;
 if (audit.completed || !audit.cards[audit.index].answered) return progress;
 if (audit.index < audit.cards.length - 1) return { ...progress, audit: { ...audit, index: audit.index + 1 } };
 return { ...progress, completed: [...new Set([...progress.completed, 4])], audit: { ...audit, completed: true } };
}

const integer = (x: unknown, max = Number.MAX_SAFE_INTEGER) =>
 typeof x === 'number' && Number.isSafeInteger(x) && x >= 0 && x <= max;

function validateRun(run: Run): boolean {
 return !!run && integer(run.seed, 4294967295) && integer(run.index, 4) && integer(run.streak, 2) &&
  integer(run.earned) && typeof run.completed === 'boolean' && Array.isArray(run.cards) && run.cards.length === 5 &&
  run.cards.every((c, i) => c && integer(c.attempts) && typeof c.hint === 'boolean' &&
   typeof c.answered === 'boolean' && integer(c.reward, 150) && (!(run.completed || i < run.index) || c.answered));
}

export function validateProgress(value: unknown): value is SavedProgress {
 if (!value || typeof value !== 'object') return false;
 const p = value as SavedProgress;
 return p.version === 1 && integer(p.xp) && Array.isArray(p.completed) && p.completed.every(n => n === 3 || n === 4) &&
  typeof p.sound === 'boolean' && typeof p.music === 'boolean' && validateRun(p.run) &&
  (p.audit === undefined || (validateRun(p.audit) && p.audit.cards.every(c =>
   ['row', 'explanation', 'correction'].includes(c.step) && (!c.answered || c.step === 'correction'))));
}

export function loadProgress(): Progress {
 try {
  const saved: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
  return validateProgress(saved) ? { ...saved, audit: saved.audit ?? newAuditRun() } : initialProgress();
 } catch { return initialProgress(); }
}
