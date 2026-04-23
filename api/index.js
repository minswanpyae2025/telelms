const express = require('express');
const crypto = require('crypto');
const multer = require('multer');
const supabase = require('../lib/supabase');
const bot = require('../lib/bot');

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- Auth Middleware ---

function parseTelegramUser(req, res, next) {
  const initData = req.headers['x-telegram-init-data'];
  if (!initData) return res.status(401).json({ error: 'No initData' });
  try {
    const urlParams = new URLSearchParams(initData);
    const userStr = urlParams.get('user');
    if (!userStr) return res.status(400).json({ error: 'No user in initData' });
    req.telegramUser = JSON.parse(userStr);
    next();
  } catch (err) {
    res.status(400).json({ error: 'Invalid initData' });
  }
}

function validateAdmin(req, res, next) {
  const pwd = req.headers['x-admin-password'];
  if (pwd === (process.env.ADMIN_PASSWORD || 'admin123')) return next();
  res.status(401).json({ error: 'Unauthorized' });
}

async function ensureUser(tgUser) {
  const { data: existing } = await supabase
    .from('users').select('id').eq('telegram_id', tgUser.id).single();
  if (existing) return existing.id;

  const { data: inserted } = await supabase
    .from('users')
    .upsert({
      telegram_id: tgUser.id,
      first_name: tgUser.first_name,
      last_name: tgUser.last_name || null,
      username: tgUser.username || null,
    }, { onConflict: 'telegram_id' })
    .select('id').single();

  return inserted ? inserted.id : null;
}

// --- Health ---
app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// --- Bot Webhook ---
app.post('/api/bot/webhook', async (req, res) => {
  try {
    await bot.handleWebhook(req.body);
    res.json({ ok: true });
  } catch (err) {
    console.error('Webhook error:', err);
    res.json({ ok: true });
  }
});

app.get('/api/bot/setup', async (req, res) => {
  const webhookUrl = `${process.env.WEB_APP_URL || req.protocol + '://' + req.get('host')}/api/bot/webhook`;
  const result = await bot.setupWebhook(webhookUrl);
  res.json({ webhookUrl, result });
});

// --- Search ---
app.get('/api/search', async (req, res) => {
  const q = req.query.q;
  if (!q) return res.json({ courses: [], lessons: [] });

  const { data: courses } = await supabase
    .from('courses')
    .select('*')
    .or(`title.ilike.%${q}%,description.ilike.%${q}%`)
    .eq('is_published', true);

  const { data: lessons } = await supabase
    .from('lessons')
    .select('id, title, module_id, modules(course_id, courses(id, title))')
    .ilike('title', `%${q}%`);

  const formattedLessons = (lessons || []).map(l => ({
    id: l.id,
    title: l.title,
    course_id: l.modules?.courses?.id,
    course_title: l.modules?.courses?.title,
  }));

  res.json({ courses: courses || [], lessons: formattedLessons });
});

// --- Reviews ---
app.get('/api/courses/:id/reviews', async (req, res) => {
  const { data } = await supabase
    .from('reviews')
    .select('*, users(first_name, username)')
    .eq('course_id', req.params.id)
    .order('created_at', { ascending: false });

  const formatted = (data || []).map(r => ({
    ...r,
    first_name: r.users?.first_name,
    username: r.users?.username,
  }));
  res.json(formatted);
});

app.post('/api/courses/:id/reviews', parseTelegramUser, async (req, res) => {
  const userId = await ensureUser(req.telegramUser);
  const { data: payment } = await supabase
    .from('payments')
    .select('id')
    .eq('user_id', userId)
    .eq('course_id', req.params.id)
    .eq('status', 'approved')
    .single();

  if (!payment) return res.status(403).json({ error: 'Must be enrolled' });

  await supabase.from('reviews').upsert({
    user_id: userId,
    course_id: parseInt(req.params.id),
    rating: parseInt(req.body.rating),
    comment: req.body.comment || '',
  }, { onConflict: 'user_id,course_id' });

  res.json({ success: true });
});

// --- Public Read ---
app.get('/api/roadmaps', async (req, res) => {
  const { data } = await supabase
    .from('roadmaps')
    .select('*')
    .order('order_index', { ascending: true });
  res.json(data || []);
});

app.get('/api/courses', async (req, res) => {
  let query = supabase.from('courses').select('*').eq('is_published', true);
  if (req.query.roadmap_id) query = query.eq('roadmap_id', req.query.roadmap_id);
  query = query.order('order_index', { ascending: true });
  const { data } = await query;
  res.json(data || []);
});

