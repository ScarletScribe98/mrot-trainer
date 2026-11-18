import { assessWorker, generatePayrollTasks } from './calc/training';
import { showMoney } from './calc/payroll';
import { AUDIT_SEED, checkAuditAnswer, type AuditAnswer, type AuditSheet } from './calc/audit';
import { checkFinalAnswers, FINAL_SEED, generateFinalSheet, newFinalDraft, type FinalCell, type FinalDraft } from './calc/final';
import { ALL_LEVELS_XP, AVAILABLE_LEVELS, FINAL_LEVEL } from './config';
import { drawRegions, historyPairs, MAP_SEED, regionCases } from './data/real/study';
import { isVariant, variantSeeds } from './variants';
export type Verdict = 'yes' | 'no';
export interface CardState { attempts: number; hint: boolean; answered: boolean; reward: number; }
export interface Run { seed: number; index: number; cards: CardState[]; streak: number; earned: number; completed: boolean; }
export type AuditStep = AuditAnswer['step'];
interface AuditCard extends CardState { step: AuditStep; }
interface AuditRun extends Run { cards: AuditCard[]; }
export interface InspectionAct { date: string; xp: number; reward: number; bonus: number; cleanCases: number; method?: 5; }
interface FinalRun {
 seed: number;
 attempts: number;
 hint: boolean;
 draft: FinalDraft;
 issues: FinalCell[];
 act: InspectionAct | null;
}
export interface RegionalAttempt {
 step: number;
 attempts: number;
 wrong: boolean;
 stepAttempts?: number;
 hint?: boolean;
}
interface Study {
 history: { turn: number; attempts: number; accepted: boolean };
 map: { seed: number; cases: RegionalAttempt[] };
}
export function newRegionalAttempt(): RegionalAttempt { return { step: 0, attempts: 0, wrong: false }; }
function newStudy(seed = MAP_SEED): Study {
 return { history: { turn: 0, attempts: 0, accepted: false },
  map: { seed, cases: regionCases.map(newRegionalAttempt) } };
}
export interface Progress {
 version: 1;
 variant?: number;
 xp: number;
 completed: number[];
 sound: boolean;
 music: boolean;
 run: Run;
 audit: AuditRun;
 final: FinalRun;
 allLevelsBonusAwarded: boolean;
 methodVersion: 5;
 migrationNotice: boolean;
 study: Study;
}
type AddedFields = 'audit' | 'final' | 'allLevelsBonusAwarded' | 'methodVersion' | 'migrationNotice' | 'study';
type SavedProgress = Omit<Progress, AddedFields> & Partial<Pick<Progress, AddedFields>>;
export const STORAGE_KEY = 'inspektor-truda-v1';
export function newRun(seed = 73103): Run { return { seed, index: 0, cards: Array.from({ length: 5 }, () => ({ attempts: 0, hint: false, answered: false, reward: 0 })), streak: 0, earned: 0, completed: false }; }
export function newAuditRun(seed = AUDIT_SEED): AuditRun {
 const run = newRun(seed);
 return { ...run, cards: run.cards.map(card => ({ ...card, step: 'row' })) };
}
function newFinalRun(seed = FINAL_SEED): FinalRun {
 return { seed, attempts: 0, hint: false, draft: newFinalDraft(), issues: [], act: null };
}
export function initialProgress(variant?: number): Progress {
 const seeds = variant === undefined ? undefined : variantSeeds(variant);
 return { version: 1, xp: 0, completed: [], sound: true, music: false,
  ...(variant === undefined ? {} : { variant }),
  run: newRun(seeds?.workers), audit: newAuditRun(seeds?.audit), final: newFinalRun(seeds?.final),
  allLevelsBonusAwarded: false, methodVersion: 5, migrationNotice: false, study: newStudy(seeds?.map) };
}
export function rank(xp: number): string { return xp >= 1500 ? 'Главный аудитор' : xp >= 800 ? 'Специалист по расчётам' : xp >= 300 ? 'Младший инспектор' : 'Стажёр'; }
export function nextRank(xp: number): number { return [300, 800, 1500].find(n => n > xp) ?? 1500; }
export function submit(progress: Progress, verdict: Verdict, amount: number | null): { progress: Progress; correct: boolean } {
 const run = progress.run, state = run.cards[run.index];
 if (state.answered || run.completed) return { progress, correct: true };
 const result = assessWorker(generatePayrollTasks(run.seed)[run.index]);
 const correct = result.complies ? verdict === 'no' : verdict === 'yes' && amount === showMoney(result.due);
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
export function attemptReward({ hint, attempts }: Pick<CardState, 'hint' | 'attempts'>): number {
 return hint || attempts >= 2 ? 50 : attempts > 0 ? 70 : 100;
}
export function rewardLabel(reward: number): string {
 const reason = reward === 50 ? 'с подсказкой' : reward === 70 ? 'со второй попытки' : 'с первой попытки';
 return `+${reward} XP (${reason})`;
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

export function submitHistory(p: Progress, correct: boolean): Progress {
 const state = p.study.history;
 if (state.accepted || state.turn > historyPairs.length) return p;
 const history = correct ? { ...state, accepted: true } : { ...state, attempts: state.attempts + 1 };
 return { ...p, study: { ...p.study, history },
  xp: p.xp + (correct ? attemptReward({ ...state, hint: false }) : 0) };
}

export function nextHistory(p: Progress): Progress {
 const state = p.study.history;
 if (!state.accepted) return p;
 const history = { turn: state.turn + 1, attempts: 0, accepted: false };
 const updated = { ...p, study: { ...p.study, history } };
 return state.turn === historyPairs.length ? finishLevel(updated, 1) : updated;
}

export function regionalStepAttempts(state: RegionalAttempt): number {
 return state.stepAttempts ?? (state.wrong ? state.attempts : 0);
}

export function assignedRegions(progress: Progress): number[] {
 return drawRegions(progress.study.map.seed, progress.variant !== undefined);
}

export function countRegionalCases(progress: Progress, assigned = assignedRegions(progress)): number {
 return assigned.filter(id => progress.study.map.cases[id - 1].step === 3).length;
}

export function gradeRegionalAttempt(state: RegionalAttempt, correct: boolean): RegionalAttempt {
 if (state.step >= 3) return state;
 return correct ? { ...state, step: state.step + 1, wrong: false, stepAttempts: 0 }
  : { ...state, attempts: state.attempts + 1, wrong: true, stepAttempts: regionalStepAttempts(state) + 1 };
}

export function requestRegionalKey(p: Progress, id: number, step: number): Progress {
 const { map } = p.study;
 const state = map.cases[id - 1];
 if (p.completed.includes(2) || !state || state.hint || state.step !== step ||
  regionalStepAttempts(state) < 2 || !assignedRegions(p).includes(id)) return p;
 const cases = map.cases.map((item, i) => i === id - 1 ? { ...state, hint: true } : item);
 return { ...p, study: { ...p.study, map: { ...map, cases } } };
}

export function submitRegional(p: Progress, id: number, correct: boolean): Progress {
 const map = p.study.map;
 const assigned = assignedRegions(p);
 if (!assigned.includes(id) || map.cases[id - 1].step >= 3) return p;
 const next = gradeRegionalAttempt(map.cases[id - 1], correct);
 const cases = map.cases.map((state, i) => i === id - 1 ? next : state);
 const xp = next.step === 3 ? attemptReward({ attempts: next.attempts, hint: next.hint ?? false }) : 0;
 const updated = { ...p, xp: p.xp + xp, study: { ...p.study, map: { ...map, cases } } };
 return countRegionalCases(updated, assigned) === assigned.length ? finishLevel(updated, 2) : updated;
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
  date, xp: completed.xp, reward, bonus, method: 5, cleanCases: cleanCards + (reward === 100 ? 1 : 0),
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
   (act.method === undefined || act.method === 5) && integer(act.xp) && [50, 70, 100].includes(act.reward) && [0, ALL_LEVELS_XP].includes(act.bonus) && integer(act.cleanCases, 11)));
}

