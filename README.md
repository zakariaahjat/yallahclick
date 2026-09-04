# YallahClick — Studio Admin + Content Website

A fully dynamic, JSON-backed content management system. The **admin dashboard** and the **public website** share one backend API and one JSON database, where **each content section lives in its own JSON file**, so every create / edit / delete / activate / deactivate you make in the dashboard is persisted to JSON and automatically appears on the website after refresh — in any browser.

---

## 1. Architecture

```
ADMIN DASHBOARD  (admin/*.html)
      │  POST /api/:collection   (Bearer auth)
      ▼
   EXPRESS API   (backend/)
      │  read/write
      ▼
   JSON DATABASE (data/*.json)  ← per-section JSON files (single source of truth)
      │  GET /api/:collection    (anonymous)
      ▼
   PUBLIC WEBSITE (index.html, ai-prompts.html, templates.html, psd-templates.html, …)
```

Each content section has **its own JSON file** (e.g. `data/prompts.json`, `data/video-templates.json`). The website and dashboard both consume the same API. Nothing is hardcoded in React state or duplicated across files — the per-section JSON files + API drive everything. On Vercel, files are mirrored to Upstash Redis KV (`YC_KV_REST_URL` / `YC_KV_REST_TOKEN`) so admin changes survive serverless cold starts.

---

## 2. The JSON database

All content is stored in **one JSON file per section** under `data/`:

```
data/*.json             ← per-section databases (single source of truth)
data/*.js               ← seed data used to (re)generate the JSON files
data/settings.js        ← default site settings (seeded)
uploads/                ← admin-uploaded images/files (git-ignored)
```

Sections (each maps to a REST endpoint):

| Collection        | File                     | Endpoint           | Dashboard page            | Public page |
|-------------------|--------------------------|--------------------|---------------------------|-------------|
| `prompts`         | `data/prompts.json`      | `/api/prompts`     | `admin/ai-prompts.html`   | `ai-prompts.html` |
| `templates`       | `data/templates.json`    | `/api/templates`   | `admin/templates.html`    | `templates.html` |
| `videoTemplates`  | `data/video-templates.json` | `/api/video-templates` | `admin/video-templates.html` | `video-templates.html` |
| `thumbnailTemplates` | `data/thumbnail-templates.json` | `/api/thumbnail-templates` | `admin/thumbnail-templates.html` | `thumbnail-templates.html` |
| `psdTemplates`    | `data/psd-templates.json` | `/api/psd-templates` | `admin/psd-templates.html` | `psd-templates.html` |
| `promotions`      | `data/promotions.json`  | `/api/promotions`  | `admin/promotions.html`   | promo popup (all pages) |
| `settings`        | `data/settings.json`    | `/api/settings`    | `admin/settings.html`     | site-wide config |
| `bookings`        | `data/bookings.json`    | `/api/bookings`    | `admin/bookings.html`     | booking form |
| `customers`       | `data/customers.json`   | `/api/customers`   | `admin/customers.html`    | — |
| `files`           | `data/files.json`       | `/api/files`       | `admin/files.html`        | — |
| `categories`      | `data/categories.json`  | `/api/categories`  | `admin/categories.html`   | filter options |
| `services`        | `data/services.json`    | `/api/services`    | —                         | services list |
| `admins`          | `data/admins.json`      | `/api/admins`      | `admin/users.html`        | — |

On first boot the server seeds each JSON file from the `data/*.js` seed files (identical dataset to the static demo). If a JSON file already exists, its data is preserved; newly introduced collections (e.g. `settings`, `psdTemplates`) are backfilled automatically.

---

## 3. API endpoints

### Generic CRUD (available for every collection above)

```
GET    /api/:collection                 list (filters, search, sort, limit)
GET    /api/:collection/:id             one
POST   /api/:collection                 create            (auth required)
PUT    /api/:collection/:id             replace           (auth required)
PATCH  /api/:collection/:id             partial update    (auth required)
DELETE /api/:collection/:id             delete            (auth required)
```

