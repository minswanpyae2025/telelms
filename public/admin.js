/* TeleLMS Admin Dashboard */
let adminToken = '';
let roadmapsData = [];
let coursesData = [];

function escHtml(s) {
  const d = document.createElement('div');
  d.textContent = s || '';
  return d.innerHTML;
}

function apiCall(endpoint, opts = {}) {
  if (!opts.headers) opts.headers = {};
  opts.headers['x-admin-password'] = adminToken;
  if (opts.body && !(opts.body instanceof FormData)) {
    opts.headers['Content-Type'] = 'application/json';
    if (typeof opts.body === 'object') opts.body = JSON.stringify(opts.body);
  }
  return fetch('/api' + endpoint, opts).then(r => r.json()).catch(() => null);
}

function formatMMK(n) { return new Intl.NumberFormat('en-US').format(n) + ' MMK'; }

// --- Auth ---
async function login() {
  adminToken = document.getElementById('adminPassword').value;
  const res = await apiCall('/admin/stats');
  if (res && res.totalUsers !== undefined) {
    document.getElementById('loginPage').classList.add('hidden');
    document.getElementById('dashboard').classList.remove('hidden');
    loadAll();
  } else {
    document.getElementById('loginError').classList.remove('hidden');
  }
}

function logout() {
  adminToken = '';
  document.getElementById('dashboard').classList.add('hidden');
  document.getElementById('loginPage').classList.remove('hidden');
  document.getElementById('adminPassword').value = '';
}

// --- Navigation ---
function showSection(id) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.getElementById('section-' + id).classList.add('active');
  document.querySelectorAll('.nav-link').forEach(l => {
    l.classList.remove('border-b-2', 'border-blue-600', 'text-blue-600');
    if (l.dataset.section === id) l.classList.add('border-b-2', 'border-blue-600', 'text-blue-600');
  });

  if (id === 'overview') loadStats();
  else if (id === 'roadmaps') loadRoadmaps();
  else if (id === 'courses') loadCourses();
  else if (id === 'content') { loadContentCourseFilter(); loadContent(); }
  else if (id === 'payments') loadPayments();
  else if (id === 'paymentMethods') loadPaymentMethods();
  else if (id === 'announcements') loadAnnouncements();
  else if (id === 'users') loadUsers();
}

// --- Modal ---
function openModal(title, bodyHtml) {
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalBody').innerHTML = bodyHtml;
  document.getElementById('modal').classList.remove('hidden');
}

function closeModal() { document.getElementById('modal').classList.add('hidden'); }

function showScreenshotModal(url) {
  document.getElementById('screenshotImg').src = url;
  document.getElementById('screenshotModal').classList.remove('hidden');
}

function closeScreenshotModal() { document.getElementById('screenshotModal').classList.add('hidden'); }

// --- Load All ---
function loadAll() {
  loadStats();
  loadRoadmaps();
  loadCourses();
}

// --- Stats ---
async function loadStats() {
  const stats = await apiCall('/admin/stats');
  if (!stats) return;
  document.getElementById('statUsers').textContent = stats.totalUsers;
  document.getElementById('statCourses').textContent = stats.totalCourses;
  document.getElementById('statPending').textContent = stats.pendingPayments;
  document.getElementById('statPayments').textContent = stats.totalPayments;

  const payments = await apiCall('/admin/payments?status=pending');
  const el = document.getElementById('recentPayments');
  if (!payments || payments.length === 0) {
    el.innerHTML = '<p class="text-gray-500 text-sm">No pending payments</p>';
    return;
  }
  el.innerHTML = payments.slice(0, 5).map(p => `
    <div class="flex items-center justify-between py-2 border-b last:border-0">
      <div>
        <span class="font-medium text-sm">${escHtml(p.first_name)}</span>
        <span class="text-gray-500 text-xs ml-2">${escHtml(p.course_title)}</span>
      </div>
      <div class="flex gap-2">
        <button onclick="showPaymentDetail(${p.id})" class="text-xs text-blue-600 hover:underline">View</button>
      </div>
    </div>`).join('');
}

