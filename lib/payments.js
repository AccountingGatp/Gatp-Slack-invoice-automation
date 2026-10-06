// Payment-received Slack message, triggered only by the transition  previous != paid  ->  paid.
const { clientCfg, postMessage, msg } = require('./slack');
const ID = /^(.+)_(\d{4}-\d{2})$/;

async function sendPaymentReceived(clientId, ym) {
  const at = new Date().toISOString();
  try {
    const c = clientCfg(clientId);
    if (!c) return { at, ok: false, error: 'unknown_client' };
    const r = await postMessage(c.channel, msg.paymentReceived(c.clientName, ym));
    return { at, ok: r.ok, error: r.ok ? '' : r.error };
  } catch (e) { return { at, ok: false, error: 'exception' }; }
}

// Called by /api/data before a review document is saved. Never throws, never blocks the save.
async function onReviewSave(id, incoming, prev) {
  try {
    const m = ID.exec(id);
    if (!m || !incoming || typeof incoming !== 'object') return incoming;
    const prevPay = (prev && prev.pay) || {};
    if (!incoming.pay) { if (prev && prev.pay) incoming.pay = prev.pay; return incoming; }
    const was = prevPay.status || 'none', now = incoming.pay.status || 'none';
    // The Slack result is owned by the server: browsers cannot overwrite or erase it.
    if (prevPay.slack) incoming.pay.slack = prevPay.slack; else delete incoming.pay.slack;
    if (now === 'paid' && was !== 'paid') incoming.pay.slack = await sendPaymentReceived(m[1], m[2]);
  } catch (e) { /* a Slack problem must never break the Payment Tracker */ }
  return incoming;
}

module.exports = { onReviewSave, sendPaymentReceived };
