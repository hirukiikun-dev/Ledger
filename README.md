# Ledger — Trading Journal

A private, Apple-clean trading journal built to deploy on Vercel in one command.
Dashboard performance → daily reflections → a full journal for **every single trade**
(with entry/exit screenshots), plus an AI coach that reads your own journal.

```
Dashboard   monthly P&L bars, equity curve, win rate, profit factor, expectancy,
            statistical summary, daily breakdown
Daily       the day's stats + 3 questions:
            What did I do wrong about it? / Why did I take those trades? / How can I improve?
Trades      per-trade record (pair, direction, setup, entry/exit, size, P&L, R, fees),
            entry + exit screenshots, and 3 questions:
            Why did the narrative work/fail? / Why did I win/lose this coin? / What can I do better?
Settings    account & sync, AI mode, currency, starting balance, export/clear
```

---

## 1. Run it locally

No build step, no framework, no `npm install` — it's static HTML + CSS + JS with two
serverless functions.

```bash
npm i -g vercel      # once
cp .env.example .env.local   # (a filled-in .env.local is already included)
vercel dev           # http://localhost:3000
```

Want zero tooling? `npx serve .` also works — you just lose `/api/ai` and `/api/config`
(the app then runs fully offline on localStorage, which is a valid way to use it).

---

## 2. Environment variables (`.env.local`)

| Variable | What it's for | Secret? |
| --- | --- | --- |
| `OPENAI_API_KEY` | AI assistant, used only inside `/api/ai` | **yes** |
| `AI_MODEL` | model name, defaults to `gpt-4o-mini` | no |
| `AI_BASE_URL` | optional OpenAI-compatible endpoint (OpenRouter, Groq…) | no |
| `FIREBASE_API_KEY` | Firebase web config, served by `/api/config` | no (public) |
| `FIREBASE_AUTH_DOMAIN` | e.g. `ledger-x.firebaseapp.com` | no |
| `FIREBASE_PROJECT_ID` | e.g. `ledger-x` | no |
| `FIREBASE_STORAGE_BUCKET` | e.g. `ledger-x.appspot.com` | no |
| `FIREBASE_MESSAGING_SENDER_ID` | from Firebase console | no |
| `FIREBASE_APP_ID` | from Firebase console | no |

On Vercel add the exact same keys under **Project → Settings → Environment Variables**
(Production + Preview + Development), then redeploy.

---

## 3. Firebase setup (login + sync across devices)

Skip this and Ledger still works — it just stays on the device it's opened on.

1. [console.firebase.google.com](https://console.firebase.google.com) → **Add project**.
2. **Build → Authentication → Get started → Email/Password → Enable.**
3. **Build → Firestore Database → Create database** (production mode).
4. **Project settings → General → Your apps → Web app (`</>`)** → copy the config values
   into `.env.local` (`apiKey` → `FIREBASE_API_KEY`, etc.).
5. Paste the contents of `firestore.rules` into **Firestore → Rules → Publish**.
6. Restart `vercel dev`. The sign-in screen now creates real accounts, and every save
   mirrors to `users/{uid}`.

How sync behaves: localStorage is always the fast local copy; when you're signed in,
each save also writes to Firestore, and signing in on a new device pulls your document
down first. Your AI key is never written to the cloud.

---

## 4. AI assistant

Two modes, switchable in **Settings → AI assistant**:

- **Vercel route (recommended)** — the browser calls `/api/ai`, your key stays server-side.
- **Direct key** — paste a key in Settings; it's stored only in this browser. Handy if you
  host the folder as pure static files.

The request always ships a compact summary of your journal (stats, streaks, recent trades,
your written answers), so answers are about *your* trading, not generic advice.

---

## 5. Deploy to Vercel

```bash
vercel          # preview
vercel --prod   # production
```

Or push the folder to GitHub → **Import Project** on Vercel → add the env vars → Deploy.
No framework preset needed (Other / static). `vercel.json` handles clean URLs, caching
and basic security headers.

On your phone: open the deployed URL → Share → **Add to Home Screen**. The manifest and
icons make it launch full-screen like a native app.

---

## 6. Project structure

```
ledger/
├── index.html                app shell
├── assets/
│   ├── styles.css            full design system (dark slate palette, responsive)
│   ├── app.js                all app logic: routing, stats, charts, journal, AI panel
│   ├── firebase.js           optional cloud adapter → window.LEDGER_CLOUD
│   ├── icon.svg              logo / favicon
│   ├── icon-192.png          home-screen icon
│   └── icon-512.png          splash / maskable icon
├── api/
│   ├── ai.js                 POST /api/ai   → OpenAI proxy (key stays server-side)
│   └── config.js             GET  /api/config → public Firebase config from env
├── .env.local                your local keys (gitignored)
├── .env.example              template to share
├── firestore.rules           per-user security rules
├── manifest.webmanifest      installable web-app metadata
├── vercel.json               clean URLs, cache + security headers
├── package.json              scripts: dev / start / deploy
└── .gitignore
```

### Data model

```js
// localStorage key: "ledger.v1"
{
  session:  { mode: "local" | "cloud", email, name },
  settings: { currency, startBalance, aiMode, aiKey, aiModel },
  trades: [{
    id, created, date, pair, dir: "long" | "short", setup,
    entry, exit, size, pnl, rr, fees,
    q1, q2, q3,                      // per-trade journal answers
    shots: { entry: dataURL, exit: dataURL }
  }],
  journals: { "2026-08-25": { q1, q2, q3, updatedAt } }
}
```

Screenshots are downscaled to 1200px JPEG in the browser before saving, so pasting
charts doesn't blow up your storage quota.

---

## 7. Housekeeping

- **Demo data**: the app seeds a realistic sample history on first run so the dashboard
  isn't empty. **Settings → Clear all data** wipes it and starts you clean.
- **Backups**: **Settings → Export JSON backup** downloads everything, screenshots included.
- **Keyboard**: `N` new trade · `⌘/Ctrl + K` AI panel · `Esc` close.

### Ideas for v2

- Firebase Storage for screenshots instead of inline base64
- Tag/setup analytics (win rate per setup, per session, per weekday)
- CSV import from exchange fills
- Weekly AI review generated automatically every Sunday

MIT licensed. Trade well.
