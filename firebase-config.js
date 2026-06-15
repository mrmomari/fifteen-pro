// ─── Fifteen Pro · Firebase Configuration ─────────────────────────────────
// 1. Go to https://console.firebase.google.com/
// 2. Click "Add project" → name it (e.g. "fifteen-pro")
// 3. Inside the project → Build → Firestore Database → Create database
//    (choose "Start in test mode" for now)
// 4. Project settings (gear icon) → Your apps → Add app (</> Web)
// 5. Copy the firebaseConfig object values into the fields below
// 6. Save this file — the admin panel auto-reads it on load.

const FIREBASE_CONFIG = {
  apiKey:            "YOUR_API_KEY",
  authDomain:        "YOUR_PROJECT_ID.firebaseapp.com",
  projectId:         "YOUR_PROJECT_ID",
  storageBucket:     "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId:             "YOUR_APP_ID"
};
