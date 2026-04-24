// လမ်းစ (Lann Sa) LMS - Frontend Logic
const tg = window.Telegram?.WebApp;
if (tg) { tg.ready(); tg.expand(); }

const API = '/api';
const initData = tg?.initData || '';
const tgUser = tg?.initDataUnsafe?.user || null;

const screenStack = ['home'];
let currentData = {};

function headers(json = true) {
  const h = { 'X-Telegram-Init-Data': initData };
  if (json) h['Content-Type'] = 'application/json';
  return h;
}

async function api(path, opts = {}) {
  try {
    const res = await fetch(API + path, { headers: headers(opts.json !== false), ...opts });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  } catch (e) { console.error('API Error:', e); throw e; }
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.remove('hidden');
  setTimeout(() => t.classList.add('hidden'), 2500);
}

function showScreen(name, pushStack = true) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById('screen-' + name);
  if (el) el.classList.add('active');

  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const nav = document.querySelector(`[data-nav="${name}"]`);
  if (nav) nav.classList.add('active');

  const mainScreens = ['home', 'mycourses', 'bookmarks', 'profile'];
  const back = document.getElementById('header-back');
  if (mainScreens.includes(name)) {
    back.classList.add('hidden');
    back.classList.remove('flex');
    screenStack.length = 0;
    screenStack.push(name);
  } else {
    back.classList.remove('hidden');
    back.classList.add('flex');
    if (pushStack) screenStack.push(name);
  }

  if (name === 'home') loadHome();
  else if (name === 'mycourses') loadMyCourses();
  else if (name === 'bookmarks') loadBookmarks();
  else if (name === 'profile') loadProfile();
  else if (name === 'search') document.getElementById('search-input').focus();

  window.scrollTo(0, 0);
}

function goBack() {
  screenStack.pop();
  const prev = screenStack[screenStack.length - 1] || 'home';
  showScreen(prev, false);
}

function difficultyLabel(d) {
  return { beginner: 'အခြေခံ', intermediate: 'အလယ်တန်း', advanced: 'အဆင့်မြင့်' }[d] || d;
}
function difficultyColor(d) {
  return { beginner: '#22c55e', intermediate: '#f59e0b', advanced: '#ef4444' }[d] || '#94a3b8';
}
function statusLabel(s) {
  return { pending: 'စိစစ်ဆဲ', approved: 'အတည်ပြုပြီး', rejected: 'ပယ်ချခံရ' }[s] || s;
}
function statusBadge(s) {
  const cls = { pending: 'badge-yellow', approved: 'badge-green', rejected: 'badge-red' }[s] || 'badge-blue';
  return `<span class="badge ${cls}">${statusLabel(s)}</span>`;
}
function formatMMK(n) { return Number(n || 0).toLocaleString() + ' MMK'; }
function timeAgo(d) {
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins} မိနစ်အကြာ`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} နာရီအကြာ`;
  return `${Math.floor(hrs / 24)} ရက်အကြာ`;
}

// ---- HOME ----
async function loadHome() {
  const [roadmaps, courses, announcements] = await Promise.all([
    api('/roadmaps'), api('/courses'), api('/announcements')
  ]);

  if (announcements.length > 0) {
    document.getElementById('announcements-bar').classList.remove('hidden');
    document.getElementById('announcement-text').textContent = announcements[0].title;
  }

  const rl = document.getElementById('roadmaps-list');
  rl.innerHTML = roadmaps.map(r => `
    <div class="card roadmap-card p-4 cursor-pointer" style="border-left-color: ${r.color}" onclick="loadRoadmapCourses(${r.id}, '${r.icon} ${r.title}')">
      <div class="flex items-center gap-3">
        <span class="text-2xl">${r.icon}</span>
        <div class="flex-1 min-w-0">
          <h3 class="font-bold text-sm truncate">${r.title}</h3>
          <p class="text-xs opacity-60 truncate">${r.description || ''}</p>
        </div>
        <svg width="16" height="16" fill="none" stroke="#94a3b8" stroke-width="2"><path d="M6 4l4 4-4 4"/></svg>
      </div>
    </div>
  `).join('');

  const cl = document.getElementById('courses-list');
  cl.innerHTML = courses.slice(0, 6).map(c => courseCard(c)).join('');
}

