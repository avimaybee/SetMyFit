# SetMyFit: Your Personal AI Stylist

SetMyFit is a context-aware, highly personalized, daily decision engine for your outfits. It's an AI-powered stylist that learns your preferences and helps you make the most of your wardrobe.

## 🔥 Fire Fit Engine (v2.0)

The recommendation engine uses **Gemini 2.5 Flash** with fashion-first styling logic:

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
| **Backend** | Supabase (PostgreSQL, Auth, Storage) |
| **AI** | Google Gemini 2.5 Flash |
| **Weather** | OpenWeatherMap API |
| **Deployment** | Vercel |

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

Main tables in Supabase:
- `clothing_items` - User wardrobe with RLS
- `outfits` - Logged outfits
- `outfit_recommendations` - AI suggestions with confidence scores
- `profiles` - User preferences
- `user_preferences` - Style settings

## Getting Started

### Prerequisites
- Node.js v18+
- npm
- Supabase account (or Docker for local)

### Installation

```bash
git clone https://github.com/avimaybee/what2wear.git
cd what2wear/app
npm install
```

### Environment Variables

Create `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
NEXT_PUBLIC_OPENWEATHER_API_KEY=your_openweather_key
GEMINI_API_KEY=your_gemini_key
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Deployment

Deploy to [Vercel](https://vercel.com/) - auto-deploys from GitHub.

### Supabase Migrations

Run these in Supabase SQL Editor after deployment:
1. `supabase/migrations/001_fix_security_definer_view.sql`
2. `supabase/migrations/002_fix_function_search_path.sql`

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
