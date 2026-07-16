# Graph Report - .  (2026-07-16)

## Corpus Check
- 34 files · ~62,731 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 254 nodes · 305 edges · 32 communities (12 shown, 20 thin omitted)
- Extraction: 87% EXTRACTED · 13% INFERRED · 0% AMBIGUOUS · INFERRED: 39 edges (avg confidence: 0.87)
- Token cost: 453,007 input · 33,200 output

## Community Hubs (Navigation)
- Admin Auth & Applications
- Architecture & CI/CD Docs
- Questionnaire Builder
- Shared Config & Design System
- Portal Data & Collections
- Tasks, Services & Invoicing
- Growth Bundle Flyer
- Performance Marketing Flyer
- Public Quiz & Applications
- Questionnaire Analyzer
- Customer Portal Auth
- Pricing & Strategy Docs
- HTML Escaping Utilities
- Expertise Content Tab
- Pricing Settings Tab
- Tasks & Milestones Concept
- Duplicated Product Copy
- Toast Notifications
- Design System Doc
- Product: Animations
- Product: App Development
- Product: Brand Identity
- Product: Branded Content
- Product: Business Hub
- Product: Digital Arts
- Product: E-commerce Store
- Product: Editorial Designs
- Product: Motion Video
- Product: Newsletters
- Product: Platform Management
- Product: Ranking Control
- Product: Statistics Dashboard

## God Nodes (most connected - your core abstractions)
1. `The Performance Marketing System (Fifteen infographic flyer)` - 16 edges
2. `showDashboard (post-login bootstrap, loads all collections)` - 11 edges
3. `computeQnAnalysis (scores services into priority/recommended/later tiers with evidence and investment estimate)` - 9 edges
4. `The Growth Bundle — one complete marketing team, one monthly investment` - 9 edges
5. `Public Questionnaire Form Page (no-login, loads questionnaires/{id} by ?id= param)` - 8 edges
6. `Firebase Content Loader IIFE (company/team/catalog)` - 8 edges
7. `loadServiceMgmt (customerServices table with milestone progress bars, fills custServicesCache)` - 7 edges
8. `loadQuestionnaires / renderQnTable (questionnaires collection with per-row actions)` - 7 edges
9. `index.html Public Marketing Site` - 7 edges
10. `init Shop Bootstrap` - 7 edges

## Surprising Connections (you probably didn't know these)
- `submitServiceRequest (customer self-service request)` --semantically_similar_to--> `submitOrder`  [INFERRED] [semantically similar]
  portal.html → shop.html
- `STAGE Service Offering` --semantically_similar_to--> `15-Service Catalog (3 Phases)`  [INFERRED] [semantically similar]
  MD/Company profile On Stage 2025.md → CLAUDE.md
- `15fifteen15 Products Guide` --semantically_similar_to--> `15-Service Catalog (3 Phases)`  [INFERRED] [semantically similar]
  MD/Products Guide.md → CLAUDE.md
- `saveQuestionnaire (serializes builder sections with generated s{si}q{qi} question ids)` --calls--> `AppUtils`  [EXTRACTED]
  admin.html → app.js
- `AppUtils` --shares_data_with--> `loadAuditLogs (latest 100 auditLogs entries)`  [EXTRACTED]
  app.js → admin.html

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Admin Dashboard Tab Navigation (sidebar buttons -> switchTab -> 14 panels)** — admin_sidebar, admin_switchtab, admin_applications_tab, admin_orders_tab, admin_tickets_tab, admin_access_tab, admin_service_mgmt_tab, admin_tasks_tab, admin_invoices_tab, admin_questionnaires_tab, admin_company_tab, admin_pricing_tab, admin_services_tab, admin_expertise_tab, admin_audit_tab, admin_notifications_tab [EXTRACTED 1.00]
- **WhatsApp wa.me Deep-Link Sharing Pattern (no backend messaging - reports open in WhatsApp with prefilled text)** — admin_sendapplicationwhatsapp, admin_sendmilestoneupdatewhatsapp, admin_sendquestionnairewhatsapp, admin_sendqnanalysiswhatsapp, admin_industry_routing [EXTRACTED 1.00]
- **Questionnaire Lifecycle (draft -> sent -> completed across admin builder and public form)** — admin_savequestionnaire, admin_copyquestionnairelink, admin_sendquestionnairewhatsapp, questionnaire_public_form, questionnaire_submitform, admin_viewquestionnaire, admin_analyzequestionnaire [EXTRACTED 1.00]
- **Partner Application Quiz Flow (15 questions to recommendation to Firestore application)** — index_apply_quiz_section, index_quiz_engine, index_buildrec, index_submitquiz, firestore_applications [EXTRACTED 1.00]
- **Shop Cart-to-Order Flow (select services, build quote, submit order to Firestore)** — shop_togglecart, shop_updatecart, shop_openquote, shop_submitorder, firestore_orders [EXTRACTED 1.00]
- **Shared Company Branding Loading Pattern (settings/company logo swap on all three pages)** — index_firebase_content_loader, shop_loadsidebarlogo, portal_loadlogos, firestore_settings_company [INFERRED 0.85]
- **Fifteen 15-Product Service Catalog** — claude_services_catalog, md_products_guide_brand_identity, md_products_guide_motion_video, md_products_guide_animations, md_products_guide_digital_arts, md_products_guide_editorial_designs, md_products_guide_branded_content, md_products_guide_ecommerce_store, md_products_guide_platform_management, md_products_guide_ranking_control, md_products_guide_newsletters, md_products_guide_ecommerce_platform, md_products_guide_website_creation, md_products_guide_business_hub, md_products_guide_statistics_dashboard, md_products_guide_app_development [INFERRED 0.85]
- **Firebase CI/CD Pipeline (hosting live, hosting preview, rules)** — _github_workflows_firebase_hosting_merge_deploy_job, _github_workflows_firebase_hosting_pull_request_deploy_preview_job, _github_workflows_firebase_rules_deploy_deploy_rules_job, claude_firebase_project_fifteen_pro [EXTRACTED 1.00]
- **Security Lockdown Rollout (auth-first, then rules)** — security_security_setup, security_admin_firebase_auth, claude_security_rules, _github_workflows_firebase_rules_deploy_deploy_rules_job [INFERRED 0.85]

