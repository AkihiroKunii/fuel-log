// 入力検証(CLAUDE.md §4.5 / 要件 S1)。S1 のフォームと CSV 取込の両方でこれを使う。
import { isValidDateStr } from './dates';
import type { DateStr, FillupInput } from './types';

export interface FillupFormValues {
  date: string;
  tripKm: string;
  liters: string;
  yen: string;
  partial: boolean;
}

export type FillupField = 'date' | 'tripKm' | 'liters' | 'yen';
export type FillupFormErrors = Partial<Record<FillupField, string>>;

/** 検証メッセージ(固定文言。CLAUDE.md §4.5)。 */
export const MESSAGES = {
  dateRequired: '日付を入力してください',
  dateInvalid: '日付が正しくありません（YYYY-MM-DD の実在する日付）',
  tripKmRequired: '走行距離を入力してください',
  litersRequired: '給油量を入力してください',
  notNumber: '数値で入力してください',
  tripKmRange: '1〜2,000 km の範囲で入力してください',
  litersRange: '0.5〜120 L の範囲で入力してください',
  yenRange: '0〜50,000 円の整数で入力してください',
  decimals1: '小数第1位までで入力してください',
  decimals2: '小数第2位までで入力してください',
  futureDate: '日付は今日以前にしてください',
} as const;

/** 項目名(エラー表示や CSV の行メッセージで使う)。 */
export const FIELD_LABELS: Record<FillupField, string> = {
  date: '日付',
  tripKm: '走行距離',
  liters: '給油量',
  yen: '金額',
};

/** 入力の許容範囲(UI の min/max にも使える)。 */
export const LIMITS = {
  tripKm: { min: 1, max: 2000, decimals: 1 },
  liters: { min: 0.5, max: 120, decimals: 2 },
  yen: { min: 0, max: 50_000, decimals: 0 },
} as const;

/** 前後の空白を除き、NFKC で全角→半角に正規化する。 */
export function normalizeText(s: string): string {
  return s.normalize('NFKC').trim();
}

/** 数値入力の正規化(NFKC・前後空白除去・桁区切りカンマ除去)。 */
export function normalizeNumberText(s: string): string {
  return normalizeText(s).replace(/,/g, '');
}

// 受理する数値の形: 整数部が必須で、小数点があれば1桁以上。
// '412.'・'.5'・'1e3'・'-5' はここで弾かれ「数値で入力してください」になる。
const NUMBER_RE = /^\d+(\.\d+)?$/;

/** 文字列のまま小数桁数を数える(浮動小数に変換してから数えない)。 */
function decimalsOf(s: string): number {
  const dot = s.indexOf('.');
  return dot < 0 ? 0 : s.length - dot - 1;
}

interface NumberRule {
  required: boolean;
  requiredMessage: string;
  min: number;
  max: number;
  decimals: number;
  decimalsMessage: string;
  rangeMessage: string;
}

/**
 * 数値項目を検証する。チェック順は 必須 → 数値の形 → 小数桁 → 範囲。
 * 空文字は(任意項目なら)null を返す。
 */
function validateNumber(raw: string, rule: NumberRule): { ok: true; value: number | null } | { ok: false; error: string } {
  const s = normalizeNumberText(raw);
  if (s === '') {
    return rule.required ? { ok: false, error: rule.requiredMessage } : { ok: true, value: null };
  }
  if (!NUMBER_RE.test(s)) return { ok: false, error: MESSAGES.notNumber };
  if (decimalsOf(s) > rule.decimals) return { ok: false, error: rule.decimalsMessage };
  const value = Number(s);
  if (!Number.isFinite(value) || value < rule.min || value > rule.max) {
    return { ok: false, error: rule.rangeMessage };
  }
  return { ok: true, value };
}

const TRIP_KM_RULE: NumberRule = {
  required: true,
  requiredMessage: MESSAGES.tripKmRequired,
  min: LIMITS.tripKm.min,
  max: LIMITS.tripKm.max,
  decimals: LIMITS.tripKm.decimals,
  decimalsMessage: MESSAGES.decimals1,
  rangeMessage: MESSAGES.tripKmRange,
};

const LITERS_RULE: NumberRule = {
  required: true,
  requiredMessage: MESSAGES.litersRequired,
  min: LIMITS.liters.min,
  max: LIMITS.liters.max,
  decimals: LIMITS.liters.decimals,
  decimalsMessage: MESSAGES.decimals2,
  rangeMessage: MESSAGES.litersRange,
};

const YEN_RULE: NumberRule = {
  required: false,
  requiredMessage: MESSAGES.yenRange,
  min: LIMITS.yen.min,
  max: LIMITS.yen.max,
  decimals: LIMITS.yen.decimals,
  decimalsMessage: MESSAGES.yenRange, // 小数の金額も「0〜50,000 円の整数で…」に寄せる
  rangeMessage: MESSAGES.yenRange,
};

/** 日付の検証(必須・実在・今日以前)。形式不正/実在しない日付も「日付を入力してください」。 */
function validateDate(raw: string, today: DateStr): { ok: true; value: DateStr } | { ok: false; error: string } {
  const s = normalizeText(raw);
  if (s === '') return { ok: false, error: MESSAGES.dateRequired };
  if (!isValidDateStr(s)) return { ok: false, error: MESSAGES.dateInvalid };
  if (s > today) return { ok: false, error: MESSAGES.futureDate };
  return { ok: true, value: s };
}

/**
 * S1 のフォーム1件分を検証する。エラーは項目ごとに1件ずつ、まとめて返す。
 */
export function validateFillupForm(
  v: FillupFormValues,
  today: DateStr,
): { ok: true; value: FillupInput } | { ok: false; errors: FillupFormErrors } {
  const errors: FillupFormErrors = {};

  const date = validateDate(v.date, today);
  if (!date.ok) errors.date = date.error;

  const tripKm = validateNumber(v.tripKm, TRIP_KM_RULE);
  if (!tripKm.ok) errors.tripKm = tripKm.error;

  const liters = validateNumber(v.liters, LITERS_RULE);
  if (!liters.ok) errors.liters = liters.error;

  // 金額は小数桁 0 として検証するので、通れば必ず整数
  const yen = validateNumber(v.yen, YEN_RULE);
  if (!yen.ok) errors.yen = yen.error;

  if (!date.ok || !tripKm.ok || !liters.ok || !yen.ok) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      date: date.value,
      tripKm: tripKm.value as number,
      liters: liters.value as number,
      yen: yen.value,
      partial: v.partial,
    },
  };
}
