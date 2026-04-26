import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
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

app.use(cors({ origin: '*', credentials: false }));
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // needed for OAuth form-encoded requests

// ── OAuth well-known discovery (root level, MCP spec requirement) ─────────────
app.get('/.well-known/oauth-authorization-server', (req: Request, res: Response) => {
  const base = `${req.protocol}://${req.get('host')}`;
  res.json({
    issuer: base,
    token_endpoint: `${base}/oauth/token`,
    grant_types_supported: ['client_credentials'],
    token_endpoint_auth_methods_supported: ['client_secret_post'],
    scopes_supported: ['mcp:read', 'mcp:write'],
    response_types_supported: ['token'],
  });
});

// ── REST API ─────────────────────────────────────────────────────────────────
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

// ── MCP SSE Server ───────────────────────────────────────────────────────────
const mcpTransports = new Map<string, SSEServerTransport>();

// Accepts:
//   • User JWT      → ?token=... or Authorization: Bearer ...
//   • OAuth token   → same (POST /oauth/token first to get one)
app.get('/mcp/sse', async (req: Request, res: Response) => {
  const token =
    (req.query.token as string) ||
    req.headers.authorization?.replace(/^Bearer\s+/i, '') ||
    '';

  const transport = new SSEServerTransport('/mcp/messages', res);
  const mcpServer = createMcpServer(`http://localhost:${PORT}`, token);

  mcpTransports.set(transport.sessionId, transport);
  res.on('close', () => mcpTransports.delete(transport.sessionId));

  await mcpServer.connect(transport);
});

app.post('/mcp/messages', async (req: Request, res: Response) => {
  const sessionId = req.query.sessionId as string;
  const transport = mcpTransports.get(sessionId);
  if (!transport) {
    res.status(400).json({ error: 'MCP session not found. Connect to /mcp/sse first.' });
    return;
  }
  await transport.handlePostMessage(req, res);
});

// MCP info endpoint
app.get('/mcp', (req: Request, res: Response) => {
  const base = `${req.protocol}://${req.get('host')}`;
  res.json({
    name: 'TaskFlow MCP Server',
    version: '1.0.0',
    transport: 'SSE + stdio',
    endpoints: {
      sse: `${base}/mcp/sse`,
      messages: `${base}/mcp/messages`,
      oauth_token: `${base}/oauth/token`,
      oauth_discovery: `${base}/.well-known/oauth-authorization-server`,
    },
    auth: {
      methods: ['OAuth 2.0 Client Credentials', 'User JWT Bearer token'],
      token_endpoint: `${base}/oauth/token`,
      grant_type: 'client_credentials',
    },
    tools: 13,
  });
});

// ── Serve frontend in production ─────────────────────────────────────────────
if (process.env.NODE_ENV === 'production') {
  const frontendDist = path.join(__dirname, '../../frontend/dist');
  app.use(express.static(frontendDist));
  app.get('*', (_req: Request, res: Response) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

// ── Start ────────────────────────────────────────────────────────────────────
app.use(errorHandler);

initDatabase();
app.listen(PORT, () => {
  console.log(`\n🚀 TaskFlow running on port ${PORT}`);
  console.log(`   API:        http://localhost:${PORT}/api/health`);
  console.log(`   MCP SSE:    http://localhost:${PORT}/mcp/sse`);
  console.log(`   OAuth:      http://localhost:${PORT}/oauth/token`);
  console.log(`   Discovery:  http://localhost:${PORT}/.well-known/oauth-authorization-server`);
  console.log(`   MCP Info:   http://localhost:${PORT}/mcp\n`);
});
