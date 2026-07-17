const { db } = require('../firebase');

// Maintains customerTimeline/{customerId}/events/{eventId} by listening to
// every collection that has a customer-facing event worth surfacing in the
// admin Customer 360 view. admin.html already builds an equivalent feed
// client-side from data it has already loaded (zero extra reads) for the
// common case — this collection exists for cases that need a persisted,
// queryable-independent-of-the-dashboard history (e.g. a future customer-
// facing "your activity" view, or reporting), and to keep that data fresh
// even while no admin has the dashboard open.
function customerIdOf(collection, data) {
  if (collection === 'tickets' || collection === 'invoices') return data.userId || null;
  if (collection === 'tasks' || collection === 'customerServices') return data.customerId || data.userId || null;
  if (collection === 'questionnaires') return data.customerId || null;
  return null;
}

function eventLabel(collection, data) {
  switch (collection) {
    case 'tickets': return `Ticket: ${data.subject || 'Untitled'} (${data.status || 'open'})`;
    case 'invoices': return `Invoice: ${data.description || ''} — ${data.status || 'pending'}`;
    case 'tasks': return `Task ${data.status === 'completed' ? 'completed' : 'created'}: ${data.title || ''}`;
    case 'customerServices': return `Service ${data.status || 'pending'}: ${data.serviceName || ''}`;
    case 'questionnaires': return `Questionnaire ${data.status || 'draft'}: ${data.title || ''}`;
    default: return collection;
  }
}

const WATCHED = ['tickets', 'invoices', 'tasks', 'customerServices', 'questionnaires'];

function startCustomerTimelineSync() {
  WATCHED.forEach(collection => {
    db.collection(collection).onSnapshot(snapshot => {
      snapshot.docChanges().forEach(async change => {
        if (change.type === 'removed') return;
        const data = change.doc.data();
        const customerId = customerIdOf(collection, data);
        if (!customerId) return;
        try {
          await db.collection('customerTimeline').doc(customerId)
            .collection('events').doc(`${collection}_${change.doc.id}`)
            .set({
              type: collection,
              sourceCollection: collection,
              sourceId: change.doc.id,
              summary: eventLabel(collection, data),
              createdAt: data.createdAt || new Date(),
              syncedAt: new Date()
            }, { merge: true });
        } catch (e) {
          console.error(`[customerTimeline] failed to sync ${collection}/${change.doc.id}:`, e.message);
        }
      });
    }, err => {
      console.error(`[customerTimeline] listener error on ${collection}:`, err.message);
    });
  });
  console.log(`[customerTimeline] watching ${WATCHED.join(', ')}`);
}

module.exports = { startCustomerTimelineSync };
