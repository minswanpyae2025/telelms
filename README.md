# TeleLMS - Telegram Mini App LMS

A full-stack Learning Management System built as a Telegram Mini App with career pathway sorting and manual payment approval workflow for Myanmar.

## Features

- **Career Pathways** - Courses organized by career roadmaps with icons, colors, and sorting
- **Course Management** - Modules, lessons with video/file support, progress tracking
- **Myanmar Payment Workflow** - Manual payment via KBZPay, WavePay, CB Pay with screenshot upload and admin approval
- **Telegram Bot Integration** - Webhook-based bot for notifications and commands
- **Admin Dashboard** - Full CRUD for content, payment management with screenshot preview
- **User Features** - Bookmarks, search, reviews, progress tracking, payment history

## Tech Stack

- **Frontend**: Vanilla HTML/JS + Tailwind CSS (Telegram Mini App)
- **Backend**: Express.js as Vercel Serverless Function
- **Database**: Supabase (PostgreSQL)
- **Storage**: Supabase Storage (payment screenshots, QR codes)
- **Bot**: Telegram Bot API (webhook mode)
- **Deployment**: Vercel

## Project Structure

```
telelms/
├── api/
│   └── index.js           # Express API (Vercel serverless function)
├── lib/
│   ├── supabase.js        # Supabase client
│   └── bot.js             # Telegram bot (webhook mode)
├── public/
│   ├── index.html         # Telegram Mini App UI
│   ├── app.js             # Mini App frontend logic
│   ├── admin.html         # Admin dashboard
│   └── admin.js           # Admin logic
├── supabase/
│   └── schema.sql         # Database schema
├── vercel.json            # Vercel config
├── .env.example           # Environment variables template
└── package.json
```

## Setup & Deployment

### 1. Supabase Setup

1. Create a project at [supabase.com](https://supabase.com)
2. Go to SQL Editor and run `supabase/schema.sql`
3. Create a Storage bucket named `uploads` with public access:
   - Go to Storage → New Bucket → Name: `uploads` → Public bucket: ON
4. Copy your project URL and keys from Settings → API

### 2. Telegram Bot Setup

1. Create a bot via [@BotFather](https://t.me/BotFather)
2. Set the bot's menu button to your web app URL
3. Copy the bot token

### 3. Deploy to Vercel

1. Push this repo to GitHub
2. Import in [Vercel](https://vercel.com)
3. Set environment variables:

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |
| `BOT_TOKEN` | Telegram bot token |
| `WEB_APP_URL` | Deployed Vercel URL |
| `ADMIN_PASSWORD` | Admin dashboard password |
| `BOT_OWNER_ID` | Your Telegram user ID |
| `ADMIN_CHANNEL_ID` | Telegram channel ID for admin notifications |

4. Deploy!

### 4. Register Bot Webhook

After deployment, visit:
```
https://your-app.vercel.app/api/bot/setup
```

This registers the webhook URL with Telegram.

## Admin Dashboard

Access at: `https://your-app.vercel.app/admin.html`

Login with your `ADMIN_PASSWORD` to manage:
- Roadmaps (career pathways)
- Courses with difficulty levels and pricing
- Modules and lessons
- Payment methods (KBZPay, WavePay, etc.)
- Payment approval/rejection with notes
- Announcements
- Users

## Bot Commands

- `/start` - Welcome message with Mini App button
- `/courses` - List enrolled courses
- `/help` - Help information
- `/setadmin` - Set current chat as admin notification channel

## Payment Flow

1. Student selects a course and clicks "Buy"
2. Selects payment method (KBZPay, WavePay, etc.)
3. Views account details and QR code
4. Makes payment and uploads screenshot
5. Admin receives notification and reviews payment
6. Admin approves/rejects with optional note
7. Student gets Telegram notification with course access

## Local Development

```bash
cp .env.example .env
# Fill in your environment variables
npm install
npm run dev
```

## Future Improvements

- Quiz/assessment system
- Course completion certificates
- Multi-language support (English + Myanmar)
- Analytics dashboard
- Discussion forum per course
- Bulk payment operations
- CSV data export
