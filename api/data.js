// /api/data  – shared storage for clients and reviews (Vercel Blob).
const { readDoc, writeDoc, deleteDoc, listDocs } = require('../lib/store');
const { passcodeOk } = require('../lib/auth');
const { onReviewSave } = require('../lib/payments');

const COLS = ['clients', 'reviews'];
const SAFE = /^[A-Za-z0-9._~-]+$/;

module.exports = async (req, res) => {
  res.setHeader('cache-control', 'no-store');
  if (!process.env.APP_PASSCODE) return res.status(500).json({ error: 'APP_PASSCODE is not set' });
  if (!passcodeOk(req)) return res.status(401).json({ error: 'unauthorized' });
  const { col, id } = req.query || {};
  if (!COLS.includes(col) || (id != null && !SAFE.test(id))) return res.status(400).json({ error: 'bad_request' });
  try {
    if (req.method === 'GET') return res.status(200).json(id ? (await readDoc(col, id)) || null : await listDocs(col));
    if (req.method === 'PUT') {
      if (!id) return res.status(400).json({ error: 'bad_request' });
      let body = req.body; if (typeof body === 'string') body = JSON.parse(body);
      if (!body || typeof body !== 'object') return res.status(400).json({ error: 'bad_body' });
      if (col === 'reviews') body = await onReviewSave(id, body, await readDoc('reviews', id));
      await writeDoc(col, id, body);
      return res.status(200).json({ ok: true });
    }
    if (req.method === 'DELETE') {
      if (!id) return res.status(400).json({ error: 'bad_request' });
      await deleteDoc(col, id); return res.status(200).json({ ok: true });
    }
    return res.status(405).json({ error: 'method_not_allowed' });
  } catch (e) {
    console.error('data error', col, id, e && e.message);
    return res.status(500).json({ error: 'server_error' });
  }
};