function courseCard(c) {
  return `
    <div class="card p-4 cursor-pointer" onclick="loadCourse(${c.id})">
      <div class="flex items-start gap-3">
        <div class="w-12 h-12 rounded-xl flex items-center justify-center text-lg flex-shrink-0" style="background: ${c.thumbnail_url ? '' : '#f1f5f9'};">
          ${c.thumbnail_url ? `<img src="${c.thumbnail_url}" class="w-full h-full rounded-xl object-cover">` : '📖'}
        </div>
        <div class="flex-1 min-w-0">
          <h3 class="font-bold text-sm">${c.title}</h3>
          <p class="text-xs opacity-60 mt-0.5 line-clamp-2">${c.description || ''}</p>
          <div class="flex items-center gap-2 mt-2">
            <span class="badge badge-blue">${formatMMK(c.price_mmk)}</span>
            <span class="flex items-center gap-1 text-xs opacity-50">
              <span class="difficulty-dot" style="background:${difficultyColor(c.difficulty)}"></span>
              ${difficultyLabel(c.difficulty)}
            </span>
            ${c.duration_hours ? `<span class="text-xs opacity-50">⏱ ${c.duration_hours}hr</span>` : ''}
          </div>
        </div>
      </div>
    </div>`;
}

function loadAllCourses() {
  api('/courses').then(courses => {
    document.getElementById('courses-list').innerHTML = courses.map(c => courseCard(c)).join('');
  });
}

async function loadRoadmapCourses(roadmapId, title) {
  showScreen('roadmap-courses');
  document.getElementById('roadmap-title').textContent = title;
  const courses = await api(`/courses?roadmap_id=${roadmapId}`);
  document.getElementById('roadmap-courses-list').innerHTML = courses.length > 0
    ? courses.map(c => courseCard(c)).join('')
    : '<div class="text-center py-8 opacity-50"><p>ဤ လမ်းကြောင်းတွင် သင်တန်း မရှိသေးပါ</p></div>';
}

// ---- SEARCH ----
let searchTimeout;
function handleSearch(q) {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(async () => {
    if (!q.trim()) { document.getElementById('search-results').innerHTML = ''; return; }
    const r = await api(`/search?q=${encodeURIComponent(q)}`);
    const el = document.getElementById('search-results');
    let html = '';
    if (r.courses.length > 0) {
      html += '<p class="text-xs font-bold opacity-60 mb-2">သင်တန်းများ</p>';
      html += r.courses.map(c => courseCard(c)).join('');
    }
    if (r.lessons.length > 0) {
      html += '<p class="text-xs font-bold opacity-60 mb-2 mt-4">သင်ခန်းစာများ</p>';
      html += r.lessons.map(l => `<div class="card p-3 cursor-pointer" onclick="loadCourse(${l.course_id})"><p class="text-sm font-medium">${l.title}</p><p class="text-xs opacity-50">${l.course_title || ''}</p></div>`).join('');
    }
    if (!r.courses.length && !r.lessons.length) html = '<div class="text-center py-8 opacity-50"><p>ရလဒ် မရှိပါ</p></div>';
    el.innerHTML = html;
  }, 300);
}

