import { createContext, useContext } from 'react';

export type TabId = 'record' | 'chart' | 'list';

export interface AppNavValue {
  tab: TabId;
  setTab: (tab: TabId) => void;
  openEditor: (id: number) => void;
  closeEditor: () => void;
}

// App.tsx は各タブを import し、各タブはこの hook を import する。
// 循環 import を避けるため、コンテキストは App.tsx ではなくここに置く。
export const AppNavContext = createContext<AppNavValue | null>(null);

export function useAppNav(): AppNavValue {
  const ctx = useContext(AppNavContext);
  if (!ctx) throw new Error('useAppNav must be used within the App');
  return ctx;
}
