# Fifteen Pro — Backend Automation Service

This is a **small, optional** Node/Express service. The main site
(`index.html`, `admin.html`, `portal.html`, `shop.html`,
`questionnaire.html`, `report.html`) runs entirely without it, exactly as
it does today — nothing about the static site's availability depends on
this being deployed. Deploy it whenever you're ready; the front end
feature-detects it via `backend-config.js` (see below) and only uses it
once configured.

## What it does

1. **Automated follow-ups** — a daily job (`CRON_SCHEDULE` in `.env`,
   default 8am) that:
   - Flips `invoices` past their due date from `pending` → `overdue`
     automatically (today this only happens if an admin manually clicks
     "Mark Overdue").
   - Sends a digest email of tasks due soon and stale open tickets to
     whoever is configured in admin.html → Notifications → Email
     Recipients — this is what finally wires up those toggles, which
     previously saved to Firestore but were never read by anything.
2. **`customerTimeline` sync** — background listeners that mirror
   ticket/invoice/task/service/questionnaire activity into
   `customerTimeline/{customerId}/events/{id}`, for anything that wants a
   persisted history independent of the dashboard being open (admin.html's
   Customer 360 view builds an equivalent feed client-side from data it
   already has, so this isn't required for that feature to work today).
3. **`POST /api/approve-application`** — an atomic version of approving a
   partner application: creates the Firebase Auth account, writes
   `customers/{uid}`, and updates the application doc as one operation,
   rolling back the Auth account if any step fails. Removes the need for
   the two-Firebase-app-instance workaround admin.html currently uses.
4. **`GET/POST /api/vendor-quote/:id`** — the real, server-side version of
   the passcode check on `report.html?vq=...`. Today that check happens
   entirely in the browser: the full vendor-quote document (including the
   passcode's hash) is downloaded *before* the passcode is verified, and
   the cost-submission write isn't gated by the passcode at all at the
   Firestore-rules layer — only the document ID's unguessability protects
   it. This endpoint verifies the passcode server-side before ever
   returning the data or accepting a submission.

## Requirements

- Node.js 18+
- A way to keep a Node process running persistently with the ability to
  restart on crash — a Hostinger **VPS** or a **Node.js app hosting**
  plan both work. Plain shared/PHP hosting does not support this; see the
  note at the bottom.
- A Firebase service account key (Firebase Console → Project Settings →
  Service Accounts → Generate new private key). Keep this secret — it has
  full admin access to your Firestore/Auth.
- (Optional but recommended) An SMTP mailbox — Hostinger gives you one on
  your own domain under hPanel → Emails — for the digest/invoice/invite
  emails. Without SMTP configured, the server logs what it *would* have
  sent instead of failing.

## Setup

```bash
cd server
npm install
cp .env.example .env
# fill in .env — see comments in that file
```

`npm audit` currently reports a handful of moderate-severity issues, all
transitive through `firebase-admin`'s own `@google-cloud/storage`/
`teeny-request` dependency chain (this service doesn't use Storage at
all — only Firestore and Auth). They'll clear once Google publishes an
update; re-run `npm audit` after `npm install` periodically and bump
`firebase-admin` when a fix lands.

Firestore security rules already allow this service's writes: it uses the
Admin SDK, which bypasses `firestore.rules` entirely (that's the point —
it's the trusted server side). The rules changes in this PR only add a
`customerTimeline` collection (admin-read-only, no client writes at all —
only this service, via the Admin SDK, ever writes it) and a `vendors`
collection (admin-only).

## Running

```bash
npm start
```

For production, run it under a process manager so it restarts on crash
and on server reboot:

```bash
npm install -g pm2
pm2 start src/index.js --name fifteen-backend
pm2 save
pm2 startup   # follow the printed instructions once, so PM2 survives a reboot
```

### On a Hostinger VPS

1. SSH in, install Node 18+ (Hostinger's VPS template or `nvm`).
2. Clone this repo (or just copy the `server/` folder) onto the VPS.
3. Follow **Setup** and **Running** above.
4. Point a subdomain (e.g. `api.15fifteen15.com`) at the VPS, and put
   Nginx or Hostinger's built-in reverse proxy in front of port `3000`
   with a free Let's Encrypt certificate (Hostinger's hPanel can issue
   one). The service must be served over HTTPS since it's called from a
   browser on the live HTTPS site.

### On Hostinger's Node.js App hosting (hPanel)

1. hPanel → Websites → your domain → Node.js → Create Application, point
   it at the `server/` folder, entry file `src/index.js`.
2. Set the environment variables from `.env.example` in the app's
   "Environment Variables" panel instead of a `.env` file.
3. Hostinger keeps the app process alive for you here, so `pm2` isn't
   needed — but confirm the plan actually supports a long-running
   background `setInterval`/cron process (`node-cron` runs *inside* this
   same process) rather than only request-triggered execution; if it
   doesn't, use Hostinger's own Cron Jobs feature (hPanel → Advanced →
   Cron Jobs) to hit a small `POST /api/run-daily-sweep` endpoint on a
   schedule instead of relying on the in-process `node-cron` scheduler —
   that endpoint isn't wired up in this initial version but is a small
   addition (see `src/jobs/*.js`, both are already plain exported
   functions callable from a route).

### If you only have shared/PHP hosting (no persistent Node process)

This service as built needs a real, always-on Node process — shared PHP
hosting can't run it. The two options at that point are: (a) upgrade to a
Hostinger plan that supports Node, or (b) reimplement just the cron pieces
(`src/jobs/overdueInvoices.js`, `src/jobs/reminderDigest.js`) as a PHP
script hitting the Firestore REST API, triggered by Hostinger's Cron Jobs
feature. The `approve-application` and `vendor-quote` endpoints need a
request/response server either way (Node here, or a PHP script behind
your web server) — those can't run as a bare cron job since they respond
to a specific browser action in real time.

## Wiring the front end to this service

Once deployed and reachable over HTTPS, edit `backend-config.js` at the
repo root (already committed, sibling to `firebase-config.js`, disabled
by default with an empty `apiUrl`):

```js
const BACKEND_CONFIG = { apiUrl: 'https://api.15fifteen15.com' };
```

`admin.html` and `report.html` check for this at load time. If it's
missing or the request fails, both fall back to their existing
direct-Firestore behavior — so deploying this service is additive and
reversible, never a hard dependency. `admin.html`'s calls to
`/api/approve-application` send the signed-in admin's Firebase ID token
as a bearer token, which the server verifies against the same
`admins/{uid}` check `firestore.rules` already uses — no separate secret
to manage.
