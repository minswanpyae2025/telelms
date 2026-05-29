// လမ်းစ (Lann Sa) LMS - Frontend Logic
const tg = window.Telegram?.WebApp;
if (tg) { tg.ready(); tg.expand(); }

const API = '/api';
const initData = tg?.initData || '';
const tgUser = tg?.initDataUnsafe?.user || null;

const screenStack = ['home'];
let currentData = {};
let appSettings = {};
let lang = 'my';
let roadmapMap = {};

// --- i18n ---
const L = {
  my: {
    app_title: '🎓 လမ်းစ',
    subtitle: 'သင့်အနာဂတ်ကို ဒီကနေ စလိုက်ပါ',
    back: 'နောက်သို့',
    roadmaps_title: '🗺️ အသက်မွေးလမ်းကြောင်းများ',
    courses_title: '📖 သင်တန်းများ',
    view_all: 'အားလုံးကြည့်ရန်',
    search_placeholder: 'သင်တန်း ရှာရန်...',
    search_courses: 'သင်တန်းများ',
    search_lessons: 'သင်ခန်းစာများ',
    no_results: 'ရလဒ် မရှိပါ',
    no_courses_roadmap: 'ဤ လမ်းကြောင်းတွင် သင်တန်း မရှိသေးပါ',
    my_courses_title: '📚 ကျွန်ုပ်၏ သင်တန်းများ',
    no_enrolled: 'သင်တန်း မစာရင်းသွင်းရသေးပါ',
    bookmarks_title: '🔖 သိမ်းထားသော သင်တန်းများ',
    no_bookmarks: 'သိမ်းထားသော သင်တန်း မရှိသေးပါ',
    profile_user: 'အသုံးပြုသူ',
    payment_history: '💳 ငွေပေးချေမှု မှတ်တမ်း',
    no_payments: 'ငွေပေးချေမှု မရှိသေးပါ',
    nav_home: 'ပင်မ',
    nav_courses: 'သင်တန်း',
    nav_bookmarks: 'သိမ်းဆည်း',
    nav_profile: 'ပရိုဖိုင်',
    difficulty_beginner: 'အခြေခံ',
    difficulty_intermediate: 'အလယ်တန်း',
    difficulty_advanced: 'အဆင့်မြင့်',
    status_pending: 'စိစစ်ဆဲ',
    status_approved: 'အတည်ပြုပြီး',
    status_rejected: 'ပယ်ချခံရ',
    progress_label: 'တိုးတက်မှု',
    lessons_done: 'သင်ခန်းစာ ပြီးဆုံး',
    get_cert: '🏆 လက်မှတ် ရယူရန်',
    cert_earned: '🎓 လက်မှတ် ရရှိပြီး',
    cert_number: 'နံပါတ်',
    view_cert: 'လက်မှတ် ကြည့်ရန်',
    tab_content: '📖 အကြောင်းအရာ',
    tab_discuss: '💬 ဆွေးနွေးချက်',
    tab_reviews: '⭐ သုံးသပ်ချက်',
    items: 'ခု',
    no_content: 'အကြောင်းအရာ မရှိသေးပါ',
    discuss_placeholder: 'ဆွေးနွေးချက် ရေးရန်...',
    send: '📤 ပို့ရန်',
    no_discussions: 'ဆွေးနွေးချက် မရှိသေးပါ',
    your_review: 'သင့် သုံးသပ်ချက်',
    review_placeholder: 'သုံးသပ်ချက် ရေးရန်...',
    send_review: '📤 သုံးသပ်ချက် ပို့ရန်',
    no_reviews: 'သုံးသပ်ချက် မရှိသေးပါ',
    payment_pending: '⏳ ငွေပေးချေမှု စိစစ်နေဆဲ ဖြစ်ပါသည်',
    payment_pending_sub: 'Admin မှ စစ်ဆေးပြီးပါက အကြောင်းကြားပါမည်',
    payment_rejected: '❌ ငွေပေးချေမှု ပယ်ချခံရပါသည်',
    retry_payment: '🔄 ပြန်လည် ငွေပေးချေရန်',
    pay_btn: '💳 ငွေပေးချေရန်',
    free_enroll: '📚 အခမဲ့ စာရင်းသွင်းရန်',
    payment_title: '💳 ငွေပေးချေရန်',
    choose_method: 'ငွေပေးချေနည်း ရွေးပါ',
    manual_payment: '💰 Myanmar ငွေလွှဲ',
    crypto_payment: '🪙 Crypto ငွေပေးချေ',
    no_payment_methods: 'ငွေပေးချေနည်း မရှိသေးပါ',
    no_payment_methods_sub: 'Admin မှ ထည့်သွင်းရန် လိုအပ်ပါသည်',
    account_number: 'အကောင့် နံပါတ်',
    account_name: 'အကောင့် အမည်',
    amount_to_pay: 'ပေးချေရမည့် ပမာဏ',
    upload_screenshot: '📸 ငွေလွှဲပြေစာ ဓာတ်ပုံ တင်ရန်',
    upload_screenshot_sub: 'နှိပ်၍ ဓာတ်ပုံ ရွေးပါ',
    submit_payment: '📤 ငွေပေးချေမှု တင်သွင်းရန်',
    submitting: '⏳ တင်သွင်းနေပါသည်...',
    submitted: '✅ တင်သွင်းပြီးပါပြီ',
    submitted_msg: 'Admin မှ စစ်ဆေးပြီးပါက Telegram မှ အကြောင်းကြားပါမည်',
    go_home: 'ပင်မ စာမျက်နှာ',
    file_download: '📎 ဖိုင် ဒေါင်းလုဒ် လုပ်ရန်',
    mark_complete: '✅ ပြီးဆုံးကြောင်း မှတ်ရန်',
    mark_incomplete: '↩️ မပြီးဆုံးအဖြစ် ပြန်သတ်မှတ်ရန်',
    quiz_pass: 'ပေးရမှတ်',
    quiz_questions: 'မေးခွန်း',
    quiz_last: 'နောက်ဆုံးအကြိမ်',
    quiz_passed: 'အောင်မြင်',
    quiz_failed: 'ရှုံး',
    take_quiz: '📝 စာမေးပွဲ ဖြေရန်',
    submit_quiz: '📤 အဖြေ တင်ရန်',
    quiz_success: 'အောင်မြင်ပါသည်!',
    quiz_retry: 'ထပ်ကြိုးစားပါ',
    correct_answers: 'မှန်',
    no_access: 'သင်ခန်းစာ ဝင်ခွင့် မရှိပါ',
    select_photo_method: 'ဓာတ်ပုံ နှင့် ငွေပေးချေနည်း ရွေးပါ',
    error_occurred: 'အမှားတစ်ခု ဖြစ်ပေါ်ပါသည်',
    rate_please: 'ကျေးဇူးပြု၍ အဆင့် သတ်မှတ်ပါ',
    review_sent: 'သုံးသပ်ချက် ပို့ပြီးပါပြီ',
    discuss_sent: 'ဆွေးနွေးချက် ပို့ပြီးပါပြီ',
    saved: 'သိမ်းဆည်းပြီးပါပြီ',
    removed: 'သိမ်းဆည်းမှု ဖယ်ရှားပြီး',
    marked_done: 'ပြီးဆုံးကြောင်း မှတ်သားပြီး',
    marked_undone: 'ပြန်ဖြုတ်ပြီး',
    cert_generated: '🎓 လက်မှတ် ထုတ်ပေးပြီးပါပြီ!',
    cert_not_complete: 'သင်ခန်းစာ အားလုံး မပြီးဆုံးသေးပါ',
    cert_title: 'လမ်းစ (Lann Sa)',
    cert_subtitle: 'CERTIFICATE OF COMPLETION',
    cert_for: 'ဤ လက်မှတ်ကို',
    cert_awarded: 'အား ပေးအပ်ပါသည်',
    cert_completed: 'သင်တန်း အောင်မြင်စွာ ပြီးဆုံးကြောင်း',
    cert_date: 'ရက်စွဲ',
    minutes_ago: 'မိနစ်အကြာ',
    hours_ago: 'နာရီအကြာ',
    days_ago: 'ရက်အကြာ',
    // Crypto
    choose_coin: '🪙 Coin ရွေးပါ',
    send_exact: 'အောက်ပါ ပမာဏအတိအကျ ပို့ပါ',
    wallet_address: 'Wallet Address',
    copy_address: '📋 ကူးယူရန်',
    copied: 'ကူးယူပြီး!',
    time_remaining: 'ကျန်ချိန်',
    checking_payment: 'ငွေပေးချေမှု စစ်ဆေးနေ...',
    crypto_waiting: 'ငွေပေးချေမှု စောင့်ဆိုင်းနေ...',
    crypto_confirming: 'Blockchain တွင် အတည်ပြုနေ...',
    crypto_confirmed: 'အတည်ပြုပြီး! ပြောင်းလဲနေ...',
    crypto_finished: '✅ ငွေပေးချေမှု အောင်မြင်ပါသည်!',
    crypto_failed: '❌ ငွေပေးချေမှု မအောင်မြင်ပါ',
    crypto_expired: '⏰ အချိန်ကုန်သွားပါပြီ',
    crypto_refunded: '↩️ ပြန်အမ်းပြီး',
    crypto_no_config: 'Crypto ငွေပေးချေနည်း ပြင်ဆင်ထားခြင်း မရှိသေးပါ',
    crypto_history: '🪙 Crypto ငွေပေးချေမှု',
    coupon_placeholder: 'ကူပွန် ကုဒ် ထည့်ပါ',
    apply_coupon: 'အသုံးပြုရန်',
    coupon_applied: 'ကူပွန် အသုံးပြုပြီး! လျှော့ စျေး:',
    coupon_invalid: 'ကူပွန် မမှန်ပါ',
    coupon_free: 'ကူပွန်ဖြင့် အခမဲ့ စာရင်းသွင်းပြီးပါပြီ!',
    original_price: 'မူရင်း စျေး',
    discounted_price: 'လျှော့ စျေး',
    auto_cert: '🎓 သင်တန်း အောင်မြင်စွာ ပြီးဆုံးပါသည်! လက်မှတ် ထုတ်ပေးပြီးပါပြီ။',
  },
  en: {
    app_title: '🎓 Lann Sa',
    subtitle: 'Start your career journey here',
    back: 'Back',
    roadmaps_title: '🗺️ Career Roadmaps',
    courses_title: '📖 Courses',
    view_all: 'View All',
    search_placeholder: 'Search courses...',
    search_courses: 'Courses',
    search_lessons: 'Lessons',
    no_results: 'No results found',
    no_courses_roadmap: 'No courses in this roadmap yet',
    my_courses_title: '📚 My Courses',
    no_enrolled: 'No courses enrolled yet',
    bookmarks_title: '🔖 Saved Courses',
    no_bookmarks: 'No saved courses yet',
    profile_user: 'User',
    payment_history: '💳 Payment History',
    no_payments: 'No payment history',
    nav_home: 'Home',
    nav_courses: 'Courses',
    nav_bookmarks: 'Saved',
    nav_profile: 'Profile',
    difficulty_beginner: 'Beginner',
    difficulty_intermediate: 'Intermediate',
    difficulty_advanced: 'Advanced',
    status_pending: 'Pending',
    status_approved: 'Approved',
    status_rejected: 'Rejected',
    progress_label: 'Progress',
    lessons_done: 'lessons completed',
    get_cert: '🏆 Get Certificate',
    cert_earned: '🎓 Certificate Earned',
    cert_number: 'Number',
    view_cert: 'View Certificate',
    tab_content: '📖 Content',
    tab_discuss: '💬 Discussion',
    tab_reviews: '⭐ Reviews',
    items: 'items',
    no_content: 'No content yet',
    discuss_placeholder: 'Write a comment...',
    send: '📤 Send',
    no_discussions: 'No discussions yet',
    your_review: 'Your Review',
    review_placeholder: 'Write a review...',
    send_review: '📤 Send Review',
    no_reviews: 'No reviews yet',
    payment_pending: '⏳ Payment under review',
    payment_pending_sub: 'You will be notified once admin reviews',
    payment_rejected: '❌ Payment rejected',
    retry_payment: '🔄 Try Again',
    pay_btn: '💳 Pay',
    free_enroll: '📚 Enroll Free',
    payment_title: '💳 Payment',
    choose_method: 'Choose payment method',
    manual_payment: '💰 Myanmar Transfer',
    crypto_payment: '🪙 Crypto Payment',
    no_payment_methods: 'No payment methods available',
    no_payment_methods_sub: 'Admin needs to configure payment methods',
    account_number: 'Account Number',
    account_name: 'Account Name',
    amount_to_pay: 'Amount to pay',
    upload_screenshot: '📸 Upload transfer screenshot',
    upload_screenshot_sub: 'Tap to choose photo',
    submit_payment: '📤 Submit Payment',
    submitting: '⏳ Submitting...',
    submitted: '✅ Submitted',
    submitted_msg: 'You will be notified via Telegram once admin reviews',
    go_home: 'Go Home',
    file_download: '📎 Download File',
    mark_complete: '✅ Mark Complete',
    mark_incomplete: '↩️ Mark Incomplete',
    quiz_pass: 'Pass score',
    quiz_questions: 'questions',
    quiz_last: 'Last attempt',
    quiz_passed: 'Passed',
    quiz_failed: 'Failed',
    take_quiz: '📝 Take Quiz',
    submit_quiz: '📤 Submit Answers',
    quiz_success: 'Congratulations!',
    quiz_retry: 'Try again',
    correct_answers: 'correct',
    no_access: 'Access denied',
    select_photo_method: 'Please select photo and payment method',
    error_occurred: 'An error occurred',
    rate_please: 'Please set a rating',
    review_sent: 'Review submitted',
    discuss_sent: 'Comment posted',
    saved: 'Saved',
    removed: 'Removed from saved',
    marked_done: 'Marked complete',
    marked_undone: 'Marked incomplete',
    cert_generated: '🎓 Certificate issued!',
    cert_not_complete: 'Not all lessons completed',
    cert_title: 'Lann Sa',
    cert_subtitle: 'CERTIFICATE OF COMPLETION',
    cert_for: 'This certifies that',
    cert_awarded: 'has completed',
    cert_completed: 'the following course',
    cert_date: 'Date',
    minutes_ago: 'min ago',
    hours_ago: 'hr ago',
    days_ago: 'days ago',
    choose_coin: '🪙 Choose Coin',
    send_exact: 'Send the exact amount below',
    wallet_address: 'Wallet Address',
    copy_address: '📋 Copy',
    copied: 'Copied!',
    time_remaining: 'Time remaining',
    checking_payment: 'Checking payment...',
    crypto_waiting: 'Waiting for payment...',
    crypto_confirming: 'Confirming on blockchain...',
    crypto_confirmed: 'Confirmed! Processing...',
    crypto_finished: '✅ Payment successful!',
    crypto_failed: '❌ Payment failed',
    crypto_expired: '⏰ Payment expired',
    crypto_refunded: '↩️ Refunded',
    crypto_no_config: 'Crypto payment not configured yet',
    crypto_history: '🪙 Crypto Payments',
    coupon_placeholder: 'Enter coupon code',
    apply_coupon: 'Apply',
    coupon_applied: 'Coupon applied! Discount:',
    coupon_invalid: 'Invalid coupon',
    coupon_free: 'Free enrollment with coupon!',
    original_price: 'Original price',
    discounted_price: 'Discounted price',
    auto_cert: '🎓 Course completed! Certificate has been issued.',
  },
};

