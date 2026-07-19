# Two-Way Contract Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Note on this codebase:** fifteen-pro is vanilla HTML/CSS/JS with no build step and no test runner (see `CLAUDE.md`). There is no `pytest`/`jest` to invoke, so "verify" steps in this plan mean: reload the page in a browser via `npx serve` (port 3333) and check the DOM/console, or re-read the edited file to confirm the diff landed correctly — not an automated test suite. Per `CLAUDE.md`, do not report a UI task complete without having exercised it in a real browser.

**Goal:** Add a reusable contract module to fifteen-pro with two parallel flows — customer contracts and 3rd‑party vendor contracts — each built from an admin-authored template, sent via a public no-login link, and signed (typed name + timestamp) by the counterparty, with a structured deliverables/timeline table and an in-app provider countersignature.

**Architecture:** Mirrors the existing `questionnaires` (template → public fill-in link → locked-on-submit) and `vendorQuotes` (public link, one-time restricted Firestore update) patterns exactly. Two new Firestore collections — `contractTemplates` (admin-only, reusable) and `contracts` (per-engagement instances, publicly readable/signable by id) — a new admin.html "Contracts" tab (template builder + instance list/builder, following the Questionnaires/Vendors tab conventions byte-for-byte), and a new public page `contract.html` (modeled directly on `questionnaire.html`/`report.html`) where the counterparty reviews and signs. No merge-field templating engine, no auto-generated tasks/milestones — deliverables are structured but static, matching the scope agreed with the user.

**Tech Stack:** Vanilla JS (ES2020+), Firebase Firestore v10.7.1 (compat SDK), no framework, no build step.

---

## Data Model (reference for every task below)

### `contractTemplates/{id}` — admin-only, reusable
```js
{
  name: string,                 // e.g. "Digital Marketing Services Agreement"
  type: 'customer' | 'vendor',
  intro: string,                 // recitals / whereas prose
  sections: [ { title: string, body: string } ],   // numbered prose sections, body may contain \n
  deliverables: [ { id: string, label: string, detail: string, dueRule: string } ],
  compensation: { summary: string, term: string, invoicing: string, lateFees: string },
  createdAt, updatedAt           // firebase.firestore.FieldValue.serverTimestamp()
}
```

### `contracts/{id}` — one per engagement, public get-by-id
```js
{
  templateId: string, templateName: string,       // snapshot of template used
  type: 'customer' | 'vendor',
  customerId: string|null,       // set only when type === 'customer' and linked to customers/{uid}
  vendorId: string|null,         // set only when type === 'vendor' and linked to vendors/{id}
  counterpartyName: string, counterpartyAddress: string, counterpartyEmail: string, counterpartyPhone: string,
  title: string,                 // defaults to templateName, editable
  effectiveDate: string,         // 'YYYY-MM-DD'
  intro: string,                                    // copied from template at creation time
  sections: [ { title: string, body: string } ],    // copied from template at creation time
  deliverables: [ { id, label, detail, dueRule, dueDate: string /* 'YYYY-MM-DD' or '' */, delivered: boolean } ],
  compensation: { summary, term, invoicing, lateFees },   // copied from template at creation time
  status: 'draft' | 'sent' | 'signed' | 'executed' | 'terminated',
  providerSignature: { name: string, title: string, signedAt } | null,     // set by admin in-app
  counterpartySignature: { name: string, title: string, signedAt } | null, // set via public contract.html link
  createdAt, sentAt, updatedAt
}
```

Status is derived and stored (matches `questionnaires`/`vendorQuotes` convention of storing a denormalized `status`):
- Created → `draft`.
- First "Copy Link" → `sent` + `sentAt` (identical trigger pattern to `copyQuestionnaireLink`).
- Either signature gets set → `signed` if only one signature present, `executed` if both present. Recomputed on every signature write, by whichever side writes it (counterparty write recomputes client-side before the Firestore update; admin countersign recomputes the same way).
- Admin may manually set `terminated` from an executed contract via a "Terminate" action.

**Scope note:** `intro`/`sections`/`compensation` are stored on the contract instance (so a template edit later never silently rewrites an already-sent contract), but the per-contract builder modal (Task 6) does not expose UI to re-edit their prose after creation — only counterparty info, effective date, title, and each deliverable's `dueDate`/`delivered` are editable per instance. If a clause needs different wording for one engagement, edit the template before generating the contract, or edit the Firestore doc directly for a one-off. This keeps the builder simple per the "static structured fields only" scope decision; a per-contract clause editor can be added later if it turns out to be needed.

---

## Task 1: Firestore rules for `contractTemplates` and `contracts`

**Files:**
- Modify: `firestore.rules`

- [ ] **Step 1: Add the two new match blocks**

Open `firestore.rules` and insert the following immediately after the `clientReports` block (after the line `match /clientReports/{id} { ... }` closes, i.e. right before the `// ── Audit logs (append-only) ──` comment):

```
    // ── Contract templates (admin.html Contracts tab) ──
    // Reusable contract templates (customer- or vendor-facing) that seed
    // new contract instances. Never exposed publicly — distinct from the
    // per-engagement contracts collection below.
    match /contractTemplates/{id} {
      allow read, write: if isAdmin();
    }

    // ── Contracts (admin.html Contracts tab + contract.html) ──
    // A contract instance sent to a customer or a 3rd-party vendor for
    // signature. Public get-by-id (same link-trust model as questionnaires/
    // vendorQuotes — the link itself is the secret, and the collection
    // can't be listed or browsed). The counterparty may sign exactly once
    // via a restricted update; the provider (admin) countersigns in-app
    // and may otherwise edit/delete freely.
    match /contracts/{id} {
      allow get: if true;
      allow list: if isAdmin();
      allow create, delete: if isAdmin();
      allow update: if isAdmin()
        || (resource.data.counterpartySignature == null
            && request.resource.data.counterpartySignature is map
            && request.resource.data.counterpartySignature.keys().hasOnly(['name','title','signedAt'])
            && request.resource.data.counterpartySignature.name is string
            && request.resource.data.counterpartySignature.name.size() > 0
            && request.resource.data.counterpartySignature.name.size() <= 200
            && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['counterpartySignature','status']));
    }

```

- [ ] **Step 2: Verify the rules file is still syntactically well-formed**

Read the whole file back and confirm brace balance — every `match { ... }` you added closes correctly and the trailing `match /{document=**} { allow read, write: if false; }` catch-all block is still the last rule before the two closing braces of `service cloud.firestore` and the file. There is no Firebase CLI/emulator available in this sandbox to lint the rules, so a careful manual read is the verification here.

- [ ] **Step 3: Commit**

```bash
git add firestore.rules
git commit -m "feat: add Firestore rules for contract templates and contract instances"
```

---

## Task 2: `contract.html` — public contract review + signing page

**Files:**
- Create: `contract.html`