app.get('/api/courses/:id', async (req, res) => {
  const { data } = await supabase
    .from('courses')
    .select('*')
    .eq('id', req.params.id)
    .single();
  res.json(data);
});

app.get('/api/payment-methods', async (req, res) => {
  const { data } = await supabase.from('payment_methods').select('*');
  res.json(data || []);
});

app.get('/api/announcements', async (req, res) => {
  const { data } = await supabase
    .from('announcements')
    .select('*, courses(title)')
    .order('created_at', { ascending: false });
  res.json(data || []);
});

// --- Course Modules with Progress ---
app.get('/api/courses/:id/modules', async (req, res) => {
  let tgId = null;
  if (req.headers['x-telegram-init-data']) {
    try {
      tgId = JSON.parse(new URLSearchParams(req.headers['x-telegram-init-data']).get('user')).id;
    } catch (e) { /* ignore */ }
  }

  const { data: modules } = await supabase
    .from('modules')
    .select('*')
    .eq('course_id', req.params.id)
    .order('order_index', { ascending: true });

  const { data: lessons } = await supabase
    .from('lessons')
    .select('*')
    .in('module_id', (modules || []).map(m => m.id))
    .order('order_index', { ascending: true });

  let progressMap = {};
  if (tgId) {
    const { data: user } = await supabase
      .from('users').select('id').eq('telegram_id', tgId).single();
    if (user) {
      const { data: prog } = await supabase
        .from('progress')
        .select('lesson_id, completed')
        .eq('user_id', user.id);
      if (prog) prog.forEach(p => { progressMap[p.lesson_id] = p.completed; });
    }
  }

  const result = (modules || []).map(m => ({
    ...m,
    lessons: (lessons || [])
      .filter(l => l.module_id === m.id)
      .map(l => ({ ...l, completed: !!progressMap[l.id] })),
  }));

  res.json(result);
});

// --- Lesson Detail (requires enrollment) ---
app.get('/api/lessons/:id', parseTelegramUser, async (req, res) => {
  const { data: lesson } = await supabase
    .from('lessons')
    .select('*, modules(course_id)')
    .eq('id', req.params.id)
    .single();

  if (!lesson) return res.status(404).json({ error: 'Not found' });

  const userId = await ensureUser(req.telegramUser);
  const { data: payment } = await supabase
    .from('payments')
    .select('id')
    .eq('user_id', userId)
    .eq('course_id', lesson.modules.course_id)
    .eq('status', 'approved')
    .single();

  if (!payment) return res.status(403).json({ error: 'Payment required' });

  const { data: prog } = await supabase
    .from('progress')
    .select('completed')
    .eq('user_id', userId)
    .eq('lesson_id', lesson.id)
    .single();

  res.json({ ...lesson, course_id: lesson.modules.course_id, completed: prog?.completed || false });
});

// --- Bookmarks ---
app.get('/api/bookmarks', parseTelegramUser, async (req, res) => {
  const userId = await ensureUser(req.telegramUser);
  const { data } = await supabase
    .from('bookmarks')
    .select('course_id, courses(*)')
    .eq('user_id', userId);
  res.json((data || []).map(b => b.courses));
});

app.post('/api/bookmarks', parseTelegramUser, async (req, res) => {
  const userId = await ensureUser(req.telegramUser);
  await supabase.from('bookmarks').upsert({
    user_id: userId,
    course_id: req.body.course_id,
  }, { onConflict: 'user_id,course_id' });
  res.json({ success: true });
});

app.delete('/api/bookmarks/:courseId', parseTelegramUser, async (req, res) => {
  const userId = await ensureUser(req.telegramUser);
  await supabase.from('bookmarks')
    .delete()
    .eq('user_id', userId)
    .eq('course_id', req.params.courseId);
  res.json({ success: true });
});

// --- Progress ---
app.post('/api/progress', parseTelegramUser, async (req, res) => {
  const userId = await ensureUser(req.telegramUser);
  await supabase.from('progress').upsert({
    user_id: userId,
    lesson_id: req.body.lesson_id,
    completed: !!req.body.completed,
    completed_at: req.body.completed ? new Date().toISOString() : null,
  }, { onConflict: 'user_id,lesson_id' });
  res.json({ success: true });
});

