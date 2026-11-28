# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: smoke.spec.ts >> home page renders Casefolio heading and toggles dark/light theme class
- Location: tests/e2e/smoke.spec.ts:3:5

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('heading', { name: /Turn finished projects into publishable case studies/i })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByRole('heading', { name: /Turn finished projects into publishable case studies/i }) with timeout 5000ms
  - waiting for getByRole('heading', { name: /Turn finished projects into publishable case studies/i })

```

```yaml
- link "Skip to main content":
  - /url: "#main-content"
- banner:
  - link "Casefolio":
    - /url: /
  - navigation "Main navigation":
    - link "Home":
      - /url: /
    - link "Templates":
      - /url: /templates
    - link "Showcase":
      - /url: /showcase
    - link "Pricing":
      - /url: /pricing
  - link "Log in":
    - /url: /sign-in
  - link "Start creating":
    - /url: /sign-up
- main:
  - region "Great work deserves a great story.":
    - paragraph: ✦ Built for product storytellers
    - heading "Great work deserves a great story." [level=1]
    - paragraph: Turn raw screens into polished case studies—without wrestling with grids, formats, or another blank canvas.
    - link "Create your first case study":
      - /url: /sign-up
    - link "Explore the showcase":
      - /url: "#showcase"
    - paragraph: Free to start · No credit card required
    - figure "Interactive preview of the Casefolio case-study editor":
      - link "Browse Casefolio templates":
        - /url: /templates
      - button "Close left panel" [pressed]
      - text: .Cinema — Ticket Booking Cinema Saved · just now
      - group "Preview viewport":
        - button "Desktop" [pressed]
        - button "Mobile"
      - button "Undo edit" [disabled]
      - button "Redo edit" [disabled]
      - link "Preview case study — register or log in":
        - /url: /sign-up?template=cinema
        - text: Preview
      - link "Export case study — register or log in":
        - /url: /sign-up?template=cinema
        - text: Export
      - link "Publish case study — register or log in":
        - /url: /sign-up?template=cinema
        - text: Publish
      - button "Close right panel" [pressed]
      - complementary "Template outline and styles":
        - tablist "Editor sidebar tabs":
          - tab "Sections" [selected]
          - tab "Style"
          - tab "Content"
        - paragraph: Sections
        - paragraph: Cinema narrative flow
        - text: 5/5
        - button "01 Hero — Hero" [pressed]: 01 Hero Hero
        - button "02 Cinema booking is broken. — Overview": 02 Cinema booking is broken. Overview
        - button "Hide Cinema booking is broken."
        - button "03 Crafted for dark-room clarity — Key screens": 03 Crafted for dark-room clarity Key screens
        - button "Hide Crafted for dark-room clarity"
        - button "04 Interactive auditorium seat map — Custom section": 04 Interactive auditorium seat map Custom section
        - button "Hide Interactive auditorium seat map"
        - button "05 Measurable booking impact — Results": 05 Measurable booking impact Results
        - button "Hide Measurable booking impact"
      - text: Cinema · v1.0.0 Live preview · same renderer as publish & export
      - button "Edit Hero section" [pressed]: Hero
      - img ".Cinema brand emblem"
      - text: UX/UI CASE STUDY · MOBILE APP
      - heading ".Cinema" [level=1]
      - paragraph: Reimagining movie discovery, real-time auditorium seat selection, and frictionless cinema checkout for dark-room environments.
      - list "Project highlights":
        - listitem: UI/UX Design
        - listitem: Mobile App
        - listitem: iOS & Android
        - listitem: Design System
      - img ".Cinema splash screen"
      - button "Edit Overview section": Overview
      - text: 01 · OVERVIEW
      - heading "Cinema booking is broken." [level=2]
      - paragraph: We fixed it.
      - paragraph: Most cinema apps bury showtimes behind pop-up ads and force sign-up before revealing available seats. .Cinema streamlines booking from trailer to live QR pass into a 2-minute dark-mode experience.
      - term: Role
      - definition: Lead Product Designer
      - term: Timeline
      - definition: 8 Weeks
      - term: Platform
      - definition: iOS & Android
      - term: Screens
      - definition: 35+ Hi-Fi Screens
      - button "Edit Key screens section": Key screens
      - text: 02 · FINAL UI DESIGN
      - heading "Crafted for dark-room clarity" [level=2]
      - paragraph: Discovery, real-time auditorium seat selection, and instant perforated wallet passes.
      - figure "01 · Now Showing Feed":
        - img "Home movie discovery feed"
        - text: 01 · Now Showing Feed
      - figure "02 · Live Seat Matrix":
        - img "Interactive auditorium seat map"
        - text: 02 · Live Seat Matrix
      - figure "03 · Perforated QR Pass":
        - img "Mobile QR cinema ticket pass"
        - text: 03 · Perforated QR Pass
      - button "Edit Custom section section": Custom section
      - img "Interactive cinema seat selection spotlight"
      - text: 03 · FEATURE SPOTLIGHT
      - heading "Interactive auditorium seat map" [level=2]
      - paragraph: Redesigned as a tactile, zero-pinch canvas that guides moviegoers to the best acoustic view in seconds.
      - list:
        - listitem: Curved laser screen arc establishes instant spatial orientation
        - listitem: Three-state high-contrast seat tokens protect night vision
        - listitem: Sticky bottom summary updates row, seat numbers, and total live
      - button "Edit Results section": Results
      - text: 04 · IMPACT & LEARNINGS
      - heading "Measurable booking impact" [level=2]
      - paragraph: Moderated usability testing across 12 participants comparing the legacy flow against .Cinema.
      - text: +47% Faster seat-selection completion vs. legacy grids 2m 10s Median time from launch to confirmed QR pass 4.9★ Post-test usability satisfaction score -38% Reduction in checkout drop-off rate Context beats decoration
      - paragraph: Calibrating obsidian surfaces and thumb-zone controls for dim halls lifted task speed.
      - text: Defer authentication
      - paragraph: Letting users pick live seats first built commitment before biometric checkout.
      - button "Zoom out preview"
      - button "Reset preview zoom": 100%
      - button "Zoom in preview"
      - complementary "Section inspector":
        - tablist "Inspector tabs":
          - tab "Fields" [selected]
          - tab "Screenshots"
        - text: Section 1 of 5
        - button "Previous section" [disabled]
        - button "Next section"
        - heading "Hero" [level=3]
        - text: Eyebrow
        - textbox "Eyebrow": UX/UI CASE STUDY · MOBILE APP
        - text: Title
        - textbox "Title": .Cinema
        - text: Subtitle
        - textbox "Subtitle": Reimagining movie discovery, real-time auditorium seat selection, and frictionless cinema checkout for dark-room environments.
        - text: Hero layout
        - button "right" [pressed]
        - button "centered"
        - button "left"
  - region "Trusted teams": TRUSTED BY DESIGNERS FROM linear VERCEL Webflow SONOS Intercom
  - region "Your portfolio shouldn’t be another project.":
    - paragraph: The better way
    - heading "Your portfolio shouldn’t be another project." [level=2]
    - paragraph: You’ve already done the hard work. Casefolio gives your thinking a clear, considered structure so you can move from finished product to finished story—fast.
    - article:
      - text: "01"
      - heading "Structure that guides" [level=3]
      - paragraph: Proven narrative flows help you frame the problem, process, and impact without staring at a blank page.
    - article:
      - text: "02"
      - heading "Screens that behave" [level=3]
      - paragraph: Drop in your work. We handle ratios, device frames, alignment, and rhythm across every screen.
    - article:
      - text: "03"
      - heading "Publish it anywhere" [level=3]
      - paragraph: Export your full case study directly to Layerat, share a live link, or export PDF and 2× PNG. One story, every channel.
  - region "Designed to tell different stories.":
    - paragraph: TEMPLATES
    - heading "Designed to tell different stories." [level=2]
    - paragraph: Start with a system tailored to your project—not a one-size-fits-all theme.
    - link "Browse all templates":
      - /url: /templates
    - article:
      - text: SALTO 06:42
      - paragraph: Find your next trail.
      - paragraph: Elevation
      - paragraph: 1,284 m
      - text: iOS
      - paragraph: MOBILE
      - paragraph: The App Story
      - link "Open Mobile App Story template":
        - /url: /new?template=pulse
    - article:
      - text: ARCA / HOME
      - heading "Objects for quiet living." [level=3]
      - paragraph: WEB
      - paragraph: The Digital Experience
      - link "Open Web Digital Experience template":
        - /url: /new?template=northwind
    - article:
      - text: "Aa ↗ ◉ # 12 ⌁"
      - heading "NORTH / DESIGN SYSTEM" [level=3]
      - paragraph: Unified tokens & multi-device specs.
      - paragraph: CROSS-PLATFORM
      - paragraph: The System Story
      - link "Open Cross-Platform System Story template":
        - /url: /new?template=atlas
  - region "Publish once. Show up anywhere.":
    - tablist "Publishing channels":
      - tab "Layerat" [selected]
      - tab "Live site"
      - tab "PDF"
      - tab "PNG"
    - text: mono-layerat-full-case-study.zip LAYERAT PACK
    - paragraph: Direct Portfolio Export · Layerat
    - paragraph: Complete case study packaged for layerat.com
    - text: Full story · .zip 1400 × 1960 Hero & Context
    - paragraph: 01-layerat-1400px.png
    - paragraph: Title, thesis & cover shot
    - text: 1400 × 1960 UX Flows & UI
    - paragraph: 02-layerat-1400px.png
    - paragraph: 1,400px seamless screens
    - text: 1400 × 1960 Impact & System
    - paragraph: 03-layerat-1400px.png
    - paragraph: Metrics & final tokens
    - text: Destination Layerat Portfolio Panel Width 1,400px seamless Scope Full Case Study
    - paragraph: One story, everywhere
    - heading "Publish once. Show up anywhere." [level=2]
    - paragraph:
      - text: Build your narrative once, then export the full case study directly to
      - strong: Layerat
      - text: or ship to every format below — zero rebuilding, pixel-locked every time.
    - button "Full Case Study to Layerat Flagship Export your entire case study cleanly in 1,400px seamless panels ready to upload straight to Layerat. Full case study -> .zip":
      - text: Full Case Study to Layerat Flagship
      - paragraph: Export your entire case study cleanly in 1,400px seamless panels ready to upload straight to Layerat.
      - text: Full case study -> .zip
    - button "Live site Hosted responsive web URL with custom slugs, optional NDA password lock, and view analytics. casefolio.app/p/...":
      - text: Live site
      - paragraph: Hosted responsive web URL with custom slugs, optional NDA password lock, and view analytics.
      - text: casefolio.app/p/...
    - button "PDF Multi-page A4 case study deck (up to 60 pages) with crisp selectable typography for recruiters and clients. Selectable A4 · .pdf":
      - text: PDF
      - paragraph: Multi-page A4 case study deck (up to 60 pages) with crisp selectable typography for recruiters and clients.
      - text: Selectable A4 · .pdf
    - button "PNG Continuous full-length presentation image at 1,440px (1×) or 2,880px (2× Retina) with zero seams. 1× & 2× Retina · .png":
      - text: PNG
      - paragraph: Continuous full-length presentation image at 1,440px (1×) or 2,880px (2× Retina) with zero seams.
      - text: 1× & 2× Retina · .png
  - region "Stories worth stopping for.":
    - paragraph: MADE WITH CASEFOLIO
    - heading "Stories worth stopping for." [level=2]
    - link "CASE STUDY · 01 Move freely. City-wide pass. 9 screens iOS + Web WAYGO / MOBILITY Moving cities forward. NADIA K. — PRODUCT DESIGNER":
      - /url: /new?template=pulse
      - text: CASE STUDY · 01 Move freely. City-wide pass. 9 screens iOS + Web
      - paragraph: WAYGO / MOBILITY
      - heading "Moving cities forward." [level=3]
      - paragraph: NADIA K. — PRODUCT DESIGNER
    - link "MEMBERSHIP FLOW Shared studios across 14 cities. COMMON / COMMUNITY Built to belong. SAM E. — UX DESIGNER":
      - /url: /new?template=northwind
      - paragraph: MEMBERSHIP FLOW
      - paragraph: Shared studios across 14 cities.
      - paragraph: COMMON / COMMUNITY
      - heading "Built to belong." [level=3]
      - paragraph: SAM E. — UX DESIGNER
    - link "HABIT STREAKS · 21 DAYS Evening wind-down HEARTH / WELLNESS Small rituals. Real change. OLIVIA M. — PRODUCT DESIGNER":
      - /url: /new?template=atlas
      - text: HABIT STREAKS · 21 DAYS
      - paragraph: Evening wind-down
      - paragraph: HEARTH / WELLNESS
      - heading "Small rituals. Real change." [level=3]
      - paragraph: OLIVIA M. — PRODUCT DESIGNER
    - link "View all case studies in Showcase":
      - /url: /showcase
  - region "Your next case study could be live today.":
    - paragraph: ✦ Start with your best work
    - heading "Your next case study could be live today." [level=2]
    - paragraph: Join thousands of designers telling better product stories without the portfolio busywork — start free or pick the plan that matches your studio.
    - group "Billing interval":
      - button "Monthly" [pressed]
      - button "Annual 2 months free"
    - heading "Free" [level=3]
    - text: Free starter
    - paragraph: Personal workspace · 1 lifetime Case Study credit
    - text: $0 /forever
    - paragraph: No credit card required · Upgrade anytime
    - paragraph: Build and publish 1 complete UI/UX Case Study from A to Z for free.
    - link "Start free":
      - /url: /sign-up
    - paragraph: Included in Free
    - list:
      - listitem: 1 user (Personal workspace)
      - listitem: 1 complete Case Study credit (one-time lifetime allowance)
      - listitem: Full A-to-Z builder with starter templates, colors & typography
      - listitem: 5 exports/mo (1× PNG & PDF exports with subtle watermark)
      - listitem: 250 MB cloud storage & shareable auto-generated link
    - heading "Pro" [level=3]
    - text: Most popular
    - paragraph: Solo designer plan · Up to 10 active projects
    - text: $7.99 /mo
    - paragraph: Billed monthly · $79.90/yr on annual (2 months free)
    - paragraph: Built for freelance designers and solo creators rotating up to 10 active projects.
    - link "Upgrade to Pro":
      - /url: /sign-up?plan=pro&interval=monthly
    - paragraph: "Includes everything in Free, plus:"
    - list:
      - listitem: 1 seat (Personal workspace)
      - listitem: Up to 10 active Case Studies (delete & replace anytime)
      - listitem: Custom Case Study URL (/p/your-custom-slug) for every live project
      - listitem: Full access to all Pro & Premium templates and custom styling
      - listitem: 60 exports/mo · Watermark-free 2× PNG, PDF & full Layerat export
      - listitem: 5 GB cloud storage & 90-day live portfolio view analytics
    - heading "Teams" [level=3]
    - text: Multi-seat studio
    - paragraph: Shared Team Workspace · 2–25 seats
    - text: $17.97 /mo
    - paragraph: $5.99/seat/mo · $179.70/yr on annual (2 months free)
    - paragraph: Built for product design teams and studios collaborating with per-seat control.
    - text: Seats 2–25 range
    - button "Decrease Team card seats"
    - text: "3"
    - button "Increase Team card seats"
    - link "Start Teams plan (3 seats)":
      - /url: /sign-up?plan=team&interval=monthly&seats=3
    - paragraph: "Includes everything in Pro, plus:"
    - list:
      - listitem: 2–25 seats ($5.99/seat/mo · 2 months free on annual)
      - listitem: Unlimited shared Case Studies across your studio
      - listitem: "Team Dashboard: invite by email, track invite status & manage roles"
      - listitem: Custom Case Study URLs (/p/your-custom-slug) on all live links
      - listitem: Shared Brand Kit, 75 exports/seat/mo, 10 GB/seat pooled storage & 365-day analytics
    - text: Need a side-by-side breakdown of all plans? Compare Free, Pro, and Teams features, limits, and workspace quotas.
    - link "Compare all plans":
      - /url: /pricing#plan-comparison
  - heading "Test the canvas before paying a single cent." [level=2]
  - paragraph: Build and publish 1 Case Study free — no credit card required.
  - link "Start free":
    - /url: /sign-up
  - link "Billing guide":
    - /url: /help/billing-and-plans
