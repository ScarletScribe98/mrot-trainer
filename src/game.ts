import { generateTasks, applicableMinimum, selectBase, underpayment } from './calc';
import { AUDIT_SEED, checkAuditAnswer, type AuditAnswer, type AuditSheet } from './calc/audit';
import { checkFinalAnswers, FINAL_SEED, generateFinalSheet, newFinalDraft, type FinalCell, type FinalDraft } from './calc/final';
import { ALL_LEVELS_XP, AVAILABLE_LEVELS, FINAL_LEVEL } from './config';
export type Verdict = 'yes' | 'no';
export interface CardState { attempts: number; hint: boolean; answered: boolean; reward: number; }
export interface Run { seed: number; index: number; cards: CardState[]; streak: number; earned: number; completed: boolean; }
export type AuditStep = AuditAnswer['step'];
interface AuditCard extends CardState { step: AuditStep; }
interface AuditRun extends Run { cards: AuditCard[]; }
export interface InspectionAct { date: string; xp: number; reward: number; bonus: number; cleanCases: number; }
interface FinalRun {
 seed: number;
 attempts: number;
 hint: boolean;
 draft: FinalDraft;
 issues: FinalCell[];
 act: InspectionAct | null;
}
export interface Progress {
 version: 1;
 xp: number;
 completed: number[];
 sound: boolean;
 music: boolean;
 run: Run;
 audit: AuditRun;
 final: FinalRun;
 allLevelsBonusAwarded: boolean;
}
type AddedFields = 'audit' | 'final' | 'allLevelsBonusAwarded';
type SavedProgress = Omit<Progress, AddedFields> & Partial<Pick<Progress, AddedFields>>;
export const STORAGE_KEY = 'inspektor-truda-v1';
export function newRun(seed = 73103): Run { return { seed, index: 0, cards: Array.from({ length: 5 }, () => ({ attempts: 0, hint: false, answered: false, reward: 0 })), streak: 0, earned: 0, completed: false }; }
export function newAuditRun(seed = AUDIT_SEED): AuditRun {
 const run = newRun(seed);
 return { ...run, cards: run.cards.map(card => ({ ...card, step: 'row' })) };
}
function newFinalRun(): FinalRun {
 return { seed: FINAL_SEED, attempts: 0, hint: false, draft: newFinalDraft(), issues: [], act: null };
}
export function initialProgress(): Progress {
 return { version: 1, xp: 0, completed: [], sound: true, music: false,
  run: newRun(), audit: newAuditRun(), final: newFinalRun(), allLevelsBonusAwarded: false };
}
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
  reward = attemptReward(state);
  if (streak === 3) { reward += 50; streak = 0; }
  card.answered = true; card.reward = reward;
 } else { card.attempts++; if (card.attempts >= 2) card.hint = true; }
 return { card, reward, streak };
}
function attemptReward({ hint, attempts }: Pick<CardState, 'hint' | 'attempts'>): number {
 return hint || attempts >= 2 ? 50 : attempts > 0 ? 70 : 100;
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
 return finishLevel({ ...progress, audit: { ...audit, completed: true } }, 4);
}

export function canOpenFinal(progress: Progress) {
 return progress.completed.includes(3) && progress.completed.includes(4);
}

export function finishLevel(progress: Progress, level: number): Progress {
 const completed = [...new Set([...progress.completed, level])];
 const earnBonus = !progress.allLevelsBonusAwarded && AVAILABLE_LEVELS.every(id => completed.includes(id));
 return {
  ...progress, completed, allLevelsBonusAwarded: progress.allLevelsBonusAwarded || earnBonus,
  xp: progress.xp + (earnBonus ? ALL_LEVELS_XP : 0),
 };
}

