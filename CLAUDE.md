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
| `firebase-config.js` | Firebase project credentials (project: `fifteen-pro`) |
| `prices.json` | Service catalog fallback (loaded if Firestore unavailable) |
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
settings/access         — admin password, partner logins
catalog/services        — 15 services with pricing (falls back to prices.json)
content/team            — 3 team member profiles + photos

applications/{id}       — partner applications from quiz
  name, email, phone, website, industry
  quizAnswers: { q0..q14 }   ← full quiz responses
  status: 'pending' | 'approved' | 'rejected'
  createdAt (serverTimestamp)
  userId (added on approval)

customers/{uid}         — created when admin approves an application
  name, email, industry, applicationId
  status: 'active'
  createdAt

customerServices/{id}   — services assigned to a customer
  userId, serviceId, serviceName, phase
  status: 'pending' | 'active' | 'completed'
  startDate, completionDate
  milestones: [{title, date, completed}]
  notes

tickets/{id}            — support tickets raised by customers
  userId, subject, category, message
  status: 'open' | 'in-progress' | 'resolved'
  createdAt, updatedAt

invoices/{id}           — billing invoices per customer
  userId, description, amount, currency
  status: 'paid' | 'pending' | 'overdue'
  dueDate, paidDate
```

## Auth

### Admin (`admin.html`)
- Password-based (NOT Firebase Auth)
- Password stored in `settings/access.adminPassword` (default: `fifteen2025`)
- Session: `localStorage['fifteen_admin_sess']`, 8-hour expiry
- Brute-force: 5 attempts → 15-min lockout (`localStorage['fifteen_admin_att']`)

### Customers (`portal.html`)
- Firebase Auth — Email/Password + Google OAuth
- On sign-in, checks `customers/{uid}` exists; signs out if not found
- When admin approves application: `createUserWithEmailAndPassword` (temp pw) → `sendPasswordResetEmail` → `signOut`
- Customer sets their own password via the Firebase reset email link

## Key User Flows

**New partner applies:**
1. Completes 15-question quiz on `index.html#apply`
2. Sees personalized recommendation, fills contact info → saved to `applications` collection
3. Admin sees it in `admin.html` → Applications tab
4. Admin clicks Approve → Firebase Auth account created → password-reset email sent
5. Customer sets password → logs in at `portal.html`

**Existing partner logs in:**
- Sidebar → Partner Portal → `portal.html` → signs in with email/password or Google
- Sees dashboard: Active Services KPI, Open Tickets, Next Milestone, Outstanding Invoices

**Admin manages content:**
- Sidebar → Admin → `admin.html` → enters password → tabs: Applications / Company / Pricing / Services / Access / Expertise

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
Development branch: `claude/zealous-turing-10rdcm` → PRs into `main`
