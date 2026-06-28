# 📦 Closed-Test Promo Code Distributor (Next.js + Vercel Postgres)

A secure, high-performance, single-page web application to distribute Google Play promo codes for your closed beta programs. It uses Google OAuth to authenticate users, matches them to a unique code, and prevents double-allocation using an atomic database row lock (`FOR UPDATE SKIP LOCKED`).

---

## ⚡ 1-Click Vercel Deploy

Deploy your own private instance of this distributor instantly using the Vercel Clone template.
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fyour-github-username%2Fyour-repository-name&env=GOOGLE_CLIENT_ID,GOOGLE_CLIENT_SECRET,DEVELOPER_EMAILS,JWT_SECRET&stores=postgres)

> **Note**: Before clicking the deploy button, you should **fork or copy** this repository to your own GitHub account, then replace the `repository-url` encoded value in the URL above with your own GitHub repo link!

---

## 🚀 Setup & Configuration (2-Step Process)

To solve the "chicken-and-egg" dependency of Google OAuth (needing your deployed domain URL *before* generating Google keys), setup is split into a simple **2-Step process**. You do **not** need your actual Google Client ID or Secret for the initial deployment.

### Step 1: Initial Deploy (Using Placeholders)
1. Click the **Deploy with Vercel** button above.
2. Vercel will prompt you for the environment variables. Fill them in as follows:
   * `GOOGLE_CLIENT_ID`: Enter `placeholder`
   * `GOOGLE_CLIENT_SECRET`: Enter `placeholder`
   * `DEVELOPER_EMAILS`: Enter your Google email address (e.g. `yourname@gmail.com`)
   * `JWT_SECRET`: Type a long random string of gibberish characters (used to sign session cookies securely)
3. Click **Deploy**. Vercel will build the project and automatically provision the Postgres database.
4. Once completed, Vercel will show your live site URL (e.g., `https://your-project-name.vercel.app`). **Copy this URL**.

### Step 2: Swap Placeholders for Real Google Keys
1. Go to your [Google Cloud Console](https://console.cloud.google.com/).
2. Create or select a project, then navigate to **APIs & Services** -> **Credentials**.
3. Click **Create Credentials** -> **OAuth client ID** (select **Web Application**).
4. Under **Authorized redirect URIs**, add your copied Vercel URL with the `/api/auth/callback` suffix:
   - `https://your-project-name.vercel.app/api/auth/callback`
   - *(Optional: Add `http://localhost:3000/api/auth/callback` if you plan to test locally)*
5. Google will generate your real **Client ID** and **Client Secret**. Copy them.
6. Go back to your **Vercel Project Dashboard** -> **Settings** -> **Environment Variables**:
   - Edit `GOOGLE_CLIENT_ID` and paste the real ID.
   - Edit `GOOGLE_CLIENT_SECRET` and paste the real Secret.
   - Click **Save**.
7. Navigate to the **Deployments** tab on Vercel, click the three dots next to your last deployment, and select **Redeploy** to apply the active keys.

---

## 🛠️ Local Development (Zero-Config Demo Mode)

You can run and test the entire application locally with **zero configuration**—no database setup or Google Console credentials required.

### 1-Click Local Run:
1. Install dependencies and start the development server:
   ```bash
   npm install
   npm run dev
   ```
2. Open [http://localhost:3000](http://localhost:3000) in your browser.
3. The app will detect the missing configuration and offer **Demo Mode** buttons. Click **⚡ Log in as Admin** or **👤 Log in as Tester** to instantly test the dashboards!

*How it works*: In Demo Mode, the server simulates authentication and intercepts database queries to read/write records in a local `db.json` file in the project root.

---

### Running with Real Databases:
If you want to test with real database connections and actual Google logins locally:
1. Copy `.env.example` to `.env` and fill in your connection credentials.
2. Initialize Postgres tables by executing [infra/migration.sql](infra/migration.sql) inside your database query console.
3. Configure `http://localhost:3000/api/auth/callback` as an **Authorized redirect URI** in your Google Cloud Console.

---

## 🔒 Security & Concurrency Safety

1. **Atomic Lock**: In `/api/claim/route.js`, claiming a promo code executes an atomic select-and-update query utilizing PostgreSQL's `FOR UPDATE SKIP LOCKED` syntax. This ensures that even during high concurrent traffic spikes, no code is ever distributed to two users.
2. **Access Control**: Session state is signed and encrypted into a secure `httpOnly` cookie via Node.js's native `crypto` module. Stats lookups, uploads, and purges require session validation checking against the `DEVELOPER_EMAILS` whitelist. Normal claimants are barred from accessing codes that do not belong to them.
