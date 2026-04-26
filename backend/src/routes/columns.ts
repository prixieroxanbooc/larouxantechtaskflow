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

router.get('/:boardId/columns', (req: AuthRequest, res: Response) => {
  const db = getDb();
  res.json(db.prepare('SELECT * FROM columns WHERE board_id = ? ORDER BY position').all(req.params.boardId));
});

router.post('/:boardId/columns', (req: AuthRequest, res: Response) => {
  const parsed = ColumnSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const db = getDb();
  const maxPos = (db.prepare('SELECT MAX(position) as p FROM columns WHERE board_id = ?').get(req.params.boardId) as any)?.p ?? -1;
  const id = crypto.randomUUID();
  db.prepare('INSERT INTO columns (id, board_id, name, type, settings, position) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, req.params.boardId, parsed.data.name, parsed.data.type, JSON.stringify(parsed.data.settings || {}), parsed.data.position ?? maxPos + 1);

  res.status(201).json(db.prepare('SELECT * FROM columns WHERE id = ?').get(id));
});

router.put('/:boardId/columns/:id', (req: AuthRequest, res: Response) => {
  const parsed = ColumnSchema.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const db = getDb();
  const data = { ...parsed.data, settings: parsed.data.settings ? JSON.stringify(parsed.data.settings) : undefined };
  const fields = Object.entries(data).filter(([, v]) => v !== undefined).map(([k]) => `${k} = ?`).join(', ');
  const values = Object.entries(data).filter(([, v]) => v !== undefined).map(([, v]) => v as string | number);
  db.prepare(`UPDATE columns SET ${fields} WHERE id = ? AND board_id = ?`).run(...values, req.params.id, req.params.boardId);

  res.json(db.prepare('SELECT * FROM columns WHERE id = ?').get(req.params.id));
});

router.delete('/:boardId/columns/:id', (req: AuthRequest, res: Response) => {
  const db = getDb();
  const result = db.prepare('DELETE FROM columns WHERE id = ? AND board_id = ?').run(req.params.id, req.params.boardId);
  if (result.changes === 0) { res.status(404).json({ error: 'Column not found' }); return; }
  res.json({ success: true });
});

export default router;
