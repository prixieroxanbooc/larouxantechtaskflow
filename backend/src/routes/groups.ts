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

router.get('/:boardId/groups', (req: AuthRequest, res: Response) => {
  const db = getDb();
  const groups = db.prepare('SELECT * FROM groups WHERE board_id = ? ORDER BY position').all(req.params.boardId);
  res.json(groups);
});

router.post('/:boardId/groups', (req: AuthRequest, res: Response) => {
  const parsed = GroupSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const db = getDb();
  const maxPos = (db.prepare('SELECT MAX(position) as p FROM groups WHERE board_id = ?').get(req.params.boardId) as any)?.p ?? -1;
  const id = crypto.randomUUID();
  db.prepare('INSERT INTO groups (id, board_id, name, color, position) VALUES (?, ?, ?, ?, ?)')
    .run(id, req.params.boardId, parsed.data.name, parsed.data.color || '#037f4c', parsed.data.position ?? maxPos + 1);

  res.status(201).json(db.prepare('SELECT * FROM groups WHERE id = ?').get(id));
});

router.put('/:boardId/groups/:id', (req: AuthRequest, res: Response) => {
  const parsed = GroupSchema.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const db = getDb();
  const fields = Object.entries(parsed.data).map(([k]) => `${k} = ?`).join(', ');
  const values = [...Object.values(parsed.data), req.params.id, req.params.boardId];
  db.prepare(`UPDATE groups SET ${fields} WHERE id = ? AND board_id = ?`).run(...values);

  res.json(db.prepare('SELECT * FROM groups WHERE id = ?').get(req.params.id));
});

router.delete('/:boardId/groups/:id', (req: AuthRequest, res: Response) => {
  const db = getDb();
  const result = db.prepare('DELETE FROM groups WHERE id = ? AND board_id = ?').run(req.params.id, req.params.boardId);
  if (result.changes === 0) { res.status(404).json({ error: 'Group not found' }); return; }
  res.json({ success: true });
});

export default router;