Object.assign(L.my, {
  open_in_telegram_title: 'Telegram မှ ဖွင့်ပါ',
  open_in_telegram_desc: 'လုံခြုံရေးအတွက် ဤ app ကို Telegram Mini App ထဲမှသာ အသုံးပြုနိုင်ပါသည်။',
  open_in_telegram_btn: 'Telegram တွင် ဖွင့်ရန်',
  banned_title: 'အသုံးပြုခွင့် ကန့်သတ်ထားပါသည်',
  banned_desc: 'ဤ account အတွက် အသုံးပြုခွင့် ပိတ်ထားပါသည်။ Admin ကို ဆက်သွယ်ပါ။',
  maintenance_title: 'ပြုပြင်ထိန်းသိမ်းနေပါသည်',
  onboarding_title: 'ဘယ်လို စတင်မလဲ?',
  onboarding_1: 'လမ်းကြောင်း ရွေးပါ', onboarding_2: 'သင်တန်း စာရင်းသွင်းပါ', onboarding_3: 'သင်ခန်းစာ လေ့လာပါ', onboarding_4: 'လက်မှတ် ရယူပါ',
  dismiss: 'နားလည်ပါပြီ', show_guide: 'Guide ပြန်ကြည့်ရန်',
  continue_learning: '▶️ ဆက်လက် လေ့လာရန်', next_lesson: 'နောက်သင်ခန်းစာ', continue_btn: 'ဆက်လုပ်ရန်',
  free: 'အခမဲ့', preview: 'Preview', checklist_title: 'မပို့ခင် စစ်ဆေးရန်', checklist_1: 'ပမာဏအတိအကျ လွှဲပါ', checklist_2: 'စာရင်းမှန်ကြောင်း စစ်ပါ', checklist_3: 'ရှင်းလင်းသော Screenshot တင်ပါ',
});
Object.assign(L.en, {
  open_in_telegram_title: 'Open from Telegram',
  open_in_telegram_desc: 'For security, this app is only available inside Telegram Mini App.',
  open_in_telegram_btn: 'Open in Telegram',
  banned_title: 'Access restricted',
  banned_desc: 'This account has been blocked. Please contact the admin.',
  maintenance_title: 'Maintenance in progress',
  onboarding_title: 'How to start',
  onboarding_1: 'Choose a path', onboarding_2: 'Enroll in a course', onboarding_3: 'Learn lessons', onboarding_4: 'Get certificate',
  dismiss: 'Got it', show_guide: 'Show guide again',
  continue_learning: '▶️ Continue Learning', next_lesson: 'Next lesson', continue_btn: 'Continue',
  free: 'Free', preview: 'Preview', checklist_title: 'Before submitting', checklist_1: 'Transfer the exact amount', checklist_2: 'Check account details', checklist_3: 'Upload a clear screenshot',
});

function _(key) { return (L[lang] || L.my)[key] || L.my[key] || key; }

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
function safeColor(value, fallback = '#6C5CE7') {
  const color = String(value || '').trim();
  return /^#[0-9a-f]{6}$/i.test(color) ? color : fallback;
}
function safeInitial(value) { return escapeHtml(String(value || 'U').trim().charAt(0) || 'U'); }
function jsonArg(value) { return encodeURIComponent(JSON.stringify(value)); }
function emptyState(icon, title, desc, actionHtml = '') {
  return `<div class="empty-state"><span class="empty-state-icon">${icon}</span><p class="empty-state-title">${escapeHtml(title)}</p><p class="empty-state-desc">${escapeHtml(desc || '')}</p>${actionHtml}</div>`;
}
function blockedState(title, desc, actionHtml = '') {
  document.body.innerHTML = `<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;background:#F7F8FC;"><div class="card card-elevated" style="padding:28px;text-align:center;max-width:420px;"><p style="font-size:56px;margin-bottom:12px;">🔒</p><h1 style="font-size:20px;font-weight:800;margin-bottom:8px;">${escapeHtml(title)}</h1><p style="font-size:14px;color:var(--text-secondary);line-height:1.7;">${escapeHtml(desc)}</p>${actionHtml}</div></div>`;
}
async function logBlockedAccess(reason) {
  try { await fetch('/api/security/access-log', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event_type: 'blocked_access', reason }) }); } catch (e) {}
}


