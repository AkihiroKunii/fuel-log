// ファイル保存(CLAUDE.md §4.8)。DOM に依存するため単体テストは持たない。
//
// iOS のホーム画面 PWA では <a download> が不安定なので、可能なら Web Share API
// (「ファイルに保存」)を使う。**クリックハンドラ内で await を挟まずに呼ぶこと**
// (ユーザー操作の有効期限が切れると share が拒否される)。

/** iOS / iPadOS か。iPadOS 13+ は UA が Macintosh になるので maxTouchPoints で見分ける。 */
export function isIos(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent ?? '';
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  return /Macintosh/.test(ua) && typeof navigator.maxTouchPoints === 'number' && navigator.maxTouchPoints > 1;
}

function isAbortError(e: unknown): boolean {
  return typeof e === 'object' && e !== null && (e as { name?: unknown }).name === 'AbortError';
}

function downloadViaAnchor(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  // すぐ revoke するとダウンロードが始まらないブラウザがあるため遅延させる
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export type SaveResult = 'saved' | 'shared' | 'cancelled' | 'unconfirmed';

/**
 * テキストをファイルとして保存する。
 * 'shared' = Web Share API(共有シート)で渡した / 'cancelled' = 共有シートで取り消された /
 * 'saved' = <a download> で保存した(iOS 以外) /
 * 'unconfirmed' = iOS で共有シートを使えず <a download> を試みた。iOS のホーム画面PWAでは
 * これが効かないことがあり、保存できたかをアプリ側では確かめられない。呼び出し側は
 * 「書き出しました」と言い切らず、確認を促すこと(バックアップが取れたと誤認させない)。
 */
export async function saveTextFile(filename: string, text: string, mime: string): Promise<SaveResult> {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const ios = isIos();

  if (ios && typeof navigator !== 'undefined' && typeof navigator.canShare === 'function') {
    const file = new File([blob], filename, { type: mime });
    if (navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file] });
        return 'shared';
      } catch (e) {
        if (isAbortError(e)) return 'cancelled';
        // 共有に失敗したときは <a download> にフォールバックする
      }
    }
  }

  downloadViaAnchor(blob, filename);
  return ios ? 'unconfirmed' : 'saved';
}
