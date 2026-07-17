const express = require('express');
const crypto = require('crypto');
const { db } = require('../firebase');

const router = express.Router();

function sha256hex(str) {
  return crypto.createHash('sha256').update(str, 'utf8').digest('hex');
}

// GET /api/vendor-quote/:id?passcode=...
// Public (no auth — the vendor has no account), but unlike the direct
// Firestore read the client currently does, this never returns the
// document (including passHash) unless the passcode actually matches.
// This is the real fix for the gap noted in report.html/CLAUDE.md: today
// the full vendorQuotes doc is fetched *before* the passcode is checked,
// because Firestore rules can't conditionally gate a read on a value
// submitted in the request. A server can.
router.get('/vendor-quote/:id', async (req, res) => {
  const { id } = req.params;
  const { passcode } = req.query;
  try {
    const doc = await db.collection('vendorQuotes').doc(id).get();
    if (!doc.exists) return res.status(404).json({ error: 'Not found' });
    const vq = doc.data();

    // Non-sensitive labeling info (which business/title this sheet is for)
    // is always returned so the passcode screen can show it, matching the
    // existing UX — only the actual service list/scope/costs (the
    // business-sensitive content the passcode is meant to protect) require
    // a verified passcode.
    const createdAtIso = vq.createdAt && vq.createdAt.toDate ? vq.createdAt.toDate().toISOString() : (vq.createdAt || null);
    const meta = { status: vq.status || 'pending', business: vq.business || '', qnTitle: vq.qnTitle || '', createdAt: createdAtIso };
    if (vq.status === 'submitted') return res.json(meta);

    const needsPasscode = !!vq.passHash;
    if (needsPasscode && !passcode) {
      // Initial load, no code entered yet — not an error, just "ask for it".
      return res.json({ ...meta, needsPasscode: true });
    }
    if (needsPasscode && sha256hex(passcode) !== vq.passHash) {
      // A code WAS submitted and it was wrong — distinct from the above so
      // the client can tell "ask" from "that was incorrect".
      return res.status(401).json({ ...meta, error: 'Incorrect passcode' });
    }

    res.json({ ...meta, needsPasscode: false, services: vq.services || [], costs: vq.costs || {}, vendorName: vq.vendorName || '', vendorNote: vq.vendorNote || '' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/vendor-quote/:id/submit  { passcode, costs, vendorName, vendorNote }
// The write itself is also gated here — not just the read — closing the
// gap where firestore.rules today accepts the one-time cost submission
// from anyone who knows the document id, without verifying they ever
// actually knew the passcode.
router.post('/vendor-quote/:id/submit', async (req, res) => {
  const { id } = req.params;
  const { passcode, costs, vendorName, vendorNote } = req.body || {};
  if (!costs || typeof costs !== 'object') return res.status(400).json({ error: 'costs is required' });

  try {
    const ref = db.collection('vendorQuotes').doc(id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'Not found' });
    const vq = doc.data();

    if (vq.status === 'submitted') return res.status(409).json({ error: 'Already submitted' });
    if (vq.passHash && (!passcode || sha256hex(passcode) !== vq.passHash)) {
      return res.status(401).json({ error: 'Incorrect passcode' });
    }

    await ref.update({
      costs,
      vendorName: vendorName || '',
      vendorNote: vendorNote || '',
      status: 'submitted',
      submittedAt: new Date()
    });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
