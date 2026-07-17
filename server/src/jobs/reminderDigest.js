const { db } = require('../firebase');
const { sendMail } = require('../mailer');

const STALE_TICKET_DAYS = 2;
const TASK_DUE_SOON_HOURS = 48;

// Compiles and sends a digest of: tasks due within TASK_DUE_SOON_HOURS,
// and open tickets not updated in STALE_TICKET_DAYS days. This is what
// finally wires up the previously-inert settings/notifications toggles
// (emailServices / emailTickets) to an actual email.
async function runReminderDigest() {
  const notifDoc = await db.collection('settings').doc('notifications').get();
  const settings = notifDoc.exists ? notifDoc.data() : {};
  const recipients = settings.emailRecipients || [];
  if (!recipients.length) return { sent: false, reason: 'no recipients configured' };

  const now = new Date();
  const soonCutoff = new Date(now.getTime() + TASK_DUE_SOON_HOURS * 3600 * 1000);
  const staleCutoff = new Date(now.getTime() - STALE_TICKET_DAYS * 24 * 3600 * 1000);

  const sections = [];

  if (settings.emailServices !== false) {
    const tasksSnap = await db.collection('tasks').where('status', '==', 'pending').get();
    const dueSoon = tasksSnap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(t => {
        const due = t.dueDate && t.dueDate.toDate ? t.dueDate.toDate() : (t.dueDate ? new Date(t.dueDate) : null);
        return due && due <= soonCutoff;
      });
    if (dueSoon.length) {
      sections.push(
        `TASKS DUE WITHIN ${TASK_DUE_SOON_HOURS}H (${dueSoon.length}):\n` +
        dueSoon.map(t => `- ${t.title || 'Untitled'}${t.assignedTo ? ' (' + t.assignedTo + ')' : ''}${t.customerName ? ' — ' + t.customerName : ''}`).join('\n')
      );
    }
  }

  if (settings.emailTickets !== false) {
    const ticketsSnap = await db.collection('tickets').where('status', 'in', ['open', 'in-progress']).get();
    const stale = ticketsSnap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(t => {
        const updated = t.updatedAt && t.updatedAt.toDate ? t.updatedAt.toDate() : (t.updatedAt ? new Date(t.updatedAt) : null);
        return !updated || updated <= staleCutoff;
      });
    if (stale.length) {
      sections.push(
        `TICKETS WITH NO UPDATE IN ${STALE_TICKET_DAYS}+ DAYS (${stale.length}):\n` +
        stale.map(t => `- ${t.subject || 'Untitled'} (${t.status})`).join('\n')
      );
    }
  }

  if (!sections.length) return { sent: false, reason: 'nothing to report' };

  await sendMail({
    to: recipients.join(','),
    subject: 'Fifteen daily follow-up digest',
    text: sections.join('\n\n')
  });
  return { sent: true, sections: sections.length };
}

module.exports = { runReminderDigest };
