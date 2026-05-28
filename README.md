# 🎓 လမ်းစ (Lann Sa) - Telegram Mini App LMS

A Telegram-native Learning Management System built for Myanmar. Users browse career roadmaps, enroll in courses, pay via Myanmar payment methods (KBZ Pay, Wave, CB Pay, AYA Pay), and get invited to private Telegram groups. Everything in Burmese language.

## Features

### 📱 Telegram Mini App (User-facing)
- Career Roadmaps — Browse career paths with icons and descriptions
- Courses — View courses within each roadmap, with pricing in MMK
- Course Detail — Modules, lessons, content (text, video, files)
- Payment Flow — Choose payment method → see QR code + account info → upload screenshot
- Payment Status — Track pending/approved/rejected payments
- Join Group — After approval, one-click join to private group (one-time invite link)
- Progress Tracking — Mark lessons as complete, see progress bar
- Quiz System — Multiple choice quizzes per lesson with scoring
- Certificates — Auto-generated completion certificates
- Discussions — Per-course discussion threads
- Bookmarks — Save courses for later
- Reviews — Rate and review courses
- Announcements — Course-specific news/updates
- All in **Burmese language**

### 🤖 Telegram Bot
- `/start` — Opens the Mini App with a button
- `/courses` — Shows user's enrolled courses
- `/help` — Help message in Burmese
- `/setadmin` — Admin command to set notification channel
- Payment approval → sends "✅ Approved! Join now" with button
- Payment rejection → sends reason and "🔄 Try again" button
- One-time invite link generation (member_limit: 1, 24-hour expiry)

### 🖥️ Admin Dashboard
- Dashboard — Revenue (MMK), enrollment count, pending payments, user count
- Payments — View screenshots, approve/reject with notes, bulk approve
- Payment Methods — CRUD (add KBZ Pay, Wave, etc.), upload QR codes
- Roadmaps — CRUD career roadmaps with icons and colors
- Courses — CRUD courses with pricing in MMK, link Telegram groups
- Modules & Lessons — Full course content management
- Announcements — Post course-specific or global announcements
- Users — View all registered Telegram users
- Analytics — Monthly revenue charts, course revenue, enrollment trends
- CSV Export — Export users, payments, courses data
- All labels in **Burmese**

## Tech Stack

- **Frontend**: Vanilla JS + Tailwind CSS (no build step)
- **Backend**: Express.js (Vercel Serverless)
- **Database**: Supabase (PostgreSQL)
- **Storage**: Supabase Storage (screenshots, QR codes)
- **Bot**: Telegram Bot API (webhook mode)
- **Font**: Noto Sans Myanmar

## Deployment Guide

### 1. Supabase Setup
1. Create a new project at [supabase.com](https://supabase.com)
2. Go to SQL Editor → run `supabase/schema.sql`
3. Go to Storage → create a bucket named `uploads` with public access

### 2. Telegram Bot Setup
1. Create a bot via [@BotFather](https://t.me/BotFather)
2. Set the bot's Menu Button URL to your deployed app URL
3. If using groups, make the bot an admin in each private group

### 3. Vercel Deployment
1. Import this repo on [vercel.com](https://vercel.com)
2. Set environment variables:

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
BOT_TOKEN=your-telegram-bot-token
WEB_APP_URL=https://your-vercel-app.vercel.app
ADMIN_PASSWORD=your-admin-password
ADMIN_CHANNEL_ID=your-telegram-channel-id (optional)
BOT_OWNER_ID=your-telegram-user-id (optional)
```

3. Deploy! Then visit `https://your-app.vercel.app/api/bot/setup` to register the webhook.

### 4. Access
- **Mini App**: Open the Telegram bot → click the button
- **Admin Dashboard**: Visit `https://your-app.vercel.app/admin.html`

## Currency
All prices are in **MMK (Myanmar Kyat)** with no decimals.

## License
MIT
