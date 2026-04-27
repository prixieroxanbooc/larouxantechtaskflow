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

router.get('/', async (req: AuthRequest, res: Response) => {
  const db = getDb();
  const { rows } = await db.query(`
    SELECT id, key_prefix, name, last_used_at, created_at
    FROM api_keys WHERE user_id = $1 ORDER BY created_at DESC
  `, [req.user!.id]);
  res.json(rows as ApiKeyRow[]);
});

router.post('/', async (req: AuthRequest, res: Response) => {
  const { name } = req.body;
  if (!name?.trim()) { res.status(400).json({ error: 'Name is required' }); return; }

  const db = getDb();

  const rawBytes = crypto.getRandomValues(new Uint8Array(24));
  const rawHex = Array.from(rawBytes).map((b) => b.toString(16).padStart(2, '0')).join('');
  const fullKey = `tf_live_${rawHex}`;
  const keyPrefix = fullKey.slice(0, 16) + '…';

  const id = crypto.randomUUID();
  const keyHash = hashApiKey(fullKey);

  await db.query(
    'INSERT INTO api_keys (id, key_prefix, key_hash, name, user_id) VALUES ($1, $2, $3, $4, $5)',
    [id, keyPrefix, keyHash, name.trim(), req.user!.id]
  );

  res.status(201).json({
    id,
    key: fullKey,
    key_prefix: keyPrefix,
    name: name.trim(),
    created_at: new Date().toISOString(),
    _warning: 'Save this key now — it cannot be retrieved again.',
  });
});

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  const db = getDb();
  const result = await db.query(
    'DELETE FROM api_keys WHERE id = $1 AND user_id = $2',
    [req.params.id, req.user!.id]
  );
  if ((result.rowCount ?? 0) === 0) { res.status(404).json({ error: 'API key not found' }); return; }
  res.json({ success: true });
});

export default router;