Query examples:

```
GET /api/prompts?search=hook
GET /api/templates?status=published&sort=views:desc&limit=9
GET /api/promotions?filters={%22status%22:%22active%22}
```

Reads (GET) are **public**. Writes (POST/PUT/PATCH/DELETE) require an `Authorization: Bearer <token>` header from `/api/auth/login`. This satisfies the security requirement: **the public can only read published content; only authenticated admins can modify it.**

### Auth

```
POST /api/auth/login      { email, password }  → { token, user }
GET  /api/auth/me         (Bearer)             → current admin
POST /api/auth/logout     (stateless)
POST /api/auth/reset      (Bearer)             → reset DB to seed data
```

Default admin: `admin@yallahclick.com` / `admin123`.

### Uploads

```
POST /api/upload   (Bearer)   multipart/form-data: file + optional folder
```

Saves the file to `uploads/<folder>/...` and returns `{ data: { url } }`. The **URL** (not base64) is stored in JSON, keeping the database small. Folder may be `promotions`, `files`, `templates`, `video`, `thumbnails`, or `content`. Uploaded files are served at `/uploads/...`.

---

## 4. How the dashboard communicates with the API

- The admin pages load `services/backend.js` after `services/storage.js`.
- `services/backend.js` hydrates every collection from the API into an in-memory cache and **bridges `YC.Store`**: reads come from the API cache, and every write is pushed back to the API.
- `pushCollection()` does a **full sync**: brand-new records are `POST`ed, edited existing records are `PATCH`ed, and removed server records are `DELETE`d.
- The admin's auth token is stored in `localStorage`/`sessionStorage` under `yc-token` and attached as a `Bearer` header on writes.
- The dashboard CRUD forms (prompts, templates, video, thumbnails, promotions) call `svc.create / svc.update / svc.remove / svc.togglePublish`, which route through `YC.Store.write` → `pushCollection` → the API.

---

## 5. How the website loads the data

- Every public library page (`ai-prompts.html`, `templates.html`, `video-templates.html`, `thumbnail-templates.html`) waits on `YC.backend.ready` (hydration) before rendering.
- `js/library.js` reads `YC.services.*.all()` (backed by the API cache) and only shows `published` items, with search/filter/sort.
- The **promo popup** (`js/promo-popup.js`) reads `YC.services.promotions.getActiveForPopup()` — the active, popup-enabled promotion from JSON. If a promotion is active it shows; if inactive/expired/none it is hidden automatically.
- On refresh (F5), the page re-hydrates from the API, so the latest JSON data is always shown.

---

## 6. How promotions are controlled

The dashboard Promotion page (`admin/promotions.html`) manages `promotions` in JSON via the API. Each promotion has:

- `title`, `description`, `serviceId`, `destPage`
- `promoType`: `code` (visitor copies a code) or `discount` (auto-applied)
- `discountType` (`percentage`/`fixed`) + `discountValue`, `promoCode`
- `startDate`/`endDate` (+ times), `image` (banner), `ctaText`
- `popupEnabled`, `popupDelay`, `popupPosition`, `showOnce`, `showEveryVisit`, `countdownEnabled`, `closeButton`
- `active`, `featured`

Rules:

- **Active** → the popup/banner shows on the website.
- **Inactive** (`active: false`) → hidden.
- **Expired** (past `endDate`) → automatically hidden.
- **Scheduled** (before `startDate`) → hidden until active.
- Edit/activate/deactivate from the dashboard → saved to JSON → the website reflects it after refresh.

The popup renders title, description, discount, banner image, promo code (with copy), countdown timer (when enabled), CTA button and close button — all driven by the JSON record, never hardcoded.

---

## 7. Settings persistence

The dashboard **Settings** page (`admin/settings.html`) now saves to the `settings` collection in the backend instead of only the visitor's browser. `js/shared.js` `YC.settings` prefers the server copy (falling back to localStorage only when offline, then to bundled defaults). This means site-wide settings (name, logos, booking rules, popup behavior, social links) set in the dashboard are applied **for all visitors in all browsers**.

