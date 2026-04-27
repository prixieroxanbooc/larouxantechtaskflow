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

router.get('/', async (req: AuthRequest, res: Response) => {
  const db = getDb();
  const { rows } = await db.query(`
    SELECT b.*, u.name as owner_name
    FROM boards b
    JOIN users u ON b.owner_id = u.id
    LEFT JOIN board_members bm ON b.id = bm.board_id
    WHERE b.owner_id = $1 OR bm.user_id = $2
    GROUP BY b.id, u.name
    ORDER BY b.created_at DESC
  `, [req.user!.id, req.user!.id]);
  res.json(rows);
});

router.post('/', async (req: AuthRequest, res: Response) => {
  const parsed = BoardSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const db = getDb();
  const id = crypto.randomUUID();
  const { name, description = '', color = '#0073ea', icon = '📋' } = parsed.data;

  await db.query(
    'INSERT INTO boards (id, name, description, owner_id, color, icon) VALUES ($1, $2, $3, $4, $5, $6)',
    [id, name, description, req.user!.id, color, icon]
  );

  const groupId = crypto.randomUUID();
  await db.query(
    'INSERT INTO groups (id, board_id, name, color, position) VALUES ($1, $2, $3, $4, $5)',
    [groupId, id, 'Main Group', '#037f4c', 0]
  );

  const defaultColumns = [
    { name: 'Status', type: 'status', settings: JSON.stringify({ options: [{ label: 'Working on it', color: '#fdab3d' }, { label: 'Done', color: '#00c875' }, { label: 'Stuck', color: '#e2445c' }] }) },
    { name: 'Owner', type: 'person', settings: '{}' },
    { name: 'Due Date', type: 'date', settings: '{}' },
  ];
  for (let i = 0; i < defaultColumns.length; i++) {
    const col = defaultColumns[i];
    await db.query(
      'INSERT INTO columns (id, board_id, name, type, settings, position) VALUES ($1, $2, $3, $4, $5, $6)',
      [crypto.randomUUID(), id, col.name, col.type, col.settings, i]
    );
  }

  const { rows } = await db.query('SELECT * FROM boards WHERE id = $1', [id]);
  res.status(201).json(rows[0]);
});

router.get('/:id', async (req: AuthRequest, res: Response) => {
  const db = getDb();
  const { rows: boardRows } = await db.query(`
    SELECT b.*, u.name as owner_name
    FROM boards b JOIN users u ON b.owner_id = u.id
    LEFT JOIN board_members bm ON b.id = bm.board_id
    WHERE b.id = $1 AND (b.owner_id = $2 OR bm.user_id = $3)
  `, [req.params.id, req.user!.id, req.user!.id]);

  const board = boardRows[0] as Record<string, unknown> | undefined;
  if (!board) { res.status(404).json({ error: 'Board not found' }); return; }

  const { rows: groups } = await db.query('SELECT * FROM groups WHERE board_id = $1 ORDER BY position', [req.params.id]);
  const { rows: columns } = await db.query('SELECT * FROM columns WHERE board_id = $1 ORDER BY position', [req.params.id]);
  const { rows: itemRows } = await db.query(`
    SELECT i.*, iv.column_id, iv.value
    FROM items i
    LEFT JOIN item_values iv ON i.id = iv.item_id
    WHERE i.board_id = $1
    ORDER BY i.group_id, i.position
  `, [req.params.id]);

  const itemMap: Record<string, Record<string, unknown>> = {};
  for (const row of itemRows as Record<string, unknown>[]) {
    const rowId = row.id as string;
    if (!itemMap[rowId]) {
      itemMap[rowId] = { id: row.id, name: row.name, group_id: row.group_id, board_id: row.board_id, position: row.position, created_by: row.created_by, created_at: row.created_at, updated_at: row.updated_at, values: {} };
    }
    if (row.column_id) (itemMap[rowId].values as Record<string, unknown>)[row.column_id as string] = row.value;
  }

  res.json({ ...board, groups, columns, items: Object.values(itemMap) });
});

router.put('/:id', async (req: AuthRequest, res: Response) => {
  const parsed = BoardSchema.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const db = getDb();
  const { rows: existing } = await db.query('SELECT id FROM boards WHERE id = $1 AND owner_id = $2', [req.params.id, req.user!.id]);
  if (existing.length === 0) { res.status(404).json({ error: 'Board not found' }); return; }

  const entries = Object.entries(parsed.data);
  const setClauses = entries.map(([k], i) => `"${k}" = $${i + 1}`).join(', ');
  const values = [...entries.map(([, v]) => v), req.params.id];
  await db.query(
    `UPDATE boards SET ${setClauses}, updated_at = NOW() WHERE id = $${entries.length + 1}`,
    values
  );

  const { rows } = await db.query('SELECT * FROM boards WHERE id = $1', [req.params.id]);
  res.json(rows[0]);
});

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  const db = getDb();
  const result = await db.query('DELETE FROM boards WHERE id = $1 AND owner_id = $2', [req.params.id, req.user!.id]);
  if ((result.rowCount ?? 0) === 0) { res.status(404).json({ error: 'Board not found' }); return; }
  res.json({ success: true });
});

export default router;
