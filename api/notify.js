// /api/notify – manual "Send / Re-send to Slack" for a paid month. The message and the
// channel are built on the server from gatp_slack_clients_v1.json; the browser sends only ids.
const { readDoc, writeDoc } = require('../lib/store');
const { passcodeOk } = require('../lib/auth');
const { sendPaymentReceived } = require('../lib/payments');

module.exports = async (req, res) => {
  res.setHeader('cache-control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  if (!process.env.APP_PASSCODE) return res.status(500).json({ ok: false, error: 'APP_PASSCODE is not set' });
  if (!passcodeOk(req)) return res.status(401).json({ ok: false, error: 'unauthorized' });
  let b = req.body; if (typeof b === 'string') { try { b = JSON.parse(b); } catch { b = null; } }
  const clientId = b && String(b.clientId || ''), period = b && String(b.period || '');
  if (!/^[A-Za-z0-9._~-]+$/.test(clientId || '') || !/^\d{4}-\d{2}$/.test(period || '')) return res.status(400).json({ ok: false, error: 'bad_request' });
  const slack = await sendPaymentReceived(clientId, period);
  try {
    const id = `${clientId}_${period}`; const doc = (await readDoc('reviews', id)) || { client: clientId, period };
    doc.pay = Object.assign({ status: 'none' }, doc.pay, { slack });
    await writeDoc('reviews', id, doc);
  } catch (e) { /* the message result is still returned */ }
  return res.status(200).json({ ok: slack.ok, error: slack.error, slack });
};
