# Deploying the API to AWS Lambda + API Gateway

The backend runs on **AWS Lambda** behind an **API Gateway HTTP API**. The stack is defined as code with
**AWS SAM** (`backend/template.yaml`) and deployed by **GitHub Actions** (`.github/workflows/backend-aws.yml`).
The React frontend stays on Vercel and the database stays on Supabase.

```
Browser (React on Vercel)
        │  HTTPS
        ▼
API Gateway HTTP API ── throttled at 20 req/s, burst 50
        │
        ▼
AWS Lambda (Node.js 22, arm64) ── src/lambda.ts → same Express app as local/Render
        │  pg, max 2 connections per instance
        ▼
Supabase PostgreSQL (transaction pooler, port 6543)

Logs → CloudWatch (14-day retention)
Deploys → GitHub Actions: type-check → sam build → sam deploy → /health smoke test
```

## How the code supports both Render and Lambda

| File | Purpose |
|------|---------|
| `src/app.ts` | The Express app: routes, middleware, error handling |
| `src/index.ts` | Starts a normal server (`npm run dev`, `npm start`, Render) |
| `src/lambda.ts` | Lambda handler; `serverless-http` turns API Gateway events into Express requests. PDFs are base64-encoded so they aren't corrupted |
| `src/db.ts` | On Lambda (detected by `AWS_LAMBDA_FUNCTION_NAME`), each instance keeps at most 2 connections and closes idle ones after 10s |
| `template.yaml` | Lambda function, HTTP API, log group, parameters for secrets |
| `Makefile` | How `sam build` packages the function: compile TypeScript, install production dependencies only. Not bundled with esbuild, because pdfkit and Swagger UI read files from `node_modules` |
| `samconfig.toml` | Stack name `erp-crm-api`, region `ap-southeast-2` |

## One-time setup

### 1. Get the Supabase transaction pooler URL
Supabase → **Connect** → **Transaction pooler**. It uses port **6543**. Replace `[YOUR-PASSWORD]`.
Lambda can start many instances at once; the pooler stops them from using up the database's connection limit.
If your password contains special characters such as `@` or `#`, URL-encode them (e.g. `@` → `%40`).

### 2. Let GitHub deploy to your AWS account (OIDC, no stored keys)
In the AWS console → **IAM**:

1. **Identity providers → Add provider** → OpenID Connect
   - Provider URL: `https://token.actions.githubusercontent.com`
   - Audience: `sts.amazonaws.com`
2. **Policies → Create policy → JSON**: paste `aws/github-deploy-policy.json`, replacing every
   `<ACCOUNT_ID>` with your 12-digit account ID. Name it `erp-github-deploy`.
3. **Roles → Create role → Custom trust policy**: paste `aws/github-trust-policy.json` (again replace
   `<ACCOUNT_ID>`, and change `Biprajit541/erp-crm-portal` if your repo has a different name).
   Attach the `erp-github-deploy` policy. Name it `erp-github-deploy-role`. Copy its **ARN**.

The trust policy only lets the `main` branch / `production` environment of this one repository use the role.
The permission policy only allows managing this stack's own Lambda, API, logs and role.

**If your account doesn't allow creating the identity provider** (some new AWS accounts restrict it), use access
keys instead: create an IAM user with only the `erp-github-deploy` policy, create an access key for it, and
use `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` below instead of `AWS_DEPLOY_ROLE_ARN`.

### 3. Add GitHub repository secrets
GitHub repo → **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Value |
|--------|-------|
| `AWS_DEPLOY_ROLE_ARN` | ARN of `erp-github-deploy-role` |
| `DATABASE_URL` | Supabase transaction pooler URL from step 1 |
| `JWT_SECRET` | Same value as on Render (then tokens work on both); no spaces |
| `CORS_ORIGIN` | Your Vercel URL exactly, e.g. `https://erp-crm-portal-umber.vercel.app` (no trailing `/`) |
| `CONNECT_API_KEY` | Optional |

### 4. Deploy
Push to `main` (or **Actions → Backend - AWS Lambda → Run workflow**). The workflow:
1. type-checks and builds the TypeScript, and validates the SAM template;
2. runs `sam build` and `sam deploy`;
3. calls `/health` on the new API and prints its URL in the run summary.

The first deploy takes about 3–5 minutes. The URL looks like
`https://abc123xyz.execute-api.ap-southeast-2.amazonaws.com`.

### 5. Point the frontend at AWS
Vercel → your project → **Settings → Environment Variables** → set `VITE_API_URL` to the API URL → **Redeploy**
(the value is built into the frontend, so a redeploy is required).

### 6. Check it works
- `<API_URL>/health` → `{"status":"ok"}`
- `<API_URL>/docs` → Swagger UI
- Log in on the Vercel site, open a challan and download its PDF.
- AWS console → **CloudWatch → Log groups** → `erp-crm-api-ErpApiLogGroup-…` shows each request's logs.

## Troubleshooting

| Symptom | Likely cause |
|---------|--------------|
| Workflow fails at "Configure AWS credentials" | Role ARN wrong, or trust policy repo/branch name doesn't match |
| `AccessDenied` during `sam deploy` | The error names the missing action; add it to `erp-github-deploy` |
| Browser shows a CORS error | `CORS_ORIGIN` doesn't exactly match the Vercel URL |
| 500 errors, logs show `timeout` or `ECONNREFUSED` | `DATABASE_URL` wrong, or not the pooler URL |
| 500 errors, logs show `too many connections` | Direct connection URL used instead of the pooler (port 6543) |
| Downloaded PDF won't open | Check the response is `application/pdf`; `src/lambda.ts` must list it as binary |

## Cost and limits
- Lambda and API Gateway are billed per request; a portfolio app's traffic costs cents per month, covered by credits.
- API Gateway throttling (20 requests/second) caps how much traffic can ever reach Lambda.
- Logs are kept for 14 days.
- **This account is on the AWS Free plan, which ends after 6 months or when credits run out.** Before then, either
  upgrade the account or point `VITE_API_URL` back to Render. The Render deployment keeps working from the
  same code (`npm start`), so it's a ready fallback.

## Removing it
`sam delete --stack-name erp-crm-api --region ap-southeast-2`, or delete the `erp-crm-api` stack in
**CloudFormation**. That removes the Lambda, API, role and logs.
