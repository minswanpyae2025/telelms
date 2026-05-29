-- လမ်းစ (Lann Sa) LMS - Supabase Schema
-- Run this in your Supabase SQL Editor to set up the database

-- Roadmaps (Career Pathways)
CREATE TABLE IF NOT EXISTS roadmaps (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT '📚',
  color TEXT DEFAULT '#3390ec',
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Courses
CREATE TABLE IF NOT EXISTS courses (
  id SERIAL PRIMARY KEY,
  roadmap_id INTEGER REFERENCES roadmaps(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  price_mmk INTEGER NOT NULL DEFAULT 0,
  price_usdt NUMERIC(10,2) DEFAULT NULL,
  thumbnail_url TEXT,
  telegram_group_id TEXT,
  difficulty TEXT DEFAULT 'beginner' CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
  duration_hours INTEGER,
  order_index INTEGER DEFAULT 0,
  is_published BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Users
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  telegram_id BIGINT UNIQUE NOT NULL,
  first_name TEXT,
  last_name TEXT,
  username TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Modules
CREATE TABLE IF NOT EXISTS modules (
  id SERIAL PRIMARY KEY,
  course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  order_index INTEGER DEFAULT 0
);

-- Lessons
CREATE TABLE IF NOT EXISTS lessons (
  id SERIAL PRIMARY KEY,
  module_id INTEGER REFERENCES modules(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT,
  video_url TEXT,
  file_url TEXT,
  order_index INTEGER DEFAULT 0
);

-- Payment Methods (KBZPay, WavePay, CB Pay, AYA Pay, etc.)
CREATE TABLE IF NOT EXISTS payment_methods (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  account_name TEXT,
  account_number TEXT,
  qr_image_url TEXT,
  instructions TEXT
);

-- Payments
CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  course_id INTEGER REFERENCES courses(id),
  payment_method_id INTEGER REFERENCES payment_methods(id),
  screenshot_url TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bookmarks
CREATE TABLE IF NOT EXISTS bookmarks (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, course_id)
);

-- Progress
CREATE TABLE IF NOT EXISTS progress (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  lesson_id INTEGER REFERENCES lessons(id) ON DELETE CASCADE,
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  UNIQUE(user_id, lesson_id)
);

-- Announcements
CREATE TABLE IF NOT EXISTS announcements (
  id SERIAL PRIMARY KEY,
  course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reviews
CREATE TABLE IF NOT EXISTS reviews (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, course_id)
);

-- Quizzes
CREATE TABLE IF NOT EXISTS quizzes (
  id SERIAL PRIMARY KEY,
  lesson_id INTEGER REFERENCES lessons(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  passing_score INTEGER DEFAULT 70,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Quiz Questions
CREATE TABLE IF NOT EXISTS quiz_questions (
  id SERIAL PRIMARY KEY,
  quiz_id INTEGER REFERENCES quizzes(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  option_a TEXT NOT NULL,
  option_b TEXT NOT NULL,
  option_c TEXT,
  option_d TEXT,
  correct_answer TEXT NOT NULL CHECK (correct_answer IN ('a', 'b', 'c', 'd')),
  order_index INTEGER DEFAULT 0
);

-- Quiz Attempts
CREATE TABLE IF NOT EXISTS quiz_attempts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  quiz_id INTEGER REFERENCES quizzes(id) ON DELETE CASCADE,
  score INTEGER NOT NULL,
  total INTEGER NOT NULL,
  passed BOOLEAN DEFAULT false,
  answers JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Certificates
CREATE TABLE IF NOT EXISTS certificates (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,
  certificate_number TEXT UNIQUE NOT NULL,
  issued_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, course_id)
);

-- Discussions (per course)
CREATE TABLE IF NOT EXISTS discussions (
  id SERIAL PRIMARY KEY,
  course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Coupons / Referral Codes
CREATE TABLE IF NOT EXISTS coupons (
  id SERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  type TEXT DEFAULT 'fixed' CHECK (type IN ('fixed', 'percent', 'referral')),
  discount_amount INTEGER DEFAULT 0,
  discount_percent INTEGER DEFAULT 0,
  max_uses INTEGER DEFAULT 1,
  used_count INTEGER DEFAULT 0,
  course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS coupon_uses (
  id SERIAL PRIMARY KEY,
  coupon_id INTEGER REFERENCES coupons(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,
  discount_applied INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(coupon_id, user_id, course_id)
);

CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code);
CREATE INDEX IF NOT EXISTS idx_coupon_uses_user ON coupon_uses(user_id);

-- App Settings (global config: language, payment toggles, NOWPayments)
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Default settings
INSERT INTO app_settings (key, value) VALUES
  ('language', 'my'),
  ('myanmar_payment_enabled', 'true'),
  ('crypto_payment_enabled', 'false'),
  ('nowpayments_api_key', ''),
  ('nowpayments_ipn_secret', ''),
  ('nowpayments_accepted_coins', 'btc,eth,usdt,ltc,trx')
ON CONFLICT (key) DO NOTHING;

-- Crypto Payments (NOWPayments)
CREATE TABLE IF NOT EXISTS crypto_payments (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  course_id INTEGER REFERENCES courses(id),
  nowpayments_id BIGINT,
  order_id TEXT,
  pay_address TEXT,
  pay_amount NUMERIC,
  pay_currency TEXT,
  price_amount NUMERIC,
  price_currency TEXT DEFAULT 'usd',
  status TEXT DEFAULT 'waiting',
  actually_paid NUMERIC DEFAULT 0,
  outcome_amount NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crypto_payments_user ON crypto_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_crypto_payments_nowid ON crypto_payments(nowpayments_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_courses_roadmap ON courses(roadmap_id);
CREATE INDEX IF NOT EXISTS idx_modules_course ON modules(course_id);
CREATE INDEX IF NOT EXISTS idx_lessons_module ON lessons(module_id);
CREATE INDEX IF NOT EXISTS idx_payments_user ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_progress_user ON progress(user_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_user ON bookmarks(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_course ON reviews(course_id);
CREATE INDEX IF NOT EXISTS idx_quizzes_lesson ON quizzes(lesson_id);
CREATE INDEX IF NOT EXISTS idx_quiz_questions_quiz ON quiz_questions(quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user ON quiz_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_certificates_user ON certificates(user_id);
CREATE INDEX IF NOT EXISTS idx_discussions_course ON discussions(course_id);

-- Storage bucket for uploads (run in Supabase dashboard or via API):
-- CREATE STORAGE BUCKET 'uploads' with public access

-- Sample data for testing
INSERT INTO roadmaps (title, description, icon, color, order_index) VALUES
  ('Web Development', 'HTML, CSS, JavaScript မှ Full-Stack Developer အထိ', '🌐', '#3390ec', 1),
  ('Mobile Development', 'Android နှင့် iOS App Development', '📱', '#e91e63', 2),
  ('Data Science', 'Python, ML, AI လေ့လာရန်', '📊', '#4caf50', 3),
  ('UI/UX Design', 'Design Thinking နှင့် Figma', '🎨', '#ff9800', 4)
ON CONFLICT DO NOTHING;

-- Security hardening: Row Level Security defense-in-depth.
-- The Express API uses the Supabase service role key for server-side access, which bypasses RLS.
-- These policies prevent accidental direct anon/authenticated client access if keys are exposed or a client is added later.
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE crypto_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE discussions ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupon_uses ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

ALTER TABLE crypto_payments ADD COLUMN IF NOT EXISTS order_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_crypto_payments_order_id_unique ON crypto_payments(order_id) WHERE order_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_crypto_payments_nowid_unique ON crypto_payments(nowpayments_id) WHERE nowpayments_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_coupon_uses_coupon_course ON coupon_uses(coupon_id, course_id);

-- Public catalog read policies for future direct Supabase clients. Mutations remain server-only.
ALTER TABLE roadmaps ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS public_read_roadmaps ON roadmaps;
CREATE POLICY public_read_roadmaps ON roadmaps FOR SELECT USING (true);
DROP POLICY IF EXISTS public_read_published_courses ON courses;
CREATE POLICY public_read_published_courses ON courses FOR SELECT USING (is_published = true);
DROP POLICY IF EXISTS public_read_payment_methods ON payment_methods;
CREATE POLICY public_read_payment_methods ON payment_methods FOR SELECT USING (true);
DROP POLICY IF EXISTS public_read_announcements ON announcements;
CREATE POLICY public_read_announcements ON announcements FOR SELECT USING (true);
DROP POLICY IF EXISTS public_read_reviews ON reviews;
CREATE POLICY public_read_reviews ON reviews FOR SELECT USING (true);
DROP POLICY IF EXISTS public_read_discussions ON discussions;
CREATE POLICY public_read_discussions ON discussions FOR SELECT USING (true);

-- Storage guidance: keep QR images public but payment screenshots private where possible.
-- If using a single public 'uploads' bucket, store only validated image types from the API.
-- Prefer splitting buckets:
--   insert into storage.buckets (id, name, public) values ('qr-public', 'qr-public', true) on conflict do nothing;
--   insert into storage.buckets (id, name, public) values ('payment-screenshots', 'payment-screenshots', false) on conflict do nothing;
-- Then add narrow storage.objects policies for QR public reads and service-role-only screenshot writes/reads.

-- Feature additions: security logging, bans, previews, and global UX settings.
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS is_preview BOOLEAN DEFAULT false;
ALTER TABLE crypto_payments ADD COLUMN IF NOT EXISTS order_id TEXT;

CREATE TABLE IF NOT EXISTS security_events (
  id SERIAL PRIMARY KEY,
  event_type TEXT NOT NULL,
  telegram_id BIGINT,
  ip_hash TEXT,
  user_agent TEXT,
  path TEXT,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS banned_telegram_users (
  telegram_id BIGINT PRIMARY KEY,
  reason TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS banned_ip_hashes (
  ip_hash TEXT PRIMARY KEY,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO app_settings (key, value) VALUES
  ('maintenance_mode', 'false'),
  ('maintenance_message', 'Maintenance in progress. Please try again soon.'),
  ('bot_username', ''),
  ('telegram_start_url', '')
ON CONFLICT (key) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_security_events_created ON security_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_telegram ON security_events(telegram_id);
CREATE INDEX IF NOT EXISTS idx_lessons_preview ON lessons(is_preview);

ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE banned_telegram_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE banned_ip_hashes ENABLE ROW LEVEL SECURITY;

-- Admin sessions/audits, certificate verification, bundles, and security-mode settings.
CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id SERIAL PRIMARY KEY,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  ip_hash TEXT,
  user_agent TEXT,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS certificate_requests (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  certificate_id INTEGER REFERENCES certificates(id) ON DELETE SET NULL,
  certificate_number TEXT,
  photo_url TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  admin_note TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS course_bundles (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  price_mmk INTEGER DEFAULT 0,
  price_usdt NUMERIC(10,2),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bundle_courses (
  bundle_id INTEGER REFERENCES course_bundles(id) ON DELETE CASCADE,
  course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,
  PRIMARY KEY (bundle_id, course_id)
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created ON admin_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_certificate_requests_status ON certificate_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bundle_courses_course ON bundle_courses(course_id);

ALTER TABLE admin_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificate_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_bundles ENABLE ROW LEVEL SECURITY;
ALTER TABLE bundle_courses ENABLE ROW LEVEL SECURITY;

INSERT INTO app_settings (key, value) VALUES
  ('telegram_only_mode', 'true'),
  ('auto_ban_missing_init_data', 'false'),
  ('auto_ban_threshold', '5'),
  ('security_contact_message', 'Please open this app from Telegram. Contact support if you were blocked by mistake.'),
  ('support_url', ''),
  ('certificate_logo_url', ''),
  ('certificate_signature_text', 'Lann Sa Academy'),
  ('payment_screenshot_bucket', 'uploads'),
  ('payment_screenshot_private', 'false'),
  ('qr_public_bucket', 'uploads')
ON CONFLICT (key) DO NOTHING;

ALTER TABLE courses ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
