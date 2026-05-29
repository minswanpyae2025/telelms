# 🎓 လမ်းစ (Lann Sa) - Telegram Mini App LMS

A bilingual Telegram Mini App LMS for Myanmar learners. It supports career roadmaps, paid/free course enrollment, progress, quizzes, certificates, discussions, reviews, Myanmar manual payments, crypto payments via NOWPayments, admin-controlled Burmese/English language, and Telegram-only access protection.

## Key Features

### User Mini App
- Telegram-only access gate with blocked-state logging.
- Admin-controlled Burmese/English UI.
- Roadmaps, courses, bookmarks, discussions, reviews, quizzes, certificates.
- Continue Learning card and first-time onboarding guide.
- Course preview lessons without leaking paid content.
- Manual payment flow with checklist, screenshot upload, duplicate-submission prevention, and payment history/status.
- Crypto payment flow with NOWPayments and duplicate pending-payment prevention.
- My Certificates area with admin-approved bot verification requests.
- Support/contact button controlled by admin settings.
- Maintenance/banned-user screens.

### Admin Dashboard
- Dashboard stats and needs-attention widgets.
- Payment review, bulk approval, CSV export.
- Payment methods, roadmaps, courses, modules, lessons, announcements, users, analytics.
- Global language toggle for user app, admin dashboard, and bot messages.
- Maintenance mode, Telegram start URL/bot username, NOWPayments settings.
- Security center: security events, Telegram ID bans, IP-hash bans, certificate requests, and admin audit log.
- Security-mode controls for Telegram-only access and optional threshold-based auto-ban.
- Setup checklist for first-run deployment readiness.
- Course publish/unpublish controls.
- Lesson preview flag, duplicate lesson, and module/lesson reordering.
- Coupon/referral usage statistics, course bundle API support, and bot-push announcements.

### Telegram Bot
- `/start`, `/courses`, `/help`, `/setadmin`.
- Uses admin-selected language from `app_settings.language`.
- Sends payment approval/rejection, crypto success messages, and announcement pushes.
- Handles certificate-photo guidance and sends approved certificate verification letters.
- Creates one-time private group invite links after enrollment.

## Tech Stack

- Frontend: Vanilla JS + Tailwind CSS, no build step.
- Backend: Express.js on Vercel Serverless.
- Database: Supabase PostgreSQL.
- Storage: Supabase Storage.
- Bot: Telegram Bot API webhook mode.
- Payments: Manual Myanmar transfers + NOWPayments crypto.

## Deployment Guide

### 1. Supabase setup
1. Create a Supabase project.
2. Open SQL Editor and run `supabase/schema.sql`.
3. Create a Storage bucket named `uploads`.
   - For fastest setup, make it public.
   - Recommendation #16 means: QR images can stay public, but payment screenshots should eventually move to a private bucket with signed admin-only views. The current app remains compatible with the existing `uploads` bucket while `supabase/schema.sql` documents the safer split (`qr-public` + `payment-screenshots`).
4. Copy your Supabase Project URL and Service Role Key.

