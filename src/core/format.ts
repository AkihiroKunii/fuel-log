// 表示用フォーマッタ(CLAUDE.md §4.4 規則11)。内部値は丸めず、丸めるのは表示と CSV だけ。
//
// 丸めの方針: 二進浮動小数の誤差で表示がぶれないよう、Number#toFixed ではなく
// 「値の最短十進表記を指数シフトしてから四捨五入する」方式を使う。
//   (1.005).toFixed(2) === '1.00'(実際の 2 進値が 1.00499… のため)
//   roundTo(1.005, 2) === 1.01(人が見ている '1.005' を丸める)
// 符号は先に外して絶対値で丸めるので、負数も 0 から遠い側へ丸まる(-1.005 → -1.01)。

/** 値が無い場合の表示(全角ダッシュ)。 */
export const DASH = '—';

type Num = number | null | undefined;

function isNum(v: Num): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

/** digits 桁に四捨五入する(0 から遠い側へ)。 */
export function roundTo(value: number, digits: number): number {
  if (!Number.isFinite(value)) return value;
  const sign = value < 0 ? -1 : 1;
  const abs = Math.abs(value);
  const s = String(abs);
  // 極端に大きい/小さい値は String() が指数表記になり 'e' の二重付与になるため、通常の乗除にフォールバック
  const shifted = s.includes('e') || s.includes('E') ? abs * 10 ** digits : Number(`${s}e${digits}`);
  const rounded = Math.round(shifted);
  const back = Number.isFinite(rounded) && Math.abs(rounded) < 1e21 ? Number(`${rounded}e-${digits}`) : rounded / 10 ** digits;
  const out = sign * back;
  return out === 0 ? 0 : out; // -0 を 0 に正規化
}

/** 小数第1位に四捨五入(前回差の計算などでも使う)。 */
export function round1(value: number): number {
  return roundTo(value, 1);
}

/** 小数第2位に四捨五入。 */
export function round2(value: number): number {
  return roundTo(value, 2);
}

/** digits 桁に丸めてから固定小数点の文字列にする。 */
function fixed(value: number, digits: number): string {
  return roundTo(value, digits).toFixed(digits);
}

/** 末尾の 0 と小数点を落とす('412.0' → '412'、'28.50' → '28.5')。 */
function stripTrailingZeros(s: string): string {
  if (!s.includes('.')) return s;
  return s.replace(/\.?0+$/, '');
}

/** 3桁区切りを入れる。 */
function group3(intPart: string): string {
  return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** 燃費。小数1桁固定('14.5')。 */
export function formatKmPerL(v: Num): string {
  return isNum(v) ? fixed(v, 1) : DASH;
}

/** 円/L。小数1桁固定('160.0')。 */
export function formatYenPerL(v: Num): string {
  return isNum(v) ? fixed(v, 1) : DASH;
}

/** 円/km。小数2桁固定('11.03')。 */
export function formatYenPerKm(v: Num): string {
  return isNum(v) ? fixed(v, 2) : DASH;
}

/** 走行距離。小数1桁まで・末尾0は省略('412.3' / '412')。 */
export function formatKm(v: Num): string {
  return isNum(v) ? stripTrailingZeros(fixed(v, 1)) : DASH;
}

/** 給油量。小数2桁まで・末尾0は省略('28.5' / '28.55' / '28')。 */
export function formatLiters(v: Num): string {
  return isNum(v) ? stripTrailingZeros(fixed(v, 2)) : DASH;
}

/** 金額。整数・3桁区切り('4,560')。 */
export function formatYen(v: Num): string {
  if (!isNum(v)) return DASH;
  const n = roundTo(v, 0);
  const sign = n < 0 ? '-' : '';
  return sign + group3(Math.abs(n).toFixed(0));
}
