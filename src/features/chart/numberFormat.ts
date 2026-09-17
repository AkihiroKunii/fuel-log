// 期間合計行(統計カードの下の1行)専用の表示フォーマッタ。
// src/core/format.ts の formatKm / formatLiters は小数の丸め・末尾0の省略はするが
// 3桁区切りはしない(一覧・記録画面では大きい値を想定していないため)。
// この画面の「走行 1,234.5 km」のような表示のためだけに、桁区切りを足す薄いラッパーをここに置く。
import { DASH, formatKm, formatLiters } from '../../core/format';

/** 整数部分にだけ3桁区切りのカンマを入れる(符号・小数部はそのまま)。 */
function groupIntegerPart(s: string): string {
  const negative = s.startsWith('-');
  const body = negative ? s.slice(1) : s;
  const [intPart, fracPart] = body.split('.');
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (negative ? '-' : '') + grouped + (fracPart !== undefined ? `.${fracPart}` : '');
}

/** 走行距離(km)。formatKm の出力(小数1桁まで・末尾0省略)に3桁区切りを足す。 */
export function formatKmGrouped(v: Parameters<typeof formatKm>[0]): string {
  const s = formatKm(v);
  return s === DASH ? s : groupIntegerPart(s);
}

/** 給油量(L)。formatLiters の出力(小数2桁まで・末尾0省略)に3桁区切りを足す。 */
export function formatLitersGrouped(v: Parameters<typeof formatLiters>[0]): string {
  const s = formatLiters(v);
  return s === DASH ? s : groupIntegerPart(s);
}
