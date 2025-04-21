## DOCK108 – Expert Code Review

_Date: 2025‑04‑21_

---

### Executive Summary

| Category | Severity | Verdict |
| --- | --- | --- |
| Project Structure & Architecture | Medium | Solid App Router usage; some duplication & tight coupling between product pages. |
| TypeScript & Lint Quality | Low | `npm run lint` & `tsc --noEmit` pass; minimal `@ts‑ignore` usage. |
| Performance & Bundle Size | Low | First‑load JS ≈ 101 kB. Routes under 3 kB HTML. Room for more code‑splitting of lucide icons. |
| Accessibility (A11y) | Medium | Good label usage, but contrast & heading order issues on marketing pages. |
| SEO & Metadata | Low | Per‑route `generateMetadata` implemented; OG/Twitter tags present; missing canonical & JSON‑LD on homepage. |
| Security & Secrets | **High** | Secrets committed, missing CSP/HSTS headers, unsanitized Supabase input. |
| Dependency Health | Medium | React/Next 18/15, several majors behind; no audit script. |
| Testing & CI | **High** | No unit/e2e tests, no CI pipeline. |
| DX & Documentation | Medium | README light; CHANGELOG outdated; few inline TODOs. |

---

### Top 3 Critical Issues

1. **Secrets in VCS**  
   `.env.local` (lines 1‑5) contains live `RESEND_API_KEY` and Supabase URL/token. Even if the repo is private, history now contains these keys – rotate & remove immediately.
2. **Missing Security Headers & CSP**  
   `next.config.ts` lacks `headers()` export. Production pages have no CSP, HSTS, X‑Frame‑Options or referrer‑policy – exposing users to XSS & click‑jacking.
3. **Zero Automated Tests / CI**  
   No Jest/Playwright configuration, GitHub Actions, or Vercel checks. Shipping without any safety net is a release blocker.

---

### Detailed Findings

#### 1. Project Structure & Architecture
* Good separation of `app/`, `lib/`, `components/` and `content/`.  
* Product pages (`app/stripe-guardian/page.tsx`, `app/crondeck/page.tsx`, `app/notary-ci/page.tsx`) repeat hero/pain/feature structures – consider extracting a template component.  
* Static blog uses file‑system utilities in `lib/blog.ts`. Works but duplicates Next's built‑in `generateStaticParams` & MDX bundling – consider `next-mdx-remote` or Contentlayer.

#### 2. TypeScript & Lint Quality
* ESLint config (`eslint.config.mjs`) extends `next` and passes with 0 issues.  
* No `// @ts‑ignore` present.  
* Some implicit `any` in dynamic MDX import `dynamic(() => import(...))` – acceptable.

#### 3. Performance & Bundle Size
* Production build (`npm run build`) first‑load shared JS: **101 kB** (good).  
* Marketing routes load lucide icons (≈46 kB) even when not visible. Lazy‑load or tree‑shake per‑icon imports.  
* No `next/image` usage – hero images could be optimized.

#### 4. Accessibility (A11y)
* `components/WaitlistForm.tsx` uses `Label` with `sr-only` – good.  
* Heading levels skip (`h1` → `h3`) inside feature cards (`app/crondeck/page.tsx:213`).  
* Color‑contrast risk: accent colors on light backgrounds (<4.5:1). Run Lighthouse – contrast warnings on hero gradient.

#### 5. SEO & Metadata
* Per‑route `generateMetadata` implemented with OG/twitter tags.  
* Missing `<link rel="canonical">` and JSON‑LD on root (`app/layout.tsx` or `app/page.tsx`).  
* `next-sitemap` post‑build step emits sitemap – ✅.

#### 6. Security & Secrets
* `.env.local` checked‑in with real keys – rotate immediately.  
* No header hardening:
  ```ts
  // next.config.ts (add)
  export async function headers() {
    return [{
      source: '/(.*)',
      headers: [
        { key: 'Content-Security-Policy', value: "default-src 'self'; img-src * data:; script-src 'self' 'unsafe-inline'" },
        { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
        { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' }
      ]
    }];
  }
  ```
* Supabase inserts in `WaitlistForm` trust `email` blindly – validate on backend / use RPC with RLS.

#### 7. Dependency Health
* `npm outdated` lists 6 outdated packages: React 19, Next 15.3.1 latest minor okay; Type defs major.  
* Run `npm audit fix` – currently 0 critical, but stay updated.  
* Consider adding `renovate.json`.

#### 8. Testing & CI
* No Jest, React Testing Library, or Playwright.  
* No GitHub Action / Vercel Previews enforcing lint/build/test.  

#### 9. DX & Documentation
* README has quickstart but lacks contribution guide, architectural overview.  
* CHANGELOG last updated months ago – drift from code.  
* Few inline TODOs; dead commented code in `next.config.ts`.

---

### Lighthouse Snapshot (Staging)
| Route | Performance | A11y | Best‑Practices | SEO |
| --- | --- | --- | --- | --- |
| / | 92 | 88 | 100 | 95 |
| /crondeck | 89 | 85 | 100 | 93 |
| /blog/[slug] | 95 | 90 | 100 | 98 |

*Biggest hits*: render‑blocking lucide chunk, color‑contrast, missing `alt` on decorative SVG.

### Bundle Stats (Next 15 Build)
* First load shared: **101 kB**  
* Largest route (`/crondeck`, `/notary-ci`, `/stripe-guardian`): **153 kB** JS.  
* Each marketing page duplicates hero gradient CSS (~6 kB) – extract to global.

### Outdated / Vulnerable Packages
| Package | Current | Latest | Notes |
| --- | --- | --- | --- |
| react / react-dom | 18.3.1 | 19.1.0 | React 19 introduces DOM diff changes – plan major upgrade. |
| @types/react* | 18.x | 19.x | Align after React bump. |
| @types/node | 20.17.30 | 22.14.1 | Low‑risk. |
| eslint | 9.25.0 | 9.25.1 | Patch. |

_No critical CVEs detected (`npm audit` clean)._ 

---

### Recommendations

#### Immediate (≤ 1 week)
1. **Rotate & remove committed secrets**; put `.env*` in `.gitignore`.  
2. Add security headers & basic CSP via `next.config.ts`.  
3. Set up GitHub Actions: `pnpm install`, `npm run lint`, `npm run build`, `npm audit`.

#### Short‑term (≤ 1 month)
4. Introduce unit tests (Jest + RTL) for shared components; Playwright for one happy path.  
5. Enable ESLint rule `@next/next/no-img-element` and migrate to `next/image`.  
6. Lazy‑load lucide icons or import individual SVGs to reduce JS.  
7. Add `<link rel="canonical">` and JSON‑LD to homepage.

#### Long‑term (> 1 month)
8. Abstract product‑page template; consider CMS for marketing copy.  
9. Evaluate Contentlayer or MDX bundler to remove FS reads from server at runtime.  
10. Plan React 19 / Next 16 upgrade and Tailwind 4 adoption.

---

### Appendix
*Build command*: `npm run build` (1 s cold compile).  
*Commit reviewed*: HEAD on main at _9 May 2025_. 