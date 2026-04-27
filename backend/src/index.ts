import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { initDatabase } from './db/database';
import { errorHandler } from './middleware/errorHandler';
import authRoutes from './routes/auth';
import boardRoutes from './routes/boards';
import groupRoutes from './routes/groups';
import itemRoutes from './routes/items';
import columnRoutes from './routes/columns';
import oauthRoutes from './routes/oauth';
import apiKeyRoutes from './routes/apikeys';
import { createMcpServer } from './mcp/factory';

const app = express();
const PORT = Number(process.env.PORT || 3001);

// Trust Render's HTTPS reverse proxy so req.protocol returns 'https'
app.set('trust proxy', 1);

app.use(cors({ origin: '*', credentials: false }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

function getBaseUrl(req: Request): string {
  const proto = process.env.NODE_ENV === 'production' ? 'https' : req.protocol;
  return `${proto}://${req.get('host')}`;
}

function extractToken(req: Request): string {
  return (
    (req.query.token as string) ||
    req.headers.authorization?.replace(/^Bearer\s+/i, '') ||
    ''
  );
}

// ── OAuth well-known endpoints ────────────────────────────────────────────────

// Protected Resource Metadata (RFC 9728).
// Also includes auth endpoints directly so non-standard clients (Onyx) that skip
// the authorization_servers hop can still find authorization_endpoint here.
app.get('/.well-known/oauth-protected-resource', (req: Request, res: Response) => {
  const base = getBaseUrl(req);
  res.json({
    resource: base,
    authorization_servers: [base],
    authorization_endpoint: `${base}/oauth/authorize`,
    token_endpoint: `${base}/oauth/token`,
    registration_endpoint: `${base}/oauth/register`,
    bearer_methods_supported: ['header', 'query'],
    scopes_supported: ['mcp:read', 'mcp:write'],
    code_challenge_methods_supported: ['S256'],
  });
});

// Authorization Server Metadata (RFC 8414)
app.get('/.well-known/oauth-authorization-server', (req: Request, res: Response) => {
  const base = getBaseUrl(req);
  res.json({
    issuer: base,
    authorization_endpoint: `${base}/oauth/authorize`,
    token_endpoint: `${base}/oauth/token`,
    registration_endpoint: `${base}/oauth/register`,
    grant_types_supported: ['authorization_code', 'client_credentials'],
    token_endpoint_auth_methods_supported: ['client_secret_post', 'none'],
    scopes_supported: ['mcp:read', 'mcp:write'],
    response_types_supported: ['code', 'token'],
    code_challenge_methods_supported: ['S256'],
  });
});

// ── REST API ──────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/boards', boardRoutes);
app.use('/api/boards', groupRoutes);
app.use('/api/boards', itemRoutes);
app.use('/api/boards', columnRoutes);
app.use('/oauth', oauthRoutes);
app.use('/api/oauth', oauthRoutes);
app.use('/api/developer/keys', apiKeyRoutes);

app.get('/api/health', (_req: Request, res: Response) =>
  res.json({ status: 'ok', version: '1.0.0' })
);

// ── MCP: Streamable HTTP (protocol 2025-03-26 — used by Claude.ai, ChatGPT, n8n) ──
// Single endpoint handles GET (SSE stream), POST (messages), DELETE (session end).

const mcpStreamableTransports = new Map<string, StreamableHTTPServerTransport>();

app.all('/mcp', async (req: Request, res: Response) => {
  // OPTIONS pre-flight (CORS) — let it pass through
  if (req.method === 'OPTIONS') { res.sendStatus(204); return; }

  const token = extractToken(req);
  if (!token) {
    const base = getBaseUrl(req);
    res.setHeader('WWW-Authenticate', `Bearer resource_metadata="${base}/.well-known/oauth-protected-resource"`);
    res.status(401).json({ error: 'unauthorized', error_description: 'Authentication required.' });
    return;
  }

  try {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;

    if (sessionId && mcpStreamableTransports.has(sessionId)) {
      // Existing session — reuse transport
      const transport = mcpStreamableTransports.get(sessionId)!;
      await transport.handleRequest(req, res, req.body);
      return;
    }

    // New session — must be an initialize POST
    if (req.method === 'POST' && isInitializeRequest(req.body)) {
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => crypto.randomUUID(),
        onsessioninitialized: (sid) => {
          mcpStreamableTransports.set(sid, transport);
        },
      });
      transport.onclose = () => {
        if (transport.sessionId) mcpStreamableTransports.delete(transport.sessionId);
      };

      const mcpServer = createMcpServer(`http://localhost:${PORT}`, token);
      await mcpServer.connect(transport);
      await transport.handleRequest(req, res, req.body);
      return;
    }

    res.status(400).json({
      jsonrpc: '2.0',
      error: { code: -32000, message: 'Bad Request: start with POST initialize' },
      id: null,
    });
  } catch (err) {
    console.error('MCP Streamable HTTP error:', err);
    if (!res.headersSent) {
      res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: 'Internal server error' }, id: null });
    }
  }
});

