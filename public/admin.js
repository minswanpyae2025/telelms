let adminToken = '';
function login() { adminToken = document.getElementById('adminPassword').value; document.getElementById('dashboard').style.display='block'; loadAll(); }
function showSection(id) { document.querySelectorAll('.section').forEach(e => e.style.display='none'); document.getElementById('section-'+id).style.display='block'; }
function escapeHTML(s) { return (s||'').toString().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
function apiCall(ep, opt={}) { if(!opt.headers) opt.headers={}; if(!(opt.body instanceof FormData)) opt.headers['Content-Type']='application/json'; opt.headers['x-admin-password']=adminToken; return fetch('/api'+ep, opt).then(r=>r.json()); }

function loadAll() { loadRoadmaps(); loadCourses(); loadPaymentMethods(); loadPayments(); loadUsers(); loadAnnouncements(); }

async function loadRoadmaps() { const d=await apiCall('/roadmaps'); const b=document.querySelector('#roadmapsTable tbody'); b.innerHTML=''; d.forEach(r => b.innerHTML+=`<tr><td>${r.title}</td><td><button onclick="apiCall('/admin/roadmaps/${r.id}', {method:'DELETE'}).then(loadRoadmaps)">Del</button></td></tr>`); }
async function saveRoadmap() { await apiCall('/admin/roadmaps', {method:'POST', body:JSON.stringify({title:prompt('Title')})}); loadRoadmaps(); }

async function loadCourses() { const d=await apiCall('/courses'); const b=document.querySelector('#coursesTable tbody'); b.innerHTML=''; d.forEach(r => b.innerHTML+=`<tr><td>${r.title}</td><td><button onclick="apiCall('/admin/courses/${r.id}', {method:'DELETE'}).then(loadCourses)">Del</button></td></tr>`); }
async function saveCourse() { await apiCall('/admin/courses', {method:'POST', body:JSON.stringify({title:prompt('Title'), price_mmk:100})}); loadCourses(); }

async function saveModule() { await apiCall('/admin/modules', {method:'POST', body:JSON.stringify({title:prompt('Title'), course_id:prompt('Course ID')})}); }
async function saveLesson() { await apiCall('/admin/lessons', {method:'POST', body:JSON.stringify({title:prompt('Title'), module_id:prompt('Module ID')})}); }

async function loadAnnouncements() { const d=await apiCall('/announcements'); const b=document.querySelector('#annTable tbody'); b.innerHTML=''; d.forEach(r => b.innerHTML+=`<tr><td>${escapeHTML(r.title)}</td><td><button onclick="apiCall('/admin/announcements/${r.id}', {method:'DELETE'}).then(loadAnnouncements)">Del</button></td></tr>`); }
async function saveAnnouncement() { await apiCall('/admin/announcements', {method:'POST', body:JSON.stringify({title:prompt('Title'), content:prompt('Content')})}); loadAnnouncements(); }

async function loadPaymentMethods() { const d=await apiCall('/payment-methods'); const b=document.querySelector('#pmTable tbody'); b.innerHTML=''; d.forEach(r => b.innerHTML+=`<tr><td>${escapeHTML(r.name)}</td><td><button onclick="apiCall('/admin/payment-methods/${r.id}', {method:'DELETE'}).then(loadPaymentMethods)">Del</button></td></tr>`); }
async function savePaymentMethod() { const fd=new FormData(); fd.append('name',prompt('Name')); await fetch('/api/admin/payment-methods', {method:'POST', headers:{'x-admin-password':adminToken}, body:fd}); loadPaymentMethods(); }

async function loadPayments() { const d=await apiCall('/admin/payments'); const b=document.querySelector('#paymentsTable tbody'); b.innerHTML=''; d.forEach(r => { let a=''; if(r.status==='pending') a=`<button onclick="apiCall('/admin/payments/${r.id}/approve', {method:'POST',body:JSON.stringify({note:''})}).then(loadPayments)">App</button><button onclick="apiCall('/admin/payments/${r.id}/reject', {method:'POST',body:JSON.stringify({note:''})}).then(loadPayments)">Rej</button>`; b.innerHTML+=`<tr><td>${escapeHTML(r.first_name)}</td><td>${r.status}</td><td>${a}</td></tr>`; }); }

async function loadUsers() { const d=await apiCall('/admin/users'); const b=document.querySelector('#usersTable tbody'); b.innerHTML=''; d.forEach(r => b.innerHTML+=`<tr><td>${escapeHTML(r.first_name)}</td></tr>`); }
