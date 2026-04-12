let adminToken = '';

function login() {
    adminToken = document.getElementById('adminPassword').value;
    document.getElementById('loginScreen').style.display='none';
    document.getElementById('dashboard').style.display='flex';
    loadAll();
}

function showSection(id) {
    document.querySelectorAll('.section').forEach(e => e.style.display='none');
    document.getElementById('section-'+id).style.display='block';
    document.querySelectorAll('.sidebar-item').forEach(e => e.classList.remove('active'));
    const navItem = document.getElementById('nav-'+id);
    if(navItem) {
        navItem.classList.add('active');
    }
}

function escapeHTML(s) { return (s||'').toString().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

async function apiCall(ep, opt={}) {
    if(!opt.headers) opt.headers={};
    if(!(opt.body instanceof FormData)) opt.headers['Content-Type']='application/json';
    opt.headers['x-admin-password']=adminToken;
    const res = await fetch('/api'+ep, opt);
    if(res.status === 401) { alert("စကားဝှက် မှားယွင်းနေပါသည်။"); location.reload(); return []; }
    return res.json();
}

function loadAll() { loadRoadmaps(); loadCourses(); loadPaymentMethods(); loadPayments(); loadUsers(); loadAnnouncements(); }

async function loadRoadmaps() {
    const d=await apiCall('/roadmaps');
    const b=document.querySelector('#roadmapsTable tbody');
    b.innerHTML='';
    d.forEach(r => b.innerHTML+=`<tr><td>${escapeHTML(r.title)}</td><td class="actions-col"><button class="btn btn-danger" onclick="apiCall('/admin/roadmaps/${r.id}', {method:'DELETE'}).then(loadRoadmaps)">ဖျက်မည်</button></td></tr>`);
}
async function saveRoadmap() {
    const title = prompt('လမ်းကြောင်းအမည် ထည့်ပါ');
    if(!title) return;
    await apiCall('/admin/roadmaps', {method:'POST', body:JSON.stringify({title})});
    loadRoadmaps();
}

async function loadCourses() {
    const d=await apiCall('/courses');
    const b=document.querySelector('#coursesTable tbody');
    b.innerHTML='';
    d.forEach(r => b.innerHTML+=`<tr><td>${escapeHTML(r.title)}</td><td class="actions-col"><button class="btn btn-danger" onclick="apiCall('/admin/courses/${r.id}', {method:'DELETE'}).then(loadCourses)">ဖျက်မည်</button></td></tr>`);
}
async function saveCourse() {
    const title = prompt('သင်တန်းအမည် ထည့်ပါ');
    if(!title) return;
    await apiCall('/admin/courses', {method:'POST', body:JSON.stringify({title, price_mmk:100})});
    loadCourses();
}

async function saveModule() {
    const course_id = prompt('Course ID ထည့်ပါ');
    if(!course_id) return;
    const title = prompt('Module အမည် ထည့်ပါ');
    if(!title) return;
    await apiCall('/admin/modules', {method:'POST', body:JSON.stringify({title, course_id})});
}
async function saveLesson() {
    const module_id = prompt('Module ID ထည့်ပါ');
    if(!module_id) return;
    const title = prompt('Lesson အမည် ထည့်ပါ');
    if(!title) return;
    await apiCall('/admin/lessons', {method:'POST', body:JSON.stringify({title, module_id})});
}

async function loadAnnouncements() {
    const d=await apiCall('/announcements');
    const b=document.querySelector('#annTable tbody');
    b.innerHTML='';
    d.forEach(r => b.innerHTML+=`<tr><td>${escapeHTML(r.title)}</td><td class="actions-col"><button class="btn btn-danger" onclick="apiCall('/admin/announcements/${r.id}', {method:'DELETE'}).then(loadAnnouncements)">ဖျက်မည်</button></td></tr>`);
}
async function saveAnnouncement() {
    const title = prompt('ကြေညာချက်ခေါင်းစဉ် ထည့်ပါ');
    if(!title) return;
    const content = prompt('အကြောင်းအရာ ထည့်ပါ');
    await apiCall('/admin/announcements', {method:'POST', body:JSON.stringify({title, content})});
    loadAnnouncements();
}

async function loadPaymentMethods() {
    const d=await apiCall('/payment-methods');
    const b=document.querySelector('#pmTable tbody');
    b.innerHTML='';
    d.forEach(r => b.innerHTML+=`<tr><td>${escapeHTML(r.name)}</td><td class="actions-col"><button class="btn btn-danger" onclick="apiCall('/admin/payment-methods/${r.id}', {method:'DELETE'}).then(loadPaymentMethods)">ဖျက်မည်</button></td></tr>`);
}
async function savePaymentMethod() {
    const name = document.getElementById('pmName').value;
    if(!name) { alert("အမည် ထည့်သွင်းပေးပါ။"); return; }

    const account_name = document.getElementById('pmAccName').value;
    const account_number = document.getElementById('pmAccNumber').value;
    const instructions = document.getElementById('pmInstructions').value;
    const qrFile = document.getElementById('pmQR').files[0];

    const fd=new FormData();
    fd.append('name', name);
    fd.append('account_name', account_name);
    fd.append('account_number', account_number);
    fd.append('instructions', instructions);
    if(qrFile) fd.append('qr_image', qrFile);

    await fetch('/api/admin/payment-methods', {method:'POST', headers:{'x-admin-password':adminToken}, body:fd});

    document.getElementById('pmName').value = '';
    document.getElementById('pmAccName').value = '';
    document.getElementById('pmAccNumber').value = '';
    document.getElementById('pmInstructions').value = '';
    document.getElementById('pmQR').value = '';
    document.getElementById('pmFormModal').style.display = 'none';

    loadPaymentMethods();
}

async function loadPayments() {
    const filter = document.getElementById('paymentStatusFilter').value;
    const d = await apiCall('/admin/payments');
    const b = document.querySelector('#paymentsTable tbody');
    b.innerHTML='';

    let pendingCount = 0;

    d.forEach(r => {
        if(r.status === 'pending') pendingCount++;

        if(filter && r.status !== filter) return;

        let a='';
        if(r.status==='pending') {
            a=`<button class="btn btn-success" onclick="approvePayment(${r.id})">အတည်ပြု</button><button class="btn btn-danger" onclick="rejectPayment(${r.id})">ပယ်ချ</button>`;
        }

        let statusBadge = '';
        if(r.status === 'pending') statusBadge = '<span class="badge badge-pending">စစ်ဆေးရန်ကျန်</span>';
        else if(r.status === 'approved') statusBadge = '<span class="badge badge-approved">အတည်ပြုပြီး</span>';
        else if(r.status === 'rejected') statusBadge = '<span class="badge badge-rejected">ပယ်ချထား</span>';

        b.innerHTML+=`<tr>
            <td>${escapeHTML(r.first_name)}<br><small>@${escapeHTML(r.username||'-')}</small></td>
            <td>${escapeHTML(r.course_title)}</td>
            <td>${escapeHTML(r.payment_method_name)}<br><a href="${r.screenshot_url}" target="_blank" style="font-size:12px;">ပြေစာကြည့်ရန်</a></td>
            <td>${statusBadge}</td>
            <td class="actions-col">${a}</td>
        </tr>`;
    });

    const badge = document.getElementById('pendingBadge');
    if(pendingCount > 0) {
        badge.style.display = 'inline-block';
        badge.innerText = pendingCount;
    } else {
        badge.style.display = 'none';
    }
}

async function approvePayment(id) {
    const note = prompt("မှတ်ချက် (ချန်လှပ်ထားနိုင်သည်)") || "";
    await apiCall(`/admin/payments/${id}/approve`, {method:'POST',body:JSON.stringify({note})});
    loadPayments();
}

async function rejectPayment(id) {
    const note = prompt("ပယ်ချရသည့် အကြောင်းရင်း") || "";
    await apiCall(`/admin/payments/${id}/reject`, {method:'POST',body:JSON.stringify({note})});
    loadPayments();
}

async function loadUsers() {
    const d=await apiCall('/admin/users');
    const b=document.querySelector('#usersTable tbody');
    b.innerHTML='';
    d.forEach(r => b.innerHTML+=`<tr><td>${escapeHTML(r.first_name)}</td><td>${escapeHTML(r.username || '-')}</td><td>${r.telegram_id}</td></tr>`);
}