// --- Roadmaps ---
async function loadRoadmaps() {
  const data = await apiCall('/roadmaps');
  roadmapsData = data || [];
  const grid = document.getElementById('roadmapsGrid');
  grid.innerHTML = roadmapsData.map(r => `
    <div class="bg-white rounded-xl p-4 shadow-sm border flex items-center gap-3">
      <span class="text-2xl">${r.icon || '📚'}</span>
      <div class="flex-1">
        <div class="font-bold">${escHtml(r.title)}</div>
        <div class="text-gray-500 text-xs">${escHtml(r.description || '')}</div>
        <div class="text-gray-400 text-xs mt-1">Order: ${r.order_index || 0} | Color: <span style="color:${r.color}">${r.color}</span></div>
      </div>
      <button onclick="deleteRoadmap(${r.id})" class="text-red-500 text-sm hover:underline">Delete</button>
    </div>`).join('');
}

function showRoadmapForm() {
  openModal('Add Roadmap', `
    <div class="space-y-3">
      <input id="rmTitle" placeholder="Title" class="w-full p-2 border rounded-lg">
      <textarea id="rmDesc" placeholder="Description" class="w-full p-2 border rounded-lg" rows="2"></textarea>
      <div class="grid grid-cols-3 gap-2">
        <input id="rmIcon" placeholder="Icon (emoji)" class="p-2 border rounded-lg" value="📚">
        <input id="rmColor" placeholder="Color" class="p-2 border rounded-lg" value="#3390ec" type="color">
        <input id="rmOrder" placeholder="Order" class="p-2 border rounded-lg" type="number" value="0">
      </div>
      <button onclick="saveRoadmap()" class="w-full bg-blue-600 text-white py-2 rounded-lg font-medium">Save</button>
    </div>`);
}

async function saveRoadmap() {
  await apiCall('/admin/roadmaps', { method: 'POST', body: {
    title: document.getElementById('rmTitle').value,
    description: document.getElementById('rmDesc').value,
    icon: document.getElementById('rmIcon').value,
    color: document.getElementById('rmColor').value,
    order_index: parseInt(document.getElementById('rmOrder').value) || 0,
  }});
  closeModal(); loadRoadmaps();
}

async function deleteRoadmap(id) {
  if (!confirm('Delete this roadmap?')) return;
  await apiCall(`/admin/roadmaps/${id}`, { method: 'DELETE' });
  loadRoadmaps();
}

// --- Courses ---
async function loadCourses() {
  const data = await apiCall('/courses');
  coursesData = data || [];
  const grid = document.getElementById('coursesGrid');
  grid.innerHTML = coursesData.map(c => `
    <div class="bg-white rounded-xl p-4 shadow-sm border">
      <div class="flex justify-between items-start">
        <div>
          <div class="font-bold">${escHtml(c.title)}</div>
          <div class="text-gray-500 text-xs mt-1">${escHtml(c.description || '')}</div>
        </div>
        <button onclick="deleteCourse(${c.id})" class="text-red-500 text-sm hover:underline">Delete</button>
      </div>
      <div class="flex items-center gap-2 mt-2 text-xs">
        <span class="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">${c.difficulty || 'beginner'}</span>
        <span class="font-bold text-green-600">${formatMMK(c.price_mmk)}</span>
        ${c.duration_hours ? `<span class="text-gray-500">${c.duration_hours}h</span>` : ''}
        <span class="text-gray-400">Roadmap: ${c.roadmap_id || 'None'}</span>
      </div>
    </div>`).join('');
}

function showCourseForm() {
  const rmOptions = roadmapsData.map(r => `<option value="${r.id}">${escHtml(r.title)}</option>`).join('');
  openModal('Add Course', `
    <div class="space-y-3">
      <input id="cTitle" placeholder="Title" class="w-full p-2 border rounded-lg">
      <textarea id="cDesc" placeholder="Description" class="w-full p-2 border rounded-lg" rows="2"></textarea>
      <select id="cRoadmap" class="w-full p-2 border rounded-lg"><option value="">Select Roadmap</option>${rmOptions}</select>
      <div class="grid grid-cols-2 gap-2">
        <input id="cPrice" placeholder="Price (MMK)" class="p-2 border rounded-lg" type="number" value="0">
        <select id="cDifficulty" class="p-2 border rounded-lg">
          <option value="beginner">Beginner</option>
          <option value="intermediate">Intermediate</option>
          <option value="advanced">Advanced</option>
        </select>
      </div>
      <div class="grid grid-cols-2 gap-2">
        <input id="cDuration" placeholder="Duration (hours)" class="p-2 border rounded-lg" type="number">
        <input id="cOrder" placeholder="Order" class="p-2 border rounded-lg" type="number" value="0">
      </div>
      <input id="cGroupId" placeholder="Telegram Group ID (optional)" class="w-full p-2 border rounded-lg">
      <button onclick="saveCourse()" class="w-full bg-blue-600 text-white py-2 rounded-lg font-medium">Save</button>
    </div>`);
}

