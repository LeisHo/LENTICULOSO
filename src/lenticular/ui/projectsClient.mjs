// ====================================================================
// projectsClient.mjs — browser side of saved projects (api/projects.js)
// ====================================================================
import { chunkRanges, chunkPath, joinChunks } from '../core/projects.mjs';

const ENDPOINT = '/api/projects';

export function createProjectsClient(secret) {
    const headers = { 'Content-Type': 'application/json', 'x-dev-panel-secret': secret };

    async function call(method, query, body) {
        const url = ENDPOINT + (query ? '?' + new URLSearchParams(query) : '');
        let resp;
        try {
            resp = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' });
        } catch (e) {
            throw new Error('Could not reach the save server (' + e.message + ')');
        }
        const data = await resp.json().catch(() => null);
        if (!resp.ok || !data || !data.ok) {
            const msg = (data && data.error) || `HTTP ${resp.status}`;
            throw new Error(resp.status === 404 && !data ? 'Saved projects need the deployed site (no /api/projects here)' : msg);
        }
        return data;
    }

    /** Upload one Blob as pieces; returns [{path, sha}]. */
    async function uploadFile(blob, prefix, onPiece) {
        const out = [];
        const ranges = chunkRanges(blob.size);
        for (let i = 0; i < ranges.length; i++) {
            const [s, e] = ranges[i];
            const b64 = await blobToBase64(blob.slice(s, e));
            const { sha } = await call('POST', null, { action: 'blob', contentBase64: b64 });
            out.push({ path: chunkPath(prefix, i), sha });
            onPiece && onPiece();
        }
        return out;
    }

    async function downloadFile(chunks, mime, onPiece) {
        const parts = [];
        for (const c of chunks) {
            const { contentBase64 } = await call('GET', { action: 'blob', sha: c.sha });
            parts.push(await base64ToBytes(contentBase64));
            onPiece && onPiece();
        }
        return new Blob([joinChunks(parts)], { type: mime });
    }

    return {
        list: () => call('GET', { action: 'list' }).then(d => d.projects),
        manifest: id => call('GET', { action: 'manifest', id }).then(d => d.manifest),
        commit: (id, manifest, files, indexEntry) => call('POST', null, { action: 'commit', id, manifest, files, indexEntry }),
        remove: id => call('POST', null, { action: 'delete', id }),
        uploadFile,
        downloadFile,
        piecesFor: size => chunkRanges(size).length,
    };
}

function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result).slice(String(r.result).indexOf(',') + 1));
        r.onerror = () => reject(r.error);
        r.readAsDataURL(blob);
    });
}
async function base64ToBytes(b64) {
    const r = await fetch('data:application/octet-stream;base64,' + b64);
    return new Uint8Array(await r.arrayBuffer());
}
