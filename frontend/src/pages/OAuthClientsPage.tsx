import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Copy, Check, KeyRound, AlertTriangle, Eye, EyeOff, ExternalLink } from 'lucide-react';
import { api } from '@/api/client';
import { format } from 'date-fns';

interface OAuthClient {
  id: string;
  client_id: string;
  name: string;
  description: string;
  created_at: string;
}

interface NewClientResult extends OAuthClient {
  client_secret: string;
  _warning: string;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={copy} className="ml-1 text-gray-400 hover:text-brand-500 transition-colors shrink-0">
      {copied ? <Check size={13} /> : <Copy size={13} />}
    </button>
  );
}

function SecretDisplay({ secret }: { secret: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="flex items-center gap-1 font-mono text-xs bg-gray-100 rounded px-2 py-1 min-w-0">
      <span className="truncate">{show ? secret : '•'.repeat(32)}</span>
      <button onClick={() => setShow(!show)} className="text-gray-400 hover:text-gray-600 shrink-0 ml-1">
        {show ? <EyeOff size={12} /> : <Eye size={12} />}
      </button>
      <CopyButton text={secret} />
    </div>
  );
}

function NewClientModal({ result, onClose }: { result: NewClientResult; onClose: () => void }) {
  const apiBase = import.meta.env.PROD ? window.location.origin : 'http://localhost:3001';
  const mcp_url = `${apiBase}/mcp/sse`;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="bg-amber-50 border-b border-amber-200 rounded-t-2xl px-6 py-4 flex items-start gap-3">
          <AlertTriangle size={20} className="text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-amber-800">Save your Client Secret now!</p>
            <p className="text-sm text-amber-700 mt-0.5">
              This is the only time it will be shown. It cannot be recovered.
            </p>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
              Client Name
            </label>
            <p className="text-sm font-medium text-gray-800">{result.name}</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
              Client ID
            </label>
            <div className="flex items-center gap-1 font-mono text-xs bg-gray-100 rounded px-2 py-1.5">
              <span className="flex-1 truncate">{result.client_id}</span>
              <CopyButton text={result.client_id} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
              Client Secret
            </label>
            <SecretDisplay secret={result.client_secret} />
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
              How to connect via MCP
            </p>

            <div>
              <p className="text-xs text-gray-500 mb-1">Step 1 — Get access token:</p>
              <div className="bg-gray-900 rounded-lg p-3 text-xs font-mono text-gray-200 overflow-x-auto relative">
                <CopyButton text={`curl -X POST ${apiBase}/oauth/token \\\n  -H "Content-Type: application/x-www-form-urlencoded" \\\n  -d "grant_type=client_credentials&client_id=${result.client_id}&client_secret=${result.client_secret}"`} />
                <pre className="pr-5">{`curl -X POST ${apiBase}/oauth/token \\
  -H "Content-Type: application/x-www-form-urlencoded" \\
  -d "grant_type=client_credentials&client_id=${result.client_id}&client_secret=YOUR_SECRET"`}</pre>
              </div>
            </div>

            <div>
              <p className="text-xs text-gray-500 mb-1">Step 2 — Connect to MCP SSE:</p>
              <div className="flex items-center gap-1 bg-gray-900 rounded-lg px-3 py-2">
                <code className="text-xs text-green-400 font-mono flex-1 truncate">{mcp_url}</code>
                <CopyButton text={mcp_url} />
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Pass the access_token as: <code className="bg-gray-100 px-1 rounded">Authorization: Bearer &lt;token&gt;</code>
              </p>
            </div>
          </div>
        </div>

        <div className="px-6 pb-6">
          <button
            onClick={onClose}
            className="w-full bg-brand-500 hover:bg-brand-600 text-white font-semibold py-2.5 rounded-lg transition-colors"
          >
            I've saved the secret — Close
          </button>
        </div>
      </div>
    </div>
  );
}

