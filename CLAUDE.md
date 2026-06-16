# Fifteen Pro — Codebase Guide

## What This Is
B2B business acceleration & digital solutions website for **15fifteen15 / Fifteen**. One partner per industry sector. Vanilla HTML/CSS/JS — no framework, no build step.

## Stack
- **Frontend:** Pure HTML5 + CSS3 + Vanilla JS (ES2020+)
- **Backend:** Firebase Firestore (database) + Firebase Storage (file uploads) + Firebase Auth (customer portal)
- **CDNs:** Firebase SDK v10.7.1 (compat), Font Awesome 6.5.1, Google Fonts (Inter)
- **Dev server:** `npx serve` (port 3333)

## Files

| File | Purpose |
|---|---|
| `index.html` | Public marketing site — hero, solutions grid, process, team, apply form |
| `admin.html` | Admin-only dashboard at `/admin.html` (hidden route, no nav link) |
| `portal.html` | Customer partner portal — Firebase Auth protected |
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

Layout: fixed left sidebar (268px on main site, 240px admin, 260px portal) + scrollable main area.

## Firebase Collections

```
settings/company        — company info, logo URL, social links
settings/pricing        — currency, tax, bundle discount, promo codes
settings/access         — admin password, partner logins
catalog/services        — 15 services with pricing (falls back to prices.json)
content/team            — 3 team member profiles + photos

applications/{id}       — partner applications from index.html form
  name, email, phone, website, industry
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
1. Fills form on `index.html#apply` → saved to `applications` collection
2. Admin sees it in `admin.html` → Applications tab
3. Admin clicks Approve → Firebase Auth account created → password-reset email sent to customer
4. Customer sets password → logs in at `portal.html`

**Existing partner logs in:**
- Goes to `portal.html` → signs in with email/password or Google
- Sees dashboard: Active Services KPI, Open Tickets, Next Milestone, Outstanding Invoices

**Admin manages content:**
- Goes to `admin.html` → enters password → tabs: Applications / Company / Pricing / Services / Access / Expertise

## Firebase Console Requirements
These must be enabled for full functionality:
- **Authentication → Email/Password** → Enable
- **Authentication → Google** → Enable (public-facing name: "Fifteen", support email configured)
- **Firestore** → already active
- **Storage** → already active

## Services Catalog
15 services across 3 phases:
- **Phase 1 — Brand & Authority** (1–5): Brand Identity, Motion Video, Animations, Digital Arts, Editorial & Print
- **Phase 2 — Growth & Traffic** (6–10): Branded Content, Platform Management, Ranking Control/SEO, Newsletters & SMS, Performance Marketing
- **Phase 3 — Infrastructure & Scale** (11–15): Website Creation, E-commerce Storefront, Secure E-commerce, Business Hub/ERP, Analytics Dashboard

## Branch Convention
Development branch: `claude/determined-johnson-6dmdc8` → PRs into `main`
