// /api/monthly-reminders – runs once a day from Vercel Cron.
// The reminder days come from INVOICE_SEND_DAY and PAYMENT_REMINDER_DAY, so they can be
// changed in Vercel Environment Variables without touching code.
const { readDoc, writeDoc } = require('./store');
const { allClients, postMessage, msg, testChannel } = require('./slack');

function today(tz, d = new Date()) {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: tz, hourCycle: 'h23', hour: '2-digit', minute: '2-digit', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d);
  const g = t => p.find(x => x.type === t).value;
  return { day: +g('day'), ym: `${g('year')}-${g('month')}`, min: (+g('hour') % 24) * 60 + +g('minute') };
}
// REMINDER_TIME = "HH:MM" (24h, in REMINDER_TIMEZONE). Optional: when it is not set there is no time check
// (right for Vercel Hobby, where the daily cron fires at a time Vercel chooses inside its hour).
function envTime() {
  if (!String(process.env.REMINDER_TIME || '').trim()) return 0;
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(process.env.REMINDER_TIME).trim());
  return m && +m[1] < 24 && +m[2] < 60 ? +m[1] * 60 + +m[2] : 0;
}

const envDay = k => { const n = parseInt(process.env[k], 10); return n >= 1 && n <= 31 ? n : null; };

async function run(kind, ym, clients, results, dryRun, test, shouldSend) {
  for (const c of clients) {
    const row = { client: c.clientId, type: kind };
    try {
      if (!c.channel && !test) { row.result = 'skipped_no_channel'; results.push(row); continue; }
      const dedupeId = `${test ? 'test_' : ''}${ym}_${c.clientId}_${kind}`; // test runs never block real reminders
      if (await readDoc('reminders', dedupeId)) { row.result = 'skipped_already_sent'; results.push(row); continue; }
      if (!(await shouldSend(c))) { row.result = 'skipped_paid'; results.push(row); continue; }
      if (dryRun) { row.result = 'would_send'; results.push(row); continue; }
      const text = kind === 'invoice' ? msg.invoice(c.clientName) : msg.followup(c.clientName, ym);
      const r = await postMessage(c.channel, text);
      if (r.ok) { await writeDoc('reminders', dedupeId, { clientId: c.clientId, period: ym, type: kind, sentAt: new Date().toISOString() }); row.result = 'sent'; }
      else { row.result = 'failed'; row.error = r.error; } // not recorded, so a later run can retry
    } catch (e) { row.result = 'failed'; row.error = 'exception'; }
    results.push(row);
  }
}

module.exports = async (req, res) => {
  res.setHeader('cache-control', 'no-store');
  if (process.env.CRON_SECRET && req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) return res.status(401).json({ error: 'unauthorized' });
  const tz = process.env.REMINDER_TIMEZONE || 'Asia/Kolkata';
  const test = !!testChannel();
  let { day, ym, min } = today(tz);
  // TEST_DATE (YYYY-MM-DD) and TEST_TIME (HH:MM) pretend it is that moment. Only honoured while TEST_SLACK_CHANNEL_ID is set.
  const td = /^(\d{4}-\d{2})-(\d{2})$/.exec(String(process.env.TEST_DATE || '').trim());
  if (test && td) { ym = td[1]; day = +td[2]; }
  const tt = /^(\d{1,2}):(\d{2})$/.exec(String(process.env.TEST_TIME || '').trim());
  if (test && tt) min = +tt[1] * 60 + +tt[2];
  const sendFrom = envTime(), due = min >= sendFrom; // sends on the first run at/after REMINDER_TIME; duplicates are blocked per month
  const dryRun = !!(req.query && req.query.dryRun);
  const invoiceDay = envDay('INVOICE_SEND_DAY'), payDay = envDay('PAYMENT_REMINDER_DAY');
  const clients = allClients().filter(Boolean); const results = [];
  if (due && day === invoiceDay) await run('invoice', ym, clients, results, dryRun, test, async () => true);
  if (due && day === payDay) await run('payment-followup', ym, clients, results, dryRun, test, async c => {
    const r = await readDoc('reviews', `${c.clientId}_${ym}`);
    return !(r && r.pay && r.pay.status === 'paid');
  });
  console.log('monthly-reminders', JSON.stringify({ day, ym, invoiceDay, payDay, due, test, dryRun, results }));
  return res.status(200).json({ day, ym, invoiceDay, payDay, due, test, dryRun, results });
};
