// グラフ用のデータ整形(純粋関数)。DerivedFillup の配列を MetricLineChart に渡す形へ変換する。
// 燃費計算そのもの(kmPerL 等)は src/core/fuel.ts の責務。ここでは表示用の並べ替えだけを行う。
import { dateToMs } from '../../core/dates';
import type { DerivedFillup } from '../../core/types';

export interface ChartPoint {
  t: number;
  value: number | null;
  row: DerivedFillup;
}

/** DerivedFillup の配列を、指定した指標を取り出したグラフ用の点列にする。並び順は保つ(非破壊)。 */
export function buildSeries(
  rows: readonly DerivedFillup[],
  pick: (row: DerivedFillup) => number | null,
): ChartPoint[] {
  return rows.map((row) => ({ t: dateToMs(row.date), value: pick(row), row }));
}

/** 値の単純平均(null・undefined・非有限値は除く)。対象が無ければ null。 */
export function average(values: readonly (number | null | undefined)[]): number | null {
  let sum = 0;
  let count = 0;
  for (const v of values) {
    if (v === null || v === undefined || !Number.isFinite(v)) continue;
    sum += v;
    count += 1;
  }
  return count > 0 ? sum / count : null;
}

/** 点の半径とリング有無。期間内の点数(描画される点の数)が多いほど小さく・リング無しにする。 */
export function dotRadius(pointCount: number): { r: number; ring: boolean } {
  if (pointCount <= 60) return { r: 4, ring: true };
  if (pointCount <= 150) return { r: 3, ring: true };
  return { r: 2, ring: false };
}

/** value が非 null の最後(最新)の点。無ければ undefined。 */
export function lastNonNullPoint(points: readonly ChartPoint[]): ChartPoint | undefined {
  for (let i = points.length - 1; i >= 0; i -= 1) {
    if (points[i].value !== null) return points[i];
  }
  return undefined;
}
