const express = require('express');
const crypto = require('crypto');
const multer = require('multer');
const supabase = require('../lib/supabase');
const bot = require('../lib/bot');
const np = require('../lib/nowpayments');

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
const ADMIN_LOGIN_WINDOW_MS = 15 * 60 * 1000;
const ADMIN_LOGIN_MAX_FAILURES = 10;
const ADMIN_SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const TELEGRAM_INIT_DATA_MAX_AGE_SECONDS = 24 * 60 * 60;
const PUBLIC_SETTING_KEYS = new Set([
  'language', 'myanmar_payment_enabled', 'crypto_payment_enabled', 'nowpayments_accepted_coins',
  'maintenance_mode', 'maintenance_message', 'bot_username', 'telegram_start_url',
  'telegram_only_mode', 'auto_ban_missing_init_data', 'auto_ban_threshold',
  'security_contact_message', 'support_url', 'certificate_logo_url', 'certificate_signature_text'
]);
const ADMIN_SETTING_KEYS = new Set([
  ...PUBLIC_SETTING_KEYS, 'nowpayments_api_key', 'nowpayments_ipn_secret',
  'payment_screenshot_bucket', 'payment_screenshot_private', 'qr_public_bucket'
]);
const IMAGE_MAGIC_TYPES = {
  png: { mime: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  jpg: { mime: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
  webp: { mime: 'image/webp' },
};
const adminFailures = new Map();
const adminSessions = new Map();
const rateBuckets = new Map();

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://telegram.org",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net data:",
    "img-src 'self' data: blob: https:",
    "connect-src 'self' https://*.supabase.co https://api.telegram.org https://api.nowpayments.io",
    "frame-src https://www.youtube.com https://youtube.com https://*.youtube.com",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'self' https://web.telegram.org https://*.telegram.org"
  ].join('; '));
  next();
});

// --- Auth / Security Helpers ---
function timingSafeEqualString(a, b, encoding = 'utf8') {
  const aBuf = Buffer.from(String(a || ''), encoding);
  const bBuf = Buffer.from(String(b || ''), encoding);
  return aBuf.length === bBuf.length && crypto.timingSafeEqual(aBuf, bBuf);
}

function verifyTelegramInitData(initDataRaw) {
  const botToken = process.env.BOT_TOKEN;
  if (!botToken) return { ok: false, status: 500, error: 'BOT_TOKEN is not configured' };
  try {
    const params = new URLSearchParams(initDataRaw);
    const hash = params.get('hash');
    if (!hash) return { ok: false, status: 403, error: 'Missing initData signature' };

    const authDateRaw = params.get('auth_date');
    const authDate = Number(authDateRaw);
    if (!Number.isFinite(authDate)) return { ok: false, status: 403, error: 'Missing auth_date' };
    const ageSeconds = Math.floor(Date.now() / 1000) - authDate;
    if (ageSeconds < -60 || ageSeconds > TELEGRAM_INIT_DATA_MAX_AGE_SECONDS) {
      return { ok: false, status: 403, error: 'Stale initData' };
    }

    params.delete('hash');
    const entries = [...params.entries()].sort(([a], [b]) => a.localeCompare(b));
    const dataCheckString = entries.map(([k, v]) => `${k}=${v}`).join('\n');
    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
    const hmac = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
    if (!timingSafeEqualString(hmac, hash, 'hex')) return { ok: false, status: 403, error: 'Invalid initData signature' };
    return { ok: true, params };
  } catch (e) { return { ok: false, status: 400, error: 'Invalid initData' }; }
}

function getClientKey(req) {
  return String(req.headers['x-forwarded-for'] || req.ip || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
}

function hashIp(req) {
  const secret = process.env.SECURITY_LOG_SECRET || process.env.ADMIN_PASSWORD || 'telelms-security';
  return crypto.createHmac('sha256', secret).update(getClientKey(req)).digest('hex');
}

async function logSecurityEvent(req, eventType, reason, telegramUser) {
  try {
    await supabase.from('security_events').insert({
      event_type: eventType,
      telegram_id: telegramUser?.id || null,
      ip_hash: hashIp(req),
      user_agent: String(req.headers['user-agent'] || '').slice(0, 500),
      path: String(req.originalUrl || req.url || '').slice(0, 500),
      reason: String(reason || '').slice(0, 500),
    });
  } catch (err) { console.error('Security event log failed:', err.message); }
}

async function isTelegramUserBanned(telegramId) {
  if (!telegramId) return false;
  const { data } = await supabase.from('banned_telegram_users').select('telegram_id').eq('telegram_id', telegramId).single();
  return !!data;
}

async function isIpHashBanned(ipHash) {
  const { data } = await supabase.from('banned_ip_hashes').select('ip_hash').eq('ip_hash', ipHash).single();
  return !!data;
}

async function banIpHash(req, reason) {
  try { await supabase.from('banned_ip_hashes').upsert({ ip_hash: hashIp(req), reason: String(reason || '').slice(0, 500) }, { onConflict: 'ip_hash' }); } catch (err) {}
}

async function recordSuspiciousAccess(req, eventType, reason, telegramUser) {
  await logSecurityEvent(req, eventType, reason, telegramUser);
  if (eventType !== 'missing_init_data') return;
  const autoBan = await getSettingValue('auto_ban_missing_init_data', 'false');
  if (autoBan !== 'true') return;
  const threshold = Math.max(3, Number.parseInt(await getSettingValue('auto_ban_threshold', '5'), 10) || 5);
  const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const ipHash = hashIp(req);
  const { count } = await supabase.from('security_events')
    .select('id', { count: 'exact', head: true })
    .eq('ip_hash', ipHash)
    .eq('event_type', 'missing_init_data')
    .gte('created_at', since);
  if ((count || 0) >= threshold) await banIpHash(req, `Missing Telegram initData ${count} times in 10 minutes`);
}

function createAdminSession() {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + ADMIN_SESSION_TTL_MS;
  adminSessions.set(token, expiresAt);
  return { token, expires_at: new Date(expiresAt).toISOString() };
}

function validateAdminSessionToken(req) {
  const auth = String(req.headers.authorization || '');
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const token = bearer || String(req.headers['x-admin-session'] || '');
  if (!token) return false;
  const expiresAt = adminSessions.get(token);
  if (!expiresAt) return false;
  if (expiresAt <= Date.now()) {
    adminSessions.delete(token);
    return false;
  }
  return true;
}

async function logAdminAudit(req, action, targetType = null, targetId = null, note = '') {
  try {
    await supabase.from('admin_audit_logs').insert({
      action: String(action || '').slice(0, 120),
      target_type: targetType ? String(targetType).slice(0, 80) : null,
      target_id: targetId == null ? null : String(targetId).slice(0, 120),
      ip_hash: hashIp(req),
      user_agent: String(req.headers['user-agent'] || '').slice(0, 500),
      note: String(note || '').slice(0, 1000),
    });
  } catch (err) { console.error('Admin audit log failed:', err.message); }
}

function rateLimit({ windowMs = 60 * 1000, max = 60, prefix = 'global' } = {}) {
  return async (req, res, next) => {
    const key = `${prefix}:${req.telegramUser?.id || hashIp(req)}`;
    const now = Date.now();
    const bucket = rateBuckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }
    bucket.count += 1;
    if (bucket.count > max) {
      await logSecurityEvent(req, 'rate_limited', prefix, req.telegramUser);
      return res.status(429).json({ error: 'RATE_LIMITED', message: 'Too many requests' });
    }
    return next();
  };
}

async function parseTelegramUser(req, res, next) {
  const ipHash = hashIp(req);
  if (await isIpHashBanned(ipHash)) {
    await logSecurityEvent(req, 'banned_ip_blocked', 'IP hash is banned');
    return res.status(403).json({ error: 'BANNED', message: 'Access restricted' });
  }
  const initData = req.headers['x-telegram-init-data'];
  if (!initData) {
    await recordSuspiciousAccess(req, 'missing_init_data', 'No initData');
    return res.status(401).json({ error: 'No initData' });
  }
  const verified = verifyTelegramInitData(initData);
  if (!verified.ok) {
    await logSecurityEvent(req, 'invalid_init_data', verified.error);
    return res.status(verified.status).json({ error: verified.error });
  }
  try {
    const userStr = verified.params.get('user');
    if (!userStr) return res.status(400).json({ error: 'No user in initData' });
    req.telegramUser = JSON.parse(userStr);
    if (await isTelegramUserBanned(req.telegramUser.id)) {
      await logSecurityEvent(req, 'banned_user_blocked', 'Telegram user is banned', req.telegramUser);
      return res.status(403).json({ error: 'BANNED', message: 'Access restricted' });
    }
    next();
  } catch (err) {
    await logSecurityEvent(req, 'invalid_init_data', 'Invalid user payload');
    res.status(400).json({ error: 'Invalid initData' });
  }
}

async function requireTelegramOrAdmin(req, res, next) {
  const adminAccess = validateAdminSessionToken(req) || (process.env.ADMIN_PASSWORD && timingSafeEqualString(req.headers['x-admin-password'] || '', process.env.ADMIN_PASSWORD));
  if (adminAccess) return next();
  return parseTelegramUser(req, res, next);
}

