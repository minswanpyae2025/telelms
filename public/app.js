/* TeleLMS - Telegram Mini App Frontend */
const tg = window.Telegram.WebApp;
tg.expand();
tg.ready();

const initData = tg.initData || '';
const tgUser = tg.initDataUnsafe?.user || null;

let currentCourseId = null;
let currentRoadmapId = null;
let paymentMethodsData = [];
let selectedPaymentMethodId = null;
let isBookmarked = false;
let navigationStack = ['home'];

function headers(extra = {}) {
  const h = { ...extra };
  if (initData) h['x-telegram-init-data'] = initData;
  return h;
}

function api(path, opts = {}) {
  if (!opts.headers) opts.headers = {};
  Object.assign(opts.headers, headers());
  if (opts.body && !(opts.body instanceof FormData)) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(opts.body);
  }
  return fetch('/api' + path, opts).then(r => r.json()).catch(() => null);
}

function escHtml(s) {
  const d = document.createElement('div');
  d.textContent = s || '';
  return d.innerHTML;
}

function formatMMK(amount) {
  return new Intl.NumberFormat('en-US').format(amount) + ' MMK';
}

function difficultyBadge(level) {
  const labels = { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' };
  return `<span class="badge-${level} text-xs px-2 py-0.5 rounded-full font-medium">${labels[level] || level}</span>`;
}

// --- Navigation ---
function navigate(screenId) {
  document.querySelectorAll('.screen').forEach(el => el.classList.remove('active'));
  const screen = document.getElementById('screen-' + screenId);
  if (screen) { screen.classList.add('active'); screen.classList.add('fade-in'); }

  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.remove('font-bold');
    btn.style.color = '';
  });
  const activeBtn = document.querySelector(`.nav-btn[data-tab="${screenId}"]`);
  if (activeBtn) {
    activeBtn.classList.add('font-bold');
    activeBtn.style.color = 'var(--btn)';
  }

  if (['home', 'my-courses', 'bookmarks', 'search', 'profile'].includes(screenId)) {
    navigationStack = [screenId];
  } else {
    navigationStack.push(screenId);
  }

  if (screenId === 'home') loadHome();
  else if (screenId === 'my-courses') loadMyCourses();
  else if (screenId === 'bookmarks') loadBookmarks();
  else if (screenId === 'profile') loadProfile();
}

function goBackFromDetail() {
  if (currentRoadmapId) navigate('courses');
  else navigate('home');
}

// --- Home / Roadmaps ---
async function loadHome() {
  const loading = document.getElementById('homeLoading');
  loading.classList.remove('hidden');

  const [roadmaps, announcements] = await Promise.all([
    api('/roadmaps'),
    api('/announcements'),
  ]);

  loading.classList.add('hidden');

  if (announcements && announcements.length > 0) {
    document.getElementById('announcementBanner').classList.remove('hidden');
    document.getElementById('announcementContent').innerHTML =
      announcements.slice(0, 2).map(a => `<div class="mb-1"><b>${escHtml(a.title)}</b></div>`).join('');
  }

  const list = document.getElementById('roadmapsList');
  list.innerHTML = '';
  if (roadmaps && roadmaps.length > 0) {
    roadmaps.forEach(rm => {
      const div = document.createElement('div');
      div.className = 'rounded-xl p-4 cursor-pointer fade-in';
      div.style.background = `linear-gradient(135deg, ${rm.color || '#3390ec'}22, ${rm.color || '#3390ec'}11)`;
      div.style.borderLeft = `4px solid ${rm.color || '#3390ec'}`;
      div.innerHTML = `
        <div class="flex items-center gap-3">
          <span class="text-3xl">${rm.icon || '📚'}</span>
          <div class="flex-1">
            <div class="font-bold">${escHtml(rm.title)}</div>
            <div class="text-hint text-xs mt-0.5">${escHtml(rm.description || '')}</div>
          </div>
          <span class="text-hint">→</span>
        </div>`;
      div.onclick = () => loadCourses(rm.id, rm.title, rm.description);
      list.appendChild(div);
    });
  } else {
    list.innerHTML = '<div class="text-center py-8 text-hint">Career pathway မရှိသေးပါ</div>';
  }
}

