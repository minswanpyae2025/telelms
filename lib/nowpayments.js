const crypto = require('crypto');

const NP_API = 'https://api.nowpayments.io/v1';

async function npFetch(endpoint, apiKey, opts = {}) {
  const res = await fetch(`${NP_API}${endpoint}`, {
    headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json', ...opts.headers },
    ...opts,
  });
  return res.json();
}

async function getStatus(apiKey) {
  return npFetch('/status', apiKey);
}

async function getAvailableCurrencies(apiKey) {
  return npFetch('/currencies', apiKey);
}

async function getEstimatePrice(apiKey, amount, currencyFrom, currencyTo) {
  const qs = new URLSearchParams({ amount: String(amount), currency_from: currencyFrom, currency_to: currencyTo });
  return npFetch(`/estimate?${qs.toString()}`, apiKey);
}

async function getMinimumAmount(apiKey, currencyFrom, currencyTo) {
  const qs = new URLSearchParams({ currency_from: currencyFrom, currency_to: currencyTo });
  return npFetch(`/min-amount?${qs.toString()}`, apiKey);
}

async function createPayment(apiKey, { priceAmount, priceCurrency, payCurrency, orderId, orderDescription, ipnCallbackUrl }) {
  return npFetch('/payment', apiKey, {
    method: 'POST',
    body: JSON.stringify({
      price_amount: priceAmount,
      price_currency: priceCurrency || 'usd',
      pay_currency: payCurrency,
      order_id: orderId,
      order_description: orderDescription,
      ipn_callback_url: ipnCallbackUrl,
    }),
  });
}

async function getPaymentStatus(apiKey, paymentId) {
  return npFetch(`/payment/${paymentId}`, apiKey);
}

function verifyIPN(ipnSecret, body, signature) {
  if (!ipnSecret || !signature) return false;
  const sorted = JSON.stringify(sortObject(body));
  const hmac = crypto.createHmac('sha512', ipnSecret).update(sorted).digest('hex');
  const hmacBuf = Buffer.from(hmac, 'hex');
  const sigBuf = Buffer.from(String(signature), 'hex');
  return hmacBuf.length === sigBuf.length && crypto.timingSafeEqual(hmacBuf, sigBuf);
}

function sortObject(obj) {
  return Object.keys(obj).sort().reduce((result, key) => {
    result[key] = obj[key] && typeof obj[key] === 'object' && !Array.isArray(obj[key])
      ? sortObject(obj[key]) : obj[key];
    return result;
  }, {});
}

module.exports = {
  getStatus, getAvailableCurrencies, getEstimatePrice, getMinimumAmount,
  createPayment, getPaymentStatus, verifyIPN,
};
