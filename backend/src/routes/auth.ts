import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { getDb } from '../db/database';
import { signToken, authenticate, AuthRequest } from '../middleware/auth';
import { sendVerificationEmail, isEmailConfigured } from '../utils/email';

const router = Router();

const RegisterSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2),
  password: z.string().min(6),
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

router.post('/register', async (req: Request, res: Response) => {
  const parsed = RegisterSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { email, name, password } = parsed.data;
  const db = getDb();

  const { rows: existing } = await db.query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.length > 0) {
    res.status(409).json({ error: 'Email already registered' });
    return;
  }

  const id = crypto.randomUUID();
  const password_hash = await bcrypt.hash(password, 10);
  const emailVerified = isEmailConfigured() ? 0 : 1;
  await db.query(
    'INSERT INTO users (id, email, name, password_hash, email_verified) VALUES ($1, $2, $3, $4, $5)',
    [id, email, name, password_hash, emailVerified]
  );

  if (isEmailConfigured()) {
    const verifyToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    await db.query(
      'INSERT INTO email_verification_tokens (id, user_id, token, expires_at) VALUES ($1, $2, $3, $4)',
      [crypto.randomUUID(), id, verifyToken, expiresAt]
    );
    await sendVerificationEmail(email, name, verifyToken);
    res.status(201).json({ verification_sent: true, message: 'Check your email to verify your account.' });
    return;
  }

  const token = signToken({ id, email, name });
  res.status(201).json({ token, user: { id, email, name, email_verified: 1 }, verification_sent: false });
});

router.post('/login', async (req: Request, res: Response) => {
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { email, password } = parsed.data;
  const db = getDb();

  const { rows } = await db.query(
    'SELECT id, email, name, password_hash, email_verified FROM users WHERE email = $1',
    [email]
  );
  const user = rows[0] as
    | { id: string; email: string; name: string; password_hash: string; email_verified: number }
    | undefined;

  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }

  const token = signToken({ id: user.id, email: user.email, name: user.name });
  res.json({ token, user: { id: user.id, email: user.email, name: user.name, email_verified: user.email_verified } });
});

router.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
  const db = getDb();
  const { rows } = await db.query(
    'SELECT id, email, name, avatar, email_verified, created_at FROM users WHERE id = $1',
    [req.user!.id]
  );
  res.json(rows[0]);
});

router.get('/verify-email', async (req: Request, res: Response) => {
  const { token } = req.query;
  if (!token || typeof token !== 'string') {
    res.status(400).json({ error: 'Missing token' });
    return;
  }

  const db = getDb();
  const { rows } = await db.query(
    'SELECT user_id, expires_at FROM email_verification_tokens WHERE token = $1',
    [token]
  );
  const record = rows[0] as { user_id: string; expires_at: Date } | undefined;

  if (!record) {
    res.status(404).json({ error: 'Invalid or already used verification link.' });
    return;
  }

  if (new Date(record.expires_at) < new Date()) {
    await db.query('DELETE FROM email_verification_tokens WHERE token = $1', [token]);
    res.status(410).json({ error: 'Verification link has expired. Please register again.' });
    return;
  }

  await db.query('UPDATE users SET email_verified = 1 WHERE id = $1', [record.user_id]);
  await db.query('DELETE FROM email_verification_tokens WHERE token = $1', [token]);

  res.json({ message: 'Email verified successfully.' });
});

export default router;
