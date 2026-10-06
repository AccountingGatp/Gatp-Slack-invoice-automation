// Slack helpers. One bot token, chat.postMessage, server-side only.
const cfg = require('../gatp_slack_clients_v1.json');

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const monthLabel = ym => { const [y, m] = String(ym).split('-'); return `${MONTHS[+m - 1]} ${y}`; };
// Slack treats & < > as control characters in message text.
const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const VALID_CHANNEL = /^[CGD][A-Z0-9]{6,}$/;

function clientCfg(clientId) {
  const c = (cfg.clients || []).find(x => x.clientId === clientId);
  if (!c) return null;
  const channel = String(c.slackChannelId || '').trim();
  return { clientId: c.clientId, clientName: c.clientName, channel: VALID_CHANNEL.test(channel) ? channel : '' };
}
const allClients = () => (cfg.clients || []).map(c => clientCfg(c.clientId));

// TEST MODE: when TEST_SLACK_CHANNEL_ID is set, EVERY message goes to that one channel (marked [TEST]).
const testChannel = () => { const c = String(process.env.TEST_SLACK_CHANNEL_ID || '').trim(); return VALID_CHANNEL.test(c) ? c : ''; };

async function postMessage(channel, text) {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) return { ok: false, error: 'missing_token' };
  const tc = testChannel();
  if (tc) { channel = tc; text = '[TEST] ' + text; }
  if (!channel) return { ok: false, error: 'no_channel' };
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 8000);
  try {
    const r = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST', signal: ctl.signal,
      headers: { 'content-type': 'application/json; charset=utf-8', authorization: 'Bearer ' + token },
      body: JSON.stringify({ channel, text, link_names: false })
    });
    const j = await r.json().catch(() => ({}));
    return j.ok ? { ok: true } : { ok: false, error: j.error || ('http_' + r.status) };
  } catch (e) {
    return { ok: false, error: e && e.name === 'AbortError' ? 'timeout' : 'network_error' };
  } finally { clearTimeout(t); }
}

// In test mode the HR group is NOT pinged (shown as [HR mention]) unless TEST_PING_HR=1.
const mention = () => { const m = (process.env.HR_SLACK_MENTION || '').trim(); return testChannel() && process.env.TEST_PING_HR !== '1' ? (m ? '[HR mention]' : '') : m; };
const withMention = body => (mention() ? mention() + ' ' : '') + body;
const msg = {
  paymentReceived: (name, ym) => `Payment received for ${esc(name)} for ${monthLabel(ym)}. Books work can now start.`,
  invoice: name => withMention(`Reminder: Please send this month's invoice to ${esc(name)} and update the Payment Tracker once the invoice is sent.`),
  followup: (name, ym) => withMention(`Reminder: Payment is still pending for ${esc(name)} for ${monthLabel(ym)}. Please follow up with the client.`)
};

module.exports = { clientCfg, allClients, postMessage, msg, monthLabel, testChannel };
