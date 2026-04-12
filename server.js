require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const fs = require('fs');
const { put } = require('@vercel/blob');

const db = require('./database');
require('./bot');

const app = express();
const storage = multer.memoryStorage();
const upload = multer({ storage });
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.post('/webhook/telegram', (req, res) => {
    try { require('./bot').bot.processUpdate(req.body); } catch(e) { console.error("Webhook error:", e); }
    res.sendStatus(200);
});

function validateTelegramWebAppData(req, res, next) {
    const initData = req.headers['x-telegram-init-data'];
    if (!initData) return res.status(401).json({ error: 'No initData' });
    try {
        const urlParams = new URLSearchParams(initData);
        req.telegramUser = JSON.parse(urlParams.get('user'));
        next();
    } catch (err) { res.status(400).json({ error: 'Invalid' }); }
}

function validateAdminData(req, res, next) {
    if (req.headers['x-admin-password'] === (process.env.ADMIN_PASSWORD || 'admin123')) next();
    else res.status(401).json({ error: 'Unauthorized' });
}

function ensureUser(tgUser, cb) {
    db.run('INSERT INTO users (telegram_id, first_name, last_name, username) VALUES (?,?,?,?) ON CONFLICT (telegram_id) DO NOTHING', [tgUser.id, tgUser.first_name, tgUser.last_name, tgUser.username], (err) => {
        if(err) return cb(err);
        db.get('SELECT id FROM users WHERE telegram_id=?', [tgUser.id], (err, row) => cb(err, row?row.id:null));
    });
}

app.get('/api/health', (req, res) => res.json({status: 'ok'}));

// Search
app.get('/api/search', (req, res) => {
    const q = req.query.q;
    if(!q) return res.json({courses:[], lessons:[]});
    db.all('SELECT * FROM courses WHERE title LIKE ? OR description LIKE ?', [`%${q}%`,`%${q}%`], (err, courses) => {
        db.all('SELECT l.id, l.title, c.id as course_id, c.title as course_title FROM lessons l JOIN modules m ON l.module_id=m.id JOIN courses c ON m.course_id=c.id WHERE l.title LIKE ?', [`%${q}%`], (err, lessons) => res.json({courses:courses||[], lessons:lessons||[]}));
    });
});

// Reviews
app.get('/api/courses/:id/reviews', (req, res) => db.all('SELECT r.*, u.first_name, u.username FROM reviews r JOIN users u ON r.user_id=u.id WHERE r.course_id=? ORDER BY r.created_at DESC', [req.params.id], (err, rows) => res.json(rows||[])));
app.post('/api/courses/:id/reviews', validateTelegramWebAppData, (req, res) => {
    ensureUser(req.telegramUser, (err, userId) => {
        db.get(`SELECT id FROM payments WHERE user_id=? AND course_id=? AND status='approved'`, [userId, req.params.id], (err, p) => {
            if(!p) return res.status(403).json({error:'Must be enrolled'});
            db.run(`INSERT INTO reviews (user_id,course_id,rating,comment) VALUES (?,?,?,?) ON CONFLICT (user_id, course_id) DO UPDATE SET rating=EXCLUDED.rating, comment=EXCLUDED.comment`, [userId, req.params.id, req.body.rating, req.body.comment], (err) => res.json({success:true}));
        });
    });
});

// Public Read
app.get('/api/roadmaps', (req, res) => db.all('SELECT * FROM roadmaps', (err, rows) => res.json(rows)));
app.get('/api/courses', (req, res) => db.all(req.query.roadmap_id ? 'SELECT * FROM courses WHERE roadmap_id=?' : 'SELECT * FROM courses', req.query.roadmap_id ? [req.query.roadmap_id] : [], (err, rows) => res.json(rows)));
app.get('/api/courses/:id', (req, res) => db.get('SELECT * FROM courses WHERE id=?', [req.params.id], (err, row) => res.json(row)));
app.get('/api/payment-methods', (req, res) => db.all('SELECT * FROM payment_methods', (err, rows) => res.json(rows)));
app.get('/api/announcements', (req, res) => db.all('SELECT * FROM announcements', (err, rows) => res.json(rows)));

