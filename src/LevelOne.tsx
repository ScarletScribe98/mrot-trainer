import { useState } from 'preact/hooks';
import { chronological, findMilestone, historyPairs, milestones, ratioHigher, sortKey, sortStart, supplements,
  type Milestone } from './data/real/study';
import { attemptReward, nextHistory, submitHistory, type Progress } from './game';
import { Button, Document, Folder, Hint, Icon, MethodNote, Stamp } from './ui/components';
import { effect } from './audio';

const yearName = (item: Milestone) => item.year + (item.project ? ' · проект' : '');
type Props = { progress: Progress; update: (p: Progress) => void; onBack: () => void };

function SourceTable() {
  const groups = [['МРОТ', supplements.mrot], ['ПМ трудоспособного населения', supplements.pm], ['МРОТ / ПМ', supplements.ratio]] as const;
  return <>
    <div class="timeline-track" role="group" aria-label="Годы из таблицы 7">
      {milestones.map(item => <span class={item.project ? 'timeline-project' : ''} key={item.year}>{yearName(item)}</span>)}
    </div>
    <details class="real-details history-table">
      <summary>Показать вехи таблицы 7</summary>
      <p>МРОТ дан на конец года. ПМ и отношение МРОТ / ПМ — средние за год. Суммы до 1998 года показаны в новых рублях.</p>
      <table><thead><tr><th scope="col">Год</th><th scope="col">МРОТ, ₽</th><th scope="col">ПМ, ₽</th><th scope="col">МРОТ / ПМ</th></tr></thead>
        <tbody>{milestones.map(item => <tr key={item.year}><th scope="row">{yearName(item)}{item.denominated && <small>в новых рублях</small>}</th>
          <td>{item.mrot}</td><td>{item.pm}</td><td>{item.ratio}</td></tr>)}</tbody></table>
      <p class="real-source">Методичка v5, п. 2.4, табл. 7</p>
    </details>
    <details class="real-details history-dates"><summary>Даты и значения из текста</summary>
      {groups.map(([label, list]) => <section key={label}><h3>{label}</h3><ul>{list.map((item, i) =>
        <li key={i}><b>{item.date}</b> · {item.value}{'note' in item && item.note && <> · {item.note}</>}<small>{item.source}</small></li>)}</ul></section>)}
    </details>
  </>;
}

function ComparisonCard({ item, revealed }: { item: Milestone; revealed: boolean }) {
  return <article class="history-year">
    <h3>{yearName(item)}</h3>
    {item.denominated && <span class="real-source">Суммы в новых рублях</span>}
    {revealed ? <>
      <dl><div><dt>МРОТ / ПМ</dt><dd class="history-ratio">{item.ratio}</dd></div>
        <div><dt>МРОТ на конец года</dt><dd>{item.mrot} ₽</dd></div>
        <div><dt>Средний ПМ</dt><dd>{item.pm} ₽</dd></div></dl>
      <p>{item.event}</p><small class="real-source">{item.source}</small>
    </> : <p class="history-questionmark" aria-label="Отношение скрыто">?</p>}
  </article>;
}

function HistoryRound({ progress, update }: Omit<Props, 'onBack'>) {
  const state = progress.study.history;
  const pair = historyPairs[state.turn];
  const [order, setOrder] = useState(sortStart);
  function answer(correct: boolean) {
    effect(correct ? 'stamp' : 'click', progress.sound);
    update(submitHistory(progress, correct));
  }
  function move(index: number, by: number) {
    const next = [...order];
    [next[index], next[index + by]] = [next[index + by], next[index]];
    setOrder(next);
  }
  return <section class="real-task">
    <div class="real-task-head"><h2>{pair ? 'Выше или ниже?' : 'Расставьте события'}</h2><span>{state.turn + 1} / {historyPairs.length + 1}</span></div>
    {pair ? <>
      <p>Отношение МРОТ / ПМ во второй вехе выше или ниже, чем в первой?</p>
      <div class="history-comparison" aria-live="polite"><ComparisonCard item={pair[0]} revealed/><ComparisonCard item={pair[1]} revealed={state.accepted}/></div>
      {!state.accepted && <div class="real-actions">
        <Button type="button" onClick={() => answer(ratioHigher(...pair))}>Выше</Button>
        <Button type="button" variant="secondary" onClick={() => answer(!ratioHigher(...pair))}>Ниже</Button>
      </div>}
    </> : <>
      <p>Поставьте события от самого раннего к самому позднему.</p>
      <ol class="history-sort">{(state.accepted ? sortKey : order).map((year, index) => {
        const item = findMilestone(year);
        return <li key={year}><span>{state.accepted && <b>{year} · </b>}{item.event}</span>
          {!state.accepted && <div class="history-arrows">
            <button type="button" aria-label={'Поднять: ' + item.event} disabled={index === 0} onClick={() => move(index, -1)}>↑</button>
            <button type="button" aria-label={'Опустить: ' + item.event} disabled={index === order.length - 1} onClick={() => move(index, 1)}>↓</button>
          </div>}
        </li>;
      })}</ol>
      {state.accepted ? <p class="real-source">Методичка v5, п. 2.4, табл. 7</p>
        : <Button type="button" onClick={() => answer(chronological(order))}>Проверить порядок</Button>}
    </>}
    {!state.accepted && state.attempts > 0 && <div role="status"><Hint detailed={state.attempts >= 2}>
      <p>{pair ? pair[1].event + ' · ' + pair[1].source : 'Последнее повышение перед заморозкой датировано 1997 годом (п. 2.4, табл. 7).'}</p>
      {state.attempts >= 2 && <details class="real-details"><summary>Сверить с источником</summary>
        {pair ? <ComparisonCard item={pair[1]} revealed/> : <ol>{sortKey.map(year => <li key={year}>{year} · {findMilestone(year).event}</li>)}</ol>}
      </details>}
      <MethodNote topics={['history']}/>
    </Hint></div>}
    {state.accepted && <div class="real-actions"><span role="status">Верно · +{attemptReward({ hint: false, attempts: state.attempts })} XP</span>
      <Button type="button" onClick={() => { effect('paper', progress.sound); update(nextHistory(progress)); }}>
        {pair ? 'Следующий ход' : 'Завершить уровень'} <Icon name="arrow"/>
      </Button></div>}
  </section>;
}

export function LevelOne({ progress, update, onBack }: Props) {
  const complete = progress.study.history.turn > historyPairs.length;
  return <section class="game-screen real-screen history-screen">
    <div class="game-breadcrumb"><button type="button" onClick={onBack}>Архив дел</button><span>/</span><span>Уровень 1</span></div>
    <div class="section-heading game-heading"><div><h1>Машина времени</h1></div></div>
    <Folder><Document class="history-paper">
      <h2>Вехи МРОТ и прожиточного минимума</h2>
      <p class="real-source">Методичка v5, часть 2, п. 2.1–2.4</p>
      <SourceTable/>
    </Document></Folder>
    {complete ? <div class="inspection-panel real-task">
      <Stamp>Историк МРОТ</Stamp><h2>Уровень пройден</h2><Button type="button" onClick={onBack}>Вернуться в архив</Button>
    </div> : <div class="inspection-panel"><HistoryRound key={progress.study.history.turn} progress={progress} update={update}/></div>}
  </section>;
}
