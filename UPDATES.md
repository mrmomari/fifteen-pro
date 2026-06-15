# Fifteen — Session Update
**Date:** 2026-06-15

---

## What Was Done Today

### Sidebar
- Removed **Company Profile** PDF link from Resources section
- Fixed sidebar scroll — `overflow-y` moved to `.sidebar-inner` so footer always stays visible
- Added **Admin** button (lock icon + label) pinned to sidebar footer
- Clicking Admin opens a password modal → correct password redirects to `admin.html` auto-logged in

### Partner Access (Client Login)
- Moved out of sidebar entirely
- Now lives as a green **"Partner Login"** button in a sticky top bar above main content
- Opens a clean modal overlay with email + password fields

### Admin Panel (`admin.html`)
- Fixed **one-time / monthly dropdown** — given fixed width so it no longer bleeds into adjacent cards
- Removed GitHub token requirement entirely
- Replaced "Save & Publish" with **"↓ Download prices.json"** — edit prices, download file, paste into GitHub web editor. No tokens needed.
- Added plain-language 4-step publish instructions inside the panel

### Partners Strip
- Added infinite auto-scrolling marquee of **25 partner names** just above the footer
- Clean white background, fades at edges, pauses on hover
- Ready for real logos — just drop image files into `/logos/` folder

---

## What's Coming Tomorrow

### Admin — Fixed Settings Panel
- Rebuild admin as a proper **settings hub** (not just prices)
- Sections to control from one place:
  - Service prices & descriptions
  - Site content (headlines, copy)
  - Partner/client management
  - Branding settings (colors, logo)
  - Resources / PDF links

### Portal Concept
- Define what the **Client Portal** actually does
- Decide on authentication approach (real login vs. invite-only access)
- Build a proper partner dashboard view

### Other Fixes Noted
- Font change (Space Grotesk was recommended)
- Logo images for the partners strip once files are available

---

## PRs Merged Today
| PR | Title |
|----|-------|
| #1 | Remove company profile from sidebar |
| #2 | Add admin login modal to sidebar footer |
| #3 | Fix sidebar scroll — footer always visible |
| #4 | Make admin button clearly visible |
| #5 | Fix admin dropdown layout |
| #6 | Add scrolling partners strip |
| #7 | Fix marquee animation + replace token save with download |

---

*See you tomorrow.*