// --- Payments ---
app.post('/api/payments', parseTelegramUser, upload.single('screenshot'), async (req, res) => {
  try {
    const userId = await ensureUser(req.telegramUser);
    if (!req.file) return res.status(400).json({ error: 'Screenshot required' });

    const fileName = `screenshots/${Date.now()}_${req.file.originalname}`;
    const { error: uploadError } = await supabase.storage
      .from('uploads')
      .upload(fileName, req.file.buffer, { contentType: req.file.mimetype });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return res.status(500).json({ error: 'Upload failed' });
    }

    const { data: urlData } = supabase.storage.from('uploads').getPublicUrl(fileName);
    const screenshotUrl = urlData.publicUrl;

    const { data: payment, error: insertError } = await supabase
      .from('payments')
      .insert({
        user_id: userId,
        course_id: parseInt(req.body.course_id),
        payment_method_id: parseInt(req.body.payment_method_id),
        screenshot_url: screenshotUrl,
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('Insert error:', insertError);
      return res.status(500).json({ error: 'Failed to save payment' });
    }

    const { data: course } = await supabase
      .from('courses').select('title').eq('id', req.body.course_id).single();

    bot.notifyAdminPayment(
      payment.id,
      req.telegramUser.first_name,
      course?.title || 'Unknown',
      screenshotUrl
    ).catch(console.error);

    res.json({ success: true });
  } catch (err) {
    console.error('Payment error:', err);
    res.status(500).json({ error: 'Payment processing failed' });
  }
});