// --- Courses ---
async function loadCourses(roadmapId, title, desc) {
  currentRoadmapId = roadmapId;
  document.getElementById('coursesHeader').textContent = title;
  document.getElementById('coursesDesc').textContent = desc || '';
  navigate('courses');

  const loading = document.getElementById('coursesLoading');
  const empty = document.getElementById('coursesEmpty');
  loading.classList.remove('hidden');
  empty.classList.add('hidden');

  const courses = await api(`/courses?roadmap_id=${roadmapId}`);
  loading.classList.add('hidden');

  const list = document.getElementById('coursesList');
  list.innerHTML = '';

  if (!courses || courses.length === 0) {
    empty.classList.remove('hidden');
    return;
  }

  courses.forEach(c => {
    const div = document.createElement('div');
    div.className = 'card-base rounded-xl p-4 cursor-pointer fade-in';
    div.innerHTML = `
      <div class="flex justify-between items-start">
        <div class="flex-1">
          <div class="font-bold">${escHtml(c.title)}</div>
          <div class="text-hint text-xs mt-1 line-clamp-2">${escHtml(c.description || '')}</div>
        </div>
      </div>
      <div class="flex items-center gap-2 mt-2 flex-wrap">
        ${difficultyBadge(c.difficulty || 'beginner')}
        ${c.duration_hours ? `<span class="text-xs text-hint">⏱ ${c.duration_hours}h</span>` : ''}
        <span class="text-xs font-bold ml-auto" style="color:var(--btn)">${c.price_mmk > 0 ? formatMMK(c.price_mmk) : 'Free'}</span>
      </div>`;
    div.onclick = () => loadCourseDetail(c.id);
    list.appendChild(div);
  });
}

// --- Course Detail ---
async function loadCourseDetail(courseId) {
  currentCourseId = courseId;
  navigate('course-detail');

  const [course, modules] = await Promise.all([
    api(`/courses/${courseId}`),
    api(`/courses/${courseId}/modules`),
  ]);

  if (!course) return;

  document.getElementById('detailTitle').textContent = course.title;
  document.getElementById('detailDescription').textContent = course.description || '';

  const badges = document.getElementById('detailBadges');
  badges.innerHTML = `
    ${difficultyBadge(course.difficulty || 'beginner')}
    ${course.duration_hours ? `<span class="text-xs text-hint bg-gray-100 px-2 py-0.5 rounded-full">⏱ ${course.duration_hours} hours</span>` : ''}
    <span class="text-xs font-bold px-2 py-0.5 rounded-full" style="background:var(--btn);color:var(--btn-text)">${course.price_mmk > 0 ? formatMMK(course.price_mmk) : 'Free'}</span>`;

  if (initData) {
    const bRes = await api('/bookmarks');
    if (bRes) {
      isBookmarked = bRes.some(b => b.id === courseId);
      document.getElementById('bookmarkIcon').textContent = isBookmarked ? '★' : '☆';
    }
  }

  const mList = document.getElementById('modulesList');
  mList.innerHTML = '';
  let total = 0, comp = 0;
  let isEnrolled = false;

  if (modules && modules.length > 0) {
    modules.forEach(m => {
      const mDiv = document.createElement('div');
      mDiv.className = 'card-base rounded-xl overflow-hidden fade-in';
      let lessonsHtml = '';
      m.lessons.forEach(l => {
        total++;
        if (l.completed) { comp++; isEnrolled = true; }
        lessonsHtml += `
          <div class="flex items-center gap-2 px-4 py-2.5 border-t border-gray-200 cursor-pointer hover:bg-gray-50" onclick="viewLesson(${l.id})">
            <span class="text-xs ${l.completed ? 'text-green-500' : 'text-hint'}">${l.completed ? '●' : '○'}</span>
            <span class="text-sm flex-1">${escHtml(l.title)}</span>
            <span class="text-hint text-xs">→</span>
          </div>`;
      });
      mDiv.innerHTML = `<div class="px-4 py-3 font-semibold text-sm">${escHtml(m.title)}</div>${lessonsHtml}`;
      mList.appendChild(mDiv);
    });
  }

  if (initData && total > 0) {
    const enrolled = await api('/my-courses');
    if (enrolled && enrolled.some(c => c.id === courseId)) isEnrolled = true;
  }

  const progressSection = document.getElementById('progressSection');
  if (isEnrolled && total > 0) {
    progressSection.classList.remove('hidden');
    const pct = Math.round((comp / total) * 100);
    document.getElementById('progressBar').style.width = pct + '%';
    document.getElementById('progressText').textContent = pct + '%';
  } else {
    progressSection.classList.add('hidden');
  }

  const enrollSection = document.getElementById('enrollSection');
  if (isEnrolled) {
    enrollSection.innerHTML = '<div class="text-center text-green-600 font-medium py-3">Enrolled</div>';
  } else {
    enrollSection.innerHTML = `<button id="payBtn" onclick="showPayment()" class="btn-primary w-full py-3 rounded-xl font-bold text-base">${course.price_mmk > 0 ? 'ဝယ်ယူမည် - ' + formatMMK(course.price_mmk) : 'Enroll Free'}</button>`;
  }

  loadReviews(courseId);
  if (initData && isEnrolled) {
    document.getElementById('reviewFormContainer').classList.remove('hidden');
  } else {
    document.getElementById('reviewFormContainer').classList.add('hidden');
  }
}

