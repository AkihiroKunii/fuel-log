// 汎用の折れ線グラフ部品。燃費(km/L)・円/L・円/km のどれでも、色とフォーマッタを差し替えて使い回す。
// Recharts は v3 系。型は node_modules/recharts の型定義で確認済み(v2 の API とは細部が異なる)。
import { useMemo } from 'react';
import type { ReactNode } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type DotItemDotProps,
  type TooltipPayload,
} from 'recharts';
import { chartColors } from '../../core/theme';
import type { DerivedFillup } from '../../core/types';
import { average, dotRadius, hasBridgedGap, type ChartPoint } from './chartSeries';
import { DAY_MS, buildTimeTicks, buildYTicks, formatTick, yDomain } from './ticks';

export interface MetricLineChartProps {
  /** 期間内の点列(t 昇順)。value が null の点は線が切れ、点も描かれない(部分給油の行など)。 */
  points: ChartPoint[];
  /** X軸の範囲(dateToMs 済み)。 */
  startMs: number;
  endMs: number;
  /** 系列色(theme.chartColors から)。 */
  color: string;
  /** Y軸の余白(km/L・円/km は目安1、円/Lは目安5)。 */
  yPad: number;
  /** ツールチップ・平均線ラベルの単位表記('km/L' 等)。 */
  unit: string;
  /** 表示用フォーマッタ(src/core/format.ts のもの)。 */
  valueFormatter: (v: number | null | undefined) => string;
  /** ツールチップ3行目(例: '412.3 km ・ 28.5 L'、コストなら '4,560円')。 */
  detailLine: (row: DerivedFillup) => string;
  /** role="img" に付ける aria-label。 */
  ariaLabel: string;
  /**
   * 値の無い点(部分給油・金額未入力の行)をまたぐ区間は破線でつなぐ。その破線の意味を説明する注記。
   * 期間内にそういう区間があるときだけグラフの下に出す。
   */
  gapNote: string;
  /** 値の無い点のツールチップに、値の代わりに出す説明(例: '部分給油（次の満タンに合算）')。 */
  nullLabel: (row: DerivedFillup) => string;
}

function ChartTooltipContent({
  active,
  payload,
  color,
  unit,
  valueFormatter,
  detailLine,
  nullLabel,
}: {
  active: boolean;
  payload: TooltipPayload;
  color: string;
  unit: string;
  valueFormatter: (v: number | null | undefined) => string;
  detailLine: (row: DerivedFillup) => string;
  nullLabel: (row: DerivedFillup) => string;
}) {
  if (!active || payload.length === 0) return null;
  const point = payload.find((entry) => entry?.payload)?.payload as ChartPoint | undefined;
  if (!point) return null;

  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-date">{point.row.date}</div>
      {point.value === null ? (
        <div className="chart-tooltip-null">{nullLabel(point.row)}</div>
      ) : (
        <div className="chart-tooltip-value">
          <span className="chart-tooltip-swatch" style={{ background: color }} aria-hidden="true" />
          <span className="chart-tooltip-value-num">{valueFormatter(point.value)}</span>
          <span className="chart-tooltip-value-unit">{unit}</span>
        </div>
      )}
      <div className="chart-tooltip-detail">{detailLine(point.row)}</div>
      {point.row.mergedPartials > 0 && (
        <div className="chart-tooltip-merged">部分給油 {point.row.mergedPartials} 回分を合算</div>
      )}
    </div>
  );
}

interface AvgLabelProps {
  viewBox?: { x?: number; y?: number; width?: number };
}

// グラフ上端の余白(LineChart の margin.top)。平均線のラベルをこの帯に置く。
const PLOT_TOP = 26;

/**
 * 平均線の直接ラベル(破線のキー + 「平均 14.2」)。プロット領域の**外側**(上の余白の右端)に置く。
 * 線の脇やプロット領域の内側に置くと、データの点や線と重なって読めなくなる場合がある
 * (Y軸の余裕はデータ単位、ラベルの高さは px 固定なので、内側では重ならない保証ができない)。
 * 余白の帯にはデータが絶対に来ない。
 */
function AvgLabel({ viewBox, text }: AvgLabelProps & { text: string }) {
  if (!viewBox || typeof viewBox.x !== 'number' || typeof viewBox.width !== 'number') {
    return null;
  }
  const right = viewBox.x + viewBox.width - 2;
  const baseline = PLOT_TOP - 9;
  return (
    <g>
      <line
        x1={right - 18}
        x2={right}
        y1={baseline - 4}
        y2={baseline - 4}
        stroke={chartColors.avg}
        strokeDasharray="4 3"
      />
      <text x={right - 24} y={baseline} textAnchor="end" fontSize={11} fill={chartColors.labelText}>
        {text}
      </text>
    </g>
  );
}