async function saveCourse() {
  await apiCall('/admin/courses', { method: 'POST', body: {
    title: document.getElementById('cTitle').value,
    description: document.getElementById('cDesc').value,
    roadmap_id: document.getElementById('cRoadmap').value || null,
    price_mmk: parseInt(document.getElementById('cPrice').value) || 0,
    difficulty: document.getElementById('cDifficulty').value,
    duration_hours: parseInt(document.getElementById('cDuration').value) || null,
    order_index: parseInt(document.getElementById('cOrder').value) || 0,
    telegram_group_id: document.getElementById('cGroupId').value || null,
  }});
  closeModal(); loadCourses();
}

async function deleteCourse(id) {
  if (!confirm('Delete this course and all its content?')) return;
  await apiCall(`/admin/courses/${id}`, { method: 'DELETE' });
  loadCourses();
}

// --- Content (Modules & Lessons) ---
async function loadContentCourseFilter() {
  if (coursesData.length === 0) {
    const data = await apiCall('/courses');
    coursesData = data || [];
  }
  const select = document.getElementById('contentCourseFilter');
  select.innerHTML = '<option value="">Select Course</option>' +
    coursesData.map(c => `<option value="${c.id}">${escHtml(c.title)}</option>`).join('');
}

async function loadContent() {
  const courseId = document.getElementById('contentCourseFilter').value;
  const list = document.getElementById('contentList');
  if (!courseId) { list.innerHTML = '<p class="text-gray-500">Select a course to view content</p>'; return; }

  const modules = await apiCall(`/courses/${courseId}/modules`);
  list.innerHTML = (modules || []).map(m => `
    <div class="bg-white rounded-xl shadow-sm border overflow-hidden">
      <div class="px-4 py-3 bg-gray-50 flex justify-between items-center">
        <span class="font-bold text-sm">${escHtml(m.title)} <span class="text-gray-400 text-xs">(order: ${m.order_index})</span></span>
        <button onclick="deleteModule(${m.id})" class="text-red-500 text-xs hover:underline">Delete Module</button>
      </div>
      ${(m.lessons || []).map(l => `
        <div class="px-4 py-2 border-t flex justify-between items-center">
          <div>
            <span class="text-sm">${escHtml(l.title)}</span>
            <span class="text-gray-400 text-xs ml-2">(order: ${l.order_index})</span>
            ${l.video_url ? '<span class="text-xs text-blue-500 ml-1">🎥</span>' : ''}
            ${l.file_url ? '<span class="text-xs text-green-500 ml-1">📎</span>' : ''}
          </div>
          <button onclick="deleteLesson(${l.id})" class="text-red-500 text-xs hover:underline">Delete</button>
        </div>`).join('')}
    </div>`).join('');
}

function showModuleForm() {
  const courseId = document.getElementById('contentCourseFilter').value;
  openModal('Add Module', `
    <div class="space-y-3">
      <input id="modTitle" placeholder="Module Title" class="w-full p-2 border rounded-lg">
      <input id="modOrder" placeholder="Order Index" class="w-full p-2 border rounded-lg" type="number" value="0">
      <input id="modCourseId" type="hidden" value="${courseId}">
      <button onclick="saveModule()" class="w-full bg-blue-600 text-white py-2 rounded-lg font-medium">Save</button>
    </div>`);
}

async function saveModule() {
  await apiCall('/admin/modules', { method: 'POST', body: {
    course_id: document.getElementById('modCourseId').value,
    title: document.getElementById('modTitle').value,
    order_index: parseInt(document.getElementById('modOrder').value) || 0,
  }});
  closeModal(); loadContent();
}

async function deleteModule(id) {
  if (!confirm('Delete this module and all its lessons?')) return;
  await apiCall(`/admin/modules/${id}`, { method: 'DELETE' });
  loadContent();
}

function showLessonForm() {
  openModal('Add Lesson', `
    <div class="space-y-3">
      <input id="lesModuleId" placeholder="Module ID" class="w-full p-2 border rounded-lg" type="number">
      <input id="lesTitle" placeholder="Lesson Title" class="w-full p-2 border rounded-lg">
      <textarea id="lesContent" placeholder="Content (text)" class="w-full p-2 border rounded-lg" rows="3"></textarea>
      <input id="lesVideo" placeholder="Video URL (YouTube, etc.)" class="w-full p-2 border rounded-lg">
      <input id="lesFile" placeholder="File URL" class="w-full p-2 border rounded-lg">
      <input id="lesOrder" placeholder="Order Index" class="w-full p-2 border rounded-lg" type="number" value="0">
      <button onclick="saveLesson()" class="w-full bg-green-600 text-white py-2 rounded-lg font-medium">Save</button>
    </div>`);
}

