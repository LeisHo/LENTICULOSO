// Vercel serverless function: saved Workbench projects (generated image +
// source images + settings), stored in this GitHub repo under
// data/projects/<id>/ via the Git Data API.
//
// WHY CHUNKED BLOBS. A Vercel function accepts/returns at most 4.5 MB per
// request, but source photos and A4 outputs are routinely larger. So the
// browser splits every file into ≤2.5 MB pieces (≈3.4 MB as base64) and
// uploads each as a git BLOB (not yet part of any commit). A final
// "commit" request writes the manifest + index and all the piece paths in
// ONE tree/commit — one commit per saved project instead of one per piece.
// Pieces are read back by blob sha, which works at any size.
//
// Actions:
//   GET  ?action=list                 → { ok, projects: [indexEntry…] }
//   GET  ?action=manifest&id=<id>     → { ok, manifest }
//   GET  ?action=blob&sha=<sha>       → { ok, contentBase64 }
//   POST { action:'blob', contentBase64 }             → { ok, sha }
//   POST { action:'commit', id, manifest, files:[{path, sha}], indexEntry }
//   POST { action:'delete', id }
// Every request needs the x-dev-panel-secret header (reads too — saved
// projects may hold personal photos). Same env vars as save-settings.js.

const DEFAULT_REPO = 'LeisHo/LENTICULOSO';
const DEFAULT_BRANCH = 'main';
const ROOT = 'data/projects';
const MAX_BLOB_B64 = 3600000; // ≈2.7 MB raw; keeps every request under Vercel's 4.5 MB

module.exports = async (req, res) => {
    const token = process.env.GITHUB_TOKEN;
    const secret = process.env.DEV_PANEL_SAVE_SECRET;
    const missing = [];
    if (!token) missing.push('GITHUB_TOKEN');
    if (!secret) missing.push('DEV_PANEL_SAVE_SECRET');
    if (missing.length) return send(res, 500, { ok: false, error: `Server not configured - missing: ${missing.join(', ')}` });
    if (req.headers['x-dev-panel-secret'] !== secret) return send(res, 401, { ok: false, error: 'Unauthorized' });

    const gh = github(process.env.GITHUB_REPO || DEFAULT_REPO, process.env.GITHUB_BRANCH || DEFAULT_BRANCH, token);
    try {
        if (req.method === 'GET') {
            const q = req.query || {};
            if (q.action === 'list') {
                const index = await gh.readJson(`${ROOT}/index.json`);
                return send(res, 200, { ok: true, projects: (index && index.projects) || [] });
            }
            if (q.action === 'manifest') {
                if (!validId(q.id)) return send(res, 400, { ok: false, error: 'bad id' });
                const manifest = await gh.readJson(`${ROOT}/${q.id}/manifest.json`);
                if (!manifest) return send(res, 404, { ok: false, error: 'not found' });
                return send(res, 200, { ok: true, manifest });
            }
            if (q.action === 'blob') {
                if (!/^[0-9a-f]{40}$/.test(q.sha || '')) return send(res, 400, { ok: false, error: 'bad sha' });
                const b = await gh.api(`/git/blobs/${q.sha}`);
                return send(res, 200, { ok: true, contentBase64: String(b.content || '').replace(/\n/g, '') });
            }
            return send(res, 400, { ok: false, error: 'unknown action' });
        }
        if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'Method not allowed' });
        const body = req.body || {};
        if (body.action === 'blob') {
            const c = String(body.contentBase64 || '');
            if (!c || c.length > MAX_BLOB_B64 || !/^[A-Za-z0-9+/=]+$/.test(c)) return send(res, 400, { ok: false, error: 'bad or oversized piece' });
            const b = await gh.api('/git/blobs', 'POST', { content: c, encoding: 'base64' });
            return send(res, 200, { ok: true, sha: b.sha });
        }
        if (body.action === 'commit') {
            const { id, manifest, files, indexEntry } = body;
            if (!validId(id) || !manifest || !Array.isArray(files) || !indexEntry) return send(res, 400, { ok: false, error: 'bad commit request' });
            for (const f of files) {
                if (!/^[0-9a-f]{40}$/.test(f.sha || '') || !safeRelPath(f.path)) return send(res, 400, { ok: false, error: 'bad file entry' });
            }
            const index = (await gh.readJson(`${ROOT}/index.json`)) || { projects: [] };
            index.projects = [indexEntry, ...index.projects.filter(p => p.id !== id)];
            const tree = [
                ...files.map(f => ({ path: `${ROOT}/${id}/${f.path}`, mode: '100644', type: 'blob', sha: f.sha })),
                { path: `${ROOT}/${id}/manifest.json`, mode: '100644', type: 'blob', content: JSON.stringify(manifest, null, 2) + '\n' },
                { path: `${ROOT}/index.json`, mode: '100644', type: 'blob', content: JSON.stringify(index, null, 2) + '\n' },
            ];
            const sha = await gh.commitTree(tree, `Save lenticular project "${String(indexEntry.name || id).slice(0, 60)}"`);
            return send(res, 200, { ok: true, commitSha: sha });
        }
        if (body.action === 'delete') {
            if (!validId(body.id)) return send(res, 400, { ok: false, error: 'bad id' });
            const paths = await gh.listTreePaths(`${ROOT}/${body.id}/`);
            const index = (await gh.readJson(`${ROOT}/index.json`)) || { projects: [] };
            index.projects = index.projects.filter(p => p.id !== body.id);
            const tree = [
                ...paths.map(p => ({ path: p, mode: '100644', type: 'blob', sha: null })),
                { path: `${ROOT}/index.json`, mode: '100644', type: 'blob', content: JSON.stringify(index, null, 2) + '\n' },
            ];
            const sha = await gh.commitTree(tree, `Delete lenticular project ${body.id}`);
            return send(res, 200, { ok: true, commitSha: sha, removed: paths.length });
        }
        return send(res, 400, { ok: false, error: 'unknown action' });
    } catch (err) {
        return send(res, 502, { ok: false, error: String((err && err.message) || err) });
    }
};

