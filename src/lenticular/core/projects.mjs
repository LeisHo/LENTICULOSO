// ====================================================================
// projects.mjs — saved-project helpers (pure): chunking, ids, manifests
// ====================================================================
// A saved project = the generated PNG + every source image (original
// bytes) + the settings that produced it. Files are split into pieces so
// every request stays under Vercel's 4.5 MB function limit (see
// api/projects.js).
// ====================================================================

export const CHUNK_BYTES = 2500000;           // raw bytes per piece (≈3.33 MB as base64)
export const PROJECT_VERSION = 1;

/** [start, end) byte ranges covering `size` in pieces of `chunk` bytes. */
export function chunkRanges(size, chunk = CHUNK_BYTES) {
    if (!(size >= 0)) throw new RangeError('size must be >= 0');
    if (!(chunk > 0)) throw new RangeError('chunk must be > 0');
    const out = [];
    for (let s = 0; s < size; s += chunk) out.push([s, Math.min(size, s + chunk)]);
    if (size === 0) out.push([0, 0]);
    return out;
}

export function chunkPath(prefix, i) { return `${prefix}.${String(i).padStart(3, '0')}`; }

export function projectId(name, nowMs = Date.now()) {
    const slug = String(name || 'project').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'project';
    return `${slug}-${nowMs.toString(36)}`;
}

/** Concatenate decoded pieces back into one byte array. */
export function joinChunks(parts) {
    const total = parts.reduce((n, p) => n + p.length, 0);
    const out = new Uint8Array(total);
    let o = 0;
    for (const p of parts) { out.set(p, o); o += p.length; }
    return out;
}

/** Safe file stem for a source image. */
export function sourcePrefix(i, name) {
    const ext = (/\.([a-z0-9]{1,5})$/i.exec(name || '') || [, 'img'])[1].toLowerCase();
    return `source-${String(i).padStart(2, '0')}.${ext}`;
}

export function formatBytes(n) {
    if (n == null) return '';
    if (n < 1024) return `${n} B`;
    if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / 1048576).toFixed(2)} MB`;
}