async function saveLesson() {
  await apiCall('/admin/lessons', { method: 'POST', body: {
    module_id: document.getElementById('lesModuleId').value,
    title: document.getElementById('lesTitle').value,
    content: document.getElementById('lesContent').value,
    video_url: document.getElementById('lesVideo').value || null,
    file_url: document.getElementById('lesFile').value || null,
    order_index: parseInt(document.getElementById('lesOrder').value) || 0,
  }});
  closeModal(); loadContent();
}

async function deleteLesson(id) {
  if (!confirm('Delete this lesson?')) return;
  await apiCall(`/admin/lessons/${id}`, { method: 'DELETE' });
  loadContent();
}

// --- Payments ---
async function loadPayments() {
  const status = document.getElementById('paymentStatusFilter').value;
  const data = await apiCall(`/admin/payments${status ? '?status=' + status : ''}`);
  const list = document.getElementById('paymentsList');
  if (!data || data.length === 0) {
    list.innerHTML = '<p class="text-gray-500">No payments found</p>';
    return;
  }
  list.innerHTML = data.map(p => `
    <div class="bg-white rounded-xl p-4 shadow-sm border">
      <div class="flex justify-between items-start">
        <div>
          <div class="font-bold text-sm">${escHtml(p.first_name)} ${p.username ? `(@${escHtml(p.username)})` : ''}</div>
          <div class="text-gray-500 text-xs mt-1">Course: ${escHtml(p.course_title)} | Via: ${escHtml(p.payment_method_name)}</div>
          <div class="text-gray-400 text-xs mt-1">${new Date(p.created_at).toLocaleString()}</div>
          ${p.admin_note ? `<div class="text-xs mt-1 text-gray-600">Note: ${escHtml(p.admin_note)}</div>` : ''}
        </div>
        <span class="text-xs px-2 py-1 rounded-full status-${p.status}">${p.status}</span>
      </div>
      <div class="flex gap-2 mt-3">
        <button onclick="showScreenshotModal('${p.screenshot_url}')" class="text-xs text-blue-600 hover:underline">View Screenshot</button>
        ${p.status === 'pending' ? `
          <button onclick="approvePayment(${p.id})" class="text-xs bg-green-600 text-white px-3 py-1 rounded-lg hover:bg-green-700">Approve</button>
          <button onclick="rejectPayment(${p.id})" class="text-xs bg-red-600 text-white px-3 py-1 rounded-lg hover:bg-red-700">Reject</button>
        ` : ''}
      </div>
    </div>`).join('');
}

function showPaymentDetail(paymentId) {
  showSection('payments');
  document.getElementById('paymentStatusFilter').value = 'pending';
  loadPayments();
}

async function approvePayment(id) {
  const note = prompt('Admin note (optional):') || '';
  await apiCall(`/admin/payments/${id}/approve`, { method: 'POST', body: { note } });
  loadPayments();
  loadStats();
}

async function rejectPayment(id) {
  const note = prompt('Rejection reason:') || '';
  await apiCall(`/admin/payments/${id}/reject`, { method: 'POST', body: { note } });
  loadPayments();
  loadStats();
}

// --- Payment Methods ---
async function loadPaymentMethods() {
  const data = await apiCall('/payment-methods');
  const grid = document.getElementById('paymentMethodsGrid');
  grid.innerHTML = (data || []).map(pm => `
    <div class="bg-white rounded-xl p-4 shadow-sm border">
      <div class="flex justify-between items-start">
        <div>
          <div class="font-bold">${escHtml(pm.name)}</div>
          ${pm.account_name ? `<div class="text-sm text-gray-600 mt-1">Name: ${escHtml(pm.account_name)}</div>` : ''}
          ${pm.account_number ? `<div class="text-sm text-gray-600">Account: ${escHtml(pm.account_number)}</div>` : ''}
          ${pm.instructions ? `<div class="text-xs text-gray-500 mt-1">${escHtml(pm.instructions)}</div>` : ''}
        </div>
        <button onclick="deletePaymentMethod(${pm.id})" class="text-red-500 text-sm hover:underline">Delete</button>
      </div>
      ${pm.qr_image_url ? `<img src="${pm.qr_image_url}" class="mt-2 max-w-[150px] rounded-lg cursor-pointer" onclick="showScreenshotModal('${pm.qr_image_url}')">` : ''}
    </div>`).join('');
}