app.get('/api/courses/:id/modules', (req, res) => {
    let tgId = null;
    if(req.headers['x-telegram-init-data']) { try { tgId = JSON.parse(new URLSearchParams(req.headers['x-telegram-init-data']).get('user')).id; } catch(e){} }
    db.all('SELECT * FROM modules WHERE course_id=?', [req.params.id], (err, mods) => {
        db.all('SELECT * FROM lessons WHERE module_id IN (SELECT id FROM modules WHERE course_id=?)', [req.params.id], (err, less) => {
            if (tgId) {
                db.all('SELECT lesson_id, completed FROM progress p JOIN users u ON p.user_id=u.id WHERE u.telegram_id=?', [tgId], (err, prog) => {
                    const pMap = {}; if(prog) prog.forEach(p => pMap[p.lesson_id] = p.completed);
                    res.json((mods||[]).map(m => { m.lessons = (less||[]).filter(l=>l.module_id==m.id).map(l=>{l.completed=pMap[l.id]?true:false; return l;}); return m; }));
                });
            } else res.json((mods||[]).map(m => { m.lessons = (less||[]).filter(l=>l.module_id==m.id); return m; }));
        });
    });
});

app.get('/api/lessons/:id', validateTelegramWebAppData, (req, res) => {
    db.get('SELECT l.*, m.course_id FROM lessons l JOIN modules m ON l.module_id=m.id WHERE l.id=?', [req.params.id], (err, row) => {
        ensureUser(req.telegramUser, (err, userId) => {
            db.get(`SELECT id FROM payments WHERE user_id=? AND course_id=? AND status='approved'`, [userId, row.course_id], (err, p) => {
                if(!p) return res.status(403).json({error:'Payment required'});
                res.json(row);
            });
        });
    });
});

// Protected UI
app.get('/api/bookmarks', validateTelegramWebAppData, (req, res) => ensureUser(req.telegramUser, (err, uid) => db.all('SELECT c.* FROM courses c JOIN bookmarks b ON c.id=b.course_id WHERE b.user_id=?', [uid], (err, rows) => res.json(rows))));
app.post('/api/bookmarks', validateTelegramWebAppData, (req, res) => ensureUser(req.telegramUser, (err, uid) => db.run('INSERT INTO bookmarks(user_id,course_id) VALUES (?,?) ON CONFLICT (user_id, course_id) DO NOTHING', [uid, req.body.course_id], ()=>res.json({success:true}))));
app.delete('/api/bookmarks/:cid', validateTelegramWebAppData, (req, res) => ensureUser(req.telegramUser, (err, uid) => db.run('DELETE FROM bookmarks WHERE user_id=? AND course_id=?', [uid, req.params.cid], ()=>res.json({success:true}))));
app.post('/api/progress', validateTelegramWebAppData, (req, res) => ensureUser(req.telegramUser, (err, uid) => db.run('INSERT INTO progress (user_id,lesson_id,completed) VALUES (?,?,?) ON CONFLICT (user_id, lesson_id) DO UPDATE SET completed=EXCLUDED.completed', [uid, req.body.lesson_id, req.body.completed?true:false], ()=>res.json({success:true}))));
app.post('/api/payments', validateTelegramWebAppData, upload.single('screenshot'), async (req, res) => {
    ensureUser(req.telegramUser, async (err, uid) => {
        let screenshotUrl = '';
        if (req.file) {
            const blob = await put(req.file.originalname, req.file.buffer, { access: 'public' });
            screenshotUrl = blob.url;
        }
        db.run('INSERT INTO payments (user_id, course_id, payment_method_id, screenshot_url) VALUES (?,?,?,?) RETURNING id', [uid, req.body.course_id, req.body.payment_method_id, screenshotUrl], function() {
            try { require('./bot').notifyAdminPayment(this.lastID, req.telegramUser, req.body.course_id, screenshotUrl); } catch(e){}
            res.json({success:true});
        });
    });
});