function validateAdmin(req, res, next) {
  const configuredPassword = process.env.ADMIN_PASSWORD;
  if (!configuredPassword) return res.status(500).json({ error: 'Admin password is not configured' });
  if (validateAdminSessionToken(req)) return next();

  const key = getClientKey(req);
  const now = Date.now();
  const failure = adminFailures.get(key);
  if (failure && failure.resetAt > now && failure.count >= ADMIN_LOGIN_MAX_FAILURES) {
    return res.status(429).json({ error: 'Too many admin authentication attempts' });
  }

  const provided = req.headers['x-admin-password'];
  const valid = timingSafeEqualString(provided || '', configuredPassword);
  if (valid) {
    adminFailures.delete(key);
    return next();
  }

  const nextFailure = failure && failure.resetAt > now
    ? { count: failure.count + 1, resetAt: failure.resetAt }
    : { count: 1, resetAt: now + ADMIN_LOGIN_WINDOW_MS };
  adminFailures.set(key, nextFailure);
  res.status(401).json({ error: 'Unauthorized' });
}

function requireBotWebhookSecret(req, res, next) {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!expected) return res.status(500).json({ error: 'Telegram webhook secret is not configured' });
  const provided = req.headers['x-telegram-bot-api-secret-token'];
  if (!timingSafeEqualString(provided || '', expected)) return res.status(401).json({ error: 'Unauthorized webhook' });
  next();
}

function getImageExtension(file) {
  if (!file || !file.buffer) return null;
  const b = file.buffer;
  const startsWith = bytes => bytes.every((byte, i) => b[i] === byte);
  if (b.length >= IMAGE_MAGIC_TYPES.png.bytes.length && startsWith(IMAGE_MAGIC_TYPES.png.bytes) && file.mimetype === IMAGE_MAGIC_TYPES.png.mime) return 'png';
  if (b.length >= IMAGE_MAGIC_TYPES.jpg.bytes.length && startsWith(IMAGE_MAGIC_TYPES.jpg.bytes) && file.mimetype === IMAGE_MAGIC_TYPES.jpg.mime) return 'jpg';
  if (b.length >= 12 && b.slice(0, 4).toString('ascii') === 'RIFF' && b.slice(8, 12).toString('ascii') === 'WEBP' && file.mimetype === IMAGE_MAGIC_TYPES.webp.mime) return 'webp';
  return null;
}