export function MetricLineChart({
  points,
  startMs,
  endMs,
  color,
  yPad,
  unit,
  valueFormatter,
  detailLine,
  ariaLabel,
  gapNote,
  nullLabel,
}: MetricLineChartProps) {
  const spanDays = (endMs - startMs) / DAY_MS;

  const xTicks = useMemo(() => buildTimeTicks(startMs, endMs), [startMs, endMs]);

  const values = useMemo(
    () => points.map((p) => p.value).filter((v): v is number => v !== null),
    [points],
  );

  const yRange = useMemo(() => yDomain(values, yPad), [values, yPad]);
  const yTicks = useMemo(() => buildYTicks(yRange), [yRange]);
  const avg = useMemo(() => (values.length > 1 ? average(values) : null), [values]);
  const { r, ring } = useMemo(() => dotRadius(values.length), [values.length]);
  const showGapNote = useMemo(() => hasBridgedGap(points), [points]);

  const renderDot = (dotProps: DotItemDotProps): ReactNode => {
    const { cx, cy, index, value } = dotProps;
    if (typeof cx !== 'number' || typeof cy !== 'number' || value === null || value === undefined) {
      return null;
    }
    return (
      <circle
        key={`dot-${index}`}
        cx={cx}
        cy={cy}
        r={r}
        fill={color}
        stroke={ring ? chartColors.surface : 'none'}
        strokeWidth={ring ? 2 : 0}
      />
    );
  };

  return (
    <div className="metric-chart" role="img" aria-label={ariaLabel}>
      <ResponsiveContainer width="100%" height={248}>
        <LineChart
          data={points}
          margin={{ top: PLOT_TOP, right: 8, bottom: 0, left: 0 }}
          accessibilityLayer={false}
        >
          <CartesianGrid vertical={false} stroke={chartColors.grid} />
          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={[startMs, endMs]}
            ticks={xTicks}
            tickFormatter={(v) => formatTick(Number(v), spanDays)}
            tick={{ fontSize: 11, fill: chartColors.axisText }}
            axisLine={{ stroke: chartColors.grid }}
            tickLine={false}
            padding={{ left: 12, right: 12 }}
          />
          <YAxis
            domain={yRange}
            ticks={yTicks}
            allowDecimals={false}
            width={36}
            tick={{ fontSize: 11, fill: chartColors.axisText }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            // 値の無い点(部分給油など)でもツールチップを出し、値の代わりに理由を表示する
            filterNull={false}
            cursor={{ stroke: chartColors.grid, strokeWidth: 1 }}
            content={({ active, payload }) => (
              <ChartTooltipContent
                active={active}
                payload={payload}
                color={color}
                unit={unit}
                valueFormatter={valueFormatter}
                detailLine={detailLine}
                nullLabel={nullLabel}
              />
            )}
          />
          {avg !== null && (
            <ReferenceLine
              y={avg}
              stroke={chartColors.avg}
              strokeDasharray="6 4"
              zIndex={300}
              label={(labelProps: AvgLabelProps) => (
                <AvgLabel {...labelProps} text={`平均 ${valueFormatter(avg)}`} />
              )}
            />
          )}
          {/*
            値の無い点(部分給油・金額未入力の行)をまたぐ区間を破線でつなぐ(2026-09-18 本人決定)。
            同じデータを connectNulls の破線で下の層に描き、その上に実線(connectNulls なし)を重ねる。
            実線がある区間では破線は隠れ、実線が切れる区間でだけ破線が見える。
          */}
          <Line
            dataKey="value"
            type="linear"
            stroke={color}
            strokeWidth={2}
            strokeOpacity={0.75}
            strokeDasharray="5 4"
            connectNulls
            isAnimationActive={false}
            dot={false}
            activeDot={false}
            legendType="none"
            tooltipType="none"
            zIndex={350}
          />
          <Line
            dataKey="value"
            type="linear"
            stroke={color}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            connectNulls={false}
            isAnimationActive={false}
            dot={renderDot}
            activeDot={{ r: r + 2, fill: color, stroke: chartColors.surface, strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
      {showGapNote && (
        <p className="chart-gap-note">
          <svg width="22" height="6" viewBox="0 0 22 6" aria-hidden="true">
            <line
              x1="1"
              y1="3"
              x2="21"
              y2="3"
              stroke={color}
              strokeWidth="2"
              strokeOpacity="0.75"
              strokeDasharray="5 4"
            />
          </svg>
          {gapNote}
        </p>
      )}
    </div>
  );
}
