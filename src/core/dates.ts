// 日付ユーティリティ(CLAUDE.md §4.3)。
// 日付はすべて 'YYYY-MM-DD' の文字列(Asia/Tokyo の暦日)で扱い、内部演算は UTC で行う。
// UTC で計算するのは、端末のタイムゾーンや夏時間で日付がずれないようにするため。
import type { DateStr, RangeKey } from './types';

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 86_400_000;

/** 'YYYY-MM-DD' を {y, m, d} に分解する。形式・実在性が不正なら null。 */
function parseDateStr(s: string): { y: number; m: number; d: number } | null {
  const m = DATE_RE.exec(s);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  // 実在チェック: UTC で組み立てて元の値に戻るか(2026-02-30 は 03-02 になるので false)
  const t = Date.UTC(y, mo - 1, d);
  const dt = new Date(t);
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return { y, m: mo, d };
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** UTC の epoch ms を 'YYYY-MM-DD' にする。 */
function msToDateStr(ms: number): DateStr {
  const dt = new Date(ms);
  return `${String(dt.getUTCFullYear()).padStart(4, '0')}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
}

/**
 * Asia/Tokyo における「今日」。端末のタイムゾーン設定に依存しない。
 * 純粋関数の中で new Date() を呼ばないための唯一の例外で、テストでは now を渡す。
 */
export function todayJst(now: Date = new Date()): DateStr {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  let y = '';
  let m = '';
  let d = '';
  for (const p of parts) {
    if (p.type === 'year') y = p.value;
    else if (p.type === 'month') m = p.value;
    else if (p.type === 'day') d = p.value;
  }
  return `${y.padStart(4, '0')}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

/** 'YYYY-MM-DD' の形式で、かつ実在する日付か(2026-02-30 は false、2028-02-29 は true)。 */
export function isValidDateStr(s: string): boolean {
  return parseDateStr(s) !== null;
}

/** UTC 00:00 の epoch ms(グラフの時間軸用)。不正な日付は RangeError。 */
export function dateToMs(date: DateStr): number {
  const p = parseDateStr(date);
  if (!p) throw new RangeError(`invalid date: ${date}`);
  return Date.UTC(p.y, p.m - 1, p.d);
}

/** days 日後(負なら前)の日付。UTC 演算なので夏時間の影響を受けない。不正な日付は RangeError。 */
export function addDays(date: DateStr, days: number): DateStr {
  return msToDateStr(dateToMs(date) + Math.trunc(days) * MS_PER_DAY);
}

/** 表示範囲の開始日(その日を含む)。'all' は null。 */
export function rangeStart(range: RangeKey, today: DateStr): DateStr | null {
  switch (range) {
    case '1m':
      return addDays(today, -30);
    case '6m':
      return addDays(today, -182);
    case '1y':
      return addDays(today, -365);
    case 'all':
      return null;
  }
}
