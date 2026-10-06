const crypto = require('crypto');
function same(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}
// Team passcode, sent by the page in the x-app-passcode header. Set APP_PASSCODE in Vercel.
function passcodeOk(req) {
  const want = process.env.APP_PASSCODE;
  if (!want) return false;
  return same(req.headers['x-app-passcode'] || '', want);
}
module.exports = { passcodeOk };
