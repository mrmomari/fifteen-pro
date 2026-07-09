# Security Setup — Locking Down Firestore & Storage

Until now the Firebase project ran with open rules: **anyone on the internet
could read and write every collection** — including `settings/access`, which
stored the admin password in plaintext. This guide closes that hole.

Two things changed together, and both are needed:

1. **`firestore.rules` + `storage.rules`** (in this repo) — deny-by-default
   rules for every collection.
2. **Admin login now uses Firebase Authentication** (email + password) instead
   of a password stored in Firestore. Rules can only tell an admin apart from
   a random visitor if the admin has a real Firebase Auth identity.

## ⚠️ Do these steps IN ORDER

Publishing the rules before creating your admin account will lock you out of
the admin dashboard (data stays safe; you'd just have to finish the steps to
get back in).

### 1. Create your admin user (Firebase Console)

1. Open [Firebase Console](https://console.firebase.google.com/) → project
   **fifteen-pro** → **Authentication** → **Users** → **Add user**.
2. Enter your email and a strong password. Click **Add user**.
3. Copy the **User UID** shown in the users table (e.g. `a1B2c3D4...`).

### 2. Register the user as an admin (Firestore)

1. Go to **Firestore Database** → **Data** → **Start collection**.
2. Collection ID: `admins`
3. Document ID: paste the **UID** from step 1 (not auto-ID!).
4. Add a field, e.g. `role` = `"admin"` (string). Save.

Repeat steps 1–2 for each additional admin.

### 3. Deploy the updated site

Merge/deploy this branch so `admin.html` uses the new email + password login.
Then sign in at `/admin.html` with the account from step 1 and confirm the
dashboard loads.

### 4. Publish the Firestore rules

1. **Firestore Database** → **Rules**.
2. Replace the entire contents with the contents of
   [`firestore.rules`](./firestore.rules).
3. Click **Publish**.

### 5. Publish the Storage rules

1. **Storage** → **Rules**.
2. Replace the entire contents with the contents of
   [`storage.rules`](./storage.rules).
3. Click **Publish**.

### 6. Clean up the old plaintext password

The old flow stored the admin password at `settings/access.adminPassword`.
It is no longer read by anything — delete that field:
**Firestore → Data → settings → access** → delete the `adminPassword` field.

### 7. Verify

- [ ] `index.html` loads (logo, services, team) while logged out.
- [ ] Submitting the apply form on `index.html` works while logged out.
- [ ] Submitting an order from `shop.html` works while logged out.
- [ ] `admin.html` login works with your new email + password.
- [ ] Applications / Orders / Tickets tabs load and Approve / status buttons work.
- [ ] Replying to a ticket in admin.html shows up in the customer's portal thread, and vice versa.
- [ ] A customer can sign in to `portal.html` and sees only their own data.
- [ ] In an incognito window (logged out), the browser console shows
      `permission-denied` if you try to read e.g. `applications`.

## What the rules allow

| Collection | Public | Customer (signed in) | Admin |
|---|---|---|---|
| `settings/company`, `settings/pricing` | read | read | read/write |
| `settings/access`, other settings | — | — | read/write |
| `catalog/*`, `content/*` | read | read | read/write |
| `applications` | create only | — | full |
| `orders` | create only | — | full |
| `customers/{uid}` | — | read own | full |
| `customerServices` | — | read own, request own (pending) | full |
| `tickets` | — | read/create own | full |
| `tickets/{id}/replies` | — | read own thread, post as `customer` on own thread | read/post as `admin` on any thread |
| `invoices` | — | read own | read/write |
| `questionnaires` | get by direct link only (not listable); one-time update to `answers`/`status`/`completedAt` | — | full |
| `auditLogs` | — | read/create own | read/create (no edit/delete) |
| `admins/{uid}` | — | read own entry | read own entry (writes via console only) |

## Notes & remaining considerations

- **Admin password changes** now happen in Admin → Access → “Change Admin
  Password” (it updates your Firebase Auth account), or via Firebase Console →
  Authentication → Reset password.
- **Approving an application** creates the customer's auth account through a
  secondary Firebase app instance, so you stay signed in as admin.
- **Partner logins** (`settings/access.partnerLogins`) are still stored as
  plaintext in Firestore. They are now admin-only readable, but consider
  migrating partners to real Firebase Auth accounts too.
- Public `create` on `applications`/`orders` is validated (required fields,
  field allow-list, size caps) but not rate-limited. If spam becomes a
  problem, add Firebase App Check or a Cloud Function with reCAPTCHA.
- The Firebase web API key in `firebase-config.js` is safe to expose — with
  these rules published, all access control is enforced server-side.