// ---- COURSE DETAIL ----
async function loadCourse(id) {
  showScreen('course');
  const el = document.getElementById('course-detail');
  el.innerHTML = '<div class="space-y-3"><div class="skeleton h-8 w-3/4"></div><div class="skeleton h-4 w-full"></div><div class="skeleton h-4 w-2/3"></div><div class="skeleton h-32 w-full"></div></div>';

  const [course, modules, reviews, discussions] = await Promise.all([
    api(`/courses/${id}`),
    api(`/courses/${id}/modules`),
    api(`/courses/${id}/reviews`),
    api(`/courses/${id}/discussions`)
  ]);
  currentData.course = course;
  currentData.modules = modules;

  let isEnrolled = false;
  let paymentStatus = null;
  let cert = null;
  if (initData) {
    try {
      const payments = await api('/my-payments');
      const cp = payments.find(p => p.course_id === id);
      if (cp) { paymentStatus = cp.status; isEnrolled = cp.status === 'approved'; }
      if (isEnrolled) { cert = await api(`/certificates/course/${id}`); }
    } catch (e) {}
  }

  const totalLessons = modules.reduce((s, m) => s + m.lessons.length, 0);
  const completedLessons = modules.reduce((s, m) => s + m.lessons.filter(l => l.completed).length, 0);
  const progressPct = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
  const avgRating = reviews.length > 0 ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : null;

  let html = `
    <div class="mb-4">
      <h1 class="text-xl font-bold">${course.title}</h1>
      <p class="text-sm opacity-70 mt-1">${course.description || ''}</p>
      <div class="flex flex-wrap items-center gap-2 mt-3">
        <span class="badge badge-blue text-sm">${formatMMK(course.price_mmk)}</span>
        <span class="flex items-center gap-1 text-xs"><span class="difficulty-dot" style="background:${difficultyColor(course.difficulty)}"></span>${difficultyLabel(course.difficulty)}</span>
        ${course.duration_hours ? `<span class="text-xs opacity-50">⏱ ${course.duration_hours} နာရီ</span>` : ''}
        ${avgRating ? `<span class="text-xs">⭐ ${avgRating} (${reviews.length})</span>` : ''}
      </div>
    </div>`;

  if (isEnrolled && totalLessons > 0) {
    html += `
      <div class="card p-4 mb-4">
        <div class="flex justify-between text-xs mb-2"><span class="font-medium">တိုးတက်မှု</span><span class="font-bold">${progressPct}%</span></div>
        <div class="progress-bar"><div class="progress-fill" style="width:${progressPct}%"></div></div>
        <p class="text-xs opacity-50 mt-1">${completedLessons}/${totalLessons} သင်ခန်းစာ ပြီးဆုံး</p>
        ${progressPct === 100 && !cert ? `<button class="btn-primary mt-3" onclick="generateCert(${id})">🏆 လက်မှတ် ရယူရန်</button>` : ''}
        ${cert ? `<div class="mt-3 p-3 rounded-xl bg-green-50 text-center"><p class="text-sm font-bold text-green-700">🎓 လက်မှတ် ရရှိပြီး</p><p class="text-xs text-green-600 mt-1">နံပါတ်: ${cert.certificate_number}</p><button class="btn-outline mt-2 text-xs" onclick="viewCertificate('${cert.certificate_number}', '${course.title}')">လက်မှတ် ကြည့်ရန်</button></div>` : ''}
      </div>`;
  }

  // Tabs
  html += `<div class="flex gap-2 mb-4 overflow-x-auto">
    <button class="tab-btn active" onclick="switchCourseTab('content', this)">📖 အကြောင်းအရာ</button>
    ${isEnrolled ? `<button class="tab-btn" onclick="switchCourseTab('discuss', this)">💬 ဆွေးနွေးချက် (${discussions.length})</button>` : ''}
    <button class="tab-btn" onclick="switchCourseTab('reviews', this)">⭐ သုံးသပ်ချက် (${reviews.length})</button>
  </div>`;

  // Content Tab
  html += `<div id="tab-content">`;
  if (modules.length > 0) {
    modules.forEach((m, mi) => {
      const mComplete = m.lessons.filter(l => l.completed).length;
      html += `<div class="card mb-3 overflow-hidden">
        <div class="p-3 flex items-center gap-2 cursor-pointer" onclick="this.nextElementSibling.classList.toggle('hidden')">
          <span class="text-xs opacity-40 font-bold">${mi + 1}</span>
          <span class="font-medium text-sm flex-1">${m.title}</span>
          ${isEnrolled ? `<span class="text-xs opacity-50">${mComplete}/${m.lessons.length}</span>` : `<span class="text-xs opacity-50">${m.lessons.length} ခု</span>`}
          <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 4l4 4 4-4"/></svg>
        </div>
        <div class="border-t px-3 pb-2">`;
      m.lessons.forEach(l => {
        const locked = !isEnrolled;
        html += `<div class="flex items-center gap-2 py-2 cursor-pointer ${locked ? 'opacity-40' : ''}" onclick="${locked ? '' : `loadLesson(${l.id})`}">
          ${l.completed ? '<span class="text-green-500">✅</span>' : locked ? '🔒' : '<span class="opacity-30">○</span>'}
          <span class="text-sm flex-1">${l.title}</span>
          ${l.video_url ? '<span class="text-xs opacity-40">🎬</span>' : ''}
          ${l.file_url ? '<span class="text-xs opacity-40">📎</span>' : ''}
        </div>`;
      });
      html += `</div></div>`;
    });
  } else {
    html += '<div class="text-center py-6 opacity-50"><p class="text-sm">အကြောင်းအရာ မရှိသေးပါ</p></div>';
  }
  html += `</div>`;

  // Discussion Tab
  html += `<div id="tab-discuss" class="hidden">`;
  if (isEnrolled) {
    html += `<div class="mb-4"><textarea id="discuss-input" class="w-full p-3 rounded-xl text-sm border" style="background: var(--tg-theme-secondary-bg-color, #f8f9fa); border-color: #e2e8f0;" rows="2" placeholder="ဆွေးနွေးချက် ရေးရန်..."></textarea>
      <button class="btn-primary mt-2 text-sm" onclick="postDiscussion(${id})">📤 ပို့ရန်</button></div>`;
    html += discussions.map(d => `<div class="card p-3 mb-2"><div class="flex items-center gap-2 mb-1"><span class="font-bold text-xs">${d.first_name || d.username || 'User'}</span><span class="text-xs opacity-40">${timeAgo(d.created_at)}</span></div><p class="text-sm">${d.message}</p></div>`).join('');
    if (discussions.length === 0) html += '<p class="text-center text-sm opacity-50 py-4">ဆွေးနွေးချက် မရှိသေးပါ</p>';
  }
  html += `</div>`;

  // Reviews Tab
  html += `<div id="tab-reviews" class="hidden">`;
  if (isEnrolled) {
    html += `<div class="card p-3 mb-4"><p class="text-xs font-medium mb-2">သင့် သုံးသပ်ချက်</p>
      <div class="flex gap-1 mb-2" id="rating-stars">${[1,2,3,4,5].map(i => `<span class="text-2xl cursor-pointer" onclick="setRating(${i})">☆</span>`).join('')}</div>
      <textarea id="review-comment" class="w-full p-2 rounded-lg text-sm border" style="background: var(--tg-theme-secondary-bg-color, #f8f9fa); border-color: #e2e8f0;" rows="2" placeholder="သုံးသပ်ချက် ရေးရန်..."></textarea>
      <button class="btn-primary mt-2 text-sm" onclick="submitReview(${id})">📤 သုံးသပ်ချက် ပို့ရန်</button></div>`;
  }
  html += reviews.map(r => `<div class="card p-3 mb-2"><div class="flex items-center gap-2 mb-1"><span class="font-bold text-xs">${r.first_name || r.username || 'User'}</span><span class="text-yellow-500 text-xs">${'⭐'.repeat(r.rating)}</span></div><p class="text-sm opacity-70">${r.comment || ''}</p></div>`).join('');
  if (reviews.length === 0) html += '<p class="text-center text-sm opacity-50 py-4">သုံးသပ်ချက် မရှိသေးပါ</p>';
  html += `</div>`;

  // Action Buttons
  if (!isEnrolled) {
    if (paymentStatus === 'pending') {
      html += `<div class="mt-4 p-4 rounded-xl text-center" style="background: #fef3c7;"><p class="text-sm font-medium text-amber-800">⏳ ငွေပေးချေမှု စိစစ်နေဆဲ ဖြစ်ပါသည်</p><p class="text-xs text-amber-700 mt-1">Admin မှ စစ်ဆေးပြီးပါက အကြောင်းကြားပါမည်</p></div>`;
    } else if (paymentStatus === 'rejected') {
      html += `<div class="mt-4"><div class="p-3 rounded-xl mb-3 text-center" style="background: #fee2e2;"><p class="text-sm font-medium text-red-800">❌ ငွေပေးချေမှု ပယ်ချခံရပါသည်</p></div>
        <button class="btn-primary" onclick="startPayment(${id})">🔄 ပြန်လည် ငွေပေးချေရန်</button></div>`;
    } else if (course.price_mmk > 0) {
      html += `<div class="mt-4 flex gap-2">
        <button class="btn-primary flex-1" onclick="startPayment(${id})">💳 ငွေပေးချေရန် (${formatMMK(course.price_mmk)})</button>
        <button class="btn-outline px-4" onclick="toggleBookmark(${id})">🔖</button></div>`;
    } else {
      html += `<button class="btn-primary mt-4" onclick="startPayment(${id})">📚 အခမဲ့ စာရင်းသွင်းရန်</button>`;
    }
  }

  el.innerHTML = html;
}

