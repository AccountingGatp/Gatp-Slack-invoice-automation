// Vercel Blob document store used by /api/data and the Slack automation.
// ONE place decides where documents live. Layout: gatp/<collection>/<id>.json
// If your current api/data.js uses a different key layout, change PREFIX / key() only.
const { put, list, head, del } = require('@vercel/blob');

const PREFIX = 'gatp/';
const key = (col, id) => `${PREFIX}${col}/${id}.json`;
const bust = url => url + (url.includes('?') ? '&' : '?') + 'ts=' + Date.now();

async function readDoc(col, id) {
  let meta;
  try { meta = await head(key(col, id)); }
  catch (e) {
    if (e && (e.name === 'BlobNotFoundError' || /not.?found/i.test(String(e.message)))) return null;
    throw e;
  }
  const r = await fetch(bust(meta.url), { cache: 'no-store' });
  return r.ok ? r.json() : null;
}

async function writeDoc(col, id, doc) {
  await put(key(col, id), JSON.stringify(doc), {
    access: 'public', contentType: 'application/json',
    addRandomSuffix: false, allowOverwrite: true, cacheControlMaxAge: 60
  });
}

async function deleteDoc(col, id) {
  try { await del(key(col, id)); } catch (e) { /* already gone */ }
}

async function listDocs(col) {
  const prefix = `${PREFIX}${col}/`; const out = {}; let cursor;
  do {
    const res = await list({ prefix, cursor });
    await Promise.all(res.blobs.map(async b => {
      const id = b.pathname.slice(prefix.length).replace(/\.json$/, '');
      const r = await fetch(bust(b.url), { cache: 'no-store' });
      if (r.ok) out[id] = await r.json();
    }));
    cursor = res.hasMore ? res.cursor : undefined;
  } while (cursor);
  return out;
}

module.exports = { readDoc, writeDoc, deleteDoc, listDocs };
