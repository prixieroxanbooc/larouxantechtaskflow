import { useState } from 'react';
import { Code2, Zap, Globe, Terminal, ChevronDown, ChevronRight, Copy, Check } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Field {
  key: string;
  label: string;
  in: 'path' | 'body' | 'query';
  type?: 'text' | 'email' | 'password' | 'number' | 'select';
  required?: boolean;
  placeholder?: string;
  hint?: string;
  options?: string[];
}

interface RespEx {
  status: number;
  label: string;
  body: unknown;
}

interface EP {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  description: string;
  noAuth?: boolean;
  fields?: Field[];
  responses?: RespEx[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function CopyBtn({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 2000); }}
      className="text-gray-400 hover:text-white transition-colors"
    >
      {done ? <Check size={14} /> : <Copy size={14} />}
    </button>
  );
}

function CodeSnip({ code, lang = 'bash' }: { code: string; lang?: string }) {
  const [done, setDone] = useState(false);
  return (
    <div className="bg-gray-900 rounded-xl overflow-hidden my-3">
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-700">
        <span className="text-xs text-gray-400 font-mono">{lang}</span>
        <button
          onClick={() => { navigator.clipboard.writeText(code); setDone(true); setTimeout(() => setDone(false), 2000); }}
          className="text-gray-400 hover:text-white transition-colors"
        >
          {done ? <Check size={14} /> : <Copy size={14} />}
        </button>
      </div>
      <pre className="p-4 text-sm text-gray-100 overflow-x-auto font-mono leading-relaxed">{code}</pre>
    </div>
  );
}

const METHOD_CLR: Record<string, string> = {
  GET: 'bg-blue-100 text-blue-700',
  POST: 'bg-green-100 text-green-700',
  PUT: 'bg-yellow-100 text-yellow-700',
  DELETE: 'bg-red-100 text-red-700',
};

function StatusBadge({ n }: { n: number }) {
  const c = n < 300 ? 'bg-green-100 text-green-700' : n < 500 ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700';
  return <span className={`text-xs font-bold font-mono px-2 py-0.5 rounded ${c}`}>{n}</span>;
}

// ─── EndpointCard ─────────────────────────────────────────────────────────────

