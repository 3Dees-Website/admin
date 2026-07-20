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

**[PortalContext.jsx](src/context/PortalContext.jsx)** holds `currentUser`, `token`, `jobs`, `admins` (superadmin only), and `toasts`. `loadInitialData()` (fired on mount if a session already exists, and again right after OTP success) only fetches jobs (and admins, for superadmins) — kept in sync via reducer actions as mutations happen.

**Applications and audit logs are *not* in this context** — they used to be, but were moved to per-page server-side pagination (§3.6) since a full in-memory copy of every application didn't scale. `reviewApplication`, `updateApplication`, and `bulkReviewApplications` no longer dispatch into the reducer; they simply **return** the updated record/result, and the calling page is responsible for refetching its own paginated list/stats afterward.

Four small hooks expose slices of this context so components don't need to know the context exists directly:

| Hook | Exposes |
|---|---|
| [useAuth.js](src/hooks/useAuth.js) | `currentUser`, `token`, `login`, `commitSession`, `logout`, `admins`, `registerAdmin`, `toggleAdminSuspension`, `resetAdminPass`, `removeAdmin` |
| [useJobs.js](src/hooks/useJobs.js) | `jobs`, `postJob`, `editJob`, `removeJob` |
| [useApplications.js](src/hooks/useApplications.js) | `applyToJob`, `reviewApplication`, `updateApplication`, `uploadVerificationDocument`, `deleteVerificationDocument`, `resendToEgi`, `bulkReviewApplications` — mutating actions only, no `applications`/`auditLogs` state (see §3.6) |
| [useToast.js](src/hooks/useToast.js) | `toasts`, `addToast`, `removeToast` |

The **EGI queue** (sync stats / failed deliveries / retry) is the one exception — it's fetched directly by the pages that need it via `egiService`, not routed through `PortalContext`, since it's ops-only data only one page consumes (see §7 EGI section).

### 3.4 Services layer (`src/services/`)

Each service wraps one REST resource and normalizes the backend's `snake_case` JSON into the `camelCase` shape the rest of the app expects. All authenticated calls go through the shared `apiClient` (JWT header injection + auto-refresh + JSON/blob handling described above).

| File | Resource | Notes |
|---|---|---|
| [apiClient.js](src/services/apiClient.js) | HTTP transport | `get/getBlob/post/postForm/put/patch/delete`, token refresh interceptor, `BASE_URL` export |
| [authService.js](src/services/authService.js) | `/api/auth/*` | Uses raw `fetch`, not `apiClient` — deliberately, so login/OTP calls never get caught in the refresh-retry loop |
| [jobService.js](src/services/jobService.js) | `/api/admin/jobs`, `/api/jobs` | Admin CRUD + public read routes |
| [applicationService.js](src/services/applicationService.js) | `/api/admin/applications*` | Paginated list (`getApplicationsPage`), stats (`getStats`, `getStatsByJob`), status-update/bulk-status, verification-document upload/delete, `resendToEgi`, `exportCsv` (now actually called — see §3.6/§7), public-submit; carries all EGI fields (see §7) |
| [userService.js](src/services/userService.js) | `/api/admin/users` | Superadmin-only staff account management |
| [auditService.js](src/services/auditService.js) | `/api/admin/audit-logs` | Paginated list (`getAuditLogsPage`), `exportCsv` (now actually called) |
| [contactService.js](src/services/contactService.js) | `/api/contact` | Public contact form submit (raw `fetch`, unauthenticated) |
| [egiService.js](src/services/egiService.js) | `/api/admin/egi/queue*` | EGI outbox queue stats/list/retry (added for the EGI integration) |
| [fieldCatalogService.js](src/services/fieldCatalogService.js) | `/api/field-catalog` | Dynamic application-field catalog, cached as a shared promise for the session (see §3.7) |

### 3.5 Layout shell

**[AdminLayout.jsx](src/components/AdminLayout.jsx)** is the shared page chrome for every authenticated route: a collapsible left sidebar (role-specific nav menu, logo, sign-out) + a top header bar + a mobile bottom tab bar. It's parameterized by a `role` prop (`"admin"` or `"superadmin"`) which selects which menu array to render. `App.jsx` wraps the entire `/admin` and `/superadmin` route trees in one `<AdminLayout>` each, with an `<Outlet />` for the active page.

### 3.6 Server-side pagination *(new)*

Applications and audit logs no longer live in `PortalContext` (§3.3) — they're fetched per-page directly from the backend via a generic hook factory, **[createPaginatedListHook.js](src/hooks/createPaginatedListHook.js)**: `createPaginatedListHook(fetchFn)` returns a `usePaginatedList(filters)` hook that debounces `search` (300ms), resets to page 1 whenever a non-search filter changes, guards against out-of-order responses with a request-id ref, and returns `{ items, total, page, pageSize, setPage, setPageSize, isLoading, error, refetch }`. Two instances of it exist: **[usePaginatedApplications.js](src/hooks/usePaginatedApplications.js)** (wraps `applicationService.getApplicationsPage`) and **[usePaginatedAuditLogs.js](src/hooks/usePaginatedAuditLogs.js)** (wraps `auditService.getAuditLogsPage`).