async function uploadImageToStorage(file, prefix) {
  const ext = getImageExtension(file);
  if (!ext) {
    const err = new Error('Only PNG, JPEG, or WebP images are allowed');
    err.status = 400;
    throw err;
  }
  const fileName = `${prefix}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from('uploads').upload(fileName, file.buffer, { contentType: file.mimetype });
  if (error) {
    const err = new Error('Upload failed');
    err.status = 500;
    throw err;
  }
  const { data: urlData } = supabase.storage.from('uploads').getPublicUrl(fileName);
  return urlData.publicUrl;
}

function pick(obj, allowed) {
  return allowed.reduce((out, key) => {
    if (Object.prototype.hasOwnProperty.call(obj, key)) out[key] = obj[key];
    return out;
  }, {});
}

function sanitizeRoadmapPayload(body) {
  const data = pick(body, ['title', 'description', 'icon', 'color', 'order_index']);
  if (data.title != null) data.title = String(data.title).trim();
  if (data.description != null) data.description = String(data.description).slice(0, 2000);
  if (data.icon != null) data.icon = String(data.icon).slice(0, 8);
  if (data.color != null && !/^#[0-9a-f]{6}$/i.test(String(data.color))) delete data.color;
  if (data.order_index != null) data.order_index = Number.parseInt(data.order_index, 10) || 0;
  return data;
}

function sanitizeCoursePayload(body) {
  const data = pick(body, ['roadmap_id', 'title', 'description', 'price_mmk', 'price_usdt', 'telegram_group_id', 'difficulty', 'duration_hours', 'order_index', 'thumbnail_url', 'is_published']);
  if (data.roadmap_id !== undefined) data.roadmap_id = data.roadmap_id ? parseId(data.roadmap_id) : null;
  if (data.title != null) data.title = String(data.title).trim();
  if (data.description != null) data.description = String(data.description).slice(0, 5000);
  if (data.price_mmk !== undefined) data.price_mmk = Math.max(0, Number.parseInt(data.price_mmk, 10) || 0);
  if (data.price_usdt !== undefined) data.price_usdt = data.price_usdt === '' || data.price_usdt == null ? null : Math.max(0, Number.parseFloat(data.price_usdt) || 0);
  if (data.telegram_group_id != null) data.telegram_group_id = String(data.telegram_group_id).trim() || null;
  if (data.difficulty != null && !['beginner', 'intermediate', 'advanced'].includes(data.difficulty)) data.difficulty = 'beginner';
  if (data.duration_hours !== undefined) data.duration_hours = data.duration_hours ? Math.max(0, Number.parseInt(data.duration_hours, 10) || 0) : null;
  if (data.order_index !== undefined) data.order_index = Number.parseInt(data.order_index, 10) || 0;
  if (data.thumbnail_url != null) data.thumbnail_url = String(data.thumbnail_url).trim() || null;
  if (data.is_published !== undefined) data.is_published = !!data.is_published;
  return data;
}

function sanitizeLessonPayload(body) {
  const data = pick(body, ['module_id', 'title', 'content', 'video_url', 'file_url', 'order_index', 'is_preview']);
  if (data.module_id !== undefined) data.module_id = parseId(data.module_id);
  if (data.title != null) data.title = String(data.title).trim();
  if (data.content != null) data.content = String(data.content).slice(0, 50000);
  if (data.video_url != null) data.video_url = String(data.video_url).trim() || null;
  if (data.file_url != null) data.file_url = String(data.file_url).trim() || null;
  if (data.order_index !== undefined) data.order_index = Number.parseInt(data.order_index, 10) || 0;
  if (data.is_preview !== undefined) data.is_preview = !!data.is_preview;
  return data;
}

function parseId(value) {
  const n = Number.parseInt(value, 10);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

function csvCell(value) {
  let s = value == null ? '' : String(value);
  if (/^[=+@\-\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

function sanitizeSearchTerm(value) {
  return String(value || '').replace(/[%,()]/g, ' ').trim().slice(0, 80);
}

async function ensureUser(tgUser) {
  const { data: existing } = await supabase.from('users').select('id').eq('telegram_id', tgUser.id).single();
  if (existing) return existing.id;
  const { data: inserted } = await supabase.from('users')
    .upsert({ telegram_id: tgUser.id, first_name: tgUser.first_name, last_name: tgUser.last_name || null, username: tgUser.username || null }, { onConflict: 'telegram_id' })
    .select('id').single();
  return inserted ? inserted.id : null;
}

async function getVerifiedUserIdFromRequest(req) {
  const initData = req.headers['x-telegram-init-data'];
  if (!initData) return null;
  const verified = verifyTelegramInitData(initData);
  if (!verified.ok) return null;
  try {
    const userStr = verified.params.get('user');
    if (!userStr) return null;
    return ensureUser(JSON.parse(userStr));
  } catch (err) { return null; }
}

async function hasCourseAccess(userId, courseId) {
  if (!userId || !courseId) return false;
  const [manual, cryptoPayment] = await Promise.all([
    supabase.from('payments').select('id').eq('user_id', userId).eq('course_id', courseId).eq('status', 'approved').limit(1),
    supabase.from('crypto_payments').select('id').eq('user_id', userId).eq('course_id', courseId).eq('status', 'finished').limit(1),
  ]);
  return (manual.data || []).length > 0 || (cryptoPayment.data || []).length > 0;
}

async function requireCourseAccess(req, res, courseId) {
  const userId = await ensureUser(req.telegramUser);
  const hasAccess = await hasCourseAccess(userId, courseId);
  if (!hasAccess) {
    res.status(403).json({ error: 'Payment required' });
    return null;
  }
  return userId;
}

async function getSettingValue(key, fallback = '') {
  const { data } = await supabase.from('app_settings').select('value').eq('key', key).single();
  return data?.value ?? fallback;
}

async function maintenanceGuard(req, res, next) {
  const mode = await getSettingValue('maintenance_mode', 'false');
  if (mode !== 'true') return next();
  const msg = await getSettingValue('maintenance_message', 'Maintenance in progress');
  return res.status(503).json({ error: 'MAINTENANCE', message: msg });
}

function telegramRoute(...handlers) { return [parseTelegramUser, maintenanceGuard, ...handlers]; }
function adminRoute(...handlers) { return [validateAdmin, ...handlers]; }

// --- Health ---
app.get('/api/health', (req, res) => res.json({ status: 'ok', app: 'Lann Sa LMS', timestamp: new Date().toISOString() }));

app.post('/api/admin/login', rateLimit({ prefix: 'admin-login', max: 20 }), (req, res) => {
  const configuredPassword = process.env.ADMIN_PASSWORD;
  if (!configuredPassword) return res.status(500).json({ error: 'Admin password is not configured' });
  const key = getClientKey(req);
  const now = Date.now();
  const failure = adminFailures.get(key);
  if (failure && failure.resetAt > now && failure.count >= ADMIN_LOGIN_MAX_FAILURES) return res.status(429).json({ error: 'Too many admin authentication attempts' });
  if (!timingSafeEqualString(req.body?.password || '', configuredPassword)) {
    const nextFailure = failure && failure.resetAt > now ? { count: failure.count + 1, resetAt: failure.resetAt } : { count: 1, resetAt: now + ADMIN_LOGIN_WINDOW_MS };
    adminFailures.set(key, nextFailure);
    return res.status(401).json({ error: 'Unauthorized' });
  }
  adminFailures.delete(key);
  res.json(createAdminSession());
});

app.post('/api/security/access-log', rateLimit({ prefix: 'access-log', max: 20 }), async (req, res) => {
  const eventType = req.body?.event_type || 'blocked_access';
  const reason = req.body?.reason || 'client_reported';
  if (String(reason).includes('missing_telegram_init_data')) await recordSuspiciousAccess(req, 'missing_init_data', reason);
  else await logSecurityEvent(req, eventType, reason);
  res.json({ ok: true });
});

// --- DB Migration (run once for new tables) ---
app.post('/api/admin/migrate', validateAdmin, async (req, res) => {
  try {
    // Create coupons table if not exists (uses raw insert as workaround)
    const { error: e1 } = await supabase.from('coupons').select('id').limit(1);
    if (e1 && e1.message.includes('could not find')) {
      // Tables don't exist yet - user needs to run migration SQL
      return res.json({ success: false, message: 'Please run the coupons migration SQL in Supabase Dashboard. See supabase/schema.sql for the CREATE TABLE statements.' });
    }
    res.json({ success: true, message: 'All tables exist' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- Bot Webhook ---
app.post('/api/bot/webhook', requireBotWebhookSecret, async (req, res) => {
  try { await bot.handleWebhook(req.body); } catch (err) { console.error('Webhook error:', err); }
  res.json({ ok: true });
});

app.get('/api/bot/setup', validateAdmin, async (req, res) => {
  const webhookUrl = `${process.env.WEB_APP_URL || req.protocol + '://' + req.get('host')}/api/bot/webhook`;
  const result = await bot.setupWebhook(webhookUrl, process.env.TELEGRAM_WEBHOOK_SECRET);
  res.json({ webhookUrl, result });
});

// --- Search ---
app.get('/api/search', requireTelegramOrAdmin, rateLimit({ prefix: 'search', max: 30 }), async (req, res) => {
  const q = sanitizeSearchTerm(req.query.q);
  if (!q) return res.json({ courses: [], lessons: [] });
  const { data: courses } = await supabase.from('courses').select('*').or(`title.ilike.%${q}%,description.ilike.%${q}%`).eq('is_published', true);
  const { data: lessons } = await supabase.from('lessons').select('id, title, module_id, modules(course_id, courses(id, title))').ilike('title', `%${q}%`);
  const fmtLessons = (lessons || []).map(l => ({ id: l.id, title: l.title, course_id: l.modules?.courses?.id, course_title: l.modules?.courses?.title }));
  res.json({ courses: courses || [], lessons: fmtLessons });
});

// --- Reviews ---
app.get('/api/courses/:id/reviews', requireTelegramOrAdmin, async (req, res) => {
  const { data } = await supabase.from('reviews').select('*, users(first_name, username)').eq('course_id', req.params.id).order('created_at', { ascending: false });
  res.json((data || []).map(r => ({ ...r, first_name: r.users?.first_name, username: r.users?.username })));
});

app.post('/api/courses/:id/reviews', ...telegramRoute(async (req, res) => {
  const courseId = parseId(req.params.id);
  if (!courseId) return res.status(400).json({ error: 'Invalid course id' });
  const userId = await requireCourseAccess(req, res, courseId);
  if (!userId) return;
  const rating = Number.parseInt(req.body.rating, 10);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return res.status(400).json({ error: 'Invalid rating' });
  await supabase.from('reviews').upsert({ user_id: userId, course_id: courseId, rating, comment: String(req.body.comment || '').slice(0, 2000) }, { onConflict: 'user_id,course_id' });
  res.json({ success: true });
}));

// --- Public Read ---
app.get('/api/roadmaps', requireTelegramOrAdmin, async (req, res) => {
  const { data } = await supabase.from('roadmaps').select('*').order('order_index', { ascending: true });
  res.json(data || []);
});

app.get('/api/courses', requireTelegramOrAdmin, async (req, res) => {
  let q = supabase.from('courses').select('*').eq('is_published', true);
  if (req.query.roadmap_id) q = q.eq('roadmap_id', req.query.roadmap_id);
  q = q.order('order_index', { ascending: true });
  const { data } = await q;
  res.json(data || []);
});

app.get('/api/courses/:id', requireTelegramOrAdmin, async (req, res) => {
  const courseId = parseId(req.params.id);
  if (!courseId) return res.status(400).json({ error: 'Invalid course id' });
  const adminAccess = validateAdminSessionToken(req) || (process.env.ADMIN_PASSWORD && timingSafeEqualString(req.headers['x-admin-password'] || '', process.env.ADMIN_PASSWORD));
  let q = supabase.from('courses').select('*').eq('id', courseId);
  if (!adminAccess) q = q.eq('is_published', true);
  const { data } = await q.single();
  if (!data) return res.status(404).json({ error: 'Course not found' });
  res.json(data);
});

app.get('/api/payment-methods', requireTelegramOrAdmin, async (req, res) => {
  const { data } = await supabase.from('payment_methods').select('*');
  res.json(data || []);
});

app.get('/api/announcements', requireTelegramOrAdmin, async (req, res) => {
  const { data } = await supabase.from('announcements').select('*, courses(title)').order('created_at', { ascending: false });
  res.json(data || []);
});

// --- Course Modules with Progress ---
app.get('/api/courses/:id/modules', requireTelegramOrAdmin, async (req, res) => {
  const courseId = parseId(req.params.id);
  if (!courseId) return res.status(400).json({ error: 'Invalid course id' });

  const adminAccess = validateAdminSessionToken(req) || (process.env.ADMIN_PASSWORD && timingSafeEqualString(req.headers['x-admin-password'] || '', process.env.ADMIN_PASSWORD));
  const userId = adminAccess ? null : await getVerifiedUserIdFromRequest(req);
  const hasAccess = adminAccess || (userId ? await hasCourseAccess(userId, courseId) : false);
  const { data: modules } = await supabase.from('modules').select('*').eq('course_id', courseId).order('order_index', { ascending: true });
  const modIds = (modules || []).map(m => m.id);
  const { data: lessons } = modIds.length > 0
    ? await supabase.from('lessons')
      .select(hasAccess ? '*' : 'id, title, module_id, order_index, is_preview')
      .in('module_id', modIds).order('order_index', { ascending: true })
    : { data: [] };
  let progressMap = {};
  if (userId && hasAccess) {
    const { data: prog } = await supabase.from('progress').select('lesson_id, completed').eq('user_id', userId);
    if (prog) prog.forEach(p => { progressMap[p.lesson_id] = p.completed; });
  }
  res.json((modules || []).map(m => ({
    ...m,
    lessons: (lessons || []).filter(l => l.module_id === m.id).map(l => ({
      ...l,
      completed: hasAccess ? !!progressMap[l.id] : false,
      locked: !hasAccess,
    })),
  })));
});

// --- Lesson Detail ---
app.get('/api/lessons/:id', ...telegramRoute(async (req, res) => {
  const lessonId = parseId(req.params.id);
  if (!lessonId) return res.status(400).json({ error: 'Invalid lesson id' });
  const { data: lesson } = await supabase.from('lessons').select('*, modules(course_id)').eq('id', lessonId).single();
  if (!lesson) return res.status(404).json({ error: 'Not found' });
  const userId = await ensureUser(req.telegramUser);
  const hasAccess = await hasCourseAccess(userId, lesson.modules.course_id);
  if (!hasAccess && !lesson.is_preview) return res.status(403).json({ error: 'Payment required' });
  const { data: prog } = hasAccess
    ? await supabase.from('progress').select('completed').eq('user_id', userId).eq('lesson_id', lesson.id).single()
    : { data: null };
  res.json({ ...lesson, course_id: lesson.modules.course_id, completed: prog?.completed || false, preview_only: !hasAccess && !!lesson.is_preview });
}));

// --- Bookmarks ---
app.get('/api/bookmarks', ...telegramRoute(async (req, res) => {
  const userId = await ensureUser(req.telegramUser);
  const { data } = await supabase.from('bookmarks').select('course_id, courses(*)').eq('user_id', userId);
  res.json((data || []).map(b => b.courses));
}));

app.post('/api/bookmarks', ...telegramRoute(async (req, res) => {
  const userId = await ensureUser(req.telegramUser);
  await supabase.from('bookmarks').upsert({ user_id: userId, course_id: req.body.course_id }, { onConflict: 'user_id,course_id' });
  res.json({ success: true });
}));

app.delete('/api/bookmarks/:courseId', ...telegramRoute(async (req, res) => {
  const userId = await ensureUser(req.telegramUser);
  await supabase.from('bookmarks').delete().eq('user_id', userId).eq('course_id', req.params.courseId);
  res.json({ success: true });
}));

// --- Progress (with auto-certificate generation) ---
app.post('/api/progress', ...telegramRoute(async (req, res) => {
  const userId = await ensureUser(req.telegramUser);
  const courseIdForAccess = parseId(req.body.course_id);
  if (!courseIdForAccess || !(await hasCourseAccess(userId, courseIdForAccess))) return res.status(403).json({ error: 'Payment required' });
  await supabase.from('progress').upsert({
    user_id: userId, lesson_id: req.body.lesson_id,
    completed: !!req.body.completed,
    completed_at: req.body.completed ? new Date().toISOString() : null,
  }, { onConflict: 'user_id,lesson_id' });

  let certificate = null;
  if (req.body.completed && req.body.course_id) {
    try {
      const courseId = parseInt(req.body.course_id);
      const { data: existing } = await supabase.from('certificates').select('*').eq('user_id', userId).eq('course_id', courseId).single();
      if (!existing) {
        const { data: modules } = await supabase.from('modules').select('id').eq('course_id', courseId);
        const modIds = (modules || []).map(m => m.id);
        if (modIds.length > 0) {
          const { data: lessons } = await supabase.from('lessons').select('id').in('module_id', modIds);
          const lessonIds = (lessons || []).map(l => l.id);
          if (lessonIds.length > 0) {
            const { data: progress } = await supabase.from('progress').select('lesson_id').eq('user_id', userId).eq('completed', true).in('lesson_id', lessonIds);
            if (progress && progress.length >= lessonIds.length) {
              const certNumber = 'LS-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
              const { data: cert } = await supabase.from('certificates').insert({ user_id: userId, course_id: courseId, certificate_number: certNumber }).select('*').single();
              certificate = cert;
            }
          }
        }
      }
    } catch (e) { console.error('Auto-cert error:', e); }
  }
  res.json({ success: true, certificate });
}));

// --- Payments ---
app.post('/api/payments', ...telegramRoute(rateLimit({ prefix: 'payments', max: 10, windowMs: 60 * 60 * 1000 }), upload.single('screenshot'), async (req, res) => {
  try {
    const userId = await ensureUser(req.telegramUser);
    const courseId = parseId(req.body.course_id);
    const paymentMethodId = parseId(req.body.payment_method_id);
    if (!courseId || !paymentMethodId) return res.status(400).json({ error: 'Invalid payment details' });
    const { data: existingPayments } = await supabase.from('payments')
      .select('id, status, created_at')
      .eq('user_id', userId).eq('course_id', courseId)
      .in('status', ['pending', 'approved']).order('created_at', { ascending: false }).limit(1);
    if ((existingPayments || []).some(p => p.status === 'approved')) return res.status(409).json({ error: 'ALREADY_ENROLLED', message: 'You are already enrolled in this course.' });
    if ((existingPayments || []).some(p => p.status === 'pending')) return res.status(409).json({ error: 'PAYMENT_ALREADY_PENDING', message: 'Your payment proof is already pending admin review.' });
    const { data: existingCrypto } = await supabase.from('crypto_payments').select('id').eq('user_id', userId).eq('course_id', courseId).eq('status', 'finished').limit(1);
    if ((existingCrypto || []).length > 0) return res.status(409).json({ error: 'ALREADY_ENROLLED', message: 'You are already enrolled in this course.' });
    if (!req.file) return res.status(400).json({ error: 'Screenshot required' });
    const screenshotUrl = await uploadImageToStorage(req.file, 'screenshots');
    const { data: payment, error: insErr } = await supabase.from('payments')
      .insert({ user_id: userId, course_id: courseId, payment_method_id: paymentMethodId, screenshot_url: screenshotUrl })
      .select('id').single();
    if (insErr) return res.status(500).json({ error: 'Failed to save payment' });
    const { data: course } = await supabase.from('courses').select('title').eq('id', courseId).single();
    bot.notifyAdminPayment(payment.id, req.telegramUser.first_name, course?.title || '', screenshotUrl).catch(console.error);
    res.json({ success: true });
  } catch (err) { console.error('Payment error:', err); res.status(err.status || 500).json({ error: err.status ? err.message : 'Payment failed' }); }
}));

app.get('/api/my-payments', ...telegramRoute(async (req, res) => {
  const userId = await ensureUser(req.telegramUser);
  const { data } = await supabase.from('payments').select('*, courses(title)').eq('user_id', userId).order('created_at', { ascending: false });
  res.json(data || []);
}));

app.get('/api/my-certificates', ...telegramRoute(async (req, res) => {
  const userId = await ensureUser(req.telegramUser);
  const { data } = await supabase.from('certificates').select('*, courses(title, thumbnail_url)').eq('user_id', userId).order('issued_at', { ascending: false });
  res.json(data || []);
}));

app.get('/api/my-courses', ...telegramRoute(async (req, res) => {
  const userId = await ensureUser(req.telegramUser);
  const { data } = await supabase.from('payments').select('course_id, courses(*)').eq('user_id', userId).eq('status', 'approved');
  const { data: cryptoData } = await supabase.from('crypto_payments').select('course_id, courses(*)').eq('user_id', userId).eq('status', 'finished');
  const manualCourses = (data || []).map(p => p.courses);
  const cryptoCourses = (cryptoData || []).map(p => p.courses);
  const seen = new Set();
  const all = [...manualCourses, ...cryptoCourses].filter(c => c && !seen.has(c.id) && seen.add(c.id));
  res.json(all);
}));

app.get('/api/continue-learning', ...telegramRoute(async (req, res) => {
  const userId = await ensureUser(req.telegramUser);
  const { data: manual } = await supabase.from('payments').select('course_id, courses(id, title)').eq('user_id', userId).eq('status', 'approved');
  const { data: cryptoRows } = await supabase.from('crypto_payments').select('course_id, courses(id, title)').eq('user_id', userId).eq('status', 'finished');
  const seen = new Set();
  const courses = [...(manual || []), ...(cryptoRows || [])].filter(r => r.courses && !seen.has(r.course_id) && seen.add(r.course_id));
  for (const row of courses) {
    const { data: modules } = await supabase.from('modules').select('id').eq('course_id', row.course_id).order('order_index', { ascending: true });
    const modIds = (modules || []).map(m => m.id);
    if (!modIds.length) continue;
    const { data: lessons } = await supabase.from('lessons').select('id, title, module_id, order_index').in('module_id', modIds).order('order_index', { ascending: true });
    if (!lessons || !lessons.length) continue;
    const lessonIds = lessons.map(l => l.id);
    const { data: progress } = await supabase.from('progress').select('lesson_id, completed').eq('user_id', userId).in('lesson_id', lessonIds);
    const complete = new Set((progress || []).filter(p => p.completed).map(p => p.lesson_id));
    const nextLesson = lessons.find(l => !complete.has(l.id)) || lessons[0];
    return res.json({
      course: row.courses,
      lesson: nextLesson,
      completed: complete.size,
      total: lessons.length,
      progress: lessons.length ? Math.round((complete.size / lessons.length) * 100) : 0,
    });
  }
  res.json(null);
}));

// --- Quizzes ---
app.get('/api/quizzes/lesson/:lessonId', ...telegramRoute(async (req, res) => {
  const lessonId = parseId(req.params.lessonId);
  if (!lessonId) return res.status(400).json({ error: 'Invalid lesson id' });
  const { data: lesson } = await supabase.from('lessons').select('modules(course_id)').eq('id', lessonId).single();
  if (!lesson) return res.status(404).json({ error: 'Lesson not found' });
  const userId = await requireCourseAccess(req, res, lesson.modules.course_id);
  if (!userId) return;
  const { data: quiz } = await supabase.from('quizzes').select('*').eq('lesson_id', lessonId).single();
  if (!quiz) return res.json(null);
  const { data: questions } = await supabase.from('quiz_questions').select('id, question, option_a, option_b, option_c, option_d, order_index').eq('quiz_id', quiz.id).order('order_index', { ascending: true });
  const { data: attempts } = await supabase.from('quiz_attempts').select('*').eq('user_id', userId).eq('quiz_id', quiz.id).order('created_at', { ascending: false }).limit(1);
  res.json({ ...quiz, questions: questions || [], lastAttempt: attempts && attempts.length > 0 ? attempts[0] : null });
}));

app.post('/api/quizzes/:quizId/submit', ...telegramRoute(async (req, res) => {
  const quizId = parseId(req.params.quizId);
  if (!quizId) return res.status(400).json({ error: 'Invalid quiz id' });
  const { data: quiz } = await supabase.from('quizzes').select('passing_score, lessons(modules(course_id))').eq('id', quizId).single();
  if (!quiz) return res.status(404).json({ error: 'Quiz not found' });
  const userId = await requireCourseAccess(req, res, quiz.lessons?.modules?.course_id);
  if (!userId) return;
  const { data: questions } = await supabase.from('quiz_questions').select('*').eq('quiz_id', quizId);
  if (!questions) return res.status(404).json({ error: 'Quiz not found' });
  const answers = req.body.answers || {};
  let correct = 0;
  questions.forEach(q => { if (answers[q.id] === q.correct_answer) correct++; });
  const score = Math.round((correct / questions.length) * 100);
  const passed = score >= (quiz.passing_score || 70);
  await supabase.from('quiz_attempts').insert({ user_id: userId, quiz_id: quizId, score, total: questions.length, passed, answers });
  res.json({ score, total: questions.length, correct, passed });
}));

// --- Certificates ---
app.get('/api/certificates/course/:courseId', ...telegramRoute(async (req, res) => {
  const userId = await ensureUser(req.telegramUser);
  const { data: cert } = await supabase.from('certificates').select('*').eq('user_id', userId).eq('course_id', req.params.courseId).single();
  res.json(cert || null);
}));

app.post('/api/certificates/generate/:courseId', ...telegramRoute(async (req, res) => {
  const courseId = parseId(req.params.courseId);
  if (!courseId) return res.status(400).json({ error: 'Invalid course id' });
  const userId = await requireCourseAccess(req, res, courseId);
  if (!userId) return;
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
}));

app.get('/api/certificates/verify/:certNumber', rateLimit({ prefix: 'cert-verify', max: 30 }), async (req, res) => {
  const { data } = await supabase.from('certificates').select('*, users(first_name, last_name), courses(title)').eq('certificate_number', req.params.certNumber).single();
  if (!data) return res.status(404).json({ error: 'Certificate not found' });
  res.json({ certificate_number: data.certificate_number, student: [data.users?.first_name, data.users?.last_name].filter(Boolean).join(' '), course: data.courses?.title, issued_at: data.issued_at });
});

app.post('/api/certificates/request-verification', ...telegramRoute(rateLimit({ prefix: 'cert-request', max: 5, windowMs: 60 * 60 * 1000 }), upload.single('certificate_photo'), async (req, res) => {
  try {
    const userId = await ensureUser(req.telegramUser);
    const certificateNumber = String(req.body.certificate_number || '').trim().slice(0, 80);
    if (!certificateNumber && !req.file) return res.status(400).json({ error: 'Certificate number or photo required' });
    let cert = null;
    if (certificateNumber) {
      const result = await supabase.from('certificates').select('*, users(first_name, last_name, telegram_id), courses(title)').eq('certificate_number', certificateNumber).single();
      cert = result.data || null;
    }
    const photoUrl = req.file ? await uploadImageToStorage(req.file, 'certificate-requests') : null;
    const { data: request, error } = await supabase.from('certificate_requests').insert({
      user_id: userId,
      certificate_id: cert?.id || null,
      certificate_number: certificateNumber || cert?.certificate_number || null,
      photo_url: photoUrl,
      status: 'pending',
    }).select('*').single();
    if (error) return res.status(500).json({ error: 'Failed to submit certificate request' });
    bot.notifyAdminCertificateRequest(request.id, req.telegramUser, cert, photoUrl).catch(console.error);
    res.json({ success: true, request, verified_match: !!cert });
  } catch (err) { console.error('Certificate request error:', err); res.status(err.status || 500).json({ error: err.status ? err.message : 'Certificate request failed' }); }
}));

app.get('/api/admin/certificate-requests', validateAdmin, async (req, res) => {
  const { data } = await supabase.from('certificate_requests')
    .select('*, users(first_name, last_name, username, telegram_id), certificates(certificate_number, issued_at, courses(title))')
    .order('created_at', { ascending: false }).limit(100);
  res.json(data || []);
});

app.post('/api/admin/certificate-requests/:id/review', validateAdmin, async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid request id' });
  const status = req.body.status === 'approved' ? 'approved' : req.body.status === 'rejected' ? 'rejected' : null;
  if (!status) return res.status(400).json({ error: 'Invalid status' });
  const adminNote = String(req.body.admin_note || '').slice(0, 1000);
  const { data: existing } = await supabase.from('certificate_requests')
    .select('*, users(first_name, last_name, telegram_id), certificates(certificate_number, issued_at, courses(title))')
    .eq('id', id).single();
  if (!existing) return res.status(404).json({ error: 'Request not found' });
  const { data: updated } = await supabase.from('certificate_requests')
    .update({ status, admin_note: adminNote, reviewed_at: new Date().toISOString() })
    .eq('id', id).select('*, users(first_name, last_name, telegram_id), certificates(certificate_number, issued_at, courses(title))').single();
  await logAdminAudit(req, `certificate_${status}`, 'certificate_request', id, adminNote);
  if (updated?.users?.telegram_id) {
    if (status === 'approved') await bot.notifyUserCertificateReviewed(updated.users.telegram_id, updated, await getSettingValue('certificate_signature_text', 'Lann Sa Academy'), await getSettingValue('certificate_logo_url', '')).catch(console.error);
    else await bot.notifyUserCertificateRejected(updated.users.telegram_id, updated, adminNote).catch(console.error);
  }
  res.json({ success: true, request: updated });
});

// --- Discussions ---
app.get('/api/courses/:id/discussions', requireTelegramOrAdmin, async (req, res) => {
  const { data } = await supabase.from('discussions').select('*, users(first_name, username)').eq('course_id', req.params.id).order('created_at', { ascending: false }).limit(50);
  res.json((data || []).map(d => ({ ...d, first_name: d.users?.first_name, username: d.users?.username })));
});

app.post('/api/courses/:id/discussions', ...telegramRoute(async (req, res) => {
  const courseId = parseId(req.params.id);
  if (!courseId) return res.status(400).json({ error: 'Invalid course id' });
  const userId = await requireCourseAccess(req, res, courseId);
  if (!userId) return;
  const message = String(req.body.message || '').trim();
  if (!message) return res.status(400).json({ error: 'Message required' });
  await supabase.from('discussions').insert({ course_id: courseId, user_id: userId, message: message.slice(0, 2000) });
  res.json({ success: true });
}));

// ========== ADMIN ROUTES ==========

app.get('/api/admin/stats', validateAdmin, async (req, res) => {
  const [users, courses, pending, total, approved, securityEvents, paymentMethods, cryptoPending, settingsRows, modules, lessons] = await Promise.all([
    supabase.from('users').select('id', { count: 'exact', head: true }),
    supabase.from('courses').select('id', { count: 'exact', head: true }),
    supabase.from('payments').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('payments').select('id', { count: 'exact', head: true }),
    supabase.from('payments').select('course_id, courses(price_mmk)').eq('status', 'approved'),
    supabase.from('security_events').select('id', { count: 'exact', head: true }).gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
    supabase.from('payment_methods').select('id', { count: 'exact', head: true }),
    supabase.from('crypto_payments').select('id', { count: 'exact', head: true }).in('status', ['failed', 'expired']),
    supabase.from('app_settings').select('*'),
    supabase.from('modules').select('course_id'),
    supabase.from('lessons').select('id, modules(course_id)'),
  ]);
  const revenue = (approved.data || []).reduce((sum, p) => sum + (p.courses?.price_mmk || 0), 0);
  const courseIdsWithModules = new Set((modules.data || []).map(m => m.course_id));
  const courseIdsWithLessons = new Set((lessons.data || []).map(l => l.modules?.course_id).filter(Boolean));
  const settings = {};
  (settingsRows.data || []).forEach(row => { settings[row.key] = row.value; });
  const missingCryptoConfig = settings.crypto_payment_enabled === 'true' && (!settings.nowpayments_api_key || !settings.nowpayments_ipn_secret);
  res.json({
    totalUsers: users.count || 0, totalCourses: courses.count || 0,
    pendingPayments: pending.count || 0, totalPayments: total.count || 0,
    totalRevenue: revenue, approvedEnrollments: (approved.data || []).length,
    recentSecurityEvents: securityEvents.count || 0,
    paymentMethodCount: paymentMethods.count || 0,
    failedCryptoPayments: cryptoPending.count || 0,
    coursesWithoutModules: Math.max((courses.count || 0) - courseIdsWithModules.size, 0),
    coursesWithoutLessons: Math.max((courses.count || 0) - courseIdsWithLessons.size, 0),
    missingCryptoConfig,
  });
});

app.get('/api/admin/setup-checklist', validateAdmin, async (req, res) => {
  const [settingsRows, roadmaps, courses, modules, lessons, paymentMethods] = await Promise.all([
    supabase.from('app_settings').select('*'),
    supabase.from('roadmaps').select('id', { count: 'exact', head: true }),
    supabase.from('courses').select('id', { count: 'exact', head: true }),
    supabase.from('modules').select('id', { count: 'exact', head: true }),
    supabase.from('lessons').select('id', { count: 'exact', head: true }),
    supabase.from('payment_methods').select('id', { count: 'exact', head: true }),
  ]);
  const settings = {};
  (settingsRows.data || []).forEach(row => { settings[row.key] = row.value; });
  res.json([
    { key: 'admin_password', label: 'Admin password configured', ok: !!process.env.ADMIN_PASSWORD },
    { key: 'bot_token', label: 'Telegram bot token configured', ok: !!process.env.BOT_TOKEN },
    { key: 'webhook_secret', label: 'Telegram webhook secret configured', ok: !!process.env.TELEGRAM_WEBHOOK_SECRET },
    { key: 'telegram_start', label: 'Bot username/start URL set', ok: !!settings.bot_username || !!settings.telegram_start_url },
    { key: 'roadmaps', label: 'At least one roadmap', ok: (roadmaps.count || 0) > 0 },
    { key: 'courses', label: 'At least one course', ok: (courses.count || 0) > 0 },
    { key: 'modules', label: 'At least one module', ok: (modules.count || 0) > 0 },
    { key: 'lessons', label: 'At least one lesson', ok: (lessons.count || 0) > 0 },
    { key: 'manual_payment', label: 'Manual payment method configured', ok: (paymentMethods.count || 0) > 0 || settings.myanmar_payment_enabled === 'false' },
    { key: 'crypto_payment', label: 'Crypto keys set if crypto is enabled', ok: settings.crypto_payment_enabled !== 'true' || (!!settings.nowpayments_api_key && !!settings.nowpayments_ipn_secret) },
    { key: 'security_mode', label: 'Telegram-only mode enabled', ok: settings.telegram_only_mode !== 'false' },
  ]);
});

app.get('/api/admin/audit-logs', validateAdmin, async (req, res) => {
  const { data } = await supabase.from('admin_audit_logs').select('*').order('created_at', { ascending: false }).limit(200);
  res.json(data || []);
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

app.get('/api/admin/security-events', validateAdmin, async (req, res) => {
  const { data } = await supabase.from('security_events').select('*').order('created_at', { ascending: false }).limit(200);
  res.json(data || []);
});

app.get('/api/admin/banned-users', validateAdmin, async (req, res) => {
  const { data } = await supabase.from('banned_telegram_users').select('*').order('created_at', { ascending: false });
  res.json(data || []);
});

app.post('/api/admin/banned-users', validateAdmin, async (req, res) => {
  const telegramId = Number.parseInt(req.body.telegram_id, 10);
  if (!Number.isFinite(telegramId)) return res.status(400).json({ error: 'Invalid Telegram ID' });
  await supabase.from('banned_telegram_users').upsert({ telegram_id: telegramId, reason: String(req.body.reason || '').slice(0, 500), created_by: 'admin' }, { onConflict: 'telegram_id' });
  await logAdminAudit(req, 'ban_user', 'telegram_user', telegramId, req.body.reason || '');
  res.json({ success: true });
});

app.delete('/api/admin/banned-users/:telegramId', validateAdmin, async (req, res) => {
  await supabase.from('banned_telegram_users').delete().eq('telegram_id', req.params.telegramId);
  await logAdminAudit(req, 'unban_user', 'telegram_user', req.params.telegramId);
  res.json({ success: true });
});

app.get('/api/admin/banned-ips', validateAdmin, async (req, res) => {
  const { data } = await supabase.from('banned_ip_hashes').select('*').order('created_at', { ascending: false });
  res.json(data || []);
});

app.delete('/api/admin/banned-ips/:ipHash', validateAdmin, async (req, res) => {
  await supabase.from('banned_ip_hashes').delete().eq('ip_hash', req.params.ipHash);
  await logAdminAudit(req, 'unban_ip', 'ip_hash', req.params.ipHash);
  res.json({ success: true });
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
  await logAdminAudit(req, 'payment_approved', 'payment', req.params.id, req.body.note || '');
  res.json({ success: true });
});

app.post('/api/admin/payments/:id/reject', validateAdmin, async (req, res) => {
  await supabase.from('payments').update({ status: 'rejected', admin_note: req.body.note || '' }).eq('id', req.params.id);
  const { data: pay } = await supabase.from('payments').select('*, users(telegram_id), courses(title)').eq('id', req.params.id).single();
  if (pay) bot.notifyUserRejection(pay.users.telegram_id, pay.course_id, pay.courses.title, req.body.note).catch(console.error);
  await logAdminAudit(req, 'payment_rejected', 'payment', req.params.id, req.body.note || '');
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
    (data || []).forEach(u => { csv += [u.id, u.telegram_id, u.first_name || '', u.last_name || '', u.username || '', u.created_at].map(csvCell).join(',') + '\n'; });
  } else if (type === 'payments') {
    const { data } = await supabase.from('payments').select('*, users(first_name, username), courses(title, price_mmk), payment_methods(name)').order('created_at', { ascending: false });
    csv = 'ID,User,Course,Amount (MMK),Payment Method,Status,Date,Admin Note\n';
    (data || []).forEach(p => { csv += [p.id, p.users?.first_name || '', p.courses?.title || '', p.courses?.price_mmk || 0, p.payment_methods?.name || '', p.status, p.created_at, p.admin_note || ''].map(csvCell).join(',') + '\n'; });
  } else if (type === 'courses') {
    const { data } = await supabase.from('courses').select('*, roadmaps(title)').order('id');
    csv = 'ID,Title,Roadmap,Price (MMK),Difficulty,Duration,Published\n';
    (data || []).forEach(c => { csv += [c.id, c.title, c.roadmaps?.title || '', c.price_mmk, c.difficulty, c.duration_hours || '', c.is_published].map(csvCell).join(',') + '\n'; });
  } else {
    return res.status(400).json({ error: 'Invalid type' });
  }
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename=${type}_${Date.now()}.csv`);
  res.send(csv);
});

