# Closed-Test Promo Code Distributor (Next.js + Vercel Postgres)

A single-page web application to distribute promo codes to closed beta testers.

## Features

* **Developer Admin Panel**: Manage multiple campaigns. Paste codes or drop CSV files, track claim statistics, and view claim logs.
* **Google Auth Claiming**: Users sign in with Google to claim a single promo code. Each user can claim only one code per campaign.
* **Unguessable Links**: Generates random campaign URLs (e.g. `?dist=alpha-v1-h7f8d2`) so testers cannot guess URLs.
* **Zero-Config Local Demo**: Run the app locally without setting up Postgres or Google OAuth.

---

## Vercel Deployment

Deploy your own instance of this distributor using the Vercel Clone template.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fdsolonenko%2Fpromo-codes-distributor&env=GOOGLE_CLIENT_ID,GOOGLE_CLIENT_SECRET,DEVELOPER_EMAILS,JWT_SECRET&stores=%5B%7B%22type%22%3A%22postgres%22%7D%5D)

> **Important**: Fork or copy this repository to your own GitHub account first, then replace the `repository-url` value in the deploy link with your repository URL.

### Setup Process

Since Google OAuth requires your deployed domain URL *before* generating credentials, deployment is a 2-step process.

#### Step 1: Deploy with placeholders
1. Click the **Deploy with Vercel** button above.
2. Fill in the environment variables on Vercel:
   * `GOOGLE_CLIENT_ID`: Enter `placeholder`
   * `GOOGLE_CLIENT_SECRET`: Enter `placeholder`
   * `DEVELOPER_EMAILS`: Enter your Google email address (e.g., `yourname@gmail.com`)
   * `JWT_SECRET`: Enter any long random string of characters
3. Click **Deploy**. Vercel will build the project and provision your database.
4. Copy your live site URL once deployment completes (e.g., `https://your-app.vercel.app`).

#### Step 2: Add Google Credentials
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a project and go to **APIs & Services** -> **Credentials**.
3. Click **Create Credentials** -> **OAuth client ID** (Select **Web Application**).
4. Add your Vercel callback URL to **Authorized redirect URIs**:
   * `https://your-app.vercel.app/api/auth/callback`
5. Copy the generated **Client ID** and **Client Secret**.
6. Go to Vercel Dashboard -> **Settings** -> **Environment Variables**:
   * Edit `GOOGLE_CLIENT_ID` and paste the real ID.
   * Edit `GOOGLE_CLIENT_SECRET` and paste the real Secret.
   * Click **Save**.
7. Go to Vercel -> **Deployments** -> click the three dots on your last deployment -> **Redeploy**.

---

## Local Development

### 1. Run in Demo Mode (Zero-Config)
You can run the app locally without setting up Postgres or Google OAuth.

1. Install dependencies and start the development server:
   ```bash
   npm install
   npm run dev
   ```
2. Open [http://localhost:3000](http://localhost:3000) in your browser.
3. Click **Log in as Admin** or **Log in as Tester** on the landing page to test.

*Note: In Demo Mode, login is simulated and data is saved to a local `db.json` file in the project root.*

### 2. Run with Real Services
To test with real Postgres and Google OAuth locally:

1. Copy `.env.example` to `.env` and fill in your connection credentials.
2. Run the SQL in `infra/migration.sql` on your database.
3. Add `http://localhost:3000/api/auth/callback` as an **Authorized redirect URI** in your Google OAuth Client.
