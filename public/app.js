let tg = window.Telegram.WebApp; tg.expand();
let initData = tg.initData || ''; let currentCourseId = null; let paymentMethodsData = []; let isBookmarked = false;

document.addEventListener('DOMContentLoaded', () => { showScreen('roadmaps'); loadRoadmaps(); loadPaymentMethods(); });

function showScreen(id) {
    document.querySelectorAll('[id^="screen-"]').forEach(el => el.style.display = 'none');
    document.getElementById('screen-' + id).style.display = 'block';
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    if (id==='roadmaps') document.querySelectorAll('.nav-item')[0].classList.add('active');
    else if (id==='bookmarks') document.querySelectorAll('.nav-item')[1].classList.add('active');
    else if (id==='announcements') document.querySelectorAll('.nav-item')[2].classList.add('active');
    else if (id==='search') document.querySelectorAll('.nav-item')[3].classList.add('active');
}

async function loadRoadmaps() {
    const res = await fetch('/api/roadmaps'); const data = await res.json();
    const list = document.getElementById('roadmapsList'); list.innerHTML = '';
    data.forEach(rm => {
        const div = document.createElement('div'); div.className = 'card'; div.innerHTML = `<b>${rm.title}</b>`;
        div.onclick = () => loadCourses(rm.id, rm.title); list.appendChild(div);
    });
}

async function loadCourses(rmId, rmTitle) {
    document.getElementById('coursesHeader').innerText = rmTitle; showScreen('courses');
    const res = await fetch(`/api/courses?roadmap_id=${rmId}`); const data = await res.json();
    const list = document.getElementById('coursesList'); list.innerHTML = '';
    data.forEach(c => {
        const div = document.createElement('div'); div.className = 'card'; div.innerHTML = `<b>${c.title}</b>`;
        div.onclick = () => loadCourseDetail(c.id); list.appendChild(div);
    });
}

async function loadCourseDetail(courseId) {
    currentCourseId = courseId; showScreen('course-detail');
    const res = await fetch(`/api/courses/${courseId}`); const course = await res.json();
    document.getElementById('detailTitle').innerText = course.title;
    loadReviews(courseId);
    if(initData) {
        const bRes = await fetch('/api/bookmarks', {headers:{'x-telegram-init-data':initData}});
        const bData = await bRes.json(); isBookmarked = bData.some(b=>b.id==courseId);
        document.getElementById('bookmarkIcon').innerText = isBookmarked ? '★' : '☆';
    }
    const mRes = await fetch(`/api/courses/${courseId}/modules`, {headers:initData?{'x-telegram-init-data':initData}:{}});
    const modules = await mRes.json(); const mList = document.getElementById('modulesList'); mList.innerHTML = '';
    let total=0, comp=0;
    modules.forEach(m => {
        const div = document.createElement('div');
        div.innerHTML = `<div class="module-title">${m.title}</div>`;
        m.lessons.forEach(l => {
            total++;
            if(l.completed) comp++;
            const ldiv = document.createElement('div');
            ldiv.className='lesson-item';
            ldiv.innerHTML=`<span>${l.title}</span> ${l.completed?'<span class="completed">✓ ပြီးဆုံး</span>':''}`;
            ldiv.onclick=()=>viewLesson(l.id);
            div.appendChild(ldiv);
        });
        mList.appendChild(div);
    });
    if(total>0 && initData) {
        document.getElementById('progressBarContainer').style.display='block';
        const pct = Math.round((comp/total)*100);
        document.getElementById('progressBar').style.width = pct + '%';
        document.getElementById('progressText').innerText = `${pct}% ပြီးစီးပါပြီ`;
    } else document.getElementById('progressBarContainer').style.display='none';
}

async function viewLesson(id) {
    const res = await fetch(`/api/lessons/${id}`, {headers:{'x-telegram-init-data':initData}});
    if(res.status===403) return tg.showAlert("သင်တန်းဝယ်ယူရန် လိုအပ်ပါသည်");
    const lesson = await res.json(); showScreen('lesson');
    document.getElementById('lessonTitle').innerText = lesson.title;
    document.getElementById('lessonCompletedCb').checked = lesson.completed || false;
    document.getElementById('lessonCompletedCb').onchange = async (e) => {
        await fetch('/api/progress', {method:'POST', headers:{'Content-Type':'application/json','x-telegram-init-data':initData}, body:JSON.stringify({lesson_id:id, completed:e.target.checked})});
        loadCourseDetail(currentCourseId);
    };
}

