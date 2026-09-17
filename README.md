# SetMyFit: Your Personal AI Stylist

SetMyFit is a context-aware, highly personalized, daily decision engine for your outfits. It's an AI-powered stylist that learns your preferences and helps you make the most of your wardrobe.

## 🔥 Fire Fit Engine (v2.0)

The recommendation engine uses **Gemini 3.5 Flash-Lite** with fashion-first styling logic:

- **Sandwich Rule** - Match shoe color with top for visual harmony
- **Silhouette Theory** - Contrast fits (oversized top → slim bottom)
- **3-Color Rule** - Max 3 main colors (neutrals don't count)
- **Statement Piece** - Every outfit has one hero item
- **Texture Play** - Mix materials for depth

### Scoring System
Outfits are scored 0-100% based on:
- Color coordination
- Silhouette balance
- Occasion fit
- Overall aesthetic cohesion

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Framework** | Next.js 15.5.7 |
| **Frontend** | React 19, TypeScript, Tailwind CSS v4 |
| **UI** | shadcn/ui, Framer Motion, Custom Retro Components |
| **Backend** | Cloudflare D1 (SQLite) + Next.js API routes |
| **Auth** | Firebase Auth (email/password, Admin SDK verification) |
| **Storage** | Cloudflare R2 (S3-compatible, public URLs) |
| **AI** | Google Gemini (`@google/genai` SDK, enforced JSON schemas, vision validation) |
| **Weather** | OpenWeatherMap Current Weather (free tier) |
| **Deployment** | Cloudflare Workers (`@opennextjs/cloudflare`, `nodejs_compat` flag) |

## Features

### Core
- **Virtual Wardrobe** - Upload, categorize, and manage clothing with AI auto-tagging
- **AI Outfit Recommendations** - Weather-aware, occasion-based outfit suggestions
- **Outfit Logging** - Track what you wear and when

### Smart Features
- **Background Removal** - Automatic image cleanup (temporarily disabled)
- **Color Detection** - AI extracts dominant colors from clothes
- **Wear Tracking** - See most/least worn items
- **Season Filtering** - Smart seasonal recommendations

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `POST /api/wardrobe` | Add new clothing item |
| `PATCH /api/wardrobe/[id]` | Update item (whitelisted fields) |
| `DELETE /api/wardrobe/[id]` | Delete item + cleanup storage |
| `POST /api/wardrobe/analyze` | AI image analysis |
| `POST /api/recommendation` | Generate outfit recommendation |
| `POST /api/recommendation/ai` | Fire Fit Engine recommendation |
| `POST /api/outfit/log` | Log worn outfit (increments wear_count) |
| `GET /api/stats` | Wardrobe analytics |
| `GET /api/weather` | Weather data |

## Database Schema

D1 tables (see `db/schema.sql`, applied via `wrangler d1 execute --file`):
- `clothing_items` - User wardrobe (Firebase UID in `user_id`, no RLS — filtered in code)
- `outfits` + `outfit_items` - Logged outfits
- `outfit_recommendations` - AI suggestions with confidence scores
- `recommendation_feedback` - Likes/dislikes for preference learning
- `profiles` - User preferences (auto-created at onboarding)
- `outfit_templates` - Seeded public templates
- Local dev without Cloudflare creds uses `.data/local.db` (auto-migrated SQLite).

## Getting Started

### Prerequisites
- Node.js v22+
- npm
- Firebase project (email/password auth enabled) + service-account key
- Cloudflare account (or nothing — local dev falls back to SQLite)

### Installation

```bash
git clone https://github.com/avimaybee/what2wear.git
cd what2wear/app
npm install
cp .env.example .env.local  # then fill in Firebase + Cloudflare values
```

Local dev with zero Cloudflare setup works out of the box (SQLite at
`.data/local.db`). To use real D1/R2 locally, set the `CLOUDFLARE_*`/`R2_*`
vars in `.env.local`.

### Environment Variables

See `.env.example` for the full list (`NEXT_PUBLIC_FIREBASE_*`,
`FIREBASE_*`, `CLOUDFLARE_*`, `R2_*`, `GEMINI_API_KEY`, `OPENWEATHER_API_KEY`).

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Deployment (Cloudflare Workers — you deploy it yourself)

```bash
wrangler d1 create setmyfit-db            # put id in wrangler.toml + secrets
wrangler d1 execute setmyfit-db --remote --file=db/schema.sql
wrangler r2 bucket create setmyfit-images # then enable public access, note R2_PUBLIC_URL
npm run deploy                            # opennextjs-cloudflare build && deploy
```

`npm run preview` runs the workerd build locally (accurate to production).
Put all `FIREBASE_*`, `CLOUDFLARE_*`, `R2_*`, `GEMINI_API_KEY`,
`OPENWEATHER_API_KEY` secrets via `wrangler secret put` (or the dashboard)
and the `NEXT_PUBLIC_*` build vars via `.env.production` or dashboard.
(`@cloudflare/next-on-pages` is deprecated — do not use it.)

## Recent Updates (Dec 2024)

- ✅ Fire Fit Engine v2.0 - Fashion-first AI prompt
- ✅ Score normalization (0-100% display)
- ✅ Wardrobe save bug fix (schema alignment)
- ✅ Image optimization (31-day cache, reduced transformations)
- ✅ Security patches (Next.js CVE, Supabase functions)
- ✅ Wear count tracking
- ⚠️ Background removal temporarily disabled (CDN CORS)

## License

MIT
