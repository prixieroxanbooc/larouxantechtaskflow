import { Router, Response } from 'express';
import { z } from 'zod';
import { getDb } from '../db/database';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

const BoardSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
});

router.get('/', (req: AuthRequest, res: Response) => {
  const db = getDb();
  const boards = db.prepare(`
    SELECT b.*, u.name as owner_name
    FROM boards b
    JOIN users u ON b.owner_id = u.id
    LEFT JOIN board_members bm ON b.id = bm.board_id
    WHERE b.owner_id = ? OR bm.user_id = ?
    GROUP BY b.id
    ORDER BY b.created_at DESC
  `).all(req.user!.id, req.user!.id);
  res.json(boards);
});

router.post('/', (req: AuthRequest, res: Response) => {
  const parsed = BoardSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const db = getDb();
  const id = crypto.randomUUID();
  const { name, description = '', color = '#0073ea', icon = '📋' } = parsed.data;

  db.prepare('INSERT INTO boards (id, name, description, owner_id, color, icon) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, name, description, req.user!.id, color, icon);

  // Add default group and columns
  const groupId = crypto.randomUUID();
  db.prepare('INSERT INTO groups (id, board_id, name, color, position) VALUES (?, ?, ?, ?, ?)')
    .run(groupId, id, 'Main Group', '#037f4c', 0);

  const defaultColumns = [
    { name: 'Status', type: 'status', settings: JSON.stringify({ options: [{ label: 'Working on it', color: '#fdab3d' }, { label: 'Done', color: '#00c875' }, { label: 'Stuck', color: '#e2445c' }] }) },
    { name: 'Owner', type: 'person', settings: '{}' },
    { name: 'Due Date', type: 'date', settings: '{}' },
  ];
  defaultColumns.forEach((col, i) => {
    db.prepare('INSERT INTO columns (id, board_id, name, type, settings, position) VALUES (?, ?, ?, ?, ?, ?)')
      .run(crypto.randomUUID(), id, col.name, col.type, col.settings, i);
  });

  const board = db.prepare('SELECT * FROM boards WHERE id = ?').get(id);
  res.status(201).json(board);
});

router.get('/:id', (req: AuthRequest, res: Response) => {
  const db = getDb();
  const board = db.prepare(`
    SELECT b.*, u.name as owner_name
    FROM boards b JOIN users u ON b.owner_id = u.id
    LEFT JOIN board_members bm ON b.id = bm.board_id
    WHERE b.id = ? AND (b.owner_id = ? OR bm.user_id = ?)
  `).get(req.params.id, req.user!.id, req.user!.id) as any;

  if (!board) { res.status(404).json({ error: 'Board not found' }); return; }

  const groups = db.prepare('SELECT * FROM groups WHERE board_id = ? ORDER BY position').all(req.params.id);
  const columns = db.prepare('SELECT * FROM columns WHERE board_id = ? ORDER BY position').all(req.params.id);
  const items = db.prepare(`
    SELECT i.*, iv.column_id, iv.value
    FROM items i
    LEFT JOIN item_values iv ON i.id = iv.item_id
    WHERE i.board_id = ?
    ORDER BY i.group_id, i.position
  `).all(req.params.id);

  // Group item values by item
  const itemMap: Record<string, any> = {};
  for (const row of items as any[]) {
    if (!itemMap[row.id]) {
      itemMap[row.id] = { id: row.id, name: row.name, group_id: row.group_id, board_id: row.board_id, position: row.position, created_by: row.created_by, created_at: row.created_at, updated_at: row.updated_at, values: {} };
    }
    if (row.column_id) itemMap[row.id].values[row.column_id] = row.value;
  }

  res.json({ ...board, groups, columns, items: Object.values(itemMap) });
});

router.put('/:id', (req: AuthRequest, res: Response) => {
  const parsed = BoardSchema.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const db = getDb();
  const board = db.prepare('SELECT id FROM boards WHERE id = ? AND owner_id = ?').get(req.params.id, req.user!.id);
  if (!board) { res.status(404).json({ error: 'Board not found' }); return; }

  const fields = Object.entries(parsed.data).map(([k]) => `${k} = ?`).join(', ');
  const values = [...Object.values(parsed.data), req.params.id];
  db.prepare(`UPDATE boards SET ${fields}, updated_at = datetime('now') WHERE id = ?`).run(...values);

  res.json(db.prepare('SELECT * FROM boards WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req: AuthRequest, res: Response) => {
  const db = getDb();
  const result = db.prepare('DELETE FROM boards WHERE id = ? AND owner_id = ?').run(req.params.id, req.user!.id);
  if (result.changes === 0) { res.status(404).json({ error: 'Board not found' }); return; }
  res.json({ success: true });
});

export default router;
