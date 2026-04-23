-- TeleLMS Supabase Schema
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
  thumbnail_url TEXT,
  telegram_group_id TEXT,
  difficulty TEXT DEFAULT 'beginner' CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
  duration_hours INTEGER,
  order_index INTEGER DEFAULT 0,
  is_published BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
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

-- Payment Methods (KBZPay, WavePay, CB Pay, etc.)
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

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_courses_roadmap ON courses(roadmap_id);
CREATE INDEX IF NOT EXISTS idx_modules_course ON modules(course_id);
CREATE INDEX IF NOT EXISTS idx_lessons_module ON lessons(module_id);
CREATE INDEX IF NOT EXISTS idx_payments_user ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_progress_user ON progress(user_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_user ON bookmarks(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_course ON reviews(course_id);

-- Storage bucket for uploads (run in Supabase dashboard or via API):
-- CREATE STORAGE BUCKET 'uploads' with public access

-- Sample data for testing
INSERT INTO roadmaps (title, description, icon, color, order_index) VALUES
  ('Web Development', 'HTML, CSS, JavaScript မှ Full-Stack Developer အထိ', '🌐', '#3390ec', 1),
  ('Mobile Development', 'Android နှင့် iOS App Development', '📱', '#e91e63', 2),
  ('Data Science', 'Python, ML, AI လေ့လာရန်', '📊', '#4caf50', 3),
  ('UI/UX Design', 'Design Thinking နှင့် Figma', '🎨', '#ff9800', 4)
ON CONFLICT DO NOTHING;
