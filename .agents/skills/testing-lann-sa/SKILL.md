# Testing Lann Sa LMS

How to test the Lann Sa (လမ်းစ) Telegram Mini App LMS locally.

## Devin Secrets Needed

- `SUPABASE_URL` — Supabase project URL (e.g. `https://xxxxx.supabase.co`)
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role key
- `ADMIN_PASSWORD` — Admin dashboard password (default: `admin123`)

## Dev Server Setup

```bash
cd /home/ubuntu/repos/telelms
export SUPABASE_URL="$SUPABASE_URL"
export SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY"
export ADMIN_PASSWORD="admin123"
node dev-server.js
```

Server runs at `http://localhost:3000`.

## User Mini App Screens

All screens are at `http://localhost:3000/` (single-page app with bottom nav).

| Screen | How to reach | What to verify |
|---|---|---|
| Home | Default screen / click Home nav | Gradient header, roadmap cards (horizontal scroll), course cards with badges |
| Course Detail | Click any course card on Home | Gradient hero section, price badge, Content/Reviews tabs, Pay button |
| My Courses | Click "သင်တန်း" in bottom nav | Empty state (outside Telegram), enrolled courses list (inside Telegram) |
| Bookmarks | Click "သိမ်းဆည်း" in bottom nav | Empty state (outside Telegram), saved courses (inside Telegram) |
| Profile | Click "ပရိုဖိုင်" in bottom nav | Avatar card, payment history section |
| Search | Click search icon in header | Search input with focus, course results |

## Admin Dashboard

URL: `http://localhost:3000/admin.html`

1. Login with admin password
2. Sidebar navigation: Dashboard, Payments, Payment Methods, Roadmaps, Courses, Content, Coupons, Announcements, Users, Analytics, Settings
3. Key screens to verify:
   - **Dashboard**: 6 stat cards with gradient icon backgrounds, correct counts
   - **Settings**: Language toggle (Myanmar/English), payment toggles (Myanmar Manual / Crypto), NOWPayments config
   - **Courses**: CRUD modal with USDT price field
   - **Roadmaps**: CRUD with icon/color selection

## Known Limitations

- **Telegram auth**: User-specific features (enrollment, payments, progress) require `initData` from Telegram WebApp. Outside Telegram, these show empty/placeholder states. This is expected behavior, not a bug.
- **Crypto payments**: End-to-end testing requires a real NOWPayments API key.
- **Bot notifications**: Requires a configured Telegram bot token.
- **Skeleton loaders**: Load too fast on localhost to capture visually. In production with network latency they would be visible.
- **Pyidaungsu font**: Loaded from CDN `https://cdn.jsdelivr.net/gh/AungMyoKyaw/Myanmar-Unicode-Fonts@master/Pyidaungsu/pyidaungsu-1.3.ttf`. If Myanmar text renders in fallback font, check CDN availability.

## Design System Reference

- Primary: `#6C5CE7` (purple), Accent: `#00CEC9` (cyan)
- Card radius: 20px, Button radius: 14px, Input radius: 10px
- Shadow levels: sm (subtle), md (card elevation), lg (modals)
- Animations: screenIn (0.35s), slideUp (modals), float (empty states), shimmer (skeletons), gradientShift (header)
- Font stack: Pyidaungsu → Padauk → Inter → system-ui
