# Fifteen Pro — Codebase Guide

## What This Is
B2B digital solutions website for **15fifteen15 / Fifteen**. One partner per industry sector. Vanilla HTML/CSS/JS — no framework, no build step.

## Stack
- **Frontend:** Pure HTML5 + CSS3 + Vanilla JS (ES2020+)
- **Backend:** Firebase Firestore (database) + Firebase Storage (file uploads) + Firebase Auth (customer portal)
- **CDNs:** Firebase SDK v10.7.1 (compat), Font Awesome 6.5.1, Google Fonts (Inter)
- **Dev server:** `npx serve` (port 3333)
- **Live domain:** 15fifteen15.com (Firebase Hosting)

## Files

| File | Purpose |
|---|---|
| `index.html` | Public marketing site — hero, solutions grid, invest block, team, 15-question quiz/apply |
| `admin.html` | Admin dashboard at `/admin.html` — linked from sidebar (muted, below divider) |
| `portal.html` | Customer partner portal — Firebase Auth protected, linked from sidebar |
| `shop.html` | Interactive service configurator / quote builder |
| `questionnaire.html` | Public, no-login discovery questionnaire form — opened via a unique `?id=` link admin.html generates per customer (admin.html Questionnaires tab) |
| `report.html` | Public report pages: `?vq=` passcode-protected 3rd-party vendor cost sheet, `?cr=` published client engagement roadmap, `?rid=&view=internal\|client` admin-only pop-out of a saved analysis report (requires admin sign-in in the same browser), `?qid=` raw completed-questionnaire Q&A (public get-by-id, same link-trust model as `questionnaire.html?id=`); `&print=1` auto-opens the print dialog (used by admin.html's Export PDF buttons) |
| `contract.html` | Public contract review + signing page: `?id=` opens a customer- or vendor-facing contract instance (no login), shows parties/recitals/delivery timeline/compensation/clauses, and lets the counterparty type-sign it (name + timestamp); `&print=1` auto-opens the print dialog |
| `firebase-config.js` | Firebase project credentials (project: `fifteen-pro`) |
| `backend-config.js` | Optional backend service URL (`apiUrl`, empty = disabled) — see `server/README.md`. Contains no secrets, safe to commit like `firebase-config.js` |
| `app.js` | Shared admin.html utilities (`AppUtils`: HTML escaping, audit logging, confirm-modal helper) |
| `prices.json` | Service catalog fallback (loaded if Firestore unavailable) |
| `firestore.rules` | Firestore security rules (paste into Firebase console) |
| `firestore.indexes.json` | Composite indexes (deployed by CI alongside rules — see `.github/workflows/firebase-rules-deploy.yml`) |
| `storage.rules` | Firebase Storage security rules (paste into Firebase console) |
| `SECURITY.md` | Step-by-step guide for enabling the security rules |
| `server/` | Optional Node/Express backend (automated follow-ups, atomic application approval, server-verified vendor passcode) — see `server/README.md`. The site works fully without it |
| `MD/` | Source markdown for PDF guides (Products Guide, Ultimate Guide, Bundle Flyer) |

## Design System

```css
--green: #26915E        /* primary actions, accents */
--green-dim: #1d7a4c    /* hover states */
--orange: #E36C44       /* CTAs, highlights */
--cream: #E0E8CF        /* page background */
--cream-sidebar: #C6D3A4 /* sidebar background */
--cream-alt: #D5DFBE    /* alternate sections */
--text: #1C2416
--text-muted: #5A6B4E
--text-dim: #7A8B6A
font: Inter, system-ui, sans-serif
```

Layout: fixed left sidebar (268px on main site, 240px admin, 260px portal) + scrollable main area. No top bar.

## index.html — Page Sections (in order)

1. **Sidebar** — logo, nav links (Solutions, Process, Our Expertise, Build Your Plan, Apply Now), divider, Partner Portal → `portal.html`, Admin → `admin.html`, footer with social links
2. **Hero** — H1, "Apply 15 Q&A" CTA button, stat row (15 / 3 / 1)
3. **The Problem** — 3 cards: Weak Brand Authority, Stagnant Client Reach, Operational Chaos
4. **The Engine** (Solutions) — 15 products across 3 phases
5. **Invest / Process** — 2-column block: Due Diligence + Capital & Infrastructure (headings only, no body copy)
6. **Our Expertise** (Team) — 3 team cards (populated from Firestore `content/team`)
7. **Partners Strip** — scrolling marquee of partner logos
8. **Quiz / Apply** (`#apply`) — 15-question brand discovery quiz → recommendation → contact info → success + Book a Call CTA
9. **Footer** — © 2026 Fifteen. All rights reserved.

## Quiz Flow (`#apply`)

18 slides total (0-indexed), driven by `quiz-engine` IIFE in `index.html`:
- Slides 0–14: 15 questions (radio = must select to advance; checkbox = at least one box required to advance, including the explicit "None" option, which deselects any other checked box)
- Slide 15: Personalized recommendation generated from answers
- Slide 16: Contact info (name, email, phone, website, industry) — saves to Firestore on submit
- Slide 17: Success + "Book Your Strategy Call" CTA (`id="qBookBtn"` href — update to your Calendly URL)

All answers + contact saved to `applications/{id}` with `quizAnswers` object and `status: 'pending'`.

## Firebase Collections

```
settings/company        — company info, logo URL, social links, bank account (bank: { bankName, accountName,
                           accountNumber, routingNumber, swift, iban, notes }) — surfaced wherever the customer
                           needs to pay: portal.html Billing tab (when an invoice is pending/overdue),
                           contract.html's Compensation section, and report.html's published client roadmap
                           (?cr=, only when showPrices is on). Admin-only otherwise; blank fields are hidden
settings/pricing        — currency, tax, bundle discount, promo codes
settings/team           — { members: [name, ...] } — internal team roster for milestone "Assigned To"; no login, admin-managed (admin.html Tasks tab)
settings/industryContacts — { mapping: { industryName: phoneNumber, ... } } — per-industry WhatsApp routing for application quiz reports (admin.html Applications tab)
settings/notifications  — { emailApplications, emailServices, emailTickets, emailInvoices, emailRecipients, smsEnabled } — read by the optional
                           backend service's daily digest/overdue-invoice job (server/); inert if that service isn't deployed
settings/markupRules    — { defaultPct, byPhase: { 1, 2, 3 }, byService: { serviceId: pct } } — configurable markup used by
                           "Apply Rule-Based Markup" in a questionnaire report (admin.html Vendors tab); precedence is
                           service override → phase override → default
catalog/services        — 15 services with pricing (falls back to prices.json)
content/team            — 3 team member profiles + photos
admins/{uid}            — admin registry (doc id = Firebase Auth UID); managed via Firebase console

vendors/{id}            — persistent vendor directory (admin.html Vendors tab), independent of any one report
  name, email, phone, phases: [1,2,3], notes, active
  createdAt, updatedAt
  — distinct from vendorQuotes below: this is a reusable contact record; vendorQuotes is the disposable
    per-engagement passcode-protected cost sheet. vendorQuotes.vendorId can optionally link back here.
  — a vendor's edit modal also shows any contracts/{id} where vendorId matches it ("Linked Contract"), with
    an inline editor for that contract's deliverables' dueDate + cost (writes straight to the contracts doc)
    and a picker to link any existing unlinked type:'vendor' contract to this vendor

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
  intro, sections: [{ title, body }], compensation: { summary, term, invoicing, lateFees }  — editable per contract
    (no longer locked to the template's snapshot — admin.html's New/Edit Contract modal exposes all four fields)
  deliverables: [{ id, label, detail, dueRule, dueDate, delivered, cost }]  — dueDate/delivered/cost are set per
    engagement (cost is optional, admin-entered per line item — primarily used on type:'vendor' contracts to
    track what's owed to that vendor for each service, editable both from the Contracts tab and from the
    vendor's own edit modal in the Vendors tab)
  status: 'draft' | 'sent' | 'signed' | 'executed' | 'terminated'
  providerSignature: { name, title, signedAt } | null   — set by admin in-app (Countersign button)
  counterpartySignature: { name, title, signedAt } | null — set via the public contract.html link, one time only
  createdAt, sentAt, updatedAt
  — firestore.rules: public get by direct id (same link-trust model as questionnaires/vendorQuotes); the
    counterparty may write counterpartySignature exactly once (blocked once already set), admins may do anything.

customerTimeline/{customerId}/events/{id} — per-customer activity feed, maintained by the optional backend
                           service (server/) via onSnapshot listeners on tickets/invoices/tasks/
                           customerServices/questionnaires. Admin-read-only; no client (including admin.html)
                           ever writes it directly. admin.html's Customer 360 view (Access tab → click a
                           customer) builds an equivalent feed client-side from data it already has loaded,
                           so this collection isn't required for that feature — it exists for a persisted
                           history independent of the dashboard being open

applications/{id}       — partner applications from quiz
  name, email, phone, website, industry
  quizAnswers: { q0..q14 }   ← full quiz responses
  status: 'pending' | 'approved' | 'rejected'
  createdAt (serverTimestamp)
  userId (added on approval)

orders/{id}             — quotes submitted from shop.html
  name, email, phone, company
  items: [{id, name, phase, price, type}]
  oneTimeTotal, monthlyTotal
  status: 'new' | 'contacted' | 'closed'
  source: 'shop'
  createdAt (serverTimestamp)

customers/{uid}         — created when admin approves an application
  name, email, industry, applicationId
  status: 'active'
  createdAt

customerServices/{id}   — services assigned to a customer
  userId, serviceId, serviceName, phase
  status: 'pending' | 'active' | 'completed'
  startDate, completionDate
  milestones: [{taskId, title, date, completed, assignedTo, note}]
    taskId     — set when the milestone was created from a linked task (admin.html Tasks tab); kept
                 in sync when that task is completed. Milestones can still be added directly in the
                 Service Mgmt edit modal without a taskId.
    assignedTo — name from settings/team, for internal follow-up
    note       — admin-written "what was achieved" text, shown once completed (customer-visible in portal.html)
  notes
  customerPhone — for the "Send Progress Update via WhatsApp" button in admin.html

tickets/{id}            — support tickets raised by customers
  userId, subject, category, message
  status: 'open' | 'in-progress' | 'resolved'
  createdAt, updatedAt

tickets/{id}/replies/{replyId}   — reply thread on a ticket (admin.html Tickets tab + portal.html)
  from: 'customer' | 'admin', authorId, message, createdAt

invoices/{id}           — billing invoices per customer
  userId, description, amount, currency
  status: 'paid' | 'pending' | 'overdue'
  dueDate, paidDate
  source, taskId          — present when auto-created by completing a task (see tasks/{id} below)

tasks/{id}              — internal work backbone (admin.html Tasks tab), independent of any service
  customerId, customerName   — optional; null for internal/no-customer tasks
  serviceId, serviceName     — optional link to a customerServices doc
  title, description, dueDate, assignedTo
  price, currency            — invoice amount to bill on completion (0 = no auto-invoice)
  status: 'pending' | 'completed'
  note                       — "what was achieved", set on completion
  completedAt, invoiceId     — set when the task is marked complete
  createdAt
  — Marking a task complete: creates a pending invoice for customerId (if price > 0 and a customer is
    linked) and, if serviceId is set, mirrors completion into that service's milestones[] entry
    (matched by taskId) so portal.html's per-service progress bar/"Achieved" badge stays in sync.

questionnaires/{id}     — discovery questionnaires (admin.html Questionnaires tab + questionnaire.html)
  title, intro            — form heading/subtitle shown on questionnaire.html
  customerId, customerName — optional link to a customers/{uid} doc
  businessName             — free-text label (for prospects with no customer account yet)
  sections: [{ title, questions: [{ id, type, label, help, options, multi, columns, presetRows }] }]
    type: 'short' | 'long' | 'choice' | 'table'
    options, multi — choice-type only (multi = checkboxes vs radio)
    columns, presetRows — table-type only (presetRows pre-fills the first cell of each starting row)
  status: 'draft' | 'sent' | 'completed'
  answers: { [questionId]: string | string[] | string[][] }   ← filled in by the respondent
  createdAt, sentAt, completedAt
  — Each questionnaire's content can be entirely different per customer — admin.html's builder can
    start from the retail/farm-store "Discovery Template" (DISCOVERY_TEMPLATE in admin.html), the
    roofing-industry "Roofing Discovery Template" (ROOFING_DISCOVERY_TEMPLATE in admin.html — Company
    Info, Business Overview, Services Offered, Marketing & Lead Gen, Operations & Technology,
    Challenges & Pain Points, Goals & Budget), or from scratch, and every section/question can be
    freely added, edited, or removed before sending.
  — The link (questionnaire.html?id=...) requires no customer login: firestore.rules allows a public
    `get` by direct doc id (not `list`) and a one-time `update` restricted to the answers/status/
    completedAt fields, blocked once status is already 'completed'.

qnReports/{id}          — saved, editable analysis reports (admin-only; seeded by admin.html Analyze)
  questionnaireId, business, qnTitle, answered, total, pct
  facts, strengths, gaps, opps, risks, talking   — internal report content, all editable/deletable
  services: [{ key, id, name, phase, phaseLabel, desc, type, tier, score, evidence,
               catalogPrice, vendorCost, adjustment, adjustmentNote, clientPrice, inPlan }]
    vendorCost     — 3rd-party cost (typed by admin or pulled from the linked vendorQuotes doc)
    adjustment,
    adjustmentNote — set on the Final Pricing tab (Analyze → Final Pricing) to reconcile whatever
                     the vendor wrote in their cost-sheet note (rush fee, exclusion, conditional
                     pricing…) into an actual number; adjustmentNote is the admin's free-text reason.
                     vendorCost + adjustment is the "adjusted cost" both markup buttons (Apply
                     Rule-Based Markup, Apply Markup %) and the investment-estimate totals use —
                     internal only, never shown to the customer or exposed via report.html
    clientPrice    — marked-up price the customer sees (manual, via a flat "Apply Markup %", or via
                     "Apply Rule-Based Markup" using settings/markupRules, both computed from the
                     adjusted cost above)
    inPlan         — false = removed from the client-facing roadmap (still visible internally)
  clientIntro, clientStrengths, clientNeeds, clientNextSteps — client-facing content, independent copies
  vendorQuoteId, vendorPasscode, vendorStatus, vendorName, vendorNote, vendorSubmittedAt
  clientReportId, createdAt, updatedAt

vendorQuotes/{id}       — 3rd-party cost sheet behind report.html?vq=... (one per report)
  reportId, business, qnTitle                         — business name + questionnaire title, shown in
                                                        the sheet header so the vendor knows the client
  vendorId                — optional link to a vendors/{id} directory record (Create Vendor Link can
                            pick an existing vendor, or leave this unset for a one-off vendor)
  services: [{ key, name, phase, scope }]             — no internal analysis, no our prices
  passHash                — SHA-256 of the passcode. Without the optional backend service (server/)
                            deployed, this is a client-side-only gate — same link-trust model as
                            questionnaires, treat the link itself as the secret. With the backend
                            deployed (backend-config.js), the passcode is verified server-side instead:
                            the service list/scope is never sent to the browser until it matches, and
                            the cost-submission write is actually gated by it too.
  costs: { key: number }, vendorName, vendorNote      — filled in by the vendor
  status: 'pending' | 'submitted', createdAt, submittedAt
  — firestore.rules: public `get` by direct id, one-time public `update` restricted to
    costs/vendorName/vendorNote/status/submittedAt, blocked once status is 'submitted'. (When the
    backend is deployed, report.html calls it instead of writing Firestore directly for this flow.)

clientReports/{id}      — published engagement roadmap behind report.html?cr=... (one per report)
  reportId, title, business, intro, strengths, needs, nextSteps
  phases: [{ phase, label, items: [{ name, desc, price, type }] }]   — price = marked-up clientPrice
  showPrices, totals: { oneTime, monthly }, publishedAt
  — read-only snapshot: public `get` by direct id, admin-only writes; re-publishing overwrites the
    same doc so the customer's link always shows the latest published version.

auditLogs/{id}          — append-only action trail (admin.html Audit tab)
  userId, action, resourceId, resourceType, changes, timestamp, userAgent
  — Written by `AppUtils.logAudit()` (app.js) from every sensitive admin write: application approve/
    reject, order status changes, ticket replies/status, invoice/task/customerService/vendor CRUD, and
    Company/Pricing/Services/Expertise/Team/Industry Routing/Markup Rules settings saves. Customers can
    only create one specific self-service shape (portal.html requesting a service) — firestore.rules
    enforces the exact field set, so a customer can't post arbitrary audit entries.
```

## Auth

### Admin (`admin.html`)
- Firebase Auth (email/password) + must have an `admins/{uid}` doc in Firestore (see `SECURITY.md`) — no password-only fallback of any kind; without Firebase there's no data to show anyway
- Session: Firebase Auth persistence (+ `localStorage['fifteen_admin_sess']`, 8-hour expiry — a UI-visibility gate only; real access control is Firebase Auth + firestore.rules on every read/write, not this token)
- Brute-force: 5 attempts → 15-min lockout (`localStorage['fifteen_admin_att']`) — a client-side UI throttle; the real backstop against credential stuffing is Firebase Auth's own server-side rate limiting

### Customers (`portal.html`)
- Firebase Auth — Email/Password + Google OAuth
- On sign-in, checks `customers/{uid}` exists (with one automatic retry on a transient read failure before signing out); signs out if not found
- When admin approves an application: if the optional backend service (`server/`) is deployed and configured (`backend-config.js`), `admin.html` calls `POST /api/approve-application`, which creates the Auth account, `customers/{uid}` doc, and application update as one atomic server-side operation (rolling back the Auth account if any step fails). Otherwise it falls back to the client-side flow: a secondary Firebase app instance (`createUserWithEmailAndPassword` → write `customers/{uid}` → update `applications/{id}` → `sendPasswordResetEmail` → sign out secondary), with the same account-rollback-on-failure guarantee
- Customer sets their own password via the Firebase reset email link

### Security rules
- `firestore.rules` + `storage.rules` are deny-by-default; public visitors can read site content and create `applications`/`orders` only
- Follow `SECURITY.md` in order when enabling — publishing rules before creating the admin user locks the dashboard out

## Key User Flows

**New partner applies:**
1. Completes 15-question quiz on `index.html#apply`
2. Sees personalized recommendation, fills contact info → saved to `applications` collection
3. Admin sees it in `admin.html` → Applications tab → **View** shows the full quiz Q&A (readable labels, not raw `q0`..`q14` keys) alongside phone/website, plus a **Send Report via WhatsApp** button that routes the full report to whichever number is configured for that application's industry in the Industry WhatsApp Routing card (`settings/industryContacts`) — e.g. the team member or group handling that sector
4. Admin clicks Approve → Firebase Auth account created → password-reset email sent → a `customers/{uid}` doc is created
5. Customer sets password → logs in at `portal.html`
6. **Approving does NOT assign any service or create anything billable.** Nothing shows up for that customer in Service Mgmt, Orders, or Invoices until admin explicitly does step 7/8 below — the quiz answers are only a signal of what to sell them.
7. Admin → Service Mgmt → Assign Service to Customer, based on what they said they need in the quiz

**Visitor builds a plan (shop):**
1. Picks services on `shop.html` → Get Quote → fills contact details → Submit Order
2. Order saved to `orders` collection (status `new`)
3. Admin sees it in `admin.html` → Orders tab → views items/totals, marks `contacted` / `closed`

**Existing partner logs in:**
- Sidebar → Partner Portal → `portal.html` → signs in with email/password or Google
- Sees dashboard: Active Services KPI, Open Tickets, Next Milestone, Outstanding Invoices
- Services tab shows a progress bar + milestone checklist per assigned service (from `customerServices.milestones`, set by admin) — completed milestones show an "Achieved" badge next to the date, plus the admin's achievement note if one was added
- Tickets tab: opens a ticket, then can expand it to read/send replies against `tickets/{id}/replies`

**Customer opens a support ticket:**
1. Portal → Tickets → New Ticket → saved to `tickets` collection (status `open`)
2. Admin sees it in `admin.html` → Tickets tab, opens it, replies (auto-bumps status to `in-progress`) or marks `resolved`
3. Customer sees the reply in the same ticket's thread in the portal and can reply back

**Admin invoices a customer:**
1. Admin → Invoices → Create Invoice → pick customer, description, amount, currency, due date → saved to `invoices` collection (status `pending`)
   — or automatically, by completing a priced task in the Tasks tab (see below)
2. Customer sees it immediately in `portal.html` → Billing tab (amount, due date, status) and in the dashboard's Outstanding Invoices KPI
3. Admin marks it `paid` / `overdue` / back to `pending` from the Invoices tab as money comes in or a due date passes. If the optional backend service (`server/`) is deployed, a daily job also does this automatically — invoices past their due date flip to `overdue` on their own, and (if enabled in Notifications) an email digest goes out. Without that service deployed, this stays fully manual, same as before

**Admin completes a task and bills the customer:**
1. Admin → Tasks → New Task → title, optional customer + linked service, due date, assignee, and an optional invoice amount → saved to `tasks` collection (status `pending`); if a service is linked, a matching entry is also pushed into that service's `milestones[]` so the portal progress bar reflects it
2. Admin → Tasks → Complete → optional "what was achieved" note → task marked `completed`; if it had a price and a linked customer, a `pending` invoice is auto-created in `invoices` for that amount; if linked to a service, that service's matching milestone is marked completed with the same note (customer sees the "Achieved" badge in `portal.html`)
3. Every create/complete/delete on a task writes an entry to `auditLogs` (Audit tab)

**Admin sends a customer a discovery questionnaire:**
1. Admin → Questionnaires → New Questionnaire → optionally pick an existing customer (or just type a business name for a prospect), title, intro text
2. **Load Discovery Template** pre-fills a full retail/farm-store-style questionnaire (16 sections) that admin then freely edits, trims, or extends — every questionnaire's questions can differ per customer
3. Save Questionnaire → doc created in `questionnaires` with `status: 'draft'`
4. Admin → **Copy Link** (or **View → Send via WhatsApp**) → generates `questionnaire.html?id=...` and flips status to `sent`; the customer opens it with no login required
5. Customer fills it in (autosaved to their browser's localStorage as they go, in case they close the tab) and submits → `status: 'completed'`, answers saved back to the same doc — the link is then locked and can't be resubmitted
6. Admin → Questionnaires → **View** shows every answered question grouped by section; **Send via WhatsApp** on a completed questionnaire sends the full Q&A report instead of just the link; **Export PDF** opens the branded `report.html?qid=...&print=1` pop-out (same raw Q&A, print dialog auto-opens) for saving/printing a copy of the responses
7. Admin → Questionnaires → **Analyze** (shown for any questionnaire with answers) runs a rule-based sales/service-fit analyzer over the responses — no backend/AI, keyword rules matched on question wording + answer text so it works on template AND custom questionnaires. It produces an **Internal Report** (key facts, strengths/gaps/opportunities/risks, the 15 services scored into Priority/Recommended/Consider-later tiers with per-answer evidence, an investment estimate from the live catalog prices, and talking points for the sales call) and a **Client-Facing** view (polished growth plan by phase, no scores/internal evidence). Both are exportable via Copy Markdown / Download .md, plus a compact WhatsApp summary (internal digest) sent via wa.me. The analysis seeds a saved, fully editable report (`qnReports`) — see the next flow.

**Admin prices a report via a 3rd-party vendor and sends the roadmap:**
1. Admin → Questionnaires → **Analyze** — first open seeds an editable report from the analyzer; every later open loads the saved `qnReports` doc instead (Reset rebuilds from the answers, keeping vendor costs/prices/links). Every line (facts, strengths, gaps, opportunities, risks, talking points) can be edited inline, added, or deleted; every service row can be deleted and has editable **3rd-party $** and **Client $** price fields next to the catalog price
2. **Save Report** persists edits; **Open in New Tab** pops the current view (Internal or Client-Facing) full-screen via `report.html?rid=...`; **Export PDF** opens the same page with the print dialog
3. Internal tab → **Create Vendor Link** builds a passcode-protected cost sheet (`vendorQuotes` + `report.html?vq=...`) showing the business name, questionnaire title, and service names/scopes (no analysis, no our prices) — Copy Link + Passcode or Send to Vendor via WhatsApp. Optionally link it to a saved `vendors/{id}` directory record (admin.html Vendors tab) instead of a one-off contact, so the vendor's info and engagement history persist across reports
4. The 3rd party opens the link, enters the passcode, fills in their cost per service and submits (one-time; the sheet locks) — plus one free-text note for the whole submission (rush fees, exclusions, conditional pricing, etc.). **Refresh Costs** (also run automatically when the report opens) pulls the submitted numbers and note into the report
4a. Internal tab → Analyze → **Final Pricing** tab — reconciles that note into the actual numbers: an editable **Adjustment $** + reason per service (added to the vendor's raw cost to get the "adjusted cost" — e.g. vendor wrote "+$300 if new domain needed", admin types +300 with that reason). Every downstream calculation (both markup buttons, the investment-estimate totals) uses vendor cost + adjustment, not the raw vendor cost — internal-only, never shown to the customer or exposed via report.html
5. Admin marks up: **Apply Rule-Based Markup** fills client price from the adjusted cost using the configured `settings/markupRules` (service override → phase override → default, edited in the Vendors tab), or type each Client $ by hand, or use the flat **Apply Markup %** — then fine-tune individual rows
6. Client-Facing tab → edit the intro/strengths/needs/next-steps, remove (and restore) services from the plan — prices shown are the marked-up client prices (catalog price when unset)
7. **Publish & Copy Link** snapshots the roadmap to `clientReports` + `report.html?cr=...` (re-publish updates the same link), or **Send Roadmap to Customer** publishes and opens WhatsApp with the link — this is the engagement roadmap the customer receives
8. Admin.html → Vendors tab → **Portfolio Margin** rolls up vendor cost vs. client price across every saved report, by vendor and by phase — a portfolio-wide view instead of only ever seeing margin one report at a time

**Admin drafts and executes a contract (customer or vendor):**
1. Admin → Contracts → Templates → build a template from scratch or **Load Sample Agreement** (the Digital Marketing Services Agreement), edit its clauses, delivery timeline, and compensation, then Save
2. Admin → Contracts → **New Contract** → pick the template (auto-fills title, clauses, and delivery timeline), pick an existing customer/vendor or type in a one-off counterparty's name/address/email/phone, set the Effective Date and each deliverable's Due Date → Save Contract (status `draft`)
3. **Copy Link** (or the WhatsApp button, if a phone number is on file) generates `contract.html?id=...` and flips status to `sent`; the counterparty opens it with no login required
4. Counterparty reviews the full agreement — parties, recitals, delivery timeline table, compensation, every clause — types their full legal name and an optional title, checks the agreement box, and clicks **Sign & Accept**; the page locks that signature in place immediately (status becomes `signed`)
5. Admin → Contracts → **Countersign** (prompts for the signing name/title) records `providerSignature`; once both signatures are present, status becomes `executed` — order doesn't matter, whichever signature lands second flips it to `executed`
6. **View** on any contract row (or the same `contract.html?id=...` link) opens the always-current state — provider and counterparty signature blocks show live status — and `&print=1` opens the print dialog for a PDF copy
7. Once executed, **Terminate** is available to mark the engagement ended (does not delete the contract or its signatures — an audit record stays in `contracts` and `auditLogs`)

**Admin manages content:**
- Sidebar → Admin → `admin.html` → signs in (email/password) → tabs: Applications / Orders / Tickets / Access / Service Mgmt / Tasks / Invoices / Questionnaires / Contracts / Company / Pricing / Services / Expertise / Vendors / Audit / Notifications
- Access: click any customer row to open **Customer 360** — one view aggregating their application, services + milestone progress, tickets, invoices, tasks, questionnaires, and a merged chronological activity feed, instead of checking each tab separately
- Service Mgmt: assign services to customers, edit status/notes, and manage the milestone checklist per service (progress bar + `x/y complete` shown both in the Active Services table and the edit modal) — this is what the customer sees in their portal. Each milestone can be assigned to a team member and, once checked complete, given a free-text "what was achieved" note — both are editable from the same edit modal, which also has a "Send Progress Update via WhatsApp" button. Milestones can still be added here directly (without a task), for backwards-compatible fine-grained editing.
- Tasks: the backbone for all internal work — independent of any customer/service. A "Team Members" roster (`settings/team`, name-only, no login) feeds the "Assigned To" dropdown. Admin creates tasks directly (with an optional linked customer + service, due date, assignee, and invoice amount), completes them inline with a "what was achieved" note, and every priced task auto-invoices the linked customer on completion — no more jumping to Service Mgmt just to check something off. Filterable by assignee and status (pending/completed/all).
- Invoices: bill a customer for completed/in-progress work (manually, or automatically from a completed task); customer sees it in their portal Billing tab in real time
- Tickets: replies are live — a reply sent from either admin.html or portal.html while the other side has that ticket's thread open appears immediately (`onSnapshot`), no refresh needed
- Vendors: persistent vendor directory (contact info, phase specialties, notes) + configurable markup rules (used by a questionnaire report's "Apply Rule-Based Markup") + the portfolio-wide margin report — see the vendor/markup flow above

## Firebase Console Requirements
- **Authentication → Email/Password** → Enable
- **Authentication → Google** → Enable (public-facing name: "Fifteen", support email configured)
- **Firestore** → already active
- **Storage** → already active
- **Hosting** → configured for 15fifteen15.com

## Optional Backend Automation Service (`server/`)

A small Node/Express service — see `server/README.md` for full setup and
Hostinger deployment instructions. **The site works completely without
it**; nothing about `index.html`/`admin.html`/`portal.html`/`shop.html`/
`questionnaire.html`/`report.html`'s availability depends on this being
deployed, and every flow it touches has an already-hardened client-side
fallback that's used automatically whenever `backend-config.js`'s
`apiUrl` is empty or unreachable.

What it adds once deployed:
- A daily job that auto-flags overdue invoices and emails a digest of
  tasks-due-soon / stale-open-tickets to `settings/notifications`'
  configured recipients — this is what finally makes those (previously
  inert) Notifications toggles do something.
- `customerTimeline` sync (background Firestore listeners → a per-customer
  event history collection).
- `POST /api/approve-application` — atomic application approval (Auth
  account + `customers/{uid}` + application update, with rollback on
  failure), replacing the client-only secondary-Firebase-app workaround.
- The real, server-verified version of the `report.html?vq=...` vendor
  passcode gate, closing the gap where the client-side-only version
  downloads the full document before checking the passcode and doesn't
  gate the cost-submission write by it at all.

## Migration Notes (from the pre-restructure build)

- **Breaking change — Partner Logins removed.** The Access tab's
  "Partner Logins" card (plaintext `email`/`password` pairs stored in
  `settings/access.partnerLogins`) has been removed. It was confirmed
  unused by any authentication path anywhere in the app (customers
  authenticate via real Firebase Auth, not this) — it was dead code that
  nonetheless stored live plaintext credentials. If you had entries there,
  they're preserved in Firestore (the field is just no longer read or
  editable from the UI) — delete `settings/access` manually if you want
  to clear it out, or leave it, it's inert either way.
- **Breaking change — no more legacy admin password fallback.**
  `admin.html`'s hardcoded `'fifteen2025'` password-only login path
  (used only when Firebase failed to initialize) has been removed. Admin
  login is Firebase Auth only now, matching how the rest of the app's
  security already worked in practice.
- **Additive — new collections**: `vendors`, `customerTimeline` (backend-
  only), `settings/markupRules`, `contractTemplates`, `contracts`. None of
  these existed before; nothing reads or depends on them until you use the
  corresponding new UI (Vendors tab, Contracts tab) or deploy `server/`.
- **Additive — `firestore.indexes.json`**: newly deployed alongside
  `firestore.rules` in CI. Needed for the admin Audit Log's
  resource/action filters and a couple of `where + orderBy` queries that
  previously risked a `FAILED_PRECONDITION` error in production with no
  index pre-provisioned.
- No existing collection was renamed or restructured — every pre-existing
  document shape (`applications`, `orders`, `customers`, `customerServices`,
  `tickets`, `invoices`, `tasks`, `questionnaires`, `qnReports`,
  `vendorQuotes`, `clientReports`) is unchanged and fully backward
  compatible; only a few optional fields were added (`vendorQuotes.vendorId`).
- **Deployment**: this was developed and reviewed on a feature branch with
  Firebase Hosting preview-channel deploys per PR (`firebase-hosting-pull-
  request.yml`); `main` only auto-deploys to the live site on merge
  (`firebase-hosting-merge.yml`). The optional `server/` service is a
  separate deploy target (Hostinger) with its own timeline — deploy it
  whenever convenient, independent of when this merges.

## Services Catalog
15 services across 3 phases:
- **Phase 1 — Brand & Authority** (1–5): Brand Identity, Motion Video, Animations, Digital Arts, Editorial & Print
- **Phase 2 — Growth & Traffic** (6–10): Branded Content, Platform Management, Ranking Control/SEO, Newsletters & SMS, Performance Marketing
- **Phase 3 — Infrastructure & Scale** (11–15): Website Creation, E-commerce Storefront, Secure E-commerce, Business Hub/ERP, Analytics Dashboard

## Branch Convention
Development branch: `claude/shop-orders-firestore-security-hf9k9b` → PRs into `main`