// --- Admin CRUD: Roadmaps ---
app.post('/api/admin/roadmaps', validateAdmin, async (req, res) => {
  await supabase.from('roadmaps').insert({ icon: '📚', color: '#3390ec', order_index: 0, ...sanitizeRoadmapPayload(req.body) });
  res.json({ success: true });
});
app.put('/api/admin/roadmaps/:id', validateAdmin, async (req, res) => {
  await supabase.from('roadmaps').update(sanitizeRoadmapPayload(req.body)).eq('id', req.params.id);
  res.json({ success: true });
});
app.delete('/api/admin/roadmaps/:id', validateAdmin, async (req, res) => {
  await supabase.from('roadmaps').delete().eq('id', req.params.id);
  res.json({ success: true });
});

// --- Admin CRUD: Courses ---
app.get('/api/admin/courses', validateAdmin, async (req, res) => {
  const { data } = await supabase.from('courses').select('*').order('order_index', { ascending: true });
  res.json(data || []);
});

app.post('/api/admin/courses', validateAdmin, async (req, res) => {
  await supabase.from('courses').insert({ difficulty: 'beginner', order_index: 0, ...sanitizeCoursePayload(req.body) });
  res.json({ success: true });
});
app.put('/api/admin/courses/:id', validateAdmin, async (req, res) => {
  await supabase.from('courses').update({ ...sanitizeCoursePayload(req.body), updated_at: new Date().toISOString() }).eq('id', req.params.id);
  res.json({ success: true });
});
app.delete('/api/admin/courses/:id', validateAdmin, async (req, res) => {
  await supabase.from('courses').delete().eq('id', req.params.id);
  await logAdminAudit(req, 'course_deleted', 'course', req.params.id);
  res.json({ success: true });
});

