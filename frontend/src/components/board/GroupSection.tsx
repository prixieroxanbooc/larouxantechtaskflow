import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, Plus, Trash2, Check, Minus } from 'lucide-react';
import { Group, Column, Item } from '@/types';
import { groupsApi, itemsApi } from '@/api/client';
import ItemRow from './ItemRow';
import ColumnHeader from './ColumnHeader';

interface Props {
  group: Group;
  columns: Column[];
  items: Item[];
  boardId: string;
}

export default function GroupSection({ group, columns, items, boardId }: Props) {
  const queryClient = useQueryClient();
  const [collapsed, setCollapsed] = useState(false);
  const [addingItem, setAddingItem] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [groupName, setGroupName] = useState(group.name);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['board', boardId] });

  const toggleSelect = (id: string) =>
    setSelectedIds((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });

  const toggleSelectAll = () =>
    setSelectedIds(selectedIds.size === items.length ? new Set() : new Set(items.map((i) => i.id)));

  const bulkDelete = useMutation({
    mutationFn: () => Promise.all([...selectedIds].map((id) => itemsApi.delete(boardId, id))),
    onSuccess: () => { invalidate(); setSelectedIds(new Set()); },
  });

  const createItem = useMutation({
    mutationFn: (name: string) => itemsApi.create(boardId, { name, group_id: group.id }),
    onSuccess: () => { invalidate(); setNewItemName(''); setAddingItem(false); },
  });

  const deleteGroup = useMutation({
    mutationFn: () => groupsApi.delete(boardId, group.id),
    onSuccess: invalidate,
  });

  const renameGroup = useMutation({
    mutationFn: (name: string) => groupsApi.update(boardId, group.id, { name }),
    onSuccess: invalidate,
  });

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
      {/* Group Header */}
      <div
        className="flex items-center gap-2 px-4 py-3 border-l-4"
        style={{ borderLeftColor: group.color }}
      >
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="text-gray-400 hover:text-gray-600 transition-colors shrink-0"
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
        </button>

        {editingName ? (
          <input
            autoFocus
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            onBlur={() => { renameGroup.mutate(groupName); setEditingName(false); }}
            onKeyDown={(e) => { if (e.key === 'Enter') { renameGroup.mutate(groupName); setEditingName(false); } if (e.key === 'Escape') setEditingName(false); }}
            className="font-semibold text-sm border-b border-brand-400 outline-none bg-transparent w-48"
          />
        ) : (
          <h3
            className="font-semibold text-sm text-gray-800 cursor-pointer hover:text-brand-600"
            onDoubleClick={() => setEditingName(true)}
          >
            {group.name}
          </h3>
        )}

        <span className="text-xs text-gray-400 ml-1 bg-gray-100 px-1.5 py-0.5 rounded-full">
          {items.length}
        </span>

        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() => deleteGroup.mutate()}
            className="p-1 text-gray-300 hover:text-red-400 rounded transition-colors"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Column Headers */}
      {!collapsed && (
        <>
          <div className="flex items-center border-b border-gray-100 bg-gray-50 px-4 py-1.5 text-xs font-medium text-gray-500">
            <button
              onClick={toggleSelectAll}
              className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 mr-2 transition-colors bg-white ${
                items.length > 0 && selectedIds.size === items.length
                  ? 'bg-brand-500 border-brand-500 text-white'
                  : 'border-gray-300 hover:border-brand-400'
              }`}
            >
              {items.length > 0 && selectedIds.size === items.length ? (
                <Check size={11} />
              ) : selectedIds.size > 0 ? (
                <Minus size={11} className="text-brand-500" />
              ) : null}
            </button>
            <div className="flex-1 min-w-0">Item</div>
            {columns.map((col) => (
              <ColumnHeader key={col.id} column={col} boardId={boardId} />
            ))}
            <div className="w-8" />
          </div>

          {/* Items */}
          <div className="divide-y divide-gray-50">
            {items.map((item) => (
              <ItemRow key={item.id} item={item} columns={columns} boardId={boardId} isSelected={selectedIds.has(item.id)} onSelect={toggleSelect} />
            ))}
          </div>

          {/* Bulk action bar */}
          {selectedIds.size > 0 && (
            <div className="px-4 py-2 bg-brand-50 border-t border-brand-100 flex items-center gap-3">
              <span className="text-sm text-brand-700 font-medium">{selectedIds.size} item{selectedIds.size > 1 ? 's' : ''} selected</span>
              <button
                onClick={() => bulkDelete.mutate()}
                disabled={bulkDelete.isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500 text-white text-sm rounded hover:bg-red-600 disabled:opacity-50 transition-colors"
              >
                <Trash2 size={13} /> Delete selected
              </button>
              <button onClick={() => setSelectedIds(new Set())} className="text-sm text-gray-500 hover:text-gray-700">
                Clear
              </button>
            </div>
          )}

          {/* Add Item */}
          <div className="px-4 py-2 border-t border-gray-50">
            {addingItem ? (
              <div className="flex items-center gap-2 pl-6">
                <input
                  autoFocus
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newItemName.trim()) createItem.mutate(newItemName.trim());
                    if (e.key === 'Escape') setAddingItem(false);
                  }}
                  placeholder="Item name…"
                  className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 flex-1 max-w-xs"
                />
                <button
                  onClick={() => newItemName.trim() && createItem.mutate(newItemName.trim())}
                  className="px-3 py-1.5 bg-brand-500 text-white text-sm rounded hover:bg-brand-600"
                >
                  Add
                </button>
                <button onClick={() => setAddingItem(false)} className="text-sm text-gray-400 hover:text-gray-600">Cancel</button>
              </div>
            ) : (
              <button
                onClick={() => setAddingItem(true)}
                className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-brand-600 pl-6 py-1 transition-colors"
              >
                <Plus size={14} /> Add item
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