// --- Lesson ---
async function viewLesson(id) {
  const res = await fetch('/api/lessons/' + id, { headers: headers() });
  if (res.status === 403) {
    tg.showAlert('Payment required. Please enroll first.');
    return;
  }
  const lesson = await res.json();
  navigate('lesson');

  document.getElementById('lessonTitle').textContent = lesson.title;

  const contentEl = document.getElementById('lessonContent');
  contentEl.innerHTML = lesson.content ? `<div class="card-base rounded-xl p-4 text-sm whitespace-pre-wrap">${escHtml(lesson.content)}</div>` : '';

  const videoEl = document.getElementById('lessonVideo');
  if (lesson.video_url) {
    if (lesson.video_url.includes('youtube.com') || lesson.video_url.includes('youtu.be')) {
      const vid = lesson.video_url.match(/(?:v=|youtu\.be\/)([^&]+)/);
      videoEl.innerHTML = vid ? `<div class="rounded-xl overflow-hidden aspect-video"><iframe src="https://www.youtube.com/embed/${vid[1]}" class="w-full h-full" allowfullscreen></iframe></div>` : '';
    } else {
      videoEl.innerHTML = `<video controls class="w-full rounded-xl"><source src="${lesson.video_url}"></video>`;
    }
  } else { videoEl.innerHTML = ''; }

  const fileEl = document.getElementById('lessonFile');
  fileEl.innerHTML = lesson.file_url ? `<a href="${lesson.file_url}" target="_blank" class="card-base rounded-xl p-3 flex items-center gap-2 text-link"><span>📎</span><span class="text-sm">Download File</span></a>` : '';

  const cb = document.getElementById('lessonCompletedCb');
  cb.checked = lesson.completed || false;
  cb.onchange = async (e) => {
    await api('/progress', { method: 'POST', body: { lesson_id: id, completed: e.target.checked } });
    loadCourseDetail(currentCourseId);
  };
}

// --- Reviews ---
async function loadReviews(courseId) {
  const data = await api(`/courses/${courseId}/reviews`);
  const list = document.getElementById('reviewsList');
  list.innerHTML = '';
  if (!data || data.length === 0) {
    list.innerHTML = '<div class="text-hint text-sm">Review မရှိသေးပါ</div>';
    return;
  }
  data.forEach(r => {
    list.innerHTML += `
      <div class="card-base rounded-lg p-3">
        <div class="flex justify-between items-center">
          <span class="font-medium text-sm">${escHtml(r.first_name)}</span>
          <span class="text-xs">${'⭐'.repeat(r.rating)}</span>
        </div>
        ${r.comment ? `<p class="text-hint text-xs mt-1">${escHtml(r.comment)}</p>` : ''}
      </div>`;
  });
}

async function postReview() {
  const rating = document.getElementById('reviewRating').value;
  const comment = document.getElementById('reviewComment').value;
  await api(`/courses/${currentCourseId}/reviews`, {
    method: 'POST', body: { rating: parseInt(rating), comment }
  });
  document.getElementById('reviewComment').value = '';
  loadReviews(currentCourseId);
}

