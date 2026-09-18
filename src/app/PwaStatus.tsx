import { useSyncExternalStore } from 'react';
import { useConfirm } from './ConfirmDialog';
import { pwa } from './pwaController';

export function PwaStatus() {
  const state = useSyncExternalStore(pwa.subscribe, pwa.getSnapshot);
  const confirm = useConfirm();
  async function refresh() {
    const accepted = await confirm({
      title: '新しい版に更新しますか？',
      message: '保存済みの記録は残ります。入力中の内容がある場合は、キャンセルして保存してから更新してください。',
      confirmLabel: '更新する',
    });
    if (accepted) await pwa.applyUpdate();
  }
  return (
    <aside className="pwa-status" aria-label="アプリの利用状況">
      <p className="hint" role="status">
        {state.error || (state.offlineReady ? 'オフラインで使えます。記録はこの端末に保存されます。' : 'オフラインで使う準備をしています…')}
      </p>
      {state.updateAvailable && (
        <button className="btn btn-secondary btn-block" type="button" disabled={state.updating} onClick={() => void refresh()}>
          {state.updating ? '更新中…' : '新しい版に更新'}
        </button>
      )}
    </aside>
  );
}
