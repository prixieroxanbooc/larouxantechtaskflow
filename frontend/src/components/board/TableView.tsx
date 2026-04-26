import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { BoardDetail, Item, Column } from '@/types';
import { itemsApi, columnsApi } from '@/api/client';
import CellEditor from './CellEditor';

const COLUMN_TYPES = ['text', 'status', 'date', 'person', 'number', 'checkbox', 'url', 'email', 'phone'] as const;

interface Props { board: BoardDetail; }

export default function TableView({ board }: Props) {
  const queryClient = useQueryClient();
  const [showAddCol, setShowAddCol] = useState(false);
  const [newColName, setNewColName] = useState('');
  const [newColType, setNewColType] = useState<string>('text');

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['board', board.id] });

  const addColumn = useMutation({
    mutationFn: () => columnsApi.create(board.id, { name: newColName, type: newColType }),
    onSuccess: () => { invalidate(); setNewColName(''); setShowAddCol(false); },
  });

  const addItem = useMutation({
    mutationFn: ({ name, groupId }: { name: string; groupId: string }) =>
      itemsApi.create(board.id, { name, group_id: groupId }),
    onSuccess: invalidate,
  });

  const deleteItem = useMutation({
    mutationFn: (itemId: string) => itemsApi.delete(board.id, itemId),
    onSuccess: invalidate,
  });

  const allItems: Item[] = [...board.items].sort((a, b) => {
    if (a.group_id !== b.group_id) return a.group_id.localeCompare(b.group_id);
    return a.position - b.position;
  });

  const groupOf = (groupId: string) => board.groups.find((g) => g.id === groupId);

  return (
    <div className="p-6">
      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-3 font-medium text-gray-500 w-8">#</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 min-w-[200px]">Item</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 w-28">Group</th>
              {board.columns.map((col) => (
                <th key={col.id} className="text-left px-4 py-3 font-medium text-gray-500 w-32 whitespace-nowrap">
                  {col.name}
                </th>
              ))}
              <th className="px-2 py-3 w-10">
                <button
                  onClick={() => setShowAddCol(true)}
                  className="text-gray-400 hover:text-brand-500 transition-colors"
                  title="Add column"
                >
                  <Plus size={16} />
                </button>
              </th>
            </tr>
            {showAddCol && (
              <tr className="bg-blue-50 border-b border-blue-100">
                <td colSpan={3 + board.columns.length + 1} className="px-4 py-2">
                  <div className="flex items-center gap-2">
                    <input
                      autoFocus
                      value={newColName}
                      onChange={(e) => setNewColName(e.target.value)}
                      placeholder="Column name"
                      className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 w-40"
                    />
                    <select
                      value={newColType}
                      onChange={(e) => setNewColType(e.target.value)}
                      className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none"
                    >
                      {COLUMN_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <button
                      onClick={() => addColumn.mutate()}
                      disabled={!newColName.trim()}
                      className="px-3 py-1 bg-brand-500 text-white text-sm rounded hover:bg-brand-600 disabled:opacity-50"
                    >
                      Add
                    </button>
                    <button onClick={() => setShowAddCol(false)} className="text-sm text-gray-400 hover:text-gray-600">Cancel</button>
                  </div>
                </td>
              </tr>
            )}
          </thead>
          <tbody className="divide-y divide-gray-50">
            {allItems.map((item, idx) => (
              <TableRow
                key={item.id}
                item={item}
                index={idx + 1}
                columns={board.columns as Column[]}
                groupName={groupOf(item.group_id)?.name ?? '—'}
                groupColor={groupOf(item.group_id)?.color ?? '#ccc'}
                onDelete={() => deleteItem.mutate(item.id)}
                onValueChange={(colId, val) => itemsApi.setValue(board.id, item.id, { column_id: colId, value: val }).then(invalidate)}
              />
            ))}
          </tbody>
        </table>

        {/* Add item row per group */}
        {board.groups.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-100 flex flex-wrap gap-2">
            {board.groups.map((g) => (
              <button
                key={g.id}
                onClick={() => {
                  const name = prompt(`New item in "${g.name}":`);
                  if (name?.trim()) addItem.mutate({ name: name.trim(), groupId: g.id });
                }}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-brand-600 transition-colors"
              >
                <Plus size={12} />
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: g.color }}
                />
                {g.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TableRow({
  item, index, columns, groupName, groupColor, onDelete, onValueChange,
}: {
  item: Item; index: number; columns: Column[]; groupName: string; groupColor: string;
  onDelete: () => void; onValueChange: (colId: string, val: string) => void;
}) {
  const [hover, setHover] = useState(false);

  return (
    <tr
      className={`transition-colors ${hover ? 'bg-gray-50' : 'bg-white'}`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <td className="px-4 py-2 text-gray-300 text-xs">{index}</td>
      <td className="px-4 py-2 font-medium text-gray-800">{item.name}</td>
      <td className="px-4 py-2">
        <span
          className="text-xs px-2 py-0.5 rounded-full font-medium"
          style={{ backgroundColor: groupColor + '22', color: groupColor }}
        >
          {groupName}
        </span>
      </td>
      {columns.map((col) => (
        <td key={col.id} className="px-2 py-1.5">
          <CellEditor
            column={col}
            value={item.values[col.id] ?? ''}
            onChange={(val) => onValueChange(col.id, val)}
          />
        </td>
      ))}
      <td className="px-2 py-2 text-center">
        {hover && (
          <button onClick={onDelete} className="text-gray-300 hover:text-red-400 transition-colors">
            <Trash2 size={13} />
          </button>
        )}
      </td>
    </tr>
  );
}