// --- Bookmarks ---
async function loadBookmarks() {
  const data = await api('/bookmarks');
  const list = document.getElementById('bookmarksList');
  const empty = document.getElementById('bookmarksEmpty');
  list.innerHTML = '';
  if (!data || data.length === 0) {
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');
  data.forEach(c => {
    const div = document.createElement('div');
    div.className = 'card-base rounded-xl p-4 cursor-pointer fade-in';
    div.innerHTML = `
      <div class="font-bold">${escHtml(c.title)}</div>
      <div class="text-hint text-xs mt-1">${escHtml(c.description || '')}</div>
      <div class="flex items-center gap-2 mt-2">
        ${difficultyBadge(c.difficulty || 'beginner')}
        <span class="text-xs font-bold ml-auto" style="color:var(--btn)">${c.price_mmk > 0 ? formatMMK(c.price_mmk) : 'Free'}</span>
      </div>`;
    div.onclick = () => loadCourseDetail(c.id);
    list.appendChild(div);
  });
}

async function toggleBookmark() {
  if (isBookmarked) {
    await api(`/bookmarks/${currentCourseId}`, { method: 'DELETE' });
  } else {
    await api('/bookmarks', { method: 'POST', body: { course_id: currentCourseId } });
  }
  isBookmarked = !isBookmarked;
  document.getElementById('bookmarkIcon').textContent = isBookmarked ? '★' : '☆';
}

// --- My Courses ---
async function loadMyCourses() {
  const loading = document.getElementById('myCoursesLoading');
  const empty = document.getElementById('myCoursesEmpty');
  loading.classList.remove('hidden');
  empty.classList.add('hidden');

  const data = await api('/my-courses');
  loading.classList.add('hidden');

  const list = document.getElementById('myCoursesList');
  list.innerHTML = '';
  if (!data || data.length === 0) {
    empty.classList.remove('hidden');
    return;
  }
  data.forEach(c => {
    const div = document.createElement('div');
    div.className = 'card-base rounded-xl p-4 cursor-pointer fade-in';
    div.innerHTML = `
      <div class="font-bold">${escHtml(c.title)}</div>
      <div class="text-hint text-xs mt-1">${escHtml(c.description || '')}</div>`;
    div.onclick = () => loadCourseDetail(c.id);
    list.appendChild(div);
  });
}

// --- Payment ---
async function showPayment() {
  navigate('payment');
  const course = await api(`/courses/${currentCourseId}`);
  document.getElementById('paymentCourseInfo').textContent = course ? `${course.title} - ${formatMMK(course.price_mmk)}` : '';

  if (paymentMethodsData.length === 0) {
    const methods = await api('/payment-methods');
    paymentMethodsData = methods || [];
  }

  const list = document.getElementById('paymentMethodsList');
  list.innerHTML = '';
  paymentMethodsData.forEach(pm => {
    const div = document.createElement('div');
    div.className = 'card-base rounded-xl p-3 cursor-pointer flex items-center gap-3 payment-method-item';
    div.dataset.id = pm.id;
    div.innerHTML = `
      <div class="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-lg">💳</div>
      <div class="flex-1">
        <div class="font-medium text-sm">${escHtml(pm.name)}</div>
        ${pm.account_name ? `<div class="text-hint text-xs">${escHtml(pm.account_name)}</div>` : ''}
      </div>
      <span class="text-hint">→</span>`;
    div.onclick = () => selectPaymentMethod(pm);
    list.appendChild(div);
  });

  document.getElementById('paymentDetails').classList.add('hidden');
  document.getElementById('paymentUpload').classList.add('hidden');
  selectedPaymentMethodId = null;
}

function selectPaymentMethod(pm) {
  selectedPaymentMethodId = pm.id;

  document.querySelectorAll('.payment-method-item').forEach(el => {
    el.style.borderColor = el.dataset.id == pm.id ? 'var(--btn)' : '';
    el.style.borderWidth = el.dataset.id == pm.id ? '2px' : '';
  });

  const details = document.getElementById('paymentDetails');
  details.classList.remove('hidden');

  document.getElementById('pmAccountInfo').innerHTML = `
    <div class="font-bold text-sm">${escHtml(pm.name)}</div>
    ${pm.account_name ? `<div class="text-sm mt-1">Name: <b>${escHtml(pm.account_name)}</b></div>` : ''}
    ${pm.account_number ? `<div class="text-sm mt-1">Account: <b class="select-all">${escHtml(pm.account_number)}</b></div>` : ''}`;

  const qrDiv = document.getElementById('pmQrImage');
  if (pm.qr_image_url) {
    document.getElementById('pmQrImg').src = pm.qr_image_url;
    qrDiv.classList.remove('hidden');
  } else { qrDiv.classList.add('hidden'); }

  document.getElementById('pmInstructions').textContent = pm.instructions || '';
  document.getElementById('paymentUpload').classList.remove('hidden');

  const fileInput = document.getElementById('screenshotFile');
  fileInput.value = '';
  document.getElementById('screenshotPreview').classList.add('hidden');
  document.getElementById('processPaymentBtn').disabled = true;
}

document.addEventListener('DOMContentLoaded', () => {
  const fileInput = document.getElementById('screenshotFile');
  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        document.getElementById('processPaymentBtn').disabled = false;
        const reader = new FileReader();
        reader.onload = (ev) => {
          document.getElementById('previewImg').src = ev.target.result;
          document.getElementById('screenshotPreview').classList.remove('hidden');
        };
        reader.readAsDataURL(file);
      }
    });
  }
});