function switchCourseTab(tab, btn) {
  document.querySelectorAll('[id^="tab-"]').forEach(t => t.classList.add('hidden'));
  document.getElementById('tab-' + tab)?.classList.remove('hidden');
  btn.parentElement.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

let selectedRating = 0;
function setRating(n) {
  selectedRating = n;
  document.querySelectorAll('#rating-stars span').forEach((s, i) => { s.textContent = i < n ? '⭐' : '☆'; });
}

async function submitReview(courseId) {
  if (!selectedRating) { showToast('ကျေးဇူးပြု၍ အဆင့် သတ်မှတ်ပါ'); return; }
  await api(`/courses/${courseId}/reviews`, { method: 'POST', body: JSON.stringify({ rating: selectedRating, comment: document.getElementById('review-comment').value }) });
  showToast('သုံးသပ်ချက် ပို့ပြီးပါပြီ');
  loadCourse(courseId);
}

async function postDiscussion(courseId) {
  const msg = document.getElementById('discuss-input').value.trim();
  if (!msg) return;
  await api(`/courses/${courseId}/discussions`, { method: 'POST', body: JSON.stringify({ message: msg }) });
  showToast('ဆွေးနွေးချက် ပို့ပြီးပါပြီ');
  loadCourse(courseId);
}

async function toggleBookmark(courseId) {
  try {
    const bookmarks = await api('/bookmarks');
    const exists = bookmarks.find(b => b.id === courseId);
    if (exists) {
      await api(`/bookmarks/${courseId}`, { method: 'DELETE' });
      showToast('သိမ်းဆည်းမှု ဖယ်ရှားပြီး');
    } else {
      await api('/bookmarks', { method: 'POST', body: JSON.stringify({ course_id: courseId }) });
      showToast('သိမ်းဆည်းပြီးပါပြီ');
    }
  } catch (e) { showToast('အမှားတစ်ခု ဖြစ်ပေါ်ပါသည်'); }
}

// ---- LESSON ----
async function loadLesson(id) {
  showScreen('lesson');
  const el = document.getElementById('lesson-detail');
  el.innerHTML = '<div class="skeleton h-6 w-3/4 mb-3"></div><div class="skeleton h-40 w-full"></div>';
  try {
    const lesson = await api(`/lessons/${id}`);
    let quiz = null;
    try { quiz = await api(`/quizzes/lesson/${id}`); } catch (e) {}

    let html = `<h2 class="text-lg font-bold mb-3">${lesson.title}</h2>`;

    if (lesson.video_url) {
      const embedUrl = lesson.video_url.includes('youtube.com') || lesson.video_url.includes('youtu.be')
        ? `https://www.youtube.com/embed/${lesson.video_url.split(/[=/]/).pop()}`
        : lesson.video_url;
      html += `<div class="rounded-2xl overflow-hidden mb-4"><iframe src="${embedUrl}" class="w-full" style="aspect-ratio:16/9;" frameborder="0" allowfullscreen></iframe></div>`;
    }

    if (lesson.content) {
      html += `<div class="card p-4 mb-4 text-sm leading-relaxed">${lesson.content.replace(/\n/g, '<br>')}</div>`;
    }

    if (lesson.file_url) {
      html += `<a href="${lesson.file_url}" target="_blank" class="card p-3 mb-4 flex items-center gap-2"><span>📎</span><span class="text-sm font-medium">ဖိုင် ဒေါင်းလုဒ် လုပ်ရန်</span></a>`;
    }

    html += `<div class="flex gap-2 mt-4">
      <button class="btn-primary flex-1" onclick="toggleLessonComplete(${id}, ${lesson.course_id}, ${!lesson.completed})">
        ${lesson.completed ? '↩️ မပြီးဆုံးအဖြစ် ပြန်သတ်မှတ်ရန်' : '✅ ပြီးဆုံးကြောင်း မှတ်ရန်'}
      </button>
    </div>`;

    if (quiz) {
      html += `<div class="card p-4 mt-4">
        <h3 class="font-bold text-sm mb-1">📝 ${quiz.title}</h3>
        <p class="text-xs opacity-60 mb-3">ပေးရမှတ် - ${quiz.passing_score}% | မေးခွန်း ${quiz.questions.length} ခု</p>
        ${quiz.lastAttempt ? `<div class="p-2 rounded-lg mb-3 text-sm ${quiz.lastAttempt.passed ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}">
          နောက်ဆုံးအကြိမ်: ${quiz.lastAttempt.score}% ${quiz.lastAttempt.passed ? '(အောင်မြင်)' : '(ရှုံး)'}
        </div>` : ''}
        <button class="btn-primary text-sm" onclick="startQuiz(${quiz.id})">📝 စာမေးပွဲ ဖြေရန်</button>
      </div>`;
      currentData.quiz = quiz;
    }

    el.innerHTML = html;
  } catch (e) {
    el.innerHTML = '<div class="text-center py-8"><p class="text-sm opacity-60">သင်ခန်းစာ ဝင်ခွင့် မရှိပါ</p><button class="btn-outline mt-3" onclick="goBack()">နောက်သို့</button></div>';
  }
}

async function toggleLessonComplete(lessonId, courseId, completed) {
  await api('/progress', { method: 'POST', body: JSON.stringify({ lesson_id: lessonId, completed }) });
  showToast(completed ? 'ပြီးဆုံးကြောင်း မှတ်သားပြီး' : 'ပြန်ဖြုတ်ပြီး');
  loadLesson(lessonId);
}

// ---- QUIZ ----
async function startQuiz(quizId) {
  showScreen('quiz');
  const quiz = currentData.quiz;
  const el = document.getElementById('quiz-detail');
  let html = `<h2 class="text-lg font-bold mb-4">📝 ${quiz.title}</h2>`;
  quiz.questions.forEach((q, i) => {
    html += `<div class="card p-4 mb-3">
      <p class="font-medium text-sm mb-3">${i + 1}. ${q.question}</p>
      <div class="space-y-2">
        ${['a', 'b', 'c', 'd'].filter(opt => q['option_' + opt]).map(opt => `
          <label class="flex items-center gap-2 p-2 rounded-lg cursor-pointer hover:bg-gray-50">
            <input type="radio" name="q_${q.id}" value="${opt}" class="accent-indigo-500">
            <span class="text-sm">${q['option_' + opt]}</span>
          </label>
        `).join('')}
      </div>
    </div>`;
  });
  html += `<button class="btn-primary mt-2" onclick="submitQuiz(${quizId})">📤 အဖြေ တင်ရန်</button>`;
  el.innerHTML = html;
}

async function submitQuiz(quizId) {
  const answers = {};
  currentData.quiz.questions.forEach(q => {
    const selected = document.querySelector(`input[name="q_${q.id}"]:checked`);
    if (selected) answers[q.id] = selected.value;
  });
  try {
    const result = await api(`/quizzes/${quizId}/submit`, { method: 'POST', body: JSON.stringify({ answers }) });
    const el = document.getElementById('quiz-detail');
    el.innerHTML = `<div class="text-center py-8">
      <p class="text-5xl mb-4">${result.passed ? '🎉' : '😔'}</p>
      <h2 class="text-xl font-bold mb-2">${result.passed ? 'အောင်မြင်ပါသည်!' : 'ထပ်ကြိုးစားပါ'}</h2>
      <p class="text-3xl font-bold mb-2" style="color: ${result.passed ? '#22c55e' : '#ef4444'}">${result.score}%</p>
      <p class="text-sm opacity-60">${result.correct}/${result.total} မှန်</p>
      <button class="btn-outline mt-6" onclick="goBack()">နောက်သို့</button>
    </div>`;
  } catch (e) { showToast('အမှား ဖြစ်ပေါ်ပါသည်'); }
}

// ---- PAYMENT ----
async function startPayment(courseId) {
  showScreen('payment');
  const el = document.getElementById('payment-flow');
  el.innerHTML = '<div class="skeleton h-40 w-full"></div>';
  const methods = await api('/payment-methods');
  const course = currentData.course;
  currentData.paymentCourseId = courseId;

  if (methods.length === 0) {
    el.innerHTML = `<div class="text-center py-8"><p class="text-4xl mb-3">💳</p><p class="text-sm opacity-60">ငွေပေးချေနည်း မရှိသေးပါ</p><p class="text-xs opacity-40 mt-1">Admin မှ ထည့်သွင်းရန် လိုအပ်ပါသည်</p></div>`;
    return;
  }

  let html = `<h2 class="text-base font-bold mb-1">💳 ငွေပေးချေရန်</h2>
    <p class="text-xs opacity-60 mb-4">${course?.title || ''} - ${formatMMK(course?.price_mmk)}</p>
    <p class="text-sm font-medium mb-3">ငွေပေးချေနည်း ရွေးပါ</p>
    <div class="space-y-3" id="payment-methods-list">`;

  methods.forEach(m => {
    html += `<div class="card p-4 cursor-pointer border-2 border-transparent" id="pm-${m.id}" onclick="selectPaymentMethod(${m.id})">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl flex items-center justify-center" style="background: #f1f5f9;">💰</div>
        <div class="flex-1">
          <h3 class="font-bold text-sm">${m.name}</h3>
          ${m.account_name ? `<p class="text-xs opacity-60">${m.account_name}</p>` : ''}
        </div>
        <div class="w-5 h-5 rounded-full border-2 border-gray-300" id="pm-radio-${m.id}"></div>
      </div>
    </div>`;
  });

  html += `</div>
    <div id="payment-detail" class="hidden mt-4">
      <div class="card p-4 mb-4" id="payment-method-info"></div>
      <div class="file-upload" id="screenshot-upload" onclick="document.getElementById('screenshot-file').click()">
        <input type="file" id="screenshot-file" accept="image/*" onchange="previewScreenshot(this)">
        <p class="text-3xl mb-2">📸</p>
        <p class="text-sm font-medium">ငွေလွှဲပြေစာ ဓာတ်ပုံ တင်ရန်</p>
        <p class="text-xs opacity-50 mt-1">နှိပ်၍ ဓာတ်ပုံ ရွေးပါ</p>
      </div>
      <div id="screenshot-preview" class="hidden mt-3 rounded-xl overflow-hidden">
        <img id="preview-img" class="w-full">
      </div>
      <button class="btn-primary mt-4" id="submit-payment-btn" onclick="submitPayment()" disabled>📤 ငွေပေးချေမှု တင်သွင်းရန်</button>
    </div>`;

  el.innerHTML = html;
}

let selectedPaymentMethodId = null;
function selectPaymentMethod(id) {
  selectedPaymentMethodId = id;
  document.querySelectorAll('[id^="pm-radio-"]').forEach(r => { r.style.background = ''; r.style.borderColor = '#d1d5db'; });
  document.querySelectorAll('[id^="pm-"]').forEach(c => { if (c.id.startsWith('pm-') && !c.id.includes('radio')) c.style.borderColor = 'transparent'; });
  document.getElementById(`pm-${id}`).style.borderColor = '#6366f1';
  document.getElementById(`pm-radio-${id}`).style.background = '#6366f1';
  document.getElementById(`pm-radio-${id}`).style.borderColor = '#6366f1';
  document.getElementById('payment-detail').classList.remove('hidden');

  api('/payment-methods').then(methods => {
    const m = methods.find(m => m.id === id);
    if (!m) return;
    let info = `<h3 class="font-bold text-sm mb-3">${m.name}</h3>`;
    if (m.qr_image_url) info += `<img src="${m.qr_image_url}" class="w-48 mx-auto rounded-xl mb-3">`;
    if (m.account_number) info += `<div class="flex justify-between py-2 border-b" style="border-color: #f1f5f9;"><span class="text-xs opacity-60">အကောင့် နံပါတ်</span><span class="text-sm font-medium">${m.account_number}</span></div>`;
    if (m.account_name) info += `<div class="flex justify-between py-2 border-b" style="border-color: #f1f5f9;"><span class="text-xs opacity-60">အကောင့် အမည်</span><span class="text-sm font-medium">${m.account_name}</span></div>`;
    if (m.instructions) info += `<div class="mt-3 p-3 rounded-xl text-xs" style="background: #f8fafc;">${m.instructions}</div>`;
    info += `<div class="mt-3 p-3 rounded-xl text-center" style="background: #f0fdf4;"><p class="text-sm font-bold text-green-700">${formatMMK(currentData.course?.price_mmk)}</p><p class="text-xs text-green-600">ပေးချေရမည့် ပမာဏ</p></div>`;
    document.getElementById('payment-method-info').innerHTML = info;
  });
}

function previewScreenshot(input) {
  if (input.files && input.files[0]) {
    const reader = new FileReader();
    reader.onload = e => {
      document.getElementById('preview-img').src = e.target.result;
      document.getElementById('screenshot-preview').classList.remove('hidden');
      document.getElementById('submit-payment-btn').disabled = false;
    };
    reader.readAsDataURL(input.files[0]);
  }
}

async function submitPayment() {
  const btn = document.getElementById('submit-payment-btn');
  btn.disabled = true; btn.textContent = '⏳ တင်သွင်းနေပါသည်...';
  const file = document.getElementById('screenshot-file').files[0];
  if (!file || !selectedPaymentMethodId) { showToast('ဓာတ်ပုံ နှင့် ငွေပေးချေနည်း ရွေးပါ'); btn.disabled = false; btn.textContent = '📤 ငွေပေးချေမှု တင်သွင်းရန်'; return; }
  const fd = new FormData();
  fd.append('screenshot', file);
  fd.append('course_id', currentData.paymentCourseId);
  fd.append('payment_method_id', selectedPaymentMethodId);
  try {
    await fetch(API + '/payments', { method: 'POST', headers: { 'X-Telegram-Init-Data': initData }, body: fd });
    document.getElementById('payment-flow').innerHTML = `
      <div class="text-center py-12">
        <p class="text-5xl mb-4">✅</p>
        <h2 class="text-lg font-bold mb-2">တင်သွင်းပြီးပါပြီ</h2>
        <p class="text-sm opacity-60">Admin မှ စစ်ဆေးပြီးပါက Telegram မှ အကြောင်းကြားပါမည်</p>
        <button class="btn-outline mt-6" onclick="showScreen('home')">ပင်မ စာမျက်နှာ</button>
      </div>`;
  } catch (e) { showToast('အမှား ဖြစ်ပေါ်ပါသည်'); btn.disabled = false; btn.textContent = '📤 ငွေပေးချေမှု တင်သွင်းရန်'; }
}

// ---- MY COURSES ----
async function loadMyCourses() {
  if (!initData) { document.getElementById('no-courses').classList.remove('hidden'); return; }
  try {
    const courses = await api('/my-courses');
    const el = document.getElementById('my-courses-list');
    const no = document.getElementById('no-courses');
    if (courses.length === 0) { no.classList.remove('hidden'); el.innerHTML = ''; return; }
    no.classList.add('hidden');
    el.innerHTML = courses.map(c => courseCard(c)).join('');
  } catch (e) { document.getElementById('no-courses').classList.remove('hidden'); }
}

// ---- BOOKMARKS ----
async function loadBookmarks() {
  if (!initData) { document.getElementById('no-bookmarks').classList.remove('hidden'); return; }
  try {
    const bookmarks = await api('/bookmarks');
    const el = document.getElementById('bookmarks-list');
    const no = document.getElementById('no-bookmarks');
    if (bookmarks.length === 0) { no.classList.remove('hidden'); el.innerHTML = ''; return; }
    no.classList.add('hidden');
    el.innerHTML = bookmarks.map(c => courseCard(c)).join('');
  } catch (e) { document.getElementById('no-bookmarks').classList.remove('hidden'); }
}

// ---- PROFILE ----
async function loadProfile() {
  if (tgUser) {
    document.getElementById('profile-avatar').textContent = (tgUser.first_name || '?')[0];
    document.getElementById('profile-name').textContent = tgUser.first_name || 'User';
    document.getElementById('profile-username').textContent = tgUser.username ? `@${tgUser.username}` : '';
  }
  if (!initData) return;
  try {
    const payments = await api('/my-payments');
    const el = document.getElementById('payment-history');
    el.innerHTML = payments.length > 0
      ? payments.map(p => `<div class="card p-3"><div class="flex items-center justify-between"><div><p class="text-sm font-medium">${p.courses?.title || ''}</p><p class="text-xs opacity-50 mt-0.5">${timeAgo(p.created_at)}</p></div>${statusBadge(p.status)}</div>${p.admin_note ? `<p class="text-xs mt-2 opacity-60">📝 ${p.admin_note}</p>` : ''}</div>`).join('')
      : '<p class="text-center text-sm opacity-50 py-4">ငွေပေးချေမှု မရှိသေးပါ</p>';
  } catch (e) {}
}

// ---- CERTIFICATE ----
async function generateCert(courseId) {
  try {
    const cert = await api(`/certificates/generate/${courseId}`, { method: 'POST' });
    showToast('🎓 လက်မှတ် ထုတ်ပေးပြီးပါပြီ!');
    loadCourse(courseId);
  } catch (e) { showToast('သင်ခန်းစာ အားလုံး မပြီးဆုံးသေးပါ'); }
}

function viewCertificate(certNumber, courseTitle) {
  showScreen('certificate');
  const user = tgUser || {};
  document.getElementById('certificate-detail').innerHTML = `
    <div class="card p-6 text-center" style="border: 3px solid #6366f1;">
      <p class="text-4xl mb-3">🎓</p>
      <h2 class="text-lg font-bold" style="color: #6366f1;">လမ်းစ (Lann Sa)</h2>
      <p class="text-xs opacity-50 mb-4">CERTIFICATE OF COMPLETION</p>
      <p class="text-sm opacity-60 mb-1">ဤ လက်မှတ်ကို</p>
      <h3 class="text-xl font-bold mb-1">${user.first_name || 'Student'} ${user.last_name || ''}</h3>
      <p class="text-sm opacity-60 mb-4">အား ပေးအပ်ပါသည်</p>
      <div class="p-3 rounded-xl mb-4" style="background: #f5f3ff;">
        <p class="text-base font-bold" style="color: #6366f1;">${courseTitle}</p>
      </div>
      <p class="text-sm opacity-60 mb-1">သင်တန်း အောင်မြင်စွာ ပြီးဆုံးကြောင်း</p>
      <p class="text-xs opacity-40">နံပါတ်: ${certNumber}</p>
      <p class="text-xs opacity-40 mt-1">ရက်စွဲ: ${new Date().toLocaleDateString('my-MM')}</p>
    </div>`;
}

// ---- INIT ----
loadHome();
