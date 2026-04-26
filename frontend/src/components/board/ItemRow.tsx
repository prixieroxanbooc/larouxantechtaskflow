import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Trash2, MessageSquare } from 'lucide-react';
import { Item, Column } from '@/types';
import { itemsApi } from '@/api/client';
import ItemDetailModal from './ItemDetailModal';
import CellEditor from './CellEditor';

interface Props { item: Item; columns: Column[]; boardId: string; }

export default function ItemRow({ item, columns, boardId }: Props) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [itemName, setItemName] = useState(item.name);
  const [hover, setHover] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['board', boardId] });

  const updateName = useMutation({
    mutationFn: (name: string) => itemsApi.update(boardId, item.id, { name }),
    onSuccess: invalidate,
  });

  const deleteItem = useMutation({
    mutationFn: () => itemsApi.delete(boardId, item.id),
    onSuccess: invalidate,
  });

  return (
    <>
      <div
        className={`flex items-center px-4 py-2 text-sm transition-colors ${hover ? 'bg-gray-50' : 'bg-white'}`}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      >
        {/* Checkbox placeholder */}
        <div className="w-5 h-5 border border-gray-300 rounded shrink-0 mr-2" />

        {/* Item name */}
        <div className="flex-1 min-w-0 flex items-center gap-1.5">
          {editing ? (
            <input
              autoFocus
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              onBlur={() => { updateName.mutate(itemName); setEditing(false); }}
              onKeyDown={(e) => { if (e.key === 'Enter') { updateName.mutate(itemName); setEditing(false); } if (e.key === 'Escape') setEditing(false); }}
              className="text-sm border-b border-brand-400 outline-none bg-transparent w-full"
            />
          ) : (
            <span
              className="truncate cursor-pointer hover:text-brand-600"
              onDoubleClick={() => setEditing(true)}
            >
              {item.name}
            </span>
          )}
          {hover && !editing && (
            <button
              onClick={() => setDetailOpen(true)}
              className="shrink-0 text-gray-300 hover:text-brand-500 transition-colors"
            >
              <MessageSquare size={13} />
            </button>
          )}
        </div>

        {/* Column values */}
        {columns.map((col) => (
          <CellEditor
            key={col.id}
            column={col}
            value={item.values[col.id] ?? ''}
            onChange={(val) => itemsApi.setValue(boardId, item.id, { column_id: col.id, value: val }).then(invalidate)}
          />
        ))}

        {/* Delete */}
        <div className="w-8 flex justify-center">
          {hover && (
            <button
              onClick={() => deleteItem.mutate()}
              className="text-gray-300 hover:text-red-400 transition-colors"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      {detailOpen && (
        <ItemDetailModal item={item} columns={columns} boardId={boardId} onClose={() => setDetailOpen(false)} />
      )}
    </>
  );
}
