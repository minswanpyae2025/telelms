const express = require('express');
const crypto = require('crypto');
const multer = require('multer');
const supabase = require('../lib/supabase');
const bot = require('../lib/bot');
const np = require('../lib/nowpayments');

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
  } catch (err) { res.status(400).json({ error: 'Invalid initData' }); }
}

function validateAdmin(req, res, next) {
  if (req.headers['x-admin-password'] === (process.env.ADMIN_PASSWORD || 'admin123')) return next();
  res.status(401).json({ error: 'Unauthorized' });
}

async function ensureUser(tgUser) {
  const { data: existing } = await supabase.from('users').select('id').eq('telegram_id', tgUser.id).single();
  if (existing) return existing.id;
  const { data: inserted } = await supabase.from('users')
    .upsert({ telegram_id: tgUser.id, first_name: tgUser.first_name, last_name: tgUser.last_name || null, username: tgUser.username || null }, { onConflict: 'telegram_id' })
    .select('id').single();
  return inserted ? inserted.id : null;
}

// --- Health ---
app.get('/api/health', (req, res) => res.json({ status: 'ok', app: 'Lann Sa LMS', timestamp: new Date().toISOString() }));

// --- Bot Webhook ---
app.post('/api/bot/webhook', async (req, res) => {
  try { await bot.handleWebhook(req.body); } catch (err) { console.error('Webhook error:', err); }
  res.json({ ok: true });
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
  const { data: courses } = await supabase.from('courses').select('*').or(`title.ilike.%${q}%,description.ilike.%${q}%`).eq('is_published', true);
  const { data: lessons } = await supabase.from('lessons').select('id, title, module_id, modules(course_id, courses(id, title))').ilike('title', `%${q}%`);
  const fmtLessons = (lessons || []).map(l => ({ id: l.id, title: l.title, course_id: l.modules?.courses?.id, course_title: l.modules?.courses?.title }));
  res.json({ courses: courses || [], lessons: fmtLessons });
});

// --- Reviews ---
app.get('/api/courses/:id/reviews', async (req, res) => {
  const { data } = await supabase.from('reviews').select('*, users(first_name, username)').eq('course_id', req.params.id).order('created_at', { ascending: false });
  res.json((data || []).map(r => ({ ...r, first_name: r.users?.first_name, username: r.users?.username })));
});

app.post('/api/courses/:id/reviews', parseTelegramUser, async (req, res) => {
  const userId = await ensureUser(req.telegramUser);
  const { data: p } = await supabase.from('payments').select('id').eq('user_id', userId).eq('course_id', req.params.id).eq('status', 'approved').single();
  const { data: cp } = !p ? await supabase.from('crypto_payments').select('id').eq('user_id', userId).eq('course_id', req.params.id).eq('status', 'finished').single() : { data: null };
  if (!p && !cp) return res.status(403).json({ error: 'Must be enrolled' });
  await supabase.from('reviews').upsert({ user_id: userId, course_id: parseInt(req.params.id), rating: parseInt(req.body.rating), comment: req.body.comment || '' }, { onConflict: 'user_id,course_id' });
  res.json({ success: true });
});

// --- Public Read ---
app.get('/api/roadmaps', async (req, res) => {
  const { data } = await supabase.from('roadmaps').select('*').order('order_index', { ascending: true });
  res.json(data || []);
});

app.get('/api/courses', async (req, res) => {
  let q = supabase.from('courses').select('*').eq('is_published', true);
  if (req.query.roadmap_id) q = q.eq('roadmap_id', req.query.roadmap_id);
  q = q.order('order_index', { ascending: true });
  const { data } = await q;
  res.json(data || []);
});

app.get('/api/courses/:id', async (req, res) => {
  const { data } = await supabase.from('courses').select('*').eq('id', req.params.id).single();
  res.json(data);
});

app.get('/api/payment-methods', async (req, res) => {
  const { data } = await supabase.from('payment_methods').select('*');
  res.json(data || []);
});

app.get('/api/announcements', async (req, res) => {
  const { data } = await supabase.from('announcements').select('*, courses(title)').order('created_at', { ascending: false });
  res.json(data || []);
});

