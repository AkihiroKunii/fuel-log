// JSON バックアップ(CLAUDE.md §4.7 / 全体方針 §2)。buildBackup / parseBackup は純粋関数。
import { isValidDateStr } from './dates';
import { sortFillups } from './fuel';
import { LIMITS } from './validation';
import type { DateStr, SettingRow, StoredFillup } from './types';

export interface BackupFile {
  app: 'fuel-log';
  schemaVersion: 1;
  exportedAt: string; // ISO 8601
  tables: { fillups: StoredFillup[]; settings: SettingRow[] };
}

export const BACKUP_APP = 'fuel-log';
export const BACKUP_SCHEMA_VERSION = 1;
export const BACKUP_MIME = 'application/json';

/** 書き出しファイル名。 */
export function backupFileName(today: DateStr): string {
  return `fuel-log-backup-${today}.json`;
}

/** バックアップを組み立てる(fillups は昇順に整えて入れる)。 */
export function buildBackup(
  fillups: readonly StoredFillup[],
  settings: readonly SettingRow[],
  now: Date = new Date(),
): BackupFile {
  return {
    app: BACKUP_APP,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: now.toISOString(),
    tables: {
      fillups: sortFillups(fillups).map((r) => ({
        id: r.id,
        date: r.date,
        tripKm: r.tripKm,
        liters: r.liters,
        yen: r.yen,
        partial: r.partial,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      })),
      settings: settings.map((s) => ({ key: s.key, value: s.value })),
    },
  };
}

/** バックアップを保存用の JSON 文字列にする。 */
export function backupToJson(backup: BackupFile): string {
  return `${JSON.stringify(backup, null, 2)}\n`;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function inRange(v: number, min: number, max: number): boolean {
  return v >= min && v <= max;
}

/** 1行を検証して正規化する。不正なら項目名を返す。 */
function parseRow(v: unknown, index: number): { ok: true; row: StoredFillup } | { ok: false; error: string } {
  const bad = (field: string) => ({ ok: false as const, error: `fillups[${index}] の ${field} が不正です` });
  if (!isRecord(v)) return { ok: false, error: `fillups[${index}] が不正です` };

  if (!isFiniteNumber(v.id) || !Number.isInteger(v.id) || v.id < 1) return bad('id');
  if (typeof v.date !== 'string' || !isValidDateStr(v.date)) return bad('date');
  if (!isFiniteNumber(v.tripKm) || !inRange(v.tripKm, LIMITS.tripKm.min, LIMITS.tripKm.max)) return bad('tripKm');
  if (!isFiniteNumber(v.liters) || !inRange(v.liters, LIMITS.liters.min, LIMITS.liters.max)) return bad('liters');
  if (v.yen !== null) {
    if (!isFiniteNumber(v.yen) || !Number.isInteger(v.yen) || !inRange(v.yen, LIMITS.yen.min, LIMITS.yen.max)) {
      return bad('yen');
    }
  }
  if (typeof v.partial !== 'boolean') return bad('partial');
  if (!isFiniteNumber(v.createdAt)) return bad('createdAt');
  if (!isFiniteNumber(v.updatedAt)) return bad('updatedAt');

  return {
    ok: true,
    row: {
      id: v.id,
      date: v.date,
      tripKm: v.tripKm,
      liters: v.liters,
      yen: v.yen as number | null,
      partial: v.partial,
      createdAt: v.createdAt,
      updatedAt: v.updatedAt,
    },
  };
}

/**
 * バックアップ JSON を検証して読み取る。app・schemaVersion・各行の型と値域を見る
 * (壊れたファイルで DB を消さないため)。復元は repo.restoreBackup(置換)。
 */
export function parseBackup(text: string): { ok: true; backup: BackupFile } | { ok: false; error: string } {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: 'JSON として読み取れませんでした' };
  }

  if (!isRecord(data)) return { ok: false, error: 'バックアップの形式が正しくありません' };
  if (data.app !== BACKUP_APP) return { ok: false, error: 'このファイルは fuel-log のバックアップではありません' };
  if (data.schemaVersion !== BACKUP_SCHEMA_VERSION) {
    return { ok: false, error: `対応していないバックアップ形式です（schemaVersion: ${String(data.schemaVersion)}）` };
  }
  if (typeof data.exportedAt !== 'string') return { ok: false, error: 'バックアップの形式が正しくありません' };

  const tables = data.tables;
  if (!isRecord(tables) || !Array.isArray(tables.fillups) || !Array.isArray(tables.settings)) {
    return { ok: false, error: 'バックアップの形式が正しくありません' };
  }

  const fillups: StoredFillup[] = [];
  const seenIds = new Set<number>();
  for (let i = 0; i < tables.fillups.length; i += 1) {
    const parsed = parseRow(tables.fillups[i], i);
    if (!parsed.ok) return { ok: false, error: parsed.error };
    if (seenIds.has(parsed.row.id)) return { ok: false, error: 'fillups の id が重複しています' };
    seenIds.add(parsed.row.id);
    fillups.push(parsed.row);
  }

  const settings: SettingRow[] = [];
  for (let i = 0; i < tables.settings.length; i += 1) {
    const s = tables.settings[i];
    if (!isRecord(s) || typeof s.key !== 'string') return { ok: false, error: `settings[${i}] が不正です` };
    settings.push({ key: s.key, value: s.value });
  }

  return {
    ok: true,
    backup: {
      app: BACKUP_APP,
      schemaVersion: BACKUP_SCHEMA_VERSION,
      exportedAt: data.exportedAt,
      tables: { fillups, settings },
    },
  };
}