function showSearch() { showScreen('search'); }
async function executeSearch() {
    const q = document.getElementById('searchInput').value; if(!q) return;
    const res = await fetch(`/api/search?q=${q}`); const data = await res.json();
    const r = document.getElementById('searchResults'); r.innerHTML='';
    data.courses.forEach(c => { const d=document.createElement('div'); d.className='card'; d.innerText=c.title; d.onclick=()=>loadCourseDetail(c.id); r.appendChild(d); });
    data.lessons.forEach(l => { const d=document.createElement('div'); d.className='card'; d.innerText=`သင်ခန်းစာ: ${l.title}`; d.onclick=()=>loadCourseDetail(l.course_id); r.appendChild(d); });
}

async function loadBookmarks() { showScreen('bookmarks'); const res=await fetch('/api/bookmarks', {headers:{'x-telegram-init-data':initData}}); const data=await res.json(); const list=document.getElementById('bookmarksList'); list.innerHTML=''; data.forEach(c => { const d=document.createElement('div'); d.className='card'; d.innerText=c.title; d.onclick=()=>loadCourseDetail(c.id); list.appendChild(d); }); }
async function toggleBookmark() {
    await fetch(`/api/bookmarks${isBookmarked?'/'+currentCourseId:''}`, {method:isBookmarked?'DELETE':'POST', headers:{'Content-Type':'application/json','x-telegram-init-data':initData}, body:isBookmarked?null:JSON.stringify({course_id:currentCourseId})});
    isBookmarked=!isBookmarked; document.getElementById('bookmarkIcon').innerText = isBookmarked ? '★' : '☆';
}

async function loadAnnouncements() { showScreen('announcements'); const res=await fetch('/api/announcements'); const data=await res.json(); const list=document.getElementById('announcementsList'); list.innerHTML=''; data.forEach(a => { const d=document.createElement('div'); d.className='card'; d.innerText=a.title; list.appendChild(d); }); }

async function loadReviews(cid) {
    const res = await fetch(`/api/courses/${cid}/reviews`); const data = await res.json();
    const list = document.getElementById('reviewsList'); list.innerHTML='';
    data.forEach(r => { list.innerHTML += `<div>${r.first_name}: ${'⭐'.repeat(r.rating)} ${r.comment||''}</div>` });
    if(initData) document.getElementById('reviewFormContainer').style.display='block';
}
async function postReview() {
    await fetch(`/api/courses/${currentCourseId}/reviews`, {method:'POST', headers:{'Content-Type':'application/json','x-telegram-init-data':initData}, body:JSON.stringify({rating:document.getElementById('reviewRating').value, comment:document.getElementById('reviewComment').value})});
    loadReviews(currentCourseId);
}

async function loadPaymentMethods() { const res=await fetch('/api/payment-methods'); paymentMethodsData=await res.json(); const s=document.getElementById('pmSelect'); paymentMethodsData.forEach(p=>{const o=document.createElement('option'); o.value=p.id; o.innerText=p.name; s.appendChild(o);}); }
function renderSelectedPM() { const pmId=document.getElementById('pmSelect').value; if(!pmId) { document.getElementById('pmDetails').style.display='none'; document.getElementById('uploadSection').style.display='none'; return; } const pm=paymentMethodsData.find(p=>p.id==pmId); document.getElementById('pmInfo').innerHTML=`<b>${pm.name}</b><br>အကောင့်အမည်: ${pm.account_name || '-'}<br>အကောင့်နံပါတ်: ${pm.account_number}<br>${pm.qr_image_url ? `<img src="${pm.qr_image_url}" style="max-width:200px; margin-top:10px; border-radius:8px;">` : ''}<br><p style="font-size:12px; margin-top:10px;">${pm.instructions||''}</p>`; document.getElementById('pmDetails').style.display='block'; document.getElementById('uploadSection').style.display='block'; }
async function processPayment() {
    const fd = new FormData(); fd.append('course_id', currentCourseId); fd.append('payment_method_id', document.getElementById('pmSelect').value); fd.append('screenshot', document.getElementById('screenshotFile').files[0]);
    await fetch('/api/payments', {method:'POST', headers:{'x-telegram-init-data':initData}, body:fd}); showScreen('success');
}
