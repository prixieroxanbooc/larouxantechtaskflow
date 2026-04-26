import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Plus, Layout, Trash2, Search } from 'lucide-react';
import { boardsApi } from '@/api/client';
import { Board } from '@/types';
import { useAuthStore } from '@/store/authStore';

const BOARD_COLORS = ['#0073ea', '#037f4c', '#e2445c', '#fdab3d', '#a25ddc', '#579bfc', '#ff7575', '#00c875'];
const BOARD_ICONS = ['📋', '🚀', '💡', '🎯', '📊', '🛠️', '🎨', '📱'];

function CreateBoardModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(BOARD_COLORS[0]);
  const [icon, setIcon] = useState(BOARD_ICONS[0]);

  const mutation = useMutation({
    mutationFn: boardsApi.create,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['boards'] }); onClose(); },
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <h2 className="text-lg font-semibold mb-4">Create New Board</h2>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Board Name</label>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            placeholder="e.g. Marketing Q2"
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
            rows={2}
            placeholder="Optional description"
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Color</label>
          <div className="flex gap-2 flex-wrap">
            {BOARD_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`w-7 h-7 rounded-full transition-transform ${color === c ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : ''}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Icon</label>
          <div className="flex gap-2 flex-wrap">
            {BOARD_ICONS.map((ic) => (
              <button
                key={ic}
                onClick={() => setIcon(ic)}
                className={`w-9 h-9 text-lg rounded-lg border-2 transition-colors ${icon === ic ? 'border-brand-500 bg-brand-50' : 'border-gray-200 hover:border-gray-300'}`}
              >
                {ic}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
          <button
            onClick={() => mutation.mutate({ name, description, color, icon })}
            disabled={!name.trim() || mutation.isPending}
            className="px-5 py-2 bg-brand-500 text-white text-sm font-medium rounded-lg hover:bg-brand-600 disabled:opacity-50"
          >
            {mutation.isPending ? 'Creating…' : 'Create Board'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState('');

  const { data: boards = [], isLoading } = useQuery<Board[]>({
    queryKey: ['boards'],
    queryFn: boardsApi.list,
  });

  const deleteMutation = useMutation({
    mutationFn: boardsApi.delete,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['boards'] }),
  });

  const filtered = boards.filter((b) => b.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Workspace</h1>
          <p className="text-gray-500 text-sm mt-0.5">Welcome back, {user?.name}</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          <Plus size={16} /> New Board
        </button>
      </div>

      <div className="relative mb-6 max-w-xs">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search boards…"
          className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-36 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <Layout size={48} className="mx-auto mb-4 opacity-30" />
          <p className="font-medium">{boards.length === 0 ? 'No boards yet' : 'No boards match your search'}</p>
          {boards.length === 0 && (
            <button onClick={() => setShowCreate(true)} className="mt-3 text-brand-500 hover:underline text-sm">
              Create your first board
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((board) => (
            <div
              key={board.id}
              onClick={() => navigate(`/board/${board.id}`)}
              className="group relative bg-white border border-gray-200 rounded-xl p-5 cursor-pointer hover:shadow-md hover:border-gray-300 transition-all"
            >
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center text-xl mb-3"
                style={{ backgroundColor: board.color + '22' }}
              >
                {board.icon}
              </div>
              <div
                className="absolute top-0 left-0 w-full h-1 rounded-t-xl"
                style={{ backgroundColor: board.color }}
              />
              <h3 className="font-semibold text-gray-900 truncate">{board.name}</h3>
              {board.description && (
                <p className="text-gray-500 text-sm mt-1 line-clamp-2">{board.description}</p>
              )}
              <p className="text-xs text-gray-400 mt-3">
                {new Date(board.created_at).toLocaleDateString()}
              </p>

              {board.owner_id === user?.id && (
                <button
                  onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(board.id); }}
                  className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-all"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {showCreate && <CreateBoardModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}
