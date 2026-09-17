import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useConfirm } from '../../app/ConfirmDialog';
import { useToast } from '../../app/Toast';
import { useToday } from '../../app/useToday';
import {
  BACKUP_MIME,
  backupFileName,
  backupToJson,
  buildBackup,
  parseBackup,
} from '../../core/backup';
import { CSV_MIME, csvFileName, parseCsv, toCsv } from '../../core/csv';
import { todayJst } from '../../core/dates';
import { db } from '../../core/db';
import { saveTextFile, type SaveResult } from '../../core/download';
import { deriveFillups } from '../../core/fuel';
import { appendFillups, deleteAllFillups, restoreBackup } from '../../core/repo';
import type { StoredFillup } from '../../core/types';

export function SettingsPanel({ fillups }: { fillups: readonly StoredFillup[] }) {
  const settings = useLiveQuery(() => db.settings.toArray(), []) ?? [];
  const today = useToday();
  const toast = useToast();
  const confirm = useConfirm();
  const derived = useMemo(() => deriveFillups(fillups), [fillups]);
  const count = fillups.length;

  const csvInputRef = useRef<HTMLInputElement>(null);
  const backupInputRef = useRef<HTMLInputElement>(null);
  const [csvErrors, setCsvErrors] = useState<string[] | null>(null);
  const [backupError, setBackupError] = useState<string | null>(null);

  // 保存できたかを確かめられない経路('unconfirmed')では「書き出しました」と言い切らない
  // (バックアップが取れていないのに取れたと誤認させないため)。
  function notifyExported(result: SaveResult, n: number) {
    if (result === 'cancelled') return;
    if (result === 'unconfirmed') {
      toast(
        '共有シートを使えませんでした。ファイルが保存されたか「ファイル」アプリで確認してください',
        'error',
      );
      return;
    }
    toast(`${n} 件を書き出しました`);
  }

  // クリックハンドラ内で await を挟まずに saveTextFile を呼ぶ(ユーザー操作の有効期限切れを避ける。download.ts 参照)。
  // 書き出す文字列は useLiveQuery で手元にあるデータから同期的に作る。
  async function handleExportCsv() {
    if (count === 0) return;
    const n = count;
    const result = await saveTextFile(csvFileName(today), toCsv(derived), CSV_MIME);
    notifyExported(result, n);
  }

  async function handleExportBackup() {
    if (count === 0) return;
    const n = count;
    const result = await saveTextFile(
      backupFileName(today),
      backupToJson(buildBackup(fillups, settings)),
      BACKUP_MIME,
    );
    notifyExported(result, n);
  }

  async function handleCsvFileChange(e: ChangeEvent<HTMLInputElement>) {
    const input = e.target;
    const file = input.files?.[0];
    if (!file) return;
    setCsvErrors(null);
    try {
      const text = await file.text();
      const result = parseCsv(text, today);
      if (!result.ok) {
        setCsvErrors(result.errors);
        return;
      }
      const ok = await confirm({
        title: 'CSVを取り込みますか？',
        message: `${result.rows.length} 件を追記します（現在 ${count} 件）。`,
        confirmLabel: '取り込む',
      });
      if (!ok) return;
      const imported = await appendFillups(result.rows);
      toast(`${imported} 件を取り込みました`);
    } catch {
      toast('取り込みに失敗しました', 'error');
    } finally {
      input.value = '';
    }
  }

  async function handleBackupFileChange(e: ChangeEvent<HTMLInputElement>) {
    const input = e.target;
    const file = input.files?.[0];
    if (!file) return;
    setBackupError(null);
    try {
      const text = await file.text();
      const result = parseBackup(text);
      if (!result.ok) {
        setBackupError(result.error);
        return;
      }
      const backup = result.backup;
      const exportedDate = todayJst(new Date(backup.exportedAt));
      const ok = await confirm({
        title: 'バックアップから復元しますか？',
        message: `現在の ${count} 件をすべて削除し、バックアップの ${backup.tables.fillups.length} 件（書き出し日: ${exportedDate}）に置き換えます。`,
        confirmLabel: '置き換える',
        danger: true,
      });
      if (!ok) return;
      await restoreBackup(backup);
      toast(`${backup.tables.fillups.length} 件を復元しました`);
    } catch {
      toast('復元に失敗しました', 'error');
    } finally {
      input.value = '';
    }
  }

  async function handleDeleteAll() {
    if (count === 0) return;
    const ok = await confirm({
      title: '全データを削除しますか？',
      message: `${count} 件の記録をすべて削除します。元に戻せません。先にバックアップの書き出しをおすすめします。`,
      confirmLabel: 'すべて削除',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteAllFillups();
      toast('削除しました');
    } catch {
      toast('削除に失敗しました', 'error');
    }
  }

  return (
    <div className="card">
      <h2>データ管理</h2>
      <p className="settings-count">保存件数: {count} 件</p>

      <div className="settings-actions">
        <h3 className="settings-group-title">書き出し</h3>
        <button
          type="button"
          className="btn btn-secondary btn-block"
          onClick={handleExportCsv}
          disabled={count === 0}
        >
          CSV書き出し
        </button>
        <p className="hint">現在の記録をCSVファイルに書き出します。</p>

        <button
          type="button"
          className="btn btn-secondary btn-block"
          onClick={handleExportBackup}
          disabled={count === 0}
        >
          バックアップ書き出し（JSON）
        </button>
        <p className="hint">
          全データをバックアップファイルに書き出します。機種変更前におすすめです。
        </p>

        <h3 className="settings-group-title">取り込み</h3>
        <button
          type="button"
          className="btn btn-secondary btn-block"
          onClick={() => csvInputRef.current?.click()}
        >
          CSV取込（追記）
        </button>
        <p className="hint">
          CSVファイルを読み込み、現在の記録に追記します。既存の記録は消えません。
        </p>
        <input
          ref={csvInputRef}
          type="file"
          accept=".csv,text/csv"
          className="settings-file-input"
          aria-label="CSVファイルを選択"
          onChange={handleCsvFileChange}
        />
        {csvErrors && (
          <div className="settings-error" role="alert">
            {csvErrors.slice(0, 5).map((msg, i) => (
              <p key={i}>{msg}</p>
            ))}
            {csvErrors.length > 5 && <p>ほか {csvErrors.length - 5} 件</p>}
          </div>
        )}

        <button
          type="button"
          className="btn btn-secondary btn-block"
          onClick={() => backupInputRef.current?.click()}
        >
          バックアップから復元（置換）
        </button>
        <p className="hint">バックアップファイルを読み込み、現在の記録をすべて置き換えます。</p>
        <input
          ref={backupInputRef}
          type="file"
          accept=".json,application/json"
          className="settings-file-input"
          aria-label="バックアップファイルを選択"
          onChange={handleBackupFileChange}
        />
        {backupError && (
          <div className="settings-error" role="alert">
            <p>{backupError}</p>
          </div>
        )}

        <h3 className="settings-group-title">削除</h3>
        <button
          type="button"
          className="btn btn-danger btn-block"
          onClick={handleDeleteAll}
          disabled={count === 0}
        >
          全データを削除
        </button>
        <p className="hint">保存されているすべての記録を削除します。元に戻せません。</p>
      </div>

      <p className="settings-footnote hint">
        データはこの端末のブラウザ内だけに保存されます。機種変更の前にバックアップを書き出してください。
      </p>
    </div>
  );
}