// ── MCP: Legacy SSE (protocol 2024-11-05 — kept for older clients) ─────────────
const mcpSseTransports = new Map<string, SSEServerTransport>();

app.get('/mcp/sse', async (req: Request, res: Response) => {
  const token = extractToken(req);
  if (!token) {
    const base = getBaseUrl(req);
    res.setHeader('WWW-Authenticate', `Bearer resource_metadata="${base}/.well-known/oauth-protected-resource"`);
    res.status(401).json({ error: 'unauthorized', error_description: 'Authentication required.' });
    return;
  }

  res.setHeader('X-Accel-Buffering', 'no');
  res.setHeader('Cache-Control', 'no-cache');

  const transport = new SSEServerTransport('/mcp/messages', res);
  const mcpServer = createMcpServer(`http://localhost:${PORT}`, token);

  mcpSseTransports.set(transport.sessionId, transport);
  res.on('close', () => mcpSseTransports.delete(transport.sessionId));

  await mcpServer.connect(transport);
});

app.post('/mcp/messages', async (req: Request, res: Response) => {
  const sessionId = req.query.sessionId as string;
  const transport = mcpSseTransports.get(sessionId);
  if (!transport) {
    res.status(400).json({ error: 'MCP session not found. Connect to /mcp/sse first.' });
    return;
  }
  await transport.handlePostMessage(req, res);
});

// ── MCP info ──────────────────────────────────────────────────────────────────
app.get('/mcp/info', (req: Request, res: Response) => {
  const base = getBaseUrl(req);
  res.json({
    name: 'TaskFlow MCP Server',
    version: '1.0.0',
    transports: {
      streamable_http: `${base}/mcp  (POST/GET/DELETE — modern clients)`,
      sse_legacy: `${base}/mcp/sse  (GET — older clients)`,
    },
    auth: {
      methods: ['OAuth 2.0 Authorization Code + PKCE', 'OAuth 2.0 Client Credentials', 'Bearer API key'],
      oauth_discovery: `${base}/.well-known/oauth-authorization-server`,
    },
    tools: 13,
  });
});

// ── Serve frontend in production ──────────────────────────────────────────────
if (process.env.NODE_ENV === 'production') {
  const frontendDist = path.join(__dirname, '../../frontend/dist');
  app.use(express.static(frontendDist));
  app.get('*', (_req: Request, res: Response) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

// ── Start ─────────────────────────────────────────────────────────────────────
app.use(errorHandler);

initDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`\n🚀 TaskFlow running on port ${PORT}`);
      console.log(`   API:              http://localhost:${PORT}/api/health`);
      console.log(`   MCP (new):        http://localhost:${PORT}/mcp`);
      console.log(`   MCP (legacy SSE): http://localhost:${PORT}/mcp/sse`);
      console.log(`   OAuth:            http://localhost:${PORT}/oauth/token`);
      console.log(`   Discovery:        http://localhost:${PORT}/.well-known/oauth-authorization-server\n`);
    });
  })
  .catch((err) => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });
