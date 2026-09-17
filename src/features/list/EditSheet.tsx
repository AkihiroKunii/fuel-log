import { Sheet } from '../../app/Sheet';

export function EditSheet({ id, onClose }: { id: number | null; onClose: () => void }) {
  return (
    <Sheet open={id !== null} onClose={onClose} title="編集">
      <p className="hint">準備中</p>
    </Sheet>
  );
}
