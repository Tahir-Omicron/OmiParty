# 🎮 Otaq.gg — Real-Time Multiplayer Party Game

**Otaq.gg** is a browser-based, Jackbox-style real-time party game built for mobile and desktop browsers. Players join rooms via a 4-letter room code on their phones, while the host displays the lobby or main game board.

---

## 🌟 Game Modes

1. **Sabotage**
   - Social deduction & survival mode.
   - Players are assigned roles (`Innocent` or `Saboteur`).
   - Round-based voting and HP reduction mechanics to expose the imposter before the crew is eliminated.

2. **Secret Auction**
   - High-stakes bidding war.
   - Players start with a shared budget and secretly submit blind bids on mystery items, power-ups, or penalties.
   - Highest bidder wins the item, but watch out for cursed items!

---

## 🛠️ Tech Stack

- **Frontend**: Vanilla HTML5, Custom Glassmorphism CSS, JavaScript (ES6 Modules)
- **Backend & Database**: [Supabase](https://supabase.com) (PostgreSQL Database)
- **Realtime Sync**: Supabase Realtime (`@supabase/supabase-js` v2) client libraries
- **Deployment**: Static Site Hosting (Vercel, Render, GitHub Pages, Netlify)

---

## 📋 Prerequisites

- A free **[Supabase Account](https://supabase.com)**
- Any web browser or local dev server (e.g., VS Code Live Server)

---

## 🚀 Supabase Setup Instructions

### 1. Create a Supabase Project
1. Log into your [Supabase Dashboard](https://database.new).
2. Click **New Project**.
3. Fill in your project name (e.g., `otaq-gg`), database password, and select your preferred region.
4. Click **Create new project** and wait a minute for deployment.

### 2. Run Database Schema SQL Script
1. In your Supabase dashboard sidebar, navigate to **SQL Editor**.
2. Click **New Query**.
3. Open the [`supabase-schema.sql`](./supabase-schema.sql) file in this repository, copy all contents, and paste them into the SQL Editor.
4. Click **Run** (or press `Ctrl + Enter`).
5. Ensure you see `Success. No rows returned`. This creates the `rooms` and `players` tables, sets up indexes, configures Row Level Security (RLS) policies for anonymous access, and registers the tables in `supabase_realtime`.

### 3. Retrieve API Credentials
1. Go to **Project Settings** (gear icon at the bottom left) > **API**.
2. Copy your **Project URL**.
3. Copy your `anon` `public` **API Key**.

### 4. Configure `app.js`
Open `app.js` in the project root and update the constants at the top of the file:

```javascript
const SUPABASE_URL = 'https://your-project-id.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
```

### 5. Enable Realtime Replication
1. Navigate to **Database** > **Replication** in the Supabase sidebar.
2. Under **Source**, ensure `supabase_realtime` is active.
3. Toggle the replication switch ON for both **`rooms`** and **`players`** tables if they are not already enabled.

---

## 💻 Running Locally

Since Otaq.gg is built using pure HTML, CSS, and Vanilla JavaScript, running it locally requires zero installation or build steps.

### Option A: VS Code Live Server (Recommended)
1. Open the project folder in **Visual Studio Code**.
2. Install the **Live Server** extension (by VS Code / Live Preview).
3. Right-click [`index.html`](./index.html) and select **Open with Live Server**.

### Option B: Python HTTP Server
Run this command in your terminal inside the project directory:
```bash
python -m http.server 8000
```
Then open `http://localhost:8000` in your web browser.

### Option C: Direct Browser Opening
Double-click [`index.html`](./index.html) to open directly in Google Chrome, Edge, Safari, or Firefox.

---

## 🌐 Deployment Options

### Deploying to Vercel
1. Push your repository to **GitHub**, **GitLab**, or **Bitbucket**.
2. Go to [Vercel Dashboard](https://vercel.com/new) and click **Add New Project**.
3. Import your project repository.
4. Leave **Framework Preset** as **Other** (Static Site).
5. Click **Deploy**. Vercel will instantly generate a live production URL for your game.

### Deploying to Render
1. Log into your [Render Dashboard](https://dashboard.render.com).
2. Click **New +** > **Static Site**.
3. Connect your GitHub/GitLab repository.
4. Set:
   - **Name**: `otaq-gg`
   - **Build Command**: *(leave empty)*
   - **Publish Directory**: `.` (root directory)
5. Click **Create Static Site**.

---

## 📄 License

Distributed under the MIT License. Feel free to remix, modify, and host your own party games!
