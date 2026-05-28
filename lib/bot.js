const supabase = require('./supabase');
const { t } = require('./i18n');

const BOT_TOKEN = process.env.BOT_TOKEN || '';
const WEB_APP_URL = process.env.WEB_APP_URL || 'https://google.com';
const ADMIN_CHANNEL_ID = process.env.ADMIN_CHANNEL_ID || null;
const BOT_OWNER_ID = process.env.BOT_OWNER_ID || null;

async function getLang() {
  const { data } = await supabase.from('app_settings').select('value').eq('key', 'language').single();
  return data?.value || 'my';
}

async function callTelegramAPI(method, body) {
  if (!BOT_TOKEN) return null;
  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    return await res.json();
  } catch (err) { console.error(`Telegram API error (${method}):`, err.message); return null; }
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
  const { data: existing } = await supabase.from('users').select('id').eq('telegram_id', tgUser.id).single();
  if (existing) return existing.id;
  const { data: inserted } = await supabase.from('users')
    .upsert({ telegram_id: tgUser.id, first_name: tgUser.first_name, last_name: tgUser.last_name || null, username: tgUser.username || null }, { onConflict: 'telegram_id' })
    .select('id').single();
  return inserted ? inserted.id : null;
}

async function handleWebhook(update) {
  const lang = await getLang();

  if (update.message && update.message.text) {
    const msg = update.message;
    const text = msg.text;
    const chatId = msg.chat.id;

    if (text === '/start') {
      await ensureUser(msg.from);
      await sendMessage(chatId, t(lang, 'bot_welcome'), {
        reply_markup: { inline_keyboard: [[{ text: t(lang, 'bot_open_app'), web_app: { url: WEB_APP_URL } }]] }
      });
    } else if (text === '/courses') {
      const userId = await ensureUser(msg.from);
      if (!userId) { await sendMessage(chatId, t(lang, 'bot_no_account')); return; }
      const { data: payments } = await supabase.from('payments').select('course_id, courses(title)').eq('user_id', userId).eq('status', 'approved');
      const { data: cryptoPayments } = await supabase.from('crypto_payments').select('course_id, courses(title)').eq('user_id', userId).eq('status', 'finished');
      const allEnrolled = [...(payments || []), ...(cryptoPayments || [])];
      let reply = t(lang, 'bot_my_courses');
      if (allEnrolled.length > 0) {
        allEnrolled.forEach((p, i) => { reply += `${i + 1}. ${p.courses?.title || ''}\n`; });
        reply += t(lang, 'bot_view_courses');
      } else {
        reply += t(lang, 'bot_no_courses');
      }
      await sendMessage(chatId, reply, {
        reply_markup: { inline_keyboard: [[{ text: t(lang, 'bot_open_app'), web_app: { url: WEB_APP_URL } }]] }
      });
    } else if (text === '/help') {
      await sendMessage(chatId, t(lang, 'bot_help'));
    } else if (text === '/setadmin') {
      if (BOT_OWNER_ID && msg.from.id.toString() !== BOT_OWNER_ID) {
        await sendMessage(chatId, t(lang, 'bot_unauthorized')); return;
      }
      await sendMessage(chatId, `${t(lang, 'bot_admin_set')}\nChannel ID: <code>${chatId}</code>`);
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
            chat_id: course.telegram_group_id, member_limit: 1,
            expire_date: Math.floor(Date.now() / 1000) + 86400,
          });
          if (result && result.result) {
            await sendMessage(query.message.chat.id,
              `${t(lang, 'bot_group_link', { title: course.title })}\n\n${result.result.invite_link}${t(lang, 'bot_link_warning')}`
            );
          } else {
            await sendMessage(query.message.chat.id, t(lang, 'bot_link_fail'));
          }
        } catch (e) {
          console.error('Error creating invite link:', e);
          await sendMessage(query.message.chat.id, t(lang, 'bot_link_fail'));
        }
      } else {
        await sendMessage(query.message.chat.id, t(lang, 'bot_no_group'));
      }
    }

    if (data && data.startsWith('retry_')) {
      await sendMessage(query.message.chat.id, t(lang, 'bot_retry_open'), {
        reply_markup: { inline_keyboard: [[{ text: t(lang, 'bot_pay_now'), web_app: { url: WEB_APP_URL } }]] }
      });
    }
  }
}

