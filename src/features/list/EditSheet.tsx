import { useLiveQuery } from 'dexie-react-hooks';
import { Sheet } from '../../app/Sheet';
import { useConfirm } from '../../app/ConfirmDialog';
import { useToast } from '../../app/Toast';
import { useToday } from '../../app/useToday';
import { db } from '../../core/db';
import { formatKm, formatLiters } from '../../core/format';
import { deleteFillup, updateFillup } from '../../core/repo';
import type { FillupInput } from '../../core/types';
import { FillupForm } from '../record/FillupForm';

export function EditSheet({ id, onClose }: { id: number | null; onClose: () => void }) {
  const today = useToday();
  const toast = useToast();
  const confirm = useConfirm();
  const fillups = useLiveQuery(() => db.fillups.toArray(), []) ?? [];
  const row = id === null ? undefined : fillups.find((r) => r.id === id);
  const open = row !== undefined;

  async function handleSubmit(input: FillupInput) {
    if (id === null) return;
    try {
      await updateFillup(id, input);
      toast('変更を保存しました');
      onClose();
    } catch {
      toast('保存に失敗しました', 'error');
      throw new Error('updateFillup failed');
    }
  }

  async function handleDelete() {
    if (!row) return;
    const ok = await confirm({
      title: 'この記録を削除しますか？',
      message: `${row.date} / ${formatKm(row.tripKm)} km / ${formatLiters(row.liters)} L`,
      confirmLabel: '削除する',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteFillup(row.id);
      toast('削除しました');
      onClose();
    } catch {
      toast('削除に失敗しました', 'error');
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="記録を編集">
      {row && (
        <FillupForm
          key={row.id}
          mode="edit"
          initial={row}
          existing={fillups}
          today={today}
          submitLabel="変更を保存"
          onSubmit={handleSubmit}
          footer={
            <button type="button" className="btn btn-danger btn-block" onClick={handleDelete}>
              この記録を削除
            </button>
          }
        />
      )}
    </Sheet>
  );
}