app.put('/api/admin/courses/:id/publish', validateAdmin, async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid course id' });
  const isPublished = !!req.body.is_published;
  const { error } = await supabase.from('courses').update({ is_published: isPublished }).eq('id', id);
  if (error) return res.status(500).json({ error: 'Failed to update course' });
  await logAdminAudit(req, isPublished ? 'course_published' : 'course_unpublished', 'course', id);
  res.json({ success: true });
});

// --- Admin CRUD: Modules ---
app.post('/api/admin/modules', validateAdmin, async (req, res) => {
  await supabase.from('modules').insert({ course_id: parseId(req.body.course_id), title: String(req.body.title || '').trim(), order_index: Number.parseInt(req.body.order_index, 10) || 0 });
  res.json({ success: true });
});
app.delete('/api/admin/modules/:id', validateAdmin, async (req, res) => {
  await supabase.from('modules').delete().eq('id', req.params.id);
  await logAdminAudit(req, 'module_deleted', 'module', req.params.id);
  res.json({ success: true });
});

app.post('/api/admin/modules/:id/reorder', validateAdmin, async (req, res) => {
  const id = parseId(req.params.id);
  const direction = req.body.direction === 'up' ? -1 : req.body.direction === 'down' ? 1 : 0;
  if (!id || !direction) return res.status(400).json({ error: 'Invalid reorder request' });
  const { data: mod } = await supabase.from('modules').select('*').eq('id', id).single();
  if (!mod) return res.status(404).json({ error: 'Module not found' });
  const { data: modules } = await supabase.from('modules').select('*').eq('course_id', mod.course_id).order('order_index', { ascending: true }).order('id', { ascending: true });
  const idx = (modules || []).findIndex(m => m.id === id);
  const swap = (modules || [])[idx + direction];
  if (!swap) return res.json({ success: true });
  await Promise.all([
    supabase.from('modules').update({ order_index: swap.order_index }).eq('id', mod.id),
    supabase.from('modules').update({ order_index: mod.order_index }).eq('id', swap.id),
  ]);
  await logAdminAudit(req, 'module_reordered', 'module', id, req.body.direction);
  res.json({ success: true });
});

