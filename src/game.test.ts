import { describe, it, expect } from 'vitest';
import { initialProgress, submit, validateProgress, type Progress } from './game';
import { generateTasks, underpayment, applicableMinimum, selectBase } from './calc';
function answer(p: Progress) { const t = generateTasks(p.run.seed)[p.run.index]; const due = underpayment(t.salary, applicableMinimum(selectBase(t.federal, t.regional), t.k, t.s)); return submit(p, due > 0 ? 'yes' : 'no', due).progress; }
describe('Зачёт карточек', () => {
 it('начисляет 100 и не начисляет повторно', () => { const p = answer(initialProgress()); expect(p.xp).toBe(100); expect(answer(p).xp).toBe(100); });
 it('начисляет 70 после первой ошибки и 50 после разбора', () => { const first = submit(initialProgress(), 'no', null).progress; expect(first.run.cards[0].attempts).toBe(1); expect(answer(first).xp).toBe(70); const second = submit(first, 'no', null).progress; expect(second.run.cards[0].hint).toBe(true); expect(answer(second).xp).toBe(50); });
 it('подсказка стоит 50 даже без ошибки', () => { const p = initialProgress(); p.run.cards[0].hint = true; expect(answer(p).xp).toBe(50); });
 it('серия трёх даёт ещё 50; пять верных дают 550', () => { let p = initialProgress(); for (let i = 0; i < 5; i++) { p = answer(p); if (i === 2) expect(p.xp).toBe(350); if (i < 4) p = { ...p, run: { ...p.run, index: i + 1 } }; } expect(p.xp).toBe(550); });
 it('проверяет структуру сохранения и старые версии', () => { expect(validateProgress(initialProgress())).toBe(true); expect(validateProgress({ ...initialProgress(), version: 5 })).toBe(false); expect(validateProgress({ ...initialProgress(), run: { ...initialProgress().run, index: 4 } })).toBe(false); expect(validateProgress({})).toBe(false); });
});
