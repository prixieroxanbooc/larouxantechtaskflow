import { useState } from 'react';
import { Code2, Zap, Globe, Terminal, ChevronDown, ChevronRight, Copy, Check } from 'lucide-react';

function CodeBlock({ code, lang = 'json' }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="relative bg-gray-900 rounded-xl overflow-hidden my-3">
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-700">
        <span className="text-xs text-gray-400 font-mono">{lang}</span>
        <button onClick={copy} className="text-gray-400 hover:text-white transition-colors">
          {copied ? <Check size={14} /> : <Copy size={14} />}
        </button>
      </div>
      <pre className="p-4 text-sm text-gray-100 overflow-x-auto font-mono leading-relaxed">{code}</pre>
    </div>
  );
}

function Section({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden mb-4">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
      >
        <span className="font-semibold text-gray-800">{title}</span>
        {open ? <ChevronDown size={18} className="text-gray-500" /> : <ChevronRight size={18} className="text-gray-500" />}
      </button>
      {open && <div className="px-5 py-4 text-sm text-gray-700 space-y-3">{children}</div>}
    </div>
  );
}

function EndpointRow({ method, path, desc }: { method: string; path: string; desc: string }) {
  const colors: Record<string, string> = {
    GET: 'bg-blue-100 text-blue-700',
    POST: 'bg-green-100 text-green-700',
    PUT: 'bg-yellow-100 text-yellow-700',
    DELETE: 'bg-red-100 text-red-700',
  };
  return (
    <div className="flex items-start gap-3 py-2 border-b border-gray-100 last:border-0">
      <span className={`text-xs font-bold px-2 py-0.5 rounded font-mono shrink-0 mt-0.5 ${colors[method]}`}>{method}</span>
      <code className="text-sm font-mono text-gray-800 shrink-0">{path}</code>
      <span className="text-sm text-gray-500">{desc}</span>
    </div>
  );
}

