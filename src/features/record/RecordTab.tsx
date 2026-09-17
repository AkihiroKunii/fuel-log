import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { useAppNav } from '../../app/nav';
import { useToast } from '../../app/Toast';
import { useToday } from '../../app/useToday';
import { db } from '../../core/db';
import { addFillup } from '../../core/repo';
import type { FillupInput } from '../../core/types';
import { FillupForm } from './FillupForm';
import { RecentList } from './RecentList';
import { SavedNotice } from './SavedNotice';
import './record.css';

export function RecordTab() {
  const today = useToday();
  const toast = useToast();
  const { openEditor } = useAppNav();
  const fillups = useLiveQuery(() => db.fillups.toArray(), []) ?? [];
  const [savedId, setSavedId] = useState<number | null>(null);

  async function handleSubmit(input: FillupInput) {
    try {
      const id = await addFillup(input);
      setSavedId(id);
    } catch {
      toast('保存に失敗しました', 'error');
      // FillupForm 側に失敗を伝えて、入力をクリアさせない
      throw new Error('addFillup failed');
    }
  }

  return (
    <div>
      <h1>記録</h1>
      <div className="card">
        <FillupForm
          mode="create"
          existing={fillups}
          today={today}
          submitLabel="保存"
          onSubmit={handleSubmit}
          onDirty={() => setSavedId(null)}
        />
      </div>

      {savedId !== null && <SavedNotice fillups={fillups} savedId={savedId} />}

      <div className="card">
        <RecentList fillups={fillups} onSelect={openEditor} />
      </div>
    </div>
  );
}
