import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createHash } from 'crypto';
import { getDb } from '../db/database';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET || 'taskflow-secret-key-change-in-production';

type OAuthClientRow = {
  id: string;
  client_id: string;
  client_secret_hash: string;
  name: string;
  description: string;
  redirect_uris: string;
  owner_id: string;
  created_at: string;
};

type UserRow = {
  id: string;
  email: string;
  name: string;
  password_hash: string;
};

// ── In-memory Authorization Code store (expires in 10 min) ───────────────────

interface PendingCode {
  clientId: string;
  userId: string;
  redirectUri: string;
  scope: string;
  codeChallenge?: string;
  codeChallengeMethod?: string;
  expiresAt: number;
}
const pendingCodes = new Map<string, PendingCode>();
setInterval(() => {
  const now = Date.now();
  for (const [code, data] of pendingCodes) {
    if (data.expiresAt < now) pendingCodes.delete(code);
  }
}, 60_000);

// ── Client Management (requires user JWT auth) ────────────────────────────────

router.get('/clients', authenticate, async (req: AuthRequest, res: Response) => {
  const db = getDb();
  const { rows } = await db.query(
    'SELECT id, client_id, name, description, redirect_uris, created_at FROM oauth_clients WHERE owner_id = $1 ORDER BY created_at DESC',
    [req.user!.id]
  );
  res.json(rows);
});

router.post('/clients', authenticate, async (req: AuthRequest, res: Response) => {
  const { name, description, redirect_uris } = req.body;
  if (!name?.trim()) { res.status(400).json({ error: 'Name is required' }); return; }

  const db = getDb();
  const id = crypto.randomUUID();
  const client_id = `tf_${crypto.randomUUID().replace(/-/g, '')}`;

  const client_secret_raw =
    crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
  const client_secret_hash = await bcrypt.hash(client_secret_raw, 10);

  const uris = (redirect_uris ?? '').trim();

  await db.query(
    'INSERT INTO oauth_clients (id, client_id, client_secret_hash, name, description, redirect_uris, owner_id) VALUES ($1, $2, $3, $4, $5, $6, $7)',
    [id, client_id, client_secret_hash, name.trim(), description?.trim() || '', uris, req.user!.id]
  );

  res.status(201).json({
    id,
    client_id,
    client_secret: client_secret_raw,
    name: name.trim(),
    description: description?.trim() || '',
    redirect_uris: uris,
    created_at: new Date().toISOString(),
    _warning: 'Save the client_secret NOW — it will never be shown again.',
  });
});

router.patch('/clients/:id', authenticate, async (req: AuthRequest, res: Response) => {
  const { redirect_uris } = req.body;
  if (redirect_uris === undefined) { res.status(400).json({ error: 'redirect_uris is required' }); return; }

  const db = getDb();
  const result = await db.query(
    'UPDATE oauth_clients SET redirect_uris = $1 WHERE id = $2 AND owner_id = $3',
    [(redirect_uris ?? '').trim(), req.params.id, req.user!.id]
  );
  if ((result.rowCount ?? 0) === 0) { res.status(404).json({ error: 'Client not found' }); return; }
  res.json({ success: true });
});

router.delete('/clients/:id', authenticate, async (req: AuthRequest, res: Response) => {
  const db = getDb();
  const result = await db.query(
    'DELETE FROM oauth_clients WHERE id = $1 AND owner_id = $2',
    [req.params.id, req.user!.id]
  );
  if ((result.rowCount ?? 0) === 0) { res.status(404).json({ error: 'Client not found' }); return; }
  res.json({ success: true });
});

// ── Authorization Endpoint (Authorization Code + PKCE flow) ──────────────────