async function notifyAdminPayment(paymentId, userName, courseTitle, screenshotUrl) {
  if (!ADMIN_CHANNEL_ID) return;
  const lang = await getLang();
  const text = `${t(lang, 'bot_payment_received')}\n\n${t(lang, 'bot_user_label')}: ${userName}\n${t(lang, 'bot_course_label')}: ${courseTitle}\n🆔 Payment ID: ${paymentId}\n\n${t(lang, 'bot_check_dashboard')}`;
  if (screenshotUrl && screenshotUrl.startsWith('http')) {
    await sendPhoto(ADMIN_CHANNEL_ID, screenshotUrl, text);
  } else { await sendMessage(ADMIN_CHANNEL_ID, text); }
}

async function notifyAdminCryptoPayment(userName, courseTitle, amount, coin) {
  if (!ADMIN_CHANNEL_ID) return;
  const lang = await getLang();
  await sendMessage(ADMIN_CHANNEL_ID,
    `${t(lang, 'bot_crypto_success')}\n\n${t(lang, 'bot_user_label')}: ${userName}\n${t(lang, 'bot_course_label')}: ${courseTitle}\n${t(lang, 'bot_amount_label')}: ${amount}\n${t(lang, 'bot_coin_label')}: ${coin.toUpperCase()}`
  );
}

async function notifyUserApproval(telegramId, courseId, courseTitle, note) {
  const lang = await getLang();
  await sendMessage(telegramId,
    `${t(lang, 'bot_approved')}\n\n${t(lang, 'bot_course_label')}: ${courseTitle}\n${note ? `${t(lang, 'bot_note')}: ${note}\n` : ''}${t(lang, 'bot_can_access')}`, {
    reply_markup: { inline_keyboard: [
      [{ text: t(lang, 'bot_open_course'), web_app: { url: WEB_APP_URL } }],
      [{ text: t(lang, 'bot_join_group'), callback_data: `join_${courseId}` }]
    ] }
  });
}

async function notifyUserRejection(telegramId, courseId, courseTitle, note) {
  const lang = await getLang();
  await sendMessage(telegramId,
    `${t(lang, 'bot_rejected')}\n\n${t(lang, 'bot_course_label')}: ${courseTitle}\n${note ? `${t(lang, 'bot_reason')}: ${note}\n` : ''}${t(lang, 'bot_retry_msg')}`, {
    reply_markup: { inline_keyboard: [
      [{ text: t(lang, 'bot_retry_pay'), callback_data: `retry_${courseId}` }],
      [{ text: t(lang, 'bot_open_app_btn'), web_app: { url: WEB_APP_URL } }]
    ] }
  });
}

async function notifyUserCryptoSuccess(telegramId, courseId, courseTitle) {
  const lang = await getLang();
  await sendMessage(telegramId,
    `${t(lang, 'bot_approved')}\n\n${t(lang, 'bot_course_label')}: ${courseTitle}\n${t(lang, 'bot_can_access')}`, {
    reply_markup: { inline_keyboard: [
      [{ text: t(lang, 'bot_open_course'), web_app: { url: WEB_APP_URL } }],
      [{ text: t(lang, 'bot_join_group'), callback_data: `join_${courseId}` }]
    ] }
  });
}

module.exports = {
  handleWebhook, setupWebhook, notifyAdminPayment, notifyAdminCryptoPayment,
  notifyUserApproval, notifyUserRejection, notifyUserCryptoSuccess, sendMessage, sendPhoto,
};
