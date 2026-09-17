// DB アクセスはここに集約する(CLAUDE.md §4.2)。
// コンポーネントから db.fillups.add 等を直接呼ばない(読み取りの useLiveQuery は可)。
import { db } from './db';
import type { BackupFile } from './backup';
import type { FillupInput, SettingRow, StoredFillup } from './types';

/** 1件追加する。createdAt = updatedAt = now。戻り値は採番された id。 */
export function addFillup(input: FillupInput, now: number = Date.now()): Promise<number> {
  return db.fillups.add({ ...input, createdAt: now, updatedAt: now });
}

/** 1件更新する。createdAt は維持し、updatedAt だけ now にする。存在しない id は何もしない。 */
export async function updateFillup(id: number, input: FillupInput, now: number = Date.now()): Promise<void> {
  await db.fillups.update(id, { ...input, updatedAt: now });
}

/** 物理削除(ゴミ箱は作らない)。 */
export async function deleteFillup(id: number): Promise<void> {
  await db.fillups.delete(id);
}

/** 全削除。 */
export async function deleteAllFillups(): Promise<void> {
  await db.fillups.clear();
}

/** CSV 取込。入力順に id を振る(bulkAdd は配列順に採番される)。戻り値は件数。 */
export async function appendFillups(inputs: readonly FillupInput[], now: number = Date.now()): Promise<number> {
  if (inputs.length === 0) return 0;
  const rows = inputs.map((input) => ({ ...input, createdAt: now, updatedAt: now }));
  await db.transaction('rw', db.fillups, async () => {
    await db.fillups.bulkAdd(rows);
  });
  return rows.length;
}

/** バックアップから復元する。1トランザクションで全テーブル clear → bulkAdd(id 維持)。 */
export async function restoreBackup(backup: BackupFile): Promise<void> {
  await db.transaction('rw', db.fillups, db.settings, async () => {
    await db.fillups.clear();
    await db.settings.clear();
    if (backup.tables.fillups.length > 0) await db.fillups.bulkAdd(backup.tables.fillups);
    if (backup.tables.settings.length > 0) await db.settings.bulkAdd(backup.tables.settings);
  });
}

/** 全件取得(書き出しやテスト用。画面の表示は useLiveQuery を使う)。 */
export function getAllFillups(): Promise<StoredFillup[]> {
  return db.fillups.toArray();
}

/** settings 全件(現時点では空。バックアップの組み立て用)。 */
export function getAllSettings(): Promise<SettingRow[]> {
  return db.settings.toArray();
}