function headers(json = true) {
  const h = { 'X-Telegram-Init-Data': initData };
  if (json) h['Content-Type'] = 'application/json';
  return h;
}

async function api(path, opts = {}) {
  try {
    const res = await fetch(API + path, { headers: headers(opts.json !== false), ...opts });
    if (!res.ok) {
      let payload = {};
      try { payload = await res.json(); } catch (err) { payload = { message: await res.text() }; }
      if (payload.error === 'BANNED') blockedState(_('banned_title'), payload.message || _('banned_desc'));
      if (payload.error === 'MAINTENANCE') blockedState(_('maintenance_title'), payload.message || '');
      const err = new Error(payload.message || payload.error || 'API error');
      err.payload = payload;
      throw err;
    }
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
    back.style.display = 'none';
    screenStack.length = 0; screenStack.push(name);
  } else {
    back.style.display = 'flex';
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
  return { beginner: _('difficulty_beginner'), intermediate: _('difficulty_intermediate'), advanced: _('difficulty_advanced') }[d] || d;
}
function difficultyColor(d) { return { beginner: '#22c55e', intermediate: '#f59e0b', advanced: '#ef4444' }[d] || '#94a3b8'; }
function statusLabel(s) { return { pending: _('status_pending'), approved: _('status_approved'), rejected: _('status_rejected') }[s] || s; }
function statusBadge(s) {
  const cls = { pending: 'badge-yellow', approved: 'badge-green', rejected: 'badge-red' }[s] || 'badge-blue';
  return `<span class="badge ${cls}">${statusLabel(s)}</span>`;
}
function formatMMK(n) { return Number(n || 0).toLocaleString() + ' MMK'; }
function timeAgo(d) {
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins} ${_('minutes_ago')}`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} ${_('hours_ago')}`;
  return `${Math.floor(hrs / 24)} ${_('days_ago')}`;
}

function applyLanguageUI() {
  document.querySelector('#header-back-label').textContent = _('back');
  document.querySelector('#app-header h1').textContent = _('app_title');
  document.getElementById('header-subtitle').textContent = _('subtitle');
  document.querySelector('[data-nav="home"] span').textContent = _('nav_home');
  document.querySelector('[data-nav="mycourses"] span').textContent = _('nav_courses');
  document.querySelector('[data-nav="bookmarks"] span').textContent = _('nav_bookmarks');
  document.querySelector('[data-nav="profile"] span').textContent = _('nav_profile');
  document.getElementById('search-input').placeholder = _('search_placeholder');
  const rt = document.getElementById('roadmaps-title');
  if (rt) rt.innerHTML = _('roadmaps_title');
  const ct = document.getElementById('courses-title');
  if (ct) ct.innerHTML = _('courses_title');
  const va = document.getElementById('view-all-btn');
  if (va) va.textContent = _('view_all');
  const mt = document.getElementById('mycourses-title');
  if (mt) mt.innerHTML = _('my_courses_title');
  const bt = document.getElementById('bookmarks-title');
  if (bt) bt.innerHTML = _('bookmarks_title');
}

function renderOnboarding() {
  const el = document.getElementById('onboarding-card');
  if (!el) return;
  if (localStorage.getItem('lannsa_onboarding_dismissed') === '1') { el.innerHTML = ''; return; }
  el.innerHTML = `<div class="card card-elevated" style="padding:16px;margin:16px 0;background:linear-gradient(135deg,rgba(108,92,231,0.08),rgba(129,236,236,0.08));">
    <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:12px;"><h3 style="font-size:15px;font-weight:800;">${_('onboarding_title')}</h3><button class="btn-outline" style="font-size:11px;padding:6px 10px;" onclick="localStorage.setItem('lannsa_onboarding_dismissed','1');renderOnboarding();">${_('dismiss')}</button></div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;text-align:center;">${[['🗺️','onboarding_1'],['💳','onboarding_2'],['📖','onboarding_3'],['🏆','onboarding_4']].map(x => `<div><p style="font-size:22px;">${x[0]}</p><p style="font-size:10px;color:var(--text-secondary);font-weight:700;line-height:1.4;">${_(x[1])}</p></div>`).join('')}</div>
  </div>`;
}

async function loadContinueLearning() {
  const el = document.getElementById('continue-learning-section');
  if (!el || !initData) return;
  try {
    const item = await api('/continue-learning');
    if (!item) { el.innerHTML = ''; return; }
    el.innerHTML = `<div class="card card-elevated" style="padding:16px;margin:14px 0;">
      <p style="font-size:13px;font-weight:800;color:var(--primary);margin-bottom:6px;">${_('continue_learning')}</p>
      <h3 style="font-size:15px;font-weight:800;">${escapeHtml(item.course.title)}</h3>
      <p style="font-size:12px;color:var(--text-muted);margin:4px 0 10px;">${_('next_lesson')}: ${escapeHtml(item.lesson.title)}</p>
      <div class="progress-bar"><div class="progress-fill" style="width:${Number(item.progress || 0)}%"></div></div>
      <button class="btn-primary" style="margin-top:12px;font-size:13px;" onclick="loadLesson(${Number(item.lesson.id)})">${_('continue_btn')}</button>
    </div>`;
  } catch (e) { el.innerHTML = ''; }
}

// ---- HOME ----
async function loadHome() {
  renderOnboarding();
  loadContinueLearning();
  // Skeleton loaders
  document.getElementById('roadmaps-list').innerHTML = Array(4).fill(`
    <div style="min-width:130px;max-width:155px;scroll-snap-align:start;flex-shrink:0;">
      <div class="card" style="padding:16px 12px;text-align:center;min-height:115px;display:flex;flex-direction:column;align-items:center;justify-content:center;">
        <div class="skeleton" style="width:50px;height:50px;border-radius:16px;margin-bottom:8px;"></div>
        <div class="skeleton" style="height:12px;width:80%;margin:0 auto 4px;"></div>
        <div class="skeleton" style="height:10px;width:60%;margin:0 auto;"></div>
      </div>
    </div>`).join('');
  document.getElementById('courses-list').innerHTML = Array(3).fill(`
    <div class="card" style="padding:14px;">
      <div style="display:flex;gap:12px;align-items:center;">
        <div class="skeleton" style="width:50px;height:50px;border-radius:14px;flex-shrink:0;"></div>
        <div style="flex:1;">
          <div class="skeleton" style="height:14px;width:70%;margin-bottom:6px;"></div>
          <div class="skeleton" style="height:11px;width:100%;margin-bottom:6px;"></div>
          <div class="skeleton" style="height:20px;width:80px;border-radius:99px;"></div>
        </div>
      </div>
    </div>`).join('');

  const [roadmaps, courses, announcements] = await Promise.all([
    api('/roadmaps'), api('/courses'), api('/announcements')
  ]);

  if (announcements.length > 0) {
    document.getElementById('announcements-bar').classList.remove('hidden');
    document.getElementById('announcement-text').textContent = announcements[0].title;
  }

  document.getElementById('roadmaps-title').innerHTML = _('roadmaps_title');
  document.getElementById('courses-title').innerHTML = _('courses_title');
  document.getElementById('view-all-btn').textContent = _('view_all');

  roadmapMap = {};
  roadmaps.forEach(r => { roadmapMap[r.id] = r; });

  // Horizontal scrollable roadmap cards
  const rl = document.getElementById('roadmaps-list');
  rl.innerHTML = roadmaps.map(r => {
    const color = safeColor(r.color);
    const rid = Number(r.id);
    return `
    <div style="min-width:130px;max-width:155px;scroll-snap-align:start;cursor:pointer;flex-shrink:0;" onclick="loadRoadmapCourses(${rid}, (roadmapMap[${rid}]?.icon || '') + ' ' + (roadmapMap[${rid}]?.title || ''))">
      <div class="card card-elevated" style="padding:16px 12px;text-align:center;position:relative;overflow:hidden;min-height:115px;display:flex;flex-direction:column;align-items:center;justify-content:center;">
        <div style="position:absolute;top:-20px;right:-20px;width:70px;height:70px;border-radius:50%;background:${color};opacity:0.08;"></div>
        <div style="width:50px;height:50px;border-radius:16px;display:flex;align-items:center;justify-content:center;font-size:24px;margin-bottom:8px;background:${color}15;flex-shrink:0;">
          ${escapeHtml(r.icon)}
        </div>
        <h3 style="font-size:12px;font-weight:700;margin-bottom:2px;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;line-height:1.4;">${escapeHtml(r.title)}</h3>
        <p style="font-size:10px;color:var(--text-muted);overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical;line-height:1.4;margin-top:2px;">${escapeHtml(r.description || '')}</p>
      </div>
    </div>`;
  }).join('');

  const cl = document.getElementById('courses-list');
  cl.innerHTML = courses.slice(0, 6).map(c => courseCard(c)).join('');
}