Every list page that shows applications or audit logs uses one of these instead of reading from context: `AdminApplications`, `AdminPendingApplications` (fixed `status: 'Pending'` filter), `SuperadminViewAllApplications`, `SuperadminPendingApplications` (fixed `status: 'Pending'` filter), and `SuperadminAuditTrail`. **[PaginationControls.jsx](src/components/PaginationControls.jsx)** renders the shared "Showing X–Y of total" label, a page-size select (20/50/100), and Prev/Next controls for all of them; **[TableLoadingRows.jsx](src/components/TableLoadingRows.jsx)** renders skeleton-bar `<tr>`s in place of real rows while a page is loading. `AdminApplications` and `SuperadminViewAllApplications` also poll every 60s (only while the tab is visible) and expose a manual Refresh button, since the list is no longer kept live by context mutations. Because `reviewApplication`/`updateApplication`/`bulkReviewApplications` just return the updated record now (§3.3), every page that calls them must `refetch()` its own list afterward.

Dashboard tiles and per-job counts that used to `.filter()`/`.reduce()` over a full in-memory `applications` array now read from two dedicated stats hooks instead: **[useApplicationStats.js](src/hooks/useApplicationStats.js)** (`GET /api/admin/applications/stats` → `{ total, byStatus, submittedToday, byEgiDecision, byEgiSyncStatus }`; used by `AdminDashboard`, `SuperadminDashboard`, and both pending-queue pages' stat tiles) and **[useJobStats.js](src/hooks/useJobStats.js)** (`GET /api/admin/applications/stats/by-job` → a `{ [jobId]: { total, pending, shortlisted, approved, rejected } }` map; used by `AdminJobs`/`SuperadminAllVacancies` for per-row applicant counts). Both fail silently — stats tiles are supplementary, pages stay usable without them. One known gap: `SuperadminPendingApplications`'s "Overdue (>7 days)" tile has no backend aggregate and is computed only from the current page's rows (see §8).

### 3.7 Dynamic field catalog & requirements builder *(new)*

The old hardcoded 11-checkbox "Application Info Checklist" on `AdminJobs.jsx` (`cvRequired`, `dobRequired`, etc.) is gone. Requirements are now driven by a live **field catalog** fetched from the backend (`GET /api/field-catalog`, cached for the session as a shared promise in **[fieldCatalogService.js](src/services/fieldCatalogService.js)**) describing ~90 possible application fields grouped into 9 sections (personal, jobInfo, employment, education, documents, professional, referees, declarations, roleSpecific) — see [docs/field-catalog-draft.md](docs/field-catalog-draft.md) for the design doc this was built from (once finalized it becomes `src/config/fieldCatalog.js` on the *backend*; this frontend only ever consumes it over HTTP, it doesn't hardcode the catalog). **[useFieldCatalog.js](src/hooks/useFieldCatalog.js)** exposes `{ catalog, isLoading }`; **[fieldCatalogHelpers.js](src/utils/fieldCatalogHelpers.js)** holds the pure grouping/derivation helpers (`groupFieldsBySection`, `getConditionalSubfieldKeys`, `getExperienceParentKeys`, `getSubfieldsForParent`) shared by every UI piece below.

A job's `applicationRequirements` is now a `{ [fieldKey]: 'required' | 'optional' }` map instead of fixed booleans. Three components sit on top of the catalog:
- **[RequirementsBuilder.jsx](src/components/RequirementsBuilder.jsx)** — the editable version used in `AdminJobs.jsx`'s create/edit modal: collapsible per-section panels, a tri-state (off/optional/required) toggle per field, bulk per-section actions, and a locked "Required" pill for any key in `catalog.mandatoryKeys` (mandatory keys are force-merged into every change emitted, and an old/empty config is self-healed on catalog load so the backend's `InvalidRequirements` check can't be tripped from this UI).
- **[RequirementsSummary.jsx](src/components/RequirementsSummary.jsx)** — the read-only counterpart, shown in `SuperadminAllVacancies.jsx`'s job detail drawer ("N fields enabled across M sections", expandable per-section breakdown).
- **[FieldRenderer.jsx](src/components/FieldRenderer.jsx)** — one editable control per catalog field type (text/textarea/select incl. a dependent state→LGA dropdown/yesno/declaration/date/number/year/email/tel); the same component renders both a job's requirements form and an already-submitted application's answers (see §3.8).

### 3.8 `ApplicationDetail` & edit locking *(new)*

All three "candidate file" surfaces in the app — the shared `CandidateEditDrawer`, and the bespoke inline drawers on `AdminApplications.jsx` and `SuperadminViewAllApplications.jsx` — now render identical content via one component, **[ApplicationDetail.jsx](src/components/ApplicationDetail.jsx)**. Each page still owns its own drawer chrome (overlay, header, footer status-action buttons — `CandidateEditDrawer` gates Approve behind `isSuperadmin`, `AdminApplications` doesn't; see §8), but the body — EGI panel, catalog-driven field sections (view or edit via `FieldRenderer`), applicant documents, verification documents, notes textarea, and status history — is defined exactly once. `CandidateEditDrawer.jsx` itself shrank to little more than `<ApplicationDetail app={app} currentUser={currentUser} notes={notes} onNotesChange={onNotesChange} onAppUpdated={onAppUpdated} />` plus its chrome.

Applications are now also **edit-locked** once they reach certain EGI states, mirrored client-side (UI-only — the backend is the real enforcement) by **[applicationLock.js](src/utils/applicationLock.js)**'s `getLockInfo(app, currentUser)`: unlocked while `Pending`/`Shortlisted`; locked (info banner) once `Approved` and awaiting an EGI decision; locked for everyone except a superadmin (who also gets `canResend: true`) if EGI declined; locked for non-superadmins once `Rejected`; permanently locked once EGI accepts. `ApplicationDetail` renders the resulting banner, hides its Edit toolbar and verification-document upload when locked, and — for a superadmin viewing a declined application — shows a "Resend to EGI" button (`applicationService.resendToEgi`, gated behind the same required-note `EgiNoteModal` flow as Approve). `EgiBadges.jsx` gained a matching `EgiResendBadge` pill showing the resend count.

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
| [PortalContext.jsx](src/context/PortalContext.jsx) | The app's data layer for `currentUser`/`token`/`jobs`/`admins`/`toasts` — reducer, server-mutating action creators, toast queue, session bootstrap-on-mount effect. See §3.3. |
| [useAuth.js](src/hooks/useAuth.js) / [useJobs.js](src/hooks/useJobs.js) / [useApplications.js](src/hooks/useApplications.js) / [useToast.js](src/hooks/useToast.js) | Thin selector hooks over `PortalContext` (see table in §3.3). |
| [createPaginatedListHook.js](src/hooks/createPaginatedListHook.js) | Generic paginated-list hook factory (debounced search, stale-response guard). See §3.6. |
| [usePaginatedApplications.js](src/hooks/usePaginatedApplications.js) / [usePaginatedAuditLogs.js](src/hooks/usePaginatedAuditLogs.js) | `createPaginatedListHook` instances over `applicationService`/`auditService`. See §3.6. |
| [useApplicationStats.js](src/hooks/useApplicationStats.js) / [useJobStats.js](src/hooks/useJobStats.js) | Dashboard/table stat tiles sourced from backend aggregate endpoints instead of client-side `.reduce()`. See §3.6. |
| [useFieldCatalog.js](src/hooks/useFieldCatalog.js) | `{ catalog, isLoading }` over `fieldCatalogService`. See §3.7. |

### 4.4 `src/services/`

Covered in §3.4. `fieldCatalogService.js` is new — see §3.7.

### 4.5 `src/utils/` *(new)*

| File | Purpose |
|---|---|
| [applicationLock.js](src/utils/applicationLock.js) | `getLockInfo(app, currentUser)` — client-side mirror of the backend's edit-locking ladder (banner copy, `locked`/`canResend` flags); `mapLockError(err)` translates backend lock-error codes for the rare race-condition case. See §3.8. |
| [downloadBlob.js](src/utils/downloadBlob.js) | `downloadBlob(blob, filename)` — generic blob→file-download via a temporary `<a download>` anchor. Used by the three pages with a real backend CSV export (see §7). |
| [fileView.js](src/utils/fileView.js) | `viewFile(doc)` — opens viewable types (PDF/JPG/PNG/WebP/GIF) in a new tab via an in-memory `<iframe>` document; falls back to `triggerDownload()` for other types. Used throughout `ApplicationDetail.jsx`. |
| [fieldCatalogHelpers.js](src/utils/fieldCatalogHelpers.js) | Pure grouping/derivation helpers over the field catalog (`groupFieldsBySection`, `getConditionalSubfieldKeys`, `getExperienceParentKeys`, `getSubfieldsForParent`). See §3.7. |
| [verificationDocTypes.js](src/utils/verificationDocTypes.js) | `VERIFICATION_DOC_TYPES` — the admin-only verification-document type list, must match the backend's `verificationDocuments.controller.js` labels exactly. |

### 4.6 `src/components/` (shared, cross-page)

| File | Purpose |
|---|---|
| [AdminLayout.jsx](src/components/AdminLayout.jsx) + `styles/AdminLayout.css` | Authenticated shell: sidebar (collapsible, logo, nav menu, sign-off), top header, mobile bottom tab bar. See §3.5. |
| [Navbar.jsx](src/components/Navbar.jsx) + `styles/Navbar.css` | Exports `LogoSVG` (an `<img>` wrapper around `/3dees_Logo.png`, used on the login page, OTP page, and inside `AdminLayout`'s sidebar header) and a full public marketing-site-style `<Navbar>` component. **Note:** the `<Navbar>` component itself is not currently rendered anywhere in this app's routes — only `LogoSVG` is imported from this file. It looks like a carry-over from a shared component library with the public marketing site. |
| [ProtectedRoute.jsx](src/components/ProtectedRoute.jsx) | Route guard — see §3.2. |
| [Toast.jsx](src/components/Toast.jsx) + `styles/Toast.css` | `ToastContainer` (reads `useToast()`, renders an `AnimatePresence` stack) + `ToastItem` (auto-dismisses after 4s). Toast types: `success`, `error`, `info`. |
| [CandidateEditDrawer.jsx](src/components/CandidateEditDrawer.jsx) + `styles/CandidateEditDrawer.css` | Now just the drawer **chrome** (overlay, header with name/job/ref + superadmin "Override Mode" banner, footer with Reject/Shortlist/Approve — Approve gated behind `isSuperadmin`) around a `<ApplicationDetail>` body. Used by both pending-queue pages. See §3.8. |
| [ApplicationDetail.jsx](src/components/ApplicationDetail.jsx) + `styles/ApplicationDetail.css` *(new)* | The single shared "candidate file" content renderer — EGI panel (sync/decision/resend badges, resend button), catalog-driven field sections (view or edit via `FieldRenderer`), documents panel, verification-documents panel, notes textarea, status history. Used by `CandidateEditDrawer` and directly embedded in `AdminApplications.jsx`'s and `SuperadminViewAllApplications.jsx`'s own bespoke drawers. See §3.8. |
| [FieldRenderer.jsx](src/components/FieldRenderer.jsx) + `styles/FieldRenderer.css` *(new)* | One editable control per field-catalog type (text/textarea/select incl. dependent LGA dropdown/yesno/declaration/date/number/year/email/tel). Used by `RequirementsBuilder` and `ApplicationDetail`. See §3.7. |
| [RequirementsBuilder.jsx](src/components/RequirementsBuilder.jsx) + `styles/RequirementsBuilder.css` *(new)* | Editable per-section, tri-state (off/optional/required) requirements builder used in `AdminJobs.jsx`'s job form, replacing the old fixed checkbox grid. See §3.7. |
| [RequirementsSummary.jsx](src/components/RequirementsSummary.jsx) + `styles/RequirementsSummary.css` *(new)* | Read-only requirements breakdown shown in `SuperadminAllVacancies.jsx`'s job detail drawer. See §3.7. |
| [PaginationControls.jsx](src/components/PaginationControls.jsx) + `styles/PaginationControls.css` *(new)* | Shared "Showing X–Y of total" + page-size select + Prev/Next UI for every server-paginated table. See §3.6. |
| [TableLoadingRows.jsx](src/components/TableLoadingRows.jsx) + `styles/TableLoadingRows.css` *(new)* | Skeleton-bar `<tr>` placeholders shown while a paginated table is loading. See §3.6. |
| [EgiNoteModal.jsx](src/components/EgiNoteModal.jsx) + `styles/EgiNoteModal.css` | Shared confirmation modal that collects the required "note to EGI" before any Approve or Resend action fires (optionally lists attached verification documents as a reminder). Used by every approve/resend flow in the app (single and bulk). See §7. |
| [EgiBadges.jsx](src/components/EgiBadges.jsx) + `styles/EgiBadges.css` | `<EgiSyncBadge status=.../>`, `<EgiDecisionBadge decision=.../>`, and `<EgiResendBadge count=.../>` — small colored pill components mapping the EGI status enums (and resend count) to gray/blue/green/red badges. See §7. |

### 4.7 `src/pages/`

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
| `/superadmin/egi-sync` | `SuperadminEgiSync` | role: `superadmin` | EGI outbox ops screen |
| `*` | → redirect | — | Anything unmatched goes to `/` |

There are two parallel worlds — `admin` and `superadmin` — that largely mirror the same underlying data (jobs, applications) with different levels of authority. Superadmin pages generally style themselves as "override"/"executive" tooling (warning banners about bypassing normal workflow, audit logging emphasis) and can Approve applications directly; plain Admins mostly Shortlist/Reject and hand off approval to a Superadmin (see the one inconsistency noted in §8).

### Public / unauthenticated pages

#### `AdminLogin.jsx` — `/`
Email + password form. Calls `authService.login` via the `login()` context action. On success, navigates to `/admin/verify` carrying `{ pendingToken, maskedEmail }`. Shows a spinner in the submit button while authenticating. Uses `LogoSVG` from `Navbar.jsx`.

#### `OTPVerification.jsx` — `/admin/verify`
Six individual digit inputs with auto-advance-on-type, backspace-across-box, arrow-key navigation, full paste support, and auto-submit once all six digits are filled. A 60-second countdown gates the "resend" affordance — there's no dedicated resend API, so "resend" actually just sends the user back to `/` to log in again (which triggers a fresh OTP email). On success, shows a checkmark success state and a short "Establishing secure session…" animation before redirecting (the redirect explicitly waits for `token`/`currentUser` to be present in context before firing, to avoid racing `ProtectedRoute`).

### Admin pages (`role="admin"`)

#### `AdminDashboard.jsx` — `/admin/dashboard`
Landing page after admin login. A greeting banner with the user's name + two quick-action buttons ("Post New Job" → deep-links to `/admin/jobs?create=open`, "Applications"). A 6-tile stats grid (Posted Positions, Applications, Pending Audit, Shortlisted, Approved Placements, Rejected Dossiers) now reads from `jobs` (context) + `useApplicationStats()`'s `byStatus`/`total` instead of reducing a full in-memory applications array (see §3.6). Below that, an "Incoming Recruits Feed" table of the 10 most recently submitted applications, fetched directly via a one-off `applicationService.getApplicationsPage({ page: 1, pageSize: 10 })` call.

#### `AdminJobs.jsx` — `/admin/jobs`
Full CRUD for job vacancies. A table of all jobs (title, client org, location, submission count — now from `useJobStats()`'s per-job map rather than a client-side `.reduce()`, status badge, per-row toggle/edit/delete actions). "Create/Edit" opens a large modal form covering: title, client org, category, employment type, location, openings, salary range, closing date, description, responsibilities, requirements (each a textarea, one item per line) — **plus** the new **[RequirementsBuilder](src/components/RequirementsBuilder.jsx)** (§3.7), which replaced the old fixed 11-checkbox grid with a catalog-driven, per-section tri-state (off/optional/required) builder controlling which fields/uploads the **public-facing application form** (outside this admin app) requires for that specific vacancy. Status toggle cycles Active → Closed → Draft → Active. Delete requires a confirm modal. Supports a `?create=open` query param (consumed once via `useSearchParams`, then cleared) to auto-open the create modal — used by the AdminDashboard quick-action link.

#### `AdminPendingApplications.jsx` — `/admin/pending`
Queue of only `Pending`-status applications for a normal admin to triage first, now server-paginated via `usePaginatedApplications({ status: 'Pending', ... })` (§3.6) with `TableLoadingRows` skeletons while loading and `PaginationControls` at the bottom. Search (name/email/reference/job title) + job filter. Stats: Total Pending / Received Today come from `useApplicationStats()`'s `byStatus.Pending`/`submittedToday` (an all-status approximation, noted in code as "close enough"), Selected is a local checkbox count. Row checkboxes + "Shortlist All" / "Reject All" bulk actions (no bulk-approve here — admins don't approve from this queue) call `bulkReviewApplications` then `refetch()` the current page. Per-row quick "Shortlist" button and "Open File" (opens `CandidateEditDrawer` with `isSuperadmin={false}`, so its Approve button is hidden — a plain admin can Shortlist/Reject from the drawer but not Approve). A "Waiting" badge color-codes days-since-submission (ok < 3 days, warn 3–6, alert ≥ 7).

#### `AdminApplications.jsx` — `/admin/applications`
The full applications list for an admin (all statuses, not just Pending), server-paginated via `usePaginatedApplications` (§3.6) with `TableLoadingRows`/`PaginationControls`, a 60s auto-poll (only while the tab is visible), and a manual Refresh button. Filters: search, job, status. Bulk Shortlist/Reject (checkbox selection, then `refetch()`). CSV export button now calls `applicationService.exportCsv(filters)` against the real backend export endpoint and pipes the resulting blob through `downloadBlob()` (previously a client-built CSV string — see §7/§8). Clicking "Audit File" opens a large **inline** drawer (this page keeps its own bespoke drawer chrome, not `CandidateEditDrawer`) whose body is the shared **[ApplicationDetail](src/components/ApplicationDetail.jsx)** component (§3.8) — EGI panel, catalog-driven fields, documents, verification documents, notes, status history — with footer actions Reject / Shortlist / **Approve & Sync** (this is the one place a plain admin can approve — see §8 for the noted inconsistency vs. the pending queue). Approve opens the shared `EgiNoteModal` to collect the required note before submitting.

### Superadmin pages (`role="superadmin"`)

#### `SuperadminDashboard.jsx` — `/superadmin/dashboard`
Landing page after superadmin login. An "Advisory Console Active" banner with a link to Manage Admins and a "Diagnostic Test" button (client-side only — just fires a toast, doesn't call any API). A 4-tile metrics grid: Active Staff Admins (now correctly sourced from `useAuth().admins`, see §8 — this used to read a stale `3dees_local_db` localStorage key), Total Active Jobs, Global Applications (`useApplicationStats()`'s `total`), and Logged Vetting Changes (`total` from a direct one-off `auditService.getAuditLogsPage({ page: 1, pageSize: 8 })` call, which also supplies the feed below). A two-column "work grid": a live audit-log stream (last 8 entries from that same call) and an **EGI Sync Health** card — this card fetches real numbers from `egiService.getQueueStats()` on mount (queue counts by status, computed failure rate, a link to the full `/superadmin/egi-sync` page).

#### `SuperadminPendingApplications.jsx` — `/superadmin/pending`
The superadmin equivalent of the admin pending queue, styled as "override" tooling with a red "Override Mode Available" banner, server-paginated via `usePaginatedApplications({ status: 'Pending', ... })` (§3.6) with `TableLoadingRows`/`PaginationControls`. Extra "Overdue (>7 days)" stat tile — a known gap, since there's no backend aggregate for it, it's computed only from the current page's rows (see §8). Per-row actions: quick Shortlist, quick **Approve** (opens `EgiNoteModal` for the required note, then calls `reviewApplication` and `refetch()`s the page), and "Override File" (opens the shared `CandidateEditDrawer` with `isSuperadmin={true}`, exposing its Approve button too). Bulk bar adds "Bulk Approve & Sync" alongside Bulk Shortlist/Reject — bulk-approve specifically routes through the real `PATCH /api/admin/applications/bulk-status` endpoint (via `bulkReviewApplications`) rather than looping single-application calls, since the backend now requires one shared `egiNote` per bulk-approve call.

#### `SuperadminViewAllApplications.jsx` — `/superadmin/applications`
Superadmin's version of the full applications list (all statuses, all jobs), server-paginated (§3.6) with the same 60s auto-poll/manual-refresh pattern as `AdminApplications.jsx`. Own bespoke drawer chrome (compliance-override warning banner, footer actions Reject & Block / Force Shortlist / Approve & Portal Sync gated behind `EgiNoteModal`), but its body is now the shared **[ApplicationDetail](src/components/ApplicationDetail.jsx)** component (§3.8) — same EGI panel/fields/documents/notes/history as everywhere else. CSV export now calls `auditService`'s applications counterpart, `applicationService.exportCsv(filters)`, against the real backend endpoint via `downloadBlob()` rather than building a CSV client-side.

#### `SuperadminAllVacancies.jsx` — `/superadmin/jobs`
Read-mostly, cross-client view of every vacancy (vs. `AdminJobs.jsx` which is full CRUD). Filters: search, category, status. Summary tiles: Total Vacancies, Active Pipelines, Closed Slots, Total Openings. CSV export (Title, ClientOrg, Category, Type, Location, Openings, SalaryRange, Status, ClosingDate, PostedBy, TotalApplicants, Approved). "Audit & Override" opens a detail drawer with full job details, a **[RequirementsSummary](src/components/RequirementsSummary.jsx)** (§3.7) showing the job's field-catalog requirements, an applicant-pipeline summary (total/shortlisted/approved/rejected counts now from `useJobStats()` rather than inline `.filter().length` calls), description/requirements text, and footer actions to Force Delete or Close/Reopen the vacancy. Does not support creating or editing job content (only status toggle + delete) — creation/editing of job content lives only on the Admin side (`AdminJobs.jsx`).

#### `SuperadminManageAdmins.jsx` — `/superadmin/admins`
Staff account management — the only page that touches `userService`/the `/api/admin/users` endpoints. Table of all admin accounts (name, email, created date, last login, Active/Suspended badge). "Register Vetting Officer" modal creates a new admin (name/email/initial password). Per-row: toggle suspension, reset password (modal, overwrite passcode directly — no email flow), delete (confirm modal).

#### `SuperadminAuditTrail.jsx` — `/superadmin/audit`
Read-only compliance log, now server-paginated via `usePaginatedAuditLogs` (§3.6) with `TableLoadingRows`/`PaginationControls` instead of reading a full `auditLogs` array out of context (that array no longer exists — see §3.3). Filters: search, actor, status (all sent as query params to `GET /api/admin/audit-logs`). Table of every matching status change: timestamp, log ID, applicant + job, officer who made the change, and a "status shift" visual (`prevStatus → newStatus` badges). A new "Export filtered CSV" button calls `auditService.exportCsv(filters)` against the real backend endpoint via `downloadBlob()`.

#### `SuperadminEgiSync.jsx` — `/superadmin/egi-sync`
Ops screen for the EGI delivery outbox. Unlike every other page, this one fetches its own data directly (not through `PortalContext`) since it's a narrow ops concern. A 4-tile stat row (Pending/Queued/Synced/Failed counts from `egiService.getQueueStats()`). Filters: free-text application-ID search, status dropdown (defaults to `Failed`). Table columns: Reference, Applicant Email, Status badge, Attempts, Last Error (truncated with a title tooltip), Next Attempt At, and a **Retry** button (only rendered for `Failed` rows) that calls `egiService.retryQueueItem(id)` and then refetches both the stats and the item list.

---

## 6. Styling conventions

There is no global component library or design system — instead, **each page/component owns one CSS file with all its classes under a short, unique prefix**, so there's never any class-name collision across files even though everything is plain global CSS (no CSS Modules, no scoping). Examples: `aa-` (AdminApplications), `apa-` (AdminPendingApplications), `aj-` (AdminJobs), `al-` (AdminLogin), `otp-` (OTPVerification), `spa-` (SuperadminPendingApplications), `sva-` (SuperadminViewAllApplications), `sav-` (SuperadminAllVacancies), `sma-` (SuperadminManageAdmins), `sat-` (SuperadminAuditTrail), `sd-` (SuperadminDashboard), `ced-` (CandidateEditDrawer), `ses-` (SuperadminEgiSync), `enm-` (EgiNoteModal), `ad-` (ApplicationDetail, new — its section anchors are `#ad-section-<key>`).

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

3DEES places candidates with a partner organization, **EGI**, via an outbox-style async sync: when an application is Approved, the backend queues it for delivery to EGI's system in the background rather than syncing synchronously. This section covers the full frontend surface for that flow.

### What changed on the backend, in one paragraph
Approving an application now requires an admin-authored **note to EGI** (`egiNote`) sent alongside the approval — the backend rejects `Approved` transitions missing it with `400 MissingField`. Every application now also carries: `egi_sync_status` (`Pending → Queued → Synced`/`Failed`), and EGI's own verdict via `egi_decision` (`Pending → Accepted`/`Declined`) plus `egi_decision_note`, `egi_decision_by`, `egi_decision_at`, `egi_reference_id`. There's also a small queue/outbox API for inspecting and retrying failed deliveries — those `/api/egi/*` routes used by *EGI's own backend* (API-key/HMAC auth) are out of scope for this frontend; only the `/api/admin/egi/*` ops routes (JWT-authenticated, same as everything else) are used here.

### Required-note approve flow
Every place in the app where an admin can transition an application to `Approved` now opens **[EgiNoteModal](src/components/EgiNoteModal.jsx)** — a small modal with a required textarea ("Note to EGI") that must be non-empty before the Confirm button will submit. This covers:
- The shared `CandidateEditDrawer`'s Approve button (used by both pending-queue pages)
- `AdminApplications.jsx`'s inline drawer Approve button
- `SuperadminViewAllApplications.jsx`'s inline drawer Approve button
- `SuperadminPendingApplications.jsx`'s per-row quick-Approve button
- `SuperadminPendingApplications.jsx`'s **Bulk** Approve button (one shared note applies to the whole batch — this call was switched from looping individual status updates to calling the real `bulk-status` endpoint once)
- The new **Resend to EGI** action inside `ApplicationDetail` (§3.8) — shown only when a superadmin views a `Declined` application (`getLockInfo().canResend`); calls `applicationService.resendToEgi(id, egiNote)` and increments `egiResendCount`

By deliberate product decision (confirmed with the user), a pre-existing inconsistency was **left as-is** rather than "fixed" as a drive-by: a plain Admin can approve directly from `AdminApplications.jsx`, but cannot approve from the Pending Queue drawer (`isSuperadmin` gate). Both surfaces now require the EGI note; neither's access control was changed.

### Edit locking
Once an application reaches certain EGI states, `ApplicationDetail` locks it from further edits — see **[applicationLock.js](src/utils/applicationLock.js)** and §3.8 for the full state ladder (unlocked while Pending/Shortlisted, locked pending an EGI decision, superadmin-only unlocked-with-resend if declined, locked for non-superadmins once Rejected, permanently locked once Accepted).

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

A third badge, **`EgiResendBadge`** (blue "Resent ×N", renders nothing if the count is 0), shows next to the decision badge wherever an application has been resent (see the Resend flow above). These badges appear as extra table columns on `AdminApplications.jsx` and `SuperadminViewAllApplications.jsx` (deliberately **not** added to the two Pending-only queue tables, since every row there is trivially `Pending`/`Awaiting EGI` and the column would carry no information). Full detail — including the note sent, EGI's decline reason if declined, and who/when EGI decided — is shown in the shared **[ApplicationDetail](src/components/ApplicationDetail.jsx)** view (§3.8) used by every drawer.

### CSV exports
CSV export on `AdminApplications.jsx`, `SuperadminViewAllApplications.jsx`, and `SuperadminAuditTrail.jsx` is no longer built client-side — each now calls its service's `exportCsv(filters)` against the real backend `/export` endpoint (`applicationService`/`auditService`) and pipes the resulting `Blob` through the shared **[downloadBlob.js](src/utils/downloadBlob.js)** util. This resolves the previous inconsistency where those backend endpoints existed but were never called (see former §8 note, now removed).

### Ops screen (superadmin-only)
- **`SuperadminDashboard.jsx`**'s "Sync Health" tile shows real numbers — queue counts by status, a computed failure rate, and a link into the full ops screen below.
- **`SuperadminEgiSync.jsx`** (`/superadmin/egi-sync`) — the full Failed Deliveries table with per-row Retry, described in §5.

---

## 8. Known rough edges / tech debt (not fixed, worth knowing about)

- **`AdminApplications.jsx` lets a plain admin Approve directly**, while the Pending Queue drawer restricts Approve to superadmins only. Confirmed intentional-to-leave by the project owner (see §7) rather than a bug to fix silently.
- **`SuperadminPendingApplications.jsx`'s "Overdue (>7 days)" stat tile** has no backend aggregate to back it — it's computed only from whichever page of results happens to be currently loaded, not the true overdue count across all pages. Noted in the code as a known degradation of the move to server-side pagination (§3.6).
- **The public `<Navbar>` component** in `Navbar.jsx` (full nav bar with mobile menu, scroll-shadow, logout button) is exported but not rendered by any route in this app — only its `LogoSVG` sub-export is used. Probably shared from/with the public marketing site's component library.
- A handful of pre-existing ESLint findings remain unaddressed across a few pages (`Date.now()` called during render flagged by the newer `react-hooks/purity` rule, a couple of unused `currentUser`/`err` bindings, one missing-dependency warning) — none are new regressions, `npm run build` succeeds, and `npm run lint` is not wired into the build.
- No automated tests exist in this project.

Two items previously listed here are now resolved: `SuperadminDashboard.jsx`'s "Active Staff Admins" tile was switched from a stale `3dees_local_db` localStorage read to the real `useAuth().admins` list, and `applicationService.exportCsv`/`auditService.exportCsv` are now actually called by all three CSV export buttons (§7).

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
├── docs/
│   └── field-catalog-draft.md            # design doc for the ~90-field application catalog (new)
└── src/
    ├── main.jsx                          # React root bootstrap
    ├── App.jsx                           # Route table + PortalProvider + ToastContainer
    ├── App.css
    ├── index.css                         # brand CSS variables, global body styles
    ├── context/
    │   └── PortalContext.jsx             # reducer for currentUser/token/jobs/admins/toasts only
    ├── hooks/
    │   ├── useAuth.js
    │   ├── useJobs.js
    │   ├── useApplications.js            # mutating actions only, no applications/auditLogs state
    │   ├── useToast.js
    │   ├── createPaginatedListHook.js    # generic paginated-list hook factory (new)
    │   ├── usePaginatedApplications.js   # (new)
    │   ├── usePaginatedAuditLogs.js      # (new)
    │   ├── useApplicationStats.js        # (new)
    │   ├── useJobStats.js                # (new)
    │   └── useFieldCatalog.js            # (new)
    ├── services/
    │   ├── apiClient.js                  # fetch wrapper, JWT + auto-refresh, shared buildQueryString
    │   ├── authService.js
    │   ├── jobService.js
    │   ├── applicationService.js         # paginated list, stats, verification docs, resendToEgi, exportCsv
    │   ├── userService.js
    │   ├── auditService.js               # paginated list, exportCsv
    │   ├── contactService.js
    │   ├── egiService.js                 # EGI outbox queue
    │   └── fieldCatalogService.js        # dynamic field catalog, session-cached (new)
    ├── utils/                            # (new directory)
    │   ├── applicationLock.js            # client-side mirror of backend edit-locking ladder
    │   ├── downloadBlob.js               # generic blob → file download
    │   ├── fileView.js                   # in-tab document viewer / download fallback
    │   ├── fieldCatalogHelpers.js        # pure catalog grouping/derivation helpers
    │   └── verificationDocTypes.js       # admin verification-document type list
    ├── components/
    │   ├── AdminLayout.jsx               # sidebar + header shell for authenticated routes
    │   ├── Navbar.jsx                    # LogoSVG (used) + public Navbar (unused)
    │   ├── ProtectedRoute.jsx
    │   ├── Toast.jsx
    │   ├── CandidateEditDrawer.jsx       # drawer chrome only, body delegates to ApplicationDetail
    │   ├── ApplicationDetail.jsx         # shared candidate-file content renderer (new)
    │   ├── FieldRenderer.jsx             # one control per field-catalog type (new)
    │   ├── RequirementsBuilder.jsx       # editable job requirements builder (new)
    │   ├── RequirementsSummary.jsx       # read-only job requirements breakdown (new)
    │   ├── PaginationControls.jsx        # shared pager UI (new)
    │   ├── TableLoadingRows.jsx          # skeleton rows for paginated tables (new)
    │   ├── EgiNoteModal.jsx              # required-note approve/resend modal
    │   ├── EgiBadges.jsx                 # sync/decision/resend badge components
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
        ├── SuperadminEgiSync.jsx          # /superadmin/egi-sync
        └── styles/                        # one .css per page above
```
