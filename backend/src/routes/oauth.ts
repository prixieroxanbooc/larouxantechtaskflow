import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
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
  owner_id: string;
  created_at: string;
};

type UserRow = {
  id: string;
  email: string;
  name: string;
};

// ── Client Management (requires user JWT auth) ────────────────────────────────

router.get('/clients', authenticate, (req: AuthRequest, res: Response) => {
  const db = getDb();
  const clients = db.prepare(
    'SELECT id, client_id, name, description, created_at FROM oauth_clients WHERE owner_id = ? ORDER BY created_at DESC'
  ).all(req.user!.id);
  res.json(clients);
});

router.post('/clients', authenticate, async (req: AuthRequest, res: Response) => {
  const { name, description } = req.body;
  if (!name?.trim()) { res.status(400).json({ error: 'Name is required' }); return; }

  const db = getDb();
  const id = crypto.randomUUID();
  const client_id = `tf_${crypto.randomUUID().replace(/-/g, '')}`;

  // Generate a strong secret: two UUIDs concatenated (64 hex chars)
  const client_secret_raw =
    crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
  const client_secret_hash = await bcrypt.hash(client_secret_raw, 10);

  db.prepare(
    'INSERT INTO oauth_clients (id, client_id, client_secret_hash, name, description, owner_id) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, client_id, client_secret_hash, name.trim(), description?.trim() || '', req.user!.id);

  res.status(201).json({
    id,
    client_id,
    client_secret: client_secret_raw,
    name: name.trim(),
    description: description?.trim() || '',
    created_at: new Date().toISOString(),
    _warning: 'Save the client_secret NOW — it will never be shown again.',
  });
});

router.delete('/clients/:id', authenticate, (req: AuthRequest, res: Response) => {
  const db = getDb();
  const result = db.prepare(
    'DELETE FROM oauth_clients WHERE id = ? AND owner_id = ?'
  ).run(req.params.id, req.user!.id);
  if (result.changes === 0) { res.status(404).json({ error: 'Client not found' }); return; }
  res.json({ success: true });
});

// ── Token Endpoint (OAuth 2.0 Client Credentials Grant) ──────────────────────

router.post('/token', async (req: Request, res: Response) => {
  // Accept both application/json and application/x-www-form-urlencoded
  const body = req.body as Record<string, string>;
  const { grant_type, client_id, client_secret } = body;

  if (grant_type !== 'client_credentials') {
    res.status(400).json({
      error: 'unsupported_grant_type',
      error_description: 'Only client_credentials grant type is supported',
    });
    return;
  }

  if (!client_id || !client_secret) {
    res.status(400).json({
      error: 'invalid_request',
      error_description: 'client_id and client_secret are required',
    });
    return;
  }

  const db = getDb();
  const client = db.prepare(
    'SELECT id, client_id, client_secret_hash, owner_id, name FROM oauth_clients WHERE client_id = ?'
  ).get(client_id) as OAuthClientRow | undefined;

  if (!client || !(await bcrypt.compare(client_secret, client.client_secret_hash))) {
    res.status(401).json({
      error: 'invalid_client',
      error_description: 'Invalid client_id or client_secret',
    });
    return;
  }

  const owner = db.prepare(
    'SELECT id, email, name FROM users WHERE id = ?'
  ).get(client.owner_id) as UserRow | undefined;

  if (!owner) {
    res.status(401).json({
      error: 'invalid_client',
      error_description: 'Client owner account not found',
    });
    return;
  }

  // Issue a JWT that embeds the owner's identity so existing API middleware works
  const access_token = jwt.sign(
    {
      id: owner.id,
      email: owner.email,
      name: owner.name,
      oauth_client_id: client.client_id,
      oauth_client_name: client.name,
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  res.json({
    access_token,
    token_type: 'Bearer',
    expires_in: 86400,
    scope: 'mcp:read mcp:write',
  });
});

export default router;
