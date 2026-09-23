// Saved projects: api/projects.js driven end-to-end against an in-memory
// fake of the GitHub Git Data + Contents APIs, plus the pure chunk helpers.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { chunkRanges, chunkPath, joinChunks, projectId, sourcePrefix, CHUNK_BYTES } from '../src/lenticular/core/projects.mjs';

const require = createRequire(import.meta.url);
const handler = require('../api/projects.js');
const SECRET = 'test-secret';

function fakeGitHub() {
    const blobs = new Map();            // sha -> base64
    const trees = new Map();            // sha -> Map(path -> blobSha)
    const commits = new Map();          // sha -> {tree, parents}
    let head;
    let n = 0;
    const id = s => createHash('sha1').update(String(s) + (n++)).digest('hex');
    const t0 = id('tree'); trees.set(t0, new Map());
    head = id('commit'); commits.set(head, { tree: t0, parents: [] });
    const json = (status, obj) => ({ ok: status < 300, status, json: async () => obj, text: async () => JSON.stringify(obj) });
    const stats = { commits: 0 };
    const fetchImpl = async (url, opts = {}) => {
        const u = new URL(url);
        const path = u.pathname.replace(/^\/repos\/[^/]+\/[^/]+/, '');
        const method = opts.method || 'GET';
        const body = opts.body ? JSON.parse(opts.body) : null;
        if (method === 'GET' && path === '/git/ref/heads/main') return json(200, { object: { sha: head } });
        if (method === 'GET' && path.startsWith('/git/commits/')) return json(200, { tree: { sha: commits.get(path.split('/').pop()).tree } });
        if (method === 'POST' && path === '/git/blobs') { const s = id(body.content); blobs.set(s, body.content); return json(201, { sha: s }); }
        if (method === 'GET' && path.startsWith('/git/blobs/')) { const c = blobs.get(path.split('/').pop()); return c ? json(200, { content: c }) : json(404, {}); }
        if (method === 'POST' && path === '/git/trees') {
            const t = new Map(trees.get(body.base_tree));
            for (const e of body.tree) {
                if (e.sha === null) t.delete(e.path);
                else if (e.content != null) { const s = id(e.content); blobs.set(s, Buffer.from(e.content).toString('base64')); t.set(e.path, s); }
                else t.set(e.path, e.sha);
            }
            const s = id('t'); trees.set(s, t); return json(201, { sha: s });
        }
        if (method === 'GET' && path.startsWith('/git/trees/')) {
            const t = trees.get(path.split('/').pop());
            return json(200, { tree: [...t].map(([p, s]) => ({ path: p, type: 'blob', sha: s })) });
        }
        if (method === 'POST' && path === '/git/commits') { const s = id('c'); commits.set(s, { tree: body.tree, parents: body.parents }); return json(201, { sha: s }); }
        if (method === 'PATCH' && path === '/git/refs/heads/main') { head = body.sha; stats.commits++; return json(200, {}); }
        if (method === 'GET' && path.startsWith('/contents/')) {
            const p = decodeURIComponent(path.slice('/contents/'.length));
            const s = trees.get(commits.get(head).tree).get(p);
            return s ? json(200, { content: blobs.get(s), sha: s }) : json(404, {});
        }
        return json(500, { error: 'unhandled ' + method + ' ' + path });
    };
    return { fetchImpl, stats, headTree: () => trees.get(commits.get(head).tree) };
}

async function call(method, { query, body, secret = SECRET } = {}) {
    let status, payload;
    const res = { status(c) { status = c; return this; }, json(o) { payload = o; return this; } };
    await handler({ method, query: query || {}, body, headers: { 'x-dev-panel-secret': secret } }, res);
    return { status, payload };
}

test('chunk helpers', () => {
    assert.deepEqual(chunkRanges(10, 4), [[0, 4], [4, 8], [8, 10]]);
    assert.deepEqual(chunkRanges(0, 4), [[0, 0]]);
    assert.equal(chunkRanges(CHUNK_BYTES * 2 + 1).length, 3);
    assert.equal(chunkPath('output.png', 7), 'output.png.007');
    assert.deepEqual([...joinChunks([Uint8Array.of(1, 2), Uint8Array.of(3)])], [1, 2, 3]);
    assert.match(projectId('My Cat Flip!', 1700000000000), /^my-cat-flip-[a-z0-9]+$/);
    assert.equal(sourcePrefix(3, 'IMG_001.JPG'), 'source-03.jpg');
    // a piece stays under the endpoint's base64 cap (and Vercel's 4.5 MB)
    assert.ok(Math.ceil(CHUNK_BYTES / 3) * 4 < 3600000);
});