function EndpointCard({ ep, base }: { ep: EP; base: string }) {
  const [open, setOpen] = useState(false);
  const [vals, setVals] = useState<Record<string, string>>({});
  const [openR, setOpenR] = useState<Record<number, boolean>>({});

  const set = (k: string, v: string) => setVals(p => ({ ...p, [k]: v }));
  const pathFs = ep.fields?.filter(f => f.in === 'path') ?? [];
  const bodyFs = ep.fields?.filter(f => f.in === 'body') ?? [];
  const queryFs = ep.fields?.filter(f => f.in === 'query') ?? [];

  let resolvedPath = ep.path;
  pathFs.forEach(f => { resolvedPath = resolvedPath.replace(`:${f.key}`, vals[f.key] || `:${f.key}`); });
  const qs = queryFs.filter(f => vals[f.key]).map(f => `${f.key}=${encodeURIComponent(vals[f.key])}`);
  const url = `${base}${resolvedPath}${qs.length ? '?' + qs.join('&') : ''}`;

  const bodyObj: Record<string, unknown> = {};
  bodyFs.forEach(f => {
    if (vals[f.key]) bodyObj[f.key] = f.type === 'number' ? Number(vals[f.key]) : vals[f.key];
    else if (f.required) bodyObj[f.key] = f.placeholder ? `<${f.placeholder}>` : `<${f.label}>`;
  });
  const needsBody = ['POST', 'PUT'].includes(ep.method);

  const curlLines = [`curl -X ${ep.method} '${url}'`];
  if (!ep.noAuth) curlLines.push(`  -H 'Authorization: Bearer YOUR_TOKEN'`);
  if (needsBody) {
    curlLines.push(`  -H 'Content-Type: application/json'`);
    curlLines.push(`  -d '${JSON.stringify(Object.keys(bodyObj).length ? bodyObj : {}, null, 2)}'`);
  }
  const curl = curlLines.join(' \\\n');

  const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500';

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden mb-3">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
      >
        <span className={`text-xs font-bold px-2 py-0.5 rounded font-mono shrink-0 ${METHOD_CLR[ep.method]}`}>{ep.method}</span>
        <code className="text-sm font-mono text-gray-800 shrink-0">{ep.path}</code>
        <span className="text-sm text-gray-500 flex-1 min-w-0 truncate">{ep.description}</span>
        {open ? <ChevronDown size={16} className="text-gray-400 shrink-0" /> : <ChevronRight size={16} className="text-gray-400 shrink-0" />}
      </button>

      {open && (
        <div className="p-5 border-t border-gray-100">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* ── Left: Fields ── */}
            <div className="space-y-5">
              {pathFs.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Path Parameters</p>
                  <div className="space-y-3">
                    {pathFs.map(f => (
                      <div key={f.key}>
                        <label className="flex flex-wrap items-center gap-1.5 text-xs font-medium text-gray-700 mb-1">
                          <code className="font-mono text-gray-900">{f.key}</code>
                          <span className="bg-violet-100 text-violet-600 text-[10px] px-1.5 py-0.5 rounded">path</span>
                          <span className="bg-red-100 text-red-500 text-[10px] px-1.5 py-0.5 rounded">required</span>
                        </label>
                        <input
                          value={vals[f.key] || ''}
                          onChange={e => set(f.key, e.target.value)}
                          placeholder={f.placeholder || `Enter ${f.label.toLowerCase()}…`}
                          className={inputCls + ' font-mono'}
                        />
                        {f.hint && <p className="text-[11px] text-gray-400 mt-0.5">{f.hint}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {queryFs.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Query Parameters</p>
                  <div className="space-y-3">
                    {queryFs.map(f => (
                      <div key={f.key}>
                        <label className="flex flex-wrap items-center gap-1.5 text-xs font-medium text-gray-700 mb-1">
                          <code className="font-mono text-gray-900">{f.key}</code>
                          <span className="bg-sky-100 text-sky-600 text-[10px] px-1.5 py-0.5 rounded">query</span>
                          {f.required
                            ? <span className="bg-red-100 text-red-500 text-[10px] px-1.5 py-0.5 rounded">required</span>
                            : <span className="text-gray-400 text-[10px]">optional</span>}
                        </label>
                        <input
                          value={vals[f.key] || ''}
                          onChange={e => set(f.key, e.target.value)}
                          placeholder={f.placeholder || `Enter ${f.label.toLowerCase()}…`}
                          className={inputCls}
                        />
                        {f.hint && <p className="text-[11px] text-gray-400 mt-0.5">{f.hint}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {bodyFs.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Request Body</p>
                  <div className="space-y-3">
                    {bodyFs.map(f => (
                      <div key={f.key}>
                        <label className="flex flex-wrap items-center gap-1.5 text-xs font-medium text-gray-700 mb-1">
                          <code className="font-mono text-gray-900">{f.key}</code>
                          {f.required
                            ? <span className="bg-red-100 text-red-500 text-[10px] px-1.5 py-0.5 rounded">required</span>
                            : <span className="bg-gray-100 text-gray-400 text-[10px] px-1.5 py-0.5 rounded">optional</span>}
                          {f.hint && <span className="text-gray-400 text-[10px]">— {f.hint}</span>}
                        </label>
                        {f.type === 'select' ? (
                          <select value={vals[f.key] || ''} onChange={e => set(f.key, e.target.value)} className={inputCls}>
                            <option value="">Select {f.label}…</option>
                            {f.options?.map(o => <option key={o} value={o}>{o}</option>)}
                          </select>
                        ) : (
                          <input
                            type={f.type === 'password' ? 'password' : 'text'}
                            value={vals[f.key] || ''}
                            onChange={e => set(f.key, e.target.value)}
                            placeholder={f.placeholder || `Enter ${f.label.toLowerCase()}…`}
                            className={inputCls}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(!ep.fields || ep.fields.length === 0) && (
                <p className="text-sm text-gray-400 italic py-2">No parameters needed. Send with your auth token.</p>
              )}
            </div>

            {/* ── Right: cURL + Responses ── */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">cURL Preview</p>
              <div className="bg-gray-900 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2 border-b border-gray-700">
                  <span className="text-xs text-gray-400 font-mono">bash</span>
                  <CopyBtn text={curl} />
                </div>
                <pre className="p-4 text-xs text-gray-100 overflow-x-auto font-mono leading-relaxed whitespace-pre">{curl}</pre>
              </div>

              {ep.responses && ep.responses.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Response Examples</p>
                  <div className="space-y-1.5">
                    {ep.responses.map(r => (
                      <div key={r.status} className="border border-gray-200 rounded-lg overflow-hidden">
                        <button
                          onClick={() => setOpenR(p => ({ ...p, [r.status]: !p[r.status] }))}
                          className="w-full flex items-center gap-2 px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors"
                        >
                          <StatusBadge n={r.status} />
                          <span className="text-xs text-gray-600 flex-1 text-left">{r.label}</span>
                          {openR[r.status] ? <ChevronDown size={13} className="text-gray-400" /> : <ChevronRight size={13} className="text-gray-400" />}
                        </button>
                        {openR[r.status] && (
                          <pre className="bg-gray-900 text-xs text-gray-100 font-mono p-3 overflow-x-auto">
                            {JSON.stringify(r.body, null, 2)}
                          </pre>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SectionGroup({ emoji, title, subtitle, children }: { emoji: string; title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-4 pb-2 border-b border-gray-100">
        <span className="text-2xl">{emoji}</span>
        <div>
          <h2 className="text-base font-bold text-gray-900">{title}</h2>
          {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

// ─── Endpoint Data ────────────────────────────────────────────────────────────

const AUTH_EPS: EP[] = [
  {
    method: 'POST', path: '/api/auth/register', description: 'Create a new account', noAuth: true,
    fields: [
      { key: 'name', label: 'Name', in: 'body', required: true, placeholder: 'Juan Cruz' },
      { key: 'email', label: 'Email', in: 'body', type: 'email', required: true, placeholder: 'juan@example.com' },
      { key: 'password', label: 'Password', in: 'body', type: 'password', required: true, placeholder: 'min 6 characters' },
    ],
    responses: [
      { status: 201, label: 'Account created', body: { token: 'eyJhbGciOiJIUzI1NiJ9...', user: { id: 'user-uuid', name: 'Juan Cruz', email: 'juan@example.com' } } },
      { status: 400, label: 'Email already in use', body: { error: 'Email already in use' } },
      { status: 400, label: 'Validation error', body: { error: { fieldErrors: { name: ['Required'], email: ['Invalid email'], password: ['Must be at least 6 characters'] } } } },
    ],
  },
  {
    method: 'POST', path: '/api/auth/login', description: 'Login and get a JWT token', noAuth: true,
    fields: [
      { key: 'email', label: 'Email', in: 'body', type: 'email', required: true, placeholder: 'juan@example.com' },
      { key: 'password', label: 'Password', in: 'body', type: 'password', required: true, placeholder: 'your password' },
    ],
    responses: [
      { status: 200, label: 'Login successful', body: { token: 'eyJhbGciOiJIUzI1NiJ9...', user: { id: 'user-uuid', name: 'Juan Cruz', email: 'juan@example.com' } } },
      { status: 401, label: 'Invalid credentials', body: { error: 'Invalid email or password' } },
    ],
  },
  {
    method: 'GET', path: '/api/auth/me', description: 'Get current authenticated user info',
    responses: [
      { status: 200, label: 'Success', body: { id: 'user-uuid', name: 'Juan Cruz', email: 'juan@example.com', created_at: '2025-01-15T10:00:00Z' } },
      { status: 401, label: 'Unauthorized', body: { error: 'No token or API key provided' } },
    ],
  },
];

const BOARD_EPS: EP[] = [
  {
    method: 'GET', path: '/api/boards', description: 'List all boards for the current user',
    responses: [
      { status: 200, label: 'Success', body: [{ id: 'board-uuid', name: 'Marketing Q2', description: 'Campaign planning', color: '#0073ea', icon: '🎯', created_at: '2025-01-15T10:00:00Z' }] },
      { status: 401, label: 'Unauthorized', body: { error: 'No token or API key provided' } },
    ],
  },
  {
    method: 'POST', path: '/api/boards', description: 'Create a new board',
    fields: [
      { key: 'name', label: 'Board Name', in: 'body', required: true, placeholder: 'Marketing Q2' },
      { key: 'description', label: 'Description', in: 'body', placeholder: 'Campaign planning for Q2' },
      { key: 'color', label: 'Color', in: 'body', placeholder: '#0073ea', hint: 'Hex color code' },
      { key: 'icon', label: 'Icon', in: 'body', placeholder: '🎯', hint: 'Emoji icon' },
    ],
    responses: [
      { status: 201, label: 'Board created', body: { id: 'board-uuid', name: 'Marketing Q2', description: 'Campaign planning', color: '#0073ea', icon: '🎯', created_by: 'user-uuid', created_at: '2025-01-15T10:00:00Z' } },
      { status: 400, label: 'Validation error', body: { error: { fieldErrors: { name: ['Required'] } } } },
      { status: 401, label: 'Unauthorized', body: { error: 'No token or API key provided' } },
    ],
  },
  {
    method: 'GET', path: '/api/boards/:id', description: 'Get a board with all groups, columns, and items',
    fields: [
      { key: 'id', label: 'Board ID', in: 'path', required: true, placeholder: 'board-uuid-here', hint: 'UUID of the board' },
    ],
    responses: [
      { status: 200, label: 'Success', body: { id: 'board-uuid', name: 'Marketing Q2', color: '#0073ea', icon: '🎯', groups: [{ id: 'group-uuid', name: 'In Progress', color: '#fdab3d', items: [{ id: 'item-uuid', name: 'Design landing page' }] }], columns: [{ id: 'col-uuid', name: 'Status', type: 'status' }] } },
      { status: 401, label: 'Unauthorized', body: { error: 'No token or API key provided' } },
      { status: 403, label: 'Forbidden — not your board', body: { error: 'Access denied' } },
      { status: 404, label: 'Board not found', body: { error: 'Board not found' } },
    ],
  },
  {
    method: 'PUT', path: '/api/boards/:id', description: 'Update board name, description, color, or icon',
    fields: [
      { key: 'id', label: 'Board ID', in: 'path', required: true, placeholder: 'board-uuid-here' },
      { key: 'name', label: 'Board Name', in: 'body', placeholder: 'New Board Name' },
      { key: 'description', label: 'Description', in: 'body', placeholder: 'Updated description' },
      { key: 'color', label: 'Color', in: 'body', placeholder: '#ff5733' },
      { key: 'icon', label: 'Icon', in: 'body', placeholder: '🚀' },
    ],
    responses: [
      { status: 200, label: 'Updated', body: { id: 'board-uuid', name: 'New Board Name', color: '#ff5733', icon: '🚀', updated_at: '2025-01-16T12:00:00Z' } },
      { status: 401, label: 'Unauthorized', body: { error: 'No token or API key provided' } },
      { status: 404, label: 'Board not found', body: { error: 'Board not found' } },
    ],
  },
  {
    method: 'DELETE', path: '/api/boards/:id', description: 'Delete a board (owner only)',
    fields: [
      { key: 'id', label: 'Board ID', in: 'path', required: true, placeholder: 'board-uuid-here' },
    ],
    responses: [
      { status: 200, label: 'Deleted', body: { success: true } },
      { status: 401, label: 'Unauthorized', body: { error: 'No token or API key provided' } },
      { status: 403, label: 'Forbidden — not the owner', body: { error: 'Access denied' } },
      { status: 404, label: 'Board not found', body: { error: 'Board not found' } },
    ],
  },
];

const GROUP_EPS: EP[] = [
  {
    method: 'GET', path: '/api/boards/:boardId/groups', description: 'List all groups in a board',
    fields: [{ key: 'boardId', label: 'Board ID', in: 'path', required: true, placeholder: 'board-uuid-here' }],
    responses: [
      { status: 200, label: 'Success', body: [{ id: 'group-uuid', board_id: 'board-uuid', name: 'In Progress', color: '#fdab3d', position: 0, created_at: '2025-01-15T10:00:00Z' }] },
      { status: 401, label: 'Unauthorized', body: { error: 'No token or API key provided' } },
    ],
  },
  {
    method: 'POST', path: '/api/boards/:boardId/groups', description: 'Create a new group/section in a board',
    fields: [
      { key: 'boardId', label: 'Board ID', in: 'path', required: true, placeholder: 'board-uuid-here' },
      { key: 'name', label: 'Group Name', in: 'body', required: true, placeholder: 'In Progress' },
      { key: 'color', label: 'Color', in: 'body', placeholder: '#fdab3d', hint: 'Hex color code' },
    ],
    responses: [
      { status: 201, label: 'Group created', body: { id: 'group-uuid', board_id: 'board-uuid', name: 'In Progress', color: '#fdab3d', position: 0, created_at: '2025-01-15T10:00:00Z' } },
      { status: 400, label: 'Validation error', body: { error: { fieldErrors: { name: ['Required'] } } } },
      { status: 401, label: 'Unauthorized', body: { error: 'No token or API key provided' } },
    ],
  },
  {
    method: 'PUT', path: '/api/boards/:boardId/groups/:id', description: 'Rename or recolor a group',
    fields: [
      { key: 'boardId', label: 'Board ID', in: 'path', required: true, placeholder: 'board-uuid-here' },
      { key: 'id', label: 'Group ID', in: 'path', required: true, placeholder: 'group-uuid-here' },
      { key: 'name', label: 'Group Name', in: 'body', placeholder: 'Done' },
      { key: 'color', label: 'Color', in: 'body', placeholder: '#00c875' },
    ],
    responses: [
      { status: 200, label: 'Updated', body: { id: 'group-uuid', name: 'Done', color: '#00c875', position: 0 } },
      { status: 401, label: 'Unauthorized', body: { error: 'No token or API key provided' } },
      { status: 404, label: 'Group not found', body: { error: 'Group not found' } },
    ],
  },
  {
    method: 'DELETE', path: '/api/boards/:boardId/groups/:id', description: 'Delete a group and all its items',
    fields: [
      { key: 'boardId', label: 'Board ID', in: 'path', required: true, placeholder: 'board-uuid-here' },
      { key: 'id', label: 'Group ID', in: 'path', required: true, placeholder: 'group-uuid-here' },
    ],
    responses: [
      { status: 200, label: 'Deleted', body: { success: true } },
      { status: 401, label: 'Unauthorized', body: { error: 'No token or API key provided' } },
      { status: 404, label: 'Group not found', body: { error: 'Group not found' } },
    ],
  },
];

const ITEM_EPS: EP[] = [
  {
    method: 'GET', path: '/api/boards/:boardId/items', description: 'List items in a board (optional group filter)',
    fields: [
      { key: 'boardId', label: 'Board ID', in: 'path', required: true, placeholder: 'board-uuid-here' },
      { key: 'group_id', label: 'Group ID', in: 'query', placeholder: 'group-uuid-here', hint: 'Filter by group' },
    ],
    responses: [
      { status: 200, label: 'Success', body: [{ id: 'item-uuid', name: 'Design landing page', group_id: 'group-uuid', board_id: 'board-uuid', position: 0, values: { 'col-uuid': 'Done' }, created_at: '2025-01-15T10:00:00Z' }] },
      { status: 401, label: 'Unauthorized', body: { error: 'No token or API key provided' } },
    ],
  },
  {
    method: 'POST', path: '/api/boards/:boardId/items', description: 'Create a new item/task',
    fields: [
      { key: 'boardId', label: 'Board ID', in: 'path', required: true, placeholder: 'board-uuid-here' },
      { key: 'name', label: 'Item Name', in: 'body', required: true, placeholder: 'Design landing page' },
      { key: 'group_id', label: 'Group ID', in: 'body', required: true, placeholder: 'group-uuid-here', hint: 'Which group to add to' },
    ],
    responses: [
      { status: 201, label: 'Item created', body: { id: 'item-uuid', name: 'Design landing page', group_id: 'group-uuid', board_id: 'board-uuid', position: 0, created_at: '2025-01-15T10:00:00Z' } },
      { status: 400, label: 'Validation error', body: { error: { fieldErrors: { name: ['Required'], group_id: ['Required'] } } } },
      { status: 401, label: 'Unauthorized', body: { error: 'No token or API key provided' } },
    ],
  },
  {
    method: 'PUT', path: '/api/boards/:boardId/items/:id', description: 'Rename an item or move it to another group',
    fields: [
      { key: 'boardId', label: 'Board ID', in: 'path', required: true, placeholder: 'board-uuid-here' },
      { key: 'id', label: 'Item ID', in: 'path', required: true, placeholder: 'item-uuid-here' },
      { key: 'name', label: 'Item Name', in: 'body', placeholder: 'Updated task name' },
      { key: 'group_id', label: 'Group ID', in: 'body', placeholder: 'new-group-uuid', hint: 'Move to a different group' },
    ],
    responses: [
      { status: 200, label: 'Updated', body: { id: 'item-uuid', name: 'Updated task name', group_id: 'new-group-uuid', position: 0 } },
      { status: 401, label: 'Unauthorized', body: { error: 'No token or API key provided' } },
      { status: 404, label: 'Item not found', body: { error: 'Item not found' } },
    ],
  },
  {
    method: 'PUT', path: '/api/boards/:boardId/items/:id/values', description: 'Set a cell value (status, date, person, etc.)',
    fields: [
      { key: 'boardId', label: 'Board ID', in: 'path', required: true, placeholder: 'board-uuid-here' },
      { key: 'id', label: 'Item ID', in: 'path', required: true, placeholder: 'item-uuid-here' },
      { key: 'column_id', label: 'Column ID', in: 'body', required: true, placeholder: 'col-uuid-here', hint: 'Which column to update' },
      { key: 'value', label: 'Value', in: 'body', required: true, placeholder: 'Done', hint: 'The cell value to set' },
    ],
    responses: [
      { status: 200, label: 'Value saved', body: { success: true } },
      { status: 400, label: 'Validation error', body: { error: { fieldErrors: { column_id: ['Required'], value: ['Required'] } } } },
      { status: 401, label: 'Unauthorized', body: { error: 'No token or API key provided' } },
    ],
  },
  {
    method: 'DELETE', path: '/api/boards/:boardId/items/:id', description: 'Delete an item',
    fields: [
      { key: 'boardId', label: 'Board ID', in: 'path', required: true, placeholder: 'board-uuid-here' },
      { key: 'id', label: 'Item ID', in: 'path', required: true, placeholder: 'item-uuid-here' },
    ],
    responses: [
      { status: 200, label: 'Deleted', body: { success: true } },
      { status: 401, label: 'Unauthorized', body: { error: 'No token or API key provided' } },
      { status: 404, label: 'Item not found', body: { error: 'Item not found' } },
    ],
  },
  {
    method: 'GET', path: '/api/boards/:boardId/items/:id/comments', description: 'Get all comments on an item',
    fields: [
      { key: 'boardId', label: 'Board ID', in: 'path', required: true, placeholder: 'board-uuid-here' },
      { key: 'id', label: 'Item ID', in: 'path', required: true, placeholder: 'item-uuid-here' },
    ],
    responses: [
      { status: 200, label: 'Success', body: [{ id: 'comment-uuid', text: 'Looks good!', author_id: 'user-uuid', author_name: 'Juan Cruz', created_at: '2025-01-15T10:00:00Z' }] },
      { status: 401, label: 'Unauthorized', body: { error: 'No token or API key provided' } },
    ],
  },
  {
    method: 'POST', path: '/api/boards/:boardId/items/:id/comments', description: 'Add a comment to an item',
    fields: [
      { key: 'boardId', label: 'Board ID', in: 'path', required: true, placeholder: 'board-uuid-here' },
      { key: 'id', label: 'Item ID', in: 'path', required: true, placeholder: 'item-uuid-here' },
      { key: 'text', label: 'Comment Text', in: 'body', required: true, placeholder: 'Looks good, approved!' },
    ],
    responses: [
      { status: 201, label: 'Comment added', body: { id: 'comment-uuid', text: 'Looks good, approved!', author_id: 'user-uuid', author_name: 'Juan Cruz', created_at: '2025-01-15T11:00:00Z' } },
      { status: 400, label: 'Validation error', body: { error: { fieldErrors: { text: ['Required'] } } } },
      { status: 401, label: 'Unauthorized', body: { error: 'No token or API key provided' } },
    ],
  },
];

const COLUMN_EPS: EP[] = [
  {
    method: 'GET', path: '/api/boards/:boardId/columns', description: 'List all columns in a board',
    fields: [{ key: 'boardId', label: 'Board ID', in: 'path', required: true, placeholder: 'board-uuid-here' }],
    responses: [
      { status: 200, label: 'Success', body: [{ id: 'col-uuid', board_id: 'board-uuid', name: 'Status', type: 'status', settings: {}, position: 0 }] },
      { status: 401, label: 'Unauthorized', body: { error: 'No token or API key provided' } },
    ],
  },
  {
    method: 'POST', path: '/api/boards/:boardId/columns', description: 'Add a column to a board',
    fields: [
      { key: 'boardId', label: 'Board ID', in: 'path', required: true, placeholder: 'board-uuid-here' },
      { key: 'name', label: 'Column Name', in: 'body', required: true, placeholder: 'Due Date' },
      { key: 'type', label: 'Column Type', in: 'body', type: 'select', required: true, hint: 'Pick one', options: ['text', 'status', 'date', 'person', 'number', 'checkbox', 'url', 'email', 'phone'] },
    ],
    responses: [
      { status: 201, label: 'Column created', body: { id: 'col-uuid', board_id: 'board-uuid', name: 'Due Date', type: 'date', settings: {}, position: 1 } },
      { status: 400, label: 'Validation error', body: { error: { fieldErrors: { name: ['Required'], type: ['Invalid enum value'] } } } },
      { status: 401, label: 'Unauthorized', body: { error: 'No token or API key provided' } },
    ],
  },
  {
    method: 'PUT', path: '/api/boards/:boardId/columns/:id', description: 'Rename or update a column',
    fields: [
      { key: 'boardId', label: 'Board ID', in: 'path', required: true, placeholder: 'board-uuid-here' },
      { key: 'id', label: 'Column ID', in: 'path', required: true, placeholder: 'col-uuid-here' },
      { key: 'name', label: 'Column Name', in: 'body', placeholder: 'New Column Name' },
    ],
    responses: [
      { status: 200, label: 'Updated', body: { id: 'col-uuid', name: 'New Column Name', type: 'status', position: 0 } },
      { status: 401, label: 'Unauthorized', body: { error: 'No token or API key provided' } },
      { status: 404, label: 'Column not found', body: { error: 'Column not found' } },
    ],
  },
  {
    method: 'DELETE', path: '/api/boards/:boardId/columns/:id', description: 'Delete a column',
    fields: [
      { key: 'boardId', label: 'Board ID', in: 'path', required: true, placeholder: 'board-uuid-here' },
      { key: 'id', label: 'Column ID', in: 'path', required: true, placeholder: 'col-uuid-here' },
    ],
    responses: [
      { status: 200, label: 'Deleted', body: { success: true } },
      { status: 401, label: 'Unauthorized', body: { error: 'No token or API key provided' } },
      { status: 404, label: 'Column not found', body: { error: 'Column not found' } },
    ],
  },
];

const DEV_EPS: EP[] = [
  {
    method: 'GET', path: '/api/developer/keys', description: 'List all your personal API keys',
    responses: [
      { status: 200, label: 'Success', body: [{ id: 'key-uuid', key_prefix: 'tf_live_abc123…', name: 'n8n Workflow', last_used_at: '2025-01-16T08:00:00Z', created_at: '2025-01-15T10:00:00Z' }] },
      { status: 401, label: 'Unauthorized', body: { error: 'No token or API key provided' } },
    ],
  },
  {
    method: 'POST', path: '/api/developer/keys', description: 'Generate a new personal API key',
    fields: [
      { key: 'name', label: 'Key Name', in: 'body', required: true, placeholder: 'n8n Workflow', hint: 'Label so you remember what it\'s for' },
    ],
    responses: [
      { status: 201, label: 'Key created — save it now!', body: { id: 'key-uuid', key: 'tf_live_abc123def456...', key_prefix: 'tf_live_abc123…', name: 'n8n Workflow', created_at: '2025-01-15T10:00:00Z', _warning: 'Save this key now — it cannot be retrieved again.' } },
      { status: 400, label: 'Validation error', body: { error: 'Name is required' } },
      { status: 401, label: 'Unauthorized', body: { error: 'No token or API key provided' } },
    ],
  },
  {
    method: 'DELETE', path: '/api/developer/keys/:id', description: 'Revoke (delete) an API key',
    fields: [
      { key: 'id', label: 'Key ID', in: 'path', required: true, placeholder: 'key-uuid-here' },
    ],
    responses: [
      { status: 200, label: 'Revoked', body: { success: true } },
      { status: 401, label: 'Unauthorized', body: { error: 'No token or API key provided' } },
      { status: 404, label: 'Key not found', body: { error: 'API key not found' } },
    ],
  },
];

const OAUTH_EPS: EP[] = [
  {
    method: 'GET', path: '/api/oauth/clients', description: 'List your OAuth clients',
    responses: [
      { status: 200, label: 'Success', body: [{ id: 'client-uuid', client_id: 'tf_abc123', name: 'My App', description: 'My integration', created_at: '2025-01-15T10:00:00Z' }] },
      { status: 401, label: 'Unauthorized', body: { error: 'No token or API key provided' } },
    ],
  },
  {
    method: 'POST', path: '/api/oauth/clients', description: 'Create a new OAuth client',
    fields: [
      { key: 'name', label: 'Client Name', in: 'body', required: true, placeholder: 'My n8n App' },
      { key: 'description', label: 'Description', in: 'body', placeholder: 'Integration for n8n workflows' },
    ],
    responses: [
      { status: 201, label: 'Client created — save secret now!', body: { id: 'client-uuid', client_id: 'tf_abc123def456', client_secret: 'xyzSecretRaw...', name: 'My n8n App', description: '', created_at: '2025-01-15T10:00:00Z', _warning: 'Save the client_secret NOW — it will never be shown again.' } },
      { status: 400, label: 'Validation error', body: { error: 'Name is required' } },
      { status: 401, label: 'Unauthorized', body: { error: 'No token or API key provided' } },
    ],
  },
  {
    method: 'DELETE', path: '/api/oauth/clients/:id', description: 'Delete an OAuth client',
    fields: [
      { key: 'id', label: 'Client ID', in: 'path', required: true, placeholder: 'client-uuid-here' },
    ],
    responses: [
      { status: 200, label: 'Deleted', body: { success: true } },
      { status: 401, label: 'Unauthorized', body: { error: 'No token or API key provided' } },
      { status: 404, label: 'Client not found', body: { error: 'Client not found' } },
    ],
  },
  {
    method: 'POST', path: '/oauth/token', description: 'Exchange client credentials for an access token', noAuth: true,
    fields: [
      { key: 'grant_type', label: 'Grant Type', in: 'body', required: true, placeholder: 'client_credentials', hint: 'Must be "client_credentials"' },
      { key: 'client_id', label: 'Client ID', in: 'body', required: true, placeholder: 'tf_abc123def456' },
      { key: 'client_secret', label: 'Client Secret', in: 'body', type: 'password', required: true, placeholder: 'your-client-secret' },
    ],
    responses: [
      { status: 200, label: 'Token issued', body: { access_token: 'eyJhbGciOiJIUzI1NiJ9...', token_type: 'Bearer', expires_in: 86400, scope: 'mcp:read mcp:write' } },
      { status: 400, label: 'Bad grant type', body: { error: 'unsupported_grant_type', error_description: 'Only client_credentials grant type is supported' } },
      { status: 401, label: 'Invalid credentials', body: { error: 'invalid_client', error_description: 'Invalid client_id or client_secret' } },
    ],
  },
];

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DocsPage() {
  const baseUrl = import.meta.env.PROD ? window.location.origin : 'http://localhost:3001';

  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">API & MCP Documentation</h1>
        <p className="text-gray-500">Interactive reference for TaskFlow REST API and MCP integration. Fill in the fields to generate curl commands.</p>
      </div>

      {/* Quick start cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
        {[
          { icon: <Globe size={20} />, title: 'REST API', desc: 'Standard HTTP endpoints for any language or platform', color: 'blue' },
          { icon: <Zap size={20} />, title: 'MCP Server', desc: 'Connect Claude AI directly to your TaskFlow data', color: 'purple' },
          { icon: <Terminal size={20} />, title: 'Authentication', desc: 'JWT, API Key, or OAuth 2.0 — three ways to authenticate', color: 'green' },
        ].map(({ icon, title, desc, color }) => (
          <div key={title} className={`bg-${color}-50 border border-${color}-100 rounded-xl p-4`}>
            <div className={`text-${color}-600 mb-2`}>{icon}</div>
            <h3 className="font-semibold text-gray-800">{title}</h3>
            <p className="text-sm text-gray-500 mt-1">{desc}</p>
          </div>
        ))}
      </div>

      {/* ── Auth ── */}
      <SectionGroup emoji="🔐" title="Authentication" subtitle="Login, register, and get your token. Register/Login endpoints don't require an auth token.">
        {AUTH_EPS.map(ep => <EndpointCard key={ep.path + ep.method} ep={ep} base={baseUrl} />)}

        <div className="mt-4 bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-gray-700 space-y-2">
          <p className="font-semibold text-blue-700">Three ways to authenticate all other endpoints:</p>
          <div className="font-mono text-xs space-y-1">
            <div><span className="text-gray-400">1. JWT or OAuth token: </span><span className="text-blue-700">Authorization: Bearer eyJhbGci...</span></div>
            <div><span className="text-gray-400">2. API Key header:      </span><span className="text-blue-700">Authorization: Bearer tf_live_...</span></div>
            <div><span className="text-gray-400">3. API Key alt header:  </span><span className="text-blue-700">X-Api-Key: tf_live_...</span></div>
          </div>
        </div>
      </SectionGroup>

      {/* ── Boards ── */}
      <SectionGroup emoji="📋" title="Boards" subtitle="Create and manage your project boards.">
        {BOARD_EPS.map(ep => <EndpointCard key={ep.path + ep.method} ep={ep} base={baseUrl} />)}
      </SectionGroup>

      {/* ── Groups ── */}
      <SectionGroup emoji="📁" title="Groups" subtitle="Groups are sections inside a board (e.g. 'In Progress', 'Done').">
        {GROUP_EPS.map(ep => <EndpointCard key={ep.path + ep.method} ep={ep} base={baseUrl} />)}
      </SectionGroup>

      {/* ── Items ── */}
      <SectionGroup emoji="✅" title="Items" subtitle="Tasks/items inside a group. Values are the cells in each column.">
        {ITEM_EPS.map(ep => <EndpointCard key={ep.path + ep.method} ep={ep} base={baseUrl} />)}
      </SectionGroup>

      {/* ── Columns ── */}
      <SectionGroup emoji="🗂️" title="Columns" subtitle="Columns define the fields on each board (Status, Date, Person, etc.).">
        {COLUMN_EPS.map(ep => <EndpointCard key={ep.path + ep.method} ep={ep} base={baseUrl} />)}
      </SectionGroup>

      {/* ── Developer Keys ── */}
      <SectionGroup emoji="🔑" title="API Keys" subtitle="Personal API keys for direct access without OAuth.">
        {DEV_EPS.map(ep => <EndpointCard key={ep.path + ep.method} ep={ep} base={baseUrl} />)}
      </SectionGroup>

      {/* ── OAuth ── */}
      <SectionGroup emoji="⚙️" title="OAuth 2.0" subtitle="OAuth clients for third-party app integration (e.g. n8n, automation tools).">
        {OAUTH_EPS.map(ep => <EndpointCard key={ep.path + ep.method} ep={ep} base={baseUrl} />)}
      </SectionGroup>

      {/* ── MCP Server ── */}
      <div className="border-2 border-purple-200 bg-purple-50 rounded-xl overflow-hidden mb-8">
        <div className="px-5 py-4 bg-purple-100 border-b border-purple-200 flex items-center gap-2">
          <Code2 size={18} className="text-purple-600" />
          <div>
            <h2 className="font-bold text-gray-800 text-lg">MCP Server Integration</h2>
            <p className="text-sm text-gray-600">Connect Claude AI to TaskFlow via SSE (URL-based) or stdio (local process).</p>
          </div>
        </div>
        <div className="px-5 py-5 space-y-6 text-sm text-gray-700">

          <div className="bg-white border border-purple-100 rounded-xl p-4">
            <p className="font-bold text-purple-700 mb-1">Option A — SSE / HTTP ✅ Recommended</p>
            <p className="text-xs text-gray-500 mb-3">Works with Cursor, Continue.dev, Onyx, and any MCP client that accepts a URL.</p>
            <p className="font-semibold mb-1">MCP SSE URL (use your JWT or API key as token):</p>
            <CodeSnip lang="text" code={`${baseUrl}/mcp/sse?token=YOUR_JWT_OR_API_KEY`} />
            <p className="font-semibold mb-1 mt-3">Or use OAuth — get a token first:</p>
            <CodeSnip lang="bash" code={`curl -X POST ${baseUrl}/oauth/token \\
  -H "Content-Type: application/x-www-form-urlencoded" \\
  -d "grant_type=client_credentials&client_id=tf_...&client_secret=..."
# Then use access_token as the ?token= value`} />
          </div>

          <div className="bg-white border border-purple-100 rounded-xl p-4">
            <p className="font-bold text-gray-700 mb-1">Option B — stdio (Claude Desktop local)</p>
            <p className="text-xs text-gray-500 mb-3">Config file: <code>%APPDATA%\Claude\claude_desktop_config.json</code></p>
            <CodeSnip lang="json" code={`{
  "mcpServers": {
    "taskflow": {
      "command": "node",
      "args": ["C:/path/to/backend/dist/mcp/server.js"],
      "env": {
        "API_URL": "${baseUrl}",
        "API_TOKEN": "YOUR_JWT_OR_API_KEY"
      }
    }
  }
}`} />
          </div>

          <div>
            <p className="font-semibold mb-2">Available MCP Tools (13)</p>
            <div className="bg-white rounded-lg border border-purple-100 divide-y divide-gray-100">
              {[
                ['list_boards', 'List all your boards'],
                ['create_board', 'Create a new board'],
                ['get_board', 'Get board with all data (groups, items, columns)'],
                ['list_groups', 'List groups in a board'],
                ['create_group', 'Create a group/section'],
                ['list_items', 'List items (optional group filter)'],
                ['create_item', 'Create a task/item'],
                ['update_item', 'Rename or move an item to another group'],
                ['update_item_value', 'Set a cell value (status, date, etc.)'],
                ['delete_item', 'Delete an item'],
                ['list_columns', 'List board columns'],
                ['add_column', 'Add a column to a board'],
                ['add_comment', 'Add a comment to an item'],
              ].map(([tool, desc]) => (
                <div key={tool} className="flex items-center gap-3 px-4 py-2">
                  <code className="text-xs font-mono text-purple-700 bg-purple-50 px-2 py-0.5 rounded shrink-0">{tool}</code>
                  <span className="text-sm text-gray-600">{desc}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="font-semibold mb-2">Example Claude prompts</p>
            <CodeSnip lang="text" code={`"Show me all my boards"
"Create a board called 'Product Roadmap' with a rocket icon"
"Add a task 'Fix login bug' to the first group of my Sprint board"
"Mark the 'Design review' task as Done"
"List all items in my Marketing board"`} />
          </div>
        </div>
      </div>

      {/* ── SDK Examples ── */}
      <SectionGroup emoji="💻" title="SDK Examples" subtitle="Use the API from your code.">
        <p className="text-sm font-semibold text-gray-600 mb-1">JavaScript / TypeScript</p>
        <CodeSnip lang="typescript" code={`const token = 'YOUR_JWT_OR_API_KEY';
const base = '${baseUrl}/api';
const headers = { 'Authorization': \`Bearer \${token}\`, 'Content-Type': 'application/json' };

// List boards
const boards = await fetch(\`\${base}/boards\`, { headers }).then(r => r.json());

// Create an item
const item = await fetch(\`\${base}/boards/\${boardId}/items\`, {
  method: 'POST', headers,
  body: JSON.stringify({ name: 'New Task', group_id: groupId }),
}).then(r => r.json());

// Set item status
await fetch(\`\${base}/boards/\${boardId}/items/\${item.id}/values\`, {
  method: 'PUT', headers,
  body: JSON.stringify({ column_id: statusColId, value: 'Done' }),
});`} />

        <p className="text-sm font-semibold text-gray-600 mb-1 mt-4">Python</p>
        <CodeSnip lang="python" code={`import requests

TOKEN = "YOUR_JWT_OR_API_KEY"
BASE = "${baseUrl}/api"
headers = {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}

# List boards
boards = requests.get(f"{BASE}/boards", headers=headers).json()

# Create a board
board = requests.post(f"{BASE}/boards", headers=headers,
    json={"name": "My Board", "icon": "🚀"}).json()

# Create an item
item = requests.post(f"{BASE}/boards/{board['id']}/items", headers=headers,
    json={"name": "Deploy to production", "group_id": board_group_id}).json()

# Set cell value
requests.put(f"{BASE}/boards/{board['id']}/items/{item['id']}/values",
    headers=headers, json={"column_id": status_col_id, "value": "Done"})`} />
      </SectionGroup>
    </div>
  );
}
