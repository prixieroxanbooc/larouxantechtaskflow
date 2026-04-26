import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';

async function callApi(apiUrl: string, apiToken: string, method: string, path: string, body?: unknown) {
  const res = await fetch(`${apiUrl}/api${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(apiToken ? { Authorization: `Bearer ${apiToken}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json() as Record<string, unknown>;
  if (!res.ok) throw new Error((data.error as string) || 'API error');
  return data;
}

export function createMcpServer(apiUrl: string, apiToken: string): Server {
  const server = new Server(
    { name: 'taskflow-mcp', version: '1.0.0' },
    { capabilities: { tools: {} } }
  );

  const api = (method: string, path: string, body?: unknown) =>
    callApi(apiUrl, apiToken, method, path, body);

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: 'list_boards',
        description: 'List all boards the authenticated user has access to',
        inputSchema: { type: 'object', properties: {}, required: [] },
      },
      {
        name: 'create_board',
        description: 'Create a new board',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Board name' },
            description: { type: 'string', description: 'Board description' },
            color: { type: 'string', description: 'Hex color e.g. #0073ea' },
            icon: { type: 'string', description: 'Emoji icon e.g. 📋' },
          },
          required: ['name'],
        },
      },
      {
        name: 'get_board',
        description: 'Get a board with all its groups, columns, and items',
        inputSchema: {
          type: 'object',
          properties: { board_id: { type: 'string' } },
          required: ['board_id'],
        },
      },
      {
        name: 'list_groups',
        description: 'List groups (sections) in a board',
        inputSchema: {
          type: 'object',
          properties: { board_id: { type: 'string' } },
          required: ['board_id'],
        },
      },
      {
        name: 'create_group',
        description: 'Create a new group (section) in a board',
        inputSchema: {
          type: 'object',
          properties: {
            board_id: { type: 'string' },
            name: { type: 'string' },
            color: { type: 'string', description: 'Hex color' },
          },
          required: ['board_id', 'name'],
        },
      },
      {
        name: 'list_items',
        description: 'List items in a board, optionally filtered by group',
        inputSchema: {
          type: 'object',
          properties: {
            board_id: { type: 'string' },
            group_id: { type: 'string', description: 'Filter by group (optional)' },
          },
          required: ['board_id'],
        },
      },
      {
        name: 'create_item',
        description: 'Create a new item (task/row) in a board group',
        inputSchema: {
          type: 'object',
          properties: {
            board_id: { type: 'string' },
            group_id: { type: 'string' },
            name: { type: 'string' },
          },
          required: ['board_id', 'group_id', 'name'],
        },
      },
      {
        name: 'update_item',
        description: 'Update an item name or move it to a different group',
        inputSchema: {
          type: 'object',
          properties: {
            board_id: { type: 'string' },
            item_id: { type: 'string' },
            name: { type: 'string' },
            group_id: { type: 'string' },
          },
          required: ['board_id', 'item_id'],
        },
      },
      {
        name: 'update_item_value',
        description: 'Update a cell value (e.g. set status, date, person)',
        inputSchema: {
          type: 'object',
          properties: {
            board_id: { type: 'string' },
            item_id: { type: 'string' },
            column_id: { type: 'string' },
            value: { type: 'string', description: 'Value to set' },
          },
          required: ['board_id', 'item_id', 'column_id', 'value'],
        },
      },
      {
        name: 'delete_item',
        description: 'Delete an item from a board',
        inputSchema: {
          type: 'object',
          properties: {
            board_id: { type: 'string' },
            item_id: { type: 'string' },
          },
          required: ['board_id', 'item_id'],
        },
      },
      {
        name: 'list_columns',
        description: 'List columns in a board',
        inputSchema: {
          type: 'object',
          properties: { board_id: { type: 'string' } },
          required: ['board_id'],
        },
      },
      {
        name: 'add_column',
        description: 'Add a column to a board',
        inputSchema: {
          type: 'object',
          properties: {
            board_id: { type: 'string' },
            name: { type: 'string' },
            type: {
              type: 'string',
              enum: ['text', 'status', 'date', 'person', 'number', 'checkbox', 'url', 'email', 'phone'],
            },
          },
          required: ['board_id', 'name', 'type'],
        },
      },
      {
        name: 'add_comment',
        description: 'Add a comment to an item',
        inputSchema: {
          type: 'object',
          properties: {
            board_id: { type: 'string' },
            item_id: { type: 'string' },
            text: { type: 'string' },
          },
          required: ['board_id', 'item_id', 'text'],
        },
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const a = args as Record<string, string>;

    try {
      let result: unknown;

      switch (name) {
        case 'list_boards':
          result = await api('GET', '/boards');
          break;
        case 'create_board':
          result = await api('POST', '/boards', args);
          break;
        case 'get_board':
          result = await api('GET', `/boards/${a.board_id}`);
          break;
        case 'list_groups':
          result = await api('GET', `/boards/${a.board_id}/groups`);
          break;
        case 'create_group':
          result = await api('POST', `/boards/${a.board_id}/groups`, { name: a.name, color: a.color });
          break;
        case 'list_items': {
          const qs = a.group_id ? `?group_id=${a.group_id}` : '';
          result = await api('GET', `/boards/${a.board_id}/items${qs}`);
          break;
        }
        case 'create_item':
          result = await api('POST', `/boards/${a.board_id}/items`, { name: a.name, group_id: a.group_id });
          break;
        case 'update_item':
          result = await api('PUT', `/boards/${a.board_id}/items/${a.item_id}`, { name: a.name, group_id: a.group_id });
          break;
        case 'update_item_value':
          result = await api('PUT', `/boards/${a.board_id}/items/${a.item_id}/values`, { column_id: a.column_id, value: a.value });
          break;
        case 'delete_item':
          result = await api('DELETE', `/boards/${a.board_id}/items/${a.item_id}`);
          break;
        case 'list_columns':
          result = await api('GET', `/boards/${a.board_id}/columns`);
          break;
        case 'add_column':
          result = await api('POST', `/boards/${a.board_id}/columns`, { name: a.name, type: a.type });
          break;
        case 'add_comment':
          result = await api('POST', `/boards/${a.board_id}/items/${a.item_id}/comments`, { text: a.text });
          break;
        default:
          throw new Error(`Unknown tool: ${name}`);
      }

      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Error: ${(error as Error).message}` }],
        isError: true,
      };
    }
  });

  return server;
}