// --- Admin CRUD: Lessons ---
app.post('/api/admin/lessons', validateAdmin, async (req, res) => {
  await supabase.from('lessons').insert({ content: '', order_index: 0, ...sanitizeLessonPayload(req.body) });
  res.json({ success: true });
});
app.put('/api/admin/lessons/:id', validateAdmin, async (req, res) => {
  await supabase.from('lessons').update(sanitizeLessonPayload(req.body)).eq('id', req.params.id);
  res.json({ success: true });
});
app.delete('/api/admin/lessons/:id', validateAdmin, async (req, res) => {
  await supabase.from('lessons').delete().eq('id', req.params.id);
  res.json({ success: true });
});

app.post('/api/admin/lessons/:id/duplicate', validateAdmin, async (req, res) => {
  const lessonId = parseId(req.params.id);
  if (!lessonId) return res.status(400).json({ error: 'Invalid lesson id' });
  const { data: lesson } = await supabase.from('lessons').select('*').eq('id', lessonId).single();
  if (!lesson) return res.status(404).json({ error: 'Lesson not found' });
  const copy = { ...lesson, id: undefined, title: `${lesson.title} (Copy)`, order_index: (lesson.order_index || 0) + 1 };
  delete copy.id;
  await supabase.from('lessons').insert(copy);
  res.json({ success: true });
});

app.post('/api/admin/lessons/:id/reorder', validateAdmin, async (req, res) => {
  const lessonId = parseId(req.params.id);
  const direction = req.body.direction === 'up' ? -1 : 1;
  const { data: lesson } = await supabase.from('lessons').select('order_index').eq('id', lessonId).single();
  if (!lesson) return res.status(404).json({ error: 'Lesson not found' });
  await supabase.from('lessons').update({ order_index: Math.max(0, (lesson.order_index || 0) + direction) }).eq('id', lessonId);
  res.json({ success: true });
});

// --- Admin CRUD: Announcements ---
app.post('/api/admin/announcements', validateAdmin, async (req, res) => {
  const courseId = req.body.course_id ? parseId(req.body.course_id) : null;
  const title = String(req.body.title || '').trim().slice(0, 200);
  const content = String(req.body.content || '').slice(0, 2000);
  if (!title) return res.status(400).json({ error: 'Title required' });
  const { data: ann } = await supabase.from('announcements').insert({ course_id: courseId, title, content }).select('*').single();
  let pushed = 0;
  if (req.body.push_to_users) {
    let ids = [];
    if (courseId) {
      const [manual, cryptoRows] = await Promise.all([
        supabase.from('payments').select('users(telegram_id)').eq('course_id', courseId).eq('status', 'approved'),
        supabase.from('crypto_payments').select('users(telegram_id)').eq('course_id', courseId).eq('status', 'finished'),
      ]);
      ids = [...(manual.data || []), ...(cryptoRows.data || [])].map(r => r.users?.telegram_id).filter(Boolean);
    } else {
      const { data: users } = await supabase.from('users').select('telegram_id').limit(1000);
      ids = (users || []).map(u => u.telegram_id).filter(Boolean);
    }
    pushed = await bot.broadcastAnnouncement([...new Set(ids)], title, content);
  }
  await logAdminAudit(req, 'announcement_created', 'announcement', ann?.id, req.body.push_to_users ? `pushed:${pushed}` : 'not_pushed');
  res.json({ success: true, pushed });
});
app.delete('/api/admin/announcements/:id', validateAdmin, async (req, res) => {
  await supabase.from('announcements').delete().eq('id', req.params.id);
  res.json({ success: true });
});

