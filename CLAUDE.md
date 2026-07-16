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
| `report.html` | Public report pages for saved questionnaire reports: `?vq=` passcode-protected 3rd-party vendor cost sheet, `?cr=` published client engagement roadmap, `?rid=&view=internal\|client` admin-only pop-out (requires admin sign-in in the same browser); `&print=1` auto-opens the print dialog (used by admin.html's Export PDF) |
| `firebase-config.js` | Firebase project credentials (project: `fifteen-pro`) |
| `app.js` | Shared admin.html utilities (`AppUtils`: HTML escaping, audit logging, confirm-modal helper) |
| `prices.json` | Service catalog fallback (loaded if Firestore unavailable) |
| `firestore.rules` | Firestore security rules (paste into Firebase console) |
| `storage.rules` | Firebase Storage security rules (paste into Firebase console) |
| `SECURITY.md` | Step-by-step guide for enabling the security rules |
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
- Slides 0–14: 15 questions (radio = must select to advance; checkbox = optional, "None" deselects others)
- Slide 15: Personalized recommendation generated from answers
- Slide 16: Contact info (name, email, phone, website, industry) — saves to Firestore on submit
- Slide 17: Success + "Book Your Strategy Call" CTA (`id="qBookBtn"` href — update to your Calendly URL)

All answers + contact saved to `applications/{id}` with `quizAnswers` object and `status: 'pending'`.

## Firebase Collections

```
settings/company        — company info, logo URL, social links
settings/pricing        — currency, tax, bundle discount, promo codes
settings/access         — partner logins
settings/team           — { members: [name, ...] } — internal team roster for milestone "Assigned To"; no login, admin-managed (admin.html Tasks tab)
settings/industryContacts — { mapping: { industryName: phoneNumber, ... } } — per-industry WhatsApp routing for application quiz reports (admin.html Applications tab)
catalog/services        — 15 services with pricing (falls back to prices.json)
content/team            — 3 team member profiles + photos
admins/{uid}            — admin registry (doc id = Firebase Auth UID); managed via Firebase console

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
    start from the "Discovery Template" (DISCOVERY_TEMPLATE in admin.html) or from scratch, and every
    section/question can be freely added, edited, or removed before sending.
  — The link (questionnaire.html?id=...) requires no customer login: firestore.rules allows a public
    `get` by direct doc id (not `list`) and a one-time `update` restricted to the answers/status/
    completedAt fields, blocked once status is already 'completed'.

qnReports/{id}          — saved, editable analysis reports (admin-only; seeded by admin.html Analyze)
  questionnaireId, business, qnTitle, answered, total, pct
  facts, strengths, gaps, opps, risks, talking   — internal report content, all editable/deletable
  services: [{ key, id, name, phase, phaseLabel, desc, type, tier, score, evidence,
               catalogPrice, vendorCost, clientPrice, inPlan }]
    vendorCost  — 3rd-party cost (typed by admin or pulled from the linked vendorQuotes doc)
    clientPrice — marked-up price the customer sees (manual, or via the "Apply Markup %" helper)
    inPlan      — false = removed from the client-facing roadmap (still visible internally)
  clientIntro, clientStrengths, clientNeeds, clientNextSteps — client-facing content, independent copies
  vendorQuoteId, vendorPasscode, vendorStatus, vendorName, vendorNote, vendorSubmittedAt
  clientReportId, createdAt, updatedAt

vendorQuotes/{id}       — 3rd-party cost sheet behind report.html?vq=... (one per report)
  reportId, business, qnTitle                         — business name + questionnaire title, shown in
                                                        the sheet header so the vendor knows the client
  services: [{ key, name, phase, scope }]             — no internal analysis, no our prices
  passHash                — SHA-256 of the passcode (UI gate on report.html; same link-trust model
                            as questionnaires — treat the link itself as the secret)
  costs: { key: number }, vendorName, vendorNote      — filled in by the vendor
  status: 'pending' | 'submitted', createdAt, submittedAt
  — firestore.rules: public `get` by direct id, one-time public `update` restricted to
    costs/vendorName/vendorNote/status/submittedAt, blocked once status is 'submitted'.

clientReports/{id}      — published engagement roadmap behind report.html?cr=... (one per report)
  reportId, title, business, intro, strengths, needs, nextSteps
  phases: [{ phase, label, items: [{ name, desc, price, type }] }]   — price = marked-up clientPrice
  showPrices, totals: { oneTime, monthly }, publishedAt
  — read-only snapshot: public `get` by direct id, admin-only writes; re-publishing overwrites the
    same doc so the customer's link always shows the latest published version.
```

## Auth

### Admin (`admin.html`)
- Firebase Auth (email/password) + must have an `admins/{uid}` doc in Firestore (see `SECURITY.md`)
- Legacy fallback: if Firebase is unavailable (local dev), password-only login with the hardcoded default
- Session: Firebase Auth persistence (+ `localStorage['fifteen_admin_sess']`, 8-hour expiry)
- Brute-force: 5 attempts → 15-min lockout (`localStorage['fifteen_admin_att']`)

### Customers (`portal.html`)
- Firebase Auth — Email/Password + Google OAuth
- On sign-in, checks `customers/{uid}` exists; signs out if not found
- When admin approves application: customer account is created on a secondary Firebase app instance (`createUserWithEmailAndPassword` → `sendPasswordResetEmail` → sign out secondary) so the admin stays signed in
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
3. Admin marks it `paid` / `overdue` / back to `pending` from the Invoices tab as money comes in or a due date passes (no automatic overdue detection — no backend/Cloud Functions in this stack)

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
6. Admin → Questionnaires → **View** shows every answered question grouped by section; **Send via WhatsApp** on a completed questionnaire sends the full Q&A report instead of just the link
7. Admin → Questionnaires → **Analyze** (shown for any questionnaire with answers) runs a rule-based sales/service-fit analyzer over the responses — no backend/AI, keyword rules matched on question wording + answer text so it works on template AND custom questionnaires. It produces an **Internal Report** (key facts, strengths/gaps/opportunities/risks, the 15 services scored into Priority/Recommended/Consider-later tiers with per-answer evidence, an investment estimate from the live catalog prices, and talking points for the sales call) and a **Client-Facing** view (polished growth plan by phase, no scores/internal evidence). Both are exportable via Copy Markdown / Download .md, plus a compact WhatsApp summary (internal digest) sent via wa.me. The analysis seeds a saved, fully editable report (`qnReports`) — see the next flow.

**Admin prices a report via a 3rd-party vendor and sends the roadmap:**
1. Admin → Questionnaires → **Analyze** — first open seeds an editable report from the analyzer; every later open loads the saved `qnReports` doc instead (Reset rebuilds from the answers, keeping vendor costs/prices/links). Every line (facts, strengths, gaps, opportunities, risks, talking points) can be edited inline, added, or deleted; every service row can be deleted and has editable **3rd-party $** and **Client $** price fields next to the catalog price
2. **Save Report** persists edits; **Open in New Tab** pops the current view (Internal or Client-Facing) full-screen via `report.html?rid=...`; **Export PDF** opens the same page with the print dialog
3. Internal tab → **Create Vendor Link** builds a passcode-protected cost sheet (`vendorQuotes` + `report.html?vq=...`) showing the business name, questionnaire title, and service names/scopes (no analysis, no our prices) — Copy Link + Passcode or Send to Vendor via WhatsApp
4. The 3rd party opens the link, enters the passcode, fills in their cost per service and submits (one-time; the sheet locks). **Refresh Costs** (also run automatically when the report opens) pulls the submitted numbers into the 3rd-party column
5. Admin marks up: type each Client $ by hand or use **Apply Markup %** (fills client price = vendor cost + markup), then fine-tunes
6. Client-Facing tab → edit the intro/strengths/needs/next-steps, remove (and restore) services from the plan — prices shown are the marked-up client prices (catalog price when unset)
7. **Publish & Copy Link** snapshots the roadmap to `clientReports` + `report.html?cr=...` (re-publish updates the same link), or **Send Roadmap to Customer** publishes and opens WhatsApp with the link — this is the engagement roadmap the customer receives

**Admin manages content:**
- Sidebar → Admin → `admin.html` → signs in (email/password) → tabs: Applications / Orders / Tickets / Access / Service Mgmt / Tasks / Invoices / Questionnaires / Company / Pricing / Services / Expertise / Audit / Notifications
- Service Mgmt: assign services to customers, edit status/notes, and manage the milestone checklist per service (progress bar + `x/y complete` shown both in the Active Services table and the edit modal) — this is what the customer sees in their portal. Each milestone can be assigned to a team member and, once checked complete, given a free-text "what was achieved" note — both are editable from the same edit modal, which also has a "Send Progress Update via WhatsApp" button. Milestones can still be added here directly (without a task), for backwards-compatible fine-grained editing.
- Tasks: the backbone for all internal work — independent of any customer/service. A "Team Members" roster (`settings/team`, name-only, no login) feeds the "Assigned To" dropdown. Admin creates tasks directly (with an optional linked customer + service, due date, assignee, and invoice amount), completes them inline with a "what was achieved" note, and every priced task auto-invoices the linked customer on completion — no more jumping to Service Mgmt just to check something off. Filterable by assignee and status (pending/completed/all).
- Invoices: bill a customer for completed/in-progress work (manually, or automatically from a completed task); customer sees it in their portal Billing tab in real time

## Firebase Console Requirements
- **Authentication → Email/Password** → Enable
- **Authentication → Google** → Enable (public-facing name: "Fifteen", support email configured)
- **Firestore** → already active
- **Storage** → already active
- **Hosting** → configured for 15fifteen15.com

## Services Catalog
15 services across 3 phases:
- **Phase 1 — Brand & Authority** (1–5): Brand Identity, Motion Video, Animations, Digital Arts, Editorial & Print
- **Phase 2 — Growth & Traffic** (6–10): Branded Content, Platform Management, Ranking Control/SEO, Newsletters & SMS, Performance Marketing
- **Phase 3 — Infrastructure & Scale** (11–15): Website Creation, E-commerce Storefront, Secure E-commerce, Business Hub/ERP, Analytics Dashboard

## Branch Convention
Development branch: `claude/shop-orders-firestore-security-hf9k9b` → PRs into `main`
