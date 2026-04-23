const supabase = require('./supabase');

const BOT_TOKEN = process.env.BOT_TOKEN || '';
const WEB_APP_URL = process.env.WEB_APP_URL || 'https://google.com';
const ADMIN_CHANNEL_ID = process.env.ADMIN_CHANNEL_ID || null;
const BOT_OWNER_ID = process.env.BOT_OWNER_ID || null;

async function callTelegramAPI(method, body) {
  if (!BOT_TOKEN) return null;
  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return await res.json();
  } catch (err) {
    console.error(`Telegram API error (${method}):`, err.message);
    return null;
  }
}

async function sendMessage(chatId, text, opts = {}) {
  return callTelegramAPI('sendMessage', { chat_id: chatId, text, parse_mode: 'HTML', ...opts });
}

async function setupWebhook(webhookUrl) {
  return callTelegramAPI('setWebhook', { url: webhookUrl });
}

async function ensureUser(tgUser) {
  const { data: existing } = await supabase
    .from('users')
    .select('id')
    .eq('telegram_id', tgUser.id)
    .single();

  if (existing) return existing.id;

  const { data: inserted } = await supabase
    .from('users')
    .upsert({
      telegram_id: tgUser.id,
      first_name: tgUser.first_name,
      last_name: tgUser.last_name || null,
      username: tgUser.username || null,
    }, { onConflict: 'telegram_id' })
    .select('id')
    .single();

  return inserted ? inserted.id : null;
}

async function handleWebhook(update) {
  if (update.message && update.message.text) {
    const msg = update.message;
    const text = msg.text;
    const chatId = msg.chat.id;

    if (text === '/start') {
      await ensureUser(msg.from);
      await sendMessage(chatId, 'မင်္ဂလာပါ။ Telegram Mini App LMS မှ ကြိုဆိုပါတယ်။', {
        reply_markup: {
          inline_keyboard: [[{
            text: 'သင်တန်းများကြည့်ရန် 🚀',
            web_app: { url: WEB_APP_URL }
          }]]
        }
      });
    } else if (text === '/courses') {
      const userId = await ensureUser(msg.from);
      if (!userId) {
        await sendMessage(chatId, 'အကောင့်မရှိသေးပါ။ /start ကို နှိပ်ပါ။');
        return;
      }
      const { data: payments } = await supabase
        .from('payments')
        .select('course_id, courses(title)')
        .eq('user_id', userId)
        .eq('status', 'approved');

      let reply = 'သင်အပ်နှံထားသော သင်တန်းများ:\n';
      if (payments && payments.length > 0) {
        payments.forEach(p => { reply += `- ${p.courses.title}\n`; });
      } else {
        reply += 'မရှိသေးပါ။';
      }
      await sendMessage(chatId, reply);
    } else if (text === '/help') {
      await sendMessage(chatId, 'အကူအညီလိုပါက admin ကို ဆက်သွယ်ပါ။\n\nCommands:\n/start - စတင်ရန်\n/courses - သင်တန်းများကြည့်ရန်\n/help - အကူအညီ');
    } else if (text === '/setadmin') {
      if (BOT_OWNER_ID && msg.from.id.toString() !== BOT_OWNER_ID) {
        await sendMessage(chatId, 'Unauthorized');
        return;
      }
      await sendMessage(chatId, `Admin channel set. ID: ${chatId}`);
    }
  }

  if (update.callback_query) {
    const query = update.callback_query;
    if (query.data && query.data.startsWith('join_')) {
      const courseId = query.data.split('_')[1];
      const { data: course } = await supabase
        .from('courses')
        .select('telegram_group_id')
        .eq('id', courseId)
        .single();

      if (course && course.telegram_group_id) {
        try {
          const result = await callTelegramAPI('createChatInviteLink', {
            chat_id: course.telegram_group_id,
            member_limit: 1,
            expire_date: Math.floor(Date.now() / 1000) + 86400,
          });
          if (result && result.result) {
            await sendMessage(query.message.chat.id, `Join Link: ${result.result.invite_link}`);
          }
        } catch (e) {
          console.error('Error creating invite link:', e);
        }
      }
    }
  }
}

async function notifyAdminPayment(paymentId, userName, courseTitle, screenshotUrl) {
  if (!ADMIN_CHANNEL_ID) return;
  await sendMessage(ADMIN_CHANNEL_ID,
    `💳 <b>Payment Received</b>\n\nFrom: ${userName}\nCourse: ${courseTitle}\nPayment ID: ${paymentId}\nScreenshot: ${screenshotUrl}\n\nPlease review in admin dashboard.`
  );
}

async function notifyUserApproval(telegramId, courseId, courseTitle, note) {
  await sendMessage(telegramId,
    `✅ <b>Payment Approved!</b>\n\nCourse: ${courseTitle}\n${note ? `Note: ${note}` : ''}\n\nYou can now access the course content.`,
    {
      reply_markup: {
        inline_keyboard: [[{
          text: '📖 Open Course',
          web_app: { url: WEB_APP_URL }
        }, {
          text: '💬 Join Group',
          callback_data: `join_${courseId}`
        }]]
      }
    }
  );
}

async function notifyUserRejection(telegramId, courseTitle, note) {
  await sendMessage(telegramId,
    `❌ <b>Payment Rejected</b>\n\nCourse: ${courseTitle}\n${note ? `Reason: ${note}` : ''}\n\nPlease contact admin for assistance.`
  );
}

module.exports = {
  handleWebhook,
  setupWebhook,
  notifyAdminPayment,
  notifyUserApproval,
  notifyUserRejection,
  sendMessage,
};