function courseCard(c) {
  const rm = roadmapMap[c.roadmap_id];
  const cardColor = safeColor(rm ? rm.color : '#6C5CE7');
  const cardIcon = escapeHtml(rm ? rm.icon : '📖');
  const diffColor = difficultyColor(c.difficulty);
  const thumbnailUrl = safeUrl(c.thumbnail_url);
  return `
    <div class="card card-elevated" style="cursor:pointer;padding:14px;" onclick="loadCourse(${Number(c.id)})">
      <div style="display:flex;gap:12px;align-items:center;">
        <div style="width:50px;height:50px;border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;position:relative;overflow:hidden;${thumbnailUrl ? '' : 'background:' + cardColor + '12;'}">
          ${thumbnailUrl ? `<img src="${thumbnailUrl}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:14px;">` : cardIcon}
        </div>
        <div style="flex:1;min-width:0;">
          <h3 style="font-size:14px;font-weight:700;margin-bottom:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(c.title)}</h3>
          <p style="font-size:11px;color:var(--text-secondary);line-height:1.4;margin-bottom:8px;" class="line-clamp-2">${escapeHtml(c.description || '')}</p>
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
            <span class="badge badge-blue" style="font-size:11px;padding:4px 10px;">${formatMMK(c.price_mmk)}</span>
            <span style="display:inline-flex;align-items:center;gap:4px;font-size:10px;color:var(--text-muted);font-weight:600;">
              <span class="difficulty-dot" style="background:${diffColor};"></span>
              ${escapeHtml(difficultyLabel(c.difficulty))}
            </span>
            ${c.duration_hours ? `<span style="font-size:10px;color:var(--text-muted);">⏱ ${Number(c.duration_hours)}hr</span>` : ''}
            ${c.updated_at || c.created_at ? `<span style="font-size:10px;color:var(--text-muted);">🆕 ${new Date(c.updated_at || c.created_at).toLocaleDateString(lang === 'my' ? 'my-MM' : 'en-US')}</span>` : ''}
          </div>
        </div>
        <svg width="16" height="16" fill="none" stroke="var(--text-muted)" stroke-width="2.5" stroke-linecap="round" style="flex-shrink:0;"><path d="M6 4l4 4-4 4"/></svg>
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
  document.getElementById('roadmap-courses-list').innerHTML = Array(3).fill(`
    <div class="card" style="padding:14px;">
      <div style="display:flex;gap:12px;align-items:center;">
        <div class="skeleton" style="width:50px;height:50px;border-radius:14px;flex-shrink:0;"></div>
        <div style="flex:1;">
          <div class="skeleton" style="height:14px;width:70%;margin-bottom:6px;"></div>
          <div class="skeleton" style="height:11px;width:100%;margin-bottom:6px;"></div>
          <div class="skeleton" style="height:20px;width:80px;border-radius:99px;"></div>
        </div>
      </div>
    </div>`).join('');
  const courses = await api(`/courses?roadmap_id=${roadmapId}`);
  document.getElementById('roadmap-courses-list').innerHTML = courses.length > 0
    ? courses.map(c => courseCard(c)).join('')
    : `<div class="empty-state"><span class="empty-state-icon">📚</span><p class="empty-state-title">${_('no_courses_roadmap')}</p></div>`;
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
      html += `<p class="text-xs font-bold opacity-60 mb-2">${_('search_courses')}</p>`;
      html += r.courses.map(c => courseCard(c)).join('');
    }
    if (r.lessons.length > 0) {
      html += `<p class="text-xs font-bold opacity-60 mb-2 mt-4">${_('search_lessons')}</p>`;
      html += r.lessons.map(l => `<div class="card p-3 cursor-pointer" onclick="loadCourse(${l.course_id})"><p class="text-sm font-medium">${escapeHtml(l.title)}</p><p class="text-xs opacity-50">${escapeHtml(l.course_title || '')}</p></div>`).join('');
    }
    if (!r.courses.length && !r.lessons.length) html = `<div class="text-center py-8 opacity-50"><p>${_('no_results')}</p></div>`;
    el.innerHTML = html;
  }, 300);
}

// ---- COURSE DETAIL ----
async function loadCourse(id) {
  showScreen('course');
  const el = document.getElementById('course-detail');
  el.innerHTML = `<div style="padding:16px;">
    <div class="skeleton" style="height:28px;width:75%;margin-bottom:12px;"></div>
    <div class="skeleton" style="height:14px;width:100%;margin-bottom:8px;"></div>
    <div class="skeleton" style="height:14px;width:65%;margin-bottom:16px;"></div>
    <div style="display:flex;gap:8px;margin-bottom:20px;">
      <div class="skeleton" style="height:28px;width:100px;border-radius:99px;"></div>
      <div class="skeleton" style="height:28px;width:80px;border-radius:99px;"></div>
    </div>
    <div class="skeleton" style="height:140px;width:100%;border-radius:20px;"></div>
  </div>`;

  const [course, modules, reviews, discussions] = await Promise.all([
    api(`/courses/${id}`), api(`/courses/${id}/modules`), api(`/courses/${id}/reviews`), api(`/courses/${id}/discussions`)
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
      if (!isEnrolled) {
        const cryptoPayments = await api('/my-crypto-payments');
        const ccp = cryptoPayments.find(p => p.course_id === id);
        if (ccp) {
          if (ccp.status === 'finished') { isEnrolled = true; paymentStatus = 'approved'; }
          else if (['waiting', 'confirming', 'confirmed', 'sending'].includes(ccp.status)) { paymentStatus = 'pending'; }
        }
      }
      if (isEnrolled) { cert = await api(`/certificates/course/${id}`); }
    } catch (e) {}
  }

  const totalLessons = modules.reduce((s, m) => s + m.lessons.length, 0);
  const completedLessons = modules.reduce((s, m) => s + m.lessons.filter(l => l.completed).length, 0);
  const progressPct = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
  const avgRating = reviews.length > 0 ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : null;

  const rm = roadmapMap[course.roadmap_id];
  const heroColor = safeColor(rm ? rm.color : '#6C5CE7');
  const heroIcon = escapeHtml(rm ? rm.icon : '📖');

  let html = `
    <!-- Course Hero -->
    <div style="background:linear-gradient(135deg, ${heroColor}dd, ${heroColor}88);padding:22px 16px 18px;position:relative;overflow:hidden;">
      <div style="position:absolute;top:-30px;right:-30px;width:120px;height:120px;border-radius:50%;background:rgba(255,255,255,0.1);"></div>
      <div style="position:absolute;bottom:-20px;left:-20px;width:80px;height:80px;border-radius:50%;background:rgba(255,255,255,0.06);"></div>
      <div style="position:relative;z-index:1;">
        <div style="display:inline-flex;align-items:center;gap:6px;background:rgba(255,255,255,0.2);backdrop-filter:blur(10px);padding:6px 14px;border-radius:99px;margin-bottom:14px;">
          <span style="font-size:14px;">${heroIcon}</span>
          <span style="font-size:12px;color:#fff;font-weight:600;">${escapeHtml(rm ? rm.title : '')}</span>
        </div>
        <h1 style="font-size:20px;font-weight:800;color:#fff;margin-bottom:6px;line-height:1.35;">${escapeHtml(course.title)}</h1>
        <p style="font-size:12px;color:rgba(255,255,255,0.85);line-height:1.6;">${escapeHtml(course.description || '')}</p>
        <div style="display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-top:14px;">
          <span style="background:rgba(255,255,255,0.2);backdrop-filter:blur(10px);color:#fff;padding:6px 14px;border-radius:99px;font-size:13px;font-weight:700;">${formatMMK(course.price_mmk)}</span>
          <span style="display:inline-flex;align-items:center;gap:4px;color:rgba(255,255,255,0.9);font-size:12px;font-weight:600;">
            <span class="difficulty-dot" style="background:${difficultyColor(course.difficulty)};box-shadow:0 0 6px ${difficultyColor(course.difficulty)};"></span>
            ${escapeHtml(difficultyLabel(course.difficulty))}
          </span>
          ${course.duration_hours ? `<span style="color:rgba(255,255,255,0.8);font-size:12px;">⏱ ${Number(course.duration_hours)} ${lang === 'my' ? 'နာရီ' : 'hr'}</span>` : ''}
          ${course.updated_at || course.created_at ? `<span style="color:rgba(255,255,255,0.8);font-size:12px;">🆕 ${new Date(course.updated_at || course.created_at).toLocaleDateString(lang === 'my' ? 'my-MM' : 'en-US')}</span>` : ''}
          ${avgRating ? `<span style="color:rgba(255,255,255,0.9);font-size:12px;">⭐ ${avgRating} (${reviews.length})</span>` : ''}
        </div>
      </div>
    </div>
    <div style="padding:16px;">`;

  if (isEnrolled && totalLessons > 0) {
    html += `
      <div class="card card-elevated" style="padding:18px;margin-bottom:16px;background:linear-gradient(135deg,rgba(108,92,231,0.04),rgba(0,206,201,0.04));">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
          <span style="font-size:13px;font-weight:600;color:var(--text-secondary);">${_('progress_label')}</span>
          <span style="font-size:18px;font-weight:800;color:var(--primary);">${progressPct}%</span>
        </div>
        <div class="progress-bar"><div class="progress-fill" style="width:${progressPct}%"></div></div>
        <p style="font-size:12px;color:var(--text-muted);margin-top:8px;">${completedLessons}/${totalLessons} ${_('lessons_done')}</p>
        ${progressPct === 100 && !cert ? `<button class="btn-primary" style="margin-top:14px;" onclick="generateCert(${id})">${_('get_cert')}</button>` : ''}
        ${cert ? `<div style="margin-top:14px;padding:16px;border-radius:16px;background:linear-gradient(135deg,#00B894,#55EFC4);text-align:center;">
          <p style="font-size:14px;font-weight:700;color:#fff;">${_('cert_earned')}</p>
          <p style="font-size:12px;color:rgba(255,255,255,0.85);margin-top:4px;">${_('cert_number')}: ${escapeHtml(cert.certificate_number)}</p>
          <button class="btn-ghost" style="margin-top:10px;background:rgba(255,255,255,0.25);color:#fff;" onclick="viewCertificate(JSON.parse(decodeURIComponent('${jsonArg(cert.certificate_number)}')), JSON.parse(decodeURIComponent('${jsonArg(course.title)}')))">${_('view_cert')}</button>
        </div>` : ''}
      </div>`;
  }

  html += `<div style="display:flex;gap:8px;margin-bottom:16px;overflow-x:auto;padding-bottom:4px;">
    <button class="tab-btn active" onclick="switchCourseTab('content', this)">${_('tab_content')}</button>
    ${isEnrolled ? `<button class="tab-btn" onclick="switchCourseTab('discuss', this)">${_('tab_discuss')} (${discussions.length})</button>` : ''}
    <button class="tab-btn" onclick="switchCourseTab('reviews', this)">${_('tab_reviews')} (${reviews.length})</button>
  </div>`;

  html += `<div id="tab-content">`;
  if (modules.length > 0) {
    modules.forEach((m, mi) => {
      const mComplete = m.lessons.filter(l => l.completed).length;
      html += `<div class="card" style="margin-bottom:12px;">
        <div style="padding:14px 16px;display:flex;align-items:center;gap:10px;cursor:pointer;" onclick="this.nextElementSibling.classList.toggle('hidden')">
          <div style="width:28px;height:28px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;background:rgba(108,92,231,0.1);color:var(--primary);">${mi + 1}</div>
          <span style="flex:1;font-size:14px;font-weight:700;">${escapeHtml(m.title)}</span>
          ${isEnrolled ? `<span style="font-size:12px;color:var(--text-muted);font-weight:600;">${mComplete}/${m.lessons.length}</span>` : `<span style="font-size:12px;color:var(--text-muted);">${m.lessons.length} ${_('items')}</span>`}
          <svg width="14" height="14" fill="none" stroke="var(--text-muted)" stroke-width="2.5" stroke-linecap="round"><path d="M3 5l4 4 4-4"/></svg>
        </div>
        <div style="border-top:1px solid var(--border);padding:6px 16px 10px;">`;
      m.lessons.forEach(l => {
        const locked = !isEnrolled && !l.is_preview;
        html += `<div style="display:flex;align-items:center;gap:10px;padding:10px 0;cursor:${locked?'default':'pointer'};opacity:${locked?'0.45':'1'};" onclick="${locked ? '' : `loadLesson(${l.id})`}">
          ${l.completed ? '<div style="width:22px;height:22px;border-radius:50%;background:linear-gradient(135deg,#00B894,#55EFC4);display:flex;align-items:center;justify-content:center;"><svg width="12" height="12" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"><path d="M2 6l3 3 5-5"/></svg></div>'
            : locked ? '<div style="width:22px;height:22px;border-radius:50%;background:var(--border);display:flex;align-items:center;justify-content:center;font-size:10px;">🔒</div>'
            : '<div style="width:22px;height:22px;border-radius:50%;border:2px solid var(--border);"></div>'}
          <span style="flex:1;font-size:13px;font-weight:500;">${escapeHtml(l.title)}</span>
          ${l.video_url ? '<span style="font-size:11px;opacity:0.5;">🎬</span>' : ''}
          ${l.is_preview ? `<span class="badge badge-blue" style="font-size:9px;padding:2px 6px;">${_('preview')}</span>` : ''}${l.file_url ? '<span style="font-size:11px;opacity:0.5;">📎</span>' : ''}
        </div>`;
      });
      html += `</div></div>`;
    });
  } else {
    html += `<div class="empty-state" style="padding:32px;"><span class="empty-state-icon" style="font-size:40px;">📝</span><p class="empty-state-title">${_('no_content')}</p></div>`;
  }
  html += `</div>`;

  html += `<div id="tab-discuss" class="hidden">`;
  if (isEnrolled) {
    html += `<div style="margin-bottom:16px;">
      <textarea id="discuss-input" style="width:100%;padding:14px;border-radius:var(--radius-sm);font-size:14px;border:1.5px solid var(--border);background:var(--bg-card);color:var(--text);outline:none;resize:none;" rows="2" placeholder="${_('discuss_placeholder')}" onfocus="this.style.borderColor='var(--primary-light)'" onblur="this.style.borderColor='var(--border)'"></textarea>
      <button class="btn-primary" style="margin-top:10px;font-size:14px;" onclick="postDiscussion(${id})">${_('send')}</button></div>`;
    html += discussions.map(d => `<div class="card" style="padding:14px;margin-bottom:10px;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
        <div style="width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,var(--primary),var(--accent));display:flex;align-items:center;justify-content:center;font-size:11px;color:#fff;font-weight:700;">${safeInitial(d.first_name || d.username)}</div>
        <span style="font-size:13px;font-weight:700;">${escapeHtml(d.first_name || d.username || 'User')}</span>
        <span style="font-size:11px;color:var(--text-muted);margin-left:auto;">${timeAgo(d.created_at)}</span>
      </div>
      <p style="font-size:14px;line-height:1.6;color:var(--text-secondary);">${escapeHtml(d.message)}</p>
    </div>`).join('');
    if (discussions.length === 0) html += `<div class="empty-state" style="padding:24px;"><span style="font-size:36px;">💬</span><p class="empty-state-desc">${_('no_discussions')}</p></div>`;
  }
  html += `</div>`;

  html += `<div id="tab-reviews" class="hidden">`;
  if (isEnrolled) {
    html += `<div class="card card-elevated" style="padding:16px;margin-bottom:16px;">
      <p style="font-size:13px;font-weight:700;margin-bottom:10px;">${_('your_review')}</p>
      <div id="rating-stars" style="display:flex;gap:4px;margin-bottom:10px;">${[1,2,3,4,5].map(i => `<span style="font-size:28px;cursor:pointer;transition:transform 0.15s;" onclick="setRating(${i})" onmouseenter="this.style.transform='scale(1.2)'" onmouseleave="this.style.transform='scale(1)'">☆</span>`).join('')}</div>
      <textarea id="review-comment" style="width:100%;padding:12px;border-radius:var(--radius-xs);font-size:14px;border:1.5px solid var(--border);background:var(--bg);color:var(--text);outline:none;resize:none;" rows="2" placeholder="${_('review_placeholder')}" onfocus="this.style.borderColor='var(--primary-light)'" onblur="this.style.borderColor='var(--border)'"></textarea>
      <button class="btn-primary" style="margin-top:10px;font-size:14px;" onclick="submitReview(${id})">${_('send_review')}</button>
    </div>`;
  }
  html += reviews.map(r => `<div class="card" style="padding:14px;margin-bottom:10px;">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
      <div style="width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,#FDCB6E,#F8A500);display:flex;align-items:center;justify-content:center;font-size:11px;color:#fff;font-weight:700;">${safeInitial(r.first_name || r.username)}</div>
      <span style="font-size:13px;font-weight:700;">${escapeHtml(r.first_name || r.username || 'User')}</span>
      <span style="font-size:13px;color:#F8A500;">${'★'.repeat(r.rating)}${'☆'.repeat(5-r.rating)}</span>
    </div>
    <p style="font-size:13px;color:var(--text-secondary);line-height:1.5;">${escapeHtml(r.comment || '')}</p>
  </div>`).join('');
  if (reviews.length === 0) html += `<div class="empty-state" style="padding:24px;"><span style="font-size:36px;">⭐</span><p class="empty-state-desc">${_('no_reviews')}</p></div>`;
  html += `</div>`;

  if (!isEnrolled) {
    if (paymentStatus === 'pending') {
      html += `<div style="margin-top:20px;padding:20px;border-radius:var(--radius);text-align:center;background:linear-gradient(135deg,#FFEAA7,#FDCB6E);box-shadow:0 2px 10px rgba(253,203,110,0.3);">
        <p style="font-size:24px;margin-bottom:8px;">⏳</p>
        <p style="font-size:14px;font-weight:700;color:#6C5200;">${_('payment_pending')}</p>
        <p style="font-size:12px;color:#8B6914;margin-top:4px;">${_('payment_pending_sub')}</p>
      </div>`;
    } else if (paymentStatus === 'rejected') {
      html += `<div style="margin-top:20px;">
        <div style="padding:16px;border-radius:var(--radius);margin-bottom:12px;text-align:center;background:linear-gradient(135deg,#FAB1A0,#E17055);box-shadow:0 2px 10px rgba(225,112,85,0.3);">
          <p style="font-size:14px;font-weight:700;color:#fff;">${_('payment_rejected')}</p>
        </div>
        <button class="btn-primary" onclick="startPayment(${id})">${_('retry_payment')}</button>
      </div>`;
    } else if (course.price_mmk > 0) {
      html += `<div style="margin-top:20px;display:flex;gap:10px;">
        <button class="btn-primary" style="flex:1;" onclick="startPayment(${id})">${_('pay_btn')} (${formatMMK(course.price_mmk)})</button>
        <button class="btn-outline" style="padding:13px 18px;flex-shrink:0;" onclick="toggleBookmark(${id})">🔖</button>
      </div>`;
    } else {
      html += `<button class="btn-primary" style="margin-top:20px;" onclick="startPayment(${id})">${_('free_enroll')}</button>`;
    }
  }

  html += `</div>`; // close padding div

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
  if (!selectedRating) { showToast(_('rate_please')); return; }
  await api(`/courses/${courseId}/reviews`, { method: 'POST', body: JSON.stringify({ rating: selectedRating, comment: document.getElementById('review-comment').value }) });
  showToast(_('review_sent'));
  loadCourse(courseId);
}

async function postDiscussion(courseId) {
  const msg = document.getElementById('discuss-input').value.trim();
  if (!msg) return;
  await api(`/courses/${courseId}/discussions`, { method: 'POST', body: JSON.stringify({ message: msg }) });
  showToast(_('discuss_sent'));
  loadCourse(courseId);
}

async function toggleBookmark(courseId) {
  try {
    const bookmarks = await api('/bookmarks');
    const exists = bookmarks.find(b => b.id === courseId);
    if (exists) {
      await api(`/bookmarks/${courseId}`, { method: 'DELETE' });
      showToast(_('removed'));
    } else {
      await api('/bookmarks', { method: 'POST', body: JSON.stringify({ course_id: courseId }) });
      showToast(_('saved'));
    }
  } catch (e) { showToast(_('error_occurred')); }
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

    let html = `<h2 class="text-lg font-bold mb-3">${escapeHtml(lesson.title)}</h2>`;
    if (lesson.video_url) {
      const embedUrl = lesson.video_url.includes('youtube.com') || lesson.video_url.includes('youtu.be')
        ? `https://www.youtube.com/embed/${lesson.video_url.split(/[=/]/).pop()}`
        : lesson.video_url;
      html += `<div class="rounded-2xl overflow-hidden mb-4"><iframe src="${safeUrl(embedUrl)}" class="w-full" style="aspect-ratio:16/9;" frameborder="0" allowfullscreen></iframe></div>`;
    }
    if (lesson.content) {
      html += `<div class="card p-4 mb-4 text-sm leading-relaxed">${escapeHtml(lesson.content).replace(/\n/g, '<br>')}</div>`;
    }
    if (lesson.file_url) {
      html += `<a href="${safeUrl(lesson.file_url)}" target="_blank" rel="noopener noreferrer" class="card p-3 mb-4 flex items-center gap-2"><span>📎</span><span class="text-sm font-medium">${_('file_download')}</span></a>`;
    }
    html += `<div class="flex gap-2 mt-4">
      <button class="btn-primary flex-1" onclick="toggleLessonComplete(${id}, ${lesson.course_id}, ${!lesson.completed})">
        ${lesson.completed ? _('mark_incomplete') : _('mark_complete')}
      </button>
    </div>`;
    if (quiz) {
      html += `<div class="card p-4 mt-4">
        <h3 class="font-bold text-sm mb-1">📝 ${escapeHtml(quiz.title)}</h3>
        <p class="text-xs opacity-60 mb-3">${_('quiz_pass')} - ${quiz.passing_score}% | ${quiz.questions.length} ${_('quiz_questions')}</p>
        ${quiz.lastAttempt ? `<div class="p-2 rounded-lg mb-3 text-sm ${quiz.lastAttempt.passed ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}">
          ${_('quiz_last')}: ${quiz.lastAttempt.score}% ${quiz.lastAttempt.passed ? `(${_('quiz_passed')})` : `(${_('quiz_failed')})`}
        </div>` : ''}
        <button class="btn-primary text-sm" onclick="startQuiz(${quiz.id})">${_('take_quiz')}</button>
      </div>`;
      currentData.quiz = quiz;
    }
    el.innerHTML = html;
  } catch (e) {
    el.innerHTML = `<div class="text-center py-8"><p class="text-sm opacity-60">${_('no_access')}</p><button class="btn-outline mt-3" onclick="goBack()">${_('back')}</button></div>`;
  }
}

