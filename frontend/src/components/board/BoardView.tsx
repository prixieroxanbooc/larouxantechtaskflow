import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { groupsApi } from '@/api/client';
import { BoardDetail, Group, Item, Column } from '@/types';
import GroupSection from './GroupSection';

interface Props { board: BoardDetail; }

export default function BoardView({ board }: Props) {
  const queryClient = useQueryClient();
  const [newGroupName, setNewGroupName] = useState('');
  const [addingGroup, setAddingGroup] = useState(false);

  const createGroup = useMutation({
    mutationFn: (name: string) => groupsApi.create(board.id, { name }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['board', board.id] }); setNewGroupName(''); setAddingGroup(false); },
  });

  const itemsByGroup = (groupId: string): Item[] =>
    board.items.filter((i) => i.group_id === groupId).sort((a, b) => a.position - b.position);

  const sortedGroups: Group[] = [...board.groups].sort((a, b) => a.position - b.position);

  return (
    <div className="p-6 space-y-4">
      {sortedGroups.map((group) => (
        <GroupSection
          key={group.id}
          group={group}
          columns={board.columns as Column[]}
          items={itemsByGroup(group.id)}
          boardId={board.id}
        />
      ))}

      {/* Add Group */}
      {addingGroup ? (
        <div className="flex items-center gap-2 pt-2">
          <input
            autoFocus
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newGroupName.trim()) createGroup.mutate(newGroupName.trim());
              if (e.key === 'Escape') setAddingGroup(false);
            }}
            placeholder="Group name…"
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 w-56"
          />
          <button
            onClick={() => newGroupName.trim() && createGroup.mutate(newGroupName.trim())}
            className="px-4 py-2 bg-brand-500 text-white text-sm rounded-lg hover:bg-brand-600"
          >
            Add
          </button>
          <button onClick={() => setAddingGroup(false)} className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700">
            Cancel
          </button>
        </div>
      ) : (
        <button
          onClick={() => setAddingGroup(true)}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-brand-600 py-2 transition-colors"
        >
          <Plus size={16} /> Add Group
        </button>
      )}
    </div>
  );
}
