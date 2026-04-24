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

async function sendPhoto(chatId, photoUrl, caption, opts = {}) {
  return callTelegramAPI('sendPhoto', { chat_id: chatId, photo: photoUrl, caption, parse_mode: 'HTML', ...opts });
}

async function setupWebhook(webhookUrl) {
  return callTelegramAPI('setWebhook', { url: webhookUrl });
}

async function ensureUser(tgUser) {
  const { data: existing } = await supabase
    .from('users').select('id').eq('telegram_id', tgUser.id).single();
  if (existing) return existing.id;
  const { data: inserted } = await supabase
    .from('users')
    .upsert({ telegram_id: tgUser.id, first_name: tgUser.first_name, last_name: tgUser.last_name || null, username: tgUser.username || null }, { onConflict: 'telegram_id' })
    .select('id').single();
  return inserted ? inserted.id : null;
}

async function handleWebhook(update) {
  if (update.message && update.message.text) {
    const msg = update.message;
    const text = msg.text;
    const chatId = msg.chat.id;

    if (text === '/start') {
      await ensureUser(msg.from);
      await sendMessage(chatId,
        '🎓 <b>လမ်းစ (Lann Sa)</b> မှ ကြိုဆိုပါတယ်!\n\nသင့်အနာဂတ် အသက်မွေးဝမ်းကျောင်း လမ်းကြောင်းကို ဒီကနေ စတင်လိုက်ပါ။\n\nသင်တန်းများ ကြည့်ရှုရန် အောက်က ခလုတ်ကို နှိပ်ပါ။', {
        reply_markup: {
          inline_keyboard: [[{ text: '📚 သင်တန်းများ ကြည့်ရန်', web_app: { url: WEB_APP_URL } }]]
        }
      });
    } else if (text === '/courses') {
      const userId = await ensureUser(msg.from);
      if (!userId) { await sendMessage(chatId, '⚠️ အကောင့်မရှိသေးပါ။ /start ကို နှိပ်ပါ။'); return; }
      const { data: payments } = await supabase
        .from('payments').select('course_id, courses(title)').eq('user_id', userId).eq('status', 'approved');
      let reply = '📖 <b>သင် စာရင်းသွင်းထားသော သင်တန်းများ</b>\n\n';
      if (payments && payments.length > 0) {
        payments.forEach((p, i) => { reply += `${i + 1}. ${p.courses.title}\n`; });
        reply += '\n📱 သင်တန်း ဝင်ကြည့်ရန် အောက်က ခလုတ်ကို နှိပ်ပါ။';
      } else {
        reply += 'သင်တန်း မစာရင်းသွင်းရသေးပါ။\nသင်တန်းများ ကြည့်ရှုရန် /start ကို နှိပ်ပါ။';
      }
      await sendMessage(chatId, reply, {
        reply_markup: { inline_keyboard: [[{ text: '📚 သင်တန်းများ ကြည့်ရန်', web_app: { url: WEB_APP_URL } }]] }
      });
    } else if (text === '/help') {
      await sendMessage(chatId,
        '📌 <b>လမ်းစ (Lann Sa) အကူအညီ</b>\n\n' +
        '/start - အက်ပ် စတင်ရန်\n' +
        '/courses - စာရင်းသွင်းထားသော သင်တန်းများ\n' +
        '/help - အကူအညီ\n\n' +
        '❓ အခြား အကူအညီ လိုပါက admin ကို ဆက်သွယ်ပါ။'
      );
    } else if (text === '/setadmin') {
      if (BOT_OWNER_ID && msg.from.id.toString() !== BOT_OWNER_ID) {
        await sendMessage(chatId, '⛔ ခွင့်ပြုချက် မရှိပါ။');
        return;
      }
      await sendMessage(chatId, `✅ Admin channel သတ်မှတ်ပြီးပါပြီ။\nChannel ID: <code>${chatId}</code>`);
    }
  }

  if (update.callback_query) {
    const query = update.callback_query;
    const data = query.data;

    if (data && data.startsWith('join_')) {
      const courseId = data.split('_')[1];
      const { data: course } = await supabase.from('courses').select('telegram_group_id, title').eq('id', courseId).single();
      if (course && course.telegram_group_id) {
        try {
          const result = await callTelegramAPI('createChatInviteLink', {
            chat_id: course.telegram_group_id,
            member_limit: 1,
            expire_date: Math.floor(Date.now() / 1000) + 86400,
          });
          if (result && result.result) {
            await sendMessage(query.message.chat.id,
              `🔗 <b>${course.title}</b> အတွက် Group ဝင်ရန် Link\n\n` +
              `${result.result.invite_link}\n\n` +
              `⚠️ ဒီ link ကို တစ်ကြိမ်သာ သုံးနိုင်ပြီး ၂၄ နာရီအတွင်း သုံးရပါမယ်။`
            );
          } else {
            await sendMessage(query.message.chat.id, '❌ Group link ဖန်တီး၍ မရပါ။ Admin ကို ဆက်သွယ်ပါ။');
          }
        } catch (e) {
          console.error('Error creating invite link:', e);
          await sendMessage(query.message.chat.id, '❌ Group link ဖန်တီး၍ မရပါ။ Admin ကို ဆက်သွယ်ပါ။');
        }
      } else {
        await sendMessage(query.message.chat.id, 'ℹ️ ဤ သင်တန်းအတွက် Telegram Group မရှိသေးပါ။');
      }
    }

    if (data && data.startsWith('retry_')) {
      const courseId = data.split('_')[1];
      await sendMessage(query.message.chat.id,
        '💳 ပြန်လည် ငွေပေးချေရန် အောက်က ခလုတ်ကို နှိပ်ပါ။', {
        reply_markup: {
          inline_keyboard: [[{ text: '📱 ငွေပေးချေရန်', web_app: { url: WEB_APP_URL } }]]
        }
      });
    }
  }
}

