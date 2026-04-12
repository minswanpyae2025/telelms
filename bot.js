require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const db = require('./database');

const token = process.env.BOT_TOKEN || 'DUMMY_TOKEN';
const webAppUrl = process.env.WEB_APP_URL || 'https://google.com';

let bot;
if (token !== 'DUMMY_TOKEN') bot = new TelegramBot(token, { polling: true });
else bot = { onText:()=>{}, on:()=>{}, sendMessage:()=>{} };

let adminChannelId = process.env.ADMIN_CHANNEL_ID || null;

bot.onText(/\/start/, (msg) => {
    const user = msg.from;
    db.run('INSERT OR IGNORE INTO users (telegram_id, first_name, last_name, username) VALUES (?, ?, ?, ?)', [user.id, user.first_name, user.last_name, user.username]);
    bot.sendMessage(msg.chat.id, `မင်္ဂလာပါ။ Telegram Mini App LMS မှ ကြိုဆိုပါတယ်။`, { reply_markup: { inline_keyboard: [[{ text: "သင်တန်းများကြည့်ရန် 🚀", web_app: { url: webAppUrl } }]] }});
});

bot.onText(/\/courses/, (msg) => {
    db.get('SELECT id FROM users WHERE telegram_id = ?', [msg.from.id], (err, row) => {
        if (!row) return bot.sendMessage(msg.chat.id, "အကောင့်မရှိသေးပါ။");
        db.all(`SELECT c.title FROM payments p JOIN courses c ON p.course_id = c.id WHERE p.user_id = ? AND p.status = 'approved'`, [row.id], (err, rows) => {
            let text = "သင်အပ်နှံထားသော သင်တန်းများ:\n";
            if (rows) rows.forEach(r => text += `- ${r.title}\n`);
            bot.sendMessage(msg.chat.id, text);
        });
    });
});

bot.onText(/\/help/, (msg) => bot.sendMessage(msg.chat.id, "အကူအညီလိုပါက admin ကို ဆက်သွယ်ပါ။"));

bot.onText(/\/setadmin/, (msg) => {
    if (process.env.BOT_OWNER_ID && msg.from.id.toString() !== process.env.BOT_OWNER_ID) return bot.sendMessage(msg.chat.id, "Unauthorized");
    adminChannelId = msg.chat.id;
    bot.sendMessage(msg.chat.id, "Admin channel set.");
});

function notifyAdminPayment(paymentId, user, courseId, screenshotUrl) {
    if (adminChannelId) bot.sendMessage(adminChannelId, `Payment from ${user.first_name} ID:${paymentId}\n${screenshotUrl}`);
}

function notifyUserApproval(tgId, courseId, title, note) {
    bot.sendMessage(tgId, `✅ Approved: ${title}\nNote: ${note||''}`, { reply_markup: { inline_keyboard: [[{ text: "Join Group", callback_data: `join_${courseId}` }]] }});
}

function notifyUserRejection(tgId, title, note) {
    bot.sendMessage(tgId, `❌ Rejected: ${title}\nNote: ${note||''}`);
}

bot.on('callback_query', async (query) => {
    if (query.data.startsWith('join_')) {
        const courseId = query.data.split('_')[1];
        db.get('SELECT telegram_group_id FROM courses WHERE id=?', [courseId], async (err, row) => {
            if(row && row.telegram_group_id && bot.createChatInviteLink) {
                try {
                    const link = await bot.createChatInviteLink(row.telegram_group_id, { member_limit: 1, expire_date: Math.floor(Date.now()/1000) + 86400 });
                    bot.sendMessage(query.message.chat.id, `Link: ${link.invite_link}`);
                } catch(e) {}
            }
        });
    }
});

module.exports = { bot, notifyAdminPayment, notifyUserApproval, notifyUserRejection };