// --- Course Modules with Progress ---
app.get('/api/courses/:id/modules', async (req, res) => {
  let tgId = null;
  if (req.headers['x-telegram-init-data']) {
    try { tgId = JSON.parse(new URLSearchParams(req.headers['x-telegram-init-data']).get('user')).id; } catch (e) {}
  }
  const { data: modules } = await supabase.from('modules').select('*').eq('course_id', req.params.id).order('order_index', { ascending: true });
  const modIds = (modules || []).map(m => m.id);
  const { data: lessons } = modIds.length > 0
    ? await supabase.from('lessons').select('*').in('module_id', modIds).order('order_index', { ascending: true })
    : { data: [] };
  let progressMap = {};
  if (tgId) {
    const { data: user } = await supabase.from('users').select('id').eq('telegram_id', tgId).single();
    if (user) {
      const { data: prog } = await supabase.from('progress').select('lesson_id, completed').eq('user_id', user.id);
      if (prog) prog.forEach(p => { progressMap[p.lesson_id] = p.completed; });
    }
  }
  res.json((modules || []).map(m => ({
    ...m,
    lessons: (lessons || []).filter(l => l.module_id === m.id).map(l => ({ ...l, completed: !!progressMap[l.id] })),
  })));
});

// --- Lesson Detail ---
app.get('/api/lessons/:id', parseTelegramUser, async (req, res) => {
  const { data: lesson } = await supabase.from('lessons').select('*, modules(course_id)').eq('id', req.params.id).single();
  if (!lesson) return res.status(404).json({ error: 'Not found' });
  const userId = await ensureUser(req.telegramUser);
  const { data: pay } = await supabase.from('payments').select('id').eq('user_id', userId).eq('course_id', lesson.modules.course_id).eq('status', 'approved').single();
  const { data: cpay } = !pay ? await supabase.from('crypto_payments').select('id').eq('user_id', userId).eq('course_id', lesson.modules.course_id).eq('status', 'finished').single() : { data: null };
  if (!pay && !cpay) return res.status(403).json({ error: 'Payment required' });
  const { data: prog } = await supabase.from('progress').select('completed').eq('user_id', userId).eq('lesson_id', lesson.id).single();
  res.json({ ...lesson, course_id: lesson.modules.course_id, completed: prog?.completed || false });
});

// --- Bookmarks ---
app.get('/api/bookmarks', parseTelegramUser, async (req, res) => {
  const userId = await ensureUser(req.telegramUser);
  const { data } = await supabase.from('bookmarks').select('course_id, courses(*)').eq('user_id', userId);
  res.json((data || []).map(b => b.courses));
});

app.post('/api/bookmarks', parseTelegramUser, async (req, res) => {
  const userId = await ensureUser(req.telegramUser);
  await supabase.from('bookmarks').upsert({ user_id: userId, course_id: req.body.course_id }, { onConflict: 'user_id,course_id' });
  res.json({ success: true });
});

app.delete('/api/bookmarks/:courseId', parseTelegramUser, async (req, res) => {
  const userId = await ensureUser(req.telegramUser);
  await supabase.from('bookmarks').delete().eq('user_id', userId).eq('course_id', req.params.courseId);
  res.json({ success: true });
});

