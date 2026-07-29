# Mini ERP + CRM Operations Portal

A small ERP/CRM system for a wholesale/distribution company, covering customers (CRM), products and stock, and sales challans, used by internal Sales, Warehouse, Accounts and Admin teams.

## Live URLs

- **Frontend (Vercel):** http://erp-crm-portal-umber.vercel.app
- **Backend API (Render):** https://erp-crm-portal-va0y.onrender.com
- **Interactive API docs (Swagger):** https://erp-crm-portal-va0y.onrender.com/docs
- **Database:** Supabase (PostgreSQL)

> Replace `YOUR-API` above with your actual Render service URL before submitting.

## Tech stack

| Layer     | Technology |
|-----------|------------|
| Backend   | Node.js, TypeScript, Express.js, PostgreSQL (`pg`), Zod validation, JWT auth, bcrypt |
| Frontend  | React 18, TypeScript, Vite, React Router, Axios, plain responsive CSS |
| Database  | PostgreSQL (Supabase) |
| Docs      | Swagger UI (OpenAPI 3), Postman collection |
| Hosting   | Vercel (frontend), Render (backend), Supabase (database) |

## Bonus features implemented

- **PDF challan/invoice download** — each challan can be downloaded as a professionally formatted PDF, generated server-side with PDFKit and streamed to the browser through the authenticated API.
- **Interactive API documentation** — Swagger UI at `/docs` documents every endpoint with parameters, request bodies, roles and response codes; authorize with a token to call the API live from the browser.

## Test login credentials

All accounts use password **`Password@123`**

| Role      | Email               | Permissions |
|-----------|---------------------|-------------|
| Admin     | admin@erp.com       | Everything |
| Sales     | sales@erp.com       | Customers, follow-ups, challans (+ view products) |
| Warehouse | warehouse@erp.com   | Products, stock movements (+ view customers/challans) |
| Accounts  | accounts@erp.com    | View-only across modules |

## Project structure

```
erp-crm-portal/
├── backend/
│   ├── sql/schema.sql          # Full database schema
│   ├── src/
│   │   ├── index.ts            # Express app entry (+ Swagger at /docs)
│   │   ├── db.ts               # pg connection pool (SSL configurable)
│   │   ├── openapi.ts          # OpenAPI 3 spec for Swagger UI
│   │   ├── schemas.ts          # Zod validation schemas
│   │   ├── seed.ts             # Seed users + sample data
│   │   ├── runSchema.ts        # Applies schema.sql
│   │   ├── utils/
│   │   │   └── invoicePdf.ts   # PDF challan/invoice generator (PDFKit)
│   │   ├── middleware/
│   │   │   ├── auth.ts         # JWT verify + role-based access (RBAC)
│   │   │   └── errorHandler.ts # Central error handler (Zod, HTTP, PG errors)
│   │   └── routes/
│   │       ├── auth.ts         # POST /auth/login, GET /auth/me
│   │       ├── customers.ts    # CRM module
│   │       ├── products.ts     # Products + stock movements
│   │       ├── challans.ts     # Sales challans + confirm logic + PDF
│   │       └── dashboard.ts    # Summary counts
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── api.ts              # Axios instance + JWT interceptor
│   │   ├── auth.tsx            # Auth context (login/logout/role checks)
│   │   ├── App.tsx             # Routes (protected)
│   │   ├── components/         # Layout (sidebar), Pager
│   │   └── pages/              # Login, Dashboard, Customers, CustomerDetail,
│   │                           # Products, Challans, ChallanForm, ChallanDetail
│   └── .env.example
├── postman_collection.json
└── README.md
```

## Running locally

### Prerequisites
- Node.js 18+ (`node --version`)
- A PostgreSQL database (easiest: a free Supabase project)

### 1. Database (Supabase)
1. Create a free project at https://supabase.com
2. Open **SQL Editor**, paste the contents of `backend/sql/schema.sql`, and run it (run without RLS).
3. Click the **Connect** button (top of the dashboard) → **Connection string → Transaction pooler**, and copy the URI. Replace `[YOUR-PASSWORD]` with your database password.

