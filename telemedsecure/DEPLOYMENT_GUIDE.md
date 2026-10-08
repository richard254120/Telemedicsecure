# TeleMedSecure Production Deployment Guide: GitHub, Vercel & Render

This guide provides the complete, step-by-step walkthrough to host and deploy TeleMedSecure with automated CI/CD directly from GitHub.

---

## 1. Database Architecture Clarification: PostgreSQL vs. MongoDB

### Why PostgreSQL is Strongly Recommended (1-Click Zero Config):
TeleMedSecure is engineered using **Prisma ORM with PostgreSQL**. It relies on:
- **Relational Enums & Constraints**: `Role`, `Severity`, `ViolationType`, `PrescriptionStatus`, `ConsultationStatus`.
- **Relational Integrity**: Foreign key relationships for Doctor-Patient consultations, E2EE key metadata, and Ed25519 digital signatures.
- **Audit Hash Chains & Merkle Roots**: High-speed relational lookups for tamper detection and forensic reporting.
- **65 Passing Integration & Unit Tests**: Pre-configured for PostgreSQL schemas.

### 🌟 Recommended Cloud Databases (100% Free, Instant Setup):
Instead of re-architecting to MongoDB (which in Prisma disables native enums and requires converting every model ID to `@db.ObjectId`), use one of these free managed PostgreSQL cloud providers in under 60 seconds:
1. **Render Managed PostgreSQL** (Best choice – same dashboard as your backend server!):
   - In Render Dashboard, click **New +** → **PostgreSQL**.
   - Name: `telemedsecure-db`.
   - Free tier selected.
   - Copy the **Internal Database URL** (for Render web services) or **External Database URL**.
2. **Neon.tech** (Serverless Postgres, free forever):
   - Sign up at [neon.tech](https://neon.tech) → Create Project.
   - Copy the generated `postgresql://...` connection string.
3. **Supabase** ([supabase.com](https://supabase.com)):
   - Create a free project → Copy the connection pooler URL.

*(Note: If you have a strict requirement that mandates MongoDB Atlas, Prisma requires modifying `schema.prisma` datasource to `provider = "mongodb"` and updating all UUID fields to `@db.ObjectId`. However, using Render PostgreSQL or Neon gives you 100% zero-configuration out-of-the-box compatibility).*

---

## 2. Push Codebase to GitHub

From your project root (`/home/oguda/Desktop/richey`):

```bash
# 1. Initialize & stage changes
git add .

# 2. Commit
git commit -m "feat: complete TeleMedSecure system with production deployment configuration"

# 3. Create a new repository on GitHub (e.g., https://github.com/your-username/telemedsecure.git)

# 4. Link remote and push to main branch
git remote add origin https://github.com/YOUR_GITHUB_USERNAME/YOUR_REPO_NAME.git
git branch -M main
git push -u origin main
```

---

## 3. Deploy Backend API & WebSockets on Render

Render hosts the Node.js Express server and manages persistent WebSocket connections (`socket.io` for WebRTC signaling and live security alerts).

1. Log into [Render.com](https://render.com).
2. Click **New +** → **Web Service**.
3. Select **Build and deploy from a Git repository** and connect your GitHub repo.
4. Fill in the service configuration:
   - **Name**: `telemedsecure-api` (or your preferred name)
   - **Root Directory**: `telemedsecure/server`
   - **Environment**: `Node`
   - **Region**: Closest to you (e.g., Frankfurt, Ohio, Oregon)
   - **Branch**: `main`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Instance Type**: `Free`
5. Click **Advanced** → **Add Environment Variable**:
   | Key | Value | Description |
   |---|---|---|
   | `DATABASE_URL` | `postgresql://user:pass@host/dbname?sslmode=require` | Connection string from Render Postgres or Neon |
   | `JWT_SECRET` | *(64-char random string or secret)* | Secret key for JWT auth signing |
   | `PORT` | `4000` | Port for Express/Socket.IO |
   | `NODE_ENV` | `production` | Production mode |
   | `FRONTEND_URL` | `https://your-telemedsecure.vercel.app` | Your Vercel frontend URL (update after creating Vercel app) |
6. Click **Create Web Service**.
7. Render will automatically run `npm run build` (`prisma generate && tsc`) and start your server. Note down your backend URL: e.g., `https://telemedsecure-api.onrender.com`.

---

## 4. Run Initial Database Migrations & Demo Seed on Render

Once your Render database and web service are active, you can initialize tables and seed demo users:

In Render Web Service dashboard, go to the **Shell** tab:
```bash
# Generate Prisma Client & push schema to the cloud DB
npx prisma db push

# Seed demo doctor, patient, nurse, admin, and cryptographic keys
npm run seed:demo
```

---

## 5. Deploy Frontend Client on Vercel

Vercel provides global CDN hosting with automatic preview builds on every git push.

1. Log into [Vercel.com](https://vercel.com).
2. Click **Add New...** → **Project**.
3. Import your GitHub repository.
4. In the project setup screen, configure:
   - **Framework Preset**: `Vite`
   - **Root Directory**: Click *Edit* and select **`telemedsecure/client`**
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`
5. Open **Environment Variables** and add:
   | Key | Value | Description |
   |---|---|---|
   | `VITE_API_URL` | `https://telemedsecure-api.onrender.com` | Your Render backend URL |
   | `VITE_WS_URL` | `https://telemedsecure-api.onrender.com` | Your Render backend URL for Socket.IO |
6. Click **Deploy**.
7. In ~60 seconds, your site is live at `https://<your-project>.vercel.app`.

---

## 6. Complete the CORS Loop

Once Vercel gives you your production frontend domain (e.g., `https://telemed-client.vercel.app`):
1. Go back to Render → `telemedsecure-api` → **Environment**.
2. Update `FRONTEND_URL` to match your Vercel domain:
   `FRONTEND_URL = https://telemed-client.vercel.app`
3. Render will auto-redeploy in seconds with the updated CORS policy.

---

## 7. Automated CI/CD (Continuous Deployment)

Now, your workflow is 100% automated:
- Whenever you make changes locally and run:
  ```bash
  git add .
  git commit -m "your update message"
  git push origin main
  ```
- **Vercel** detects changes in `telemedsecure/client`, triggers `npm run build`, and deploys the new frontend version instantly.
- **Render** detects changes in `telemedsecure/server`, compiles TypeScript with `npm run build`, migrates, and reboots the Node.js/Socket.IO backend server without downtime.