function send(res, code, obj) { res.status(code).json(obj); }
function validId(id) { return typeof id === 'string' && /^[a-z0-9-]{4,64}$/.test(id); }
function safeRelPath(p) { return typeof p === 'string' && /^[A-Za-z0-9._\-/]{1,160}$/.test(p) && !p.includes('..') && !p.startsWith('/'); }

function github(repo, branch, token) {
    const base = `https://api.github.com/repos/${repo}`;
    const headers = {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
    };
    async function api(path, method = 'GET', body) {
        const r = await fetch(base + path, { method, headers, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' });
        if (r.status === 404 && method === 'GET') return null;
        if (!r.ok) throw new Error(`GitHub ${method} ${path} failed (${r.status}): ${(await r.text()).slice(0, 300)}`);
        return r.json();
    }
    async function headCommit() {
        const ref = await api(`/git/ref/heads/${encodeURIComponent(branch)}`);
        if (!ref) throw new Error(`branch ${branch} not found`);
        const commit = await api(`/git/commits/${ref.object.sha}`);
        return { commitSha: ref.object.sha, treeSha: commit.tree.sha };
    }
    return {
        api,
        async readJson(path) {
            const f = await api(`/contents/${path}?ref=${encodeURIComponent(branch)}`);
            if (!f) return null;
            let text;
            if (f.content) text = Buffer.from(f.content, 'base64').toString('utf-8');
            else {
                const b = await api(`/git/blobs/${f.sha}`); // > 1 MB: Contents API omits content
                text = Buffer.from(b.content, 'base64').toString('utf-8');
            }
            return JSON.parse(text);
        },
        async listTreePaths(prefix) {
            const { treeSha } = await headCommit();
            const t = await api(`/git/trees/${treeSha}?recursive=1`);
            return ((t && t.tree) || []).filter(e => e.type === 'blob' && e.path.startsWith(prefix)).map(e => e.path);
        },
        // One commit for the whole change; retries once if the branch moved
        // (e.g. a settings save landed in between).
        async commitTree(entries, message) {
            for (let attempt = 0; attempt < 2; attempt++) {
                const head = await headCommit();
                const tree = await api('/git/trees', 'POST', { base_tree: head.treeSha, tree: entries });
                const commit = await api('/git/commits', 'POST', { message, tree: tree.sha, parents: [head.commitSha] });
                try {
                    await api(`/git/refs/heads/${encodeURIComponent(branch)}`, 'PATCH', { sha: commit.sha, force: false });
                    return commit.sha;
                } catch (e) {
                    if (attempt === 1 || !/\((409|422)\)/.test(e.message)) throw e;
                }
            }
            throw new Error('unreachable');
        },
    };
}
