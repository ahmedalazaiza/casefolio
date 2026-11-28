# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: phase11-a11y-responsive-qa.spec.ts >> Phase 11 Performance, Accessibility & Responsive QA (C-1103) >> audits WCAG 2.1 A/AA accessibility via axe-core and 375/768/1440 responsive layouts across core routes
- Location: tests/e2e/phase11-a11y-responsive-qa.spec.ts:78:7

# Error details

```
Test timeout of 120000ms exceeded.
```

# Page snapshot

```yaml
- generic [active] [ref=f12e1]:
  - generic [ref=f12e2]:
    - link "Skip to main content" [ref=f12e3] [cursor=pointer]:
      - /url: "#main-content"
    - banner [ref=f12e4]:
      - generic [ref=f12e5]:
        - button "Switch active workspace or space" [ref=f12e7]:
          - generic [ref=f12e12]: Personal Workspace
          - generic [ref=f12e13]: FREE
        - generic [ref=f12e16]:
          - button "Notifications" [ref=f12e17]
          - button "Open account menu LQ" [ref=f12e22]:
            - generic [ref=f12e23]: Open account menu
            - generic [ref=f12e24]: LQ
    - complementary "Workspace sidebar" [ref=f12e26]:
      - generic [ref=f12e27]:
        - generic [ref=f12e28]:
          - link "Casefolio" [ref=f12e29] [cursor=pointer]:
            - /url: /dashboard
          - button "Collapse sidebar" [ref=f12e43] [cursor=pointer]
        - navigation "Workspace navigation" [ref=f12e47]:
          - link "Projects" [ref=f12e48] [cursor=pointer]:
            - /url: /dashboard
          - link "Spaces" [ref=f12e52] [cursor=pointer]:
            - /url: /spaces
          - link "Templates" [ref=f12e58] [cursor=pointer]:
            - /url: /templates
          - link "Published" [ref=f12e64] [cursor=pointer]:
            - /url: /published
          - link "Exports" [ref=f12e69] [cursor=pointer]:
            - /url: /exports
          - link "Analytics" [ref=f12e74] [cursor=pointer]:
            - /url: /analytics
          - link "Team" [ref=f12e78] [cursor=pointer]:
            - /url: /account/team
          - link "Notifications" [ref=f12e85] [cursor=pointer]:
            - /url: /notifications
          - link "Settings" [ref=f12e90] [cursor=pointer]:
            - /url: /account
          - link "Help" [ref=f12e95] [cursor=pointer]:
            - /url: /help
      - generic [ref=f12e100]:
        - generic [ref=f12e101]:
          - generic [ref=f12e102]: FREE · STARTER
          - paragraph [ref=f12e104]: 2 months free on annual · Up to 10 Case Studies
          - progressbar "Project quota usage" [ref=f12e105]
          - paragraph [ref=f12e107]: 1 of 1 Lifetime Case Study credit used
          - button "Explore Pro — $7.99/mo" [ref=f12e108] [cursor=pointer]
        - button "Share quick feedback" [ref=f12e113] [cursor=pointer]
    - main [ref=f12e119]:
      - generic [ref=f12e120]:
        - generic [ref=f12e121]:
          - generic [ref=f12e122]:
            - generic [ref=f12e123]:
              - link "Back to case study editor" [ref=f12e124] [cursor=pointer]:
                - /url: /editor/b9ab06fa-1aeb-4078-91ed-267e05d1d680
              - generic [ref=f12e127]:
                - generic [ref=f12e128]: Publish & Share
                - generic [ref=f12e131]:
                  - heading "Orbit — Accessibility & QA" [level=1] [ref=f12e132]
                  - generic [ref=f12e133]: Draft · Private
                - paragraph [ref=f12e135]: "Template: Orbit · Not published yet · 0 of 1 published slots used"
            - link "Back to Editor" [ref=f12e137] [cursor=pointer]:
              - /url: /editor/b9ab06fa-1aeb-4078-91ed-267e05d1d680
          - navigation "Project publishing and exports" [ref=f12e138]:
            - link "Publish & Share" [ref=f12e139] [cursor=pointer]:
              - /url: /projects/b9ab06fa-1aeb-4078-91ed-267e05d1d680/share
            - link "Exports (Layerat / PNG / PDF)" [ref=f12e144] [cursor=pointer]:
              - /url: /projects/b9ab06fa-1aeb-4078-91ed-267e05d1d680/exports
            - link "Analytics" [ref=f12e149] [cursor=pointer]:
              - /url: /projects/b9ab06fa-1aeb-4078-91ed-267e05d1d680/analytics
        - generic [ref=f12e153]:
          - generic [ref=f12e154]:
            - generic [ref=f12e155]:
              - generic [ref=f12e156]:
                - generic [ref=f12e157]:
                  - heading "Public URL Slug" [level=2] [ref=f12e158]
                  - paragraph [ref=f12e159]: Free case studies publish with a deterministic shareable link. Upgrade to customize /p/your-slug.
                - generic [ref=f12e160]: Pro & Teams
              - generic [ref=f12e165]:
                - generic [ref=f12e166]: Case study URL
                - generic [ref=f12e167]:
                  - generic [ref=f12e168]:
                    - generic [ref=f12e169]: localhost:3000/p/
                    - textbox "Case study URL" [ref=f12e170]:
                      - /placeholder: orbit-accessibility-qa-b9ab06
                      - text: orbit-accessibility-qa-b9ab06
                  - button "Copy link" [ref=f12e171]
                - generic [ref=f12e173]:
                  - generic [ref=f12e174]: Auto-generated share link active · Custom URL slugs (/p/your-custom-slug) require Pro or Teams.
                  - button "Unlock Custom URL" [ref=f12e179]
            - generic [ref=f12e181]:
              - generic [ref=f12e182]:
                - heading "Access & Discovery" [level=2] [ref=f12e183]
                - paragraph [ref=f12e184]: Control whether search engines can index your published case study.
              - radiogroup "Case study visibility" [ref=f12e185]:
                - radio "Public Selected Anyone with the link can view, and search engines can index this page." [checked] [ref=f12e186]:
                  - generic [ref=f12e187]:
                    - generic [ref=f12e188]: Public
                    - generic [ref=f12e193]: Selected
                  - paragraph [ref=f12e195]: Anyone with the link can view, and search engines can index this page.
                - radio "Unlisted Only people with the direct link can view. Hidden from search engines (noindex)." [ref=f12e196]:
                  - generic [ref=f12e197]: Unlisted
                  - paragraph [ref=f12e203]: Only people with the direct link can view. Hidden from search engines (noindex).
              - generic [ref=f12e204]:
                - generic [ref=f12e205]: Uploaded assets stay private until you publish.
                - button "Publish Case Study" [ref=f12e206]
          - generic [ref=f12e208]:
            - generic [ref=f12e209]:
              - generic [ref=f12e210]:
                - generic [ref=f12e211]:
                  - heading "Social Share Preview" [level=2] [ref=f12e212]
                  - paragraph [ref=f12e213]: Auto-generated 1200×630 OpenGraph card via Satori
                - generic [ref=f12e214]: OG Card
              - generic [ref=f12e216]:
                - generic [ref=f12e217]:
                  - generic [ref=f12e218]: CASE STUDY · 2026
                  - generic [ref=f12e219]: Casefolio
                - generic [ref=f12e220]:
                  - paragraph [ref=f12e221]: Orbit — Accessibility & QA
                  - paragraph [ref=f12e222]: Redesigning a mobile wallet for first-time savers.
                - generic [ref=f12e223]: /p/orbit-accessibility-qa-b9ab06
            - generic [ref=f12e225]:
              - generic [ref=f12e226]:
                - generic [ref=f12e227]: Public Page Branding
                - generic [ref=f12e232]: Free Plan
              - paragraph [ref=f12e234]: Free plan live shareable links and PNG/PDF exports include subtle “Made with Casefolio” branding. Upgrade to Pro ($7.99/mo · 2 months free on annual) to remove watermarks and unlock custom URLs, 2× PNG & full Layerat exports.
              - button "Upgrade to Pro" [ref=f12e236]
  - region "Notifications alt+T"
  - button "Open Next.js Dev Tools" [ref=f12e242] [cursor=pointer]
  - alert [ref=f12e246]
```