function showPaymentMethodForm() {
  openModal('Add Payment Method', `
    <form id="pmForm" class="space-y-3">
      <input id="pmName" placeholder="Name (e.g. KBZPay, WavePay)" class="w-full p-2 border rounded-lg" required>
      <input id="pmAccName" placeholder="Account Name" class="w-full p-2 border rounded-lg">
      <input id="pmAccNum" placeholder="Account Number" class="w-full p-2 border rounded-lg">
      <textarea id="pmInstr" placeholder="Instructions" class="w-full p-2 border rounded-lg" rows="2"></textarea>
      <div>
        <label class="text-sm text-gray-600">QR Code Image (optional)</label>
        <input id="pmQrFile" type="file" accept="image/*" class="w-full p-2 border rounded-lg mt-1">
      </div>
      <button type="button" onclick="savePaymentMethod()" class="w-full bg-blue-600 text-white py-2 rounded-lg font-medium">Save</button>
    </form>`);
}

async function savePaymentMethod() {
  const fd = new FormData();
  fd.append('name', document.getElementById('pmName').value);
  fd.append('account_name', document.getElementById('pmAccName').value);
  fd.append('account_number', document.getElementById('pmAccNum').value);
  fd.append('instructions', document.getElementById('pmInstr').value);
  const qrFile = document.getElementById('pmQrFile').files[0];
  if (qrFile) fd.append('qr_image', qrFile);

  await fetch('/api/admin/payment-methods', {
    method: 'POST',
    headers: { 'x-admin-password': adminToken },
    body: fd,
  });
  closeModal(); loadPaymentMethods();
}

async function deletePaymentMethod(id) {
  if (!confirm('Delete this payment method?')) return;
  await apiCall(`/admin/payment-methods/${id}`, { method: 'DELETE' });
  loadPaymentMethods();
}

// --- Announcements ---
async function loadAnnouncements() {
  const data = await apiCall('/announcements');
  const grid = document.getElementById('announcementsGrid');
  grid.innerHTML = (data || []).map(a => `
    <div class="bg-white rounded-xl p-4 shadow-sm border flex justify-between items-start">
      <div>
        <div class="font-bold text-sm">${escHtml(a.title)}</div>
        <div class="text-gray-500 text-xs mt-1">${escHtml(a.content)}</div>
        <div class="text-gray-400 text-xs mt-1">${new Date(a.created_at).toLocaleString()}</div>
      </div>
      <button onclick="deleteAnnouncement(${a.id})" class="text-red-500 text-sm hover:underline">Delete</button>
    </div>`).join('');
}

function showAnnouncementForm() {
  openModal('Add Announcement', `
    <div class="space-y-3">
      <input id="annTitle" placeholder="Title" class="w-full p-2 border rounded-lg">
      <textarea id="annContent" placeholder="Content" class="w-full p-2 border rounded-lg" rows="3"></textarea>
      <button onclick="saveAnnouncement()" class="w-full bg-blue-600 text-white py-2 rounded-lg font-medium">Save</button>
    </div>`);
}

async function saveAnnouncement() {
  await apiCall('/admin/announcements', { method: 'POST', body: {
    title: document.getElementById('annTitle').value,
    content: document.getElementById('annContent').value,
  }});
  closeModal(); loadAnnouncements();
}

async function deleteAnnouncement(id) {
  if (!confirm('Delete this announcement?')) return;
  await apiCall(`/admin/announcements/${id}`, { method: 'DELETE' });
  loadAnnouncements();
}

// --- Users ---
async function loadUsers() {
  const data = await apiCall('/admin/users');
  const tbody = document.getElementById('usersTableBody');
  tbody.innerHTML = (data || []).map(u => `
    <tr class="border-t">
      <td class="px-4 py-2">${u.id}</td>
      <td class="px-4 py-2 font-medium">${escHtml(u.first_name)} ${escHtml(u.last_name || '')}</td>
      <td class="px-4 py-2">${u.username ? '@' + escHtml(u.username) : '-'}</td>
      <td class="px-4 py-2 text-gray-500">${u.telegram_id}</td>
      <td class="px-4 py-2 text-gray-500 text-xs">${new Date(u.created_at).toLocaleDateString()}</td>
    </tr>`).join('');
}
