const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');

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

if (!getApps().length) {
  initializeApp({
    credential: cert(loadServiceAccount()),
    projectId: process.env.FIREBASE_PROJECT_ID || undefined
  });
}

const db = getFirestore();
const auth = getAuth();

module.exports = { db, auth };
