import { Router, Response } from 'express';
import { z } from 'zod';
import { getDb } from '../db/database';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router({ mergeParams: true });
router.use(authenticate);

const ItemSchema = z.object({
  name: z.string().min(1),
  group_id: z.string(),
  position: z.number().optional(),
});

const ItemValueSchema = z.object({
  column_id: z.string(),
  value: z.any(),
});

router.get('/:boardId/items', (req: AuthRequest, res: Response) => {
  const db = getDb();
  const { group_id } = req.query;
  const where = group_id ? 'WHERE i.board_id = ? AND i.group_id = ?' : 'WHERE i.board_id = ?';
  const params: string[] = group_id ? [req.params.boardId, group_id as string] : [req.params.boardId];

  const rows = db.prepare(`
    SELECT i.*, iv.column_id, iv.value
    FROM items i
    LEFT JOIN item_values iv ON i.id = iv.item_id
    ${where} ORDER BY i.group_id, i.position
  `).all(...params) as any[];

  const map: Record<string, any> = {};
  for (const row of rows) {
    if (!map[row.id]) map[row.id] = { id: row.id, name: row.name, group_id: row.group_id, board_id: row.board_id, position: row.position, created_by: row.created_by, created_at: row.created_at, updated_at: row.updated_at, values: {} };
    if (row.column_id) map[row.id].values[row.column_id] = row.value;
  }
  res.json(Object.values(map));
});

router.post('/:boardId/items', (req: AuthRequest, res: Response) => {
  const parsed = ItemSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const db = getDb();
  const maxPos = (db.prepare('SELECT MAX(position) as p FROM items WHERE group_id = ?').get(parsed.data.group_id) as any)?.p ?? -1;
  const id = crypto.randomUUID();
  db.prepare('INSERT INTO items (id, board_id, group_id, name, position, created_by) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, req.params.boardId, parsed.data.group_id, parsed.data.name, parsed.data.position ?? maxPos + 1, req.user!.id);

  const rows = db.prepare(`
    SELECT i.*, iv.column_id, iv.value FROM items i
    LEFT JOIN item_values iv ON i.id = iv.item_id WHERE i.id = ?
  `).all(id) as any[];

  const item: any = { id, name: parsed.data.name, group_id: parsed.data.group_id, board_id: req.params.boardId, values: {} };
  for (const row of rows) {
    if (row.column_id) item.values[row.column_id] = row.value;
  }
  res.status(201).json(item);
});

router.put('/:boardId/items/:id', (req: AuthRequest, res: Response) => {
  const db = getDb();
  const { name, group_id, position } = req.body;

  if (name !== undefined || group_id !== undefined || position !== undefined) {
    const updates: string[] = [];
    const vals: any[] = [];
    if (name !== undefined) { updates.push('name = ?'); vals.push(name); }
    if (group_id !== undefined) { updates.push('group_id = ?'); vals.push(group_id); }
    if (position !== undefined) { updates.push('position = ?'); vals.push(position); }
    updates.push("updated_at = datetime('now')");
    db.prepare(`UPDATE items SET ${updates.join(', ')} WHERE id = ? AND board_id = ?`).run(...vals, req.params.id, req.params.boardId);
  }

  res.json(db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id));
});

router.put('/:boardId/items/:id/values', (req: AuthRequest, res: Response) => {
  const parsed = ItemValueSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const db = getDb();
  const vid = crypto.randomUUID();
  const value = typeof parsed.data.value === 'string' ? parsed.data.value : JSON.stringify(parsed.data.value);
  db.prepare(`
    INSERT INTO item_values (id, item_id, column_id, value) VALUES (?, ?, ?, ?)
    ON CONFLICT(item_id, column_id) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
  `).run(vid, req.params.id, parsed.data.column_id, value);

  db.prepare("UPDATE items SET updated_at = datetime('now') WHERE id = ?").run(req.params.id);
  res.json({ item_id: req.params.id, column_id: parsed.data.column_id, value });
});

router.delete('/:boardId/items/:id', (req: AuthRequest, res: Response) => {
  const db = getDb();
  const result = db.prepare('DELETE FROM items WHERE id = ? AND board_id = ?').run(req.params.id, req.params.boardId);
  if (result.changes === 0) { res.status(404).json({ error: 'Item not found' }); return; }
  res.json({ success: true });
});

router.get('/:boardId/items/:id/comments', (req: AuthRequest, res: Response) => {
  const db = getDb();
  const comments = db.prepare(`
    SELECT c.*, u.name as user_name, u.avatar FROM comments c
    JOIN users u ON c.user_id = u.id WHERE c.item_id = ? ORDER BY c.created_at
  `).all(req.params.id);
  res.json(comments);
});

router.post('/:boardId/items/:id/comments', (req: AuthRequest, res: Response) => {
  const { text } = req.body;
  if (!text?.trim()) { res.status(400).json({ error: 'Text required' }); return; }
  const db = getDb();
  const id = crypto.randomUUID();
  db.prepare('INSERT INTO comments (id, item_id, user_id, text) VALUES (?, ?, ?, ?)').run(id, req.params.id, req.user!.id, text);
  const comment = db.prepare('SELECT c.*, u.name as user_name FROM comments c JOIN users u ON c.user_id = u.id WHERE c.id = ?').get(id);
  res.status(201).json(comment);
});

export default router;
