import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Copy, Check, KeyRound, AlertTriangle, Eye, EyeOff } from 'lucide-react';
import { api } from '@/api/client';
import { format, formatDistanceToNow } from 'date-fns';

interface ApiKey {
  id: string;
  key_prefix: string;
  name: string;
  last_used_at: string | null;
  created_at: string;
}

interface NewKeyResult extends ApiKey {
  key: string;
  _warning: string;
}

function CopyBtn({ text, size = 14 }: { text: string; size?: number }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="text-gray-400 hover:text-brand-500 transition-colors shrink-0"
    >
      {copied ? <Check size={size} /> : <Copy size={size} />}
    </button>
  );
}

function NewKeyModal({ result, onClose }: { result: NewKeyResult; onClose: () => void }) {
  const [show, setShow] = useState(false);
  const apiBase = import.meta.env.PROD ? window.location.origin : 'http://localhost:3001';

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        {/* Warning banner */}
        <div className="bg-amber-50 border-b border-amber-200 rounded-t-2xl px-6 py-4 flex gap-3">
          <AlertTriangle size={20} className="text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-amber-800">Save your API key now!</p>
            <p className="text-sm text-amber-700 mt-0.5">This is the only time it will be shown. It cannot be recovered.</p>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Your API Key</label>
            <div className="flex items-center gap-2 bg-gray-50 border-2 border-dashed border-brand-200 rounded-xl px-3 py-2.5">
              <code className="flex-1 text-sm font-mono text-brand-700 break-all">
                {show ? result.key : result.key.slice(0, 16) + '•'.repeat(32)}
              </code>
              <button onClick={() => setShow(!show)} className="text-gray-400 hover:text-gray-600 shrink-0">
                {show ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
              <CopyBtn text={result.key} />
            </div>
          </div>

          <div className="bg-gray-50 rounded-xl p-4 space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">How to use</p>
            <div>
              <p className="text-xs text-gray-500 mb-1">REST API — Authorization header:</p>
              <div className="bg-gray-900 rounded-lg px-3 py-2 flex items-center gap-2">
                <code className="text-xs font-mono text-green-400 flex-1 break-all">
                  Authorization: Bearer {show ? result.key : 'tf_live_…'}
                </code>
                <CopyBtn text={`Authorization: Bearer ${result.key}`} size={12} />
              </div>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Or as X-API-Key header:</p>
              <div className="bg-gray-900 rounded-lg px-3 py-2 flex items-center gap-2">
                <code className="text-xs font-mono text-green-400 flex-1 break-all">
                  X-API-Key: {show ? result.key : 'tf_live_…'}
                </code>
                <CopyBtn text={`X-API-Key: ${result.key}`} size={12} />
              </div>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">MCP SSE connection:</p>
              <div className="bg-gray-900 rounded-lg px-3 py-2 flex items-center gap-2">
                <code className="text-xs font-mono text-purple-400 flex-1 truncate">
                  {apiBase}/mcp/sse?token={show ? result.key : 'tf_live_…'}
                </code>
                <CopyBtn text={`${apiBase}/mcp/sse?token=${result.key}`} size={12} />
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 pb-6">
          <button onClick={onClose} className="w-full bg-brand-500 hover:bg-brand-600 text-white font-semibold py-2.5 rounded-lg transition-colors">
            I've saved my key — Close
          </button>
        </div>
      </div>
    </div>
  );
}

function CreateKeyModal({ onClose, onCreated }: { onClose: () => void; onCreated: (r: NewKeyResult) => void }) {
  const [name, setName] = useState('');
  const mutation = useMutation({
    mutationFn: () => api.post('/developer/keys', { name }).then((r) => r.data as NewKeyResult),
    onSuccess: onCreated,
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Create API Key</h2>
        <div className="mb-5">
          <label className="block text-sm font-medium text-gray-700 mb-1">Key Name *</label>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) mutation.mutate(); }}
            placeholder="e.g. My n8n Workflow, Personal Script"
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <p className="text-xs text-gray-400 mt-1">Give it a name so you remember what it's for.</p>
        </div>
        {mutation.isError && (
          <p className="text-red-600 text-sm mb-4">
            {(mutation.error as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed'}
          </p>
        )}
        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
          <button
            onClick={() => mutation.mutate()}
            disabled={!name.trim() || mutation.isPending}
            className="px-5 py-2 bg-brand-500 text-white text-sm font-medium rounded-lg hover:bg-brand-600 disabled:opacity-50"
          >
            {mutation.isPending ? 'Generating…' : 'Generate Key'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ApiKeysPage() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [newKey, setNewKey] = useState<NewKeyResult | null>(null);

  const { data: keys = [], isLoading } = useQuery<ApiKey[]>({
    queryKey: ['api-keys'],
    queryFn: () => api.get('/developer/keys').then((r) => r.data),
  });

  const revoke = useMutation({
    mutationFn: (id: string) => api.delete(`/developer/keys/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['api-keys'] }),
  });

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center justify-between mb-1">
        <div>
          <h1 className="text-xl font-bold text-gray-900">API Keys</h1>
          <p className="text-sm text-gray-500 mt-0.5">Personal keys for direct API and MCP access.</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          <Plus size={15} /> New Key
        </button>
      </div>

      {/* Auth formats */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mt-4 mb-6 text-xs text-gray-600 space-y-1.5">
        <p className="font-semibold text-gray-700 mb-2">Accepted auth formats:</p>
        <div className="font-mono space-y-1">
          <div><span className="text-gray-400">Header:  </span><span className="text-blue-700">Authorization: Bearer tf_live_…</span></div>
          <div><span className="text-gray-400">Header:  </span><span className="text-blue-700">X-API-Key: tf_live_…</span></div>
          <div><span className="text-gray-400">MCP URL: </span><span className="text-purple-700">/mcp/sse?token=tf_live_…</span></div>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : keys.length === 0 ? (
        <div className="text-center py-14 text-gray-400">
          <KeyRound size={36} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">No API keys yet</p>
          <button onClick={() => setShowCreate(true)} className="mt-2 text-brand-500 hover:underline text-sm">
            Generate your first key
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {keys.map((k) => (
            <div key={k.id} className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-4 py-3">
              <KeyRound size={16} className="text-brand-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800">{k.name}</p>
                <p className="text-xs font-mono text-gray-400 mt-0.5">{k.key_prefix}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs text-gray-400">{format(new Date(k.created_at), 'MMM d, yyyy')}</p>
                <p className="text-xs text-gray-300 mt-0.5">
                  {k.last_used_at
                    ? `Used ${formatDistanceToNow(new Date(k.last_used_at), { addSuffix: true })}`
                    : 'Never used'}
                </p>
              </div>
              <button
                onClick={() => revoke.mutate(k.id)}
                className="text-gray-300 hover:text-red-400 transition-colors p-1 ml-1"
                title="Revoke key"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <CreateKeyModal
          onClose={() => setShowCreate(false)}
          onCreated={(result) => {
            queryClient.invalidateQueries({ queryKey: ['api-keys'] });
            setShowCreate(false);
            setNewKey(result);
          }}
        />
      )}
      {newKey && <NewKeyModal result={newKey} onClose={() => setNewKey(null)} />}
    </div>
  );
}
