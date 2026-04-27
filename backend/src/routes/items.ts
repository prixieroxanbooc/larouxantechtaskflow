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

router.get('/:boardId/items', async (req: AuthRequest, res: Response) => {
  const db = getDb();
  const { group_id } = req.query;
  const where = group_id ? 'WHERE i.board_id = $1 AND i.group_id = $2' : 'WHERE i.board_id = $1';
  const params: string[] = group_id ? [req.params.boardId, group_id as string] : [req.params.boardId];

  const { rows } = await db.query(`
    SELECT i.*, iv.column_id, iv.value
    FROM items i
    LEFT JOIN item_values iv ON i.id = iv.item_id
    ${where} ORDER BY i.group_id, i.position
  `, params);

  const map: Record<string, Record<string, unknown>> = {};
  for (const row of rows as Record<string, unknown>[]) {
    const rowId = row.id as string;
    if (!map[rowId]) map[rowId] = { id: row.id, name: row.name, group_id: row.group_id, board_id: row.board_id, position: row.position, created_by: row.created_by, created_at: row.created_at, updated_at: row.updated_at, values: {} };
    if (row.column_id) (map[rowId].values as Record<string, unknown>)[row.column_id as string] = row.value;
  }
  res.json(Object.values(map));
});

router.post('/:boardId/items', async (req: AuthRequest, res: Response) => {
  const parsed = ItemSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const db = getDb();
  const { rows: maxRows } = await db.query('SELECT MAX(position) as p FROM items WHERE group_id = $1', [parsed.data.group_id]);
  const maxPos = (maxRows[0]?.p as number | null) ?? -1;
  const id = crypto.randomUUID();
  await db.query(
    'INSERT INTO items (id, board_id, group_id, name, position, created_by) VALUES ($1, $2, $3, $4, $5, $6)',
    [id, req.params.boardId, parsed.data.group_id, parsed.data.name, parsed.data.position ?? maxPos + 1, req.user!.id]
  );

  const { rows } = await db.query(`
    SELECT i.*, iv.column_id, iv.value FROM items i
    LEFT JOIN item_values iv ON i.id = iv.item_id WHERE i.id = $1
  `, [id]);

  const item: Record<string, unknown> = { id, name: parsed.data.name, group_id: parsed.data.group_id, board_id: req.params.boardId, values: {} };
  for (const row of rows as Record<string, unknown>[]) {
    if (row.column_id) (item.values as Record<string, unknown>)[row.column_id as string] = row.value;
  }
  res.status(201).json(item);
});

router.put('/:boardId/items/:id', async (req: AuthRequest, res: Response) => {
  const db = getDb();
  const { name, group_id, position } = req.body;

  if (name !== undefined || group_id !== undefined || position !== undefined) {
    const updates: string[] = [];
    const vals: unknown[] = [];
    let idx = 1;
    if (name !== undefined) { updates.push(`name = $${idx++}`); vals.push(name); }
    if (group_id !== undefined) { updates.push(`group_id = $${idx++}`); vals.push(group_id); }
    if (position !== undefined) { updates.push(`position = $${idx++}`); vals.push(position); }
    updates.push('updated_at = NOW()');
    vals.push(req.params.id, req.params.boardId);
    await db.query(
      `UPDATE items SET ${updates.join(', ')} WHERE id = $${idx++} AND board_id = $${idx}`,
      vals
    );
  }

  const { rows } = await db.query('SELECT * FROM items WHERE id = $1', [req.params.id]);
  res.json(rows[0]);
});

router.put('/:boardId/items/:id/values', async (req: AuthRequest, res: Response) => {
  const parsed = ItemValueSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const db = getDb();
  const vid = crypto.randomUUID();
  const value = typeof parsed.data.value === 'string' ? parsed.data.value : JSON.stringify(parsed.data.value);
  await db.query(`
    INSERT INTO item_values (id, item_id, column_id, value) VALUES ($1, $2, $3, $4)
    ON CONFLICT(item_id, column_id) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
  `, [vid, req.params.id, parsed.data.column_id, value]);

  await db.query("UPDATE items SET updated_at = NOW() WHERE id = $1", [req.params.id]);
  res.json({ item_id: req.params.id, column_id: parsed.data.column_id, value });
});

router.delete('/:boardId/items/:id', async (req: AuthRequest, res: Response) => {
  const db = getDb();
  const result = await db.query('DELETE FROM items WHERE id = $1 AND board_id = $2', [req.params.id, req.params.boardId]);
  if ((result.rowCount ?? 0) === 0) { res.status(404).json({ error: 'Item not found' }); return; }
  res.json({ success: true });
});

router.get('/:boardId/items/:id/comments', async (req: AuthRequest, res: Response) => {
  const db = getDb();
  const { rows } = await db.query(`
    SELECT c.*, u.name as user_name, u.avatar FROM comments c
    JOIN users u ON c.user_id = u.id WHERE c.item_id = $1 ORDER BY c.created_at
  `, [req.params.id]);
  res.json(rows);
});

router.post('/:boardId/items/:id/comments', async (req: AuthRequest, res: Response) => {
  const { text } = req.body;
  if (!text?.trim()) { res.status(400).json({ error: 'Text required' }); return; }
  const db = getDb();
  const id = crypto.randomUUID();
  await db.query('INSERT INTO comments (id, item_id, user_id, text) VALUES ($1, $2, $3, $4)', [id, req.params.id, req.user!.id, text]);
  const { rows } = await db.query('SELECT c.*, u.name as user_name FROM comments c JOIN users u ON c.user_id = u.id WHERE c.id = $1', [id]);
  res.status(201).json(rows[0]);
});

export default router;