export default function DocsPage() {
  const baseUrl = import.meta.env.PROD ? window.location.origin : 'http://localhost:3001';

  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">API & MCP Documentation</h1>
        <p className="text-gray-500">Complete reference for integrating TaskFlow via REST API or Model Context Protocol (MCP).</p>
      </div>

      {/* Quick Start Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {[
          { icon: <Globe size={20} />, title: 'REST API', desc: 'Standard HTTP endpoints for any language or platform', color: 'blue' },
          { icon: <Zap size={20} />, title: 'MCP Server', desc: 'Connect Claude AI directly to your TaskFlow data', color: 'purple' },
          { icon: <Terminal size={20} />, title: 'Authentication', desc: 'JWT Bearer token for all API requests', color: 'green' },
        ].map(({ icon, title, desc, color }) => (
          <div key={title} className={`bg-${color}-50 border border-${color}-100 rounded-xl p-4`}>
            <div className={`text-${color}-600 mb-2`}>{icon}</div>
            <h3 className="font-semibold text-gray-800">{title}</h3>
            <p className="text-sm text-gray-500 mt-1">{desc}</p>
          </div>
        ))}
      </div>

      {/* Auth Section */}
      <Section title="🔐 Authentication" defaultOpen>
        <p>All API requests require a <strong>Bearer token</strong> in the Authorization header.</p>
        <CodeBlock lang="bash" code={`# Register a new account
curl -X POST ${baseUrl}/api/auth/register \\
  -H "Content-Type: application/json" \\
  -d '{"name":"Juan Cruz","email":"juan@example.com","password":"secret123"}'

# Login
curl -X POST ${baseUrl}/api/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{"email":"juan@example.com","password":"secret123"}'`} />
        <p>Response includes a <code className="bg-gray-100 px-1 rounded">token</code> field. Use it in subsequent requests:</p>
        <CodeBlock lang="bash" code={`curl ${baseUrl}/api/boards \\
  -H "Authorization: Bearer YOUR_JWT_TOKEN"`} />
      </Section>

      {/* Boards */}
      <Section title="📋 Boards API" defaultOpen>
        <EndpointRow method="GET" path="/api/boards" desc="List all boards for current user" />
        <EndpointRow method="POST" path="/api/boards" desc="Create a new board" />
        <EndpointRow method="GET" path="/api/boards/:id" desc="Get board with all groups, columns, and items" />
        <EndpointRow method="PUT" path="/api/boards/:id" desc="Update board name, description, color or icon" />
        <EndpointRow method="DELETE" path="/api/boards/:id" desc="Delete a board (owner only)" />
        <CodeBlock lang="json" code={`// POST /api/boards
{
  "name": "Marketing Q2",
  "description": "Campaign planning",
  "color": "#0073ea",
  "icon": "🎯"
}`} />
      </Section>

      {/* Groups */}
      <Section title="📁 Groups API">
        <EndpointRow method="GET" path="/api/boards/:boardId/groups" desc="List all groups in a board" />
        <EndpointRow method="POST" path="/api/boards/:boardId/groups" desc="Create a new group/section" />
        <EndpointRow method="PUT" path="/api/boards/:boardId/groups/:id" desc="Rename or recolor a group" />
        <EndpointRow method="DELETE" path="/api/boards/:boardId/groups/:id" desc="Delete a group and its items" />
        <CodeBlock lang="json" code={`// POST /api/boards/:boardId/groups
{
  "name": "In Progress",
  "color": "#fdab3d"
}`} />
      </Section>

      {/* Items */}
      <Section title="✅ Items API">
        <EndpointRow method="GET" path="/api/boards/:boardId/items" desc="List items (optional ?group_id= filter)" />
        <EndpointRow method="POST" path="/api/boards/:boardId/items" desc="Create a new item/task" />
        <EndpointRow method="PUT" path="/api/boards/:boardId/items/:id" desc="Update item name or move to another group" />
        <EndpointRow method="PUT" path="/api/boards/:boardId/items/:id/values" desc="Set a cell value (status, date, etc.)" />
        <EndpointRow method="DELETE" path="/api/boards/:boardId/items/:id" desc="Delete an item" />
        <EndpointRow method="GET" path="/api/boards/:boardId/items/:id/comments" desc="Get item comments" />
        <EndpointRow method="POST" path="/api/boards/:boardId/items/:id/comments" desc="Add a comment" />
        <CodeBlock lang="json" code={`// PUT /api/boards/:boardId/items/:id/values
{ "column_id": "col-uuid-here", "value": "Done" }

// Move item to another group
// PUT /api/boards/:boardId/items/:id
{ "group_id": "new-group-uuid" }`} />
      </Section>

      {/* Columns */}
      <Section title="🗂️ Columns API">
        <EndpointRow method="GET" path="/api/boards/:boardId/columns" desc="List all columns" />
        <EndpointRow method="POST" path="/api/boards/:boardId/columns" desc="Add a column" />
        <EndpointRow method="PUT" path="/api/boards/:boardId/columns/:id" desc="Rename a column" />
        <EndpointRow method="DELETE" path="/api/boards/:boardId/columns/:id" desc="Delete a column" />
        <p>Column types: <code className="bg-gray-100 px-1 rounded">text</code>, <code className="bg-gray-100 px-1 rounded">status</code>, <code className="bg-gray-100 px-1 rounded">date</code>, <code className="bg-gray-100 px-1 rounded">person</code>, <code className="bg-gray-100 px-1 rounded">number</code>, <code className="bg-gray-100 px-1 rounded">checkbox</code>, <code className="bg-gray-100 px-1 rounded">url</code>, <code className="bg-gray-100 px-1 rounded">email</code>, <code className="bg-gray-100 px-1 rounded">phone</code></p>
      </Section>

      {/* MCP Section */}
      <div className="border-2 border-purple-200 bg-purple-50 rounded-xl overflow-hidden mb-4">
        <div className="px-5 py-4 bg-purple-100 border-b border-purple-200">
          <div className="flex items-center gap-2">
            <Code2 size={18} className="text-purple-600" />
            <h2 className="font-bold text-gray-800 text-lg">MCP Server Integration</h2>
          </div>
          <p className="text-sm text-gray-600 mt-1">
            Two transports available: <strong>SSE/HTTP</strong> (URL-based, for Onyx, Continue.dev, any remote client)
            and <strong>stdio</strong> (for Claude Desktop local).
          </p>
        </div>
        <div className="px-5 py-5 text-sm text-gray-700 space-y-6">

          {/* SSE / HTTP MCP */}
          <div className="bg-white border border-purple-100 rounded-xl p-4">
            <p className="font-bold text-purple-700 mb-1">Option A — SSE / HTTP (URL-based) ✅ Recommended</p>
            <p className="text-gray-500 text-xs mb-3">Works with Onyx, Continue.dev, Cursor, and any MCP client that accepts a URL. No local install needed on the client side.</p>
            <p className="font-semibold mb-1">MCP SSE URL:</p>
            <CodeBlock lang="text" code={`${baseUrl}/mcp/sse?token=YOUR_JWT_TOKEN`} />
            <p className="font-semibold mb-1 mt-3">For Onyx — add in Settings → AI Assistants → MCP Servers:</p>
            <CodeBlock lang="json" code={`{
  "name": "TaskFlow",
  "url": "${baseUrl}/mcp/sse?token=YOUR_JWT_TOKEN"
}`} />
            <p className="font-semibold mb-1 mt-3">Check connection info:</p>
            <CodeBlock lang="bash" code={`curl ${baseUrl}/mcp`} />
          </div>

          {/* stdio / Claude Desktop */}
          <div className="bg-white border border-purple-100 rounded-xl p-4">
            <p className="font-bold text-gray-700 mb-1">Option B — stdio (Claude Desktop local)</p>
            <p className="text-gray-500 text-xs mb-3">Runs as a local process. Best for Claude Desktop on the same machine.</p>
            <p className="font-semibold mb-1">Step 1 — Build the MCP server</p>
            <CodeBlock lang="bash" code={`cd backend && npm run build`} />
            <p className="font-semibold mb-1 mt-2">Step 2 — Add to Claude Desktop config</p>
            <p className="text-gray-500 text-xs mb-2">
              File: <code>%APPDATA%\Claude\claude_desktop_config.json</code> (Windows)<br/>
              or <code>~/Library/Application Support/Claude/claude_desktop_config.json</code> (Mac)
            </p>
            <CodeBlock lang="json" code={`{
  "mcpServers": {
    "taskflow": {
      "command": "node",
      "args": ["C:/path/to/backend/dist/mcp/server.js"],
      "env": {
        "API_URL": "http://localhost:3001",
        "API_TOKEN": "YOUR_JWT_TOKEN_HERE"
      }
    }
  }
}`} />
          </div>

          <div>
            <p className="font-semibold mb-2">Get your JWT token</p>
            <CodeBlock lang="bash" code={`curl -X POST ${baseUrl}/api/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{"email":"you@example.com","password":"yourpass"}'
# Copy the "token" field from the response`} />
          </div>

          <div>
            <p className="font-semibold mb-2">Available MCP Tools</p>
            <div className="bg-white rounded-lg border border-purple-100 divide-y divide-gray-100">
              {[
                ['list_boards', 'List all your boards'],
                ['create_board', 'Create a new board'],
                ['get_board', 'Get board with all data'],
                ['list_groups', 'List groups in a board'],
                ['create_group', 'Create a group/section'],
                ['list_items', 'List items (optional group filter)'],
                ['create_item', 'Create a task/item'],
                ['update_item', 'Rename or move an item'],
                ['update_item_value', 'Set a cell value'],
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
            <p className="font-semibold mb-2">Example Claude prompts after connecting MCP</p>
            <CodeBlock lang="text" code={`"Show me all my boards"
"Create a board called 'Product Roadmap' with a rocket icon"
"Add a task 'Fix login bug' to the first group of my Sprint board"
"Mark the 'Design review' task as Done"
"List all items in my Marketing board that are stuck"`} />
          </div>
        </div>
      </div>

      {/* SDK / Integration Examples */}
      <Section title="💻 JavaScript / TypeScript SDK Example">
        <CodeBlock lang="typescript" code={`// Using the TaskFlow API with fetch
const token = 'YOUR_JWT_TOKEN';
const base = 'http://localhost:3001/api';

const headers = {
  'Authorization': \`Bearer \${token}\`,
  'Content-Type': 'application/json',
};

// List boards
const boards = await fetch(\`\${base}/boards\`, { headers }).then(r => r.json());

// Create an item
const item = await fetch(\`\${base}/boards/\${boardId}/items\`, {
  method: 'POST',
  headers,
  body: JSON.stringify({ name: 'New Task', group_id: groupId }),
}).then(r => r.json());

// Update item status
await fetch(\`\${base}/boards/\${boardId}/items/\${item.id}/values\`, {
  method: 'PUT',
  headers,
  body: JSON.stringify({ column_id: statusColumnId, value: 'Done' }),
});`} />
      </Section>

      <Section title="🐍 Python SDK Example">
        <CodeBlock lang="python" code={`import requests

TOKEN = "YOUR_JWT_TOKEN"
BASE = "http://localhost:3001/api"
headers = {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}

# List boards
boards = requests.get(f"{BASE}/boards", headers=headers).json()

# Create a board
board = requests.post(f"{BASE}/boards", headers=headers,
    json={"name": "My Board", "icon": "🚀"}).json()

# Create an item
item = requests.post(f"{BASE}/boards/{board['id']}/items", headers=headers,
    json={"name": "Deploy to production", "group_id": board_group_id}).json()

print(f"Created item: {item['id']}")`} />
      </Section>
    </div>
  );
}
