import { Router, Response } from 'express';
import { getDb } from '../db/database';
import { authenticate, AuthRequest, hashApiKey } from '../middleware/auth';

const router = Router();
router.use(authenticate);

type ApiKeyRow = {
  id: string;
  key_prefix: string;
  name: string;
  last_used_at: string | null;
  created_at: string;
};

// List current user's API keys (never returns the full key)
router.get('/', (req: AuthRequest, res: Response) => {
  const db = getDb();
  const keys = db.prepare(`
    SELECT id, key_prefix, name, last_used_at, created_at
    FROM api_keys WHERE user_id = ? ORDER BY created_at DESC
  `).all(req.user!.id) as ApiKeyRow[];
  res.json(keys);
});

// Create a new API key — full key shown ONCE in the response
router.post('/', (req: AuthRequest, res: Response) => {
  const { name } = req.body;
  if (!name?.trim()) { res.status(400).json({ error: 'Name is required' }); return; }

  const db = getDb();

  // Build key: tf_live_ + 48 random hex chars
  const rawBytes = crypto.getRandomValues(new Uint8Array(24));
  const rawHex = Array.from(rawBytes).map((b) => b.toString(16).padStart(2, '0')).join('');
  const fullKey = `tf_live_${rawHex}`;
  const keyPrefix = fullKey.slice(0, 16) + '…'; // "tf_live_xxxxxxxx…"

  const id = crypto.randomUUID();
  const keyHash = hashApiKey(fullKey);

  db.prepare(
    'INSERT INTO api_keys (id, key_prefix, key_hash, name, user_id) VALUES (?, ?, ?, ?, ?)'
  ).run(id, keyPrefix, keyHash, name.trim(), req.user!.id);

  res.status(201).json({
    id,
    key: fullKey,            // shown ONCE — never stored in plaintext
    key_prefix: keyPrefix,
    name: name.trim(),
    created_at: new Date().toISOString(),
    _warning: 'Save this key now — it cannot be retrieved again.',
  });
});

// Revoke (delete) an API key
router.delete('/:id', (req: AuthRequest, res: Response) => {
  const db = getDb();
  const result = db.prepare(
    'DELETE FROM api_keys WHERE id = ? AND user_id = ?'
  ).run(req.params.id, req.user!.id);
  if (result.changes === 0) { res.status(404).json({ error: 'API key not found' }); return; }
  res.json({ success: true });
});

export default router;
