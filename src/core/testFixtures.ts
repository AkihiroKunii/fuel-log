// テスト用のフィクスチャ(docs/samples/)。テストからのみ import する。
// ファイル名を *.test.ts にしていないのは、Vitest がこれ自体をテストとして拾わないようにするため。
// 読み込みに node:fs を使わないのは、tsconfig.app.json に "types": ["node"] が無く
// (TypeScript 6 は @types/node を自動では読まない)、tsc -b が通らなくなるため。
// Vite / Vitest の ?raw インポート(型は vite/client)なら設定を触らずに済む。
import sampleCsv from '../../docs/samples/fillups-sample.csv?raw';
import sampleBackupJson from '../../docs/samples/backup-sample.json?raw';
import { parseBackup } from './backup';
import type { StoredFillup } from './types';

/** docs/samples/fillups-sample.csv の中身。 */
export function readSampleCsv(): string {
  return sampleCsv;
}

/** docs/samples/backup-sample.json の中身。 */
export function readSampleBackupJson(): string {
  return sampleBackupJson;
}

/** サンプルバックアップの fillups(CSV サンプルと同じデータ)。 */
export function sampleFillups(): StoredFillup[] {
  const parsed = parseBackup(readSampleBackupJson());
  if (!parsed.ok) throw new Error(`backup-sample.json が読めません: ${parsed.error}`);
  return parsed.backup.tables.fillups;
}