app.get('/api/my-payments', parseTelegramUser, async (req, res) => {
  const userId = await ensureUser(req.telegramUser);
  const { data } = await supabase
    .from('payments')
    .select('*, courses(title)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  res.json(data || []);
});

app.get('/api/my-courses', parseTelegramUser, async (req, res) => {
  const userId = await ensureUser(req.telegramUser);
  const { data } = await supabase
    .from('payments')
    .select('course_id, courses(*)')
    .eq('user_id', userId)
    .eq('status', 'approved');
  res.json((data || []).map(p => p.courses));
});

// --- Admin Routes ---

app.get('/api/admin/stats', validateAdmin, async (req, res) => {
  const [users, courses, pendingPayments, totalPayments] = await Promise.all([
    supabase.from('users').select('id', { count: 'exact', head: true }),
    supabase.from('courses').select('id', { count: 'exact', head: true }),
    supabase.from('payments').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('payments').select('id', { count: 'exact', head: true }),
  ]);
  res.json({
    totalUsers: users.count || 0,
    totalCourses: courses.count || 0,
    pendingPayments: pendingPayments.count || 0,
    totalPayments: totalPayments.count || 0,
  });
});

app.get('/api/admin/users', validateAdmin, async (req, res) => {
  const { data } = await supabase.from('users').select('*').order('created_at', { ascending: false });
  res.json(data || []);
});

app.get('/api/admin/payments', validateAdmin, async (req, res) => {
  let query = supabase
    .from('payments')
    .select('*, users(first_name, username, telegram_id), courses(title), payment_methods(name)')
    .order('created_at', { ascending: false });

  if (req.query.status) query = query.eq('status', req.query.status);
  const { data } = await query;

  const formatted = (data || []).map(p => ({
    ...p,
    first_name: p.users?.first_name,
    username: p.users?.username,
    telegram_id: p.users?.telegram_id,
    course_title: p.courses?.title,
    payment_method_name: p.payment_methods?.name,
  }));
  res.json(formatted);
});

app.post('/api/admin/payments/:id/approve', validateAdmin, async (req, res) => {
  await supabase.from('payments')
    .update({ status: 'approved', admin_note: req.body.note || '' })
    .eq('id', req.params.id);

  const { data: payment } = await supabase
    .from('payments')
    .select('*, users(telegram_id), courses(title)')
    .eq('id', req.params.id)
    .single();

  if (payment) {
    bot.notifyUserApproval(
      payment.users.telegram_id,
      payment.course_id,
      payment.courses.title,
      req.body.note
    ).catch(console.error);
  }
  res.json({ success: true });
});

app.post('/api/admin/payments/:id/reject', validateAdmin, async (req, res) => {
  await supabase.from('payments')
    .update({ status: 'rejected', admin_note: req.body.note || '' })
    .eq('id', req.params.id);

  const { data: payment } = await supabase
    .from('payments')
    .select('*, users(telegram_id), courses(title)')
    .eq('id', req.params.id)
    .single();

  if (payment) {
    bot.notifyUserRejection(
      payment.users.telegram_id,
      payment.courses.title,
      req.body.note
    ).catch(console.error);
  }
  res.json({ success: true });
});

// --- Admin CRUD: Roadmaps ---
app.post('/api/admin/roadmaps', validateAdmin, async (req, res) => {
  await supabase.from('roadmaps').insert({
    title: req.body.title,
    description: req.body.description || '',
    icon: req.body.icon || '📚',
    color: req.body.color || '#3390ec',
    order_index: req.body.order_index || 0,
  });
  res.json({ success: true });
});

app.put('/api/admin/roadmaps/:id', validateAdmin, async (req, res) => {
  await supabase.from('roadmaps').update(req.body).eq('id', req.params.id);
  res.json({ success: true });
});

app.delete('/api/admin/roadmaps/:id', validateAdmin, async (req, res) => {
  await supabase.from('roadmaps').delete().eq('id', req.params.id);
  res.json({ success: true });
});

// --- Admin CRUD: Courses ---
app.post('/api/admin/courses', validateAdmin, async (req, res) => {
  await supabase.from('courses').insert({
    roadmap_id: req.body.roadmap_id || null,
    title: req.body.title,
    description: req.body.description || '',
    price_mmk: parseInt(req.body.price_mmk) || 0,
    telegram_group_id: req.body.telegram_group_id || null,
    difficulty: req.body.difficulty || 'beginner',
    duration_hours: req.body.duration_hours ? parseInt(req.body.duration_hours) : null,
    order_index: req.body.order_index || 0,
  });
  res.json({ success: true });
});

app.put('/api/admin/courses/:id', validateAdmin, async (req, res) => {
  await supabase.from('courses').update(req.body).eq('id', req.params.id);
  res.json({ success: true });
});

app.delete('/api/admin/courses/:id', validateAdmin, async (req, res) => {
  await supabase.from('courses').delete().eq('id', req.params.id);
  res.json({ success: true });
});

// --- Admin CRUD: Modules ---
app.post('/api/admin/modules', validateAdmin, async (req, res) => {
  await supabase.from('modules').insert({
    course_id: parseInt(req.body.course_id),
    title: req.body.title,
    order_index: req.body.order_index || 0,
  });
  res.json({ success: true });
});

app.delete('/api/admin/modules/:id', validateAdmin, async (req, res) => {
  await supabase.from('modules').delete().eq('id', req.params.id);
  res.json({ success: true });
});

// --- Admin CRUD: Lessons ---
app.post('/api/admin/lessons', validateAdmin, async (req, res) => {
  await supabase.from('lessons').insert({
    module_id: parseInt(req.body.module_id),
    title: req.body.title,
    content: req.body.content || '',
    video_url: req.body.video_url || null,
    file_url: req.body.file_url || null,
    order_index: req.body.order_index || 0,
  });
  res.json({ success: true });
});

app.put('/api/admin/lessons/:id', validateAdmin, async (req, res) => {
  await supabase.from('lessons').update(req.body).eq('id', req.params.id);
  res.json({ success: true });
});

app.delete('/api/admin/lessons/:id', validateAdmin, async (req, res) => {
  await supabase.from('lessons').delete().eq('id', req.params.id);
  res.json({ success: true });
});

// --- Admin CRUD: Announcements ---
app.post('/api/admin/announcements', validateAdmin, async (req, res) => {
  await supabase.from('announcements').insert({
    course_id: req.body.course_id ? parseInt(req.body.course_id) : null,
    title: req.body.title,
    content: req.body.content,
  });
  res.json({ success: true });
});

app.delete('/api/admin/announcements/:id', validateAdmin, async (req, res) => {
  await supabase.from('announcements').delete().eq('id', req.params.id);
  res.json({ success: true });
});

// --- Admin CRUD: Payment Methods ---
app.post('/api/admin/payment-methods', validateAdmin, upload.single('qr_image'), async (req, res) => {
  let qrImageUrl = null;
  if (req.file) {
    const fileName = `qr/${Date.now()}_${req.file.originalname}`;
    await supabase.storage.from('uploads').upload(fileName, req.file.buffer, { contentType: req.file.mimetype });
    const { data: urlData } = supabase.storage.from('uploads').getPublicUrl(fileName);
    qrImageUrl = urlData.publicUrl;
  }

  await supabase.from('payment_methods').insert({
    name: req.body.name,
    account_name: req.body.account_name || '',
    account_number: req.body.account_number || '',
    qr_image_url: qrImageUrl,
    instructions: req.body.instructions || '',
  });
  res.json({ success: true });
});

app.delete('/api/admin/payment-methods/:id', validateAdmin, async (req, res) => {
  await supabase.from('payment_methods').delete().eq('id', req.params.id);
  res.json({ success: true });
});

// Vercel handler
const handler = (req, res) => app(req, res);
handler.config = { api: { bodyParser: false } };
module.exports = handler;