---

## 8. How persistence works across browsers / refreshes

- **Persistent hosts (local dev, Railway, Render, Fly):** writes go to the per-section files in `data/` (e.g. `data/prompts.json`) atomically (temp-file + rename, per-collection write queues to prevent lost updates). The files survive restarts and are the same for every visitor.
- **Vercel (serverless) — IMPORTANT:** the filesystem is **ephemeral and reset on cold starts**, so plain JSON files do NOT persist. To make this durable on Vercel you must enable the built-in **Upstash/KV** remote store:

  1. Create a free Upstash KV (or Vercel KV) database.
  2. Copy its **REST URL** and **REST token**.
  3. In Vercel → project → **Settings → Environment variables**, add:
     - `YC_KV_REST_URL` = `https://...upstash.io`
     - `YC_KV_REST_TOKEN` = your token
     - (optional) `YC_KV_ENABLED` = `1`
  4. Redeploy. Each section is persisted to its own KV key (`yc:db:<section>`, e.g. `yc:db:prompts.json`) instead of one blob; `KV_ENABLED` becomes true and the server reads/writes from the durable store instead of the ephemeral disk.

  With KV enabled, dashboard edits persist across cold starts and all regions/browsers.

> Uploaded image files on Vercel are also ephemeral. For permanent image storage on serverless use object storage (S3/R2) or external URLs; the `/uploads` endpoint works fully on persistent hosts and local dev.

---

## 9. Running locally

```bash
# 1) install deps (express + cors)
npm install

# 2) run the backend (serves both the API and the static site)
npm start            # → http://localhost:3000

# 3) open the site
#    Public website:  http://localhost:3000
#    Admin login:     http://localhost:3000/admin/login.html
#    (admin@yallahclick.com / admin123)

# checks
npm run check        # syntax-check all backend files
npm run seed         # regenerates every data/<section>.json from data/*.js
npm test             # backend tests
```

A different port:

```powershell
$env:PORT = 4000; npm start
```

### Environment variables (all optional except where noted)

| Variable         | Purpose                                        |
|------------------|------------------------------------------------|
| `PORT`           | HTTP port (default 3000)                       |
| `YC_DATA_DIR`    | Directory holding the per-section JSON files (default `./data`) |
| `YC_SEED_DIR`    | Directory holding the `data/*.js` seed modules (default `./data`) |
| `YC_KV_REST_URL` | **Vercel:** Upstash KV REST URL (for durability) |
| `YC_KV_REST_TOKEN` | **Vercel:** Upstash KV REST token             |
| `YC_AUTH_SECRET` | Secret for signing admin tokens (set in prod)  |
| `YC_LOG`         | Set `1` to log API requests                    |

---

## 10. Files changed / relevant

| File | Purpose |
|------|---------|
| `backend/server.js` | Express app; `/api/*`, `/api/upload`, static site + `/uploads` |
| `backend/db.js` | JSON DB with typed CRUD, atomic writes, optional durable KV persistence |
| `backend/routes/generic.js` | Generic REST CRUD router for every collection |
| `backend/routes/auth.js` | Login / me / logout (HMAC-signed tokens) |
| `data/*.json` | **The per-section JSON databases (source of truth)** |
| `data/*.js` | Default seed modules (used to (re)generate the JSON files) |
| `services/backend.js` | Client API bridge + sync (`YC.backend`) |
| `services/storage.js` | `YC.Store` + `YC.createService` (CRUD factory) |
| `js/shared.js` | Site-wide helpers incl. persistent `YC.settings` |
| `js/admin-app.js` | Admin controllers (all CRUD forms, upload fields, filters) |
| `js/promo-popup.js` | Public promo popup (driven by promotions JSON) |
| `js/library.js` | Public content grids (prompts/templates/…) |
