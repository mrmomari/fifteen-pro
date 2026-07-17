const nodemailer = require('nodemailer');

let transport = null;

function getTransport() {
  if (transport) return transport;
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn('[mailer] SMTP not configured — emails will be logged, not sent. See .env.example.');
    return null;
  }
  transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 465,
    secure: process.env.SMTP_SECURE !== 'false',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });
  return transport;
}

async function sendMail({ to, subject, text, html }) {
  const t = getTransport();
  if (!t) {
    console.log(`[mailer] (not sent, SMTP unconfigured) To: ${to} — ${subject}\n${text}`);
    return { sent: false };
  }
  await t.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject,
    text,
    html
  });
  return { sent: true };
}

module.exports = { sendMail };
