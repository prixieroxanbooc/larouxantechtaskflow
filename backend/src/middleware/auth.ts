import { Request, Response, NextFunction } from 'express';
import { createHash } from 'crypto';
import jwt from 'jsonwebtoken';
import { getDb } from '../db/database';

const JWT_SECRET = process.env.JWT_SECRET || 'taskflow-secret-key-change-in-production';

export interface AuthRequest extends Request {
  user?: { id: string; email: string; name: string };
}

type UserPayload = { id: string; email: string; name: string };
type DbUserRow = { id: string; email: string; name: string };

export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

export async function authenticate(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const bearer = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  const headerKey = req.headers['x-api-key'] as string | undefined;
  const token = bearer || headerKey || '';

  if (!token) {
    res.status(401).json({ error: 'No token or API key provided' });
    return;
  }

  // ── Try JWT first (user login token or OAuth client token) ─────────────────
  try {
    const payload = jwt.verify(token, JWT_SECRET) as UserPayload;
    req.user = { id: payload.id, email: payload.email, name: payload.name };
    next();
    return;
  } catch {
    // Not a valid JWT — fall through to API key check
  }

  // ── Try API key (format: tf_live_...) ──────────────────────────────────────
  if (token.startsWith('tf_live_')) {
    try {
      const db = getDb();
      const keyHash = hashApiKey(token);
      const row = db.prepare(`
        SELECT ak.id, u.id as uid, u.email, u.name
        FROM api_keys ak
        JOIN users u ON ak.user_id = u.id
        WHERE ak.key_hash = ?
      `).get(keyHash) as (DbUserRow & { uid: string }) | undefined;

      if (row) {
        db.prepare("UPDATE api_keys SET last_used_at = datetime('now') WHERE key_hash = ?").run(keyHash);
        req.user = { id: row.uid, email: row.email, name: row.name };
        next();
        return;
      }
    } catch {
      // DB error — fall through
    }
  }

  res.status(401).json({ error: 'Invalid or expired token / API key' });
}

export function signToken(payload: UserPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}