function CreateClientModal({ onClose, onCreated }: { onClose: () => void; onCreated: (r: NewClientResult) => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      api.post('/oauth/clients', { name, description }).then((r) => r.data as NewClientResult),
    onSuccess: (data) => onCreated(data),
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Create OAuth Client</h2>

        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Client Name *</label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Onyx Integration, n8n Automation"
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What will this client be used for?"
              rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
            />
          </div>
        </div>

        {mutation.isError && (
          <p className="text-red-600 text-sm mb-4">
            {(mutation.error as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to create client'}
          </p>
        )}

        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
            Cancel
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={!name.trim() || mutation.isPending}
            className="px-5 py-2 bg-brand-500 text-white text-sm font-medium rounded-lg hover:bg-brand-600 disabled:opacity-50"
          >
            {mutation.isPending ? 'Creating…' : 'Create Client'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function OAuthClientsPage() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [newClientResult, setNewClientResult] = useState<NewClientResult | null>(null);

  const { data: clients = [], isLoading } = useQuery<OAuthClient[]>({
    queryKey: ['oauth-clients'],
    queryFn: () => api.get('/oauth/clients').then((r) => r.data),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/oauth/clients/${id}`).then((r) => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['oauth-clients'] }),
  });

  const apiBase = import.meta.env.PROD ? window.location.origin : 'http://localhost:3001';

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">OAuth Clients</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Create Client ID &amp; Secret pairs to connect MCP clients like Onyx, n8n, or any automation tool.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors shrink-0"
        >
          <Plus size={16} /> New Client
        </button>
      </div>

      {/* MCP SSE URL Banner */}
      <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 mb-6 mt-4">
        <p className="text-xs font-semibold text-purple-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <KeyRound size={13} /> MCP SSE Endpoint
        </p>
        <div className="flex items-center gap-2">
          <code className="flex-1 text-sm font-mono text-purple-800 bg-white border border-purple-100 rounded-lg px-3 py-2 truncate">
            {apiBase}/mcp/sse
          </code>
          <CopyButton text={`${apiBase}/mcp/sse`} />
          <a
            href={`${apiBase}/mcp`}
            target="_blank"
            rel="noreferrer"
            className="text-purple-400 hover:text-purple-600 transition-colors"
            title="View MCP info"
          >
            <ExternalLink size={15} />
          </a>
        </div>
        <p className="text-xs text-purple-500 mt-2">
          Pass the <strong>access_token</strong> (from POST /oauth/token) as{' '}
          <code className="bg-white px-1 rounded">Authorization: Bearer &lt;token&gt;</code>
        </p>
      </div>

      {/* OAuth Flow Summary */}
      <div className="grid grid-cols-3 gap-3 mb-6 text-center text-xs text-gray-600">
        {[
          { step: '1', label: 'Create Client', desc: 'Get Client ID + Secret below' },
          { step: '2', label: 'Get Token', desc: `POST ${apiBase}/oauth/token` },
          { step: '3', label: 'Connect MCP', desc: `${apiBase}/mcp/sse` },
        ].map(({ step, label, desc }) => (
          <div key={step} className="bg-gray-50 border border-gray-200 rounded-xl p-3">
            <div className="w-6 h-6 rounded-full bg-brand-500 text-white text-xs font-bold flex items-center justify-center mx-auto mb-2">
              {step}
            </div>
            <p className="font-semibold text-gray-700">{label}</p>
            <p className="text-gray-400 mt-0.5 truncate" title={desc}>{desc}</p>
          </div>
        ))}
      </div>

      {/* Clients List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : clients.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <KeyRound size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">No OAuth clients yet</p>
          <button onClick={() => setShowCreate(true)} className="mt-2 text-brand-500 hover:underline text-sm">
            Create your first client
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {clients.map((client) => (
            <div key={client.id} className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <KeyRound size={15} className="text-brand-500 shrink-0" />
                    <span className="font-semibold text-gray-800">{client.name}</span>
                  </div>
                  {client.description && (
                    <p className="text-sm text-gray-500 mb-2">{client.description}</p>
                  )}
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-gray-400">Client ID:</span>
                    <code className="text-xs font-mono text-gray-700 bg-gray-100 px-2 py-0.5 rounded">
                      {client.client_id}
                    </code>
                    <CopyButton text={client.client_id} />
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs text-gray-400">
                    {format(new Date(client.created_at), 'MMM d, yyyy')}
                  </span>
                  <button
                    onClick={() => deleteMutation.mutate(client.id)}
                    className="text-gray-300 hover:text-red-400 transition-colors p-1"
                    title="Delete client"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <CreateClientModal
          onClose={() => setShowCreate(false)}
          onCreated={(result) => {
            queryClient.invalidateQueries({ queryKey: ['oauth-clients'] });
            setShowCreate(false);
            setNewClientResult(result);
          }}
        />
      )}

      {newClientResult && (
        <NewClientModal
          result={newClientResult}
          onClose={() => setNewClientResult(null)}
        />
      )}
    </div>
  );
}
