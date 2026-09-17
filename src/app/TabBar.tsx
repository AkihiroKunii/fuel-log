import type { ReactNode } from 'react';
import { useAppNav, type TabId } from './nav';

const TABS: Array<{ id: TabId; label: string; icon: ReactNode }> = [
  { id: 'record', label: '記録', icon: <RecordIcon /> },
  { id: 'chart', label: 'グラフ', icon: <ChartIcon /> },
  { id: 'list', label: '一覧', icon: <ListIcon /> },
];

export function TabBar() {
  const { tab, setTab } = useAppNav();

  return (
    <nav className="tab-bar">
      {TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => setTab(t.id)}
          aria-current={tab === t.id ? 'page' : undefined}
        >
          <span aria-hidden="true">{t.icon}</span>
          {t.label}
        </button>
      ))}
    </nav>
  );
}

function RecordIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v8M8 12h8" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 4v16h16" />
      <path d="M7 15l4-5 3 3 5-7" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="4.5" cy="6" r="1.1" fill="currentColor" stroke="none" />
      <path d="M9 6h11" />
      <circle cx="4.5" cy="12" r="1.1" fill="currentColor" stroke="none" />
      <path d="M9 12h11" />
      <circle cx="4.5" cy="18" r="1.1" fill="currentColor" stroke="none" />
      <path d="M9 18h11" />
    </svg>
  );
}
