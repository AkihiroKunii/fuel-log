// 統計行: 平均/最高/最低/件数の4タイル + 期間合計(muted の1行)。
import { DASH, formatKmPerL, formatYen } from '../../core/format';
import type { PeriodStats } from '../../core/types';
import { formatKmGrouped, formatLitersGrouped } from './numberFormat';

export function StatsRow({
  stats,
  isPeriodEmpty,
}: {
  stats: PeriodStats;
  /** 選択期間に1件も記録が無い(データ自体は存在する)場合。数値の0と区別してダッシュ表示にする。 */
  isPeriodEmpty: boolean;
}) {
  return (
    <section className="card">
      <div className="stats-grid">
        <StatTile label="平均" value={formatKmPerL(stats.avgKmPerL)} />
        <StatTile label="最高" value={formatKmPerL(stats.maxKmPerL)} />
        <StatTile label="最低" value={formatKmPerL(stats.minKmPerL)} />
        <StatTile label="件数" value={isPeriodEmpty ? DASH : String(stats.count)} />
      </div>
      <p className="stats-total hint">
        {isPeriodEmpty ? (
          `走行 ${DASH} km ・ 給油 ${DASH} L ・ ${DASH}円`
        ) : (
          <>
            走行 {formatKmGrouped(stats.totalKm)} km ・ 給油 {formatLitersGrouped(stats.totalLiters)} L
            ・ {formatYen(stats.totalYen)}円
          </>
        )}
      </p>
    </section>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat-tile">
      <div className="stat-tile-label">{label}</div>
      <div className="stat-tile-value">{value}</div>
    </div>
  );
}
