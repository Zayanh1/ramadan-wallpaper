# 🌙 Ramadan Wallpaper — Auto-updating Suhoor & Iftar lock screen

A free, open-source wallpaper that automatically shows your daily **Suhoor** (سحور) and **Iftar** (إفطار) times — centered around a live countdown arc — and updates itself every morning via iOS Shortcuts or Android Tasker.

No app. No account. Just a URL.

---

## How it works

```
┌─────────────────────────────────────────────────────────┐
│  YOUR PHONE  →  daily at 4 AM                           │
│                                                         │
│  iOS Shortcuts automation runs:                         │
│    1. GET https://your-app.vercel.app/wallpaper.png     │
│          ?city=Dubai&model=iphone15                     │
│    2. Set as lock screen wallpaper                      │
│                                                         │
│  Vercel serverless function:                            │
│    • Fetches today's prayer times from Aladhan API      │
│    • Draws a PNG with sky, countdown arc, time panels   │
│    • Returns it instantly (~300ms)                      │
└─────────────────────────────────────────────────────────┘
```

The URL stays **identical every day** — but the image it returns is **always fresh**, showing today's Suhoor/Iftar times and the correct Hijri date.

---

## 🚀 Deploy in 5 minutes

### Step 1 — Fork & clone this repository

```bash
# 1. Click "Fork" on GitHub (top right of this page)
# 2. Then clone YOUR fork:
git clone https://github.com/YOUR_USERNAME/ramadan-wallpaper.git
cd ramadan-wallpaper
```

### Step 2 — Deploy to Vercel (free)

**Option A — One-click deploy (recommended)**

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/YOUR_USERNAME/ramadan-wallpaper)

**Option B — Via Vercel CLI**

```bash
npm install -g vercel
vercel login
vercel --prod
```

**Option C — Connect via Vercel Dashboard**

1. Go to [vercel.com](https://vercel.com) → Sign up free with GitHub
2. Click **"Add New Project"**
3. Import your forked `ramadan-wallpaper` repository
4. Click **Deploy** — Vercel auto-detects the config
5. Your live URL will be: `https://ramadan-wallpaper-[username].vercel.app`

---

### Step 3 — Get your personalised wallpaper URL

Visit your deployed site and fill in:
- **City** (e.g. Dubai, London, Cairo, Kuala Lumpur)
- **Phone model**

Copy the generated URL. It looks like:

```
https://ramadan-wallpaper-[you].vercel.app/wallpaper.png?city=Dubai&model=iphone15
```

Test it by pasting into your browser — you should see a wallpaper image.

---

### Step 4 — Set up auto-update on iPhone (iOS Shortcuts)

Open the **Shortcuts** app on your iPhone.

1. Tap **Automation** tab → **+** → **New Automation**
2. Select **Time of Day** → set to **4:00 AM** → **Daily**
3. Select **Run Immediately** (critical — allows background execution)
4. Tap **Create New Shortcut**
5. Add action: **"Get Contents of URL"** → paste your wallpaper URL
6. Add action: **"Set Wallpaper Photo"**
   - Photo: `Contents of URL` (output from step 5)
   - Wallpaper Location: **Lock Screen** only (uncheck Home Screen)
   - Tap **›** chevron → turn OFF **"Show Preview"** and **"Crop to Subject"**
7. Tap the **▶ Play button** to run it immediately for the first time

**That's it.** Every morning at 4 AM your lock screen silently refreshes with today's times.

> 💡 **Tip:** Create a second automation at ~30 min before your local Maghrib time for a second daily refresh.

---

### Step 4 (Android) — Auto-update via Tasker / MacroDroid

**Using Tasker ($2.99):**
```
Profile: Time → 04:00, Every Day
Task:
  1. HTTP Get → URL: [your wallpaper URL] → Save to File: /sdcard/ramadan_wallpaper.png
  2. Set Wallpaper → File: /sdcard/ramadan_wallpaper.png → Type: Lock Screen
```

**Using MacroDroid (free):**
```
Trigger: Time → 04:00 daily
Actions:
  1. HTTP Request → GET → [your URL] → Save response to file
  2. Set Wallpaper → Lock Screen → [saved file]
```

---

## 📱 Supported phone sizes

| Model | Resolution |
|-------|-----------|
| `iphone16pro` | 1206 × 2622 |
| `iphone16` | 1179 × 2556 |
| `iphone15` | 1179 × 2556 |
| `iphone14` | 1170 × 2532 |
| `iphone13` | 1170 × 2532 |
| `s24ultra` | 1440 × 3088 |
| `s24` | 1080 × 2340 |
| `pixel8` | 1080 × 2400 |

---

## 🕌 Prayer time calculation

Prayer times are fetched from the **[Aladhan API](https://aladhan.com)** — free, no API key required, supports thousands of cities worldwide. Method 4 (Umm al-Qura, used in Saudi Arabia) is used by default.

To change the calculation method, add `&method=X` to your URL:

| Method | Used by |
|--------|---------|
| 1 | University of Islamic Sciences, Karachi |
| 2 | Islamic Society of North America (ISNA) |
| 3 | Muslim World League |
| **4** | **Umm al-Qura (Saudi Arabia) — default** |
| 5 | Egyptian General Authority of Survey |

---

## 🏗️ Project structure

```
ramadan-wallpaper/
├── api/
│   └── wallpaper.js      ← Serverless function: generates the PNG
├── public/
│   └── index.html        ← Landing page: URL builder + setup guide
├── package.json
├── vercel.json            ← Routes /wallpaper.png → /api/wallpaper.js
└── README.md
```

---

## 🛠️ Local development

```bash
npm install
npm run dev
# → http://localhost:3000
# → http://localhost:3000/wallpaper.png?city=Dubai&model=iphone15
```

---

## ✨ Features

- **Live countdown arc** — fills as you progress through the fast
- **Suhoor & Iftar panels** — always showing today's exact times for your city
- **Dynamic sky** — gradient shifts from deep night → pre-Fajr twilight → day → sunset → Iftar glow → night
- **Crescent moon** — appears at night, fades at Fajr
- **30-day dot strip** — shows which day of Ramadan you're on
- **Hijri date** in Arabic numerals
- **Ashr phases** — Mercy / Forgiveness / Freedom from Hellfire
- **Laylat al-Qadr** — special treatment on odd nights of last 10 days
- **Bilingual** — Arabic and English throughout

---

## 📜 License

MIT — free to use, fork, and share. Built with ❤️ for the Ummah.

---

*Prayer times via [Aladhan.com](https://aladhan.com) · Fonts: Amiri, Cormorant Garamond · Hosted free on Vercel*
