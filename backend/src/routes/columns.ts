import { Router, Response } from 'express';
import { z } from 'zod';
import { getDb } from '../db/database';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router({ mergeParams: true });
router.use(authenticate);

const ColumnSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['text', 'status', 'date', 'person', 'number', 'checkbox', 'url', 'email', 'phone']),
  settings: z.record(z.any()).optional(),
  position: z.number().optional(),
});

router.get('/:boardId/columns', async (req: AuthRequest, res: Response) => {
  const db = getDb();
  const { rows } = await db.query('SELECT * FROM columns WHERE board_id = $1 ORDER BY position', [req.params.boardId]);
  res.json(rows);
});

router.post('/:boardId/columns', async (req: AuthRequest, res: Response) => {
  const parsed = ColumnSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const db = getDb();
  const { rows: maxRows } = await db.query('SELECT MAX(position) as p FROM columns WHERE board_id = $1', [req.params.boardId]);
  const maxPos = (maxRows[0]?.p as number | null) ?? -1;
  const id = crypto.randomUUID();
  await db.query(
    'INSERT INTO columns (id, board_id, name, type, settings, position) VALUES ($1, $2, $3, $4, $5, $6)',
    [id, req.params.boardId, parsed.data.name, parsed.data.type, JSON.stringify(parsed.data.settings || {}), parsed.data.position ?? maxPos + 1]
  );

  const { rows } = await db.query('SELECT * FROM columns WHERE id = $1', [id]);
  res.status(201).json(rows[0]);
});

router.put('/:boardId/columns/:id', async (req: AuthRequest, res: Response) => {
  const parsed = ColumnSchema.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const db = getDb();
  const data = { ...parsed.data, settings: parsed.data.settings ? JSON.stringify(parsed.data.settings) : undefined };
  const filteredEntries = Object.entries(data).filter(([, v]) => v !== undefined);
  const setClauses = filteredEntries.map(([k], i) => `"${k}" = $${i + 1}`).join(', ');
  const values = [...filteredEntries.map(([, v]) => v), req.params.id, req.params.boardId];
  await db.query(
    `UPDATE columns SET ${setClauses} WHERE id = $${filteredEntries.length + 1} AND board_id = $${filteredEntries.length + 2}`,
    values
  );

  const { rows } = await db.query('SELECT * FROM columns WHERE id = $1', [req.params.id]);
  res.json(rows[0]);
});

router.delete('/:boardId/columns/:id', async (req: AuthRequest, res: Response) => {
  const db = getDb();
  const result = await db.query('DELETE FROM columns WHERE id = $1 AND board_id = $2', [req.params.id, req.params.boardId]);
  if ((result.rowCount ?? 0) === 0) { res.status(404).json({ error: 'Column not found' }); return; }
  res.json({ success: true });
});

export default router;
