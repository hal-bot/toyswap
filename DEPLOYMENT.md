# ToySwap Deployment Guide

## Architecture Overview

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│     Dev      │───▶│    Test      │───▶│  Production  │
│  (auto)      │    │  (auto)      │    │  (manual)    │
└─────────────┘    └─────────────┘    └─────────────┘
       ▲
       │
┌──────┴──────┐
│  PR Tests   │  ◀── Unit tests, lint, SAST
│  (gate)     │      run on every PR + push
└─────────────┘
```

## Environments

| Environment | Purpose | Deployment | URL (example) |
|-------------|---------|------------|---------------|
| **Dev** | Integration testing, E2E tests | Automatic after unit tests pass | `https://dev.toyswap.example.com` |
| **Test** | QA / UAT validation | Automatic after E2E tests pass in Dev | `https://test.toyswap.example.com` |
| **Production** | Live users | **Manual approval required** | `https://toyswap.example.com` |

## CI/CD Pipeline Flow

### On Pull Request (PR created or pushed to)
1. **Backend Tests & Lint** — Checkstyle + `mvn verify` (JUnit 5, MockMvc, H2)
2. **Frontend Tests & Lint** — ESLint + Prettier + TypeScript check + Vitest (with MSW mocks)
3. **SAST Scan** — Semgrep runs OWASP Top 10, Java, TypeScript, and React rulesets
4. All three jobs must pass before the PR can be merged

### On Push to `main` or `dev` branch
1. Steps 1-3 above run first
2. **Docker Build** — Backend JAR + Frontend dist packaged into Docker images
3. **Deploy to Dev** — Images deployed to dev environment
4. **E2E Tests** — Playwright runs against the live dev deployment
5. **Deploy to Test** — Automatic if all E2E tests pass
6. **Deploy to Production** — Waits for manual approval (see below)

---

## How to Deploy to Production (Manual)

### Option A: Approve via GitHub UI (Recommended)

1. Go to the repository on GitHub
2. Click the **Actions** tab
3. Find the latest **CI/CD Pipeline** workflow run on the `main` branch
4. The run will show the `deploy-production` job as **"Waiting"** with a yellow clock icon
5. Click **"Review deployments"**
6. Check the **production** environment checkbox
7. Optionally add a comment (e.g., "Approved after QA sign-off")
8. Click **"Approve and deploy"**

The production deployment will then execute automatically.

### Option B: Trigger via workflow_dispatch

You can deploy any commit to production manually:

1. Go to **Actions** → **CI/CD Pipeline**
2. Click **"Run workflow"** (top right)
3. Select branch: `main`
4. Choose deploy environment: `production`
5. Click **"Run workflow"**

This will run the full pipeline and deploy to production (still requires environment approval).

### Option C: GitHub CLI

```bash
gh workflow run "CI/CD Pipeline" \
  --ref main \
  -f deploy_env=production
```

---

## Environment Setup (GitHub Repository Settings)

To enable the manual approval gate, configure GitHub Environments:

### 1. Create Environments

Go to **Settings** → **Environments** → **New environment**

Create three environments: `dev`, `test`, `production`

### 2. Configure Production Protection Rules

For the `production` environment:
- **Required reviewers**: Add at least one team member who must approve
- **Wait timer** (optional): Add a delay (e.g., 5 minutes) for cool-down
- **Deployment branches**: Restrict to `main` only

### 3. Add Environment Secrets

Each environment needs these secrets (adjust per environment):

| Secret | Description |
|--------|-------------|
| `AWS_ROLE_ARN` | IAM role ARN for OIDC authentication |
| `ECR_REGISTRY` | ECR registry URL (e.g., `123456789.dkr.ecr.us-east-1.amazonaws.com`) |
| `DATABASE_URL` | PostgreSQL connection string |
| `DATABASE_USERNAME` | DB username |
| `DATABASE_PASSWORD` | DB password |

---

## Local Development

### Run with Docker Compose

```bash
docker compose up --build
```

This starts:
- **Backend** on `http://localhost:8080`
- **Frontend** on `http://localhost:80`
- **PostgreSQL** on `localhost:5432`

### Run without Docker

```bash
# Terminal 1: Backend
cd backend && ./mvnw spring-boot:run

# Terminal 2: Frontend
cd frontend && npm run dev
```

### Run Tests Locally

```bash
# Backend unit tests
cd backend && ./mvnw verify

# Frontend unit tests
cd frontend && npm test

# E2E tests (starts both servers automatically)
./start-test-env.sh
# In another terminal:
cd frontend && npx playwright test
```

---

## Git Hooks

The project uses **Husky** for Git hooks:

| Hook | What it does |
|------|--------------|
| `pre-commit` | Runs ESLint + Prettier on staged frontend files (via lint-staged) |
| `pre-push` | Runs frontend unit tests + backend unit tests |

### Setup hooks after cloning

```bash
npm install        # installs Husky from root package.json
```

---

## Security Scanning

### SAST (runs automatically in CI via Semgrep)

To run locally:
```bash
brew install semgrep
semgrep scan --config auto .
```

### DAST (manual — run against a live environment)

**OWASP ZAP:**
```bash
# Install
brew install --cask zap

# Baseline scan against local backend
docker run -t ghcr.io/zaproxy/zaproxy:stable zap-baseline.py \
  -t http://host.docker.internal:8080

# Full scan
docker run -t ghcr.io/zaproxy/zaproxy:stable zap-full-scan.py \
  -t http://host.docker.internal:8080
```

**NMap:**
```bash
# Port scan of local services
nmap -sV localhost

# Scan the designated test target
nmap -sV scanme.nmap.org
```

---

## Rollback

If a production deployment needs to be reverted:

1. Go to **Actions** → find the **last known good** workflow run
2. Click **"Re-run all jobs"** → this redeploys the previous version
3. Or use the CLI:
   ```bash
   # Find the last good commit
   git log --oneline -10

   # Trigger deployment of that specific commit
   gh workflow run "CI/CD Pipeline" --ref <good-commit-sha> -f deploy_env=production
   ```
