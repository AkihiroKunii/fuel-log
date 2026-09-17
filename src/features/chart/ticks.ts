// グラフの軸目盛・軸範囲の計算(純粋関数)。CLAUDE.md §5 / 要件 §5 S2。
// 日付演算はすべて UTC(src/core/dates.ts と同じ方針。端末のタイムゾーンに依存しない)。

export const DAY_MS = 86_400_000;
const MIN_ALL_RANGE_SPAN_DAYS = 14;

function utcParts(ms: number): { y: number; m: number; d: number } {
  const dt = new Date(ms);
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth(), d: dt.getUTCDate() };
}

/** y年・monthIndex月の1日 0時(UTC)。monthIndex は 0-11 の範囲外でもよい(Date.UTC が年へ繰り上げ/繰り下げる)。 */
function monthStart(y: number, monthIndex: number): number {
  return Date.UTC(y, monthIndex, 1);
}

/** ms 以降(当日含む)で最初の月曜 0時(UTC)。 */
function mondayOnOrAfter(ms: number): number {
  const { y, m, d } = utcParts(ms);
  const dayStart = Date.UTC(y, m, d);
  const dow = new Date(dayStart).getUTCDay(); // 0=日 .. 6=土
  const diffToMonday = (8 - dow) % 7; // 月曜(dow=1)なら0
  return dayStart + diffToMonday * DAY_MS;
}

function weeklyTicks(startMs: number, endMs: number): number[] {
  const out: number[] = [];
  for (let t = mondayOnOrAfter(startMs); t <= endMs; t += 7 * DAY_MS) out.push(t);
  return out;
}

/** startMs 以降(当日含む)で最初の「everyNMonths の倍数月」の1日。 */
function monthlyTicks(startMs: number, endMs: number, everyNMonths: number): number[] {
  const s = utcParts(startMs);
  const base = s.m - (s.m % everyNMonths);
  const first = monthStart(s.y, base) < startMs ? base + everyNMonths : base;
  const out: number[] = [];
  for (let m = first, t = monthStart(s.y, m); t <= endMs; m += everyNMonths, t = monthStart(s.y, m)) {
    out.push(t);
  }
  return out;
}

function yearlyTicks(startMs: number, endMs: number): number[] {
  const s = utcParts(startMs);
  const firstYear = s.m === 0 && s.d === 1 ? s.y : s.y + 1;
  const out: number[] = [];
  for (let y = firstYear, t = monthStart(y, 0); t <= endMs; y += 1, t = monthStart(y, 0)) {
    out.push(t);
  }
  return out;
}

/**
 * 期間の長さに応じた、4〜7個程度の「切りのよい」目盛(UTC epoch ms)。
 * 〜45日: 週単位(月曜) / 〜200日: 月初 / 〜800日: 3か月ごとの月初 / 〜1500日: 半年ごと(1・7月) /
 * それ以上: 年初。目盛が3本未満になる場合は1段階細かい間隔にフォールバックする
 * (境界付近では上限7本を若干超えることがある)。
 */
export function buildTimeTicks(startMs: number, endMs: number): number[] {
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    return [startMs];
  }
  const spanDays = (endMs - startMs) / DAY_MS;

  if (spanDays <= 45) return weeklyTicks(startMs, endMs);

  if (spanDays <= 200) {
    const t = monthlyTicks(startMs, endMs, 1);
    return t.length >= 3 ? t : weeklyTicks(startMs, endMs);
  }
  if (spanDays <= 800) {
    const t = monthlyTicks(startMs, endMs, 3);
    return t.length >= 3 ? t : monthlyTicks(startMs, endMs, 1);
  }
  if (spanDays <= 1500) {
    const t = monthlyTicks(startMs, endMs, 6);
    return t.length >= 3 ? t : monthlyTicks(startMs, endMs, 3);
  }
  const t = yearlyTicks(startMs, endMs);
  return t.length >= 3 ? t : monthlyTicks(startMs, endMs, 6);
}

/** 目盛ラベル。期間が約200日以下なら 'M/D'、それより長ければ 'YY/M'(例 '25/4')。 */
export function formatTick(ms: number, spanDays: number): string {
  const { y, m, d } = utcParts(ms);
  if (spanDays <= 200) return `${m + 1}/${d}`;
  const yy = String(((y % 100) + 100) % 100).padStart(2, '0');
  return `${yy}/${m + 1}`;
}

