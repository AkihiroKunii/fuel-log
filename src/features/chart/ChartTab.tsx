// S2 グラフタブ。範囲切替(1か月/半年/1年/全期間)が下の全要素(燃費・コストの2グラフ+統計)に効く。
//
// データの流れ(順序厳守): useLiveQuery で全件取得 → deriveFillups(全件) → filterByRange(期間) → periodStats。
// 派生計算を先に全データへ行うのは、期間外の部分給油を期間内の満タン行へ合算するため(CLAUDE.md §4.4 規則5)。
import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useAppNav } from '../../app/nav';
import { Segmented } from '../../app/Segmented';
import { useToday } from '../../app/useToday';
import { db } from '../../core/db';
import { dateToMs, rangeStart } from '../../core/dates';
import {
  formatKm,
  formatKmPerL,
  formatLiters,
  formatYen,
  formatYenPerKm,
  formatYenPerL,
} from '../../core/format';
import { deriveFillups, filterByRange, periodStats } from '../../core/fuel';
import { RANGE_OPTIONS, loadRange, saveRange } from '../../core/settings';
import { chartColors } from '../../core/theme';
import type { DerivedFillup, RangeKey } from '../../core/types';
import './chart.css';
import { MetricLineChart } from './MetricLineChart';
import { StatsRow } from './StatsRow';
import { average, buildSeries, lastNonNullPoint } from './chartSeries';
import { xDomainMs } from './ticks';

type CostMetric = 'yenPerL' | 'yenPerKm';

const COST_OPTIONS: { value: CostMetric; label: string }[] = [
  { value: 'yenPerL', label: '円/L' },
  { value: 'yenPerKm', label: '円/km' },
];

