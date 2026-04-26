import { useState, FormEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Send } from 'lucide-react';
import { Item, Column, Comment } from '@/types';
import { itemsApi } from '@/api/client';
import { format } from 'date-fns';

interface Props { item: Item; columns: Column[]; boardId: string; onClose: () => void; }

export default function ItemDetailModal({ item, columns, boardId, onClose }: Props) {
  const queryClient = useQueryClient();
  const [comment, setComment] = useState('');

  const { data: comments = [] } = useQuery<Comment[]>({
    queryKey: ['comments', item.id],
    queryFn: () => itemsApi.comments(boardId, item.id),
  });

  const addComment = useMutation({
    mutationFn: (text: string) => itemsApi.addComment(boardId, item.id, text),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['comments', item.id] }); setComment(''); },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (comment.trim()) addComment.mutate(comment.trim());
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900 pr-4">{item.name}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 shrink-0">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Column values */}
          {columns.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Details</h3>
              <div className="space-y-2">
                {columns.map((col) => (
                  <div key={col.id} className="flex items-center gap-4">
                    <span className="text-sm text-gray-500 w-24 shrink-0">{col.name}</span>
                    <span className="text-sm text-gray-800">{item.values[col.id] || <span className="text-gray-300 italic">Empty</span>}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Metadata */}
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Info</h3>
            <div className="text-sm text-gray-500 space-y-1">
              <p>Created: {format(new Date(item.created_at), 'MMM d, yyyy HH:mm')}</p>
              <p>Updated: {format(new Date(item.updated_at), 'MMM d, yyyy HH:mm')}</p>
            </div>
          </div>

          {/* Comments */}
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Comments ({comments.length})
            </h3>
            <div className="space-y-3">
              {comments.map((c) => (
                <div key={c.id} className="flex gap-3">
                  <div className="w-7 h-7 rounded-full bg-brand-500 flex items-center justify-center text-white text-xs font-semibold shrink-0">
                    {c.user_name?.[0]?.toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-medium text-gray-800">{c.user_name}</span>
                      <span className="text-xs text-gray-400">{format(new Date(c.created_at), 'MMM d, HH:mm')}</span>
                    </div>
                    <p className="text-sm text-gray-600 mt-0.5">{c.text}</p>
                  </div>
                </div>
              ))}
              {comments.length === 0 && <p className="text-sm text-gray-400 italic">No comments yet.</p>}
            </div>
          </div>
        </div>

        {/* Comment Input */}
        <form onSubmit={submit} className="p-4 border-t border-gray-100 flex gap-3">
          <input
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Write a comment…"
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <button
            type="submit"
            disabled={!comment.trim() || addComment.isPending}
            className="px-3 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 disabled:opacity-50 transition-colors"
          >
            <Send size={15} />
          </button>
        </form>
      </div>
    </div>
  );
}