async function processPayment() {
  const btn = document.getElementById('processPaymentBtn');
  btn.disabled = true;
  btn.textContent = 'Submitting...';

  const fd = new FormData();
  fd.append('course_id', currentCourseId);
  fd.append('payment_method_id', selectedPaymentMethodId);
  fd.append('screenshot', document.getElementById('screenshotFile').files[0]);

  const res = await fetch('/api/payments', {
    method: 'POST',
    headers: initData ? { 'x-telegram-init-data': initData } : {},
    body: fd,
  });

  if (res.ok) {
    navigate('success');
  } else {
    btn.disabled = false;
    btn.textContent = 'အတည်ပြုမည်';
    tg.showAlert('Payment failed. Please try again.');
  }
}

// --- Search ---
async function executeSearch() {
  const q = document.getElementById('searchInput').value;
  if (!q) return;
  const data = await api(`/search?q=${encodeURIComponent(q)}`);
  const results = document.getElementById('searchResults');
  results.innerHTML = '';
  if (!data) return;

  if (data.courses.length === 0 && data.lessons.length === 0) {
    results.innerHTML = '<div class="text-center py-6 text-hint">ရလဒ်မရှိပါ</div>';
    return;
  }

  data.courses.forEach(c => {
    const div = document.createElement('div');
    div.className = 'card-base rounded-xl p-4 cursor-pointer fade-in';
    div.innerHTML = `
      <div class="font-bold">${escHtml(c.title)}</div>
      <div class="text-hint text-xs mt-1">${escHtml(c.description || '')}</div>
      <div class="flex items-center gap-2 mt-2">
        ${difficultyBadge(c.difficulty || 'beginner')}
        <span class="text-xs font-bold ml-auto" style="color:var(--btn)">${c.price_mmk > 0 ? formatMMK(c.price_mmk) : 'Free'}</span>
      </div>`;
    div.onclick = () => loadCourseDetail(c.id);
    results.appendChild(div);
  });

  data.lessons.forEach(l => {
    const div = document.createElement('div');
    div.className = 'card-base rounded-xl p-3 cursor-pointer fade-in';
    div.innerHTML = `
      <div class="text-xs text-hint mb-1">Lesson in: ${escHtml(l.course_title || '')}</div>
      <div class="font-medium text-sm">${escHtml(l.title)}</div>`;
    div.onclick = () => { if (l.course_id) loadCourseDetail(l.course_id); };
    results.appendChild(div);
  });
}

document.getElementById('searchInput')?.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') executeSearch();
});

// --- Profile ---
async function loadProfile() {
  if (tgUser) {
    document.getElementById('profileName').textContent = [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' ');
    document.getElementById('profileUsername').textContent = tgUser.username ? '@' + tgUser.username : '';
    document.getElementById('profileAvatar').textContent = (tgUser.first_name || '?')[0];
  }

  const payments = await api('/my-payments');
  const historyEl = document.getElementById('paymentHistory');
  const emptyEl = document.getElementById('paymentHistoryEmpty');
  historyEl.innerHTML = '';

  if (!payments || payments.length === 0) {
    emptyEl.classList.remove('hidden');
  } else {
    emptyEl.classList.add('hidden');
    payments.forEach(p => {
      const statusColors = { pending: 'bg-yellow-100 text-yellow-800', approved: 'bg-green-100 text-green-800', rejected: 'bg-red-100 text-red-800' };
      historyEl.innerHTML += `
        <div class="card-base rounded-xl p-3">
          <div class="flex justify-between items-center">
            <div class="font-medium text-sm">${escHtml(p.courses?.title || 'Course')}</div>
            <span class="text-xs px-2 py-0.5 rounded-full ${statusColors[p.status] || ''}">${p.status}</span>
          </div>
          <div class="text-hint text-xs mt-1">${new Date(p.created_at).toLocaleDateString('my-MM')}</div>
          ${p.admin_note ? `<div class="text-xs mt-1 text-hint">Note: ${escHtml(p.admin_note)}</div>` : ''}
        </div>`;
    });
  }

  const announcements = await api('/announcements');
  const annList = document.getElementById('announcementsList');
  const annEmpty = document.getElementById('announcementsEmpty');
  annList.innerHTML = '';

  if (!announcements || announcements.length === 0) {
    annEmpty.classList.remove('hidden');
  } else {
    annEmpty.classList.add('hidden');
    announcements.forEach(a => {
      annList.innerHTML += `
        <div class="card-base rounded-xl p-3">
          <div class="font-medium text-sm">${escHtml(a.title)}</div>
          <div class="text-hint text-xs mt-1">${escHtml(a.content)}</div>
          <div class="text-hint text-xs mt-1">${new Date(a.created_at).toLocaleDateString('my-MM')}</div>
        </div>`;
    });
  }
}

// --- Init ---
document.addEventListener('DOMContentLoaded', () => {
  navigate('home');
});
