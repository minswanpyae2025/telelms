// လမ်းစ (Lann Sa) LMS - Admin Dashboard Logic
const API = '/api';
let adminPassword = '';
let pendingCount = 0;
let allPayments = [];

function adminHeaders(json = true) {
  const h = { 'X-Admin-Password': adminPassword };
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

function statusBadge(s) {
  const m = { pending: ['badge-yellow', 'စိစစ်ဆဲ'], approved: ['badge-green', 'အတည်ပြုပြီး'], rejected: ['badge-red', 'ပယ်ချပြီး'] };
  const [cls, label] = m[s] || ['', s];
  return `<span class="badge ${cls}">${label}</span>`;
}

// --- LOGIN ---
async function doLogin() {
  const pwd = document.getElementById('login-password').value;
  try {
    const res = await fetch(API + '/admin/stats', { headers: { 'X-Admin-Password': pwd } });
    if (!res.ok) { document.getElementById('login-error').classList.remove('hidden'); return; }
    adminPassword = pwd;
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('dashboard').classList.remove('hidden');
    loadStats();
  } catch (e) { document.getElementById('login-error').classList.remove('hidden'); }
}

// --- NAVIGATION ---
function switchPage(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
  document.getElementById('page-' + page)?.classList.remove('hidden');
  document.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active'));
  document.querySelector(`[data-page="${page}"]`)?.classList.add('active');
  document.getElementById('sidebar').classList.remove('open');

  if (page === 'stats') loadStats();
  else if (page === 'payments') loadPayments();
  else if (page === 'payment-methods') loadPaymentMethods();
  else if (page === 'roadmaps') loadRoadmaps();
  else if (page === 'courses') loadCourses();
  else if (page === 'content') loadContentPage();
  else if (page === 'announcements') loadAnnouncements();
  else if (page === 'users') loadUsers();
  else if (page === 'analytics') loadAnalytics();
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

  document.getElementById('stats-grid').innerHTML = `
    <div class="stat-card"><p class="text-xs text-gray-500 mb-1">💰 စုစုပေါင်း ဝင်ငွေ</p><p class="text-2xl font-bold" style="color:#6366f1">${formatMMK(stats.totalRevenue)}</p></div>
    <div class="stat-card"><p class="text-xs text-gray-500 mb-1">👥 အသုံးပြုသူ</p><p class="text-2xl font-bold">${stats.totalUsers}</p></div>
    <div class="stat-card"><p class="text-xs text-gray-500 mb-1">📖 သင်တန်း</p><p class="text-2xl font-bold">${stats.totalCourses}</p></div>
    <div class="stat-card"><p class="text-xs text-gray-500 mb-1">⏳ စိစစ်ရန်</p><p class="text-2xl font-bold" style="color:#f59e0b">${stats.pendingPayments}</p></div>
    <div class="stat-card"><p class="text-xs text-gray-500 mb-1">📝 စာရင်းသွင်းပြီး</p><p class="text-2xl font-bold" style="color:#22c55e">${stats.approvedEnrollments}</p></div>
    <div class="stat-card"><p class="text-xs text-gray-500 mb-1">💳 ငွေပေးချေမှု စုစုပေါင်း</p><p class="text-2xl font-bold">${stats.totalPayments}</p></div>
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
      <td><span class="font-medium">${p.first_name || ''}</span><br><span class="text-xs text-gray-400">@${p.username || p.telegram_id}</span></td>
      <td>${p.course_title || ''}<br><span class="text-xs text-gray-400">${formatMMK(p.price_mmk)}</span></td>
      <td>${p.payment_method_name || '-'}</td>
      <td>${statusBadge(p.status)}</td>
      <td class="text-xs">${new Date(p.created_at).toLocaleString()}</td>
      <td>
        <div class="flex gap-1">
          <button class="btn btn-outline text-xs" onclick="viewPaymentScreenshot('${p.screenshot_url}')">📸</button>
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
        <img src="${url}" class="w-full rounded-xl">
      </div>
    </div>`;
}

async function approvePayment(id) {
  const note = prompt('မှတ်ချက် (ချန်ထားနိုင်ပါသည်):') || '';
  await adminApi(`/admin/payments/${id}/approve`, { method: 'POST', body: JSON.stringify({ note }) });
  showToast('အတည်ပြုပြီးပါပြီ');
  loadPayments(document.getElementById('payment-filter').value);
  loadStats();
}

async function rejectPayment(id) {
  const note = prompt('ပယ်ချရသည့် အကြောင်းပြချက်:');
  if (note === null) return;
  await adminApi(`/admin/payments/${id}/reject`, { method: 'POST', body: JSON.stringify({ note }) });
  showToast('ပယ်ချပြီးပါပြီ');
  loadPayments(document.getElementById('payment-filter').value);
  loadStats();
}

async function bulkApprove() {
  const pendingIds = allPayments.filter(p => p.status === 'pending').map(p => p.id);
  if (!pendingIds.length) return;
  if (!confirm(`စိစစ်ဆဲ ${pendingIds.length} ခု အားလုံးကို အတည်ပြုမှာ သေချာပါသလား?`)) return;
  const note = prompt('မှတ်ချက် (ချန်ထားနိုင်ပါသည်):') || '';
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
          <h3 class="font-bold text-base">${m.name}</h3>
          <button class="btn btn-danger text-xs" onclick="deletePaymentMethod(${m.id})">🗑</button>
        </div>
        ${m.qr_image_url ? `<img src="${m.qr_image_url}" class="w-32 mx-auto rounded-xl mb-3">` : ''}
        ${m.account_name ? `<p class="text-sm"><span class="text-gray-500">အမည်:</span> ${m.account_name}</p>` : ''}
        ${m.account_number ? `<p class="text-sm"><span class="text-gray-500">နံပါတ်:</span> ${m.account_number}</p>` : ''}
        ${m.instructions ? `<p class="text-xs text-gray-500 mt-2">${m.instructions}</p>` : ''}
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
  await fetch(API + '/admin/payment-methods', { method: 'POST', headers: { 'X-Admin-Password': adminPassword }, body: fd });
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
  document.getElementById('roadmaps-grid').innerHTML = roadmaps.map(r => `
    <div class="stat-card">
      <div class="flex items-center gap-3 mb-2">
        <span class="text-2xl">${r.icon}</span>
        <div class="flex-1"><h3 class="font-bold">${r.title}</h3><p class="text-xs text-gray-500">${r.description || ''}</p></div>
        <div class="flex gap-1">
          <button class="btn btn-outline text-xs" onclick='showRoadmapModal(${JSON.stringify(r)})'>✏️</button>
          <button class="btn btn-danger text-xs" onclick="deleteRoadmap(${r.id})">🗑</button>
        </div>
      </div>
      <div class="flex items-center gap-2"><div class="w-4 h-4 rounded" style="background:${r.color}"></div><span class="text-xs text-gray-400">Order: ${r.order_index}</span></div>
    </div>`).join('');
}

function showRoadmapModal(existing) {
  const e = existing || {};
  document.getElementById('modal-container').innerHTML = `
    <div class="modal-overlay" onclick="closeModal()">
      <div class="modal-box" onclick="event.stopPropagation()">
        <div class="flex justify-between items-center mb-5"><h3 class="font-bold text-lg">${e.id ? '✏️ တည်းဖြတ်ရန်' : '🗺️ လမ်းကြောင်း ထည့်ရန်'}</h3><button onclick="closeModal()" class="text-xl">&times;</button></div>
        <div class="space-y-3">
          <div><label class="form-label">ခေါင်းစဉ်</label><input class="form-input" id="rm-title" value="${e.title || ''}"></div>
          <div><label class="form-label">ဖော်ပြချက်</label><textarea class="form-input" id="rm-desc" rows="2">${e.description || ''}</textarea></div>
          <div class="grid grid-cols-3 gap-3">
            <div><label class="form-label">Icon</label><input class="form-input" id="rm-icon" value="${e.icon || '📚'}"></div>
            <div><label class="form-label">အရောင်</label><input type="color" class="form-input" id="rm-color" value="${e.color || '#3390ec'}" style="padding:4px;height:42px;"></div>
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
  const [courses, roadmaps] = await Promise.all([adminApi('/courses'), adminApi('/roadmaps')]);
  const rmMap = {}; roadmaps.forEach(r => rmMap[r.id] = r.title);
  document.getElementById('courses-table').innerHTML = `<table>
    <thead><tr><th>ID</th><th>ခေါင်းစဉ်</th><th>လမ်းကြောင်း</th><th>စျေးနှုန်း</th><th>အဆင့်</th><th>Group ID</th><th>လုပ်ဆောင်ချက်</th></tr></thead>
    <tbody>${courses.map(c => `<tr>
      <td>${c.id}</td>
      <td class="font-medium">${c.title}</td>
      <td class="text-xs">${rmMap[c.roadmap_id] || '-'}</td>
      <td>${formatMMK(c.price_mmk)}${c.price_usdt ? `<br><span class="text-xs text-indigo-500">$${c.price_usdt} USDT</span>` : ''}</td>
      <td class="text-xs">${c.difficulty}</td>
      <td class="text-xs">${c.telegram_group_id || '<span class="text-gray-300">-</span>'}</td>
      <td><div class="flex gap-1">
        <button class="btn btn-outline text-xs" onclick='showCourseModal(${JSON.stringify(c)})'>✏️</button>
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
          <div><label class="form-label">ခေါင်းစဉ်</label><input class="form-input" id="c-title" value="${e.title || ''}"></div>
          <div><label class="form-label">ဖော်ပြချက်</label><textarea class="form-input" id="c-desc" rows="2">${e.description || ''}</textarea></div>
          <div class="grid grid-cols-3 gap-3">
            <div><label class="form-label">စျေးနှုန်း (MMK)</label><input type="number" class="form-input" id="c-price" value="${e.price_mmk || 0}"></div>
            <div><label class="form-label">Crypto Price (USDT)</label><input type="number" step="0.01" class="form-input" id="c-price-usdt" value="${e.price_usdt || ''}" placeholder="e.g. 5.00"></div>
            <div><label class="form-label">လမ်းကြောင်း</label><select class="form-input" id="c-roadmap">
              <option value="">ရွေးပါ</option>
              ${roadmaps.map(r => `<option value="${r.id}" ${e.roadmap_id == r.id ? 'selected' : ''}>${r.title}</option>`).join('')}
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
          <div><label class="form-label">Telegram Group ID</label><input class="form-input" id="c-group" value="${e.telegram_group_id || ''}" placeholder="-100xxxxxxxxxx"></div>
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

async function deleteCourse(id) {
  if (!confirm('ဖျက်မှာ သေချာပါသလား?')) return;
  await adminApi(`/admin/courses/${id}`, { method: 'DELETE' });
  showToast('ဖျက်ပြီးပါပြီ'); loadCourses();
}

// --- CONTENT (Modules & Lessons) ---
async function loadContentPage() {
  const courses = await adminApi('/courses');
  const sel = document.getElementById('content-course-select');
  sel.innerHTML = '<option value="">သင်တန်း ရွေးပါ...</option>' + courses.map(c => `<option value="${c.id}">${c.title}</option>`).join('');
}

async function loadCourseContent(courseId) {
  if (!courseId) { document.getElementById('content-area').innerHTML = ''; return; }
  const modules = await fetch(API + `/courses/${courseId}/modules`, { headers: adminHeaders() }).then(r => r.json());
  let html = `<button class="btn btn-primary mb-4 text-sm" onclick="showModuleModal(${courseId})">+ Module ထည့်ရန်</button>`;
  modules.forEach(m => {
    html += `<div class="stat-card mb-4">
      <div class="flex items-center justify-between mb-3">
        <h3 class="font-bold text-sm">📁 ${m.title}</h3>
        <div class="flex gap-1">
          <button class="btn btn-primary text-xs" onclick="showLessonModal(${m.id})">+ Lesson</button>
          <button class="btn btn-danger text-xs" onclick="deleteModule(${m.id}, ${courseId})">🗑</button>
        </div>
      </div>`;
    if (m.lessons && m.lessons.length > 0) {
      m.lessons.forEach(l => {
        html += `<div class="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50">
          <div><span class="text-sm">${l.title}</span>
            <div class="flex gap-2 mt-1">${l.video_url ? '<span class="text-xs text-blue-500">🎬 Video</span>' : ''}${l.file_url ? '<span class="text-xs text-green-500">📎 File</span>' : ''}</div>
          </div>
          <div class="flex gap-1">
            <button class="btn btn-outline text-xs" onclick='showLessonEditModal(${JSON.stringify(l)}, ${m.id})'>✏️</button>
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
          <div><label class="form-label">ခေါင်းစဉ်</label><input class="form-input" id="les-title" value="${lesson.title}"></div>
          <div><label class="form-label">အကြောင်းအရာ</label><textarea class="form-input" id="les-content" rows="4">${lesson.content || ''}</textarea></div>
          <div><label class="form-label">Video URL</label><input class="form-input" id="les-video" value="${lesson.video_url || ''}"></div>
          <div><label class="form-label">File URL</label><input class="form-input" id="les-file" value="${lesson.file_url || ''}"></div>
          <div><label class="form-label">အစဉ်</label><input type="number" class="form-input" id="les-order" value="${lesson.order_index || 0}"></div>
          <button class="btn btn-primary w-full" onclick="updateLesson(${lesson.id})">ပြင်ဆင်ရန်</button>
        </div>
      </div>
    </div>`;
}

async function saveLesson(moduleId) {
  const courseId = document.getElementById('content-course-select').value;
  await adminApi('/admin/lessons', { method: 'POST', body: JSON.stringify({ module_id: moduleId, title: document.getElementById('les-title').value, content: document.getElementById('les-content').value, video_url: document.getElementById('les-video').value || null, file_url: document.getElementById('les-file').value || null, order_index: parseInt(document.getElementById('les-order').value) || 0 }) });
  closeModal(); showToast('ထည့်သွင်းပြီးပါပြီ'); loadCourseContent(courseId);
}

async function updateLesson(id) {
  const courseId = document.getElementById('content-course-select').value;
  await adminApi(`/admin/lessons/${id}`, { method: 'PUT', body: JSON.stringify({ title: document.getElementById('les-title').value, content: document.getElementById('les-content').value, video_url: document.getElementById('les-video').value || null, file_url: document.getElementById('les-file').value || null, order_index: parseInt(document.getElementById('les-order').value) || 0 }) });
  closeModal(); showToast('ပြင်ဆင်ပြီးပါပြီ'); loadCourseContent(courseId);
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
          <div><h3 class="font-bold text-sm">${a.title}</h3><p class="text-xs text-gray-500 mt-1">${a.content}</p>
            ${a.courses?.title ? `<span class="badge badge-blue text-xs mt-2">${a.courses.title}</span>` : '<span class="badge text-xs mt-2" style="background:#f1f5f9;color:#64748b;">Global</span>'}
            <p class="text-xs text-gray-400 mt-1">${new Date(a.created_at).toLocaleString()}</p>
          </div>
          <button class="btn btn-danger text-xs" onclick="deleteAnnouncement(${a.id})">🗑</button>
        </div>
      </div>`).join('')
    : '<p class="text-gray-400 text-center py-8">ကြေညာချက် မရှိသေးပါ</p>';
}

async function showAnnouncementModal() {
  const courses = await adminApi('/courses');
  document.getElementById('modal-container').innerHTML = `
    <div class="modal-overlay" onclick="closeModal()">
      <div class="modal-box" onclick="event.stopPropagation()">
        <div class="flex justify-between items-center mb-5"><h3 class="font-bold">📢 ကြေညာချက် ထည့်ရန်</h3><button onclick="closeModal()" class="text-xl">&times;</button></div>
        <div class="space-y-3">
          <div><label class="form-label">ခေါင်းစဉ်</label><input class="form-input" id="ann-title"></div>
          <div><label class="form-label">အကြောင်းအရာ</label><textarea class="form-input" id="ann-content" rows="3"></textarea></div>
          <div><label class="form-label">သင်တန်း (ချန်ထားပါက Global)</label><select class="form-input" id="ann-course">
            <option value="">Global - အားလုံး</option>
            ${courses.map(c => `<option value="${c.id}">${c.title}</option>`).join('')}
          </select></div>
          <button class="btn btn-primary w-full" onclick="saveAnnouncement()">သိမ်းဆည်းရန်</button>
        </div>
      </div>
    </div>`;
}

async function saveAnnouncement() {
  await adminApi('/admin/announcements', { method: 'POST', body: JSON.stringify({ title: document.getElementById('ann-title').value, content: document.getElementById('ann-content').value, course_id: document.getElementById('ann-course').value || null }) });
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
      <td>${u.id}</td><td>${u.telegram_id}</td><td class="font-medium">${u.first_name || ''} ${u.last_name || ''}</td>
      <td>@${u.username || '-'}</td><td class="text-xs">${new Date(u.created_at).toLocaleString()}</td>
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
            <span class="text-sm flex-1 truncate">${name}</span>
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

// --- SETTINGS ---
async function loadSettings() {
  try {
    const settings = await adminApi('/admin/settings');

    // Language buttons
    const langMyBtn = document.getElementById('lang-my-btn');
    const langEnBtn = document.getElementById('lang-en-btn');
    const currentLang = settings.language || 'my';
    langMyBtn.className = `btn ${currentLang === 'my' ? 'btn-primary' : 'btn-outline'}`;
    langEnBtn.className = `btn ${currentLang === 'en' ? 'btn-primary' : 'btn-outline'}`;

    // Payment toggles
    document.getElementById('toggle-myanmar').checked = settings.myanmar_payment_enabled !== 'false';
    document.getElementById('toggle-crypto').checked = settings.crypto_payment_enabled === 'true';

    // NOWPayments config
    document.getElementById('np-api-key').value = settings.nowpayments_api_key || '';
    document.getElementById('np-ipn-secret').value = settings.nowpayments_ipn_secret || '';
    document.getElementById('np-accepted-coins').value = settings.nowpayments_accepted_coins || 'btc,eth,usdt,ltc,trx';

    // Load crypto payments
    loadCryptoPayments();
  } catch (e) { showToast('Settings load failed'); }
}

async function setAppLanguage(lang) {
  await adminApi('/admin/settings', { method: 'PUT', body: JSON.stringify({ language: lang }) });
  showToast(lang === 'my' ? 'Myanmar ဘာသာ သို့ ပြောင်းပြီးပါပြီ' : 'Switched to English');
  loadSettings();
}

async function togglePaymentMethod(key, enabled) {
  const update = {};
  update[key] = enabled ? 'true' : 'false';
  await adminApi('/admin/settings', { method: 'PUT', body: JSON.stringify(update) });
  showToast(enabled ? 'Enabled' : 'Disabled');
}

async function saveNowPaymentsConfig() {
  const apiKey = document.getElementById('np-api-key').value;
  const ipnSecret = document.getElementById('np-ipn-secret').value;
  const coins = document.getElementById('np-accepted-coins').value;
  await adminApi('/admin/settings', { method: 'PUT', body: JSON.stringify({
    nowpayments_api_key: apiKey,
    nowpayments_ipn_secret: ipnSecret,
    nowpayments_accepted_coins: coins,
  })});
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
          <td>${p.first_name || ''} <span class="text-xs text-gray-400">@${p.username || ''}</span></td>
          <td>${p.course_title || ''}</td>
          <td>${p.pay_amount || 0}</td>
          <td class="uppercase font-bold text-xs">${p.pay_currency || ''}</td>
          <td><span class="badge ${stCls}">${p.status}</span></td>
          <td class="text-xs">${new Date(p.created_at).toLocaleString()}</td>
        </tr>`;
      }).join('')}</tbody></table>`;
  } catch (e) {
    document.getElementById('crypto-payments-table').innerHTML = '<p class="text-gray-400 text-center py-6">Error loading crypto payments</p>';
  }
}