## Communities (32 total, 20 thin omitted)

### Community 0 - "Admin Auth & Applications"
Cohesion: 0.08
Nodes (31): Access Tab (admin password change, partner logins, portal customer list), Applications Tab (review partner applications, approve/reject, WhatsApp report routing), approveApplication (creates Auth user + customers/{uid} doc, flips application to approved), Audit Logs Tab (activity history with resource/action filters), buildApplicationReport (WhatsApp-formatted quiz report text), changePassword (reauthenticate + updatePassword, legacy in-memory fallback), doLogin (Firebase Auth email/password with legacy password fallback), filterAuditLogs (auditLogs query filtered by resourceType/action) (+23 more)

### Community 1 - "Architecture & CI/CD Docs"
Cohesion: 0.08
Nodes (28): Hosting Deploy on Merge Job, Hosting Preview Deploy on PR Job, Firestore & Storage Rules Deploy Job, Admin Authentication (admin.html), Application Approval Flow, Customer Portal Authentication (portal.html), Fifteen Pro B2B Website, Firebase Project fifteen-pro (+20 more)

### Community 2 - "Questionnaire Builder"
Cohesion: 0.10
Nodes (26): buildQuestionnaireMessage (WhatsApp text: invite link or full Q&A report when completed), Company Tab (company info, logo upload, social links), copyQuestionnaireLink (builds questionnaire.html?id= URL, flips draft to sent), Admin Dashboard Page, DISCOVERY_TEMPLATE (16-section retail/farm-store discovery questionnaire starting point), formatQnAnswer (normalizes stored table-row objects back to readable rows), loadDiscoveryTemplate (deep-copies DISCOVERY_TEMPLATE into the builder), loadLogos (swaps text logo for settings/company logo image) (+18 more)

### Community 3 - "Shared Config & Design System"
Cohesion: 0.13
Nodes (24): admin.html Admin Dashboard, Fifteen Cream/Green Design System (shared CSS variables, Inter, fixed sidebar layout), FIREBASE_CONFIG, Firestore content/team Doc (3 team member profiles), Firestore settings/company Doc (logo, address, social links), Graceful Degradation Pattern: Firestore then prices.json then hardcoded defaults, applyServicePrices Live Engine Pricing, Our Expertise Team Section (+16 more)

### Community 4 - "Portal Data & Collections"
Cohesion: 0.12
Nodes (22): Firestore auditLogs Collection, Firestore catalog/services Doc (15-service pricing catalog), Firestore customerServices Collection (milestones array, progress), Firestore invoices Collection (billing per customer), Firestore tickets Collection (support tickets), Firestore tickets/{id}/replies Subcollection (thread), initDashboard, loadAllData Parallel Loader (+14 more)

### Community 5 - "Tasks, Services & Invoicing"
Cohesion: 0.16
Nodes (17): assignService (creates customerServices doc for a customer), confirmCompleteTask (marks task completed, auto-creates invoice, syncs milestone by taskId), createInvoice (manual pending invoice for a customer), createTask (new task doc; if service linked, arrayUnions a matching milestone), editCustomerService (service edit modal: status, dates, notes, milestones, WhatsApp phone), Invoices Tab (create invoices, mark paid/overdue/pending), loadInvoices / renderInvoices (invoices collection joined with customers), loadServiceMgmt (customerServices table with milestone progress bars, fills custServicesCache) (+9 more)

