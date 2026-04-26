import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import { Column } from '@/types';
import { columnsApi } from '@/api/client';

const TYPE_ICONS: Record<string, string> = {
  text: '📝', status: '🔵', date: '📅', person: '👤',
  number: '🔢', checkbox: '☑️', url: '🔗', email: '✉️', phone: '📞',
};

export default function ColumnHeader({ column, boardId }: { column: Column; boardId: string }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(column.name);
  const [hover, setHover] = useState(false);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['board', boardId] });

  const rename = useMutation({
    mutationFn: (n: string) => columnsApi.update(boardId, column.id, { name: n }),
    onSuccess: invalidate,
  });

  const deleteCol = useMutation({
    mutationFn: () => columnsApi.delete(boardId, column.id),
    onSuccess: invalidate,
  });

  return (
    <div
      className="w-32 shrink-0 flex items-center justify-between gap-1 px-2 group relative"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <span className="text-xs mr-0.5">{TYPE_ICONS[column.type]}</span>
      {editing ? (
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => { rename.mutate(name); setEditing(false); }}
          onKeyDown={(e) => { if (e.key === 'Enter') { rename.mutate(name); setEditing(false); } if (e.key === 'Escape') setEditing(false); }}
          className="text-xs w-full border-b border-brand-400 outline-none bg-transparent font-medium"
        />
      ) : (
        <span className="text-xs truncate cursor-pointer hover:text-brand-600" onDoubleClick={() => setEditing(true)}>
          {column.name}
        </span>
      )}
      {hover && !editing && (
        <button
          onClick={(e) => { e.stopPropagation(); deleteCol.mutate(); }}
          className="absolute right-0 top-1/2 -translate-y-1/2 p-0.5 text-gray-300 hover:text-red-400 transition-colors"
        >
          <Trash2 size={11} />
        </button>
      )}
    </div>
  );
}
