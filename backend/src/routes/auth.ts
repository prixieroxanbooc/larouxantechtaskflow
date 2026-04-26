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

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) {
    res.status(409).json({ error: 'Email already registered' });
    return;
  }

  const id = crypto.randomUUID();
  const password_hash = await bcrypt.hash(password, 10);
  db.prepare('INSERT INTO users (id, email, name, password_hash, email_verified) VALUES (?, ?, ?, ?, ?)').run(
    id, email, name, password_hash, isEmailConfigured() ? 0 : 1
  );

  if (isEmailConfigured()) {
    const verifyToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    db.prepare('INSERT INTO email_verification_tokens (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)').run(
      crypto.randomUUID(), id, verifyToken, expiresAt
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

  const user = db.prepare('SELECT id, email, name, password_hash, email_verified FROM users WHERE email = ?').get(email) as
    | { id: string; email: string; name: string; password_hash: string; email_verified: number }
    | undefined;

  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }

  const token = signToken({ id: user.id, email: user.email, name: user.name });
  res.json({ token, user: { id: user.id, email: user.email, name: user.name, email_verified: user.email_verified } });
});

router.get('/me', authenticate, (req: AuthRequest, res: Response) => {
  const db = getDb();
  const user = db.prepare('SELECT id, email, name, avatar, email_verified, created_at FROM users WHERE id = ?').get(req.user!.id);
  res.json(user);
});

router.get('/verify-email', (req: Request, res: Response) => {
  const { token } = req.query;
  if (!token || typeof token !== 'string') {
    res.status(400).json({ error: 'Missing token' });
    return;
  }

  const db = getDb();
  const record = db.prepare(`
    SELECT t.user_id, t.expires_at
    FROM email_verification_tokens t
    WHERE t.token = ?
  `).get(token) as { user_id: string; expires_at: string } | undefined;

  if (!record) {
    res.status(404).json({ error: 'Invalid or already used verification link.' });
    return;
  }

  if (new Date(record.expires_at) < new Date()) {
    db.prepare('DELETE FROM email_verification_tokens WHERE token = ?').run(token);
    res.status(410).json({ error: 'Verification link has expired. Please register again.' });
    return;
  }

  db.prepare('UPDATE users SET email_verified = 1 WHERE id = ?').run(record.user_id);
  db.prepare('DELETE FROM email_verification_tokens WHERE token = ?').run(token);

  res.json({ message: 'Email verified successfully.' });
});

export default router;
