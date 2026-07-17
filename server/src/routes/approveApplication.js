const express = require('express');
const crypto = require('crypto');
const { db, auth } = require('../firebase');
const { verifyAdmin } = require('../middleware/verifyAdmin');
const { sendMail } = require('../mailer');

const router = express.Router();

function genSecurePassword() {
  return 'Temp_' + crypto.randomBytes(24).toString('base64url');
}

// POST /api/approve-application  { docId, name, email, industry }
// Atomic version of admin.html's approveApplication(): creates the
// customer's Auth account, writes customers/{uid}, and updates the
// application doc as one server-side operation. If any step after
// account creation fails, the Auth user is rolled back — this is the
// same failure mode the client-side flow (admin.html) now also guards
// against, but doing it here removes the two-Firebase-app-instance
// workaround entirely and doesn't depend on the admin's browser staying
// connected for the whole operation.
router.post('/approve-application', verifyAdmin, async (req, res) => {
  const { docId, name, email, industry } = req.body || {};
  if (!docId || !name || !email || !industry) {
    return res.status(400).json({ error: 'docId, name, email, and industry are required' });
  }

  const appDoc = await db.collection('applications').doc(docId).get();
  if (!appDoc.exists) return res.status(404).json({ error: 'Application not found' });
  if (appDoc.data().status === 'approved') {
    return res.status(409).json({ error: 'Application already approved' });
  }

  let userRecord;
  try {
    userRecord = await auth.createUser({ email, password: genSecurePassword(), displayName: name });
  } catch (e) {
    return res.status(400).json({ error: 'Could not create account: ' + e.message });
  }

  try {
    await db.collection('customers').doc(userRecord.uid).set({
      name, email, industry,
      applicationId: docId,
      status: 'active',
      createdAt: new Date()
    });
    await db.collection('applications').doc(docId).update({
      status: 'approved',
      userId: userRecord.uid,
      approvedAt: new Date()
    });
  } catch (writeErr) {
    await auth.deleteUser(userRecord.uid).catch(() => {});
    return res.status(500).json({ error: 'Failed to finish approval, account rolled back: ' + writeErr.message });
  }

  await db.collection('auditLogs').add({
    userId: req.adminUid, action: 'approve', resourceId: docId, resourceType: 'application',
    changes: { customerUid: userRecord.uid, email, via: 'backend' }, timestamp: new Date()
  });

  // Best-effort invite email — the customer record already exists even if
  // this fails, so this is not rolled back; the admin can resend from the
  // Firebase console if needed.
  try {
    const resetLink = await auth.generatePasswordResetLink(email);
    await sendMail({
      to: email,
      subject: 'Set your Fifteen partner portal password',
      text: `Hi ${name},\n\nYour Fifteen partner account is ready. Set your password here:\n${resetLink}\n\nThen sign in at the Partner Portal.\n\n— Fifteen`,
      html: `<p>Hi ${name},</p><p>Your Fifteen partner account is ready. Set your password here:</p><p><a href="${resetLink}">${resetLink}</a></p><p>Then sign in at the Partner Portal.</p><p>— Fifteen</p>`
    });
  } catch (mailErr) {
    console.error('[approve-application] invite email failed:', mailErr.message);
  }

  res.json({ ok: true, uid: userRecord.uid });
});

module.exports = router;