export function ChartTab() {
  const { setTab } = useAppNav();
  const today = useToday();
  const rows = useLiveQuery(() => db.fillups.toArray(), []);
  const [range, setRange] = useState<RangeKey>(() => loadRange());
  const [costMetric, setCostMetric] = useState<CostMetric>('yenPerL');

  const derived = useMemo(() => (rows ? deriveFillups(rows) : []), [rows]);
  const periodRows = useMemo(() => filterByRange(derived, range, today), [derived, range, today]);
  const stats = useMemo(() => periodStats(periodRows), [periodRows]);

  // X軸の範囲: 1か月/半年/1年は rangeStart〜today、全期間は最古の記録日〜today(最短14日幅)。
  const domain = useMemo<[number, number] | null>(() => {
    if (derived.length === 0) return null;
    const start = rangeStart(range, today);
    return xDomainMs({
      todayMs: dateToMs(today),
      rangeStartMs: start === null ? null : dateToMs(start),
      oldestMs: dateToMs(derived[0].date),
    });
  }, [derived, range, today]);

  const kmPerLPoints = useMemo(() => buildSeries(periodRows, (r) => r.kmPerL), [periodRows]);
  const costPoints = useMemo(
    () => buildSeries(periodRows, (r) => (costMetric === 'yenPerL' ? r.yenPerL : r.yenPerKm)),
    [periodRows, costMetric],
  );

  const latest = useMemo(() => lastNonNullPoint(kmPerLPoints), [kmPerLPoints]);
  // 期間内に行はあっても、部分給油だけだと燃費の値が1つも無い(空の軸だけのグラフを描かない)
  const hasKmPerLData = latest !== undefined;

  const costValues = useMemo(
    () => costPoints.map((p) => p.value).filter((v): v is number => v !== null),
    [costPoints],
  );
  const costAvg = useMemo(() => (costValues.length > 1 ? average(costValues) : null), [costValues]);

  const loaded = rows !== undefined;
  const hasAnyData = derived.length > 0;
  const isPeriodEmpty = periodRows.length === 0;
  const hasCostData = costValues.length > 0;

  const costUnit = costMetric === 'yenPerL' ? '円/L' : '円/km';
  const costFormatter = costMetric === 'yenPerL' ? formatYenPerL : formatYenPerKm;

  const handleRangeChange = (next: RangeKey) => {
    setRange(next);
    saveRange(next);
  };

  return (
    <div>
      <h1>グラフ</h1>

      {!loaded ? null : !hasAnyData ? (
        <div className="empty">
          <p>記録タブから最初の給油を登録してください</p>
          <button type="button" className="btn btn-primary" onClick={() => setTab('record')}>
            記録する
          </button>
        </div>
      ) : (
        <>
          <Segmented
            options={RANGE_OPTIONS}
            value={range}
            onChange={handleRangeChange}
            ariaLabel="表示範囲"
          />

          {/* 燃費カード */}
          <section className="card chart-card">
            <div className="chart-card-header">
              <h2 className="chart-card-title">
                燃費 <span className="chart-card-unit">km/L</span>
              </h2>
              {latest && (
                <div className="chart-card-latest">
                  <div className="chart-card-latest-top">
                    <span className="chart-card-latest-label">最新</span>
                    <span className="chart-card-latest-value">{formatKmPerL(latest.value)}</span>
                  </div>
                  <div className="chart-card-latest-date">{latest.row.date}</div>
                </div>
              )}
            </div>
            {isPeriodEmpty ? (
              <p className="hint chart-empty">この期間の記録はありません</p>
            ) : !hasKmPerLData ? (
              <p className="hint chart-empty">
                この期間は部分給油だけのため、燃費はまだ算出されていません
              </p>
            ) : (
              domain && (
                <MetricLineChart
                  points={kmPerLPoints}
                  startMs={domain[0]}
                  endMs={domain[1]}
                  color={chartColors.accent}
                  yPad={1}
                  unit="km/L"
                  valueFormatter={formatKmPerL}
                  detailLine={(row: DerivedFillup) =>
                    `${formatKm(row.tripKm)} km ・ ${formatLiters(row.liters)} L`
                  }
                  gapNote="破線は、部分給油をまたいだ区間です"
                  nullLabel={() => '部分給油（次の満タン給油に合算）'}
                  ariaLabel={`燃費の推移。期間内 ${stats.count} 件${
                    stats.count > 1 && stats.avgKmPerL !== null
                      ? `、平均 ${formatKmPerL(stats.avgKmPerL)} km/L`
                      : ''
                  }`}
                />
              )
            )}
          </section>

          {/* 統計行 */}
          <StatsRow stats={stats} isPeriodEmpty={isPeriodEmpty} />

          {/* コストカード */}
          <section className="card chart-card">
            <div className="chart-card-header">
              <h2 className="chart-card-title">コスト</h2>
              <div className="chart-card-toggle">
                <Segmented
                  options={COST_OPTIONS}
                  value={costMetric}
                  onChange={setCostMetric}
                  ariaLabel="コストの単位"
                />
              </div>
            </div>
            {isPeriodEmpty ? (
              <p className="hint chart-empty">この期間の記録はありません</p>
            ) : !hasCostData ? (
              <p className="hint chart-empty">金額の記録がありません</p>
            ) : (
              domain && (
                <MetricLineChart
                  points={costPoints}
                  startMs={domain[0]}
                  endMs={domain[1]}
                  color={chartColors.cost}
                  yPad={costMetric === 'yenPerL' ? 5 : 1}
                  unit={costUnit}
                  valueFormatter={costFormatter}
                  detailLine={(row: DerivedFillup) => `${formatYen(row.yen)}円`}
                  gapNote={
                    costMetric === 'yenPerL'
                      ? '破線は、金額の記録が無い給油をまたいだ区間です'
                      : '破線は、部分給油や金額の記録が無い給油をまたいだ区間です'
                  }
                  nullLabel={(row: DerivedFillup) =>
                    row.yen === null ? '金額の記録なし' : '部分給油（次の満タン給油に合算）'
                  }
                  ariaLabel={`${costUnit}の推移。期間内 ${costValues.length} 件${
                    costAvg !== null ? `、平均 ${costFormatter(costAvg)} ${costUnit}` : ''
                  }`}
                />
              )
            )}
          </section>
        </>
      )}
    </div>
  );
}
