import { expect, it } from 'vitest';
import data from './history.json';

it('добавляет только дословные пояснения к 1992 и 2018 годам', async () => {
  const notes = data.milestones.flatMap(item => item.ratioNote ? [[item.year, item.ratioNote]] : []);
  expect(notes).toEqual([
    [1992, 'Отношение считается по средним за год значениям, а МРОТ в таблице показан на конец года. В 1992 году МРОТ вырос с 342 до 900 руб., поэтому в среднем за год он покрывал только 0,36 ПМ (методичка, часть 2, п. 2.1 и примечание к табл. 7).'],
    [2018, 'МРОТ 11 163 руб. действовал только с 1 мая, до этого — 9 489 руб.; в среднем за год вышло 10 605 руб., поэтому отношение — 0,95, а не 1,00 (методичка, п. 2.2, п. 5.4 и примечание к табл. 7).'],
  ]);
  const baseline = { ...data, milestones: data.milestones.map(({ ratioNote, ...item }) => item) };
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(baseline)));
  const digest = Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
  expect(digest).toBe('191d57a766d8d2c9053ff82b936db0bb67f72450181f805787a99223ddb7e8bf');
});
