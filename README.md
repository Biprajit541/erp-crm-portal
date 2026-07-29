# Mini ERP + CRM Operations Portal

A small ERP/CRM system for a wholesale/distribution company, covering customers (CRM), products and stock, and sales challans, used by internal Sales, Warehouse, Accounts and Admin teams.

**Live URLs:**
- Frontend (Vercel): `https://YOUR-APP.vercel.app`
- Backend API (Render): `https://YOUR-API.onrender.com`
- Database: Supabase (PostgreSQL)

## Tech stack

| Layer     | Technology |
|-----------|------------|
| Backend   | Node.js, TypeScript, Express.js, PostgreSQL (`pg`), Zod validation, JWT auth, bcrypt |
| Frontend  | React 18, TypeScript, Vite, React Router, Axios, plain responsive CSS |
| Database  | PostgreSQL (Supabase) |
| Hosting   | Vercel (frontend), Render (backend), Supabase (database) |

## Test login credentials

All accounts use password **`Password@123`**

| Role      | Email               | Permissions |
|-----------|---------------------|-------------|
| Admin     | admin@erp.com       | Everything |
| Sales     | sales@erp.com       | Customers, follow-ups, challans (+ view products) |
| Warehouse | warehouse@erp.com   | Products, stock movements (+ view customers/challans) |
| Accounts  | accounts@erp.com    | View-only across modules |

## Project structure

\`\`\`
erp-crm-portal/
├── backend/
│   ├── sql/schema.sql          # Full database schema
│   ├── src/
│   │   ├── index.ts            # Express app entry
│   │   ├── db.ts               # pg connection pool
│   │   ├── schemas.ts          # Zod validation schemas
│   │   ├── seed.ts             # Seed users + sample data
│   │   ├── runSchema.ts        # Applies schema.sql
│   │   ├── middleware/
│   │   │   ├── auth.ts         # JWT verify + role-based access (RBAC)
│   │   │   └── errorHandler.ts # Central error handler (Zod, HTTP, PG errors)
│   │   └── routes/
│   │       ├── auth.ts         # POST /auth/login, GET /auth/me
│   │       ├── customers.ts    # CRM module
│   │       ├── products.ts     # Products + stock movements
│   │       ├── challans.ts     # Sales challans + confirm logic
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
\`\`\`

## Running locally

### Prerequisites
- Node.js 18+ (`node --version`)
- A PostgreSQL database (easiest: free Supabase project; or local Postgres)

### 1. Database (Supabase)
1. Create a free project at https://supabase.com
2. Open **SQL Editor**, paste the contents of `backend/sql/schema.sql`, and run it.
3. Go to the **Connect** button (top of dashboard) → **Connection string → Transaction pooler** and copy it (replace `[YOUR-PASSWORD]` with your database password).

### 2. Backend
\`\`\`bash
cd backend
npm install
cp .env.example .env        # Windows: copy .env.example .env
# Edit .env -> set DATABASE_URL (from Supabase) and a random JWT_SECRET
npm run db:seed             # creates the 4 test users + sample data
npm run dev                 # starts API on http://localhost:5000
\`\`\`
(If you didn't run schema.sql in the Supabase editor, `npm run db:schema` applies it too.)

### 3. Frontend
\`\`\`bash
cd frontend
npm install
cp .env.example .env        # VITE_API_URL=http://localhost:5000
npm run dev                 # opens http://localhost:5173
\`\`\`

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

### Frontend (`frontend/.env`)
| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Backend base URL |

Secrets are never committed - `.env` is gitignored; only `.env.example` templates are in the repo.

## Deployment

### Database - Supabase (free)
Already done in "Running locally" step 1. Note the pooler connection string.

### Backend - Render (free)
1. Push the repo to GitHub.
2. On https://render.com → **New → Web Service** → connect the repo.
3. Settings:
   - **Root Directory:** `backend`
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
4. Environment variables: `DATABASE_URL` (Supabase pooler URI), `JWT_SECRET`, `JWT_EXPIRES_IN=1d`, `CORS_ORIGIN=https://YOUR-APP.vercel.app`
5. Deploy. Verify `https://YOUR-API.onrender.com/health` returns `{"status":"ok"}`.
6. Seed production data once from your machine: temporarily point your local `backend/.env` `DATABASE_URL` at Supabase and run `npm run db:seed`.

> Note: Render free instances sleep after 15 minutes of inactivity; the first request after that takes ~30-50s.

### Frontend - Vercel (free)
1. On https://vercel.com → **Add New → Project** → import the repo.
2. Settings:
   - **Root Directory:** `frontend`
   - Framework preset: Vite (auto-detected)
3. Environment variable: `VITE_API_URL=https://YOUR-API.onrender.com`
4. Deploy, then copy the Vercel URL into the backend's `CORS_ORIGIN` on Render and redeploy the backend.

## Architecture overview

- **Layered Express backend**: routes → Zod validation → SQL via `pg` pool → central error handler. JWT is issued at login and verified by `authenticate` middleware; `requireRole()` enforces role-based access (ADMIN bypasses all checks).
- **Business logic in transactions**: challan confirmation runs inside a single PostgreSQL transaction with `SELECT ... FOR UPDATE` row locks, so stock can never go negative even with concurrent requests. Insufficient stock returns HTTP 400 with a clear message. Every stock change (manual or challan) is written to the `stock_movements` audit log.
- **Product snapshots**: `challan_items` stores product name, SKU and unit price at creation time - later price/name changes never alter historical challans.
- **Challan numbers** are generated from a DB sequence (`CH-YYYYMMDD-0001`), guaranteeing uniqueness.
- **Frontend**: React SPA with an auth context; the Axios interceptor attaches the JWT and auto-logs-out on 401. UI actions are hidden per role, but the API enforces permissions regardless.
- **Pagination and search** are implemented server-side on all list endpoints.

## Role permission matrix (enforced by API)

| Action | Admin | Sales | Warehouse | Accounts |
|--------|:---:|:---:|:---:|:---:|
| View all modules | ✅ | ✅ | ✅ | ✅ |
| Add/edit customers, follow-ups | ✅ | ✅ | ❌ | ❌ |
| Add/edit products, stock movements | ✅ | ❌ | ✅ | ❌ |
| Create/confirm/cancel challans | ✅ | ✅ | ❌ | ❌ |

## Known limitations / assumptions

- No user self-registration - users are seeded (an admin "manage users" screen would be the next step).
- Invoices/PDF export, purchase orders and S3 image upload (bonus items) are not implemented.
- Cancelling a **confirmed** challan is intentionally not allowed (only drafts can change status); restocking logic would be needed for that.
- Single-warehouse stock model - `location` is informational text, not a separate warehouse entity.
- JWT is stored in `localStorage` for simplicity; an httpOnly cookie would be more secure for production.
- Customer/product dropdowns in the challan form load the first 50 records (no async search).