// --- Admin CRUD: Payment Methods ---
app.post('/api/admin/payment-methods', validateAdmin, upload.single('qr_image'), async (req, res) => {
  try {
    let qrUrl = null;
    if (req.file) qrUrl = await uploadImageToStorage(req.file, 'qr');
    await supabase.from('payment_methods').insert({
      name: String(req.body.name || '').trim(),
      account_name: String(req.body.account_name || '').trim(),
      account_number: String(req.body.account_number || '').trim(),
      qr_image_url: qrUrl,
      instructions: String(req.body.instructions || '').slice(0, 2000),
    });
    res.json({ success: true });
  } catch (err) { res.status(err.status || 500).json({ error: err.status ? err.message : 'Failed to save payment method' }); }
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

// ========== COUPONS / REFERRAL CODES ==========

app.get('/api/admin/coupons', validateAdmin, async (req, res) => {
  const { data } = await supabase.from('coupons').select('*, courses(title)').order('created_at', { ascending: false });
  res.json(data || []);
});

app.get('/api/admin/coupons/stats', validateAdmin, async (req, res) => {
  const [{ data: coupons }, { data: uses }] = await Promise.all([
    supabase.from('coupons').select('id, code, type, used_count, max_uses, courses(title)').order('used_count', { ascending: false }),
    supabase.from('coupon_uses').select('coupon_id, discount_applied, created_at')
  ]);
  const discounts = {};
  (uses || []).forEach(u => { discounts[u.coupon_id] = (discounts[u.coupon_id] || 0) + (u.discount_applied || 0); });
  res.json((coupons || []).map(c => ({ ...c, course_title: c.courses?.title || 'All courses', discount_total: discounts[c.id] || 0 })));
});

app.post('/api/admin/coupons', validateAdmin, async (req, res) => {
  const { code, type, discount_amount, discount_percent, max_uses, course_id, expires_at } = req.body;
  if (!code) return res.status(400).json({ error: 'Code required' });
  const { error } = await supabase.from('coupons').insert({
    code: code.toUpperCase().trim(),
    type: type || 'fixed',
    discount_amount: parseInt(discount_amount) || 0,
    discount_percent: parseInt(discount_percent) || 0,
    max_uses: parseInt(max_uses) || 1,
    course_id: course_id ? parseInt(course_id) : null,
    expires_at: expires_at || null,
  });
  if (error) return res.status(400).json({ error: error.message });
  res.json({ success: true });
});

app.put('/api/admin/coupons/:id', validateAdmin, async (req, res) => {
  await supabase.from('coupons').update({ is_active: req.body.is_active }).eq('id', req.params.id);
  res.json({ success: true });
});

app.delete('/api/admin/coupons/:id', validateAdmin, async (req, res) => {
  await supabase.from('coupons').delete().eq('id', req.params.id);
  res.json({ success: true });
});

// User: validate coupon
app.post('/api/coupons/validate', ...telegramRoute(rateLimit({ prefix: 'coupon-validate', max: 20 }), async (req, res) => {
  const { code, course_id } = req.body;
  if (!code || !course_id) return res.status(400).json({ error: 'Code and course_id required' });

  const { data: coupon } = await supabase.from('coupons').select('*').eq('code', code.toUpperCase().trim()).eq('is_active', true).single();
  if (!coupon) return res.status(404).json({ error: 'Invalid coupon code' });
  if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) return res.status(400).json({ error: 'Coupon expired' });
  if (coupon.used_count >= coupon.max_uses) return res.status(400).json({ error: 'Coupon fully used' });
  if (coupon.course_id && coupon.course_id !== parseInt(course_id)) return res.status(400).json({ error: 'Coupon not valid for this course' });

  const userId = await ensureUser(req.telegramUser);
  const { data: used } = await supabase.from('coupon_uses').select('id').eq('coupon_id', coupon.id).eq('user_id', userId).eq('course_id', parseInt(course_id)).single();
  if (used) return res.status(400).json({ error: 'Coupon already used' });

  const { data: course } = await supabase.from('courses').select('price_mmk').eq('id', parseInt(course_id)).single();
  if (!course) return res.status(404).json({ error: 'Course not found' });

  let discount = 0;
  if (coupon.type === 'percent' || coupon.type === 'referral') {
    discount = Math.round(course.price_mmk * (coupon.discount_percent / 100));
  } else {
    discount = coupon.discount_amount;
  }
  discount = Math.min(discount, course.price_mmk);
  const finalPrice = course.price_mmk - discount;

  res.json({ valid: true, coupon_id: coupon.id, type: coupon.type, discount, final_price: finalPrice, original_price: course.price_mmk });
}));

// Apply coupon on payment
app.post('/api/coupons/apply', ...telegramRoute(rateLimit({ prefix: 'coupon-apply', max: 10 }), async (req, res) => {
  const couponId = parseId(req.body.coupon_id);
  const courseId = parseId(req.body.course_id);
  if (!couponId || !courseId) return res.status(400).json({ error: 'Invalid coupon or course' });

  const userId = await ensureUser(req.telegramUser);
  const { data: coupon } = await supabase.from('coupons').select('*').eq('id', couponId).single();
  if (!coupon || !coupon.is_active) return res.status(404).json({ error: 'Coupon not found' });
  if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) return res.status(400).json({ error: 'Coupon expired' });
  if (coupon.used_count >= coupon.max_uses) return res.status(400).json({ error: 'Coupon fully used' });
  if (coupon.course_id && coupon.course_id !== courseId) return res.status(400).json({ error: 'Coupon not valid for this course' });

  const { data: used } = await supabase.from('coupon_uses').select('id').eq('coupon_id', coupon.id).eq('user_id', userId).eq('course_id', courseId).single();
  if (used) return res.status(400).json({ error: 'Coupon already used' });

  const { data: course } = await supabase.from('courses').select('price_mmk').eq('id', courseId).single();
  if (!course) return res.status(404).json({ error: 'Course not found' });

  let discount = 0;
  if (coupon.type === 'percent' || coupon.type === 'referral') {
    discount = Math.round(course.price_mmk * (coupon.discount_percent / 100));
  } else {
    discount = coupon.discount_amount;
  }
  discount = Math.min(Math.max(0, discount), course.price_mmk);

  const { data: lockedCoupon, error: lockErr } = await supabase.from('coupons')
    .update({ used_count: coupon.used_count + 1 })
    .eq('id', coupon.id)
    .eq('used_count', coupon.used_count)
    .lt('used_count', coupon.max_uses)
    .select('id')
    .single();
  if (lockErr || !lockedCoupon) return res.status(409).json({ error: 'Coupon is no longer available' });

  const { error: useErr } = await supabase.from('coupon_uses').insert({ coupon_id: coupon.id, user_id: userId, course_id: courseId, discount_applied: discount });
  if (useErr) {
    await supabase.from('coupons').update({ used_count: coupon.used_count }).eq('id', coupon.id);
    return res.status(400).json({ error: 'Coupon already used' });
  }

  if (discount >= course.price_mmk) {
    await supabase.from('payments').insert({ user_id: userId, course_id: courseId, payment_method_id: null, screenshot_url: 'coupon:' + coupon.code, status: 'approved', admin_note: 'Auto-approved: 100% coupon ' + coupon.code });
    return res.json({ success: true, free: true });
  }

  res.json({ success: true, free: false, discount, final_price: course.price_mmk - discount });
}));


// ========== COURSE BUNDLES ==========

app.get('/api/bundles', requireTelegramOrAdmin, async (req, res) => {
  const { data } = await supabase.from('course_bundles').select('*, bundle_courses(course_id, courses(id, title, thumbnail_url, price_mmk))').eq('is_active', true).order('created_at', { ascending: false });
  res.json(data || []);
});

app.get('/api/admin/bundles', validateAdmin, async (req, res) => {
  const { data } = await supabase.from('course_bundles').select('*, bundle_courses(course_id, courses(id, title))').order('created_at', { ascending: false });
  res.json(data || []);
});

app.post('/api/admin/bundles', validateAdmin, async (req, res) => {
  const title = String(req.body.title || '').trim();
  const courseIds = Array.isArray(req.body.course_ids) ? req.body.course_ids.map(parseId).filter(Boolean) : [];
  if (!title || courseIds.length < 2) return res.status(400).json({ error: 'Bundle title and at least two courses required' });
  const { data: bundle, error } = await supabase.from('course_bundles').insert({
    title,
    description: String(req.body.description || '').slice(0, 2000),
    price_mmk: Math.max(0, Number.parseInt(req.body.price_mmk, 10) || 0),
    price_usdt: req.body.price_usdt ? Math.max(0, Number.parseFloat(req.body.price_usdt) || 0) : null,
    is_active: req.body.is_active !== false,
  }).select('*').single();
  if (error) return res.status(400).json({ error: error.message });
  await supabase.from('bundle_courses').insert(courseIds.map(course_id => ({ bundle_id: bundle.id, course_id })));
  await logAdminAudit(req, 'bundle_created', 'bundle', bundle.id, title);
  res.json({ success: true, bundle });
});