- contentinfo:
  - link "Casefolio":
    - /url: /
  - paragraph: Tell the story behind the pixels.
  - list "Casefolio social media links":
    - listitem:
      - link "Casefolio on Instagram":
        - /url: https://www.instagram.com/layerat.portfolio/
    - listitem:
      - link "Casefolio on LinkedIn":
        - /url: https://www.linkedin.com/company/layerat
  - paragraph: Product
  - list:
    - listitem:
      - link "Home":
        - /url: /
    - listitem:
      - link "Templates":
        - /url: /templates
    - listitem:
      - link "Showcase":
        - /url: /showcase
    - listitem:
      - link "Pricing":
        - /url: /pricing
    - listitem:
      - link "FAQ":
        - /url: /faq
  - paragraph: Company
  - list:
    - listitem:
      - link "About us":
        - /url: /about
    - listitem:
      - link "Our team":
        - /url: /team
    - listitem:
      - link "Help center":
        - /url: /help
    - listitem:
      - link "Contact":
        - /url: /help/contact
  - paragraph: Legal
  - list:
    - listitem:
      - link "Terms of use":
        - /url: /terms
    - listitem:
      - link "Privacy policy":
        - /url: /privacy
    - listitem:
      - link "Refund policy":
        - /url: /terms#refunds
  - paragraph: © 2026 Casefolio, Inc. · A product of LAYERAT
  - link "www.layerat.com":
    - /url: https://www.layerat.com
  - button "Toggle color theme"
- region "Notifications alt+T"
- alert
```

# Test source

```ts
  1  | import { expect, test } from "@playwright/test";
  2  | 
  3  | test("home page renders Casefolio heading and toggles dark/light theme class", async ({ page }) => {
  4  |   await page.goto("/");
  5  |   await expect(
  6  |     page.getByRole("heading", {
  7  |       name: /Turn finished projects into publishable case studies/i,
  8  |     }),
> 9  |   ).toBeVisible();
     |     ^ Error: expect(locator).toBeVisible() failed
  10 |   await expect(page.getByRole("link", { name: "Start free" }).first()).toBeVisible();
  11 | 
  12 |   const html = page.locator("html");
  13 |   const toggle = page.getByRole("button", { name: "Toggle color theme" });
  14 |   const initialDark = await html.evaluate((el) => el.classList.contains("dark"));
  15 | 
  16 |   await toggle.click();
  17 |   await expect.poll(() => html.evaluate((el) => el.classList.contains("dark"))).toBe(!initialDark);
  18 | });
  19 | 
```