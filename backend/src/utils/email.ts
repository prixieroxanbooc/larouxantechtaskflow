import nodemailer from 'nodemailer';

function isConfigured() {
  return !!(process.env.SMTP_USER && process.env.SMTP_PASS);
}

function createTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

export async function sendVerificationEmail(
  to: string,
  name: string,
  token: string
): Promise<boolean> {
  if (!isConfigured()) return false;

  const appUrl = process.env.APP_URL || `http://localhost:${process.env.PORT || 3001}`;
  const link = `${appUrl}/verify-email?token=${token}`;

  try {
    const transporter = createTransport();
    await transporter.sendMail({
      from: `"Larouxantech TaskFlow" <${process.env.SMTP_USER}>`,
      to,
      subject: 'Verify your email – Larouxantech TaskFlow',
      html: `
        <div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;padding:32px;background:#f9fafb;border-radius:12px;">
          <div style="text-align:center;margin-bottom:24px;">
            <span style="font-size:28px;font-weight:800;color:#0073ea;">Larouxantech TaskFlow</span>
          </div>
          <div style="background:#fff;border-radius:10px;padding:28px;border:1px solid #e5e7eb;">
            <h2 style="margin:0 0 8px;color:#111827;font-size:18px;">Hi ${name}, please verify your email</h2>
            <p style="color:#6b7280;margin:0 0 24px;">Click the button below to confirm your email address and activate your account.</p>
            <a href="${link}" style="display:inline-block;background:#0073ea;color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">Verify Email Address</a>
            <p style="color:#9ca3af;font-size:12px;margin:24px 0 0;">This link expires in 24 hours. If you didn't create an account, you can safely ignore this email.</p>
          </div>
        </div>
      `,
    });
    return true;
  } catch (err) {
    console.error('Failed to send verification email:', err);
    return false;
  }
}

export { isConfigured as isEmailConfigured };