### Community 6 - "Growth Bundle Flyer"
Cohesion: 0.15
Nodes (17): Bundle Flyer source markdown (MD/fifteen---bundle-flyer1.1.md), Contact block: www.15fifteen15.com, jeeh@15fifteen15.com, (689) 353-6924, Orlando FL & Cairo Egypt, Bundle service: Content Production (product & lifestyle photography, reels & short videos, scripting/VO/editing), Fifteen brand (15fifteen15.com), Bundle service: Google Services (GMB setup & management, Google Ads & keyword research, SEO support & reports), The Growth Bundle — one complete marketing team, one monthly investment, Partnership Investment Plans (pricing table: duration, monthly rate, total investment, best-for), Bundle service: Performance Marketing (FB/IG/TikTok ads, campaign strategy & targeting, A/B testing & optimization) (+9 more)

### Community 7 - "Performance Marketing Flyer"
Cohesion: 0.18
Nodes (17): Analytics & Tracking (GA4, GTM, custom dashboards), Consulting & Training (SOP development, in-house team training), Contact info (www.15fifteen15.com, jeeh@15fifteen15.com, (689) 353-6924, Orlando FL / Cairo Egypt), Creative Strategy (ad copywriting, video production, behavioral insights), E-commerce Scaling (WooCommerce & Shopify growth, AOV, cart abandonment), Enterprise package ($3,250+/mo, omni-channel, dedicated team, full market dominance), Fifteen (15fifteen15) brand, Growth & Optimization (A/B testing, CRO, CPA/CPL reduction) (+9 more)

### Community 8 - "Public Quiz & Applications"
Cohesion: 0.16
Nodes (16): Firestore applications Collection (quiz submissions, quizAnswers q0-q14, status pending), Firestore orders Collection (shop quotes, status new, source shop), Apply Quiz Section (#apply, 18 slides), buildRec Recommendation Builder, Quiz Engine IIFE, readStep Answer Reader, saveStep Answer Saver, showStep Slide Transition (+8 more)

### Community 9 - "Questionnaire Analyzer"
Cohesion: 0.19
Nodes (14): analyzeQuestionnaire (entry point: computes analysis and opens modal), buildQnAnalysisMarkdown (Copy Markdown / Download .md export), buildQnAnalysisWhatsApp (compact internal digest message), computeQnAnalysis (scores services into priority/recommended/later tiers with evidence and investment estimate), DEFAULTS (hardcoded 15-service catalog fallback with phases and prices), exportQnAnalysisPdf (print-styled branded window, browser Save-as-PDF, no libraries), loadServices (catalog/services doc, falls back to prices.json then DEFAULTS), QN_FACT_RULES (verbatim key-fact extraction for the internal report header) (+6 more)

### Community 10 - "Customer Portal Auth"
Cohesion: 0.25
Nodes (8): Firebase Authentication (email/password + Google OAuth), Firestore customers Collection (doc id = auth uid), doGoogleLogin Google OAuth Sign-In, doLogin Email/Password Sign-In, handleLogout, onAuthStateChanged Handler (customer gate), showDashboard Screen Switch, showLogin Screen Switch

### Community 11 - "Pricing & Strategy Docs"
Cohesion: 0.29
Nodes (7): 12-Month Bundle Plan, Bundle Pricing Tiers, Special Exclusive Bundle (Flyer), 15-Month Client Strategy, 3-Month Optimization Cadence, Special Exclusive Bundle, 15-Month Strategy & Tactic

## Ambiguous Edges - Review These
- `Fifteen Pro B2B Website` → `STAGE (On Stage) Company Profile 2025`  [AMBIGUOUS]
  MD/Company profile On Stage 2025.md · relation: conceptually_related_to

## Knowledge Gaps
- **85 isolated node(s):** `Admin Dashboard Page`, `isAdminUser (checks admins/{uid} registry doc)`, `Orders Tab (shop quote submissions: new/contacted/closed)`, `Tickets Tab (support tickets with reply thread)`, `Questionnaires Tab (build/send/review/analyze per-customer discovery questionnaires)` (+80 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **20 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Fifteen Pro B2B Website` and `STAGE (On Stage) Company Profile 2025`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `showDashboard (post-login bootstrap, loads all collections)` connect `Admin Auth & Applications` to `Questionnaire Analyzer`, `Tasks, Services & Invoicing`?**
  _High betweenness centrality (0.060) - this node is a cross-community bridge._
- **Why does `loadServices (catalog/services doc, falls back to prices.json then DEFAULTS)` connect `Questionnaire Analyzer` to `Admin Auth & Applications`?**
  _High betweenness centrality (0.026) - this node is a cross-community bridge._
- **What connects `Admin Dashboard Page`, `isAdminUser (checks admins/{uid} registry doc)`, `Orders Tab (shop quote submissions: new/contacted/closed)` to the rest of the system?**
  _85 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Admin Auth & Applications` be split into smaller, more focused modules?**
  _Cohesion score 0.07526881720430108 - nodes in this community are weakly interconnected._
- **Should `Architecture & CI/CD Docs` be split into smaller, more focused modules?**
  _Cohesion score 0.082010582010582 - nodes in this community are weakly interconnected._
- **Should `Questionnaire Builder` be split into smaller, more focused modules?**
  _Cohesion score 0.10153846153846154 - nodes in this community are weakly interconnected._