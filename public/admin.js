// လမ်းစ (Lann Sa) LMS - Admin Dashboard Logic
const API = '/api';
let adminPassword = '';
let adminSessionToken = sessionStorage.getItem('adminSessionToken') || '';
let pendingCount = 0;
let allPayments = [];
let adminLang = 'my';
const ADMIN_L = {
  my: { dashboard: '📊 ဒက်ရှ်ဘုတ်', payments: '💳 ငွေပေးချေမှုများ', payment_methods: '🏦 ငွေပေးချေနည်းများ', roadmaps: '🗺️ လမ်းကြောင်းများ', courses: '📖 သင်တန်းများ', content: '📝 အကြောင်းအရာ', coupons: '🎟️ ကူပွန်/Referral', announcements: '📢 ကြေညာချက်များ', users: '👥 အသုံးပြုသူများ', analytics: '📈 ခွဲခြမ်းစိတ်ဖြာ', security: '🛡️ Security', settings: '⚙️ Settings', saved: 'သိမ်းဆည်းပြီးပါပြီ' },
  en: { dashboard: '📊 Dashboard', payments: '💳 Payments', payment_methods: '🏦 Payment Methods', roadmaps: '🗺️ Roadmaps', courses: '📖 Courses', content: '📝 Content', coupons: '🎟️ Coupons/Referral', announcements: '📢 Announcements', users: '👥 Users', analytics: '📈 Analytics', security: '🛡️ Security', settings: '⚙️ Settings', saved: 'Saved successfully' },
};
function adminT(key) { return (ADMIN_L[adminLang] || ADMIN_L.my)[key] || ADMIN_L.my[key] || key; }
function applyAdminLanguageUI() {
  const labels = { stats: 'dashboard', payments: 'payments', 'payment-methods': 'payment_methods', roadmaps: 'roadmaps', courses: 'courses', content: 'content', coupons: 'coupons', announcements: 'announcements', users: 'users', analytics: 'analytics', security: 'security', settings: 'settings' };
  Object.entries(labels).forEach(([page, key]) => {
    const nav = document.querySelector(`[data-page="${page}"]`);
    if (nav) nav.childNodes[0].nodeValue = adminT(key) + ' ';
    const h = document.querySelector(`#page-${page} .page-header h2`);
    if (h) h.textContent = adminT(key);
  });
}

function adminHeaders(json = true) {
  const h = adminSessionToken ? { Authorization: `Bearer ${adminSessionToken}` } : { 'X-Admin-Password': adminPassword };
  if (json) h['Content-Type'] = 'application/json';
  return h;
}

async function adminApi(path, opts = {}) {
  const res = await fetch(API + path, { headers: adminHeaders(opts.json !== false), ...opts });
  if (!res.ok) throw new Error(await res.text());
  const ct = res.headers.get('content-type');
  if (ct && ct.includes('text/csv')) return res.blob();
  return res.json();
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.remove('hidden');
  setTimeout(() => t.classList.add('hidden'), 3000);
}

function formatMMK(n) { return Number(n || 0).toLocaleString() + ' MMK'; }

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function escapeAttr(value) { return escapeHtml(value); }
function safeUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    const url = new URL(raw, window.location.origin);
    if (!['http:', 'https:'].includes(url.protocol)) return '';
    return escapeAttr(url.href);
  } catch (e) { return ''; }
}
function safeColor(value, fallback = '#3390ec') {
  const color = String(value || '').trim();
  return /^#[0-9a-f]{6}$/i.test(color) ? color : fallback;
}
function jsonArg(value) { return encodeURIComponent(JSON.stringify(value)); }
function maskedSecret(value) { return value ? '••••••••' : ''; }

function statusBadge(s) {
  const m = { pending: ['badge-yellow', 'စိစစ်ဆဲ'], approved: ['badge-green', 'အတည်ပြုပြီး'], rejected: ['badge-red', 'ပယ်ချပြီး'] };
  const [cls, label] = m[s] || ['', s];
  return `<span class="badge ${cls}">${label}</span>`;
}

// --- SIDEBAR TOGGLE ---
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  sidebar.classList.toggle('open');
}