// --- Progress ---
app.post('/api/progress', parseTelegramUser, async (req, res) => {
  const userId = await ensureUser(req.telegramUser);
  await supabase.from('progress').upsert({
    user_id: userId, lesson_id: req.body.lesson_id,
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
    const { error: upErr } = await supabase.storage.from('uploads').upload(fileName, req.file.buffer, { contentType: req.file.mimetype });
    if (upErr) return res.status(500).json({ error: 'Upload failed' });
    const { data: urlData } = supabase.storage.from('uploads').getPublicUrl(fileName);
    const screenshotUrl = urlData.publicUrl;
    const { data: payment, error: insErr } = await supabase.from('payments')
      .insert({ user_id: userId, course_id: parseInt(req.body.course_id), payment_method_id: parseInt(req.body.payment_method_id), screenshot_url: screenshotUrl })
      .select('id').single();
    if (insErr) return res.status(500).json({ error: 'Failed to save payment' });
    const { data: course } = await supabase.from('courses').select('title').eq('id', req.body.course_id).single();
    bot.notifyAdminPayment(payment.id, req.telegramUser.first_name, course?.title || '', screenshotUrl).catch(console.error);
    res.json({ success: true });
  } catch (err) { console.error('Payment error:', err); res.status(500).json({ error: 'Payment failed' }); }
});

app.get('/api/my-payments', parseTelegramUser, async (req, res) => {
  const userId = await ensureUser(req.telegramUser);
  const { data } = await supabase.from('payments').select('*, courses(title)').eq('user_id', userId).order('created_at', { ascending: false });
  res.json(data || []);
});

app.get('/api/my-courses', parseTelegramUser, async (req, res) => {
  const userId = await ensureUser(req.telegramUser);
  const { data } = await supabase.from('payments').select('course_id, courses(*)').eq('user_id', userId).eq('status', 'approved');
  const { data: cryptoData } = await supabase.from('crypto_payments').select('course_id, courses(*)').eq('user_id', userId).eq('status', 'finished');
  const manualCourses = (data || []).map(p => p.courses);
  const cryptoCourses = (cryptoData || []).map(p => p.courses);
  const seen = new Set();
  const all = [...manualCourses, ...cryptoCourses].filter(c => c && !seen.has(c.id) && seen.add(c.id));
  res.json(all);
});

// --- Quizzes ---
app.get('/api/quizzes/lesson/:lessonId', parseTelegramUser, async (req, res) => {
  const { data: quiz } = await supabase.from('quizzes').select('*').eq('lesson_id', req.params.lessonId).single();
  if (!quiz) return res.json(null);
  const { data: questions } = await supabase.from('quiz_questions').select('id, question, option_a, option_b, option_c, option_d, order_index').eq('quiz_id', quiz.id).order('order_index', { ascending: true });
  const userId = await ensureUser(req.telegramUser);
  const { data: attempts } = await supabase.from('quiz_attempts').select('*').eq('user_id', userId).eq('quiz_id', quiz.id).order('created_at', { ascending: false }).limit(1);
  res.json({ ...quiz, questions: questions || [], lastAttempt: attempts && attempts.length > 0 ? attempts[0] : null });
});

app.post('/api/quizzes/:quizId/submit', parseTelegramUser, async (req, res) => {
  const userId = await ensureUser(req.telegramUser);
  const { data: questions } = await supabase.from('quiz_questions').select('*').eq('quiz_id', req.params.quizId);
  const { data: quiz } = await supabase.from('quizzes').select('passing_score').eq('id', req.params.quizId).single();
  if (!questions || !quiz) return res.status(404).json({ error: 'Quiz not found' });
  const answers = req.body.answers || {};
  let correct = 0;
  questions.forEach(q => { if (answers[q.id] === q.correct_answer) correct++; });
  const score = Math.round((correct / questions.length) * 100);
  const passed = score >= (quiz.passing_score || 70);
  await supabase.from('quiz_attempts').insert({ user_id: userId, quiz_id: parseInt(req.params.quizId), score, total: questions.length, passed, answers });
  res.json({ score, total: questions.length, correct, passed });
});

// --- Certificates ---
app.get('/api/certificates/course/:courseId', parseTelegramUser, async (req, res) => {
  const userId = await ensureUser(req.telegramUser);
  const { data: cert } = await supabase.from('certificates').select('*').eq('user_id', userId).eq('course_id', req.params.courseId).single();
  res.json(cert || null);
});

app.post('/api/certificates/generate/:courseId', parseTelegramUser, async (req, res) => {
  const userId = await ensureUser(req.telegramUser);
  const courseId = parseInt(req.params.courseId);
  const { data: existing } = await supabase.from('certificates').select('*').eq('user_id', userId).eq('course_id', courseId).single();
  if (existing) return res.json(existing);

  const { data: modules } = await supabase.from('modules').select('id').eq('course_id', courseId);
  const modIds = (modules || []).map(m => m.id);
  if (modIds.length === 0) return res.status(400).json({ error: 'No content' });
  const { data: lessons } = await supabase.from('lessons').select('id').in('module_id', modIds);
  const lessonIds = (lessons || []).map(l => l.id);
  if (lessonIds.length === 0) return res.status(400).json({ error: 'No lessons' });
  const { data: progress } = await supabase.from('progress').select('lesson_id').eq('user_id', userId).eq('completed', true).in('lesson_id', lessonIds);
  if (!progress || progress.length < lessonIds.length) return res.status(400).json({ error: 'Not all lessons completed' });

  const certNumber = 'LS-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
  const { data: cert } = await supabase.from('certificates')
    .insert({ user_id: userId, course_id: courseId, certificate_number: certNumber })
    .select('*').single();
  res.json(cert);
});

app.get('/api/certificates/verify/:certNumber', async (req, res) => {
  const { data } = await supabase.from('certificates').select('*, users(first_name, last_name), courses(title)').eq('certificate_number', req.params.certNumber).single();
  if (!data) return res.status(404).json({ error: 'Certificate not found' });
  res.json({ certificate_number: data.certificate_number, student: [data.users?.first_name, data.users?.last_name].filter(Boolean).join(' '), course: data.courses?.title, issued_at: data.issued_at });
});

// --- Discussions ---
app.get('/api/courses/:id/discussions', async (req, res) => {
  const { data } = await supabase.from('discussions').select('*, users(first_name, username)').eq('course_id', req.params.id).order('created_at', { ascending: false }).limit(50);
  res.json((data || []).map(d => ({ ...d, first_name: d.users?.first_name, username: d.users?.username })));
});

app.post('/api/courses/:id/discussions', parseTelegramUser, async (req, res) => {
  const userId = await ensureUser(req.telegramUser);
  const { data: pay } = await supabase.from('payments').select('id').eq('user_id', userId).eq('course_id', req.params.id).eq('status', 'approved').single();
  const { data: cpay } = !pay ? await supabase.from('crypto_payments').select('id').eq('user_id', userId).eq('course_id', req.params.id).eq('status', 'finished').single() : { data: null };
  if (!pay && !cpay) return res.status(403).json({ error: 'Must be enrolled' });
  await supabase.from('discussions').insert({ course_id: parseInt(req.params.id), user_id: userId, message: req.body.message });
  res.json({ success: true });
});

// ========== ADMIN ROUTES ==========

app.get('/api/admin/stats', validateAdmin, async (req, res) => {
  const [users, courses, pending, total, approved] = await Promise.all([
    supabase.from('users').select('id', { count: 'exact', head: true }),
    supabase.from('courses').select('id', { count: 'exact', head: true }),
    supabase.from('payments').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('payments').select('id', { count: 'exact', head: true }),
    supabase.from('payments').select('course_id, courses(price_mmk)').eq('status', 'approved'),
  ]);
  const revenue = (approved.data || []).reduce((sum, p) => sum + (p.courses?.price_mmk || 0), 0);
  res.json({
    totalUsers: users.count || 0, totalCourses: courses.count || 0,
    pendingPayments: pending.count || 0, totalPayments: total.count || 0,
    totalRevenue: revenue, approvedEnrollments: (approved.data || []).length,
  });
});

app.get('/api/admin/analytics', validateAdmin, async (req, res) => {
  const { data: payments } = await supabase.from('payments').select('status, created_at, courses(price_mmk, title)').eq('status', 'approved').order('created_at', { ascending: true });
  const { data: users } = await supabase.from('users').select('created_at').order('created_at', { ascending: true });
  const monthlyRevenue = {};
  const monthlyEnrollments = {};
  const courseRevenue = {};
  (payments || []).forEach(p => {
    const month = p.created_at.substring(0, 7);
    monthlyRevenue[month] = (monthlyRevenue[month] || 0) + (p.courses?.price_mmk || 0);
    monthlyEnrollments[month] = (monthlyEnrollments[month] || 0) + 1;
    const ct = p.courses?.title || 'Unknown';
    courseRevenue[ct] = (courseRevenue[ct] || 0) + (p.courses?.price_mmk || 0);
  });
  const monthlyUsers = {};
  (users || []).forEach(u => { const m = u.created_at.substring(0, 7); monthlyUsers[m] = (monthlyUsers[m] || 0) + 1; });
  res.json({ monthlyRevenue, monthlyEnrollments, monthlyUsers, courseRevenue });
});

app.get('/api/admin/users', validateAdmin, async (req, res) => {
  const { data } = await supabase.from('users').select('*').order('created_at', { ascending: false });
  res.json(data || []);
});

app.get('/api/admin/payments', validateAdmin, async (req, res) => {
  let q = supabase.from('payments').select('*, users(first_name, username, telegram_id), courses(title, price_mmk), payment_methods(name)').order('created_at', { ascending: false });
  if (req.query.status) q = q.eq('status', req.query.status);
  const { data } = await q;
  res.json((data || []).map(p => ({
    ...p, first_name: p.users?.first_name, username: p.users?.username, telegram_id: p.users?.telegram_id,
    course_title: p.courses?.title, price_mmk: p.courses?.price_mmk, payment_method_name: p.payment_methods?.name,
  })));
});

app.post('/api/admin/payments/:id/approve', validateAdmin, async (req, res) => {
  await supabase.from('payments').update({ status: 'approved', admin_note: req.body.note || '' }).eq('id', req.params.id);
  const { data: pay } = await supabase.from('payments').select('*, users(telegram_id), courses(title)').eq('id', req.params.id).single();
  if (pay) bot.notifyUserApproval(pay.users.telegram_id, pay.course_id, pay.courses.title, req.body.note).catch(console.error);
  res.json({ success: true });
});

app.post('/api/admin/payments/:id/reject', validateAdmin, async (req, res) => {
  await supabase.from('payments').update({ status: 'rejected', admin_note: req.body.note || '' }).eq('id', req.params.id);
  const { data: pay } = await supabase.from('payments').select('*, users(telegram_id), courses(title)').eq('id', req.params.id).single();
  if (pay) bot.notifyUserRejection(pay.users.telegram_id, pay.course_id, pay.courses.title, req.body.note).catch(console.error);
  res.json({ success: true });
});

app.post('/api/admin/payments/bulk-approve', validateAdmin, async (req, res) => {
  const ids = req.body.ids || [];
  if (ids.length === 0) return res.status(400).json({ error: 'No IDs' });
  for (const id of ids) {
    await supabase.from('payments').update({ status: 'approved', admin_note: req.body.note || 'Bulk approved' }).eq('id', id);
    const { data: pay } = await supabase.from('payments').select('*, users(telegram_id), courses(title)').eq('id', id).single();
    if (pay) bot.notifyUserApproval(pay.users.telegram_id, pay.course_id, pay.courses.title, req.body.note || 'Bulk approved').catch(console.error);
  }
  res.json({ success: true, count: ids.length });
});

// --- CSV Export ---
app.get('/api/admin/export/:type', validateAdmin, async (req, res) => {
  const type = req.params.type;
  let csv = '';
  if (type === 'users') {
    const { data } = await supabase.from('users').select('*').order('created_at', { ascending: false });
    csv = 'ID,Telegram ID,First Name,Last Name,Username,Joined\n';
    (data || []).forEach(u => { csv += `${u.id},${u.telegram_id},"${u.first_name || ''}","${u.last_name || ''}","${u.username || ''}",${u.created_at}\n`; });
  } else if (type === 'payments') {
    const { data } = await supabase.from('payments').select('*, users(first_name, username), courses(title, price_mmk), payment_methods(name)').order('created_at', { ascending: false });
    csv = 'ID,User,Course,Amount (MMK),Payment Method,Status,Date,Admin Note\n';
    (data || []).forEach(p => { csv += `${p.id},"${p.users?.first_name || ''}","${p.courses?.title || ''}",${p.courses?.price_mmk || 0},"${p.payment_methods?.name || ''}",${p.status},${p.created_at},"${p.admin_note || ''}"\n`; });
  } else if (type === 'courses') {
    const { data } = await supabase.from('courses').select('*, roadmaps(title)').order('id');
    csv = 'ID,Title,Roadmap,Price (MMK),Difficulty,Duration,Published\n';
    (data || []).forEach(c => { csv += `${c.id},"${c.title}","${c.roadmaps?.title || ''}",${c.price_mmk},${c.difficulty},${c.duration_hours || ''},${c.is_published}\n`; });
  } else {
    return res.status(400).json({ error: 'Invalid type' });
  }
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename=${type}_${Date.now()}.csv`);
  res.send(csv);
});

// --- Admin CRUD: Roadmaps ---
app.post('/api/admin/roadmaps', validateAdmin, async (req, res) => {
  await supabase.from('roadmaps').insert({ title: req.body.title, description: req.body.description || '', icon: req.body.icon || '📚', color: req.body.color || '#3390ec', order_index: req.body.order_index || 0 });
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
    roadmap_id: req.body.roadmap_id || null, title: req.body.title, description: req.body.description || '',
    price_mmk: parseInt(req.body.price_mmk) || 0, price_usdt: req.body.price_usdt != null ? parseFloat(req.body.price_usdt) : null,
    telegram_group_id: req.body.telegram_group_id || null,
    difficulty: req.body.difficulty || 'beginner', duration_hours: req.body.duration_hours ? parseInt(req.body.duration_hours) : null, order_index: req.body.order_index || 0,
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
  await supabase.from('modules').insert({ course_id: parseInt(req.body.course_id), title: req.body.title, order_index: req.body.order_index || 0 });
  res.json({ success: true });
});
app.delete('/api/admin/modules/:id', validateAdmin, async (req, res) => {
  await supabase.from('modules').delete().eq('id', req.params.id);
  res.json({ success: true });
});

// --- Admin CRUD: Lessons ---
app.post('/api/admin/lessons', validateAdmin, async (req, res) => {
  await supabase.from('lessons').insert({ module_id: parseInt(req.body.module_id), title: req.body.title, content: req.body.content || '', video_url: req.body.video_url || null, file_url: req.body.file_url || null, order_index: req.body.order_index || 0 });
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
  await supabase.from('announcements').insert({ course_id: req.body.course_id ? parseInt(req.body.course_id) : null, title: req.body.title, content: req.body.content });
  res.json({ success: true });
});
app.delete('/api/admin/announcements/:id', validateAdmin, async (req, res) => {
  await supabase.from('announcements').delete().eq('id', req.params.id);
  res.json({ success: true });
});

// --- Admin CRUD: Payment Methods ---
app.post('/api/admin/payment-methods', validateAdmin, upload.single('qr_image'), async (req, res) => {
  let qrUrl = null;
  if (req.file) {
    const fn = `qr/${Date.now()}_${req.file.originalname}`;
    await supabase.storage.from('uploads').upload(fn, req.file.buffer, { contentType: req.file.mimetype });
    const { data: u } = supabase.storage.from('uploads').getPublicUrl(fn);
    qrUrl = u.publicUrl;
  }
  await supabase.from('payment_methods').insert({ name: req.body.name, account_name: req.body.account_name || '', account_number: req.body.account_number || '', qr_image_url: qrUrl, instructions: req.body.instructions || '' });
  res.json({ success: true });
});
app.delete('/api/admin/payment-methods/:id', validateAdmin, async (req, res) => {
  await supabase.from('payment_methods').delete().eq('id', req.params.id);
  res.json({ success: true });
});

// --- Admin: Quizzes ---
app.post('/api/admin/quizzes', validateAdmin, async (req, res) => {
  const { data: quiz } = await supabase.from('quizzes').insert({ lesson_id: parseInt(req.body.lesson_id), title: req.body.title, passing_score: parseInt(req.body.passing_score) || 70 }).select('id').single();
  if (req.body.questions && Array.isArray(req.body.questions)) {
    for (let i = 0; i < req.body.questions.length; i++) {
      const q = req.body.questions[i];
      await supabase.from('quiz_questions').insert({ quiz_id: quiz.id, question: q.question, option_a: q.option_a, option_b: q.option_b, option_c: q.option_c || null, option_d: q.option_d || null, correct_answer: q.correct_answer, order_index: i });
    }
  }
  res.json({ success: true, quiz_id: quiz.id });
});
app.delete('/api/admin/quizzes/:id', validateAdmin, async (req, res) => {
  await supabase.from('quizzes').delete().eq('id', req.params.id);
  res.json({ success: true });
});

// ========== APP SETTINGS ==========

app.get('/api/settings', async (req, res) => {
  const { data } = await supabase.from('app_settings').select('*');
  const settings = {};
  (data || []).forEach(row => { settings[row.key] = row.value; });
  res.json(settings);
});

app.get('/api/admin/settings', validateAdmin, async (req, res) => {
  const { data } = await supabase.from('app_settings').select('*');
  const settings = {};
  (data || []).forEach(row => { settings[row.key] = row.value; });
  res.json(settings);
});

app.put('/api/admin/settings', validateAdmin, async (req, res) => {
  const updates = req.body;
  for (const [key, value] of Object.entries(updates)) {
    await supabase.from('app_settings').upsert({ key, value: String(value) }, { onConflict: 'key' });
  }
  res.json({ success: true });
});

// ========== CRYPTO PAYMENTS (NOWPayments) ==========

app.get('/api/crypto/currencies', parseTelegramUser, async (req, res) => {
  const { data: setting } = await supabase.from('app_settings').select('value').eq('key', 'nowpayments_api_key').single();
  const apiKey = setting?.value;
  if (!apiKey) return res.json({ currencies: [] });
  try {
    const result = await np.getAvailableCurrencies(apiKey);
    const { data: acceptedSetting } = await supabase.from('app_settings').select('value').eq('key', 'nowpayments_accepted_coins').single();
    const accepted = (acceptedSetting?.value || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    const filtered = (result.currencies || []).filter(c => accepted.includes(c.toLowerCase()));
    res.json({ currencies: filtered });
  } catch (err) { res.json({ currencies: [] }); }
});

app.get('/api/crypto/estimate', parseTelegramUser, async (req, res) => {
  const { data: setting } = await supabase.from('app_settings').select('value').eq('key', 'nowpayments_api_key').single();
  const apiKey = setting?.value;
  if (!apiKey) return res.status(400).json({ error: 'Crypto not configured' });
  try {
    const result = await np.getEstimatePrice(apiKey, req.query.amount, req.query.currency_from || 'usd', req.query.currency_to);
    res.json(result);
  } catch (err) { res.status(500).json({ error: 'Estimate failed' }); }
});

app.post('/api/crypto/create-payment', parseTelegramUser, async (req, res) => {
  try {
    const userId = await ensureUser(req.telegramUser);
    const courseId = parseInt(req.body.course_id);
    const payCurrency = req.body.pay_currency;

    const { data: setting } = await supabase.from('app_settings').select('value').eq('key', 'nowpayments_api_key').single();
    const apiKey = setting?.value;
    if (!apiKey) return res.status(400).json({ error: 'Crypto not configured' });

    const { data: course } = await supabase.from('courses').select('title, price_mmk, price_usdt').eq('id', courseId).single();
    if (!course) return res.status(404).json({ error: 'Course not found' });

    const priceUsd = course.price_usdt ? parseFloat(course.price_usdt) : Math.max(course.price_mmk / 3500, 0.5);
    const appUrl = process.env.WEB_APP_URL || '';
    const ipnUrl = `${appUrl}/api/crypto/ipn`;

    const payment = await np.createPayment(apiKey, {
      priceAmount: parseFloat(priceUsd.toFixed(2)),
      priceCurrency: 'usd',
      payCurrency,
      orderId: `${userId}_${courseId}_${Date.now()}`,
      orderDescription: course.title,
      ipnCallbackUrl: ipnUrl,
    });

    if (payment.id) {
      await supabase.from('crypto_payments').insert({
        user_id: userId,
        course_id: courseId,
        nowpayments_id: payment.id,
        pay_address: payment.pay_address,
        pay_amount: payment.pay_amount,
        pay_currency: payment.pay_currency,
        price_amount: payment.price_amount,
        price_currency: payment.price_currency,
        status: payment.payment_status || 'waiting',
      });
    }

    res.json({
      payment_id: payment.id,
      pay_address: payment.pay_address,
      pay_amount: payment.pay_amount,
      pay_currency: payment.pay_currency,
      price_amount: payment.price_amount,
      expiration_estimate_date: payment.expiration_estimate_date,
      status: payment.payment_status || 'waiting',
    });
  } catch (err) {
    console.error('Crypto payment error:', err);
    res.status(500).json({ error: 'Failed to create payment' });
  }
});

app.get('/api/crypto/status/:paymentId', parseTelegramUser, async (req, res) => {
  const { data: setting } = await supabase.from('app_settings').select('value').eq('key', 'nowpayments_api_key').single();
  const apiKey = setting?.value;
  if (!apiKey) return res.status(400).json({ error: 'Crypto not configured' });
  try {
    const status = await np.getPaymentStatus(apiKey, req.params.paymentId);
    if (status.payment_id) {
      await supabase.from('crypto_payments')
        .update({ status: status.payment_status, actually_paid: status.actually_paid || 0, outcome_amount: status.outcome_amount || 0, updated_at: new Date().toISOString() })
        .eq('nowpayments_id', status.payment_id);
    }
    res.json(status);
  } catch (err) { res.status(500).json({ error: 'Status check failed' }); }
});

app.post('/api/crypto/ipn', async (req, res) => {
  try {
    const { data: secretSetting } = await supabase.from('app_settings').select('value').eq('key', 'nowpayments_ipn_secret').single();
    const ipnSecret = secretSetting?.value;
    const signature = req.headers['x-nowpayments-sig'];

    if (ipnSecret && signature) {
      const valid = np.verifyIPN(ipnSecret, req.body, signature);
      if (!valid) return res.status(400).json({ error: 'Invalid signature' });
    }

    const { payment_id, payment_status, actually_paid, outcome_amount, pay_currency, order_id } = req.body;
    if (payment_id) {
      await supabase.from('crypto_payments')
        .update({ status: payment_status, actually_paid: actually_paid || 0, outcome_amount: outcome_amount || 0, updated_at: new Date().toISOString() })
        .eq('nowpayments_id', payment_id);

      if (payment_status === 'finished') {
        const { data: cp } = await supabase.from('crypto_payments').select('user_id, course_id, pay_amount, pay_currency, users(first_name, telegram_id), courses(title)').eq('nowpayments_id', payment_id).single();
        if (cp) {
          bot.notifyAdminCryptoPayment(cp.users?.first_name || 'User', cp.courses?.title || '', `${cp.pay_amount} ${(cp.pay_currency || '').toUpperCase()}`, cp.pay_currency || '').catch(console.error);
          if (cp.users?.telegram_id) {
            bot.notifyUserCryptoSuccess(cp.users.telegram_id, cp.course_id, cp.courses?.title || '').catch(console.error);
          }
        }
      }
    }
    res.json({ ok: true });
  } catch (err) { console.error('IPN error:', err); res.json({ ok: true }); }
});

app.get('/api/my-crypto-payments', parseTelegramUser, async (req, res) => {
  const userId = await ensureUser(req.telegramUser);
  const { data } = await supabase.from('crypto_payments').select('*, courses(title)').eq('user_id', userId).order('created_at', { ascending: false });
  res.json(data || []);
});

// --- Admin: Crypto Payments ---
app.get('/api/admin/crypto-payments', validateAdmin, async (req, res) => {
  const { data } = await supabase.from('crypto_payments')
    .select('*, users(first_name, username, telegram_id), courses(title, price_mmk)')
    .order('created_at', { ascending: false });
  res.json((data || []).map(p => ({
    ...p, first_name: p.users?.first_name, username: p.users?.username,
    course_title: p.courses?.title, price_mmk: p.courses?.price_mmk,
  })));
});

// Vercel handler
const handler = (req, res) => app(req, res);
handler.config = { api: { bodyParser: false } };
module.exports = handler;