export interface XDomainInput {
  /** 今日(dateToMs)。 */
  todayMs: number;
  /** rangeStart(range, today) を dateToMs した値。range が 'all' のときは null。 */
  rangeStartMs: number | null;
  /** 最古の記録日(dateToMs)。データが無ければ null。 */
  oldestMs: number | null;
}

/**
 * グラフ X 軸の範囲。1か月/半年/1年は rangeStart〜today。全期間は最古の記録日〜today で最短14日幅
 * (最古が14日以内なら today-14日から)。
 */
export function xDomainMs({ todayMs, rangeStartMs, oldestMs }: XDomainInput): [number, number] {
  if (rangeStartMs !== null) return [rangeStartMs, todayMs];
  const minStart = todayMs - MIN_ALL_RANGE_SPAN_DAYS * DAY_MS;
  const oldest = oldestMs ?? todayMs;
  return [Math.min(oldest, minStart), todayMs];
}

/**
 * Y軸の範囲。floor(min - pad) 〜 ceil(max + pad)。
 * values が空(値が1つも無い)場合は [0, pad*2] を返す(呼び出し側はこの場合グラフを描画しない想定)。
 */
export function yDomain(values: readonly number[], pad: number): [number, number] {
  let min: number | null = null;
  let max: number | null = null;
  for (const v of values) {
    if (!Number.isFinite(v)) continue;
    if (min === null || v < min) min = v;
    if (max === null || v > max) max = v;
  }
  if (min === null || max === null) return [0, pad * 2];
  return [Math.floor(min - pad), Math.ceil(max + pad)];
}

/** 整数刻み step で lo〜hi に収まる目盛を返す(lo 以上で最初の step の倍数から)。 */
function ticksForStep(lo: number, hi: number, step: number): number[] {
  const first = Math.ceil(lo / step) * step;
  const out: number[] = [];
  for (let v = first; v <= hi + 1e-9; v += step) out.push(Math.round(v));
  return out;
}

/** 1 / 2 / 5 / 10 系(10のべき乗倍。前後1桁ぶん)の「切りのよい」整数刻みの候補。 */
function niceStepCandidates(span: number): number[] {
  if (!(span > 0)) return [1];
  const pow = 10 ** Math.floor(Math.log10(span));
  const out = new Set<number>();
  for (const scale of [pow / 10, pow, pow * 10]) {
    for (const mult of [1, 2, 5, 10]) out.add(Math.max(1, Math.round(mult * scale)));
  }
  return Array.from(out).sort((a, b) => a - b);
}

/**
 * Y軸の目盛(整数・4〜6本目安)。domain の幅が0(または不正)なら1本だけ返す。
 *
 * まず 1/2/5/10 系の「切りのよい」刻みの中から本数が4〜6本に収まるものを探し(複数あれば
 * 最も細かい=本数が多いものを選ぶ)、無ければ整数刻みを1から順に広げて4〜6本に入る最初の
 * ものを使う(それでも無理なら、5本に最も近い本数のものを使う)。
 */
export function buildYTicks(domain: readonly [number, number]): number[] {
  const [lo, hi] = domain;
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return [0];
  if (hi <= lo) return [Math.round(lo)];

  const span = hi - lo;

  const niceInRange = niceStepCandidates(span)
    .map((step) => ticksForStep(lo, hi, step))
    .filter((ticks) => ticks.length >= 4 && ticks.length <= 6);
  if (niceInRange.length > 0) {
    return niceInRange.reduce((best, t) => (t.length > best.length ? t : best));
  }

  const maxStep = Math.max(1, Math.ceil(span));
  let prev = ticksForStep(lo, hi, 1);
  for (let step = 1; step <= maxStep; step += 1) {
    const ticks = ticksForStep(lo, hi, step);
    if (ticks.length <= 6) {
      if (ticks.length >= 4 || step === 1) return ticks;
      return Math.abs(ticks.length - 5) <= Math.abs(prev.length - 5) ? ticks : prev;
    }
    prev = ticks;
  }
  return prev.length > 0 ? prev : [Math.round(lo), Math.round(hi)];
}