// Admin
app.get('/api/admin/users', validateAdminData, (req, res) => db.all('SELECT * FROM users', (err, rows) => res.json(rows)));
app.get('/api/admin/payments', validateAdminData, (req, res) => db.all(`SELECT p.*, u.first_name, u.username, c.title as course_title, pm.name as payment_method_name FROM payments p JOIN users u ON p.user_id=u.id JOIN courses c ON p.course_id=c.id JOIN payment_methods pm ON p.payment_method_id=pm.id`, (err, rows) => res.json(rows)));
app.post('/api/admin/payments/:id/approve', validateAdminData, (req, res) => db.run(`UPDATE payments SET status='approved', admin_note=? WHERE id=?`, [req.body.note, req.params.id], ()=> {
    db.get('SELECT p.*, u.telegram_id, c.title FROM payments p JOIN users u ON p.user_id=u.id JOIN courses c ON p.course_id=c.id WHERE p.id=?', [req.params.id], (err, r) => {
        try { require('./bot').notifyUserApproval(r.telegram_id, r.course_id, r.title, req.body.note); } catch(e){}
        res.json({success:true});
    });
}));
app.post('/api/admin/payments/:id/reject', validateAdminData, (req, res) => db.run(`UPDATE payments SET status='rejected', admin_note=? WHERE id=?`, [req.body.note, req.params.id], ()=> {
    db.get('SELECT p.*, u.telegram_id, c.title FROM payments p JOIN users u ON p.user_id=u.id JOIN courses c ON p.course_id=c.id WHERE p.id=?', [req.params.id], (err, r) => {
        try { require('./bot').notifyUserRejection(r.telegram_id, r.title, req.body.note); } catch(e){}
        res.json({success:true});
    });
}));
app.post('/api/admin/roadmaps', validateAdminData, (req, res) => db.run('INSERT INTO roadmaps (title, description) VALUES (?,?)', [req.body.title, req.body.description], ()=>res.json({success:true})));
app.delete('/api/admin/roadmaps/:id', validateAdminData, (req, res) => db.run('DELETE FROM roadmaps WHERE id=?', [req.params.id], ()=>res.json({success:true})));
app.post('/api/admin/courses', validateAdminData, (req, res) => db.run('INSERT INTO courses (roadmap_id, title, description, price_mmk, telegram_group_id) VALUES (?,?,?,?,?)', [req.body.roadmap_id, req.body.title, req.body.description, req.body.price_mmk, req.body.telegram_group_id], ()=>res.json({success:true})));
app.delete('/api/admin/courses/:id', validateAdminData, (req, res) => db.run('DELETE FROM courses WHERE id=?', [req.params.id], ()=>res.json({success:true})));
app.post('/api/admin/modules', validateAdminData, (req, res) => db.run('INSERT INTO modules (course_id, title, order_index) VALUES (?,?,?)', [req.body.course_id, req.body.title, req.body.order_index], ()=>res.json({success:true})));
app.delete('/api/admin/modules/:id', validateAdminData, (req, res) => db.run('DELETE FROM modules WHERE id=?', [req.params.id], ()=>res.json({success:true})));
app.post('/api/admin/lessons', validateAdminData, (req, res) => db.run('INSERT INTO lessons (module_id, title, content, video_url, file_url, order_index) VALUES (?,?,?,?,?,?)', [req.body.module_id, req.body.title, req.body.content, req.body.video_url, req.body.file_url, req.body.order_index], ()=>res.json({success:true})));
app.delete('/api/admin/lessons/:id', validateAdminData, (req, res) => db.run('DELETE FROM lessons WHERE id=?', [req.params.id], ()=>res.json({success:true})));
app.post('/api/admin/announcements', validateAdminData, (req, res) => db.run('INSERT INTO announcements (course_id, title, content) VALUES (?,?,?)', [req.body.course_id, req.body.title, req.body.content], ()=>res.json({success:true})));
app.delete('/api/admin/announcements/:id', validateAdminData, (req, res) => db.run('DELETE FROM announcements WHERE id=?', [req.params.id], ()=>res.json({success:true})));
app.post('/api/admin/payment-methods', validateAdminData, upload.single('qr_image'), async (req, res) => {
    let qrImageUrl = null;
    if (req.file) {
        const blob = await put(req.file.originalname, req.file.buffer, { access: 'public' });
        qrImageUrl = blob.url;
    }
    db.run('INSERT INTO payment_methods (name, account_name, account_number, qr_image_url, instructions) VALUES (?,?,?,?,?)', [req.body.name, req.body.account_name, req.body.account_number, qrImageUrl, req.body.instructions], ()=>res.json({success:true}));
});
app.delete('/api/admin/payment-methods/:id', validateAdminData, (req, res) => db.run('DELETE FROM payment_methods WHERE id=?', [req.params.id], ()=>res.json({success:true})));

if (process.env.VERCEL) {
    module.exports = app;
} else {
    app.listen(port, () => console.log(`Server listening on port ${port}`));
}