### 2. Telegram bot setup
1. Create a bot with [@BotFather](https://t.me/BotFather).
2. Save the bot token as `BOT_TOKEN`.
3. Set the bot menu button / web app URL to your Vercel app URL after deployment.
4. If using private course groups, add the bot as admin in each group.
5. Get your Telegram user ID and set it as `BOT_OWNER_ID` if you want owner-only bot admin commands.

### 3. Environment variables
Set these in Vercel:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
BOT_TOKEN=your-telegram-bot-token
WEB_APP_URL=https://your-vercel-app.vercel.app
ADMIN_PASSWORD=use-a-long-random-password
TELEGRAM_WEBHOOK_SECRET=use-a-long-random-secret
SECURITY_LOG_SECRET=use-a-long-random-secret
ADMIN_CHANNEL_ID=your-telegram-channel-or-chat-id-optional
BOT_OWNER_ID=your-telegram-user-id-optional
```

Optional NOWPayments settings are configured from the admin dashboard after deployment.

### 4. Vercel deployment
1. Import the repo into Vercel.
2. Add the environment variables above.
3. Deploy.
4. Visit the admin dashboard: `https://your-app.vercel.app/admin.html`.
5. Log in with `ADMIN_PASSWORD`.
6. Open `https://your-app.vercel.app/api/bot/setup` with the admin password header if using an API client, or call it from a protected admin workflow, to register the Telegram webhook.

### 5. Admin first-run checklist
1. Settings → choose Burmese or English.
2. Settings → add Bot Username or Telegram Start URL.
3. Payment Methods → add at least one Myanmar payment method if manual payments are enabled.
4. Settings → configure NOWPayments API Key/IPN Secret if crypto payments are enabled.
5. Roadmaps → create career paths.
6. Courses → create courses, set estimated duration, publish only when ready, and optionally add Telegram group IDs.
7. Content → create/reorder modules and lessons; mark selected lessons as free previews if desired.
8. Settings → review Telegram-only security mode, auto-ban threshold, support URL, and certificate logo/signature.
9. BotFather → ensure the bot opens the Mini App URL.

## Usage Guide

### Learners
1. Open the Telegram bot.
2. Tap the Mini App button.
3. Pick a roadmap and course.
4. Preview available lessons if enabled.
5. Enroll by payment or free coupon.
6. Continue learning from the home screen.
7. Complete lessons/quizzes and generate a certificate.
8. Open Profile → My Certificates to request admin-approved bot verification. Users may also send the certificate photo to the bot with the certificate number in the caption for guidance.

### Admins
1. Visit `/admin.html`.
2. Review pending payments from the dashboard or payments page.
3. Add/update course content.
4. Use Security to view blocked attempts and ban/unban Telegram IDs or IP hashes.
5. Use Settings to toggle language, payments, maintenance mode, Telegram-only security, support URL, and certificate verification branding.
6. Approve certificate verification requests in Security; approved users receive a bot message in a To Whom It May Concern format with name, course, acquired date, certificate number, signature text, and optional logo.
7. Use Announcements with “Push to users via bot” only for important messages to avoid spam.

## Security Notes

- The user app intentionally blocks outside-Telegram access.
- User-owned API routes require valid Telegram init data.
- Invalid/missing Telegram init data is logged in `security_events`.
- Missing Telegram init data is logged first. Optional auto-ban is threshold-based (`auto_ban_threshold`, default 5 events in 10 minutes), so link leakage does not instantly block innocent users.
- Admin login exchanges `ADMIN_PASSWORD` for an in-memory session token and has throttling; password-header fallback remains for API clients.
- Bot webhook requires `TELEGRAM_WEBHOOK_SECRET`.
- NOWPayments IPN requires signature verification and matching payment/order data.
- Payment uploads accept only validated PNG/JPEG/WebP images.
- A Content-Security-Policy header limits scripts, frames, connections, and image sources for the Mini App/admin site.

## Content Delivery Clarification

Course and lesson content currently lives in Supabase (`courses`, `modules`, `lessons`) and is rendered inside the Mini App after payment/access checks. Telegram private channels/groups are optional extras: after payment approval, the bot can generate a one-time group invite if a course has `telegram_group_id`. The Telegram channel is not the primary lesson database unless you manually use group links as course resources.

## Deferred to Avoid Overcomplication

These are intentionally not included yet:
- Per-user language preferences; global admin language is simpler.
- Fully private signed screenshot viewer; current storage remains compatible with `uploads`, with schema guidance for the private-bucket upgrade.
- Multi-admin roles/permissions; one admin password + session is simpler for now.
- Drag-and-drop course builder; up/down ordering is enough.
- Heavy analytics; current dashboard focuses on operational needs.
- Native mobile app; Telegram Mini App is the core platform.
- Aggressive fingerprinting; Telegram ID and IP-hash controls are enough for now.

## Currency

All Myanmar manual payment prices are in MMK. Crypto prices can use course `price_usdt` or fallback conversion.

## License

MIT
