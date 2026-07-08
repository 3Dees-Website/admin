# 3DEES Admin Portal

Internal administrative portal for **3DEES Consulting Works & Resourcing Ltd**, a Nigerian recruitment/placement agency. Staff ("Admins") and their supervisors ("Superadmins") use this app to post vacancies, screen candidate applications, approve placements, and sync approved candidates to a partner system called **EGI**.

This is the frontend only — a React single-page app. It talks to a separate backend REST API (see [EGI Hub Backend](../../EGI%20Hub%20Backend) / the sibling `3DEES/backend` project) over HTTP with JWT authentication.

---

## 1. Tech stack

| Layer | Choice |
|---|---|
| Build tool | [Vite](https://vite.dev) 8 |
| UI framework | [React](https://react.dev) 19 |
| Routing | [react-router-dom](https://reactrouter.com) 7 |
| Animation | [motion](https://motion.dev) (Framer Motion successor) |
| Icons | [lucide-react](https://lucide.dev) |
| State management | Custom `useReducer` + React Context (no Redux/Zustand) |
| Styling | Plain CSS files per component/page, no CSS-in-JS or Tailwind |
| Linting | ESLint 10 (`eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`) |

There is no test suite or TypeScript in this project — it's plain JS/JSX throughout.

---

## 2. Getting started

```bash
npm install
cp .env.example .env   # if present — otherwise create .env manually, see below
npm run dev             # starts Vite dev server, default http://localhost:5173
```

### Environment variables

The app needs exactly one env var, read at build/dev time by Vite (`import.meta.env`):

```
# .env
VITE_API_BASE_URL=http://localhost:3000
```

`VITE_API_BASE_URL` is the base URL of the backend REST API (no trailing slash). In production builds, [apiClient.js](src/services/apiClient.js) **throws at import time** if this is unset, so it cannot silently ship without a configured backend.

### Scripts (`package.json`)

| Script | Command | Purpose |
|---|---|---|
| `npm run dev` | `vite` | Local dev server with HMR |
| `npm run build` | `vite build` | Production build → `dist/` |
| `npm run lint` | `eslint .` | Lint the whole project (not run automatically by `build`) |
| `npm run preview` | `vite preview` | Serve the built `dist/` locally |

---

## 3. Architecture overview

### 3.1 Authentication — two-step login with email OTP

1. **[AdminLogin.jsx](src/pages/AdminLogin.jsx)** (`/`) — collects email + password, calls `authService.login`. On success the backend has already emailed a one-time code; the response only contains a `pendingToken` and a masked email (`destination`), never a real session.
2. React Router navigates to **[OTPVerification.jsx](src/pages/OTPVerification.jsx)** (`/admin/verify`) carrying `{ pendingToken, maskedEmail }` in route state. The user enters the 6-digit code (auto-submits when all boxes are filled, supports paste, arrow-key navigation, backspace-across-boxes).
3. On successful verification the backend returns `{ accessToken, refreshToken, user }`. `commitSession()` (in `PortalContext`) persists all three to `localStorage` and loads the rest of the portal's data.
4. The user is redirected to `/admin/dashboard` or `/superadmin/dashboard` depending on `user.role`.

Session tokens live in `localStorage` under fixed keys (see `TOKEN_STORAGE_KEYS` in [apiClient.js](src/services/apiClient.js)):
`3dees_access_token`, `3dees_refresh_token`, `3dees_current_user`.

**Automatic token refresh**: every request in `apiClient.js` that gets back `401 TokenExpired` triggers a silent `POST /api/auth/refresh` using the stored refresh token, then transparently retries the original request. Concurrent requests queue behind a single in-flight refresh instead of each triggering their own. If the refresh itself fails, the session is cleared and the browser is hard-redirected to `/`.

### 3.2 Route protection

**[ProtectedRoute.jsx](src/components/ProtectedRoute.jsx)** wraps the `/admin` and `/superadmin` route trees in `App.jsx`. It reads the current user/token from context, falling back to reading `localStorage` directly (guards against a race right after OTP success where React state hasn't re-rendered yet but the tokens are already persisted). If `allowedRole` doesn't match the user's actual role, it redirects to that role's own dashboard rather than to login.

### 3.3 Global state — `PortalContext`

There is a **single** context/reducer ([PortalContext.jsx](src/context/PortalContext.jsx)) that holds effectively all server-derived state for the whole app: `currentUser`, `token`, `jobs`, `applications`, `admins`, `auditLogs`, `toasts`. There's no per-page data fetching for the "core" entities — everything is loaded once via `loadInitialData()` (fired on mount if a session already exists, and again right after OTP success) and kept in sync via reducer actions as mutations happen.

Four small hooks expose slices of this context so components don't need to know the context exists directly:

| Hook | Exposes |
|---|---|
| [useAuth.js](src/hooks/useAuth.js) | `currentUser`, `token`, `login`, `commitSession`, `logout`, `admins`, `registerAdmin`, `toggleAdminSuspension`, `resetAdminPass`, `removeAdmin` |
| [useJobs.js](src/hooks/useJobs.js) | `jobs`, `postJob`, `editJob`, `removeJob` |
| [useApplications.js](src/hooks/useApplications.js) | `applications`, `auditLogs`, `applyToJob`, `reviewApplication`, `updateApplication`, `bulkReviewApplications` |
| [useToast.js](src/hooks/useToast.js) | `toasts`, `addToast`, `removeToast` |

The **EGI queue** (sync stats / failed deliveries / retry) is the one exception — it's fetched directly by the pages that need it via `egiService`, not routed through `PortalContext`, since it's ops-only data only one page consumes (see §7 EGI section).

### 3.4 Services layer (`src/services/`)

Each service wraps one REST resource and normalizes the backend's `snake_case` JSON into the `camelCase` shape the rest of the app expects. All authenticated calls go through the shared `apiClient` (JWT header injection + auto-refresh + JSON/blob handling described above).

| File | Resource | Notes |
|---|---|---|
| [apiClient.js](src/services/apiClient.js) | HTTP transport | `get/getBlob/post/postForm/put/patch/delete`, token refresh interceptor, `BASE_URL` export |
| [authService.js](src/services/authService.js) | `/api/auth/*` | Uses raw `fetch`, not `apiClient` — deliberately, so login/OTP calls never get caught in the refresh-retry loop |
| [jobService.js](src/services/jobService.js) | `/api/admin/jobs`, `/api/jobs` | Admin CRUD + public read routes |
| [applicationService.js](src/services/applicationService.js) | `/api/admin/applications*` | List/detail/status-update/bulk-status/export/public-submit; carries all EGI fields (see §7) |
| [userService.js](src/services/userService.js) | `/api/admin/users` | Superadmin-only staff account management |
| [auditService.js](src/services/auditService.js) | `/api/admin/audit-logs` | Compliance/status-change audit trail |
| [contactService.js](src/services/contactService.js) | `/api/contact` | Public contact form submit (raw `fetch`, unauthenticated) |
| [egiService.js](src/services/egiService.js) | `/api/admin/egi/queue*` | EGI outbox queue stats/list/retry (added for the EGI integration) |

### 3.5 Layout shell

**[AdminLayout.jsx](src/components/AdminLayout.jsx)** is the shared page chrome for every authenticated route: a collapsible left sidebar (role-specific nav menu, logo, sign-out) + a top header bar + a mobile bottom tab bar. It's parameterized by a `role` prop (`"admin"` or `"superadmin"`) which selects which menu array to render. `App.jsx` wraps the entire `/admin` and `/superadmin` route trees in one `<AdminLayout>` each, with an `<Outlet />` for the active page.

---

## 4. Full file reference

### 4.1 Root

| File | Purpose |
|---|---|
| `index.html` | Vite entry HTML. Sets the favicon (`/favicon.png`) and document title ("Admin Portal \| 3DEES Consulting Works & Resourcing Ltd"). |
| `vite.config.js` | Minimal Vite config, just the `@vitejs/plugin-react` plugin. |
| `eslint.config.js` | Flat ESLint config (hooks + refresh + browser globals). |
| `.env` | Local-only backend URL config (gitignored). |
| `package.json` | Scripts + dependencies (see §1/§2). |

### 4.2 `src/` entry points

| File | Purpose |
|---|---|
| [main.jsx](src/main.jsx) | React root bootstrap — mounts `<App />` in `<StrictMode>`, imports `index.css`. |
| [App.jsx](src/App.jsx) | Defines every route (see §5 for the full route table) inside a `<PortalProvider>` + `<BrowserRouter>`. Also renders the global `<ToastContainer />` and a `PanelLoaderPlaceholder` fallback for the route `<Suspense>` boundary. |
| [App.css](src/App.css) | Styles for the route-level loading spinner and an (currently unused-by-routes) `.public-base-layout` wrapper class. |
| [index.css](src/index.css) | Global CSS: imports the Inter font, defines the brand CSS custom properties (`--color-brand-primary` `#FF6600`, `--color-brand-dark` `#0A0A0A`, etc.) used by every page's stylesheet, base `body` styles. |

### 4.3 `src/context/` and `src/hooks/`

| File | Purpose |
|---|---|
| [PortalContext.jsx](src/context/PortalContext.jsx) | The entire app's data layer — reducer, all server-mutating action creators, toast queue, session bootstrap-on-mount effect. See §3.3. |
| [useAuth.js](src/hooks/useAuth.js) / [useJobs.js](src/hooks/useJobs.js) / [useApplications.js](src/hooks/useApplications.js) / [useToast.js](src/hooks/useToast.js) | Thin selector hooks over `PortalContext` (see table in §3.3). |

### 4.4 `src/services/`

Covered in §3.4.

### 4.5 `src/components/` (shared, cross-page)

| File | Purpose |
|---|---|
| [AdminLayout.jsx](src/components/AdminLayout.jsx) + `styles/AdminLayout.css` | Authenticated shell: sidebar (collapsible, logo, nav menu, sign-off), top header, mobile bottom tab bar. See §3.5. |
| [Navbar.jsx](src/components/Navbar.jsx) + `styles/Navbar.css` | Exports `LogoSVG` (an `<img>` wrapper around `/3dees_Logo.png`, used on the login page, OTP page, and inside `AdminLayout`'s sidebar header) and a full public marketing-site-style `<Navbar>` component. **Note:** the `<Navbar>` component itself is not currently rendered anywhere in this app's routes — only `LogoSVG` is imported from this file. It looks like a carry-over from a shared component library with the public marketing site. |
| [ProtectedRoute.jsx](src/components/ProtectedRoute.jsx) | Route guard — see §3.2. |
| [Toast.jsx](src/components/Toast.jsx) + `styles/Toast.css` | `ToastContainer` (reads `useToast()`, renders an `AnimatePresence` stack) + `ToastItem` (auto-dismisses after 4s). Toast types: `success`, `error`, `info`. |
| [CandidateEditDrawer.jsx](src/components/CandidateEditDrawer.jsx) + `styles/CandidateEditDrawer.css` | The shared "candidate file" slide-out drawer used by both pending-queue pages ([AdminPendingApplications](src/pages/AdminPendingApplications.jsx) and [SuperadminPendingApplications](src/pages/SuperadminPendingApplications.jsx)). Tabs: Personal / Education / Documents / Notes. Lets an admin edit personal & education info, upload/replace/remove documents (read as base64 client-side), edit internal notes, view status history, and change status (Reject / Shortlist / Approve — Approve only shown when `isSuperadmin`). The Notes tab also shows the EGI sync/decision panel (see §7). |
| [EgiNoteModal.jsx](src/components/EgiNoteModal.jsx) + `styles/EgiNoteModal.css` | Shared confirmation modal that collects the required "note to EGI" before any Approve action fires. Used by every approve flow in the app (single and bulk). See §7. |
| [EgiBadges.jsx](src/components/EgiBadges.jsx) + `styles/EgiBadges.css` | `<EgiSyncBadge status=.../>` and `<EgiDecisionBadge decision=.../>` — small colored pill components mapping the EGI status enums to gray/blue/green/red badges. See §7. |

### 4.6 `src/pages/`

Covered page-by-page in §5.

---

## 5. Pages & routes

Full route table from [App.jsx](src/App.jsx):

| Path | Page component | Auth | Notes |
|---|---|---|---|
| `/` | `AdminLogin` | Public | Redirects to the right dashboard immediately if already logged in |
| `/admin/verify` | `OTPVerification` | Public (requires route state) | Bounces to `/` if landed on directly without a `pendingToken` |
| `/admin` (index) | → redirect | — | Redirects to `/admin/dashboard` |
| `/admin/dashboard` | `AdminDashboard` | role: `admin` | |
| `/admin/jobs` | `AdminJobs` | role: `admin` | |
| `/admin/pending` | `AdminPendingApplications` | role: `admin` | |
| `/admin/applications` | `AdminApplications` | role: `admin` | |
| `/superadmin` (index) | → redirect | — | Redirects to `/superadmin/dashboard` |
| `/superadmin/dashboard` | `SuperadminDashboard` | role: `superadmin` | |
| `/superadmin/pending` | `SuperadminPendingApplications` | role: `superadmin` | |
| `/superadmin/applications` | `SuperadminViewAllApplications` | role: `superadmin` | |
| `/superadmin/jobs` | `SuperadminAllVacancies` | role: `superadmin` | |
| `/superadmin/admins` | `SuperadminManageAdmins` | role: `superadmin` | |
| `/superadmin/audit` | `SuperadminAuditTrail` | role: `superadmin` | |
| `/superadmin/egi-sync` | `SuperadminEgiSync` | role: `superadmin` | New — EGI integration |
| `*` | → redirect | — | Anything unmatched goes to `/` |

There are two parallel worlds — `admin` and `superadmin` — that largely mirror the same underlying data (jobs, applications) with different levels of authority. Superadmin pages generally style themselves as "override"/"executive" tooling (warning banners about bypassing normal workflow, audit logging emphasis) and can Approve applications directly; plain Admins mostly Shortlist/Reject and hand off approval to a Superadmin (see the one inconsistency noted in §8).

### Public / unauthenticated pages

#### `AdminLogin.jsx` — `/`
Email + password form. Calls `authService.login` via the `login()` context action. On success, navigates to `/admin/verify` carrying `{ pendingToken, maskedEmail }`. Shows a spinner in the submit button while authenticating. Uses `LogoSVG` from `Navbar.jsx`.

#### `OTPVerification.jsx` — `/admin/verify`
Six individual digit inputs with auto-advance-on-type, backspace-across-box, arrow-key navigation, full paste support, and auto-submit once all six digits are filled. A 60-second countdown gates the "resend" affordance — there's no dedicated resend API, so "resend" actually just sends the user back to `/` to log in again (which triggers a fresh OTP email). On success, shows a checkmark success state and a short "Establishing secure session…" animation before redirecting (the redirect explicitly waits for `token`/`currentUser` to be present in context before firing, to avoid racing `ProtectedRoute`).

### Admin pages (`role="admin"`)

#### `AdminDashboard.jsx` — `/admin/dashboard`
Landing page after admin login. A greeting banner with the user's name + two quick-action buttons ("Post New Job" → deep-links to `/admin/jobs?create=open`, "Applications"). A 6-tile stats grid (Posted Positions, Applications, Pending Audit, Shortlisted, Approved Placements, Rejected Dossiers) computed client-side from the already-loaded `jobs`/`applications` arrays. Below that, a "Incoming Recruits Feed" table of the 10 most recently submitted applications.

#### `AdminJobs.jsx` — `/admin/jobs`
Full CRUD for job vacancies. A table of all jobs (title, client org, location, submission count, status badge, per-row toggle/edit/delete actions). "Create/Edit" opens a large modal form covering: title, client org, category, employment type, location, openings, salary range, closing date, description, responsibilities, requirements (each a textarea, one item per line) — **plus** a "Dynamic Application Info Checklist Builder": a grid of checkboxes (`cvRequired`, `coverLetterRequired`, `academicCertRequired`, `nyscCertRequired`, `passportPhotoRequired`, `nationalIdRequired`, `dobRequired`, `stateOfOriginRequired`, `lgaRequired`, `yearsOfExpRequired`, `currentEmployerRequired`) that controls which fields/uploads the **public-facing application form** (outside this admin app) requires for that specific vacancy. Status toggle cycles Active → Closed → Draft → Active. Delete requires a confirm modal. Supports a `?create=open` query param (consumed once via `useSearchParams`, then cleared) to auto-open the create modal — used by the AdminDashboard quick-action link.

#### `AdminPendingApplications.jsx` — `/admin/pending`
Queue of only `Pending`-status applications for a normal admin to triage first. Search (name/email/reference/job title) + job filter. Stats: Total Pending, Received Today, Selected (count). Row checkboxes + "Shortlist All" / "Reject All" bulk actions (no bulk-approve here — admins don't approve from this queue). Per-row quick "Shortlist" button and "Open File" (opens `CandidateEditDrawer` with `isSuperadmin={false}`, so its Approve button is hidden — a plain admin can Shortlist/Reject from the drawer but not Approve). A "Waiting" badge color-codes days-since-submission (ok < 3 days, warn 3–6, alert ≥ 7).

#### `AdminApplications.jsx` — `/admin/applications`
The full applications list for an admin (all statuses, not just Pending). Filters: search, job, status. Bulk Shortlist/Reject (checkbox selection). CSV export button generates a client-side CSV (not via the backend's export endpoint — see §8) with columns: ReferenceStamp, ApplicantName, Email, Phone, RoleApplied, Qualification, WorkExperienceYears, Status, SyncState, EGI Decision, EGI Decision Note, SubmissionDate. Clicking "Audit File" opens a large **inline** drawer (this page does **not** use the shared `CandidateEditDrawer` — it has its own bespoke drawer markup) showing biography, EGI sync/decision panel, education/documents, an internal-notes textarea, and full status history, with footer actions Reject / Shortlist / **Approve & Sync** (this is the one place a plain admin can approve — see §8 for the noted inconsistency vs. the pending queue). Approve now opens the shared `EgiNoteModal` to collect the required note before submitting.

### Superadmin pages (`role="superadmin"`)

#### `SuperadminDashboard.jsx` — `/superadmin/dashboard`
Landing page after superadmin login. An "Advisory Console Active" banner with a link to Manage Admins and a "Diagnostic Test" button (client-side only — just fires a toast, doesn't call any API). A 4-tile metrics grid (Active Staff Admins, Total Active Jobs, Global Applications, Logged Vetting Changes). A two-column "work grid": a live audit-log stream (last 8 entries from `auditLogs`) and an **EGI Sync Health** card — this card fetches real numbers from `egiService.getQueueStats()` on mount (queue counts by status, computed failure rate, a link to the full `/superadmin/egi-sync` page). See §7 — this card used to show hardcoded fake "ONLINE"/`0.00%` placeholder values before the EGI integration work.

Note: this page also computes an `admins` list by reading a `3dees_local_db` key out of `localStorage` — this looks like leftover logic from before the app was migrated to the real backend (the real admin list is `useAuth().admins`, sourced from the API); this `localStorage`-derived list is what actually feeds the "Active Staff Admins" tile, so if that key is empty/absent the tile will read 0 regardless of the real admin count. See §8.

#### `SuperadminPendingApplications.jsx` — `/superadmin/pending`
The superadmin equivalent of the admin pending queue, styled as "override" tooling with a red "Override Mode Available" banner. Extra "Overdue (>7 days)" stat tile. Per-row actions: quick Shortlist, quick **Approve** (opens `EgiNoteModal` for the required note, then calls `reviewApplication`), and "Override File" (opens the shared `CandidateEditDrawer` with `isSuperadmin={true}`, exposing its Approve button too). Bulk bar adds "Bulk Approve & Sync" alongside Bulk Shortlist/Reject — bulk-approve specifically routes through the real `PATCH /api/admin/applications/bulk-status` endpoint (via `bulkReviewApplications`) rather than looping single-application calls, since the backend now requires one shared `egiNote` per bulk-approve call.

#### `SuperadminViewAllApplications.jsx` — `/superadmin/applications`
Superadmin's version of the full applications list (all statuses, all jobs). Own bespoke drawer (like `AdminApplications.jsx`, not the shared `CandidateEditDrawer`) with an EGI sync/decision panel, compliance-override warning banner, notes textarea, full status history, and footer actions Reject & Block / Force Shortlist / Approve & Portal Sync (Approve gated behind `EgiNoteModal`). CSV export (client-side) includes the EGI Sync + EGI Decision + EGI Decision Note columns.

#### `SuperadminAllVacancies.jsx` — `/superadmin/jobs`
Read-mostly, cross-client view of every vacancy (vs. `AdminJobs.jsx` which is full CRUD). Filters: search, category, status. Summary tiles: Total Vacancies, Active Pipelines, Closed Slots, Total Openings. CSV export (Title, ClientOrg, Category, Type, Location, Openings, SalaryRange, Status, ClosingDate, PostedBy, TotalApplicants, Approved). "Audit & Override" opens a detail drawer with full job details, an applicant-pipeline summary (total/shortlisted/approved/rejected counts for that job), description/requirements text, and footer actions to Force Delete or Close/Reopen the vacancy. Does not support creating or editing job content (only status toggle + delete) — creation/editing of job content lives only on the Admin side (`AdminJobs.jsx`).

#### `SuperadminManageAdmins.jsx` — `/superadmin/admins`
Staff account management — the only page that touches `userService`/the `/api/admin/users` endpoints. Table of all admin accounts (name, email, created date, last login, Active/Suspended badge). "Register Vetting Officer" modal creates a new admin (name/email/initial password). Per-row: toggle suspension, reset password (modal, overwrite passcode directly — no email flow), delete (confirm modal).

#### `SuperadminAuditTrail.jsx` — `/superadmin/audit`
Read-only compliance log. Filters: search, actor (dynamically populated from distinct `changedBy` values in the loaded logs), status. Table of every status change ever recorded: timestamp, log ID, applicant + job, officer who made the change, and a "status shift" visual (`prevStatus → newStatus` badges). Data comes straight from `auditLogs` in context (`auditService.getAuditLogs()`), no local fetching.

#### `SuperadminEgiSync.jsx` — `/superadmin/egi-sync` *(new)*
Ops screen for the EGI delivery outbox. Unlike every other page, this one fetches its own data directly (not through `PortalContext`) since it's a narrow ops concern. A 4-tile stat row (Pending/Queued/Synced/Failed counts from `egiService.getQueueStats()`). Filters: free-text application-ID search, status dropdown (defaults to `Failed`). Table columns: Reference, Applicant Email, Status badge, Attempts, Last Error (truncated with a title tooltip), Next Attempt At, and a **Retry** button (only rendered for `Failed` rows) that calls `egiService.retryQueueItem(id)` and then refetches both the stats and the item list.

---

## 6. Styling conventions

There is no global component library or design system — instead, **each page/component owns one CSS file with all its classes under a short, unique prefix**, so there's never any class-name collision across files even though everything is plain global CSS (no CSS Modules, no scoping). Examples: `aa-` (AdminApplications), `apa-` (AdminPendingApplications), `aj-` (AdminJobs), `al-` (AdminLogin), `otp-` (OTPVerification), `spa-` (SuperadminPendingApplications), `sva-` (SuperadminViewAllApplications), `sav-` (SuperadminAllVacancies), `sma-` (SuperadminManageAdmins), `sat-` (SuperadminAuditTrail), `sd-` (SuperadminDashboard), `ced-` (CandidateEditDrawer), `ses-` (SuperadminEgiSync, new), `enm-` (EgiNoteModal, new).

All brand colors/fonts are CSS custom properties defined once in [index.css](src/index.css):

```css
--color-brand-light:     #F5F5F5;
--color-brand-primary:   #FF6600;  /* orange — buttons, active states, accents */
--color-brand-secondary: #F25C00;  /* darker orange — hover states */
--color-brand-text:      #666666;
--color-brand-dark:      #0A0A0A;  /* near-black — sidebar bg, headings */
--shadow-subtle:         0 2px 16px rgba(0, 0, 0, 0.07);
```

The brand logo asset is `public/3dees_Logo.png` (used inline throughout the app at various sizes via `LogoSVG`/direct `<img>` tags) and `public/favicon.png` (a tightly-cropped square version, used only as the browser tab icon — the source logo file is a non-square canvas, so a separate square crop was needed to avoid the browser stretching/distorting it into the square favicon slot).

---

## 7. The EGI integration

3DEES places candidates with a partner organization, **EGI**, via an outbox-style async sync: when an application is Approved, the backend queues it for delivery to EGI's system in the background rather than syncing synchronously. This section covers the full frontend surface for that flow (added in this session).

### What changed on the backend, in one paragraph
Approving an application now requires an admin-authored **note to EGI** (`egiNote`) sent alongside the approval — the backend rejects `Approved` transitions missing it with `400 MissingField`. Every application now also carries: `egi_sync_status` (`Pending → Queued → Synced`/`Failed`), and EGI's own verdict via `egi_decision` (`Pending → Accepted`/`Declined`) plus `egi_decision_note`, `egi_decision_by`, `egi_decision_at`, `egi_reference_id`. There's also a small queue/outbox API for inspecting and retrying failed deliveries — those `/api/egi/*` routes used by *EGI's own backend* (API-key/HMAC auth) are out of scope for this frontend; only the `/api/admin/egi/*` ops routes (JWT-authenticated, same as everything else) are used here.

### Required-note approve flow
Every place in the app where an admin can transition an application to `Approved` now opens **[EgiNoteModal](src/components/EgiNoteModal.jsx)** — a small modal with a required textarea ("Note to EGI") that must be non-empty before the Confirm button will submit. This covers:
- The shared `CandidateEditDrawer`'s Approve button (used by both pending-queue pages)
- `AdminApplications.jsx`'s inline drawer Approve button
- `SuperadminViewAllApplications.jsx`'s inline drawer Approve button
- `SuperadminPendingApplications.jsx`'s per-row quick-Approve button
- `SuperadminPendingApplications.jsx`'s **Bulk** Approve button (one shared note applies to the whole batch — this call was switched from looping individual status updates to calling the real `bulk-status` endpoint once)

By deliberate product decision (confirmed with the user), a pre-existing inconsistency was **left as-is** rather than "fixed" as a drive-by: a plain Admin can approve directly from `AdminApplications.jsx`, but cannot approve from the Pending Queue drawer (`isSuperadmin` gate). Both surfaces now require the EGI note; neither's access control was changed.

### Status visibility
**[EgiBadges.jsx](src/components/EgiBadges.jsx)** renders the sync/decision state consistently everywhere:

| `egi_sync_status` | Badge |
|---|---|
| `Pending` | gray "Not sent" |
| `Queued` | blue "Sending…" |
| `Synced` | green "Sent" |
| `Failed` | red "Delivery failed" |

| `egi_decision` | Badge |
|---|---|
| `Pending` | gray "Awaiting EGI" |
| `Accepted` | green "Accepted by EGI" |
| `Declined` | red "Declined by EGI" |

These badges appear as extra table columns on `AdminApplications.jsx` and `SuperadminViewAllApplications.jsx` (deliberately **not** added to the two Pending-only queue tables, since every row there is trivially `Pending`/`Awaiting EGI` and the column would carry no information). Full detail — including the note sent, EGI's decline reason if declined, and who/when EGI decided — is shown in the drawer/detail views (`CandidateEditDrawer`'s Notes tab, and the bespoke drawers on the two full-applications pages).

### CSV exports
Both client-generated CSV reports (`AdminApplications.jsx`, `SuperadminViewAllApplications.jsx`) gained two trailing columns: `EGI Decision`, `EGI Decision Note` (quote-escaped, since decision notes are free text from EGI and may contain commas/quotes).

### Ops screen (superadmin-only)
- **`SuperadminDashboard.jsx`**'s "Sync Health" tile now shows real numbers (previously hardcoded placeholder text) — queue counts by status, a computed failure rate, and a link into...
- **`SuperadminEgiSync.jsx`** (`/superadmin/egi-sync`, new sidebar nav item) — the full Failed Deliveries table with per-row Retry, described in §5.

---

## 8. Known rough edges / tech debt (not fixed, worth knowing about)

- **`AdminApplications.jsx` lets a plain admin Approve directly**, while the Pending Queue drawer restricts Approve to superadmins only. Confirmed intentional-to-leave by the project owner (see §7) rather than a bug to fix silently.
- **`SuperadminDashboard.jsx`'s "Active Staff Admins" tile** reads from a `3dees_local_db` `localStorage` key rather than the real `useAuth().admins` list — looks like leftover logic from before this app was migrated from localStorage-only mock data to the real backend REST API. Likely reads 0 in a fresh browser profile.
- **`applicationService.exportCsv` and `auditService.exportCsv`** call real backend export endpoints (`/api/admin/applications/export`, `/api/admin/audit-logs/export`) but are **never called anywhere** — every CSV export in the UI is instead generated client-side from already-loaded data, with a different (page-specific) column set than what those backend endpoints presumably return.
- **The public `<Navbar>` component** in `Navbar.jsx` (full nav bar with mobile menu, scroll-shadow, logout button) is exported but not rendered by any route in this app — only its `LogoSVG` sub-export is used. Probably shared from/with the public marketing site's component library.
- A handful of pre-existing ESLint findings remain unaddressed across a few pages (`Date.now()` called during render flagged by the newer `react-hooks/purity` rule, a couple of unused `currentUser`/`err` bindings, one missing-dependency warning) — none are new regressions, `npm run build` succeeds, and `npm run lint` is not wired into the build.
- No automated tests exist in this project.

---

## 9. Directory tree (annotated)

```
3DEES_admin/
├── index.html                          # Vite HTML entry — favicon + <title>
├── vite.config.js
├── eslint.config.js
├── .env                                 # VITE_API_BASE_URL (gitignored)
├── package.json
├── public/
│   ├── 3dees_Logo.png                    # brand logo (non-square canvas)
│   └── favicon.png                       # square-cropped logo for the browser tab
└── src/
    ├── main.jsx                          # React root bootstrap
    ├── App.jsx                           # Route table + PortalProvider + ToastContainer
    ├── App.css
    ├── index.css                         # brand CSS variables, global body styles
    ├── context/
    │   └── PortalContext.jsx             # global reducer + every server-mutating action
    ├── hooks/
    │   ├── useAuth.js
    │   ├── useJobs.js
    │   ├── useApplications.js
    │   └── useToast.js
    ├── services/
    │   ├── apiClient.js                  # fetch wrapper, JWT + auto-refresh
    │   ├── authService.js
    │   ├── jobService.js
    │   ├── applicationService.js
    │   ├── userService.js
    │   ├── auditService.js
    │   ├── contactService.js
    │   └── egiService.js                 # EGI outbox queue (new)
    ├── components/
    │   ├── AdminLayout.jsx               # sidebar + header shell for authenticated routes
    │   ├── Navbar.jsx                    # LogoSVG (used) + public Navbar (unused)
    │   ├── ProtectedRoute.jsx
    │   ├── Toast.jsx
    │   ├── CandidateEditDrawer.jsx       # shared candidate-file drawer
    │   ├── EgiNoteModal.jsx              # required-note approve modal (new)
    │   ├── EgiBadges.jsx                 # sync/decision badge components (new)
    │   └── styles/                       # one .css per component above
    └── pages/
        ├── AdminLogin.jsx                 # /
        ├── OTPVerification.jsx            # /admin/verify
        ├── AdminDashboard.jsx             # /admin/dashboard
        ├── AdminJobs.jsx                  # /admin/jobs
        ├── AdminPendingApplications.jsx   # /admin/pending
        ├── AdminApplications.jsx          # /admin/applications
        ├── SuperadminDashboard.jsx        # /superadmin/dashboard
        ├── SuperadminPendingApplications.jsx  # /superadmin/pending
        ├── SuperadminViewAllApplications.jsx  # /superadmin/applications
        ├── SuperadminAllVacancies.jsx     # /superadmin/jobs
        ├── SuperadminManageAdmins.jsx     # /superadmin/admins
        ├── SuperadminAuditTrail.jsx       # /superadmin/audit
        ├── SuperadminEgiSync.jsx          # /superadmin/egi-sync (new)
        └── styles/                        # one .css per page above
```
