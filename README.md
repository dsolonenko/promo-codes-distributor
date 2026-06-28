# 📦 Closed-Test Promo Code Distributor (Next.js + Vercel Postgres)

A secure, high-performance, single-page web application to distribute Google Play promo codes for your closed beta programs. It uses Google OAuth to authenticate users, matches them to a unique code, and prevents double-allocation using an atomic database row lock (`FOR UPDATE SKIP LOCKED`).

---

## ⚡ 1-Click Vercel Deploy

Deploy your own private instance of this distributor instantly using the Vercel Clone template.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fyour-github-username%2Fyour-repository-name&env=GOOGLE_CLIENT_ID,GOOGLE_CLIENT_SECRET,DEVELOPER_EMAILS,JWT_SECRET&stores=postgres)

> **Note**: Before clicking the deploy button, you should **fork or copy** this repository to your own GitHub account, then replace the `repository-url` encoded value in the URL above with your own GitHub repo link!

---

## 🚀 Setup & Configuration

When deploying to Vercel, you will be prompted to configure the following environment variables:

| Variable | Description |
|---|---|
| `POSTGRES_URL` | Automatically provisioned and injected by Vercel when selecting the Postgres Store. |
| `GOOGLE_CLIENT_ID` | Your Google OAuth Client ID (obtained from Google Cloud Console). |
| `GOOGLE_CLIENT_SECRET` | Your Google OAuth Client Secret. |
| `DEVELOPER_EMAILS` | Comma-separated list of whitelisted developer/admin emails (e.g. `admin@example.com,dev@example.com`). |
| `JWT_SECRET` | A long random string (e.g. `32+ characters`) used to sign secure session cookies. |

### Step 1: Initialize the Postgres Database
Once Vercel finishes deploying the project:
1. Go to your **Vercel Dashboard** and select the deployed project.
2. Click the **Storage** tab and select your newly provisioned Postgres database.
3. Click **Query** in the sidebar.
4. Paste the contents of [infra/migration.sql](infra/migration.sql):
   ```sql
   CREATE TABLE IF NOT EXISTS promo_codes (
       id SERIAL PRIMARY KEY,
       code TEXT UNIQUE NOT NULL,
       claimed_by_email TEXT DEFAULT NULL,
       claimed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
   );
   CREATE INDEX IF NOT EXISTS idx_promo_codes_email ON promo_codes(claimed_by_email);
   ```
5. Click **Run**. The database tables are now set up.

### Step 2: Configure Google OAuth Redirect Callback
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Select your project and navigate to **APIs & Services** -> **Credentials**.
3. Create or Edit an **OAuth 2.0 Client ID** (Web Application type).
4. Under **Authorized redirect URIs**, add your Vercel deployment domain with the auth callback suffix:
   - `https://your-app-name.vercel.app/api/auth/callback`
   - *Tip: You can also add `http://localhost:3000/api/auth/callback` for local development testing.*
5. Copy your Client ID and Client Secret, and update your Vercel Environment Variables if you haven't already.

---

## 🛠️ Local Development

To run this project locally, clone your repository and setup your environment:

1. Create a `.env` file in the root folder:
   ```bash
   cp .env.example .env
   ```
2. Populate the `.env` file with your local database URL (or Vercel Postgres credentials) and Google OAuth details.
3. Install dependencies and start the development server:
   ```bash
   npm install
   npm run dev
   ```
4. Open [http://localhost:3000](http://localhost:3000) to view the application.

---

## 🔒 Security & Concurrency Safety

1. **Atomic Lock**: In `/api/claim/route.js`, claiming a promo code executes an atomic select-and-update query utilizing PostgreSQL's `FOR UPDATE SKIP LOCKED` syntax. This ensures that even during high concurrent traffic spikes, no code is ever distributed to two users.
2. **Access Control**: Session state is signed and encrypted into a secure `httpOnly` cookie via Node.js's native `crypto` module. Stats lookups, uploads, and purges require session validation checking against the `DEVELOPER_EMAILS` whitelist. Normal claimants are barred from accessing codes that do not belong to them.
