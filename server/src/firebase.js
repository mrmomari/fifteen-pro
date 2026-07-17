const admin = require('firebase-admin');

function loadServiceAccount() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
    const json = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf8');
    return JSON.parse(json);
  }
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  }
  throw new Error(
    'No Firebase service account configured. Set FIREBASE_SERVICE_ACCOUNT_JSON ' +
    'or FIREBASE_SERVICE_ACCOUNT_BASE64 in your .env — see .env.example.'
  );
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(loadServiceAccount()),
    projectId: process.env.FIREBASE_PROJECT_ID || undefined
  });
}

const db = admin.firestore();
const auth = admin.auth();

module.exports = { admin, db, auth };