function authorizePage(opts: {
  clientName: string;
  scope: string;
  error?: string;
  params: Record<string, string>;
}): string {
  const { clientName, scope, error, params } = opts;
  const hiddenFields = Object.entries(params)
    .map(([k, v]) => `<input type="hidden" name="${k}" value="${v.replace(/"/g, '&quot;')}">`)
    .join('\n    ');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Authorize – TaskFlow</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f4f6f8;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:16px}
    .card{background:#fff;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,.1);width:100%;max-width:400px;overflow:hidden}
    .header{background:#0073ea;padding:24px;text-align:center}
    .header h1{color:#fff;font-size:20px;font-weight:700}
    .header p{color:rgba(255,255,255,.8);font-size:13px;margin-top:4px}
    .body{padding:28px}
    .app-badge{display:flex;align-items:center;gap:10px;background:#f4f6f8;border-radius:10px;padding:12px 16px;margin-bottom:20px}
    .app-icon{width:36px;height:36px;background:#0073ea;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:18px;flex-shrink:0}
    .app-name{font-weight:600;font-size:14px;color:#1f2937}
    .app-sub{font-size:12px;color:#6b7280;margin-top:2px}
    .scopes{font-size:12px;color:#6b7280;margin-bottom:20px;padding:10px 14px;background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb}
    .scopes strong{color:#374151}
    label{display:block;font-size:13px;font-weight:500;color:#374151;margin-bottom:5px}
    input[type=email],input[type=password]{width:100%;border:1.5px solid #d1d5db;border-radius:8px;padding:10px 12px;font-size:14px;outline:none;transition:border-color .15s}
    input[type=email]:focus,input[type=password]:focus{border-color:#0073ea;box-shadow:0 0 0 3px rgba(0,115,234,.12)}
    .field{margin-bottom:14px}
    .error{background:#fef2f2;border:1px solid #fecaca;color:#dc2626;font-size:13px;border-radius:8px;padding:10px 14px;margin-bottom:16px}
    .btn{width:100%;background:#0073ea;color:#fff;border:none;border-radius:8px;padding:11px;font-size:14px;font-weight:600;cursor:pointer;margin-top:4px;transition:background .15s}
    .btn:hover{background:#0061c2}
    .footer{text-align:center;font-size:12px;color:#9ca3af;padding:16px;border-top:1px solid #f3f4f6}
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>TaskFlow</h1>
      <p>Authorization Request</p>
    </div>
    <div class="body">
      <div class="app-badge">
        <div class="app-icon">🔑</div>
        <div>
          <div class="app-name">${clientName}</div>
          <div class="app-sub">is requesting access to your account</div>
        </div>
      </div>
      <div class="scopes"><strong>Permissions:</strong> ${scope || 'mcp:read mcp:write'}</div>
      ${error ? `<div class="error">${error}</div>` : ''}
      <form method="POST" action="/oauth/authorize">
        ${hiddenFields}
        <div class="field">
          <label for="email">Email</label>
          <input type="email" id="email" name="email" placeholder="you@example.com" required autofocus>
        </div>
        <div class="field">
          <label for="password">Password</label>
          <input type="password" id="password" name="password" placeholder="••••••••" required>
        </div>
        <button type="submit" class="btn">Sign in &amp; Authorize</button>
      </form>
    </div>
    <div class="footer">TaskFlow will only share your data with authorized MCP clients.</div>
  </div>
</body>
</html>`;
}

router.get('/authorize', async (req: Request, res: Response) => {
  const { response_type, client_id, redirect_uri, scope, state, code_challenge, code_challenge_method, error } =
    req.query as Record<string, string>;

  if (response_type !== 'code') {
    res.status(400).send('Only response_type=code is supported');
    return;
  }
  if (!client_id) {
    res.status(400).send('client_id is required');
    return;
  }

  const db = getDb();
  const { rows } = await db.query(
    'SELECT name, redirect_uris FROM oauth_clients WHERE client_id = $1',
    [client_id]
  );
  const client = rows[0] as { name: string; redirect_uris: string } | undefined;

  if (!client) {
    res.status(400).send('Unknown client_id');
    return;
  }

  const allowedUris = (client.redirect_uris || '')
    .split('\n')
    .map((u: string) => u.trim())
    .filter(Boolean);

  if (redirect_uri && allowedUris.length > 0 && !allowedUris.includes(redirect_uri)) {
    res.status(400).send('redirect_uri not registered for this client');
    return;
  }

  const params: Record<string, string> = { client_id, scope: scope || '' };
  if (redirect_uri) params.redirect_uri = redirect_uri;
  if (state) params.state = state;
  if (code_challenge) params.code_challenge = code_challenge;
  if (code_challenge_method) params.code_challenge_method = code_challenge_method;

  res.send(
    authorizePage({
      clientName: client.name,
      scope: scope || 'mcp:read mcp:write',
      error: error || undefined,
      params,
    })
  );
});

router.post('/authorize', async (req: Request, res: Response) => {
  const { email, password, client_id, redirect_uri, scope, state, code_challenge, code_challenge_method } =
    req.body as Record<string, string>;

  const db = getDb();

  // Verify client still exists and re-check redirect_uri
  const { rows: clientRows } = await db.query(
    'SELECT name, redirect_uris FROM oauth_clients WHERE client_id = $1',
    [client_id]
  );
  const client = clientRows[0] as { name: string; redirect_uris: string } | undefined;

  const errorRedirect = (msg: string) => {
    const params = new URLSearchParams({ response_type: 'code', client_id, scope, error: msg });
    if (redirect_uri) params.set('redirect_uri', redirect_uri);
    if (state) params.set('state', state);
    if (code_challenge) params.set('code_challenge', code_challenge);
    if (code_challenge_method) params.set('code_challenge_method', code_challenge_method);
    res.redirect(`/oauth/authorize?${params}`);
  };

  if (!client) { errorRedirect('Unknown client'); return; }

  // Verify user credentials
  const { rows: userRows } = await db.query(
    'SELECT id, email, name, password_hash FROM users WHERE email = $1',
    [email?.toLowerCase()?.trim()]
  );
  const user = userRows[0] as UserRow | undefined;

  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    errorRedirect('Invalid email or password');
    return;
  }

  // Issue authorization code
  const code = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
  pendingCodes.set(code, {
    clientId: client_id,
    userId: user.id,
    redirectUri: redirect_uri || '',
    scope: scope || 'mcp:read mcp:write',
    codeChallenge: code_challenge || undefined,
    codeChallengeMethod: code_challenge_method || undefined,
    expiresAt: Date.now() + 10 * 60 * 1000,
  });

  const callbackUrl = new URL(redirect_uri || 'urn:ietf:wg:oauth:2.0:oob');
  callbackUrl.searchParams.set('code', code);
  if (state) callbackUrl.searchParams.set('state', state);

  res.redirect(callbackUrl.toString());
});

// ── Token Endpoint ────────────────────────────────────────────────────────────

router.post('/token', async (req: Request, res: Response) => {
  const body = req.body as Record<string, string>;
  const { grant_type } = body;

  // ── Authorization Code Grant ──────────────────────────────────────────────
  if (grant_type === 'authorization_code') {
    const { code, redirect_uri, client_id, client_secret, code_verifier } = body;

    if (!code || !client_id) {
      res.status(400).json({ error: 'invalid_request', error_description: 'code and client_id are required' });
      return;
    }

    const pending = pendingCodes.get(code);
    if (!pending || pending.expiresAt < Date.now()) {
      res.status(400).json({ error: 'invalid_grant', error_description: 'Authorization code expired or invalid' });
      return;
    }

    if (pending.clientId !== client_id) {
      res.status(400).json({ error: 'invalid_grant', error_description: 'client_id mismatch' });
      return;
    }

    if (redirect_uri && pending.redirectUri && pending.redirectUri !== redirect_uri) {
      res.status(400).json({ error: 'invalid_grant', error_description: 'redirect_uri mismatch' });
      return;
    }

    // Verify PKCE (S256) if challenge was set
    if (pending.codeChallenge) {
      if (!code_verifier) {
        res.status(400).json({ error: 'invalid_grant', error_description: 'code_verifier required' });
        return;
      }
      const expected = createHash('sha256').update(code_verifier).digest('base64url');
      if (expected !== pending.codeChallenge) {
        res.status(400).json({ error: 'invalid_grant', error_description: 'Invalid code_verifier' });
        return;
      }
    }

    // Optionally verify client_secret if provided (for confidential clients)
    if (client_secret) {
      const db = getDb();
      const { rows } = await db.query(
        'SELECT client_secret_hash FROM oauth_clients WHERE client_id = $1',
        [client_id]
      );
      const clientRow = rows[0] as { client_secret_hash: string } | undefined;
      if (!clientRow || !(await bcrypt.compare(client_secret, clientRow.client_secret_hash))) {
        res.status(401).json({ error: 'invalid_client', error_description: 'Invalid client_secret' });
        return;
      }
    }

    pendingCodes.delete(code);

    const db = getDb();
    const { rows: userRows } = await db.query(
      'SELECT id, email, name FROM users WHERE id = $1',
      [pending.userId]
    );
    const user = userRows[0] as UserRow | undefined;

    if (!user) {
      res.status(400).json({ error: 'invalid_grant', error_description: 'User not found' });
      return;
    }

    const access_token = jwt.sign(
      { id: user.id, email: user.email, name: user.name, oauth_client_id: client_id },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({ access_token, token_type: 'Bearer', expires_in: 86400, scope: pending.scope });
    return;
  }

  // ── Client Credentials Grant ──────────────────────────────────────────────
  if (grant_type === 'client_credentials') {
    const { client_id, client_secret } = body;

    if (!client_id || !client_secret) {
      res.status(400).json({ error: 'invalid_request', error_description: 'client_id and client_secret are required' });
      return;
    }

    const db = getDb();
    const { rows: clientRows } = await db.query(
      'SELECT id, client_id, client_secret_hash, owner_id, name FROM oauth_clients WHERE client_id = $1',
      [client_id]
    );
    const client = clientRows[0] as OAuthClientRow | undefined;

    if (!client || !(await bcrypt.compare(client_secret, client.client_secret_hash))) {
      res.status(401).json({ error: 'invalid_client', error_description: 'Invalid client_id or client_secret' });
      return;
    }

    const { rows: ownerRows } = await db.query(
      'SELECT id, email, name FROM users WHERE id = $1',
      [client.owner_id]
    );
    const owner = ownerRows[0] as UserRow | undefined;

    if (!owner) {
      res.status(401).json({ error: 'invalid_client', error_description: 'Client owner account not found' });
      return;
    }

    const access_token = jwt.sign(
      { id: owner.id, email: owner.email, name: owner.name, oauth_client_id: client.client_id, oauth_client_name: client.name },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({ access_token, token_type: 'Bearer', expires_in: 86400, scope: 'mcp:read mcp:write' });
    return;
  }

  res.status(400).json({
    error: 'unsupported_grant_type',
    error_description: 'Supported grant types: authorization_code, client_credentials',
  });
});

export default router;