This is modeled directly on `questionnaire.html` (loading/error screens, `escHtml`, draft-free — no localStorage draft needed since there's nothing to type except the final signature) and borrows `report.html`'s `fmtDate`/print-button pattern. It needs `firebase-app-compat.js` + `firebase-firestore-compat.js` + `firebase-config.js` only — no auth SDK, since the provider signs inside authenticated admin.html, not on this page.

- [ ] **Step 1: Write the full file**

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Contract — Fifteen</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{
  --green:#26915E;
  --green-dim:#1d7a4c;
  --orange:#E36C44;
  --cream:#E0E8CF;
  --cream-alt:#D5DFBE;
  --text:#1C2416;
  --text-muted:#5A6B4E;
  --text-dim:#7A8B6A;
  --radius:12px;
  --radius-lg:16px;
}
body{background:var(--cream);color:var(--text);font-family:'Inter',system-ui,sans-serif;line-height:1.6;-webkit-font-smoothing:antialiased;min-height:100vh}

.ct-shell{display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px}
.ct-card{background:#fff;border-radius:var(--radius-lg);box-shadow:0 8px 40px rgba(0,0,0,.12);padding:44px 38px;width:100%;max-width:440px;text-align:center}
.ct-card i.big{font-size:34px;color:var(--green);margin-bottom:16px;display:block}
.ct-card.err i.big{color:var(--orange)}
.ct-card h2{font-size:20px;font-weight:800;letter-spacing:-.02em;margin-bottom:10px}
.ct-card p{font-size:13.5px;color:var(--text-muted)}
.spinner{width:30px;height:30px;border:3px solid rgba(38,145,94,.2);border-top-color:var(--green);border-radius:50%;animation:spin .8s linear infinite;margin:0 auto 16px}
@keyframes spin{to{transform:rotate(360deg)}}

.ct-page{max-width:820px;margin:0 auto;padding:40px 20px 80px}
.ct-header{text-align:center;margin-bottom:30px}
.ct-logo{display:inline-flex;align-items:center;gap:8px;text-decoration:none;margin-bottom:22px}
.ct-logo img{max-height:56px;width:auto;object-fit:contain;display:none}
.ct-logo-text{font-size:24px;font-weight:900;letter-spacing:-.04em;color:var(--text)}
.ct-logo-text span{color:var(--green)}
.ct-title{font-size:26px;font-weight:900;letter-spacing:-.03em;line-height:1.25;margin-bottom:8px}
.ct-sub{font-size:14px;color:var(--text-muted);max-width:560px;margin:0 auto}
.ct-meta-line{margin-top:12px;font-size:12px;color:var(--text-dim)}
.ct-tag{display:inline-block;font-size:10px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#fff;background:var(--green);border-radius:6px;padding:5px 12px;margin-top:12px}
.ct-tag.terminated{background:#c0392b}

.ct-box{background:#fff;border-radius:var(--radius);box-shadow:0 2px 14px rgba(0,0,0,.05);margin-bottom:18px;padding:22px 26px}
.ct-sec-title{font-size:12px;font-weight:800;color:var(--green);text-transform:uppercase;letter-spacing:.05em;margin:0 0 10px}
.ct-parties{display:grid;grid-template-columns:1fr 1fr;gap:18px}
.ct-party-label{font-size:10.5px;font-weight:800;color:var(--text-dim);text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px}
.ct-party-name{font-size:14px;font-weight:700;margin-bottom:2px}
.ct-party-line{font-size:12.5px;color:var(--text-muted)}
.ct-prose{font-size:13.5px;color:var(--text);white-space:pre-wrap;line-height:1.7}
.ct-section-title{font-size:14px;font-weight:800;margin-bottom:8px}

.ct-table-wrap{overflow-x:auto}
.ct-table{width:100%;border-collapse:collapse;min-width:520px}
.ct-table th{background:var(--cream-alt);font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:var(--text-muted);text-align:left;padding:8px 10px;white-space:nowrap}
.ct-table td{padding:9px 10px;border-top:1px solid rgba(0,0,0,.06);font-size:12.5px;vertical-align:top}
.ct-deliv-status{font-size:11px;font-weight:800;padding:3px 9px;border-radius:99px;white-space:nowrap}
.ct-deliv-status.pending{background:rgba(227,108,68,.15);color:var(--orange)}
.ct-deliv-status.delivered{background:rgba(38,145,94,.15);color:var(--green)}

.ct-comp-row{display:flex;gap:10px;padding:6px 0;font-size:13px;border-top:1px solid rgba(0,0,0,.06)}
.ct-comp-row:first-child{border-top:none}
.ct-comp-label{font-weight:700;color:var(--text-dim);flex-shrink:0;width:110px}

.ct-sig-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px}
.ct-sig-box{border:1.5px solid rgba(0,0,0,.1);border-radius:9px;padding:16px}
.ct-sig-box.done{border-color:var(--green);background:rgba(38,145,94,.05)}
.ct-sig-role{font-size:10.5px;font-weight:800;color:var(--text-dim);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px}
.ct-sig-name{font-size:15px;font-weight:800;font-family:'Brush Script MT',cursive,'Inter'}
.ct-sig-meta{font-size:11.5px;color:var(--text-dim);margin-top:4px}
.ct-sig-pending{font-size:12.5px;color:var(--text-muted)}
.ct-field{margin-bottom:12px}
.ct-field label{display:block;font-size:12px;font-weight:700;color:var(--text-muted);margin-bottom:6px}
.ct-field input{width:100%;padding:10px 13px;border:1.5px solid rgba(0,0,0,.14);border-radius:8px;font-size:13.5px;font-family:inherit;color:var(--text);outline:none}
.ct-field input:focus{border-color:var(--green);box-shadow:0 0 0 3px rgba(38,145,94,.1)}
.ct-agree{display:flex;align-items:flex-start;gap:9px;font-size:12px;color:var(--text-muted);margin-bottom:14px}
.ct-agree input{margin-top:2px}
.ct-sign-btn{width:100%;padding:13px;border:none;border-radius:9px;background:var(--green);color:#fff;font-size:14px;font-weight:800;font-family:inherit;cursor:pointer}
.ct-sign-btn:hover{background:var(--green-dim)}
.ct-sign-btn:disabled{opacity:.6;cursor:not-allowed}

.ct-footer-note{font-size:12px;color:var(--text-dim);text-align:center;margin:22px auto 16px;max-width:520px}
.ct-print{position:fixed;right:18px;bottom:18px;background:var(--text);color:#fff;border:none;border-radius:99px;padding:12px 20px;font-size:13px;font-weight:800;font-family:inherit;cursor:pointer;box-shadow:0 6px 20px rgba(0,0,0,.25);display:flex;align-items:center;gap:8px}
.ct-print:hover{background:#000}
.ct-foot{border-top:1.5px solid rgba(0,0,0,.1);margin-top:26px;padding-top:12px;font-size:11px;color:var(--text-dim);display:flex;justify-content:space-between;flex-wrap:wrap;gap:6px}

@media(max-width:640px){
  .ct-box{padding:16px}
  .ct-title{font-size:21px}
  .ct-parties,.ct-sig-grid{grid-template-columns:1fr}
}
@media print{
  body{background:#fff}
  .ct-print{display:none}
  .ct-box{box-shadow:none;border:1px solid rgba(0,0,0,.12);break-inside:avoid}
  .ct-page{padding:10px 0}
}
</style>
</head>
<body>

<div class="ct-shell" id="loadingScreen">
  <div class="ct-card"><div class="spinner"></div><p>Loading contract…</p></div>
</div>

<div class="ct-shell" id="errorScreen" style="display:none">
  <div class="ct-card err">
    <i class="fa-solid fa-triangle-exclamation big"></i>
    <h2 id="errTitle">Link Not Found</h2>
    <p id="errMsg">This contract link is invalid or has been removed. Please check the link or contact whoever sent it to you.</p>
  </div>
</div>

<div class="ct-page" id="pageScreen" style="display:none">
  <div class="ct-header">
    <a href="https://15fifteen15.com" class="ct-logo">
      <img id="ctLogoImg" alt="Fifteen">
      <span class="ct-logo-text" id="ctLogoText">FIFTEEN<span>.</span></span>
    </a>
    <h1 class="ct-title" id="ctTitle">Contract</h1>
    <p class="ct-sub" id="ctSub"></p>
    <div class="ct-meta-line" id="ctMeta"></div>
    <div id="ctTagWrap"></div>
  </div>
  <div id="ctBody"></div>
  <div class="ct-foot"><span>© 2026 Fifteen · 15fifteen15.com</span><span>Confidential — for the addressed party only</span></div>
</div>

<button class="ct-print" id="printBtn" style="display:none" onclick="window.print()"><i class="fa-solid fa-print"></i> Print / Save PDF</button>

<script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore-compat.js"></script>
<script src="firebase-config.js"></script>
<script>
(function(){

function escHtml(str) {
  return String(str == null ? '' : str).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

function show(id) {
  ['loadingScreen','errorScreen','pageScreen'].forEach(s => {
    document.getElementById(s).style.display = (s === id) ? (s === 'pageScreen' ? 'block' : 'flex') : 'none';
  });
}

function fail(title, msg) {
  document.getElementById('errTitle').textContent = title || 'Link Not Found';
  if (msg) document.getElementById('errMsg').textContent = msg;
  show('errorScreen');
}

function fmtDate(val) {
  try {
    if (!val) return '';
    const d = val && val.toDate ? val.toDate() : new Date(val + (typeof val === 'string' && val.length === 10 ? 'T00:00:00' : ''));
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch(e) { return String(val || ''); }
}

const params = new URLSearchParams(location.search);
const cid = params.get('id');

if (!cid || typeof FIREBASE_CONFIG === 'undefined' || !FIREBASE_CONFIG.apiKey) {
  fail();
  return;
}

firebase.initializeApp(FIREBASE_CONFIG);
const db = firebase.firestore();
let contract = null;
let company = {};

db.collection('settings').doc('company').get().then(doc => {
  company = doc.exists ? doc.data() : {};
  const logoUrl = (company.logo || '').trim();
  if (!logoUrl) return;
  const img = document.getElementById('ctLogoImg');
  img.onload = () => { img.style.display = 'block'; document.getElementById('ctLogoText').style.display = 'none'; };
  img.onerror = () => {};
  img.src = logoUrl;
}).catch(() => {});

db.collection('contracts').doc(cid).get().then(doc => {
  if (!doc.exists) { fail(); return; }
  contract = doc.data();
  render();
  show('pageScreen');
  maybePrint();
}).catch(err => { console.error(err); fail(); });

function maybePrint() {
  if (params.get('print')) setTimeout(() => window.print(), 600);
}

function partyBlock(label, name, address, email, phone) {
  return `<div>
    <div class="ct-party-label">${escHtml(label)}</div>
    <div class="ct-party-name">${escHtml(name || '—')}</div>
    ${address ? `<div class="ct-party-line">${escHtml(address)}</div>` : ''}
    ${email ? `<div class="ct-party-line">${escHtml(email)}</div>` : ''}
    ${phone ? `<div class="ct-party-line">${escHtml(phone)}</div>` : ''}
  </div>`;
}

function deliverablesTable(items) {
  if (!items || !items.length) return '';
  return `<div class="ct-table-wrap"><table class="ct-table">
    <thead><tr><th>Deliverable</th><th>Detail</th><th>Timeline</th><th>Due</th><th>Status</th></tr></thead>
    <tbody>${items.map(d => `<tr>
      <td><strong>${escHtml(d.label)}</strong></td>
      <td>${escHtml(d.detail || '')}</td>
      <td>${escHtml(d.dueRule || '')}</td>
      <td>${d.dueDate ? escHtml(fmtDate(d.dueDate)) : '—'}</td>
      <td><span class="ct-deliv-status ${d.delivered ? 'delivered' : 'pending'}">${d.delivered ? 'Delivered' : 'Pending'}</span></td>
    </tr>`).join('')}</tbody>
  </table></div>`;
}

function sigBox(role, sig) {
  if (sig && sig.name) {
    return `<div class="ct-sig-box done">
      <div class="ct-sig-role">${escHtml(role)}</div>
      <div class="ct-sig-name">${escHtml(sig.name)}</div>
      ${sig.title ? `<div class="ct-sig-meta">${escHtml(sig.title)}</div>` : ''}
      <div class="ct-sig-meta">Signed ${fmtDate(sig.signedAt)}</div>
    </div>`;
  }
  return `<div class="ct-sig-box">
    <div class="ct-sig-role">${escHtml(role)}</div>
    <div class="ct-sig-pending"><i class="fa-regular fa-clock"></i> Awaiting signature</div>
  </div>`;
}

function render() {
  const c = contract;
  document.title = (c.title || 'Contract') + ' — Fifteen';
  document.getElementById('ctTitle').textContent = c.title || 'Contract';
  document.getElementById('ctSub').textContent = c.counterpartyName ? 'Between Fifteen and ' + c.counterpartyName : '';
  document.getElementById('ctMeta').textContent = c.effectiveDate ? 'Effective Date: ' + fmtDate(c.effectiveDate) : '';
  document.getElementById('ctTagWrap').innerHTML = c.status === 'terminated'
    ? '<span class="ct-tag terminated">Terminated</span>'
    : c.status === 'executed' ? '<span class="ct-tag">Fully Executed</span>' : '';

  let html = '';

  html += `<div class="ct-box"><div class="ct-sec-title">Parties</div><div class="ct-parties">
    ${partyBlock('Service Provider', company.name, company.address, company.email, company.phone)}
    ${partyBlock(c.type === 'vendor' ? 'Vendor' : 'Client', c.counterpartyName, c.counterpartyAddress, c.counterpartyEmail, c.counterpartyPhone)}
  </div></div>`;

  if (c.intro) html += `<div class="ct-box"><div class="ct-sec-title">Recitals</div><div class="ct-prose">${escHtml(c.intro)}</div></div>`;

  if ((c.deliverables || []).length) {
    html += `<div class="ct-box"><div class="ct-sec-title">Scope of Services &amp; Delivery Timeline</div>${deliverablesTable(c.deliverables)}</div>`;
  }

  if (c.compensation && (c.compensation.summary || c.compensation.term)) {
    html += `<div class="ct-box"><div class="ct-sec-title">Compensation</div>
      ${c.compensation.summary ? `<div class="ct-comp-row"><span class="ct-comp-label">Fees</span><span>${escHtml(c.compensation.summary)}</span></div>` : ''}
      ${c.compensation.term ? `<div class="ct-comp-row"><span class="ct-comp-label">Term</span><span>${escHtml(c.compensation.term)}</span></div>` : ''}
      ${c.compensation.invoicing ? `<div class="ct-comp-row"><span class="ct-comp-label">Invoicing</span><span>${escHtml(c.compensation.invoicing)}</span></div>` : ''}
      ${c.compensation.lateFees ? `<div class="ct-comp-row"><span class="ct-comp-label">Late Fees</span><span>${escHtml(c.compensation.lateFees)}</span></div>` : ''}
    </div>`;
  }

  (c.sections || []).forEach((sec, i) => {
    html += `<div class="ct-box"><div class="ct-section-title">${i + 1}. ${escHtml(sec.title)}</div><div class="ct-prose">${escHtml(sec.body)}</div></div>`;
  });

  html += `<div class="ct-box"><div class="ct-sec-title">Execution</div><div class="ct-sig-grid" id="ctSigGrid">
    ${sigBox('Service Provider', c.providerSignature)}
    <div id="ctCounterpartySigSlot"></div>
  </div></div>`;

  document.getElementById('ctBody').innerHTML = html;
  document.getElementById('printBtn').style.display = 'flex';
  renderCounterpartySignature();
}

function renderCounterpartySignature() {
  const slot = document.getElementById('ctCounterpartySigSlot');
  const roleLabel = contract.type === 'vendor' ? 'Vendor' : 'Client';
  if (contract.counterpartySignature && contract.counterpartySignature.name) {
    slot.outerHTML = `<div id="ctCounterpartySigSlot">${sigBox(roleLabel, contract.counterpartySignature)}</div>`;
    return;
  }
  slot.outerHTML = `<div id="ctCounterpartySigSlot" class="ct-sig-box">
    <div class="ct-sig-role">${escHtml(roleLabel)} — Sign Below</div>
    <div class="ct-field"><label>Full Legal Name</label><input id="sigName" type="text" placeholder="Type your full name"></div>
    <div class="ct-field" style="margin-bottom:10px"><label>Title (optional)</label><input id="sigTitle" type="text" placeholder="e.g. Owner"></div>
    <label class="ct-agree"><input type="checkbox" id="sigAgree"> I have read this agreement in full and agree to be bound by its terms.</label>
    <button class="ct-sign-btn" id="signBtn">Sign &amp; Accept</button>
  </div>`;
  document.getElementById('signBtn').addEventListener('click', submitSignature);
}

async function submitSignature() {
  const name = document.getElementById('sigName').value.trim();
  const title = document.getElementById('sigTitle').value.trim();
  const agree = document.getElementById('sigAgree').checked;
  if (!name) { alert('Please type your full legal name to sign.'); return; }
  if (!agree) { alert('Please confirm you have read and agree to the terms above.'); return; }
  const btn = document.getElementById('signBtn');
  btn.disabled = true;
  btn.textContent = 'Signing…';
  const counterpartySignature = { name, title, signedAt: firebase.firestore.FieldValue.serverTimestamp() };
  const newStatus = (contract.providerSignature && contract.providerSignature.name) ? 'executed' : 'signed';
  try {
    await db.collection('contracts').doc(cid).update({ counterpartySignature, status: newStatus });
    contract.counterpartySignature = { name, title, signedAt: new Date() };
    contract.status = newStatus;
    document.getElementById('ctTagWrap').innerHTML = newStatus === 'executed' ? '<span class="ct-tag">Fully Executed</span>' : '';
    renderCounterpartySignature();
  } catch(e) {
    console.error(e);
    btn.disabled = false;
    btn.textContent = 'Sign & Accept';
    alert('Something went wrong recording your signature. Please try again: ' + e.message);
  }
}

})();
</script>
</body>
</html>
```

- [ ] **Step 2: Verify in a browser**

Run: `cd /home/user/fifteen-pro && npx serve -l 3333` (background it or open a second terminal), then open `http://localhost:3333/contract.html?id=doesnotexist`.
Expected: the loading spinner briefly shows, then the "Link Not Found" error card (since `firebase-config.js` points at a real Firestore project but the doc id doesn't exist — confirms the error path and that Firebase initializes without console errors). Check the browser console for JS errors — there should be none.

- [ ] **Step 3: Commit**

```bash
git add contract.html
git commit -m "feat: add public contract review and signing page"
```

---

## Task 3: admin.html — Contracts tab scaffold (nav, panel shell, state)

**Files:**
- Modify: `admin.html`

- [ ] **Step 1: Add `'contracts'` to the `TABS` array**

Find the `TABS` array declaration (`const TABS = ['overview','applications','orders','tickets','access','services-mgmt','tasks','invoices','questionnaires','company','pricing','services','expertise','vendors','audit','notifications'];`) and insert `'contracts'` right after `'questionnaires'`:

```js
const TABS = ['overview','applications','orders','tickets','access','services-mgmt','tasks','invoices','questionnaires','contracts','company','pricing','services','expertise','vendors','audit','notifications'];
```

- [ ] **Step 2: Add the dispatch line in `switchTab`**

Find the line `if (name === 'questionnaires') loadQuestionnaires();` inside `switchTab(name)` and add immediately after it:

```js
  if (name === 'contracts') loadContracts();
```

- [ ] **Step 3: Add the sidebar nav button**

Find the Questionnaires sidebar button:
```html
<button class="sb-tab" data-tab="questionnaires" onclick="switchTab('questionnaires')">
  <i class="fa-solid fa-list-ol"></i> Questionnaires
</button>
```
Add immediately after it:
```html
<button class="sb-tab" data-tab="contracts" onclick="switchTab('contracts')">
  <i class="fa-solid fa-file-signature"></i> Contracts
</button>
```

- [ ] **Step 4: Add the panel skeleton**

Find the closing `</div>` of `<div class="dash-panel" id="panel-questionnaires">` (i.e. the panel's outer closing tag, right before whatever panel comes next) and insert this new panel immediately after it:

```html
<!-- ═══ CONTRACTS PANEL ═══ -->
<div class="dash-panel" id="panel-contracts">
  <div class="panel-heading">Contracts</div>
  <div class="panel-sub">Build reusable contract templates, then generate a signed engagement for a customer or a 3rd-party vendor — each side signs via its own link, no login required.</div>

  <div style="display:flex;gap:8px;margin-bottom:16px">
    <button class="subnav-pill" id="ctViewBtn-list" onclick="setContractsView('list')">Contracts</button>
    <button class="subnav-pill" id="ctViewBtn-templates" onclick="setContractsView('templates')">Templates</button>
  </div>

  <div id="contractsListView">
    <div class="form-card" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
      <div style="font-size:12.5px;color:var(--text-dim);max-width:520px">Every contract is generated from a template, then customized per engagement — parties, effective date, delivery dates, and every clause can be edited before sending.</div>
      <button class="form-save" style="margin:0" onclick="openContractModal()"><i class="fa-solid fa-plus"></i> New Contract</button>
    </div>
    <div class="data-table-wrap">
      <table class="data-table" id="contractsTable">
        <thead><tr><th>Title</th><th>Type</th><th>Counterparty</th><th>Status</th><th>Effective Date</th><th>Actions</th></tr></thead>
        <tbody id="contractsTableBody">
          <tr><td colspan="6"><div class="empty-state"><i class="fa-solid fa-file-signature"></i>Loading contracts…</div></td></tr>
        </tbody>
      </table>
    </div>
  </div>

  <div id="contractsTemplatesView" style="display:none">
    <div class="form-card" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
      <div style="font-size:12.5px;color:var(--text-dim);max-width:520px">Templates define the default clauses, delivery timeline, and compensation terms for a contract type — build from scratch or load the sample agreement.</div>
      <button class="form-save" style="margin:0" onclick="openContractTemplateModal()"><i class="fa-solid fa-plus"></i> New Template</button>
    </div>
    <div class="form-card" style="max-width:900px">
      <div class="form-card-title">Contract Templates</div>
      <div id="contractTemplateListWrap"></div>
    </div>
  </div>
</div>
```

- [ ] **Step 5: Add state variables and the view-toggle function**

Find where other panel-scoped state arrays are declared near the top of the inline `<script>` block (e.g. near `let questionnaires = [];` / `let vendors = [];`) and add:

```js
let contractTemplates = [];
let contracts = [];
let editingContractTemplateId = null;
let editingTplSections = [];
let editingTplDeliverables = [];
let editingContractId = null;
let editingContractSections = [];
let editingContractDeliverables = [];
let editingContractIntro = '';
let editingContractCompensation = {};
let editingContractType = 'customer';
let contractCustomersCache = {};
let contractsView = 'list';

function setContractsView(view) {
  contractsView = view;
  document.getElementById('contractsListView').style.display = view === 'list' ? 'block' : 'none';
  document.getElementById('contractsTemplatesView').style.display = view === 'templates' ? 'block' : 'none';
  document.getElementById('ctViewBtn-list').classList.toggle('active', view === 'list');
  document.getElementById('ctViewBtn-templates').classList.toggle('active', view === 'templates');
  if (view === 'templates' && !contractTemplates.length) loadContractTemplates();
}
```

- [ ] **Step 6: Verify the scaffold renders**

Run `npx serve -l 3333`, open `http://localhost:3333/admin.html`, sign in as an admin (per `SECURITY.md`), and click the new "Contracts" sidebar button. Expected: the panel shows with "Contracts"/"Templates" pill toggle, an empty contracts table showing "Loading contracts…" (since `loadContracts()` isn't defined until Task 4 — check the browser console; a `ReferenceError: loadContracts is not defined` here is expected and fine at this checkpoint, it'll be resolved by the next task). Confirm no other tabs broke (click through Questionnaires and Vendors to confirm they still render).

- [ ] **Step 7: Commit**

```bash
git add admin.html
git commit -m "feat: scaffold Contracts tab in admin.html"
```

---

## Task 4: admin.html — Contract Templates CRUD

**Files:**
- Modify: `admin.html`

- [ ] **Step 1: Add the load/render functions**

Add near the other `load*`/`render*` functions (e.g. right after `loadVendors`/`renderVendorList`):

```js
async function loadContractTemplates() {
  if (!db) return;
  try {
    const snap = await db.collection('contractTemplates').orderBy('name').get().catch(() => db.collection('contractTemplates').get());
    contractTemplates = snap.docs.map(d => ({ docId: d.id, ...d.data() }));
  } catch(e) { contractTemplates = []; toast('Failed to load contract templates: ' + e.message, 'error'); }
  renderContractTemplateList();
}

function renderContractTemplateList() {
  const wrap = document.getElementById('contractTemplateListWrap');
  if (!wrap) return;
  if (!contractTemplates.length) {
    wrap.innerHTML = '<div class="empty-state" style="padding:20px"><i class="fa-solid fa-file-signature"></i>No templates yet — create one or load the sample agreement.</div>';
    return;
  }
  wrap.innerHTML = contractTemplates.map(t => `
    <div class="customer-row" style="cursor:pointer" onclick="openContractTemplateModal('${t.docId}')" title="Edit template">
      <div><div class="customer-name">${escHtml(t.name || 'Untitled')}</div><div style="font-size:11px;color:var(--text-dim)">${(t.deliverables || []).length} deliverable${(t.deliverables || []).length === 1 ? '' : 's'} · ${(t.sections || []).length} section${(t.sections || []).length === 1 ? '' : 's'}</div></div>
      <div class="customer-email"><span class="status-badge ${t.type === 'vendor' ? 'status-pending' : 'status-approved'}">${escHtml(t.type || 'customer')}</span></div>
    </div>
  `).join('');
}
```

- [ ] **Step 2: Add the template builder open/close/save/delete functions**

```js
function renderTplBuilder() {
  const secWrap = document.getElementById('tplSectionsWrap');
  secWrap.innerHTML = editingTplSections.map((sec, i) => `
    <div class="form-card" style="margin-bottom:10px">
      <div class="f-field"><label>Section ${i + 1} Title</label><input value="${escHtml(sec.title)}" oninput="editingTplSections[${i}].title = this.value"></div>
      <div class="f-field" style="margin-bottom:0"><label>Section Body</label><textarea rows="4" oninput="editingTplSections[${i}].body = this.value">${escHtml(sec.body)}</textarea></div>
      <button type="button" class="btn-reject" style="margin-top:8px" onclick="editingTplSections.splice(${i},1); renderTplBuilder();">Remove Section</button>
    </div>
  `).join('');

  const delivWrap = document.getElementById('tplDeliverablesWrap');
  delivWrap.innerHTML = editingTplDeliverables.map((d, i) => `
    <div class="form-card" style="margin-bottom:10px">
      <div class="form-grid">
        <div class="f-field"><label>Deliverable</label><input value="${escHtml(d.label)}" oninput="editingTplDeliverables[${i}].label = this.value"></div>
        <div class="f-field"><label>Timeline / Due Rule</label><input placeholder="e.g. Within 7 Business Days of Effective Date" value="${escHtml(d.dueRule)}" oninput="editingTplDeliverables[${i}].dueRule = this.value"></div>
      </div>
      <div class="f-field" style="margin-bottom:0"><label>Detail</label><input value="${escHtml(d.detail)}" oninput="editingTplDeliverables[${i}].detail = this.value"></div>
      <button type="button" class="btn-reject" style="margin-top:8px" onclick="editingTplDeliverables.splice(${i},1); renderTplBuilder();">Remove Deliverable</button>
    </div>
  `).join('');
}

function addTplSection() { editingTplSections.push({ title: '', body: '' }); renderTplBuilder(); }
function addTplDeliverable() { editingTplDeliverables.push({ id: 'd' + Date.now() + Math.random().toString(36).slice(2, 6), label: '', detail: '', dueRule: '' }); renderTplBuilder(); }

function openContractTemplateModal(docId) {
  editingContractTemplateId = docId || null;
  const t = docId ? contractTemplates.find(x => x.docId === docId) : null;
  document.getElementById('tpl-modal-title').textContent = t ? 'Edit Contract Template' : 'New Contract Template';
  document.getElementById('tpl-name').value = (t && t.name) || '';
  document.getElementById('tpl-type').value = (t && t.type) || 'customer';
  document.getElementById('tpl-intro').value = (t && t.intro) || '';
  document.getElementById('tpl-comp-summary').value = (t && t.compensation && t.compensation.summary) || '';
  document.getElementById('tpl-comp-term').value = (t && t.compensation && t.compensation.term) || '';
  document.getElementById('tpl-comp-invoicing').value = (t && t.compensation && t.compensation.invoicing) || '';
  document.getElementById('tpl-comp-latefees').value = (t && t.compensation && t.compensation.lateFees) || '';
  editingTplSections = t ? JSON.parse(JSON.stringify(t.sections || [])) : [];
  editingTplDeliverables = t ? JSON.parse(JSON.stringify(t.deliverables || [])) : [];
  document.getElementById('tpl-delete-btn').style.display = t ? '' : 'none';
  renderTplBuilder();
  document.getElementById('contractTemplateModal').classList.add('open');
}

function closeContractTemplateModal() {
  document.getElementById('contractTemplateModal').classList.remove('open');
  editingContractTemplateId = null; editingTplSections = []; editingTplDeliverables = [];
}

async function saveContractTemplate() {
  if (!db) { toast('Firebase not connected', 'error'); return; }
  const name = document.getElementById('tpl-name').value.trim();
  if (!name) { toast('Enter a template name', 'error'); return; }
  const payload = {
    name,
    type: document.getElementById('tpl-type').value === 'vendor' ? 'vendor' : 'customer',
    intro: document.getElementById('tpl-intro').value.trim(),
    sections: editingTplSections.filter(s => s.title.trim()).map(s => ({ title: s.title.trim(), body: s.body.trim() })),
    deliverables: editingTplDeliverables.filter(d => d.label.trim()).map(d => ({ id: d.id, label: d.label.trim(), detail: (d.detail || '').trim(), dueRule: (d.dueRule || '').trim() })),
    compensation: {
      summary: document.getElementById('tpl-comp-summary').value.trim(),
      term: document.getElementById('tpl-comp-term').value.trim(),
      invoicing: document.getElementById('tpl-comp-invoicing').value.trim(),
      lateFees: document.getElementById('tpl-comp-latefees').value.trim()
    }
  };
  try {
    if (editingContractTemplateId) {
      payload.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
      await db.collection('contractTemplates').doc(editingContractTemplateId).update(payload);
      await AppUtils.logAudit(currentAdminIdentity(), 'update', editingContractTemplateId, 'contractTemplate', { name });
    } else {
      payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      payload.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
      const ref = await db.collection('contractTemplates').add(payload);
      await AppUtils.logAudit(currentAdminIdentity(), 'create', ref.id, 'contractTemplate', { name });
    }
    toast('✓ Template saved', 'success');
    closeContractTemplateModal();
    await loadContractTemplates();
  } catch(e) { toast('Save failed: ' + e.message, 'error'); }
}

function deleteContractTemplate() {
  if (!editingContractTemplateId) return;
  const docId = editingContractTemplateId;
  const t = contractTemplates.find(x => x.docId === docId);
  AppUtils.showConfirm('Delete Template', `Delete "${(t && t.name) || 'this template'}"? This does not affect any contracts already generated from it.`, async () => {
    try {
      await db.collection('contractTemplates').doc(docId).delete();
      await AppUtils.logAudit(currentAdminIdentity(), 'delete', docId, 'contractTemplate', {});
      toast('✓ Template deleted', 'success');
      closeContractTemplateModal();
      await loadContractTemplates();
    } catch(e) { toast('Delete failed: ' + e.message, 'error'); }
  });
}
```

- [ ] **Step 3: Add the template modal HTML**

Find the `vendorModal` markup (`<div class="modal-overlay" id="vendorModal">...</div>`) and insert this new modal immediately after its closing `</div>`:

```html
<div class="modal-overlay" id="contractTemplateModal">
  <div class="modal-box modal-box-full" style="overflow-y:auto;text-align:left">
    <h3 id="tpl-modal-title">New Contract Template</h3>
    <div class="form-grid" style="margin-top:14px">
      <div class="f-field"><label>Template Name</label><input id="tpl-name" placeholder="e.g. Digital Marketing Services Agreement"></div>
      <div class="f-field"><label>Type</label>
        <select id="tpl-type"><option value="customer">Customer Agreement</option><option value="vendor">Vendor Agreement</option></select>
      </div>
    </div>
    <div class="f-field"><label>Recitals / Intro</label><textarea id="tpl-intro" rows="3" placeholder="WHEREAS Client desires to engage Provider..."></textarea></div>

    <div style="display:flex;gap:10px;align-items:center;margin:16px 0 12px;flex-wrap:wrap">
      <button type="button" class="btn-reject" onclick="loadSampleContractTemplate()"><i class="fa-solid fa-file-import"></i> Load Sample Agreement</button>
      <span style="font-size:11px;color:var(--text-dim)">Pre-fills the Digital Marketing Services Agreement sample — edit or delete anything before saving.</span>
    </div>

    <div class="form-card-title" style="margin-top:10px">Scope of Services &amp; Delivery Timeline</div>
    <div id="tplDeliverablesWrap"></div>
    <button type="button" class="btn-approve" onclick="addTplDeliverable()">+ Add Deliverable</button>

    <div class="form-card-title" style="margin-top:18px">Compensation</div>
    <div class="form-grid">
      <div class="f-field"><label>Fees Summary</label><input id="tpl-comp-summary" placeholder="e.g. $450/mo (Months 1-3), $350/mo (Month 4+)"></div>
      <div class="f-field"><label>Term</label><input id="tpl-comp-term" placeholder="e.g. Initial 3-month term, auto-renewing"></div>
      <div class="f-field"><label>Invoicing</label><input id="tpl-comp-invoicing" placeholder="e.g. Invoiced 1st of month, net-5"></div>
      <div class="f-field"><label>Late Fees</label><input id="tpl-comp-latefees" placeholder="e.g. $25 after the 10th"></div>
    </div>

    <div class="form-card-title" style="margin-top:18px">Contract Sections</div>
    <div id="tplSectionsWrap"></div>
    <button type="button" class="btn-approve" style="margin-top:4px" onclick="addTplSection()">+ Add Section</button>

    <div class="modal-actions" style="margin-top:18px;flex-wrap:wrap">
      <button class="modal-cancel" onclick="closeContractTemplateModal()">Cancel</button>
      <button id="tpl-delete-btn" class="btn-reject" onclick="deleteContractTemplate()" style="display:none">Delete</button>
      <button class="modal-confirm" onclick="saveContractTemplate()">Save Template</button>
    </div>
  </div>
</div>
```

- [ ] **Step 4: Register the backdrop-click-to-close handler**

Find the `DOMContentLoaded` block near the end of the file where other modals register their backdrop click handler (e.g. `document.getElementById('vendorModal').addEventListener('click', e => { if (e.target === document.getElementById('vendorModal')) closeVendorModal(); });`) and add immediately after it:

```js
document.getElementById('contractTemplateModal').addEventListener('click', e => {
  if (e.target === document.getElementById('contractTemplateModal')) closeContractTemplateModal();
});
```

- [ ] **Step 5: Verify in browser**

Reload admin.html, go to Contracts → Templates, click "New Template". Fill in a name, click "+ Add Deliverable" and "+ Add Section", type into a few fields, click "Save Template". Expected: toast "✓ Template saved", modal closes, the new template appears in the list with the correct type badge and counts. Click the row to reopen it in edit mode and confirm the previously typed values are all still present. Click "Delete" and confirm it disappears from the list.

- [ ] **Step 6: Commit**

```bash
git add admin.html
git commit -m "feat: add contract template CRUD to admin.html"
```

---

## Task 5: admin.html — seed the sample Digital Marketing Services Agreement template

**Files:**
- Modify: `admin.html`

This is the direct product of the attached `Digital_Marketing_Services_Agreement_V2.md` — its Section 1 SLA bullets become `deliverables`, Section 2 becomes the structured `compensation` block, and Sections 3–12 become prose `sections`. Mirrors `DISCOVERY_TEMPLATE`/`loadDiscoveryTemplate()` exactly.

- [ ] **Step 1: Add the `CONTRACT_SAMPLE_TEMPLATE` constant**

Add near `DISCOVERY_TEMPLATE`'s declaration:

```js
const CONTRACT_SAMPLE_TEMPLATE = {
  name: 'Digital Marketing Services Agreement',
  type: 'customer',
  intro: `This Agreement is made and entered into as of the Effective Date shown above, by and between the Service Provider and the Client identified above.

WHEREAS, Client desires to engage Provider to render digital marketing services, and Provider agrees to render such services subject to the terms and conditions set forth herein.

NOW, THEREFORE, in consideration of the mutual covenants contained herein, the Parties agree as follows.

Condition Precedent to Timelines: Provider's obligation to adhere to the delivery dates below is expressly contingent upon Client's timely provision of required assets, access, and approvals. Failure by Client to meet such prerequisites shall operate as a tolling mechanism, automatically extending Provider's delivery deadlines by the duration of Client's delay. Requests for services outside this Scope of Services shall be deemed "Additional Services." Provider will notify Client of any additional costs prior to execution, and such work shall be governed by a separate SOW or written email agreement.`,
  deliverables: [
    { id: 'gbp-init', label: 'GBP Initial Optimization', detail: 'Full optimization of the Google Business Profile.', dueRule: 'Within 7 Business Days of the Effective Date' },
    { id: 'gbp-weekly', label: 'GBP Weekly Publications', detail: 'One GBP post drafted, scheduled, and published.', dueRule: 'Every Monday, no later than 12:00 PM EST' },
    { id: 'gbp-reviews', label: 'GBP Reputation Management — Reviews', detail: 'Professional responses to newly published customer reviews.', dueRule: 'Within 24 hours of posting' },
    { id: 'gbp-qa', label: 'GBP Reputation Management — Q&A', detail: 'Responses to new Q&A inquiries.', dueRule: 'Within 48 hours of posting' },
    { id: 'gbp-reviewsys', label: 'Review Growth System', detail: 'Delivery of the proprietary Review Growth System (QR code assets + request scripts).', dueRule: 'Within 10 Business Days of the Effective Date' },
    { id: 'social-calendar', label: 'Strategic Content Calendar', detail: 'Subsequent month\'s content calendar submitted for review.', dueRule: 'No later than the 25th of the preceding month' },
    { id: 'social-feed', label: 'Feed Content Execution', detail: '3 platform-compliant feed posts per platform, published weekly.', dueRule: 'Weekly, no later than 10:00 AM EST on pre-agreed days' },
    { id: 'social-stories', label: 'Story Implementation', detail: '3 strategic Stories per platform, published weekly.', dueRule: 'Weekly' },
    { id: 'social-community', label: 'Community Management', detail: 'Responses to direct customer inquiries and pertinent comments.', dueRule: 'Within 24 hours during standard Business Days' },
    { id: 'content-templates', label: 'Template Generation', detail: '2 bespoke graphic templates delivered.', dueRule: 'Within 14 Business Days of onboarding' },
    { id: 'content-video', label: 'Video Post-Production', detail: 'Up to 4 reels edited per month; final deliverables submitted.', dueRule: 'Within 5 Business Days of receipt of raw assets' },
    { id: 'web-landing', label: 'Landing Page Deployment', detail: 'One-page landing page presented for review; launch upon approval.', dueRule: 'Draft within 14 Business Days of onboarding; launch within 48 hours of approval' },
    { id: 'web-updates', label: 'Routine Alterations', detail: 'Standard updates (hours, banners, links).', dueRule: 'Within 48 hours of written request' },
    { id: 'web-analytics', label: 'Analytics Integration', detail: 'Basic tracking infrastructure installed and verified.', dueRule: 'Within 7 Business Days of granting platform access' },
    { id: 'monthly-report', label: 'Monthly Performance Report', detail: 'Comprehensive report covering GBP analytics, direction requests, review velocity, and social reach.', dueRule: 'By the 5th Business Day of the subsequent month' }
  ],
  compensation: {
    summary: 'Months 1–3: $450.00 USD/month (inclusive of initial web construction). Month 4 onward: $350.00 USD/month.',
    term: 'Initial term of three (3) calendar months, auto-renewing on a month-to-month basis thereafter.',
    invoicing: 'Invoices generated on the 1st of each month. Payment strictly due net-five (5) days.',
    lateFees: '$25.00 late fee if unpaid by the 10th of the month. Services may be suspended without liability if unpaid past the 15th, with a $50.00 reactivation fee upon restoration. Unpaid balances accrue interest at 1.5% per month or the maximum rate permitted by Florida law.'
  },
  sections: [
    { title: 'Exclusions & Extracurricular Services', body: 'Services explicitly excluded from this Agreement include, but are not limited to: paid media spend, ad management, on-site commercial photography/videography, influencer procurement, and third-party SaaS licensing. Any request for extracurricular services shall require the execution of a separate Statement of Work (SOW) and corresponding fee structure.' },
    { title: 'Industry-Specific Compliance & Disclaimers', body: 'Client acknowledges that marketing in a regulated or restricted industry may be subject to stringent, arbitrary, and rapidly evolving algorithmic restrictions by third-party platforms (including Meta, TikTok, and Google). Provider shall utilize industry-best "safe-harbor" content strategies. However, PROVIDER MAKES NO GUARANTEES, EXPRESS OR IMPLIED, REGARDING ACCOUNT LONGEVITY, IMMUNITY FROM SHADOW-BANNING, ALGORITHMIC REACH, SALES VOLUMES, OR REVENUE GENERATION. All services are rendered on an "AS IS" and "BEST EFFORTS" basis. Client agrees to indemnify and hold Provider harmless against any fines, penalties, or legal costs arising from changes to platform policies or government regulations that affect the legality, advertising viability, or visibility of Client\'s products during the term of this Agreement.' },
    { title: 'Client Obligations & Tacit Approval', body: 'Client shall furnish all necessary credentials (Administrative/Manager access level), assets, and business intelligence within three (3) Business Days of onboarding. Client shall have forty-eight (48) hours to review and approve submitted content calendars, web drafts, or creative assets. Failure to provide written rejection or revision requests within this window shall constitute irrevocable tacit approval, and Provider shall proceed to publish/execute the Deliverables as originally submitted.' },
    { title: 'Intellectual Property & Proprietary Rights', body: 'Upon receipt of full, uncontested payment for a given billing cycle, all proprietary rights, titles, and interests in the final, published Deliverables shall transfer to Client. Provider retains a perpetual, royalty-free, worldwide license to use said Deliverables for portfolio, marketing, and promotional purposes. Client shall retain no rights to Provider\'s underlying software, proprietary systems, or unpublished raw work files. Provider retains exclusive, perpetual ownership of all internal strategy documents, proprietary workflow frameworks, system blueprints, and unpublished raw work files developed in connection with this Agreement, regardless of the status of Client payments.' },
    { title: 'Confidentiality & Non-Disparagement', body: 'Both Parties shall maintain the strict confidentiality of all proprietary information, trade secrets, and non-public business data exchanged hereunder. This obligation shall survive the termination of this Agreement. Neither Party shall issue, publish, or circulate any false, derogatory, or disparaging statements regarding the other Party, its principals, or its business practices, whether orally, in writing, or via digital mediums.' },
    { title: 'Termination & Offboarding Protocols', body: 'Following the expiration of the initial term, either Party may terminate this Agreement by providing thirty (30) days\' prior written notice. Either Party may terminate immediately upon a material breach by the opposing Party, provided the breaching Party fails to cure said breach within seven (7) days of receiving written notice. Upon termination, Provider shall execute the transfer of administrative ownership of all managed accounts to Client within five (5) Business Days. No prorated refunds shall be issued for partial months.' },
    { title: 'Limitation of Liability & Indemnification', body: 'IN NO EVENT SHALL PROVIDER BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES arising out of or related to this Agreement. Provider\'s total aggregate liability under this Agreement shall not exceed the total fees actually paid by Client to Provider during the three (3) months immediately preceding the event giving rise to the claim. Client shall defend, indemnify, and hold harmless Provider, its officers, directors, and agents from and against any and all third-party claims arising out of the actual sale, distribution, or formulation of Client\'s products, or Client\'s failure to comply with applicable regulations.' },
    { title: 'Force Majeure', body: 'Neither Party shall be liable for any failure to perform its obligations under this Agreement where such failure results from any cause beyond such Party\'s reasonable control, including acts of God, war, riot, embargoes, acts of civil or military authorities, fire, floods, accidents, strikes, or major third-party platform outages.' },
    { title: 'Governing Law & Dispute Resolution', body: 'This Agreement shall be governed by and construed strictly in accordance with the laws of the State of Florida. The Parties agree that any dispute arising hereunder shall be resolved exclusively in the state or federal courts located in Seminole County, Florida, and hereby irrevocably submit to the personal jurisdiction of such courts and waive any right to a trial by jury.' },
    { title: 'Entire Agreement & Severability', body: 'This Agreement embodies the entire understanding of the Parties and supersedes all prior negotiations, representations, or agreements. If any provision is held invalid or unenforceable, that provision shall be struck and the remaining provisions enforced to the fullest extent permitted by law. No amendment shall be valid unless executed in writing by both Parties.' }
  ]
};

function loadSampleContractTemplate() {
  if (!document.getElementById('tpl-name').value.trim()) document.getElementById('tpl-name').value = CONTRACT_SAMPLE_TEMPLATE.name;
  document.getElementById('tpl-type').value = CONTRACT_SAMPLE_TEMPLATE.type;
  document.getElementById('tpl-intro').value = CONTRACT_SAMPLE_TEMPLATE.intro;
  document.getElementById('tpl-comp-summary').value = CONTRACT_SAMPLE_TEMPLATE.compensation.summary;
  document.getElementById('tpl-comp-term').value = CONTRACT_SAMPLE_TEMPLATE.compensation.term;
  document.getElementById('tpl-comp-invoicing').value = CONTRACT_SAMPLE_TEMPLATE.compensation.invoicing;
  document.getElementById('tpl-comp-latefees').value = CONTRACT_SAMPLE_TEMPLATE.compensation.lateFees;
  editingTplDeliverables = JSON.parse(JSON.stringify(CONTRACT_SAMPLE_TEMPLATE.deliverables));
  editingTplSections = JSON.parse(JSON.stringify(CONTRACT_SAMPLE_TEMPLATE.sections));
  renderTplBuilder();
  toast('✓ Sample agreement loaded — edit or remove anything before saving', 'success');
}
```

- [ ] **Step 2: Verify in browser**

Contracts → Templates → New Template → click "Load Sample Agreement". Expected: name/type/intro/compensation fields populate, 15 deliverables and 10 sections appear in the builder, each editable. Save it, confirm it appears in the template list as "Digital Marketing Services Agreement" with the `customer` badge, `15 deliverables · 10 sections`.

- [ ] **Step 3: Commit**

```bash
git add admin.html
git commit -m "feat: seed sample Digital Marketing Services Agreement contract template"
```

---

## Task 6: admin.html — Contract instances (create from template, list, edit)

**Files:**
- Modify: `admin.html`

- [ ] **Step 1: Add load/render for the contracts list**

```js
async function loadContracts() {
  if (!db) return;
  try {
    const [ctSnap, custList] = await Promise.all([
      db.collection('contracts').orderBy('createdAt', 'desc').limit(500).get().catch(() => db.collection('contracts').limit(500).get()),
      getAllCustomers()
    ]);
    contractCustomersCache = {};
    custList.forEach(c => { contractCustomersCache[c.docId] = c; });
    contracts = ctSnap.docs.map(d => ({ docId: d.id, ...d.data() }));
  } catch(e) { contracts = []; toast('Failed to load contracts: ' + e.message, 'error'); }
  if (!contractTemplates.length) await loadContractTemplates();
  renderContractsTable();
}

function contractStatusBadgeClass(status) {
  if (status === 'executed') return 'status-approved';
  if (status === 'sent' || status === 'signed') return 'status-pending';
  return 'status-rejected'; // draft, terminated
}

function renderContractsTable() {
  const tbody = document.getElementById('contractsTableBody');
  if (!contracts.length) {
    tbody.innerHTML = '<tr><td colspan="6"><div class="empty-state"><i class="fa-solid fa-file-signature"></i>No contracts yet — create one from a template.</div></td></tr>';
    return;
  }
  tbody.innerHTML = '';
  contracts.forEach(c => {
    const row = tbody.insertRow();
    row.innerHTML = `
      <td>${escHtml(c.title || 'Untitled')}</td>
      <td><span class="status-badge ${c.type === 'vendor' ? 'status-pending' : 'status-approved'}">${escHtml(c.type || 'customer')}</span></td>
      <td>${escHtml(c.counterpartyName || '—')}</td>
      <td><span class="status-badge ${contractStatusBadgeClass(c.status)}">${escHtml(c.status || 'draft')}</span></td>
      <td class="td-date">${c.effectiveDate ? escHtml(c.effectiveDate) : '—'}</td>
      <td style="white-space:nowrap">
        <button class="btn-approve" onclick="window.open(getContractLink('${c.docId}'), '_blank', 'noopener')">View</button>
        ${c.status === 'draft' || c.status === 'sent' ? `<button class="btn-reject" onclick="openContractModal('${c.docId}')">Edit</button>` : ''}
        <button class="btn-reject" onclick="copyContractLink('${c.docId}')">Copy Link</button>
        <button class="btn-reject" onclick="sendContractWhatsApp('${c.docId}')"><i class="fa-brands fa-whatsapp"></i></button>
        ${c.counterpartySignature && (!c.providerSignature || !c.providerSignature.name) ? `<button class="btn-approve" onclick="countersignContract('${c.docId}')">Countersign</button>` : ''}
        ${c.status === 'executed' ? `<button class="btn-reject" onclick="terminateContract('${c.docId}')">Terminate</button>` : ''}
        <button class="btn-reject" onclick="deleteContract('${c.docId}')"><i class="fa-solid fa-trash"></i></button>
      </td>
    `;
  });
}
```

- [ ] **Step 2: Add the contract builder open/save functions**

```js
function renderContractDeliverablesEditor() {
  const wrap = document.getElementById('cb-deliverables');
  wrap.innerHTML = editingContractDeliverables.map((d, i) => `
    <div class="form-card" style="margin-bottom:8px">
      <div style="font-size:13px;font-weight:700">${escHtml(d.label)}</div>
      <div style="font-size:11.5px;color:var(--text-dim);margin-bottom:8px">${escHtml(d.detail || '')} — ${escHtml(d.dueRule || '')}</div>
      <div class="form-grid">
        <div class="f-field"><label>Due Date</label><input type="date" value="${escHtml(d.dueDate || '')}" onchange="editingContractDeliverables[${i}].dueDate = this.value"></div>
        <div class="f-field"><label>Status</label>
          <label style="display:flex;align-items:center;gap:6px;font-size:13px;margin-top:10px">
            <input type="checkbox" ${d.delivered ? 'checked' : ''} onchange="editingContractDeliverables[${i}].delivered = this.checked"> Delivered
          </label>
        </div>
      </div>
    </div>
  `).join('');
}

function onContractTemplateSelectChange() {
  const tplId = document.getElementById('cb-template').value;
  const t = contractTemplates.find(x => x.docId === tplId);
  if (!t) return;
  document.getElementById('cb-title').value = t.name;
  document.getElementById('cb-type').textContent = t.type === 'vendor' ? 'Vendor Agreement' : 'Customer Agreement';
  editingContractSections = JSON.parse(JSON.stringify(t.sections || []));
  editingContractDeliverables = (t.deliverables || []).map(d => ({ ...d, dueDate: '', delivered: false }));
  editingContractIntro = t.intro || '';
  editingContractCompensation = JSON.parse(JSON.stringify(t.compensation || {}));
  editingContractType = t.type === 'vendor' ? 'vendor' : 'customer';
  populateContractCounterpartySelect();
  renderContractDeliverablesEditor();
}

function populateContractCounterpartySelect() {
  const sel = document.getElementById('cb-counterparty');
  if (editingContractType === 'vendor') {
    sel.innerHTML = '<option value="">One-off vendor (type details below)</option>' +
      vendors.map(v => `<option value="${v.docId}">${escHtml(v.name || 'Unnamed')}</option>`).join('');
  } else {
    sel.innerHTML = '<option value="">Prospect / one-off (type details below)</option>' +
      Object.keys(contractCustomersCache).map(id => `<option value="${id}">${escHtml(contractCustomersCache[id].name || 'Unknown')}</option>`).join('');
  }
}

function onContractCounterpartySelectChange() {
  const id = document.getElementById('cb-counterparty').value;
  if (!id) return;
  if (editingContractType === 'vendor') {
    const v = vendors.find(x => x.docId === id);
    if (v) {
      document.getElementById('cb-cp-name').value = v.name || '';
      document.getElementById('cb-cp-email').value = v.email || '';
      document.getElementById('cb-cp-phone').value = v.phone || '';
    }
  } else {
    const c = contractCustomersCache[id];
    if (c) {
      document.getElementById('cb-cp-name').value = c.name || '';
      document.getElementById('cb-cp-email').value = c.email || '';
    }
  }
}

async function openContractModal(docId) {
  editingContractId = docId || null;
  if (!contractTemplates.length) await loadContractTemplates();
  if (!vendors.length) await loadVendors();
  const c = docId ? contracts.find(x => x.docId === docId) : null;
  document.getElementById('cb-modal-title').textContent = c ? 'Edit Contract' : 'New Contract';

  const tplSel = document.getElementById('cb-template');
  tplSel.innerHTML = contractTemplates.map(t => `<option value="${t.docId}">${escHtml(t.name)} (${t.type})</option>`).join('');
  tplSel.disabled = !!c;

  if (c) {
    editingContractType = c.type || 'customer';
    editingContractSections = JSON.parse(JSON.stringify(c.sections || []));
    editingContractDeliverables = JSON.parse(JSON.stringify(c.deliverables || []));
    editingContractIntro = c.intro || '';
    editingContractCompensation = JSON.parse(JSON.stringify(c.compensation || {}));
    tplSel.value = c.templateId || '';
    document.getElementById('cb-title').value = c.title || '';
    document.getElementById('cb-type').textContent = c.type === 'vendor' ? 'Vendor Agreement' : 'Customer Agreement';
    document.getElementById('cb-effective-date').value = c.effectiveDate || '';
    populateContractCounterpartySelect();
    document.getElementById('cb-counterparty').value = c.customerId || c.vendorId || '';
    document.getElementById('cb-cp-name').value = c.counterpartyName || '';
    document.getElementById('cb-cp-address').value = c.counterpartyAddress || '';
    document.getElementById('cb-cp-email').value = c.counterpartyEmail || '';
    document.getElementById('cb-cp-phone').value = c.counterpartyPhone || '';
    renderContractDeliverablesEditor();
  } else {
    editingContractSections = []; editingContractDeliverables = []; editingContractIntro = ''; editingContractCompensation = {};
    document.getElementById('cb-title').value = '';
    document.getElementById('cb-type').textContent = '—';
    document.getElementById('cb-effective-date').value = '';
    document.getElementById('cb-counterparty').innerHTML = '<option value="">Select a template first</option>';
    document.getElementById('cb-cp-name').value = '';
    document.getElementById('cb-cp-address').value = '';
    document.getElementById('cb-cp-email').value = '';
    document.getElementById('cb-cp-phone').value = '';
    document.getElementById('cb-deliverables').innerHTML = '';
    if (tplSel.options.length) { tplSel.selectedIndex = 0; onContractTemplateSelectChange(); }
  }

  document.getElementById('contractModal').classList.add('open');
}

function closeContractModal() {
  document.getElementById('contractModal').classList.remove('open');
  editingContractId = null;
}

async function saveContract() {
  if (!db) { toast('Firebase not connected', 'error'); return; }
  const title = document.getElementById('cb-title').value.trim();
  if (!title) { toast('Enter a contract title', 'error'); return; }
  const cpName = document.getElementById('cb-cp-name').value.trim();
  if (!cpName) { toast('Enter the counterparty name', 'error'); return; }
  const tplId = document.getElementById('cb-template').value;
  const tpl = contractTemplates.find(t => t.docId === tplId);
  const cpSelectId = document.getElementById('cb-counterparty').value || null;

  const payload = {
    templateId: tplId || (editingContractId ? contracts.find(c => c.docId === editingContractId).templateId : null),
    templateName: (tpl && tpl.name) || (editingContractId ? contracts.find(c => c.docId === editingContractId).templateName : ''),
    type: editingContractType,
    customerId: editingContractType === 'customer' ? cpSelectId : null,
    vendorId: editingContractType === 'vendor' ? cpSelectId : null,
    counterpartyName: cpName,
    counterpartyAddress: document.getElementById('cb-cp-address').value.trim(),
    counterpartyEmail: document.getElementById('cb-cp-email').value.trim(),
    counterpartyPhone: document.getElementById('cb-cp-phone').value.trim(),
    title,
    effectiveDate: document.getElementById('cb-effective-date').value || '',
    intro: editingContractIntro,
    sections: editingContractSections,
    deliverables: editingContractDeliverables,
    compensation: editingContractCompensation
  };

  try {
    if (editingContractId) {
      payload.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
      await db.collection('contracts').doc(editingContractId).update(payload);
      await AppUtils.logAudit(currentAdminIdentity(), 'update', editingContractId, 'contract', { title });
      toast('✓ Contract updated', 'success');
    } else {
      payload.status = 'draft';
      payload.providerSignature = null;
      payload.counterpartySignature = null;
      payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      payload.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
      const ref = await db.collection('contracts').add(payload);
      await AppUtils.logAudit(currentAdminIdentity(), 'create', ref.id, 'contract', { title });
      toast('✓ Contract created — copy its link to send it', 'success');
    }
    closeContractModal();
    await loadContracts();
  } catch(e) { toast('Save failed: ' + e.message, 'error'); }
}

function deleteContract(docId) {
  const c = contracts.find(x => x.docId === docId);
  AppUtils.showConfirm('Delete Contract', `Delete "${(c && c.title) || 'this contract'}"? This cannot be undone.`, async () => {
    try {
      await db.collection('contracts').doc(docId).delete();
      await AppUtils.logAudit(currentAdminIdentity(), 'delete', docId, 'contract', {});
      toast('✓ Contract deleted', 'success');
      await loadContracts();
    } catch(e) { toast('Delete failed: ' + e.message, 'error'); }
  });
}
```

- [ ] **Step 3: Add the contract builder modal HTML**

Insert immediately after the `contractTemplateModal`'s closing `</div>` (added in Task 4):

```html
<div class="modal-overlay" id="contractModal">
  <div class="modal-box modal-box-full" style="overflow-y:auto;text-align:left">
    <h3 id="cb-modal-title">New Contract</h3>
    <div class="form-grid" style="margin-top:14px">
      <div class="f-field"><label>Template</label><select id="cb-template" onchange="onContractTemplateSelectChange()"></select></div>
      <div class="f-field"><label>Type</label><div id="cb-type" style="padding:11px 0;font-size:13.5px;font-weight:700;color:var(--text-dim)">—</div></div>
    </div>
    <div class="form-grid">
      <div class="f-field"><label>Contract Title</label><input id="cb-title" placeholder="e.g. Digital Marketing Services Agreement"></div>
      <div class="f-field"><label>Effective Date</label><input id="cb-effective-date" type="date"></div>
    </div>

    <div class="form-card-title" style="margin-top:14px">Counterparty</div>
    <div class="form-grid">
      <div class="f-field"><label>Existing Record</label><select id="cb-counterparty" onchange="onContractCounterpartySelectChange()"></select></div>
      <div class="f-field"><label>Name</label><input id="cb-cp-name" placeholder="Legal name"></div>
      <div class="f-field"><label>Email</label><input id="cb-cp-email" type="email"></div>
      <div class="f-field"><label>Phone</label><input id="cb-cp-phone" type="tel"></div>
    </div>
    <div class="f-field"><label>Address</label><input id="cb-cp-address" placeholder="Street, City, State ZIP"></div>

    <div class="form-card-title" style="margin-top:14px">Delivery Timeline</div>
    <div id="cb-deliverables"></div>

    <div class="modal-actions" style="margin-top:18px;flex-wrap:wrap">
      <button class="modal-cancel" onclick="closeContractModal()">Cancel</button>
      <button class="modal-confirm" onclick="saveContract()">Save Contract</button>
    </div>
  </div>
</div>
```

- [ ] **Step 4: Add the `getContractLink`/`copyContractLink` helpers**

```js
function getContractLink(docId) {
  return new URL('contract.html?id=' + encodeURIComponent(docId), location.href).href;
}

async function copyContractLink(docId) {
  const link = getContractLink(docId);
  try {
    await navigator.clipboard.writeText(link);
    toast('✓ Link copied', 'success');
  } catch(e) {
    window.prompt('Copy this link:', link);
  }
  const c = contracts.find(x => x.docId === docId);
  if (c && (!c.status || c.status === 'draft')) {
    try {
      await db.collection('contracts').doc(docId).update({ status: 'sent', sentAt: firebase.firestore.FieldValue.serverTimestamp() });
      await loadContracts();
    } catch(e) { /* link is already copied either way */ }
  }
}
```

- [ ] **Step 5: Register the backdrop-click-to-close handler**

Add alongside the one from Task 4, Step 4:

```js
document.getElementById('contractModal').addEventListener('click', e => {
  if (e.target === document.getElementById('contractModal')) closeContractModal();
});
```

- [ ] **Step 6: Verify in browser**

Contracts → "New Contract". Confirm the Template dropdown lists the sample template, selecting it auto-fills Title/Type and populates the 15-row Delivery Timeline editor with date pickers. Pick a customer from "Existing Record" (or type a name manually), fill Effective Date, save. Expected: toast "✓ Contract created…", it appears in the Contracts list with status `draft`. Click "Copy Link", confirm status flips to `sent` (badge updates without a manual refresh once `loadContracts()` re-runs). Click "View" and confirm `contract.html` opens in a new tab showing Parties/Recitals/Delivery Timeline table/Compensation/Sections/Execution exactly matching what was entered, with a working "Sign & Accept" panel for the client.

- [ ] **Step 7: Commit**

```bash
git add admin.html
git commit -m "feat: add contract instance builder and list to admin.html"
```

---

## Task 7: admin.html — countersign, terminate, WhatsApp send

**Files:**
- Modify: `admin.html`

- [ ] **Step 1: Add the countersign/terminate/WhatsApp functions**

Add near the other action functions from Task 6:

```js
async function countersignContract(docId) {
  const c = contracts.find(x => x.docId === docId);
  if (!c) return;
  const name = window.prompt('Type the full name to countersign as (Service Provider):', (auth && auth.currentUser && auth.currentUser.email) || '');
  if (!name || !name.trim()) return;
  const title = window.prompt('Title (optional):', '') || '';
  try {
    const providerSignature = { name: name.trim(), title: title.trim(), signedAt: firebase.firestore.FieldValue.serverTimestamp() };
    const newStatus = (c.counterpartySignature && c.counterpartySignature.name) ? 'executed' : 'signed';
    await db.collection('contracts').doc(docId).update({ providerSignature, status: newStatus });
    await AppUtils.logAudit(currentAdminIdentity(), 'update', docId, 'contract', { action: 'countersign' });
    toast(newStatus === 'executed' ? '✓ Contract fully executed' : '✓ Countersigned — awaiting counterparty signature', 'success');
    await loadContracts();
  } catch(e) { toast('Countersign failed: ' + e.message, 'error'); }
}

function terminateContract(docId) {
  const c = contracts.find(x => x.docId === docId);
  AppUtils.showConfirm('Terminate Contract', `Mark "${(c && c.title) || 'this contract'}" as terminated?`, async () => {
    try {
      await db.collection('contracts').doc(docId).update({ status: 'terminated' });
      await AppUtils.logAudit(currentAdminIdentity(), 'update', docId, 'contract', { action: 'terminate' });
      toast('✓ Contract marked terminated', 'success');
      await loadContracts();
    } catch(e) { toast('Failed: ' + e.message, 'error'); }
  });
}

function sendContractWhatsApp(docId) {
  const c = contracts.find(x => x.docId === docId);
  if (!c) return;
  const digits = (c.counterpartyPhone || '').replace(/[^\d]/g, '');
  if (!digits) { toast('This contract has no counterparty phone number on file', 'error'); return; }
  const text = `Hi${c.counterpartyName ? ' ' + c.counterpartyName : ''}! Please review and sign your agreement with Fifteen here:\n${getContractLink(docId)}\n\nLet us know if you have any questions before signing.\n— Fifteen`;
  window.open(`https://wa.me/${digits}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
}
```

- [ ] **Step 2: Verify in browser**

On a contract that has been opened via its public link and signed (use the "View" button from Task 6's verification, sign it as the counterparty in the new tab), return to the admin Contracts list and confirm a "Countersign" button now appears. Click it, provide a name via the prompt, confirm the toast says "✓ Contract fully executed" and the status badge turns green (`executed`). Confirm a "Terminate" button now appears on that row; click it, confirm the status badge changes to grey (`terminated`) and no further countersign/terminate buttons are offered. Click the WhatsApp icon on a contract that has a counterparty phone number filled in and confirm a `wa.me` tab opens with the prefilled message; on one without a phone number, confirm the error toast fires instead.

- [ ] **Step 3: Commit**

```bash
git add admin.html
git commit -m "feat: add countersign, terminate, and WhatsApp send actions for contracts"
```

---

## Task 8: `CLAUDE.md` — document the new module

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Add `contract.html` to the Files table**

Find the `| Files |` table row for `report.html` and add a new row immediately after it:

```
| `contract.html` | Public contract review + signing page: `?id=` opens a customer- or vendor-facing contract instance (no login), shows parties/recitals/delivery timeline/compensation/clauses, and lets the counterparty type-sign it (name + timestamp); `&print=1` auto-opens the print dialog |
```

- [ ] **Step 2: Add the two new collections to the Firebase Collections block**

Find the `vendors/{id}` collection block in the "Firebase Collections" fenced code block and insert the following immediately after it (before `customerTimeline/{customerId}/...`):

```
contractTemplates/{id}   — reusable contract templates (admin.html Contracts tab → Templates)
  name, type: 'customer' | 'vendor'
  intro                    — recitals/whereas prose
  sections: [{ title, body }]                        — numbered prose clauses
  deliverables: [{ id, label, detail, dueRule }]      — Scope of Services / SLA timeline defaults
  compensation: { summary, term, invoicing, lateFees }
  createdAt, updatedAt
  — Never exposed publicly; seeds new contracts/{id} instances. Includes a built-in
    "Load Sample Agreement" template (Digital Marketing Services Agreement) as a starting point.

contracts/{id}           — one per engagement, behind contract.html?id=... (admin.html Contracts tab)
  templateId, templateName — snapshot of the template used
  type: 'customer' | 'vendor'
  customerId, vendorId     — optional link to customers/{uid} or vendors/{id} (mutually exclusive by type)
  counterpartyName, counterpartyAddress, counterpartyEmail, counterpartyPhone
  title, effectiveDate     — effectiveDate is 'YYYY-MM-DD'
  intro, sections: [{ title, body }], compensation: { summary, term, invoicing, lateFees }  — editable snapshot from the template
  deliverables: [{ id, label, detail, dueRule, dueDate, delivered }]  — dueDate/delivered are set per engagement
  status: 'draft' | 'sent' | 'signed' | 'executed' | 'terminated'
  providerSignature: { name, title, signedAt } | null   — set by admin in-app (Countersign button)
  counterpartySignature: { name, title, signedAt } | null — set via the public contract.html link, one time only
  createdAt, sentAt, updatedAt
  — firestore.rules: public get by direct id (same link-trust model as questionnaires/vendorQuotes); the
    counterparty may write counterpartySignature exactly once (blocked once already set), admins may do anything.
```

- [ ] **Step 3: Add a "Key User Flows" entry**

Find the end of the "Admin prices a report via a 3rd-party vendor and sends the roadmap" flow (right before "**Admin manages content:**") and insert a new flow:

```
**Admin drafts and executes a contract (customer or vendor):**
1. Admin → Contracts → Templates → build a template from scratch or **Load Sample Agreement** (the Digital Marketing Services Agreement), edit its clauses, delivery timeline, and compensation, then Save
2. Admin → Contracts → **New Contract** → pick the template (auto-fills title, clauses, and delivery timeline), pick an existing customer/vendor or type in a one-off counterparty's name/address/email/phone, set the Effective Date and each deliverable's Due Date → Save Contract (status `draft`)
3. **Copy Link** (or the WhatsApp button, if a phone number is on file) generates `contract.html?id=...` and flips status to `sent`; the counterparty opens it with no login required
4. Counterparty reviews the full agreement — parties, recitals, delivery timeline table, compensation, every clause — types their full legal name and an optional title, checks the agreement box, and clicks **Sign & Accept**; the page locks that signature in place immediately (status becomes `signed`)
5. Admin → Contracts → **Countersign** (prompts for the signing name/title) records `providerSignature`; once both signatures are present, status becomes `executed` — order doesn't matter, whichever signature lands second flips it to `executed`
6. **View** on any contract row (or the same `contract.html?id=...` link) opens the always-current state — provider and counterparty signature blocks show live status — and `&print=1` opens the print dialog for a PDF copy
7. Once executed, **Terminate** is available to mark the engagement ended (does not delete the contract or its signatures — an audit record stays in `contracts` and `auditLogs`)
```

- [ ] **Step 4: Add a "Migration Notes" bullet**

Find the "Additive — new collections" bullet in "Migration Notes" and update it to include the two new collections:

Find:
```
- **Additive — new collections**: `vendors`, `customerTimeline` (backend-
  only), `settings/markupRules`. None of these existed before; nothing
  reads or depends on them until you use the corresponding new UI (Vendors
  tab) or deploy `server/`.
```
Replace with:
```
- **Additive — new collections**: `vendors`, `customerTimeline` (backend-
  only), `settings/markupRules`, `contractTemplates`, `contracts`. None of
  these existed before; nothing reads or depends on them until you use the
  corresponding new UI (Vendors tab, Contracts tab) or deploy `server/`.
```

- [ ] **Step 5: Verify**

Read the whole updated `CLAUDE.md` back and confirm the new sections read coherently in place (correct Markdown table row alignment, code fence still balanced in the Firebase Collections block, no duplicate headings).

- [ ] **Step 6: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: document the contract module in CLAUDE.md"
```

---

## Task 9: End-to-end verification pass

**Files:** none (verification only)

- [ ] **Step 1: Full click-through in a browser**

With `npx serve -l 3333` running and signed in to `admin.html` as an admin:
1. Contracts → Templates → confirm the sample template you saved in Task 5 is present; open it, confirm all 15 deliverables and 10 sections are intact, close without changes.
2. Contracts → New Contract → build one **customer** contract from the sample template for a test counterparty clearly named e.g. `TEST DELETE ME — Acme Co`, fill an Effective Date and a couple of deliverable due dates, save.
3. Build one **vendor**-type template and contract the same way (create a minimal vendor template first if none exists — a name, one deliverable, one section is enough to prove the `type: 'vendor'` path renders distinctly), counterparty `TEST DELETE ME — Vendor Co`.
4. For each: Copy Link → open the link in a new private/incognito browser tab (so no admin session bleeds in) → confirm the full contract renders correctly (parties, timeline table, compensation, clauses) → sign as the counterparty → confirm the page updates in place to show the signed block, no page reload needed.
5. Back in admin.html, confirm both contracts now show a "Countersign" button and status `signed`; countersign both; confirm status flips to `executed` (green badge) and the "Countersign" button disappears.
6. Open each contract's `contract.html?id=...&print=1` link directly and confirm the print dialog auto-opens (cancel it — no need to actually print).
7. Terminate one of the two test contracts; confirm its badge turns grey/`terminated` and no further action buttons besides View/Copy Link/WhatsApp/Delete remain.
8. Delete both `TEST DELETE ME` contracts (and the throwaway vendor template, if you created one solely for this test) via their Delete buttons so no test data is left behind in the production Firestore project.

- [ ] **Step 2: Confirm no regressions in adjacent tabs**

Click through Questionnaires, Vendors, and Company/Pricing/Services/Expertise tabs and confirm they still load and render exactly as before — the `TABS` array and `switchTab` dispatch table were edited in Task 3, so this is the specific regression risk to check.

- [ ] **Step 3: Note the CI preview deploy**

Per `CLAUDE.md`'s "Deployment" migration note, opening a PR against `main` triggers a Firebase Hosting preview-channel deploy (`firebase-hosting-pull-request.yml`). Once the PR from this plan is opened, that preview URL is a second, safer place to repeat the smoke test in Step 1 against the real hosting environment before merge — mention the preview URL to the user when it's available rather than assuming Step 1's local pass is sufficient for merge sign-off.

- [ ] **Step 4: Final commit (if any fixups were needed)**

If Steps 1–2 above surfaced any bugs, fix them in the relevant file(s) and commit with a message describing the fix, e.g.:

```bash
git add <file>
git commit -m "fix: <describe the bug found during contract module verification>"
```

---

## Self-Review Notes (for whoever executes this plan)

- **Spec coverage:** Task 1 covers rules; Task 2 covers the public signing page; Tasks 3–7 cover the full admin CRUD + signature lifecycle for both `customer` and `vendor` contract types (satisfying "both way"); every deliverable carries a `dueRule` (from the template) and a per-contract `dueDate` (satisfying "clear timeline delivery date"); Task 5 seeds the exact attached agreement as a loadable template; Task 8 documents everything; Task 9 verifies end to end.
- **Scope boundary respected:** no merge-field engine, no auto-generated tasks/milestones from deliverables (per the "static structured fields only" answer) — `dueDate`/`delivered` are plain editable fields on the contract, nothing more.
- **Convention fidelity:** every new function follows the exact `load*`/`render*`/`open*Modal`/`close*Modal`/`save*`/`delete*` naming and structure already used by Questionnaires and Vendors; `escHtml`/`toast`/`AppUtils.logAudit`/`AppUtils.showConfirm`/`currentAdminIdentity()`/`getAllCustomers()` are reused, not reinvented; the public page reuses `questionnaire.html`/`report.html`'s screen-state/`escHtml`/`fmtDate` idioms; Firestore rules reuse the exact one-time-restricted-update shape from `questionnaires`/`vendorQuotes`.
