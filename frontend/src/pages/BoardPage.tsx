import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Table2, Kanban, Plus } from 'lucide-react';
import { boardsApi } from '@/api/client';
import { BoardDetail } from '@/types';
import BoardView from '@/components/board/BoardView';
import TableView from '@/components/board/TableView';

type ViewMode = 'board' | 'table';

export default function BoardPage() {
  const { id } = useParams<{ id: string }>();
  const [viewMode, setViewMode] = useState<ViewMode>('board');

  const { data: board, isLoading, error } = useQuery<BoardDetail>({
    queryKey: ['board', id],
    queryFn: () => boardsApi.get(id!),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="h-8 w-48 bg-gray-200 rounded animate-pulse mb-4" />
        <div className="h-4 w-96 bg-gray-100 rounded animate-pulse mb-8" />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !board) {
    return (
      <div className="p-6 text-center text-gray-500">
        <p>Board not found or you don't have access.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Board Header */}
      <div className="px-6 pt-5 pb-0 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl">{board.icon}</span>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{board.name}</h1>
            {board.description && <p className="text-sm text-gray-500">{board.description}</p>}
          </div>
        </div>

        {/* View Switcher */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setViewMode('board')}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
              viewMode === 'board'
                ? 'border-brand-500 text-brand-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Kanban size={15} /> Board
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
              viewMode === 'table'
                ? 'border-brand-500 text-brand-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Table2 size={15} /> Table
          </button>
          <button className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-400 hover:text-gray-600 border-b-2 border-transparent">
            <Plus size={15} /> Add View
          </button>
        </div>
      </div>

      {/* View Content */}
      <div className="flex-1 overflow-auto">
        {viewMode === 'board' && <BoardView board={board} />}
        {viewMode === 'table' && <TableView board={board} />}
      </div>
    </div>
  );
}
