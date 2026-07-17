require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cron = require('node-cron');

const approveApplicationRoute = require('./routes/approveApplication');
const vendorQuoteRoute = require('./routes/submitVendorQuote');
const { startCustomerTimelineSync } = require('./jobs/customerTimeline');
const { runOverdueInvoiceSweep, notifyOverdueInvoices } = require('./jobs/overdueInvoices');
const { runReminderDigest } = require('./jobs/reminderDigest');

const app = express();
app.use(helmet());
app.use(express.json({ limit: '256kb' }));

const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
app.use(cors({
  origin: allowedOrigins.length ? allowedOrigins : true,
}));

// Generous but real cap — this is a small internal tool's API, not a
// public product; the goal is just to blunt abuse, not fine-tune traffic.
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 300 }));

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api', approveApplicationRoute);
app.use('/api', vendorQuoteRoute);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal error' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`[server] listening on :${PORT}`));

// Background automation — see README.md for what each of these does and
// how to run this process persistently (PM2) on Hostinger.
startCustomerTimelineSync();

const schedule = process.env.CRON_SCHEDULE || '0 8 * * *';
cron.schedule(schedule, async () => {
  console.log('[cron] running daily sweep…');
  try {
    const overdue = await runOverdueInvoiceSweep();
    await notifyOverdueInvoices(overdue);
    const digest = await runReminderDigest();
    console.log('[cron] done', { overdueFlagged: overdue.length, digest });
  } catch (e) {
    console.error('[cron] sweep failed:', e);
  }
});
console.log(`[cron] scheduled "${schedule}"`);
