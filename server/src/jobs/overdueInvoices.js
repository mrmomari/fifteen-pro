const { db } = require('../firebase');
const { sendMail } = require('../mailer');

// Flips pending invoices past their due date to 'overdue'. Previously this
// only ever happened when an admin manually clicked "Mark Overdue" in
// admin.html — nothing detected it automatically.
async function runOverdueInvoiceSweep() {
  const now = new Date();
  const snap = await db.collection('invoices').where('status', '==', 'pending').get();
  const overdue = [];
  const batch = db.batch();
  snap.forEach(doc => {
    const inv = doc.data();
    const due = inv.dueDate && inv.dueDate.toDate ? inv.dueDate.toDate() : (inv.dueDate ? new Date(inv.dueDate) : null);
    if (due && due < now) {
      batch.update(doc.ref, { status: 'overdue', updatedAt: now });
      overdue.push({ id: doc.id, ...inv });
    }
  });
  if (overdue.length) await batch.commit();

  if (overdue.length) {
    await db.collection('auditLogs').add({
      userId: 'system', action: 'update', resourceType: 'invoice',
      resourceId: overdue.map(o => o.id).join(','),
      changes: { status: 'overdue', count: overdue.length, via: 'cron' },
      timestamp: now
    });
  }

  return overdue;
}

async function notifyOverdueInvoices(overdue) {
  if (!overdue.length) return;
  const notifDoc = await db.collection('settings').doc('notifications').get();
  const settings = notifDoc.exists ? notifDoc.data() : {};
  if (settings.emailInvoices === false) return;
  const recipients = settings.emailRecipients || [];
  if (!recipients.length) return;

  const fmt = n => '$' + Number(n || 0).toLocaleString();
  const lines = overdue.map(o => `- ${o.customerName || 'Unknown'}: ${o.description || ''} — ${fmt(o.amount)} (was due ${
    o.dueDate && o.dueDate.toDate ? o.dueDate.toDate().toLocaleDateString() : ''
  })`);

  await sendMail({
    to: recipients.join(','),
    subject: `${overdue.length} invoice${overdue.length > 1 ? 's' : ''} just went overdue — Fifteen`,
    text: `The following invoice(s) passed their due date and were marked overdue:\n\n${lines.join('\n')}\n\nReview in admin.html → Invoices.`,
  });
}

module.exports = { runOverdueInvoiceSweep, notifyOverdueInvoices };