test('save → list → open (byte-exact) → delete, one commit each', async () => {
    const gh = fakeGitHub();
    const origFetch = globalThis.fetch;
    globalThis.fetch = gh.fetchImpl;
    process.env.GITHUB_TOKEN = 't'; process.env.DEV_PANEL_SAVE_SECRET = SECRET;
    try {
        assert.equal((await call('GET', { query: { action: 'list' }, secret: 'wrong' })).status, 401);
        assert.deepEqual((await call('GET', { query: { action: 'list' } })).payload, { ok: true, projects: [] });

        // a 5.3 MB "source photo" split the way the browser client does
        const photo = Buffer.alloc(5300000); for (let i = 0; i < photo.length; i++) photo[i] = (i * 31) & 255;
        const files = [];
        const chunks = [];
        for (const [i, [s, e]] of chunkRanges(photo.length).entries()) {
            const r = await call('POST', { body: { action: 'blob', contentBase64: photo.subarray(s, e).toString('base64') } });
            assert.equal(r.status, 200);
            chunks.push({ path: chunkPath('source-00.jpg', i), sha: r.payload.sha });
        }
        files.push(...chunks);
        assert.equal(chunks.length, 3);
        const id = 'cat-flip-abc123';
        const manifest = { version: 1, id, name: 'Cat flip', frames: [{ kind: 'image', name: 'cat.jpg', mime: 'image/jpeg', size: photo.length, chunks }], output: { chunks: [] } };
        const before = gh.stats.commits;
        const c = await call('POST', { body: { action: 'commit', id, manifest, files, indexEntry: { id, name: 'Cat flip', createdAt: 'now' } } });
        assert.equal(c.status, 200, JSON.stringify(c.payload));
        assert.equal(gh.stats.commits - before, 1, 'whole project = one commit');
        assert.ok(gh.headTree().has(`data/projects/${id}/source-00.jpg.002`));

        const list = (await call('GET', { query: { action: 'list' } })).payload.projects;
        assert.deepEqual(list.map(p => p.id), [id]);
        const m = (await call('GET', { query: { action: 'manifest', id } })).payload.manifest;
        const parts = [];
        for (const ch of m.frames[0].chunks) {
            const r = await call('GET', { query: { action: 'blob', sha: ch.sha } });
            parts.push(Buffer.from(r.payload.contentBase64, 'base64'));
        }
        assert.ok(Buffer.concat(parts).equals(photo), 'reassembled bytes identical');

        const d = await call('POST', { body: { action: 'delete', id } });
        assert.equal(d.status, 200);
        assert.equal(d.payload.removed, 4); // 3 pieces + manifest
        assert.equal((await call('GET', { query: { action: 'list' } })).payload.projects.length, 0);
        assert.ok(![...gh.headTree().keys()].some(p => p.startsWith(`data/projects/${id}/`)));
    } finally {
        globalThis.fetch = origFetch;
    }
});

test('rejects bad input', async () => {
    const gh = fakeGitHub();
    const origFetch = globalThis.fetch;
    globalThis.fetch = gh.fetchImpl;
    process.env.GITHUB_TOKEN = 't'; process.env.DEV_PANEL_SAVE_SECRET = SECRET;
    try {
        assert.equal((await call('POST', { body: { action: 'blob', contentBase64: 'x'.repeat(3600004) } })).status, 400);
        assert.equal((await call('POST', { body: { action: 'blob', contentBase64: 'not base64!' } })).status, 400);
        assert.equal((await call('GET', { query: { action: 'manifest', id: '../etc' } })).status, 400);
        assert.equal((await call('POST', { body: { action: 'commit', id: 'ok-id-1', manifest: {}, indexEntry: {}, files: [{ path: '../x', sha: 'a'.repeat(40) }] } })).status, 400);
    } finally {
        globalThis.fetch = origFetch;
    }
});
