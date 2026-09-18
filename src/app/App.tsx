import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import { ToastProvider } from './Toast';
import { ConfirmProvider } from './ConfirmDialog';
import { TabBar } from './TabBar';
import { AppNavContext, type AppNavValue, type TabId } from './nav';
import { RecordTab } from '../features/record/RecordTab';
import { ListTab } from '../features/list/ListTab';
import { EditSheet } from '../features/list/EditSheet';
import { PwaStatus } from './PwaStatus';

// グラフ(Recharts)は重いので別チャンクにし、起動直後の「記録」を軽くする。
// チャンクは Service Worker が事前キャッシュするのでオフラインでも開ける。
const ChartTab = lazy(() =>
  import('../features/chart/ChartTab').then((m) => ({ default: m.ChartTab })),
);

function AppShell() {
  const [tab, setTab] = useState<TabId>('record');
  const [editingId, setEditingId] = useState<number | null>(null);

  const openEditor = useCallback((id: number) => setEditingId(id), []);
  const closeEditor = useCallback(() => setEditingId(null), []);

  const nav = useMemo<AppNavValue>(
    () => ({ tab, setTab, openEditor, closeEditor }),
    [tab, openEditor, closeEditor],
  );

  // タブを切り替えたら先頭から見せる(前のタブのスクロール位置を引き継がない)
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [tab]);

  return (
    <AppNavContext.Provider value={nav}>
      <div className="app">
        <main className="app-main">
          {/* 記録タブは隠すだけでアンマウントしない(グラフや一覧を見て戻っても入力途中の値が残る) */}
          <div hidden={tab !== 'record'}>
            <RecordTab />
          </div>
          {tab === 'chart' && (
            <Suspense fallback={null}>
              <ChartTab />
            </Suspense>
          )}
          {tab === 'list' && <ListTab />}
          <PwaStatus />
        </main>
        <TabBar />
      </div>
      <EditSheet id={editingId} onClose={closeEditor} />
    </AppNavContext.Provider>
  );
}

export function App() {
  return (
    <ToastProvider>
      <ConfirmProvider>
        <AppShell />
      </ConfirmProvider>
    </ToastProvider>
  );
}