async function notifyAdminPayment(paymentId, userName, courseTitle, screenshotUrl) {
  if (!ADMIN_CHANNEL_ID) return;
  const text = `💳 <b>ငွေပေးချေမှု အသစ် ရောက်ရှိပါသည်</b>\n\n` +
    `👤 အမည်: ${userName}\n` +
    `📖 သင်တန်း: ${courseTitle}\n` +
    `🆔 Payment ID: ${paymentId}\n\n` +
    `Admin Dashboard တွင် စစ်ဆေးပါ။`;

  if (screenshotUrl && screenshotUrl.startsWith('http')) {
    await sendPhoto(ADMIN_CHANNEL_ID, screenshotUrl, text);
  } else {
    await sendMessage(ADMIN_CHANNEL_ID, text);
  }
}

async function notifyUserApproval(telegramId, courseId, courseTitle, note) {
  await sendMessage(telegramId,
    `✅ <b>ငွေပေးချေမှု အတည်ပြုပြီးပါပြီ!</b>\n\n` +
    `📖 သင်တန်း: ${courseTitle}\n` +
    `${note ? `📝 မှတ်ချက်: ${note}\n` : ''}` +
    `\nသင်တန်း content များကို ယခု ဝင်ကြည့်နိုင်ပါပြီ။\n` +
    `Group ရှိပါက "Group ဝင်ရန်" ခလုတ်ကို နှိပ်ပါ။`, {
    reply_markup: {
      inline_keyboard: [
        [{ text: '📖 သင်တန်း ဖွင့်ရန်', web_app: { url: WEB_APP_URL } }],
        [{ text: '💬 Group ဝင်ရန်', callback_data: `join_${courseId}` }]
      ]
    }
  });
}

async function notifyUserRejection(telegramId, courseId, courseTitle, note) {
  await sendMessage(telegramId,
    `❌ <b>ငွေပေးချေမှု ပယ်ချခံရပါသည်</b>\n\n` +
    `📖 သင်တန်း: ${courseTitle}\n` +
    `${note ? `📝 အကြောင်းပြချက်: ${note}\n` : ''}` +
    `\nပြန်လည် ကြိုးစားလိုပါက အောက်က ခလုတ်ကို နှိပ်ပါ။`, {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🔄 ပြန်လည် ငွေပေးချေရန်', callback_data: `retry_${courseId}` }],
        [{ text: '📱 အက်ပ် ဖွင့်ရန်', web_app: { url: WEB_APP_URL } }]
      ]
    }
  });
}

module.exports = {
  handleWebhook, setupWebhook, notifyAdminPayment,
  notifyUserApproval, notifyUserRejection, sendMessage, sendPhoto,
};
