// /api/monthly-reminders – called once a day by Vercel Cron (and by you, in the browser, to test).
// The real work is in lib/reminders.js. Any crash is returned as readable JSON instead of a blank 500 page.
module.exports = async (req, res) => {
  try {
    return await require('../lib/reminders')(req, res);
  } catch (e) {
    console.error('monthly-reminders crash', e && e.stack || e);
    res.setHeader('cache-control', 'no-store');
    return res.status(500).json({ error: 'crash', message: String((e && e.message) || e).slice(0, 400) });
  }
};
