import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { ToastProvider } from './Toast';
import { ConfirmProvider } from './ConfirmDialog';
import { TabBar } from './TabBar';
import { RecordTab } from '../features/record/RecordTab';
import { ChartTab } from '../features/chart/ChartTab';
import { ListTab } from '../features/list/ListTab';
import { EditSheet } from '../features/list/EditSheet';

export type TabId = 'record' | 'chart' | 'list';

interface AppNavValue {
  tab: TabId;
  setTab: (tab: TabId) => void;
  openEditor: (id: number) => void;
  closeEditor: () => void;
}

const AppNavContext = createContext<AppNavValue | null>(null);

export function useAppNav(): AppNavValue {
  const ctx = useContext(AppNavContext);
  if (!ctx) throw new Error('useAppNav must be used within the App');
  return ctx;
}

function AppShell() {
  const [tab, setTab] = useState<TabId>('record');
  const [editingId, setEditingId] = useState<number | null>(null);

  const openEditor = useCallback((id: number) => setEditingId(id), []);
  const closeEditor = useCallback(() => setEditingId(null), []);

  const nav = useMemo<AppNavValue>(
    () => ({ tab, setTab, openEditor, closeEditor }),
    [tab, openEditor, closeEditor],
  );

  return (
    <AppNavContext.Provider value={nav}>
      <div className="app">
        <main className="app-main">
          {tab === 'record' && <RecordTab />}
          {tab === 'chart' && <ChartTab />}
          {tab === 'list' && <ListTab />}
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
