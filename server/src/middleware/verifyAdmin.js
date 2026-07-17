const { auth, db } = require('../firebase');

// Real Firebase Auth admin session required — a verified ID token plus a
// matching admins/{uid} doc, the same trust model firestore.rules already
// uses for isAdmin(). (A shared "API key" shipped alongside this in the
// client bundle would not add real security — anyone loading admin.html
// can read it out of the page source — so it's deliberately not used
// here; the ID token check is the actual boundary.)
async function verifyAdmin(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!idToken) return res.status(401).json({ error: 'Missing Authorization bearer token' });

    const decoded = await auth.verifyIdToken(idToken);
    const adminDoc = await db.collection('admins').doc(decoded.uid).get();
    if (!adminDoc.exists) return res.status(403).json({ error: 'Not an admin' });

    req.adminUid = decoded.uid;
    next();
  } catch (e) {
    res.status(401).json({ error: 'Authentication failed: ' + e.message });
  }
}

module.exports = { verifyAdmin };