### 2. Backend
```bash
cd backend
npm install
cp .env.example .env        # Windows: copy .env.example .env
# Edit .env -> set DATABASE_URL (from Supabase) and a random JWT_SECRET
npm run db:seed             # creates the 4 test users + sample data
npm run dev                 # starts API on http://localhost:5000
```
(If you didn't run schema.sql in the Supabase editor, `npm run db:schema` applies it too.)

Once running, the interactive API docs are at **http://localhost:5000/docs**.

### 3. Frontend
```bash
cd frontend
npm install
cp .env.example .env        # VITE_API_URL=http://localhost:5000
npm run dev                 # opens http://localhost:5173
```

Log in with `admin@erp.com` / `Password@123`.

## Environment variables

### Backend (`backend/.env`)
| Variable | Description |
|----------|-------------|
| `PORT` | API port (Render sets this automatically) |
| `DATABASE_URL` | PostgreSQL connection string (Supabase URI) |
| `JWT_SECRET` | Long random string used to sign tokens |
| `JWT_EXPIRES_IN` | Token lifetime, e.g. `1d` |
| `CORS_ORIGIN` | Allowed frontend origin(s), comma separated |
| `DB_SSL` | `true`/`false` to force SSL; auto-detected if unset |

### Frontend (`frontend/.env`)
| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Backend base URL (baked in at build time) |

Secrets are never committed — `.env` is gitignored; only `.env.example` templates are in the repo.

## Deployment

### Database — Supabase (free)
Already done in "Running locally" step 1. Note the pooler connection string.

### Backend — Render (free)
1. Push the repo to GitHub.
2. On https://render.com → **New → Web Service** → connect the repo.
3. Settings:
   - **Root Directory:** `backend`
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
4. Environment variables: `DATABASE_URL` (Supabase pooler URI), `JWT_SECRET`, `JWT_EXPIRES_IN=1d`, `CORS_ORIGIN=https://YOUR-APP.vercel.app`
5. Deploy. Verify `https://YOUR-API.onrender.com/health` returns `{"status":"ok"}` and `https://YOUR-API.onrender.com/docs` loads the API docs.
6. Seed production data once from your machine: temporarily point your local `backend/.env` `DATABASE_URL` at Supabase and run `npm run db:seed`.

> Note: Render free instances sleep after 15 minutes of inactivity; the first request after that takes ~30–50s.

### Frontend — Vercel (free)
1. On https://vercel.com → **Add New → Project** → import the repo.
2. Settings:
   - **Root Directory:** `frontend`
   - Framework preset: Vite (auto-detected)
3. Environment variable: `VITE_API_URL=https://YOUR-API.onrender.com`
4. Deploy, then copy the Vercel URL into the backend's `CORS_ORIGIN` on Render and redeploy the backend.

## API documentation

- **Swagger UI (interactive):** `https://YOUR-API.onrender.com/docs` — authorize with a token from `POST /auth/login`, then call any protected endpoint from the browser. Raw spec at `/openapi.json`.
- **Postman collection:** `postman_collection.json` in the repo. Import it, set the `baseUrl` variable, run **Login** first (it auto-saves the token), then any request works.

### Main endpoints

| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | `/auth/login` | public | Log in, receive JWT |
| GET | `/auth/me` | any | Current user |
| GET | `/customers` | any | List (search, status/type filter, paginate) |
| POST | `/customers` | SALES/ADMIN | Create customer |
| GET | `/customers/:id` | any | Detail + follow-ups |
| PUT | `/customers/:id` | SALES/ADMIN | Update customer |
| POST | `/customers/:id/followups` | SALES/ADMIN | Add follow-up note |
| GET | `/products` | any | List (search, low-stock filter, paginate) |
| POST | `/products` | WAREHOUSE/ADMIN | Create product |
| GET | `/products/:id` | any | Detail + movement log |
| PUT | `/products/:id` | WAREHOUSE/ADMIN | Update product details |
| POST | `/products/movements` | WAREHOUSE/ADMIN | Record stock IN/OUT |
| GET | `/challans` | any | List (search, status filter, paginate) |
| POST | `/challans` | SALES/ADMIN | Create (DRAFT or CONFIRMED) |
| GET | `/challans/:id` | any | Detail with snapshot items |
| PATCH | `/challans/:id/status` | SALES/ADMIN | Confirm/cancel a draft |
| GET | `/challans/:id/pdf` | any | Download PDF invoice |
| GET | `/dashboard/summary` | any | Dashboard counts |

## Architecture overview

The application is a layered **Express + TypeScript** backend exposing REST APIs backed by **PostgreSQL** (via the `pg` driver), with a **React (Vite)** single-page frontend.

- **Request pipeline:** each request flows through Zod validation → JWT authentication → role-based access middleware → parameterized SQL → a central error handler that maps failures to correct HTTP status codes (400 validation, 401 auth, 403 role, 404 not found, 409 conflict).
- **Authentication & roles:** a JWT is issued at login and verified on every protected route by `authenticate`. A `requireRole()` guard enforces the four roles (Sales, Warehouse, Accounts, Admin); Admin bypasses all checks. Permissions are enforced on the server — the UI only hides controls for convenience.
- **Transaction-safe stock:** confirming a challan runs inside a single PostgreSQL transaction using `SELECT ... FOR UPDATE` row locks. Stock can never go negative even under concurrent requests; insufficient stock returns HTTP 400 and the whole transaction rolls back (no partial writes). Every stock change — manual movement or challan confirmation — is written to a `stock_movements` audit log.
- **Product snapshots:** `challan_items` stores each product's name, SKU and unit price at the moment of sale, so later price or name changes never alter historical challans.
- **Challan numbers** are generated from a PostgreSQL sequence (`CH-YYYYMMDD-0001`), guaranteeing uniqueness under concurrency.
- **Frontend:** a React SPA with an auth context; an Axios interceptor attaches the JWT to every request and auto-logs-out on 401. Search, filtering and pagination are all performed server-side.
- **Deployment:** frontend on Vercel, backend on Render, database on Supabase.

## Role permission matrix (enforced by API)

| Action | Admin | Sales | Warehouse | Accounts |
|--------|:---:|:---:|:---:|:---:|
| View all modules | ✅ | ✅ | ✅ | ✅ |
| Add/edit customers, follow-ups | ✅ | ✅ | ❌ | ❌ |
| Add/edit products, stock movements | ✅ | ❌ | ✅ | ❌ |
| Create/confirm/cancel challans | ✅ | ✅ | ❌ | ❌ |

## Known limitations / assumptions

- No user self-registration — users are seeded (an admin "manage users" screen would be the next step).
- S3 image upload (an optional bonus) is not implemented.
- Cancelling a **confirmed** challan is intentionally not allowed (only drafts can change status); reversing a confirmed sale would require restocking logic.
- Single-warehouse stock model — `location` is an informational field, not a separate warehouse entity.
- JWT is stored in `localStorage` for simplicity; an httpOnly cookie would be more secure for production.
- The challan form's customer/product dropdowns load the first 50 records (no async search).
- The backend runs on Render's free tier, which sleeps after ~15 minutes of inactivity, so the first request after idle has a cold-start delay of roughly 30–50 seconds.