async function toggleLessonComplete(lessonId, courseId, completed) {
  const result = await api('/progress', { method: 'POST', body: JSON.stringify({ lesson_id: lessonId, completed, course_id: courseId }) });
  if (result.certificate) {
    showToast(_('auto_cert'));
  } else {
    showToast(completed ? _('marked_done') : _('marked_undone'));
  }
  loadLesson(lessonId);
}

// ---- QUIZ ----
async function startQuiz(quizId) {
  showScreen('quiz');
  const quiz = currentData.quiz;
  const el = document.getElementById('quiz-detail');
  let html = `<h2 class="text-lg font-bold mb-4">📝 ${escapeHtml(quiz.title)}</h2>`;
  quiz.questions.forEach((q, i) => {
    html += `<div class="card p-4 mb-3">
      <p class="font-medium text-sm mb-3">${i + 1}. ${escapeHtml(q.question)}</p>
      <div class="space-y-2">
        ${['a', 'b', 'c', 'd'].filter(opt => q['option_' + opt]).map(opt => `
          <label class="flex items-center gap-2 p-2 rounded-lg cursor-pointer hover:bg-gray-50">
            <input type="radio" name="q_${q.id}" value="${opt}" class="accent-indigo-500">
            <span class="text-sm">${escapeHtml(q['option_' + opt])}</span>
          </label>
        `).join('')}
      </div>
    </div>`;
  });
  html += `<button class="btn-primary mt-2" onclick="submitQuiz(${quizId})">${_('submit_quiz')}</button>`;
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
      <h2 class="text-xl font-bold mb-2">${result.passed ? _('quiz_success') : _('quiz_retry')}</h2>
      <p class="text-3xl font-bold mb-2" style="color: ${result.passed ? '#22c55e' : '#ef4444'}">${result.score}%</p>
      <p class="text-sm opacity-60">${result.correct}/${result.total} ${_('correct_answers')}</p>
      <button class="btn-outline mt-6" onclick="goBack()">${_('back')}</button>
    </div>`;
  } catch (e) { showToast(_('error_occurred')); }
}

// ---- PAYMENT ----
async function startPayment(courseId) {
  showScreen('payment');
  const el = document.getElementById('payment-flow');
  el.innerHTML = '<div class="skeleton h-40 w-full"></div>';

  const course = currentData.course;
  currentData.paymentCourseId = courseId;

  const manualEnabled = appSettings.myanmar_payment_enabled !== 'false';
  const cryptoEnabled = appSettings.crypto_payment_enabled === 'true';

  let methods = [];
  if (manualEnabled) {
    try { methods = await api('/payment-methods'); } catch (e) {}
  }

  const hasManual = manualEnabled && methods.length > 0;
  const hasCrypto = cryptoEnabled;

  if (!hasManual && !hasCrypto) {
    el.innerHTML = `<div class="text-center py-8"><p class="text-4xl mb-3">💳</p><p class="text-sm opacity-60">${_('no_payment_methods')}</p><p class="text-xs opacity-40 mt-1">${_('no_payment_methods_sub')}</p></div>`;
    return;
  }

  let html = `<h2 class="text-base font-bold mb-1">${_('payment_title')}</h2>
    <p class="text-xs opacity-60 mb-2">${escapeHtml(course?.title || '')} - ${formatMMK(course?.price_mmk)}${course?.price_usdt ? ` / $${course.price_usdt} USDT` : ''}</p>
    <div class="card p-3 mb-4">
      <div class="flex gap-2">
        <input class="form-input flex-1" style="border:1.5px solid #e2e8f0;border-radius:10px;padding:8px 12px;font-size:13px;" id="coupon-input" placeholder="${_('coupon_placeholder')}" />
        <button class="btn-outline" style="padding:8px 16px;font-size:12px;border-radius:10px;" onclick="applyCoupon(${courseId})">${_('apply_coupon')}</button>
      </div>
      <div id="coupon-result" class="mt-2 text-xs hidden"></div>
    </div>`;

  if (hasManual && hasCrypto) {
    html += `<p class="text-sm font-medium mb-3">${_('choose_method')}</p>
    <div class="flex gap-2 mb-4">
      <button class="tab-btn active" id="tab-manual-btn" onclick="showPaymentTab('manual')">${_('manual_payment')}</button>
      <button class="tab-btn" id="tab-crypto-btn" onclick="showPaymentTab('crypto')">${_('crypto_payment')}</button>
    </div>`;
  }

  // Manual payment section
  if (hasManual) {
    html += `<div id="payment-tab-manual" class="${!hasCrypto ? '' : ''}">`;
    html += `<p class="text-sm font-medium mb-3">${hasManual && !hasCrypto ? _('choose_method') : ''}</p>
    <div class="space-y-3" id="payment-methods-list">`;
    methods.forEach(m => {
      html += `<div class="card p-4 cursor-pointer border-2 border-transparent" id="pm-${m.id}" onclick="selectPaymentMethod(${m.id})">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl flex items-center justify-center" style="background: #f1f5f9;">💰</div>
          <div class="flex-1"><h3 class="font-bold text-sm">${escapeHtml(m.name)}</h3>${m.account_name ? `<p class="text-xs opacity-60">${escapeHtml(m.account_name)}</p>` : ''}</div>
          <div class="w-5 h-5 rounded-full border-2 border-gray-300" id="pm-radio-${m.id}"></div>
        </div>
      </div>`;
    });
    html += `</div>
      <div id="payment-detail" class="hidden mt-4">
        <div class="card p-4 mb-4" id="payment-method-info"></div>
        <div class="card p-4 mb-4"><p class="text-sm font-bold mb-2">${_('checklist_title')}</p><ul class="text-xs opacity-70" style="line-height:1.9;list-style:disc;padding-left:18px;"><li>${_('checklist_1')}</li><li>${_('checklist_2')}</li><li>${_('checklist_3')}</li></ul></div>
        <div class="file-upload" id="screenshot-upload" onclick="document.getElementById('screenshot-file').click()">
          <input type="file" id="screenshot-file" accept="image/*" onchange="previewScreenshot(this)">
          <p class="text-3xl mb-2">📸</p>
          <p class="text-sm font-medium">${_('upload_screenshot')}</p>
          <p class="text-xs opacity-50 mt-1">${_('upload_screenshot_sub')}</p>
        </div>
        <div id="screenshot-preview" class="hidden mt-3 rounded-xl overflow-hidden"><img id="preview-img" class="w-full"></div>
        <button class="btn-primary mt-4" id="submit-payment-btn" onclick="submitPayment()" disabled>${_('submit_payment')}</button>
      </div>
    </div>`;
  }

  // Crypto payment section
  if (hasCrypto) {
    html += `<div id="payment-tab-crypto" class="${hasManual ? 'hidden' : ''}">
      <div id="crypto-payment-flow">
        <p class="text-sm font-medium mb-3">${_('choose_coin')}</p>
        <div id="crypto-coins-list" class="space-y-2"><div class="skeleton h-12 w-full"></div></div>
      </div>
    </div>`;
  }

  el.innerHTML = html;

  if (hasCrypto) loadCryptoCoins();
}

async function applyCoupon(courseId) {
  const code = document.getElementById('coupon-input').value.trim();
  const resultEl = document.getElementById('coupon-result');
  if (!code) return;
  resultEl.classList.remove('hidden');
  resultEl.innerHTML = '<span class="opacity-50">Checking...</span>';
  try {
    const result = await api('/coupons/validate', { method: 'POST', body: JSON.stringify({ code, course_id: courseId }) });
    if (result.valid) {
      currentData.couponData = result;
      if (result.discount >= result.original_price) {
        // 100% off - apply directly
        const applyResult = await api('/coupons/apply', { method: 'POST', body: JSON.stringify({ coupon_id: result.coupon_id, course_id: courseId }) });
        if (applyResult.free) {
          document.getElementById('payment-flow').innerHTML = `<div class="text-center py-12"><p class="text-5xl mb-4">🎉</p><h2 class="text-lg font-bold mb-2">${_('coupon_free')}</h2><button class="btn-outline mt-6" onclick="showScreen('home')">${_('go_home')}</button></div>`;
          return;
        }
      }
      resultEl.innerHTML = `<span class="text-green-600 font-medium">${_('coupon_applied')} ${formatMMK(result.discount)}</span><br><span class="opacity-50 line-through">${_('original_price')}: ${formatMMK(result.original_price)}</span> → <span class="font-bold">${_('discounted_price')}: ${formatMMK(result.final_price)}</span>`;
    }
  } catch (e) {
    const msg = e.message || _('coupon_invalid');
    resultEl.innerHTML = `<span class="text-red-500">${escapeHtml(msg)}</span>`;
    currentData.couponData = null;
  }
}

function showPaymentTab(tab) {
  const manualEl = document.getElementById('payment-tab-manual');
  const cryptoEl = document.getElementById('payment-tab-crypto');
  const manualBtn = document.getElementById('tab-manual-btn');
  const cryptoBtn = document.getElementById('tab-crypto-btn');
  if (tab === 'manual') {
    if (manualEl) manualEl.classList.remove('hidden');
    if (cryptoEl) cryptoEl.classList.add('hidden');
    if (manualBtn) manualBtn.classList.add('active');
    if (cryptoBtn) cryptoBtn.classList.remove('active');
  } else {
    if (manualEl) manualEl.classList.add('hidden');
    if (cryptoEl) cryptoEl.classList.remove('hidden');
    if (manualBtn) manualBtn.classList.remove('active');
    if (cryptoBtn) cryptoBtn.classList.add('active');
  }
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
    let info = `<h3 class="font-bold text-sm mb-3">${escapeHtml(m.name)}</h3>`;
    if (m.qr_image_url) info += `<img src="${safeUrl(m.qr_image_url)}" class="w-48 mx-auto rounded-xl mb-3" alt="">`;
    if (m.account_number) info += `<div class="flex justify-between py-2 border-b" style="border-color: #f1f5f9;"><span class="text-xs opacity-60">${_('account_number')}</span><span class="text-sm font-medium">${escapeHtml(m.account_number)}</span></div>`;
    if (m.account_name) info += `<div class="flex justify-between py-2 border-b" style="border-color: #f1f5f9;"><span class="text-xs opacity-60">${_('account_name')}</span><span class="text-sm font-medium">${escapeHtml(m.account_name)}</span></div>`;
    if (m.instructions) info += `<div class="mt-3 p-3 rounded-xl text-xs" style="background: #f8fafc;">${escapeHtml(m.instructions)}</div>`;
    info += `<div class="mt-3 p-3 rounded-xl text-center" style="background: #f0fdf4;"><p class="text-sm font-bold text-green-700">${formatMMK(currentData.course?.price_mmk)}</p><p class="text-xs text-green-600">${_('amount_to_pay')}</p></div>`;
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
  btn.disabled = true; btn.textContent = _('submitting');
  const file = document.getElementById('screenshot-file').files[0];
  if (!file || !selectedPaymentMethodId) { showToast(_('select_photo_method')); btn.disabled = false; btn.textContent = _('submit_payment'); return; }
  const fd = new FormData();
  fd.append('screenshot', file);
  fd.append('course_id', currentData.paymentCourseId);
  fd.append('payment_method_id', selectedPaymentMethodId);
  try {
    const res = await fetch(API + '/payments', { method: 'POST', headers: { 'X-Telegram-Init-Data': initData }, body: fd });
    if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.message || err.error || 'Payment failed'); }
    document.getElementById('payment-flow').innerHTML = `
      <div class="text-center py-12">
        <p class="text-5xl mb-4">✅</p>
        <h2 class="text-lg font-bold mb-2">${_('submitted')}</h2>
        <p class="text-sm opacity-60">${_('submitted_msg')}</p>
        <button class="btn-outline mt-6" onclick="showScreen('home')">${_('go_home')}</button>
      </div>`;
  } catch (e) { showToast(e.message || _('error_occurred')); btn.disabled = false; btn.textContent = _('submit_payment'); }
}

// ---- CRYPTO PAYMENT ----
async function loadCryptoCoins() {
  const el = document.getElementById('crypto-coins-list');
  try {
    const { currencies } = await api('/crypto/currencies');
    if (!currencies || currencies.length === 0) {
      el.innerHTML = `<p class="text-sm opacity-50 text-center py-4">${_('crypto_no_config')}</p>`;
      return;
    }
    const coinIcons = { btc: '₿', eth: 'Ξ', usdt: '₮', ltc: 'Ł', trx: 'T', bnb: 'B', sol: 'S', doge: 'Ð', xrp: 'X', matic: 'M' };
    el.innerHTML = currencies.map(c => {
      const icon = coinIcons[c.toLowerCase()] || '🪙';
      return `<div class="card p-3 cursor-pointer" onclick="selectCryptoCoin('${c}')">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg" style="background: #f1f5f9;">${icon}</div>
          <span class="font-bold text-sm">${c.toUpperCase()}</span>
          <svg class="ml-auto" width="16" height="16" fill="none" stroke="#94a3b8" stroke-width="2"><path d="M6 4l4 4-4 4"/></svg>
        </div>
      </div>`;
    }).join('');
  } catch (e) {
    el.innerHTML = `<p class="text-sm opacity-50 text-center py-4">${_('crypto_no_config')}</p>`;
  }
}

let cryptoPollingInterval = null;
async function selectCryptoCoin(coin) {
  const flowEl = document.getElementById('crypto-payment-flow');
  flowEl.innerHTML = '<div class="text-center py-8"><div class="skeleton h-8 w-48 mx-auto mb-3"></div><div class="skeleton h-40 w-full"></div></div>';

  try {
    const result = await api('/crypto/create-payment', {
      method: 'POST',
      body: JSON.stringify({ course_id: currentData.paymentCourseId, pay_currency: coin })
    });

    if (!result.payment_id) {
      flowEl.innerHTML = `<div class="text-center py-8"><p class="text-sm text-red-600">${_('error_occurred')}</p><button class="btn-outline mt-3" onclick="startPayment(${currentData.paymentCourseId})">${_('back')}</button></div>`;
      return;
    }

    let expiry = result.expiration_estimate_date ? new Date(result.expiration_estimate_date).getTime() : Date.now() + 20 * 60 * 1000;

    function renderCryptoPayment() {
      const remaining = Math.max(0, expiry - Date.now());
      const mins = Math.floor(remaining / 60000);
      const secs = Math.floor((remaining % 60000) / 1000);

      flowEl.innerHTML = `
        <div class="card p-4 mb-4 text-center">
          <p class="text-sm font-medium mb-2">${_('send_exact')}</p>
          <p class="text-2xl font-bold mb-1" style="color: #6366f1;">${escapeHtml(result.pay_amount)} ${escapeHtml(coin.toUpperCase())}</p>
          <p class="text-xs opacity-50 mb-3">≈ $${escapeHtml(result.price_amount)}</p>
          <div class="p-3 rounded-xl mb-3 text-left" style="background: #f8fafc;">
            <p class="text-xs opacity-60 mb-1">${_('wallet_address')}</p>
            <p class="text-xs font-mono break-all font-medium">${escapeHtml(result.pay_address)}</p>
          </div>
          <button class="btn-outline text-xs" onclick="copyAddress(JSON.parse(decodeURIComponent('${jsonArg(result.pay_address)}')))">${_('copy_address')}</button>
        </div>
        <div class="card p-4 mb-4">
          <div class="flex items-center justify-between">
            <span class="text-sm font-medium">${_('time_remaining')}</span>
            <span class="text-sm font-bold ${remaining < 120000 ? 'text-red-500' : ''}">${mins}:${secs.toString().padStart(2, '0')}</span>
          </div>
          <div class="progress-bar mt-2"><div class="progress-fill" style="width:${Math.min(100, (remaining / (20 * 60 * 1000)) * 100)}%; background: ${remaining < 120000 ? '#ef4444' : ''}"></div></div>
        </div>
        <div id="crypto-status" class="card p-4 text-center">
          <div class="animate-pulse"><p class="text-sm">${_('crypto_waiting')}</p></div>
        </div>`;
    }

    renderCryptoPayment();
    const timerInterval = setInterval(renderCryptoPayment, 1000);

    if (cryptoPollingInterval) clearInterval(cryptoPollingInterval);
    cryptoPollingInterval = setInterval(async () => {
      try {
        const status = await api(`/crypto/status/${result.payment_id}`);
        const ps = status.payment_status;
        const statusEl = document.getElementById('crypto-status');
        if (!statusEl) { clearInterval(cryptoPollingInterval); clearInterval(timerInterval); return; }

        if (ps === 'confirming' || ps === 'confirmed' || ps === 'sending') {
          statusEl.innerHTML = `<div class="text-center"><p class="text-amber-600 font-medium">${ps === 'confirming' ? _('crypto_confirming') : _('crypto_confirmed')}</p></div>`;
        } else if (ps === 'finished') {
          clearInterval(cryptoPollingInterval); clearInterval(timerInterval);
          flowEl.innerHTML = `<div class="text-center py-12">
            <p class="text-5xl mb-4">🎉</p>
            <h2 class="text-lg font-bold mb-2">${_('crypto_finished')}</h2>
            <p class="text-sm opacity-60">${escapeHtml(result.pay_amount)} ${escapeHtml(coin.toUpperCase())}</p>
            <button class="btn-primary mt-6" onclick="showScreen('home')">${_('go_home')}</button>
          </div>`;
        } else if (ps === 'failed' || ps === 'expired') {
          clearInterval(cryptoPollingInterval); clearInterval(timerInterval);
          flowEl.innerHTML = `<div class="text-center py-12">
            <p class="text-5xl mb-4">❌</p>
            <h2 class="text-lg font-bold mb-2">${ps === 'expired' ? _('crypto_expired') : _('crypto_failed')}</h2>
            <button class="btn-primary mt-6" onclick="startPayment(${currentData.paymentCourseId})">${_('retry_payment')}</button>
          </div>`;
        } else if (ps === 'refunded') {
          clearInterval(cryptoPollingInterval); clearInterval(timerInterval);
          flowEl.innerHTML = `<div class="text-center py-12">
            <p class="text-5xl mb-4">↩️</p>
            <h2 class="text-lg font-bold mb-2">${_('crypto_refunded')}</h2>
            <button class="btn-primary mt-6" onclick="startPayment(${currentData.paymentCourseId})">${_('retry_payment')}</button>
          </div>`;
        }
      } catch (e) {}
    }, 10000);

  } catch (e) {
    flowEl.innerHTML = `<div class="text-center py-8"><p class="text-sm text-red-600">${_('error_occurred')}</p><button class="btn-outline mt-3" onclick="startPayment(${currentData.paymentCourseId})">${_('back')}</button></div>`;
  }
}

function copyAddress(addr) {
  navigator.clipboard.writeText(addr).then(() => showToast(_('copied'))).catch(() => {
    const ta = document.createElement('textarea'); ta.value = addr; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
    showToast(_('copied'));
  });
}

// ---- MY COURSES ----
async function loadMyCourses() {
  document.getElementById('mycourses-title').innerHTML = _('my_courses_title');
  if (!initData) { document.getElementById('no-courses').classList.remove('hidden'); return; }
  document.getElementById('my-courses-list').innerHTML = Array(2).fill(`
    <div class="card" style="padding:16px;">
      <div style="display:flex;gap:14px;align-items:center;">
        <div class="skeleton" style="width:56px;height:56px;border-radius:16px;flex-shrink:0;"></div>
        <div style="flex:1;">
          <div class="skeleton" style="height:14px;width:70%;margin-bottom:8px;"></div>
          <div class="skeleton" style="height:11px;width:50%;"></div>
        </div>
      </div>
    </div>`).join('');
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
  document.getElementById('bookmarks-title').innerHTML = _('bookmarks_title');
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
  const guideBtn = document.getElementById('show-guide-btn');
  if (guideBtn) guideBtn.textContent = _('show_guide');
  if (tgUser) {
    document.getElementById('profile-avatar').textContent = (tgUser.first_name || '?')[0];
    document.getElementById('profile-name').textContent = tgUser.first_name || _('profile_user');
    document.getElementById('profile-username').textContent = tgUser.username ? `@${tgUser.username}` : '';
  }
  if (!initData) return;
  try {
    const payments = await api('/my-payments');
    const supportWrap = document.getElementById('support-link-wrap');
    const supportLink = document.getElementById('support-link');
    if (supportWrap && supportLink && appSettings.support_url) { supportLink.href = safeUrl(appSettings.support_url); supportWrap.classList.remove('hidden'); }
    let certificates = [];
    try { certificates = await api('/my-certificates'); } catch (e) {}
    const certEl = document.getElementById('my-certificates');
    if (certEl) certEl.innerHTML = certificates.length ? certificates.map(c => `<div class="card" style="padding:14px;">
      <p style="font-size:14px;font-weight:700;">${escapeHtml(c.courses?.title || '')}</p>
      <p style="font-size:12px;color:var(--text-muted);margin-top:3px;">${_('cert_number')}: ${escapeHtml(c.certificate_number)}</p>
      <button class="btn-outline mt-3" style="font-size:12px;" onclick="requestCertificateVerification('${escapeAttr(c.certificate_number)}')">📜 Request bot verification</button>
    </div>`).join('') : `<div class="empty-state"><span class="empty-state-icon">🎓</span><p class="empty-state-desc">No certificates yet</p></div>`;
    let cryptoPayments = [];
    try { cryptoPayments = await api('/my-crypto-payments'); } catch (e) {}
    const el = document.getElementById('payment-history');
    let html = '';
    if (payments.length > 0) {
      html += payments.map(p => `<div class="card" style="padding:14px;">
        <div style="display:flex;align-items:center;justify-content:space-between;">
          <div>
            <p style="font-size:14px;font-weight:700;">${escapeHtml(p.courses?.title || '')}</p>
            <p style="font-size:12px;color:var(--text-muted);margin-top:3px;">${timeAgo(p.created_at)}</p>
          </div>
          ${statusBadge(p.status)}
        </div>
        ${p.admin_note ? `<p style="font-size:12px;color:var(--text-secondary);margin-top:8px;padding-top:8px;border-top:1px solid var(--border);">📝 ${escapeHtml(p.admin_note)}</p>` : ''}
      </div>`).join('');
    }
    if (cryptoPayments.length > 0) {
      html += `<h4 style="font-size:14px;font-weight:700;margin:16px 0 10px;">${_('crypto_history')}</h4>`;
      html += cryptoPayments.map(p => {
        const stLabel = { waiting: _('crypto_waiting'), confirming: _('crypto_confirming'), confirmed: _('crypto_confirmed'), finished: _('crypto_finished'), failed: _('crypto_failed'), expired: _('crypto_expired'), refunded: _('crypto_refunded') }[p.status] || p.status;
        const stCls = p.status === 'finished' ? 'badge-green' : ['failed', 'expired'].includes(p.status) ? 'badge-red' : 'badge-yellow';
        return `<div class="card" style="padding:14px;">
          <div style="display:flex;align-items:center;justify-content:space-between;">
            <div>
              <p style="font-size:14px;font-weight:700;">${escapeHtml(p.courses?.title || '')}</p>
              <p style="font-size:12px;color:var(--text-muted);margin-top:3px;">${escapeHtml(p.pay_amount)} ${escapeHtml((p.pay_currency || '').toUpperCase())} · ${timeAgo(p.created_at)}</p>
            </div>
            <span class="badge ${stCls}">${escapeHtml(stLabel)}</span>
          </div>
        </div>`;
      }).join('');
    }
    if (!html) html = `<div class="empty-state"><span class="empty-state-icon">💳</span><p class="empty-state-desc">${_('no_payments')}</p></div>`;
    el.innerHTML = html;
  } catch (e) {}
}

// ---- CERTIFICATE ----
async function requestCertificateVerification(certNumber) {
  try {
    await api('/certificates/request-verification', { method: 'POST', body: JSON.stringify({ certificate_number: certNumber }) });
    showToast('Certificate verification request sent to admin');
  } catch (e) { showToast(e.message || _('error_occurred')); }
}

async function generateCert(courseId) {
  try {
    const cert = await api(`/certificates/generate/${courseId}`, { method: 'POST' });
    showToast(_('cert_generated'));
    loadCourse(courseId);
  } catch (e) { showToast(_('cert_not_complete')); }
}

function viewCertificate(certNumber, courseTitle) {
  showScreen('certificate');
  const user = tgUser || {};
  document.getElementById('certificate-detail').innerHTML = `
    <div class="card card-elevated" style="padding:32px 24px;text-align:center;border:2px solid var(--primary);position:relative;overflow:hidden;">
      <div style="position:absolute;top:0;left:0;right:0;height:6px;background:linear-gradient(90deg,var(--primary),var(--accent));"></div>
      <div style="position:absolute;top:-40px;right:-40px;width:120px;height:120px;border-radius:50%;background:rgba(108,92,231,0.05);"></div>
      <div style="position:absolute;bottom:-40px;left:-40px;width:100px;height:100px;border-radius:50%;background:rgba(0,206,201,0.05);"></div>
      <p style="font-size:48px;margin-bottom:12px;">🎓</p>
      <h2 style="font-size:20px;font-weight:800;color:var(--primary);margin-bottom:4px;">${_('cert_title')}</h2>
      <p style="font-size:12px;color:var(--text-muted);letter-spacing:2px;margin-bottom:24px;">${_('cert_subtitle')}</p>
      <p style="font-size:13px;color:var(--text-secondary);margin-bottom:4px;">${_('cert_for')}</p>
      <h3 style="font-size:22px;font-weight:800;margin-bottom:4px;">${escapeHtml(user.first_name || 'Student')} ${escapeHtml(user.last_name || '')}</h3>
      <p style="font-size:13px;color:var(--text-secondary);margin-bottom:20px;">${_('cert_awarded')}</p>
      <div style="padding:14px;border-radius:var(--radius-sm);background:linear-gradient(135deg,rgba(108,92,231,0.06),rgba(0,206,201,0.06));margin-bottom:20px;">
        <p style="font-size:16px;font-weight:700;color:var(--primary);">${escapeHtml(courseTitle)}</p>
      </div>
      <p style="font-size:13px;color:var(--text-secondary);margin-bottom:4px;">${_('cert_completed')}</p>
      <p style="font-size:12px;color:var(--text-muted);">${_('cert_number')}: ${escapeHtml(certNumber)}</p>
      <p style="font-size:12px;color:var(--text-muted);margin-top:4px;">${_('cert_date')}: ${new Date().toLocaleDateString(lang === 'my' ? 'my-MM' : 'en-US')}</p>
    </div>`;
}

// ---- INIT ----
async function initApp() {
  try {
    appSettings = await api('/settings');
    lang = appSettings.language || 'my';
  } catch (e) { lang = 'my'; }
  if (appSettings.maintenance_mode === 'true') {
    blockedState(_('maintenance_title'), appSettings.maintenance_message || '');
    return;
  }
  if (!initData) {
    await logBlockedAccess('missing_telegram_init_data');
    const url = appSettings.telegram_start_url || (appSettings.bot_username ? `https://t.me/${appSettings.bot_username.replace('@', '')}` : '');
    const action = url ? `<a class="btn-primary" style="display:block;margin-top:18px;text-decoration:none;" href="${safeUrl(url)}">${_('open_in_telegram_btn')}</a>` : '';
    blockedState(_('open_in_telegram_title'), _('open_in_telegram_desc'), action);
    return;
  }
  applyLanguageUI();
  loadHome();
}
initApp();