// --- LOGIN ---
async function doLogin() {
  const pwd = document.getElementById('login-password').value;
  try {
    const res = await fetch(API + '/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: pwd }) });
    if (!res.ok) { document.getElementById('login-error').classList.remove('hidden'); return; }
    const session = await res.json();
    adminPassword = '';
    adminSessionToken = session.token;
    sessionStorage.setItem('adminSessionToken', adminSessionToken);
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('dashboard').classList.remove('hidden');
    try { const s = await adminApi('/admin/settings'); adminLang = s.language || 'my'; applyAdminLanguageUI(); } catch (e) {}
    loadStats();
  } catch (e) { document.getElementById('login-error').classList.remove('hidden'); }
}

// --- NAVIGATION ---
function switchPage(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
  document.getElementById('page-' + page)?.classList.remove('hidden');
  document.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active'));
  document.querySelector(`[data-page="${page}"]`)?.classList.add('active');
  const sidebar = document.getElementById('sidebar');
  if (sidebar) sidebar.classList.remove('open');

  if (page === 'stats') loadStats();
  else if (page === 'payments') loadPayments();
  else if (page === 'payment-methods') loadPaymentMethods();
  else if (page === 'roadmaps') loadRoadmaps();
  else if (page === 'courses') loadCourses();
  else if (page === 'content') loadContentPage();
  else if (page === 'coupons') loadCoupons();
  else if (page === 'announcements') loadAnnouncements();
  else if (page === 'users') loadUsers();
  else if (page === 'analytics') loadAnalytics();
  else if (page === 'security') loadSecurity();
  else if (page === 'settings') loadSettings();
}

function closeModal() { document.getElementById('modal-container').innerHTML = ''; }

// --- STATS ---
async function loadStats() {
  const stats = await adminApi('/admin/stats');
  pendingCount = stats.pendingPayments;
  const badge = document.getElementById('pending-badge');
  if (pendingCount > 0) { badge.classList.remove('hidden'); badge.textContent = pendingCount; }
  else badge.classList.add('hidden');

  const alerts = [];
  if (stats.recentSecurityEvents) alerts.push(`🛡️ ${stats.recentSecurityEvents} security events in 24h`);
  if (stats.coursesWithoutLessons) alerts.push(`📖 ${stats.coursesWithoutLessons} courses need lessons`);
  if (!stats.paymentMethodCount) alerts.push('🏦 No payment methods configured');
  if (stats.missingCryptoConfig) alerts.push('🪙 Crypto enabled but NOWPayments config missing');
  document.getElementById('attention-alerts')?.remove();
  document.getElementById('stats-grid').insertAdjacentHTML('beforebegin', alerts.length ? `<div id="attention-alerts" class="stat-card mb-4" style="border-left:4px solid #f59e0b;"><h3 class="font-bold mb-2">Needs attention</h3><div class="flex flex-wrap gap-2">${alerts.map(a => `<span class="badge badge-yellow">${escapeHtml(a)}</span>`).join('')}</div></div>` : '<div id="attention-alerts"></div>');

  try {
    const setup = await adminApi('/admin/setup-checklist');
    const setupHtml = setup.map(i => `<span class="badge ${i.ok ? 'badge-green' : 'badge-yellow'}">${i.ok ? '✅' : '⚠️'} ${escapeHtml(i.label)}</span>`).join('');
    document.getElementById('attention-alerts').insertAdjacentHTML('beforeend', `<div class="mt-3"><h3 class="font-bold mb-2">Setup checklist</h3><div class="flex flex-wrap gap-2">${setupHtml}</div></div>`);
  } catch (e) {}

  document.getElementById('stats-grid').innerHTML = `
    <div class="stat-card" style="background:linear-gradient(135deg,#EEF2FF,#E0E7FF);border:none;">
      <div style="width:40px;height:40px;border-radius:12px;background:linear-gradient(135deg,#6366f1,#818CF8);display:flex;align-items:center;justify-content:center;font-size:18px;margin-bottom:12px;box-shadow:0 2px 8px rgba(99,102,241,0.3);">💰</div>
      <p class="text-xs text-gray-500 font-semibold mb-1">စုစုပေါင်း ဝင်ငွေ</p>
      <p class="text-2xl font-bold" style="color:#4F46E5">${formatMMK(stats.totalRevenue)}</p>
    </div>
    <div class="stat-card">
      <div style="width:40px;height:40px;border-radius:12px;background:linear-gradient(135deg,#DBEAFE,#BFDBFE);display:flex;align-items:center;justify-content:center;font-size:18px;margin-bottom:12px;">👥</div>
      <p class="text-xs text-gray-500 font-semibold mb-1">အသုံးပြုသူ</p>
      <p class="text-2xl font-bold text-gray-800">${stats.totalUsers}</p>
    </div>
    <div class="stat-card">
      <div style="width:40px;height:40px;border-radius:12px;background:linear-gradient(135deg,#D1FAE5,#A7F3D0);display:flex;align-items:center;justify-content:center;font-size:18px;margin-bottom:12px;">📖</div>
      <p class="text-xs text-gray-500 font-semibold mb-1">သင်တန်း</p>
      <p class="text-2xl font-bold text-gray-800">${stats.totalCourses}</p>
    </div>
    <div class="stat-card">
      <div style="width:40px;height:40px;border-radius:12px;background:linear-gradient(135deg,#FEF3C7,#FDE68A);display:flex;align-items:center;justify-content:center;font-size:18px;margin-bottom:12px;">⏳</div>
      <p class="text-xs text-gray-500 font-semibold mb-1">စိစစ်ရန်</p>
      <p class="text-2xl font-bold" style="color:#D97706">${stats.pendingPayments}</p>
    </div>
    <div class="stat-card">
      <div style="width:40px;height:40px;border-radius:12px;background:linear-gradient(135deg,#D1FAE5,#6EE7B7);display:flex;align-items:center;justify-content:center;font-size:18px;margin-bottom:12px;">📝</div>
      <p class="text-xs text-gray-500 font-semibold mb-1">စာရင်းသွင်းပြီး</p>
      <p class="text-2xl font-bold" style="color:#059669">${stats.approvedEnrollments}</p>
    </div>
    <div class="stat-card">
      <div style="width:40px;height:40px;border-radius:12px;background:linear-gradient(135deg,#FCE7F3,#FBCFE8);display:flex;align-items:center;justify-content:center;font-size:18px;margin-bottom:12px;">💳</div>
      <p class="text-xs text-gray-500 font-semibold mb-1">ငွေပေးချေမှု စုစုပေါင်း</p>
      <p class="text-2xl font-bold text-gray-800">${stats.totalPayments}</p>
    </div>
  `;
}

// --- PAYMENTS ---
async function loadPayments(status) {
  const url = status ? `/admin/payments?status=${status}` : '/admin/payments';
  allPayments = await adminApi(url);
  const pendingPayments = allPayments.filter(p => p.status === 'pending');
  const bulkBtn = document.getElementById('bulk-approve-btn');
  bulkBtn.style.display = pendingPayments.length > 1 ? 'inline-block' : 'none';

  document.getElementById('payments-table').innerHTML = `<table>
    <thead><tr><th>ID</th><th>အသုံးပြုသူ</th><th>သင်တန်း</th><th>ငွေပေးချေနည်း</th><th>အခြေအနေ</th><th>ရက်စွဲ</th><th>လုပ်ဆောင်ချက်</th></tr></thead>
    <tbody>${allPayments.map(p => `<tr>
      <td>#${p.id}</td>
      <td><span class="font-medium">${escapeHtml(p.first_name || '')}</span><br><span class="text-xs text-gray-400">@${escapeHtml(p.username || p.telegram_id)}</span></td>
      <td>${escapeHtml(p.course_title || '')}<br><span class="text-xs text-gray-400">${formatMMK(p.price_mmk)}</span></td>
      <td>${escapeHtml(p.payment_method_name || '-')}</td>
      <td>${statusBadge(p.status)}</td>
      <td class="text-xs">${new Date(p.created_at).toLocaleString()}</td>
      <td>
        <div class="flex gap-1">
          <button class="btn btn-outline text-xs" onclick="viewPaymentScreenshot('${escapeAttr(p.screenshot_url)}')">📸</button>
          ${p.status === 'pending' ? `
            <button class="btn btn-primary text-xs" onclick="approvePayment(${p.id})">✅</button>
            <button class="btn btn-danger text-xs" onclick="rejectPayment(${p.id})">❌</button>
          ` : ''}
        </div>
      </td>
    </tr>`).join('')}</tbody></table>`;
}

function viewPaymentScreenshot(url) {
  document.getElementById('modal-container').innerHTML = `
    <div class="modal-overlay" onclick="closeModal()">
      <div class="modal-box" onclick="event.stopPropagation()" style="max-width:400px;">
        <div class="flex justify-between items-center mb-4"><h3 class="font-bold">📸 ငွေလွှဲပြေစာ</h3><button onclick="closeModal()" class="text-xl">&times;</button></div>
        <img src="${safeUrl(url)}" class="w-full rounded-xl" alt="">
      </div>
    </div>`;
}

function approvePayment(id) {
  document.getElementById('modal-container').innerHTML = `
    <div class="modal-overlay" onclick="closeModal()">
      <div class="modal-box" onclick="event.stopPropagation()" style="max-width:400px;">
        <div class="flex justify-between items-center mb-4"><h3 class="font-bold text-lg">✅ ငွေပေးချေမှု အတည်ပြုရန်</h3><button onclick="closeModal()" class="text-xl">&times;</button></div>
        <div class="mb-4"><label class="form-label">မှတ်ချက် (ချန်ထားနိုင်ပါသည်)</label><textarea class="form-input" id="approve-note" rows="2" placeholder="မှတ်ချက် ရေးပါ..."></textarea></div>
        <div class="flex gap-2">
          <button class="btn btn-primary flex-1" onclick="doApprove(${id})">အတည်ပြုရန်</button>
          <button class="btn btn-outline flex-1" onclick="closeModal()">ပယ်ဖျက်ရန်</button>
        </div>
      </div>
    </div>`;
}

async function doApprove(id) {
  const note = document.getElementById('approve-note').value || '';
  closeModal();
  await adminApi(`/admin/payments/${id}/approve`, { method: 'POST', body: JSON.stringify({ note }) });
  showToast('အတည်ပြုပြီးပါပြီ');
  loadPayments(document.getElementById('payment-filter').value);
  loadStats();
}

function rejectPayment(id) {
  document.getElementById('modal-container').innerHTML = `
    <div class="modal-overlay" onclick="closeModal()">
      <div class="modal-box" onclick="event.stopPropagation()" style="max-width:400px;">
        <div class="flex justify-between items-center mb-4"><h3 class="font-bold text-lg">❌ ငွေပေးချေမှု ပယ်ချရန်</h3><button onclick="closeModal()" class="text-xl">&times;</button></div>
        <div class="mb-4"><label class="form-label">ပယ်ချရသည့် အကြောင်းပြချက်</label><textarea class="form-input" id="reject-note" rows="2" placeholder="အကြောင်းပြချက် ရေးပါ..." required></textarea></div>
        <div class="flex gap-2">
          <button class="btn btn-danger flex-1" onclick="doReject(${id})">ပယ်ချရန်</button>
          <button class="btn btn-outline flex-1" onclick="closeModal()">ပယ်ဖျက်ရန်</button>
        </div>
      </div>
    </div>`;
}

async function doReject(id) {
  const note = document.getElementById('reject-note').value;
  if (!note) { showToast('အကြောင်းပြချက် ထည့်ပါ'); return; }
  closeModal();
  await adminApi(`/admin/payments/${id}/reject`, { method: 'POST', body: JSON.stringify({ note }) });
  showToast('ပယ်ချပြီးပါပြီ');
  loadPayments(document.getElementById('payment-filter').value);
  loadStats();
}

function bulkApprove() {
  const pendingIds = allPayments.filter(p => p.status === 'pending').map(p => p.id);
  if (!pendingIds.length) return;
  document.getElementById('modal-container').innerHTML = `
    <div class="modal-overlay" onclick="closeModal()">
      <div class="modal-box" onclick="event.stopPropagation()" style="max-width:400px;">
        <div class="flex justify-between items-center mb-4"><h3 class="font-bold text-lg">✅ အားလုံး အတည်ပြုရန်</h3><button onclick="closeModal()" class="text-xl">&times;</button></div>
        <p class="text-sm text-gray-600 mb-4">စိစစ်ဆဲ <b>${pendingIds.length}</b> ခု အားလုံးကို အတည်ပြုမှာ သေချာပါသလား?</p>
        <div class="mb-4"><label class="form-label">မှတ်ချက် (ချန်ထားနိုင်ပါသည်)</label><textarea class="form-input" id="bulk-note" rows="2" placeholder="မှတ်ချက် ရေးပါ..."></textarea></div>
        <div class="flex gap-2">
          <button class="btn btn-primary flex-1" onclick="doBulkApprove()">အတည်ပြုရန်</button>
          <button class="btn btn-outline flex-1" onclick="closeModal()">ပယ်ဖျက်ရန်</button>
        </div>
      </div>
    </div>`;
}

async function doBulkApprove() {
  const pendingIds = allPayments.filter(p => p.status === 'pending').map(p => p.id);
  const note = document.getElementById('bulk-note').value || 'Bulk approved';
  closeModal();
  await adminApi('/admin/payments/bulk-approve', { method: 'POST', body: JSON.stringify({ ids: pendingIds, note }) });
  showToast(`${pendingIds.length} ခု အတည်ပြုပြီးပါပြီ`);
  loadPayments(); loadStats();
}

// --- PAYMENT METHODS ---
async function loadPaymentMethods() {
  const methods = await adminApi('/payment-methods');
  document.getElementById('payment-methods-grid').innerHTML = methods.length > 0
    ? methods.map(m => `
      <div class="stat-card">
        <div class="flex items-start justify-between mb-3">
          <h3 class="font-bold text-base">${escapeHtml(m.name)}</h3>
          <button class="btn btn-danger text-xs" onclick="deletePaymentMethod(${m.id})">🗑</button>
        </div>
        ${m.qr_image_url ? `<img src="${safeUrl(m.qr_image_url)}" class="w-32 mx-auto rounded-xl mb-3" alt="">` : ''}
        ${m.account_name ? `<p class="text-sm"><span class="text-gray-500">အမည်:</span> ${escapeHtml(m.account_name)}</p>` : ''}
        ${m.account_number ? `<p class="text-sm"><span class="text-gray-500">နံပါတ်:</span> ${escapeHtml(m.account_number)}</p>` : ''}
        ${m.instructions ? `<p class="text-xs text-gray-500 mt-2">${escapeHtml(m.instructions)}</p>` : ''}
      </div>`).join('')
    : '<p class="text-gray-400 col-span-3 text-center py-8">ငွေပေးချေနည်း မထည့်ရသေးပါ</p>';
}

function showPaymentMethodModal() {
  document.getElementById('modal-container').innerHTML = `
    <div class="modal-overlay" onclick="closeModal()">
      <div class="modal-box" onclick="event.stopPropagation()">
        <div class="flex justify-between items-center mb-5"><h3 class="font-bold text-lg">🏦 ငွေပေးချေနည်း ထည့်ရန်</h3><button onclick="closeModal()" class="text-xl">&times;</button></div>
        <form id="pm-form" onsubmit="submitPaymentMethod(event)">
          <div class="mb-3"><label class="form-label">အမည် (ဥပမာ: KBZ Pay)</label><input class="form-input" name="name" required></div>
          <div class="mb-3"><label class="form-label">အကောင့် အမည်</label><input class="form-input" name="account_name"></div>
          <div class="mb-3"><label class="form-label">အကောင့် နံပါတ်</label><input class="form-input" name="account_number"></div>
          <div class="mb-3"><label class="form-label">QR ပုံ</label><input type="file" name="qr_image" accept="image/*" class="form-input" style="padding:8px;"></div>
          <div class="mb-4"><label class="form-label">လမ်းညွှန်ချက်</label><textarea class="form-input" name="instructions" rows="2"></textarea></div>
          <button type="submit" class="btn btn-primary w-full">သိမ်းဆည်းရန်</button>
        </form>
      </div>
    </div>`;
}

async function submitPaymentMethod(e) {
  e.preventDefault();
  const fd = new FormData(e.target);
  const res = await fetch(API + '/admin/payment-methods', { method: 'POST', headers: { 'X-Admin-Password': adminPassword }, body: fd });
  if (!res.ok) { showToast('Upload failed'); return; }
  closeModal(); showToast('ထည့်သွင်းပြီးပါပြီ'); loadPaymentMethods();
}

async function deletePaymentMethod(id) {
  if (!confirm('ဖျက်မှာ သေချာပါသလား?')) return;
  await adminApi(`/admin/payment-methods/${id}`, { method: 'DELETE' });
  showToast('ဖျက်ပြီးပါပြီ'); loadPaymentMethods();
}

// --- ROADMAPS ---
async function loadRoadmaps() {
  const roadmaps = await adminApi('/roadmaps');
  document.getElementById('roadmaps-grid').innerHTML = roadmaps.sort((a,b) => (a.order_index||0) - (b.order_index||0)).map(r => `
    <div class="stat-card" style="border-left: 4px solid ${safeColor(r.color)};">
      <div class="flex items-center gap-3 mb-2">
        <span class="text-2xl">${escapeHtml(r.icon)}</span>
        <div class="flex-1"><h3 class="font-bold">${escapeHtml(r.title)}</h3><p class="text-xs text-gray-500">${escapeHtml(r.description || '')}</p><p class="text-xs text-indigo-400 mt-1">Sort: ${r.order_index || 0}</p></div>
        <div class="flex gap-1">
          <button class="btn btn-outline text-xs" onclick='showRoadmapModal(JSON.parse(decodeURIComponent('${jsonArg(r)}')))'>✏️</button>
          <button class="btn btn-danger text-xs" onclick="deleteRoadmap(${r.id})">🗑</button>
        </div>
      </div>
      <div class="flex items-center gap-2"><div class="w-4 h-4 rounded" style="background:${safeColor(r.color)}"></div><span class="text-xs text-gray-400">Order: ${r.order_index}</span></div>
    </div>`).join('');
}

function showRoadmapModal(existing) {
  const e = existing || {};
  document.getElementById('modal-container').innerHTML = `
    <div class="modal-overlay" onclick="closeModal()">
      <div class="modal-box" onclick="event.stopPropagation()">
        <div class="flex justify-between items-center mb-5"><h3 class="font-bold text-lg">${e.id ? '✏️ တည်းဖြတ်ရန်' : '🗺️ လမ်းကြောင်း ထည့်ရန်'}</h3><button onclick="closeModal()" class="text-xl">&times;</button></div>
        <div class="space-y-3">
          <div><label class="form-label">ခေါင်းစဉ်</label><input class="form-input" id="rm-title" value="${escapeAttr(e.title || '')}"></div>
          <div><label class="form-label">ဖော်ပြချက်</label><textarea class="form-input" id="rm-desc" rows="2">${escapeHtml(e.description || '')}</textarea></div>
          <div class="grid grid-cols-3 gap-3">
            <div><label class="form-label">Icon</label><input class="form-input" id="rm-icon" value="${escapeAttr(e.icon || '📚')}"></div>
            <div><label class="form-label">အရောင်</label><input type="color" class="form-input" id="rm-color" value="${safeColor(e.color || '#3390ec')}" style="padding:4px;height:42px;"></div>
            <div><label class="form-label">အစဉ်</label><input type="number" class="form-input" id="rm-order" value="${e.order_index || 0}"></div>
          </div>
          <button class="btn btn-primary w-full" onclick="saveRoadmap(${e.id || 'null'})">${e.id ? 'ပြင်ဆင်ရန်' : 'သိမ်းဆည်းရန်'}</button>
        </div>
      </div>
    </div>`;
}

async function saveRoadmap(id) {
  const data = { title: document.getElementById('rm-title').value, description: document.getElementById('rm-desc').value, icon: document.getElementById('rm-icon').value, color: document.getElementById('rm-color').value, order_index: parseInt(document.getElementById('rm-order').value) || 0 };
  if (id) await adminApi(`/admin/roadmaps/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  else await adminApi('/admin/roadmaps', { method: 'POST', body: JSON.stringify(data) });
  closeModal(); showToast('သိမ်းဆည်းပြီးပါပြီ'); loadRoadmaps();
}

async function deleteRoadmap(id) {
  if (!confirm('ဖျက်မှာ သေချာပါသလား?')) return;
  await adminApi(`/admin/roadmaps/${id}`, { method: 'DELETE' });
  showToast('ဖျက်ပြီးပါပြီ'); loadRoadmaps();
}

// --- COURSES ---
async function loadCourses() {
  const [courses, roadmaps] = await Promise.all([adminApi('/admin/courses'), adminApi('/roadmaps')]);
  const rmMap = {}; roadmaps.forEach(r => rmMap[r.id] = r.title);
  document.getElementById('courses-table').innerHTML = `<table>
    <thead><tr><th>#</th><th>ခေါင်းစဉ်</th><th>လမ်းကြောင်း</th><th>စျေးနှုန်း</th><th>အဆင့်</th><th>Status</th><th>Sort</th><th>လုပ်ဆောင်ချက်</th></tr></thead>
    <tbody>${courses.sort((a,b) => (a.order_index||0) - (b.order_index||0)).map(c => `<tr>
      <td>${c.id}</td>
      <td class="font-medium">${escapeHtml(c.title)}</td>
      <td class="text-xs">${escapeHtml(rmMap[c.roadmap_id] || '-')}</td>
      <td>${formatMMK(c.price_mmk)}${c.price_usdt ? `<br><span class="text-xs text-indigo-500">$${c.price_usdt} USDT</span>` : ''}</td>
      <td class="text-xs">${escapeHtml(c.difficulty)}</td>
      <td><span class="badge ${c.is_published ? 'badge-green' : 'badge-yellow'}">${c.is_published ? 'Published' : 'Draft'}</span></td>
      <td class="text-center"><span class="text-xs text-gray-500">${c.order_index || 0}</span></td>
      <td><div class="flex gap-1">
        <button class="btn btn-outline text-xs" onclick='showCourseModal(JSON.parse(decodeURIComponent('${jsonArg(c)}')))'>✏️</button>
        <button class="btn btn-outline text-xs" onclick="toggleCoursePublish(${c.id}, ${!c.is_published})">${c.is_published ? 'Unpublish' : 'Publish'}</button>
        <button class="btn btn-danger text-xs" onclick="deleteCourse(${c.id})">🗑</button>
      </div></td>
    </tr>`).join('')}</tbody></table>`;
}

async function showCourseModal(existing) {
  const e = existing || {};
  const roadmaps = await adminApi('/roadmaps');
  document.getElementById('modal-container').innerHTML = `
    <div class="modal-overlay" onclick="closeModal()">
      <div class="modal-box" onclick="event.stopPropagation()">
        <div class="flex justify-between items-center mb-5"><h3 class="font-bold text-lg">${e.id ? '✏️ သင်တန်း တည်းဖြတ်ရန်' : '📖 သင်တန်း ထည့်ရန်'}</h3><button onclick="closeModal()" class="text-xl">&times;</button></div>
        <div class="space-y-3">
          <div><label class="form-label">ခေါင်းစဉ်</label><input class="form-input" id="c-title" value="${escapeAttr(e.title || '')}"></div>
          <div><label class="form-label">ဖော်ပြချက်</label><textarea class="form-input" id="c-desc" rows="2">${escapeHtml(e.description || '')}</textarea></div>
          <div class="grid grid-cols-3 gap-3">
            <div><label class="form-label">စျေးနှုန်း (MMK)</label><input type="number" class="form-input" id="c-price" value="${e.price_mmk || 0}"></div>
            <div><label class="form-label">Crypto Price (USDT)</label><input type="number" step="0.01" class="form-input" id="c-price-usdt" value="${e.price_usdt || ''}" placeholder="e.g. 5.00"></div>
            <div><label class="form-label">လမ်းကြောင်း</label><select class="form-input" id="c-roadmap">
              <option value="">ရွေးပါ</option>
              ${roadmaps.map(r => `<option value="${r.id}" ${e.roadmap_id == r.id ? 'selected' : ''}>${escapeHtml(r.title)}</option>`).join('')}
            </select></div>
          </div>
          <div class="grid grid-cols-3 gap-3">
            <div><label class="form-label">အဆင့်</label><select class="form-input" id="c-difficulty">
              <option value="beginner" ${e.difficulty === 'beginner' ? 'selected' : ''}>အခြေခံ</option>
              <option value="intermediate" ${e.difficulty === 'intermediate' ? 'selected' : ''}>အလယ်တန်း</option>
              <option value="advanced" ${e.difficulty === 'advanced' ? 'selected' : ''}>အဆင့်မြင့်</option>
            </select></div>
            <div><label class="form-label">ကြာချိန် (hr)</label><input type="number" class="form-input" id="c-duration" value="${e.duration_hours || ''}"></div>
            <div><label class="form-label">အစဉ်</label><input type="number" class="form-input" id="c-order" value="${e.order_index || 0}"></div>
          </div>
          <div><label class="form-label">Telegram Group ID</label><input class="form-input" id="c-group" value="${escapeAttr(e.telegram_group_id || '')}" placeholder="-100xxxxxxxxxx"></div>
          <button class="btn btn-primary w-full" onclick="saveCourse(${e.id || 'null'})">${e.id ? 'ပြင်ဆင်ရန်' : 'သိမ်းဆည်းရန်'}</button>
        </div>
      </div>
    </div>`;
}

async function saveCourse(id) {
  const data = {
    title: document.getElementById('c-title').value,
    description: document.getElementById('c-desc').value,
    price_mmk: parseInt(document.getElementById('c-price').value) || 0,
    price_usdt: document.getElementById('c-price-usdt').value ? parseFloat(document.getElementById('c-price-usdt').value) : null,
    roadmap_id: document.getElementById('c-roadmap').value || null,
    difficulty: document.getElementById('c-difficulty').value,
    duration_hours: document.getElementById('c-duration').value ? parseInt(document.getElementById('c-duration').value) : null,
    order_index: parseInt(document.getElementById('c-order').value) || 0,
    telegram_group_id: document.getElementById('c-group').value || null,
  };
  if (id) await adminApi(`/admin/courses/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  else await adminApi('/admin/courses', { method: 'POST', body: JSON.stringify(data) });
  closeModal(); showToast('သိမ်းဆည်းပြီးပါပြီ'); loadCourses();
}

async function toggleCoursePublish(id, publish) {
  await adminApi(`/admin/courses/${id}/publish`, { method: 'PUT', body: JSON.stringify({ is_published: publish }) });
  showToast(publish ? 'Published' : 'Unpublished'); loadCourses();
}

async function deleteCourse(id) {
  if (!confirm('ဖျက်မှာ သေချာပါသလား?')) return;
  await adminApi(`/admin/courses/${id}`, { method: 'DELETE' });
  showToast('ဖျက်ပြီးပါပြီ'); loadCourses();
}

// --- CONTENT (Modules & Lessons) ---
async function loadContentPage() {
  const courses = await adminApi('/admin/courses');
  const sel = document.getElementById('content-course-select');
  sel.innerHTML = '<option value="">သင်တန်း ရွေးပါ...</option>' + courses.map(c => `<option value="${c.id}">${escapeHtml(c.title)}</option>`).join('');
}

async function loadCourseContent(courseId) {
  if (!courseId) { document.getElementById('content-area').innerHTML = ''; return; }
  const modules = await fetch(API + `/courses/${courseId}/modules`, { headers: adminHeaders() }).then(r => r.json());
  let html = `<button class="btn btn-primary mb-4 text-sm" onclick="showModuleModal(${courseId})">+ Module ထည့်ရန်</button>`;
  modules.forEach(m => {
    html += `<div class="stat-card mb-4">
      <div class="flex items-center justify-between mb-3">
        <h3 class="font-bold text-sm">📁 ${escapeHtml(m.title)}</h3>
        <div class="flex gap-1">
          <button class="btn btn-outline text-xs" onclick="reorderModule(${m.id}, 'up', ${courseId})">↑</button><button class="btn btn-outline text-xs" onclick="reorderModule(${m.id}, 'down', ${courseId})">↓</button><button class="btn btn-primary text-xs" onclick="showLessonModal(${m.id})">+ Lesson</button>
          <button class="btn btn-danger text-xs" onclick="deleteModule(${m.id}, ${courseId})">🗑</button>
        </div>
      </div>`;
    if (m.lessons && m.lessons.length > 0) {
      m.lessons.forEach(l => {
        html += `<div class="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50">
          <div><span class="text-sm">${escapeHtml(l.title)}</span>
            <div class="flex gap-2 mt-1">${l.video_url ? '<span class="text-xs text-blue-500">🎬 Video</span>' : ''}${l.file_url ? '<span class="text-xs text-green-500">📎 File</span>' : ''}</div>
          </div>
          <div class="flex gap-1">
            <button class="btn btn-outline text-xs" onclick="reorderLesson(${l.id}, '${courseId}', 'up')">↑</button>
            <button class="btn btn-outline text-xs" onclick="reorderLesson(${l.id}, '${courseId}', 'down')">↓</button>
            <button class="btn btn-outline text-xs" onclick="duplicateLesson(${l.id}, '${courseId}')">⧉</button>
            <button class="btn btn-outline text-xs" onclick='previewLesson(JSON.parse(decodeURIComponent('${jsonArg(l)}')))'>👁</button>
            <button class="btn btn-outline text-xs" onclick='showLessonEditModal(JSON.parse(decodeURIComponent('${jsonArg(l)}')), ${m.id})'>✏️</button>
            <button class="btn btn-danger text-xs" onclick="deleteLesson(${l.id}, ${courseId})">🗑</button>
          </div>
        </div>`;
      });
    } else {
      html += '<p class="text-xs text-gray-400 text-center py-3">သင်ခန်းစာ မရှိသေးပါ</p>';
    }
    html += '</div>';
  });
  if (modules.length === 0) html += '<p class="text-gray-400 text-center py-8">Module မရှိသေးပါ</p>';
  document.getElementById('content-area').innerHTML = html;
}

function showModuleModal(courseId) {
  document.getElementById('modal-container').innerHTML = `
    <div class="modal-overlay" onclick="closeModal()">
      <div class="modal-box" onclick="event.stopPropagation()">
        <div class="flex justify-between items-center mb-5"><h3 class="font-bold">📁 Module ထည့်ရန်</h3><button onclick="closeModal()" class="text-xl">&times;</button></div>
        <div class="space-y-3">
          <div><label class="form-label">ခေါင်းစဉ်</label><input class="form-input" id="mod-title"></div>
          <div><label class="form-label">အစဉ်</label><input type="number" class="form-input" id="mod-order" value="0"></div>
          <button class="btn btn-primary w-full" onclick="saveModule(${courseId})">သိမ်းဆည်းရန်</button>
        </div>
      </div>
    </div>`;
}

async function saveModule(courseId) {
  await adminApi('/admin/modules', { method: 'POST', body: JSON.stringify({ course_id: courseId, title: document.getElementById('mod-title').value, order_index: parseInt(document.getElementById('mod-order').value) || 0 }) });
  closeModal(); showToast('ထည့်သွင်းပြီးပါပြီ'); loadCourseContent(courseId);
}

async function deleteModule(id, courseId) {
  if (!confirm('Module နှင့် lessons အားလုံး ဖျက်မှာ သေချာပါသလား?')) return;
  await adminApi(`/admin/modules/${id}`, { method: 'DELETE' });
  showToast('ဖျက်ပြီးပါပြီ'); loadCourseContent(courseId);
}

function previewLesson(lesson) {
  document.getElementById('modal-container').innerHTML = `<div class="modal-overlay" onclick="closeModal()"><div class="modal-box" onclick="event.stopPropagation()"><div class="flex justify-between items-center mb-5"><h3 class="font-bold">👁 ${escapeHtml(lesson.title)}</h3><button onclick="closeModal()" class="text-xl">&times;</button></div><div class="text-sm leading-7">${escapeHtml(lesson.content || 'No content').replace(/\n/g, '<br>')}</div></div></div>`;
}

function showLessonModal(moduleId) {
  document.getElementById('modal-container').innerHTML = `
    <div class="modal-overlay" onclick="closeModal()">
      <div class="modal-box" onclick="event.stopPropagation()">
        <div class="flex justify-between items-center mb-5"><h3 class="font-bold">📝 သင်ခန်းစာ ထည့်ရန်</h3><button onclick="closeModal()" class="text-xl">&times;</button></div>
        <div class="space-y-3">
          <div><label class="form-label">ခေါင်းစဉ်</label><input class="form-input" id="les-title"></div>
          <div><label class="form-label">အကြောင်းအရာ</label><textarea class="form-input" id="les-content" rows="4"></textarea></div>
          <div><label class="form-label">Video URL</label><input class="form-input" id="les-video" placeholder="YouTube link"></div>
          <div><label class="form-label">File URL</label><input class="form-input" id="les-file" placeholder="ဖိုင် link"></div>
          <label class="flex items-center gap-2 text-sm"><input type="checkbox" id="les-preview"> Free preview lesson</label>
          <div><label class="form-label">အစဉ်</label><input type="number" class="form-input" id="les-order" value="0"></div>
          <button class="btn btn-primary w-full" onclick="saveLesson(${moduleId})">သိမ်းဆည်းရန်</button>
        </div>
      </div>
    </div>`;
}

function showLessonEditModal(lesson, moduleId) {
  document.getElementById('modal-container').innerHTML = `
    <div class="modal-overlay" onclick="closeModal()">
      <div class="modal-box" onclick="event.stopPropagation()">
        <div class="flex justify-between items-center mb-5"><h3 class="font-bold">✏️ သင်ခန်းစာ တည်းဖြတ်ရန်</h3><button onclick="closeModal()" class="text-xl">&times;</button></div>
        <div class="space-y-3">
          <div><label class="form-label">ခေါင်းစဉ်</label><input class="form-input" id="les-title" value="${escapeAttr(lesson.title)}"></div>
          <div><label class="form-label">အကြောင်းအရာ</label><textarea class="form-input" id="les-content" rows="4">${escapeHtml(lesson.content || '')}</textarea></div>
          <div><label class="form-label">Video URL</label><input class="form-input" id="les-video" value="${escapeAttr(lesson.video_url || '')}"></div>
          <div><label class="form-label">File URL</label><input class="form-input" id="les-file" value="${escapeAttr(lesson.file_url || '')}"></div>
          <label class="flex items-center gap-2 text-sm"><input type="checkbox" id="les-preview" ${lesson.is_preview ? 'checked' : ''}> Free preview lesson</label>
          <div><label class="form-label">အစဉ်</label><input type="number" class="form-input" id="les-order" value="${lesson.order_index || 0}"></div>
          <button class="btn btn-primary w-full" onclick="updateLesson(${lesson.id})">ပြင်ဆင်ရန်</button>
        </div>
      </div>
    </div>`;
}

async function saveLesson(moduleId) {
  const courseId = document.getElementById('content-course-select').value;
  await adminApi('/admin/lessons', { method: 'POST', body: JSON.stringify({ module_id: moduleId, title: document.getElementById('les-title').value, content: document.getElementById('les-content').value, video_url: document.getElementById('les-video').value || null, file_url: document.getElementById('les-file').value || null, order_index: parseInt(document.getElementById('les-order').value) || 0, is_preview: document.getElementById('les-preview')?.checked || false }) });
  closeModal(); showToast('ထည့်သွင်းပြီးပါပြီ'); loadCourseContent(courseId);
}

async function updateLesson(id) {
  const courseId = document.getElementById('content-course-select').value;
  await adminApi(`/admin/lessons/${id}`, { method: 'PUT', body: JSON.stringify({ title: document.getElementById('les-title').value, content: document.getElementById('les-content').value, video_url: document.getElementById('les-video').value || null, file_url: document.getElementById('les-file').value || null, order_index: parseInt(document.getElementById('les-order').value) || 0, is_preview: document.getElementById('les-preview')?.checked || false }) });
  closeModal(); showToast('ပြင်ဆင်ပြီးပါပြီ'); loadCourseContent(courseId);
}

async function duplicateLesson(id, courseId) {
  await adminApi(`/admin/lessons/${id}/duplicate`, { method: 'POST' });
  showToast('Lesson duplicated'); loadCourseContent(courseId);
}
async function reorderLesson(id, courseId, direction) {
  await adminApi(`/admin/lessons/${id}/reorder`, { method: 'POST', body: JSON.stringify({ direction }) });
  loadCourseContent(courseId);
}

async function deleteLesson(id, courseId) {
  if (!confirm('ဖျက်မှာ သေချာပါသလား?')) return;
  await adminApi(`/admin/lessons/${id}`, { method: 'DELETE' });
  showToast('ဖျက်ပြီးပါပြီ'); loadCourseContent(courseId);
}

// --- ANNOUNCEMENTS ---
async function loadAnnouncements() {
  const data = await adminApi('/announcements');
  document.getElementById('announcements-list').innerHTML = data.length > 0
    ? data.map(a => `<div class="stat-card">
        <div class="flex items-start justify-between">
          <div><h3 class="font-bold text-sm">${escapeHtml(a.title)}</h3><p class="text-xs text-gray-500 mt-1">${escapeHtml(a.content)}</p>
            ${a.courses?.title ? `<span class="badge badge-blue text-xs mt-2">${escapeHtml(a.courses.title)}</span>` : '<span class="badge text-xs mt-2" style="background:#f1f5f9;color:#64748b;">Global</span>'}
            <p class="text-xs text-gray-400 mt-1">${new Date(a.created_at).toLocaleString()}</p>
          </div>
          <button class="btn btn-danger text-xs" onclick="deleteAnnouncement(${a.id})">🗑</button>
        </div>
      </div>`).join('')
    : '<p class="text-gray-400 text-center py-8">ကြေညာချက် မရှိသေးပါ</p>';
}

async function showAnnouncementModal() {
  const courses = await adminApi('/admin/courses');
  document.getElementById('modal-container').innerHTML = `
    <div class="modal-overlay" onclick="closeModal()">
      <div class="modal-box" onclick="event.stopPropagation()">
        <div class="flex justify-between items-center mb-5"><h3 class="font-bold">📢 ကြေညာချက် ထည့်ရန်</h3><button onclick="closeModal()" class="text-xl">&times;</button></div>
        <div class="space-y-3">
          <div><label class="form-label">ခေါင်းစဉ်</label><input class="form-input" id="ann-title"></div>
          <div><label class="form-label">အကြောင်းအရာ</label><textarea class="form-input" id="ann-content" rows="3"></textarea></div>
          <div><label class="form-label">သင်တန်း (ချန်ထားပါက Global)</label><select class="form-input" id="ann-course">
            <option value="">Global - အားလုံး</option>
            ${courses.map(c => `<option value="${c.id}">${escapeHtml(c.title)}</option>`).join('')}
          </select></div>
          <label class="flex items-center gap-2 text-sm"><input type="checkbox" id="ann-push"> Push to users via bot</label>
          <button class="btn btn-primary w-full" onclick="saveAnnouncement()">သိမ်းဆည်းရန်</button>
        </div>
      </div>
    </div>`;
}

async function saveAnnouncement() {
  await adminApi('/admin/announcements', { method: 'POST', body: JSON.stringify({ title: document.getElementById('ann-title').value, content: document.getElementById('ann-content').value, course_id: document.getElementById('ann-course').value || null, push_to_users: document.getElementById('ann-push').checked }) });
  closeModal(); showToast('ကြေညာချက် ထည့်ပြီးပါပြီ'); loadAnnouncements();
}

async function deleteAnnouncement(id) {
  if (!confirm('ဖျက်မှာ သေချာပါသလား?')) return;
  await adminApi(`/admin/announcements/${id}`, { method: 'DELETE' });
  showToast('ဖျက်ပြီးပါပြီ'); loadAnnouncements();
}

// --- USERS ---
async function loadUsers() {
  const users = await adminApi('/admin/users');
  document.getElementById('users-table').innerHTML = `<table>
    <thead><tr><th>ID</th><th>Telegram ID</th><th>အမည်</th><th>Username</th><th>ပူးပေါင်းသည့်ရက်</th></tr></thead>
    <tbody>${users.map(u => `<tr>
      <td>${u.id}</td><td>${u.telegram_id}</td><td class="font-medium">${escapeHtml((u.first_name || '') + ' ' + (u.last_name || ''))}</td>
      <td>@${escapeHtml(u.username || '-')}</td><td class="text-xs">${new Date(u.created_at).toLocaleString()}</td>
    </tr>`).join('')}</tbody></table>`;
}

// --- ANALYTICS ---
async function loadAnalytics() {
  const data = await adminApi('/admin/analytics');
  const months = Object.keys(data.monthlyRevenue).sort();
  const maxRev = Math.max(...Object.values(data.monthlyRevenue), 1);

  let html = `<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
    <div class="stat-card">
      <h3 class="font-bold text-sm mb-4">💰 လစဉ် ဝင်ငွေ (MMK)</h3>
      ${months.length > 0 ? `
        <div class="chart-bar">${months.map(m => `<div class="flex flex-col items-center flex-1">
          <div class="chart-bar-item w-full" style="height:${Math.max((data.monthlyRevenue[m] / maxRev) * 100, 4)}%;" title="${formatMMK(data.monthlyRevenue[m])}"></div>
          <span class="text-xs text-gray-400 mt-1">${m.substring(5)}</span>
        </div>`).join('')}</div>
        <div class="mt-3 space-y-1">${months.map(m => `<div class="flex justify-between text-xs"><span class="text-gray-500">${m}</span><span class="font-bold">${formatMMK(data.monthlyRevenue[m])}</span></div>`).join('')}</div>
      ` : '<p class="text-gray-400 text-center py-6">ဒေတာ မရှိသေးပါ</p>'}
    </div>
    <div class="stat-card">
      <h3 class="font-bold text-sm mb-4">📖 သင်တန်းအလိုက် ဝင်ငွေ</h3>
      ${Object.keys(data.courseRevenue).length > 0 ? `
        <div class="space-y-2">${Object.entries(data.courseRevenue).sort((a, b) => b[1] - a[1]).map(([name, rev]) => `
          <div class="flex items-center gap-3">
            <span class="text-sm flex-1 truncate">${escapeHtml(name)}</span>
            <span class="font-bold text-sm">${formatMMK(rev)}</span>
          </div>`).join('')}</div>
      ` : '<p class="text-gray-400 text-center py-6">ဒေတာ မရှိသေးပါ</p>'}
    </div>
    <div class="stat-card">
      <h3 class="font-bold text-sm mb-4">📝 လစဉ် စာရင်းသွင်းမှု</h3>
      ${months.length > 0 ? `<div class="space-y-1">${months.map(m => `<div class="flex justify-between text-xs"><span class="text-gray-500">${m}</span><span class="font-bold">${data.monthlyEnrollments[m] || 0} ခု</span></div>`).join('')}</div>` : '<p class="text-gray-400 text-center py-6">ဒေတာ မရှိသေးပါ</p>'}
    </div>
    <div class="stat-card">
      <h3 class="font-bold text-sm mb-4">👥 လစဉ် အသုံးပြုသူ အသစ်</h3>
      ${Object.keys(data.monthlyUsers).length > 0 ? `<div class="space-y-1">${Object.entries(data.monthlyUsers).sort().map(([m, cnt]) => `<div class="flex justify-between text-xs"><span class="text-gray-500">${m}</span><span class="font-bold">${cnt} ဦး</span></div>`).join('')}</div>` : '<p class="text-gray-400 text-center py-6">ဒေတာ မရှိသေးပါ</p>'}
    </div>
  </div>`;
  document.getElementById('analytics-content').innerHTML = html;
}

// --- CSV EXPORT ---
async function exportCSV(type) {
  try {
    const blob = await adminApi(`/admin/export/${type}`);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${type}_export.csv`; a.click();
    URL.revokeObjectURL(url);
    showToast('CSV ဒေါင်းလုဒ် လုပ်ပြီးပါပြီ');
  } catch (e) { showToast('Export မအောင်မြင်ပါ'); }
}

// --- COUPONS ---
async function loadCoupons() {
  const coupons = await adminApi('/admin/coupons');
  const el = document.getElementById('coupons-table');
  if (!coupons || coupons.length === 0) {
    el.innerHTML = '<p class="text-gray-400 text-center py-8">ကူပွန် မရှိသေးပါ</p>';
    return;
  }
  el.innerHTML = `<table>
    <thead><tr><th>Code</th><th>Type</th><th>Discount</th><th>Course</th><th>Uses</th><th>Expires</th><th>Status</th><th>Actions</th></tr></thead>
    <tbody>${coupons.map(c => {
      const discountText = c.type === 'fixed' ? formatMMK(c.discount_amount) : `${c.discount_percent}%`;
      const stCls = c.is_active ? 'badge-green' : 'badge-red';
      const stText = c.is_active ? 'Active' : 'Inactive';
      return `<tr>
        <td><code class="font-bold text-indigo-600">${escapeHtml(c.code)}</code></td>
        <td><span class="badge badge-blue">${escapeHtml(c.type)}</span></td>
        <td class="font-medium">${discountText}</td>
        <td class="text-xs">${escapeHtml(c.courses?.title || 'All Courses')}</td>
        <td>${c.used_count}/${c.max_uses}</td>
        <td class="text-xs">${c.expires_at ? new Date(c.expires_at).toLocaleDateString() : 'Never'}</td>
        <td><span class="badge ${stCls}">${stText}</span></td>
        <td><div class="flex gap-1">
          <button class="btn btn-outline text-xs" onclick="toggleCoupon(${c.id}, ${!c.is_active})">${c.is_active ? 'Disable' : 'Enable'}</button>
          <button class="btn btn-danger text-xs" onclick="deleteCoupon(${c.id})">🗑</button>
        </div></td>
      </tr>`;
    }).join('')}</tbody></table>`;
}

function showCouponModal() {
  adminApi('/courses').then(courses => {
    document.getElementById('modal-container').innerHTML = `
      <div class="modal-overlay" onclick="closeModal()">
        <div class="modal-box" onclick="event.stopPropagation()">
          <div class="flex justify-between items-center mb-5"><h3 class="font-bold text-lg">🎟️ ကူပွန် ထည့်ရန်</h3><button onclick="closeModal()" class="text-xl">&times;</button></div>
          <div class="space-y-3">
            <div><label class="form-label">Code</label><input class="form-input" id="cp-code" placeholder="e.g. WELCOME50" style="text-transform:uppercase;"></div>
            <div class="grid grid-cols-2 gap-3">
              <div><label class="form-label">Type</label><select class="form-input" id="cp-type" onchange="couponTypeChanged()">
                <option value="fixed">Fixed Amount (MMK)</option>
                <option value="percent">Percentage (%)</option>
                <option value="referral">Referral Code</option>
              </select></div>
              <div id="cp-amount-wrap"><label class="form-label">Discount (MMK)</label><input type="number" class="form-input" id="cp-amount" value="0"></div>
              <div id="cp-percent-wrap" style="display:none;"><label class="form-label">Discount (%)</label><input type="number" class="form-input" id="cp-percent" value="0" min="1" max="100"></div>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div><label class="form-label">Max Uses</label><input type="number" class="form-input" id="cp-max-uses" value="1" min="1"></div>
              <div><label class="form-label">Expires (optional)</label><input type="date" class="form-input" id="cp-expires"></div>
            </div>
            <div><label class="form-label">Course (optional - leave empty for all)</label><select class="form-input" id="cp-course">
              <option value="">All Courses</option>
              ${courses.map(c => `<option value="${c.id}">${escapeHtml(c.title)}</option>`).join('')}
            </select></div>
            <button class="btn btn-primary w-full" onclick="saveCoupon()">သိမ်းဆည်းရန်</button>
          </div>
        </div>
      </div>`;
  });
}

function couponTypeChanged() {
  const type = document.getElementById('cp-type').value;
  document.getElementById('cp-amount-wrap').style.display = type === 'fixed' ? '' : 'none';
  document.getElementById('cp-percent-wrap').style.display = (type === 'percent' || type === 'referral') ? '' : 'none';
}

async function saveCoupon() {
  const type = document.getElementById('cp-type').value;
  const data = {
    code: document.getElementById('cp-code').value,
    type,
    discount_amount: type === 'fixed' ? parseInt(document.getElementById('cp-amount').value) || 0 : 0,
    discount_percent: (type === 'percent' || type === 'referral') ? parseInt(document.getElementById('cp-percent').value) || 0 : 0,
    max_uses: parseInt(document.getElementById('cp-max-uses').value) || 1,
    course_id: document.getElementById('cp-course').value || null,
    expires_at: document.getElementById('cp-expires').value ? new Date(document.getElementById('cp-expires').value).toISOString() : null,
  };
  try {
    await adminApi('/admin/coupons', { method: 'POST', body: JSON.stringify(data) });
    closeModal(); showToast('ကူပွန် ထည့်ပြီးပါပြီ'); loadCoupons();
  } catch (e) { showToast('Error: ' + e.message); }
}

async function toggleCoupon(id, active) {
  await adminApi(`/admin/coupons/${id}`, { method: 'PUT', body: JSON.stringify({ is_active: active }) });
  showToast(active ? 'Enabled' : 'Disabled'); loadCoupons();
}

async function deleteCoupon(id) {
  document.getElementById('modal-container').innerHTML = `
    <div class="modal-overlay" onclick="closeModal()">
      <div class="modal-box" onclick="event.stopPropagation()" style="max-width:400px;">
        <div class="flex justify-between items-center mb-4"><h3 class="font-bold">ကူပွန် ဖျက်ရန်</h3><button onclick="closeModal()" class="text-xl">&times;</button></div>
        <p class="text-sm text-gray-600 mb-4">ဤ ကူပွန်ကို ဖျက်မှာ သေချာပါသလား?</p>
        <div class="flex gap-2">
          <button class="btn btn-danger flex-1" onclick="doDeleteCoupon(${id})">ဖျက်ရန်</button>
          <button class="btn btn-outline flex-1" onclick="closeModal()">ပယ်ဖျက်ရန်</button>
        </div>
      </div>
    </div>`;
}

async function doDeleteCoupon(id) {
  closeModal();
  await adminApi(`/admin/coupons/${id}`, { method: 'DELETE' });
  showToast('ဖျက်ပြီးပါပြီ'); loadCoupons();
}

// --- SECURITY ---
async function loadSecurity() {
  const [events, bans, bannedIps, certRequests, auditLogs] = await Promise.all([adminApi('/admin/security-events'), adminApi('/admin/banned-users'), adminApi('/admin/banned-ips'), adminApi('/admin/certificate-requests'), adminApi('/admin/audit-logs')]);
  document.getElementById('banned-users-table').innerHTML = bans.length ? `<table><thead><tr><th>Telegram ID</th><th>Reason</th><th>Date</th><th></th></tr></thead><tbody>${bans.map(b => `<tr><td>${b.telegram_id}</td><td>${escapeHtml(b.reason || '')}</td><td class="text-xs">${new Date(b.created_at).toLocaleString()}</td><td><button class="btn btn-outline text-xs" onclick="unbanTelegramUser(${b.telegram_id})">Unban</button></td></tr>`).join('')}</tbody></table>` : '<p class="text-gray-400 text-center py-6">No banned users</p>';
  document.getElementById('banned-ips-table').innerHTML = bannedIps.length ? `<table><thead><tr><th>IP Hash</th><th>Reason</th><th>Date</th><th></th></tr></thead><tbody>${bannedIps.map(b => `<tr><td class="text-xs">${escapeHtml((b.ip_hash || '').slice(0, 18))}…</td><td>${escapeHtml(b.reason || '')}</td><td class="text-xs">${new Date(b.created_at).toLocaleString()}</td><td><button class="btn btn-outline text-xs" onclick="unbanIpHash('${escapeAttr(b.ip_hash)}')">Unban</button></td></tr>`).join('')}</tbody></table>` : '<p class="text-gray-400 text-center py-6">No banned IP hashes</p>';
  document.getElementById('security-events-table').innerHTML = events.length ? `<table><thead><tr><th>Type</th><th>TG ID</th><th>Reason</th><th>Date</th></tr></thead><tbody>${events.map(e => `<tr><td>${escapeHtml(e.event_type)}</td><td>${e.telegram_id || '-'}</td><td class="text-xs">${escapeHtml(e.reason || '')}</td><td class="text-xs">${new Date(e.created_at).toLocaleString()}</td></tr>`).join('')}</tbody></table>` : '<p class="text-gray-400 text-center py-6">No events</p>';
  document.getElementById('certificate-requests-table').innerHTML = certRequests.length ? `<table><thead><tr><th>ID</th><th>User</th><th>Certificate</th><th>Status</th><th>Date</th><th>Actions</th></tr></thead><tbody>${certRequests.map(r => `<tr><td>#${r.id}</td><td>${escapeHtml(r.users?.first_name || '')}</td><td>${escapeHtml(r.certificates?.certificate_number || r.certificate_number || '-')}<br><span class="text-xs text-gray-400">${escapeHtml(r.certificates?.courses?.title || '')}</span></td><td>${statusBadge(r.status)}</td><td class="text-xs">${new Date(r.created_at).toLocaleString()}</td><td>${r.status === 'pending' ? `<button class="btn btn-success text-xs" onclick="reviewCertificateRequest(${r.id}, 'approved')">Approve</button> <button class="btn btn-danger text-xs" onclick="reviewCertificateRequest(${r.id}, 'rejected')">Reject</button>` : '-'}</td></tr>`).join('')}</tbody></table>` : '<p class="text-gray-400 text-center py-6">No certificate requests</p>';
  document.getElementById('audit-log-table').innerHTML = auditLogs.length ? `<table><thead><tr><th>Action</th><th>Target</th><th>Note</th><th>Date</th></tr></thead><tbody>${auditLogs.map(a => `<tr><td>${escapeHtml(a.action)}</td><td>${escapeHtml(a.target_type || '')} #${escapeHtml(a.target_id || '')}</td><td class="text-xs">${escapeHtml(a.note || '')}</td><td class="text-xs">${new Date(a.created_at).toLocaleString()}</td></tr>`).join('')}</tbody></table>` : '<p class="text-gray-400 text-center py-6">No audit logs</p>';
}

async function reviewCertificateRequest(id, status) {
  const admin_note = status === 'rejected' ? prompt('Reason (optional)') || '' : '';
  await adminApi(`/admin/certificate-requests/${id}/review`, { method: 'POST', body: JSON.stringify({ status, admin_note }) });
  showToast(`Certificate request ${status}`); loadSecurity();
}
async function banTelegramUser() {
  await adminApi('/admin/banned-users', { method: 'POST', body: JSON.stringify({ telegram_id: document.getElementById('ban-telegram-id').value, reason: document.getElementById('ban-reason').value }) });
  showToast('User banned'); loadSecurity();
}
async function unbanTelegramUser(id) {
  await adminApi(`/admin/banned-users/${id}`, { method: 'DELETE' });
  showToast('User unbanned'); loadSecurity();
}
async function unbanIpHash(hash) {
  await adminApi(`/admin/banned-ips/${hash}`, { method: 'DELETE' });
  showToast('IP hash unbanned'); loadSecurity();
}

// --- SETTINGS ---
async function loadSettings() {
  try {
    const settings = await adminApi('/admin/settings');

    // Language buttons
    const langMyBtn = document.getElementById('lang-my-btn');
    const langEnBtn = document.getElementById('lang-en-btn');
    const currentLang = settings.language || 'my';
    adminLang = currentLang;
    applyAdminLanguageUI();
    langMyBtn.className = `btn ${currentLang === 'my' ? 'btn-primary' : 'btn-outline'}`;
    langEnBtn.className = `btn ${currentLang === 'en' ? 'btn-primary' : 'btn-outline'}`;

    // Payment toggles
    document.getElementById('toggle-myanmar').checked = settings.myanmar_payment_enabled !== 'false';
    document.getElementById('toggle-crypto').checked = settings.crypto_payment_enabled === 'true';
    document.getElementById('toggle-maintenance').checked = settings.maintenance_mode === 'true';
    document.getElementById('maintenance-message').value = settings.maintenance_message || '';
    document.getElementById('bot-username').value = settings.bot_username || '';
    document.getElementById('telegram-start-url').value = settings.telegram_start_url || '';
    if (document.getElementById('toggle-telegram-only')) document.getElementById('toggle-telegram-only').checked = settings.telegram_only_mode !== 'false';
    if (document.getElementById('toggle-auto-ban')) document.getElementById('toggle-auto-ban').checked = settings.auto_ban_missing_init_data === 'true';
    if (document.getElementById('auto-ban-threshold')) document.getElementById('auto-ban-threshold').value = settings.auto_ban_threshold || '5';
    if (document.getElementById('support-url')) document.getElementById('support-url').value = settings.support_url || '';
    if (document.getElementById('cert-signature')) document.getElementById('cert-signature').value = settings.certificate_signature_text || '';
    if (document.getElementById('cert-logo-url')) document.getElementById('cert-logo-url').value = settings.certificate_logo_url || '';

    // NOWPayments config
    document.getElementById('np-api-key').value = '';
    document.getElementById('np-api-key').placeholder = settings.nowpayments_api_key_configured ? 'Configured - enter a new key to replace' : 'Your NOWPayments API Key';
    document.getElementById('np-ipn-secret').value = '';
    document.getElementById('np-ipn-secret').placeholder = settings.nowpayments_ipn_secret_configured ? 'Configured - enter a new secret to replace' : 'Your NOWPayments IPN Secret';
    document.getElementById('np-accepted-coins').value = settings.nowpayments_accepted_coins || 'btc,eth,usdt,ltc,trx';

    // Load crypto payments
    loadCryptoPayments();
  } catch (e) { showToast('Settings load failed'); }
}

async function setAppLanguage(lang) {
  await adminApi('/admin/settings', { method: 'PUT', body: JSON.stringify({ language: lang }) });
  adminLang = lang; applyAdminLanguageUI(); showToast(lang === 'my' ? 'Myanmar ဘာသာ သို့ ပြောင်းပြီးပါပြီ' : 'Switched to English');
  loadSettings();
}

async function togglePaymentMethod(key, enabled) {
  const update = {};
  update[key] = enabled ? 'true' : 'false';
  await adminApi('/admin/settings', { method: 'PUT', body: JSON.stringify(update) });
  showToast(enabled ? 'Enabled' : 'Disabled');
}

async function saveAccessSettings() {
  await adminApi('/admin/settings', { method: 'PUT', body: JSON.stringify({
    maintenance_message: document.getElementById('maintenance-message').value,
    bot_username: document.getElementById('bot-username').value,
    telegram_start_url: document.getElementById('telegram-start-url').value,
    telegram_only_mode: document.getElementById('toggle-telegram-only')?.checked ? 'true' : 'false',
    auto_ban_missing_init_data: document.getElementById('toggle-auto-ban')?.checked ? 'true' : 'false',
    auto_ban_threshold: document.getElementById('auto-ban-threshold')?.value || '5',
    support_url: document.getElementById('support-url')?.value || '',
    certificate_signature_text: document.getElementById('cert-signature')?.value || '',
    certificate_logo_url: document.getElementById('cert-logo-url')?.value || '',
  }) });
  showToast('Access settings saved');
}

async function saveNowPaymentsConfig() {
  const apiKey = document.getElementById('np-api-key').value.trim();
  const ipnSecret = document.getElementById('np-ipn-secret').value.trim();
  const coins = document.getElementById('np-accepted-coins').value;
  const updates = { nowpayments_accepted_coins: coins };
  if (apiKey) updates.nowpayments_api_key = apiKey;
  if (ipnSecret) updates.nowpayments_ipn_secret = ipnSecret;
  await adminApi('/admin/settings', { method: 'PUT', body: JSON.stringify(updates) });
  showToast('NOWPayments config saved');
}

async function loadCryptoPayments() {
  try {
    const payments = await adminApi('/admin/crypto-payments');
    const el = document.getElementById('crypto-payments-table');
    if (!payments || payments.length === 0) {
      el.innerHTML = '<p class="text-gray-400 text-center py-6">No crypto payments yet</p>';
      return;
    }
    el.innerHTML = `<table>
      <thead><tr><th>ID</th><th>User</th><th>Course</th><th>Amount</th><th>Coin</th><th>Status</th><th>Date</th></tr></thead>
      <tbody>${payments.map(p => {
        const stCls = p.status === 'finished' ? 'badge-green' : ['failed', 'expired'].includes(p.status) ? 'badge-red' : 'badge-yellow';
        return `<tr>
          <td>#${p.id}</td>
          <td>${escapeHtml(p.first_name || '')} <span class="text-xs text-gray-400">@${escapeHtml(p.username || '')}</span></td>
          <td>${escapeHtml(p.course_title || '')}</td>
          <td>${escapeHtml(p.pay_amount || 0)}</td>
          <td class="uppercase font-bold text-xs">${escapeHtml(p.pay_currency || '')}</td>
          <td><span class="badge ${stCls}">${escapeHtml(p.status)}</span></td>
          <td class="text-xs">${new Date(p.created_at).toLocaleString()}</td>
        </tr>`;
      }).join('')}</tbody></table>`;
  } catch (e) {
    document.getElementById('crypto-payments-table').innerHTML = '<p class="text-gray-400 text-center py-6">Error loading crypto payments</p>';
  }
}

window.addEventListener('DOMContentLoaded', async () => {
  if (!adminSessionToken) return;
  try {
    await adminApi('/admin/stats');
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('dashboard').classList.remove('hidden');
    try { const s = await adminApi('/admin/settings'); adminLang = s.language || 'my'; applyAdminLanguageUI(); } catch (e) {}
    loadStats();
  } catch (e) {
    sessionStorage.removeItem('adminSessionToken');
    adminSessionToken = '';
  }
});
