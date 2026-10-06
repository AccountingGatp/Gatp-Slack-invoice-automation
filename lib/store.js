// Vercel Blob document store used by /api/data and the Slack automation.
// Layout matches the existing GATP store:  <collection>/<id>.json   (e.g. clients/boss-media.json, reviews/boss-media_2026-09.json)
// BLOB_ACCESS  = 'private' (default, same as the existing "gatp-books-review-data" store) or 'public'.
// BLOB_PREFIX  = optional folder in front of the collections (default none).
// Existing files are found by name, with or without ".json", and are overwritten in place.
const { put, list, del, get } = require('@vercel/blob');

const ACCESS = process.env.BLOB_ACCESS === 'public' ? 'public' : 'private';
const PREFIX = String(process.env.BLOB_PREFIX || '').replace(/^\/+/, '');
const dir = col => `${PREFIX}${col}/`;

async function find(col, id) {
  const base = `${dir(col)}${id}`;
  const res = await list({ prefix: base, limit: 20 });
  const hit = res.blobs.find(b => b.pathname === base + '.json') || res.blobs.find(b => b.pathname === base);
  return hit ? hit.pathname : null;
}
async function readPath(pathname) {
  const r = await get(pathname, { access: ACCESS, useCache: false });
  if (!r || !r.stream) return null;
  const text = await new Response(r.stream).text();
  try { return JSON.parse(text); } catch (e) { return null; }
}

async function readDoc(col, id) {
  const p = await find(col, id);
  return p ? readPath(p) : null;
}
async function writeDoc(col, id, doc) {
  const p = (await find(col, id)) || `${dir(col)}${id}.json`;
  await put(p, JSON.stringify(doc), { access: ACCESS, contentType: 'application/json', addRandomSuffix: false, allowOverwrite: true });
}
async function deleteDoc(col, id) {
  try { const p = await find(col, id); if (p) await del(p); } catch (e) { /* already gone */ }
}
async function listDocs(col) {
  const prefix = dir(col); const out = {}; let cursor;
  do {
    const res = await list({ prefix, cursor });
    await Promise.all(res.blobs.map(async b => {
      const name = b.pathname.slice(prefix.length);
      if (!name || name.includes('/')) return;
      const doc = await readPath(b.pathname);
      if (doc != null) out[name.replace(/\.json$/, '')] = doc;
    }));
    cursor = res.hasMore ? res.cursor : undefined;
  } while (cursor);
  return out;
}

module.exports = { readDoc, writeDoc, deleteDoc, listDocs };
