import { Router, Response } from 'express';
import { z } from 'zod';
import { getDb } from '../db/database';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router({ mergeParams: true });
router.use(authenticate);

const GroupSchema = z.object({
  name: z.string().min(1),
  color: z.string().optional(),
  position: z.number().optional(),
});

router.get('/:boardId/groups', async (req: AuthRequest, res: Response) => {
  const db = getDb();
  const { rows } = await db.query('SELECT * FROM groups WHERE board_id = $1 ORDER BY position', [req.params.boardId]);
  res.json(rows);
});

router.post('/:boardId/groups', async (req: AuthRequest, res: Response) => {
  const parsed = GroupSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const db = getDb();
  const { rows: maxRows } = await db.query('SELECT MAX(position) as p FROM groups WHERE board_id = $1', [req.params.boardId]);
  const maxPos = (maxRows[0]?.p as number | null) ?? -1;
  const id = crypto.randomUUID();
  await db.query(
    'INSERT INTO groups (id, board_id, name, color, position) VALUES ($1, $2, $3, $4, $5)',
    [id, req.params.boardId, parsed.data.name, parsed.data.color || '#037f4c', parsed.data.position ?? maxPos + 1]
  );

  const { rows } = await db.query('SELECT * FROM groups WHERE id = $1', [id]);
  res.status(201).json(rows[0]);
});

router.put('/:boardId/groups/:id', async (req: AuthRequest, res: Response) => {
  const parsed = GroupSchema.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const db = getDb();
  const entries = Object.entries(parsed.data);
  const setClauses = entries.map(([k], i) => `"${k}" = $${i + 1}`).join(', ');
  const values = [...entries.map(([, v]) => v), req.params.id, req.params.boardId];
  await db.query(
    `UPDATE groups SET ${setClauses} WHERE id = $${entries.length + 1} AND board_id = $${entries.length + 2}`,
    values
  );

  const { rows } = await db.query('SELECT * FROM groups WHERE id = $1', [req.params.id]);
  res.json(rows[0]);
});

router.delete('/:boardId/groups/:id', async (req: AuthRequest, res: Response) => {
  const db = getDb();
  const result = await db.query('DELETE FROM groups WHERE id = $1 AND board_id = $2', [req.params.id, req.params.boardId]);
  if ((result.rowCount ?? 0) === 0) { res.status(404).json({ error: 'Group not found' }); return; }
  res.json({ success: true });
});

export default router;