// ========== APP SETTINGS ==========

app.get('/api/settings', async (req, res) => {
  const { data } = await supabase.from('app_settings').select('*');
  const settings = {};
  (data || []).forEach(row => { if (PUBLIC_SETTING_KEYS.has(row.key)) settings[row.key] = row.value; });
  res.json(settings);
});

app.get('/api/admin/settings', validateAdmin, async (req, res) => {
  const { data } = await supabase.from('app_settings').select('*');
  const settings = {};
  (data || []).forEach(row => {
    if (row.key === 'nowpayments_api_key' || row.key === 'nowpayments_ipn_secret') {
      settings[`${row.key}_configured`] = !!row.value;
      settings[row.key] = '';
    } else {
      settings[row.key] = row.value;
    }
  });
  res.json(settings);
});

app.put('/api/admin/settings', validateAdmin, async (req, res) => {
  const updates = req.body;
  for (const [key, value] of Object.entries(updates)) {
    if (!ADMIN_SETTING_KEYS.has(key)) return res.status(400).json({ error: `Unsupported setting: ${key}` });
    await supabase.from('app_settings').upsert({ key, value: String(value) }, { onConflict: 'key' });
  }
  await logAdminAudit(req, 'settings_updated', 'app_settings', null, Object.keys(updates).join(','));
  res.json({ success: true });
});

// ========== CRYPTO PAYMENTS (NOWPayments) ==========

app.get('/api/crypto/currencies', ...telegramRoute(async (req, res) => {
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
}));

app.get('/api/crypto/estimate', ...telegramRoute(async (req, res) => {
  const { data: setting } = await supabase.from('app_settings').select('value').eq('key', 'nowpayments_api_key').single();
  const apiKey = setting?.value;
  if (!apiKey) return res.status(400).json({ error: 'Crypto not configured' });
  try {
    const result = await np.getEstimatePrice(apiKey, req.query.amount, req.query.currency_from || 'usd', req.query.currency_to);
    res.json(result);
  } catch (err) { res.status(500).json({ error: 'Estimate failed' }); }
}));

app.post('/api/crypto/create-payment', ...telegramRoute(rateLimit({ prefix: 'crypto-create', max: 10 }), async (req, res) => {
  try {
    const userId = await ensureUser(req.telegramUser);
    const courseId = parseId(req.body.course_id);
    const payCurrency = String(req.body.pay_currency || '').toLowerCase().trim();
    if (!courseId || !/^[a-z0-9_]{2,20}$/.test(payCurrency)) return res.status(400).json({ error: 'Invalid payment request' });
    const [manualExisting, cryptoExisting] = await Promise.all([
      supabase.from('payments').select('id, status').eq('user_id', userId).eq('course_id', courseId).in('status', ['pending', 'approved']).limit(1),
      supabase.from('crypto_payments').select('id, status').eq('user_id', userId).eq('course_id', courseId).in('status', ['waiting', 'confirming', 'confirmed', 'finished']).limit(1),
    ]);
    if ((manualExisting.data || []).some(p => p.status === 'approved') || (cryptoExisting.data || []).some(p => p.status === 'finished')) return res.status(409).json({ error: 'ALREADY_ENROLLED', message: 'You are already enrolled in this course.' });
    if ((manualExisting.data || []).some(p => p.status === 'pending') || (cryptoExisting.data || []).some(p => p.status !== 'finished')) return res.status(409).json({ error: 'PAYMENT_ALREADY_PENDING', message: 'A payment is already pending for this course.' });

    const { data: acceptedSetting } = await supabase.from('app_settings').select('value').eq('key', 'nowpayments_accepted_coins').single();
    const accepted = (acceptedSetting?.value || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    if (!accepted.includes(payCurrency)) return res.status(400).json({ error: 'Unsupported currency' });

    const { data: setting } = await supabase.from('app_settings').select('value').eq('key', 'nowpayments_api_key').single();
    const apiKey = setting?.value;
    if (!apiKey) return res.status(400).json({ error: 'Crypto not configured' });

    const { data: course } = await supabase.from('courses').select('title, price_mmk, price_usdt').eq('id', courseId).single();
    if (!course) return res.status(404).json({ error: 'Course not found' });

    const priceUsd = course.price_usdt ? parseFloat(course.price_usdt) : Math.max(course.price_mmk / 3500, 0.5);
    const appUrl = process.env.WEB_APP_URL || '';
    const ipnUrl = `${appUrl}/api/crypto/ipn`;
    const orderId = `${userId}_${courseId}_${Date.now()}`;

    const payment = await np.createPayment(apiKey, {
      priceAmount: parseFloat(priceUsd.toFixed(2)),
      priceCurrency: 'usd',
      payCurrency,
      orderId,
      orderDescription: course.title,
      ipnCallbackUrl: ipnUrl,
    });

    if (payment.id) {
      await supabase.from('crypto_payments').insert({
        user_id: userId,
        course_id: courseId,
        nowpayments_id: payment.id,
        order_id: orderId,
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
}));

app.get('/api/crypto/status/:paymentId', ...telegramRoute(rateLimit({ prefix: 'crypto-status', max: 60 }), async (req, res) => {
  const paymentId = parseId(req.params.paymentId);
  if (!paymentId) return res.status(400).json({ error: 'Invalid payment id' });
  const userId = await ensureUser(req.telegramUser);
  const { data: paymentRow } = await supabase.from('crypto_payments').select('id, user_id').eq('nowpayments_id', paymentId).single();
  if (!paymentRow || paymentRow.user_id !== userId) return res.status(404).json({ error: 'Payment not found' });
  const { data: setting } = await supabase.from('app_settings').select('value').eq('key', 'nowpayments_api_key').single();
  const apiKey = setting?.value;
  if (!apiKey) return res.status(400).json({ error: 'Crypto not configured' });
  try {
    const status = await np.getPaymentStatus(apiKey, paymentId);
    if (status.payment_id) {
      await supabase.from('crypto_payments')
        .update({ status: status.payment_status, actually_paid: status.actually_paid || 0, outcome_amount: status.outcome_amount || 0, updated_at: new Date().toISOString() })
        .eq('nowpayments_id', status.payment_id)
        .eq('user_id', userId);
    }
    res.json(status);
  } catch (err) { res.status(500).json({ error: 'Status check failed' }); }
}));

app.post('/api/crypto/ipn', async (req, res) => {
  try {
    const { data: secretSetting } = await supabase.from('app_settings').select('value').eq('key', 'nowpayments_ipn_secret').single();
    const ipnSecret = secretSetting?.value;
    const signature = req.headers['x-nowpayments-sig'];
    if (!ipnSecret) return res.status(500).json({ error: 'IPN secret is not configured' });
    if (!signature) return res.status(401).json({ error: 'Missing signature' });
    if (!np.verifyIPN(ipnSecret, req.body, signature)) return res.status(400).json({ error: 'Invalid signature' });

    const { payment_id, payment_status, actually_paid, outcome_amount, pay_currency, price_amount, price_currency, order_id } = req.body;
    if (!payment_id) return res.status(400).json({ error: 'Missing payment id' });

    const { data: stored } = await supabase.from('crypto_payments')
      .select('user_id, course_id, order_id, pay_amount, pay_currency, price_amount, price_currency, status, users(first_name, telegram_id), courses(title)')
      .eq('nowpayments_id', payment_id).single();
    if (!stored) return res.status(404).json({ error: 'Payment not found' });
    if (order_id && stored.order_id && String(order_id) !== String(stored.order_id)) return res.status(400).json({ error: 'Order mismatch' });
    if (pay_currency && String(pay_currency).toLowerCase() !== String(stored.pay_currency).toLowerCase()) return res.status(400).json({ error: 'Currency mismatch' });
    if (price_currency && String(price_currency).toLowerCase() !== String(stored.price_currency || 'usd').toLowerCase()) return res.status(400).json({ error: 'Price currency mismatch' });
    if (price_amount && Math.abs(Number(price_amount) - Number(stored.price_amount)) > 0.01) return res.status(400).json({ error: 'Price amount mismatch' });
    if (stored.status === 'finished' && payment_status !== 'finished') return res.status(409).json({ error: 'Refusing regressive status update' });

    await supabase.from('crypto_payments')
      .update({ status: payment_status, actually_paid: actually_paid || 0, outcome_amount: outcome_amount || 0, updated_at: new Date().toISOString() })
      .eq('nowpayments_id', payment_id);

    if (payment_status === 'finished' && stored.status !== 'finished') {
      bot.notifyAdminCryptoPayment(stored.users?.first_name || 'User', stored.courses?.title || '', `${stored.pay_amount} ${(stored.pay_currency || '').toUpperCase()}`, stored.pay_currency || '').catch(console.error);
      if (stored.users?.telegram_id) bot.notifyUserCryptoSuccess(stored.users.telegram_id, stored.course_id, stored.courses?.title || '').catch(console.error);
    }
    res.json({ ok: true });
  } catch (err) { console.error('IPN error:', err); res.status(500).json({ error: 'IPN processing failed' }); }
});

app.get('/api/my-crypto-payments', ...telegramRoute(async (req, res) => {
  const userId = await ensureUser(req.telegramUser);
  const { data } = await supabase.from('crypto_payments').select('*, courses(title)').eq('user_id', userId).order('created_at', { ascending: false });
  res.json(data || []);
}));

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
