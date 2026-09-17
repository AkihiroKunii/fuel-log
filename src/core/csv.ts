// CSV の書き出し・取込(CLAUDE.md §4.6 / 要件 S3)。
import { roundTo } from './format';
import { sortFillups } from './fuel';
import { FIELD_LABELS, validateFillupForm, type FillupField } from './validation';
import type { DateStr, DerivedFillup, FillupInput } from './types';

export const CSV_HEADER = 'date,tripKm,liters,yen,partial,kmPerL';
export const CSV_MIME = 'text/csv';

/** 取込に必須の列(kmPerL は派生値なので有っても無くてもよく、値は無視する)。 */
const REQUIRED_COLUMNS = ['date', 'tripKm', 'liters', 'yen', 'partial'] as const;
type RequiredColumn = (typeof REQUIRED_COLUMNS)[number];

/** エラー表示の並び順。 */
const FIELD_ORDER: FillupField[] = ['date', 'tripKm', 'liters', 'yen'];

const HEADER_ERROR = 'ヘッダが正しくありません（1行目に date,tripKm,liters,yen,partial が必要です）';
const COLUMN_COUNT_ERROR = '列数が足りません';
const PARTIAL_ERROR = 'partial は true/false/1/0/空 のいずれかで入力してください';

/** 書き出しファイル名。 */
export function csvFileName(today: DateStr): string {
  return `fuel-log-${today}.csv`;
}

/** 数値はそのままの値を文字列にする(丸めない)。 */
function numText(n: number): string {
  return String(n);
}

/**
 * 昇順・改行 \n・末尾改行あり・BOM なし。
 * yen が null なら空欄、partial は true/false、kmPerL は小数1桁(null は空欄)。
 * tripKm・liters は丸めず数値そのまま。
 */
export function toCsv(derived: readonly DerivedFillup[]): string {
  const lines: string[] = [CSV_HEADER];
  for (const r of sortFillups(derived)) {
    lines.push(
      [
        r.date,
        numText(r.tripKm),
        numText(r.liters),
        r.yen === null ? '' : numText(r.yen),
        r.partial ? 'true' : 'false',
        r.kmPerL === null ? '' : roundTo(r.kmPerL, 1).toFixed(1),
      ].join(','),
    );
  }
  return `${lines.join('\n')}\n`;
}

/**
 * 1行を列に分ける。書き出し側はクォートしないが、Excel 等で再保存されたファイルに備えて
 * ダブルクォート("" は " のエスケープ)を解釈する。フィールド内の改行には対応しない
 * (この CSV の値は日付・数値・真偽値だけなので改行は現れない)。
 */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  let i = 0;
  while (i < line.length) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i += 2;
          continue;
        }
        quoted = false;
        i += 1;
        continue;
      }
      cur += ch;
      i += 1;
      continue;
    }
    if (ch === '"' && cur.trim() === '') {
      quoted = true;
      cur = '';
      i += 1;
      continue;
    }
    if (ch === ',') {
      out.push(cur);
      cur = '';
      i += 1;
      continue;
    }
    cur += ch;
    i += 1;
  }
  out.push(cur);
  return out.map((f) => f.trim());
}

/** true/false/1/0/空(空は false)。それ以外は null(エラー)。 */
function parsePartial(raw: string): boolean | null {
  const s = raw.trim().toLowerCase();
  if (s === '' || s === 'false' || s === '0') return false;
  if (s === 'true' || s === '1') return true;
  return null;
}

/** メッセージが項目名で始まらない場合だけ「項目名: 」を前置する。 */
function withLabel(field: FillupField, message: string): string {
  const label = FIELD_LABELS[field];
  return message.startsWith(label) ? message : `${label}: ${message}`;
}

/**
 * CSV を取り込む。先頭 BOM・CRLF・空行を許容し、列はヘッダ名で対応付ける(順序不問・余分な列は無視)。
 * **全行が妥当なときだけ ok: true**。1行でも不正なら何も取り込まない。
 * errors は `3行目: 走行距離: …` の形式(行番号は元ファイルの行番号)。
 */
export function parseCsv(
  text: string,
  today: DateStr,
): { ok: true; rows: FillupInput[] } | { ok: false; errors: string[] } {
  const lines = text.replace(/^﻿/, '').split(/\r\n|\r|\n/);

  let headerIdx = -1;
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].trim() !== '') {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx < 0) return { ok: false, errors: [`1行目: ${HEADER_ERROR}`] };

  const header = splitCsvLine(lines[headerIdx]).map((h) => h.toLowerCase());
  const columnAt = {} as Record<RequiredColumn, number>;
  for (const name of REQUIRED_COLUMNS) {
    const at = header.indexOf(name.toLowerCase());
    if (at < 0) return { ok: false, errors: [`${headerIdx + 1}行目: ${HEADER_ERROR}`] };
    columnAt[name] = at;
  }
  const lastRequiredIdx = Math.max(...REQUIRED_COLUMNS.map((n) => columnAt[n]));

  const errors: string[] = [];
  const rows: FillupInput[] = [];

  for (let i = headerIdx + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.trim() === '') continue; // 空行は無視
    const lineNo = i + 1;
    const fields = splitCsvLine(line);
    if (fields.length <= lastRequiredIdx) {
      errors.push(`${lineNo}行目: ${COLUMN_COUNT_ERROR}`);
      continue;
    }

    const partial = parsePartial(fields[columnAt.partial]);
    if (partial === null) errors.push(`${lineNo}行目: ${PARTIAL_ERROR}`);

    const result = validateFillupForm(
      {
        date: fields[columnAt.date],
        tripKm: fields[columnAt.tripKm],
        liters: fields[columnAt.liters],
        yen: fields[columnAt.yen],
        partial: partial ?? false,
      },
      today,
    );

    if (!result.ok) {
      for (const field of FIELD_ORDER) {
        const message = result.errors[field];
        if (message) errors.push(`${lineNo}行目: ${withLabel(field, message)}`);
      }
      continue;
    }
    if (partial === null) continue; // partial のエラーは記録済み
    rows.push(result.value);
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, rows };
}