export function submitFinal(progress: Progress, today = new Date()): Progress {
 const final = progress.final;
 if (final.act || !canOpenFinal(progress)) return progress;
 const issues = checkFinalAnswers(generateFinalSheet(final.seed), final.draft);
 if (issues.length) return { ...progress, final: { ...final, attempts: final.attempts + 1, issues } };
 const reward = attemptReward(final);
 const completed = finishLevel({ ...progress, xp: progress.xp + reward }, FINAL_LEVEL);
 const bonus = !progress.allLevelsBonusAwarded && completed.allLevelsBonusAwarded ? ALL_LEVELS_XP : 0;
 const date = [today.getFullYear(), today.getMonth() + 1, today.getDate()].map(n => String(n).padStart(2, '0')).join('-');
 const cleanCards = [...progress.run.cards, ...progress.audit.cards].filter(card => card.answered && card.reward >= 100).length;
 return { ...completed, final: { ...final, issues: [], act: {
  date, xp: completed.xp, reward, bonus, cleanCases: cleanCards + (reward === 100 ? 1 : 0),
 } } };
}

const integer = (x: unknown, max = Number.MAX_SAFE_INTEGER) =>
 typeof x === 'number' && Number.isSafeInteger(x) && x >= 0 && x <= max;

function validateRun(run: Run): boolean {
 return !!run && integer(run.seed, 4294967295) && integer(run.index, 4) && integer(run.streak, 2) &&
  integer(run.earned) && typeof run.completed === 'boolean' && Array.isArray(run.cards) && run.cards.length === 5 &&
  run.cards.every((c, i) => c && integer(c.attempts) && typeof c.hint === 'boolean' &&
   typeof c.answered === 'boolean' && integer(c.reward, 150) && (!(run.completed || i < run.index) || c.answered));
}

function validateFinal(final: FinalRun): boolean {
 const verdicts = ['', 'yes', 'no'];
 const text = (value: unknown, max: number) => typeof value === 'string' && value.length <= max;
 if (!final || !integer(final.seed, 4294967295) || !integer(final.attempts) || typeof final.hint !== 'boolean') return false;
 const { draft, issues, act } = final;
 const cells = ['base', 'total', 'conclusion', ...newFinalDraft().rows.flatMap((_, i) => ['row-' + i + '-verdict', 'row-' + i + '-amount'])];
 return !!draft && ['', 'federal', 'regional'].includes(draft.base) && text(draft.name, 64) &&
  text(draft.total, 32) && verdicts.includes(draft.conclusion) && Array.isArray(draft.rows) &&
  draft.rows.length === newFinalDraft().rows.length &&
  draft.rows.every(row => !!row && verdicts.includes(row.verdict) && text(row.amount, 32)) &&
  Array.isArray(issues) && issues.every(cell => cells.includes(cell)) &&
  (act === null || (!!act && typeof act.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(act.date) &&
   integer(act.xp) && [50, 70, 100].includes(act.reward) && [0, ALL_LEVELS_XP].includes(act.bonus) && integer(act.cleanCases, 11)));
}

export function validateProgress(value: unknown): value is SavedProgress {
 if (!value || typeof value !== 'object') return false;
 const p = value as SavedProgress;
 return p.version === 1 && integer(p.xp) && Array.isArray(p.completed) && p.completed.every(n => AVAILABLE_LEVELS.includes(n)) &&
  typeof p.sound === 'boolean' && typeof p.music === 'boolean' && validateRun(p.run) &&
  (p.audit === undefined || (validateRun(p.audit) && p.audit.cards.every(c =>
   ['row', 'explanation', 'correction'].includes(c.step) && (!c.answered || c.step === 'correction')))) &&
  (p.allLevelsBonusAwarded === undefined || typeof p.allLevelsBonusAwarded === 'boolean') &&
  (p.final === undefined || validateFinal(p.final));
}

export function loadProgress(): Progress {
 try {
  const saved: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
  return validateProgress(saved) ? {
   ...saved, audit: saved.audit ?? newAuditRun(), final: saved.final ?? newFinalRun(),
   allLevelsBonusAwarded: saved.allLevelsBonusAwarded ?? false,
  } : initialProgress();
 } catch { return initialProgress(); }
}