function validateStudy(study: Study): boolean {
 const history = study?.history;
 const map = study?.map;
 return !!history && integer(history.turn, historyPairs.length + 1) && integer(history.attempts) &&
  typeof history.accepted === 'boolean' &&
  !!map && integer(map.seed, 4294967295) && Array.isArray(map.cases) && map.cases.length === regionCases.length &&
  map.cases.every(state => state && integer(state.step, 3) && integer(state.attempts) && typeof state.wrong === 'boolean' &&
   (state.stepAttempts === undefined || integer(state.stepAttempts, state.attempts)) &&
   (state.hint === undefined || typeof state.hint === 'boolean'));
}

export function validateProgress(value: unknown): value is SavedProgress {
 if (!value || typeof value !== 'object') return false;
 const p = value as SavedProgress;
 return p.version === 1 && integer(p.xp) && Array.isArray(p.completed) && p.completed.every(n => AVAILABLE_LEVELS.includes(n)) &&
  (p.variant === undefined || isVariant(p.variant)) &&
  typeof p.sound === 'boolean' && typeof p.music === 'boolean' && validateRun(p.run) &&
  (p.audit === undefined || (validateRun(p.audit) && p.audit.cards.every(c =>
   ['row', 'explanation', 'correction'].includes(c.step) && (!c.answered || c.step === 'correction')))) &&
  (p.allLevelsBonusAwarded === undefined || typeof p.allLevelsBonusAwarded === 'boolean') &&
  (p.final === undefined || validateFinal(p.final)) &&
  (p.methodVersion === undefined || p.methodVersion === 5) &&
  (p.migrationNotice === undefined || typeof p.migrationNotice === 'boolean') &&
  (p.study === undefined || validateStudy(p.study));
}

export function loadProgress(create: () => Progress = initialProgress): Progress {
 let saved: unknown;
 try {
  saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
 } catch { return create(); }
 if (!validateProgress(saved)) return create();
 const progress: Progress = {
  ...saved, audit: saved.audit ?? newAuditRun(), final: saved.final ?? newFinalRun(),
  allLevelsBonusAwarded: saved.allLevelsBonusAwarded ?? false, methodVersion: 5,
  migrationNotice: saved.migrationNotice ?? false, study: saved.study ?? newStudy(),
 };
 if (saved.methodVersion === 5) return progress;
 const { run, audit, final } = progress;
 const resetRun = !run.completed && run.cards.some(card => card.answered || card.attempts || card.hint);
 const resetAudit = !audit.completed && audit.cards.some(card => card.step !== 'row' || card.attempts || card.hint);
 const draft = final.draft;
 const resetFinal = !final.act && !!(final.attempts || final.hint || draft.base || draft.total || draft.conclusion ||
  draft.rows.some(row => row.verdict || row.amount));
 return {
  ...progress, run: resetRun ? newRun(run.seed) : run, audit: resetAudit ? newAuditRun(audit.seed) : audit,
  final: resetFinal ? { ...newFinalRun(final.seed), draft: { ...newFinalDraft(), name: draft.name } } : final,
  migrationNotice: resetRun || resetAudit || resetFinal,
 };
}
