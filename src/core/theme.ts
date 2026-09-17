// グラフ(Recharts)で使う色定数。CSSの外で JS の値として色が要る箇所(stroke/fill props)専用。
// 値は src/app/styles.css の :root トークンと必ず一致させる。変更したら両方を直す。
export const chartColors = {
  accent: '#3987e5', // 燃費線(kmPerL)。主ボタンと同色
  accentHi: '#5aa2f2', // 燃費線のグラデーション/点のハイライト用
  cost: '#d95926', // 円/L・円/km の線
  avg: '#8fa0b8', // 平均線(灰の破線)
  good: '#34d399', // 前回比 良化(▲)
  bad: '#f4845f', // 前回比 悪化(▼)
  grid: '#1f2a44', // グリッド線(--border と同色)
  axisText: '#8fa0b8', // 軸ラベル・ツールチップの文字(--muted と同色。系列色で文字は塗らない)
  labelText: '#b6c2d6', // グラフ内の直接ラベル(--text-2 と同色)
  surface: '#131c31', // カード面(--card と同色)。点マーカーのリング色に使う
} as const;

export type ChartColorKey = keyof typeof chartColors;
