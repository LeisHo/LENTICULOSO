// ====================================================================
// encode.mjs — print-file encoders (pure)
// ====================================================================
// PNG: the browser's canvas.toBlob('image/png') writes a correct PNG but
// with NO physical resolution, so most applications assume 72 or 96 DPI
// and print it the wrong size. injectPngPhys() inserts a pHYs chunk
// (pixels per metre, unit = metre) right after IHDR so print software
// that honours embedded resolution prints it at the intended size.
//
// TIFF: an uncompressed baseline RGB TIFF with XResolution/YResolution in
// pixels per inch — the most universally accepted print raster. Large
// (3 bytes/pixel) but lossless and unambiguous.
// ====================================================================

import { dpiToPixelsPerMetre } from './units.mjs';

const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        t[n] = c >>> 0;
    }
    return t;
})();

export function crc32(bytes, start = 0, end = bytes.length) {
    let c = 0xffffffff;
    for (let i = start; i < end; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
}

const PNG_SIG = [137, 80, 78, 71, 13, 10, 26, 10];

/** Walk PNG chunks → [{type, offset, length}] (offset = start of the length field). */
export function pngChunks(bytes) {
    for (let i = 0; i < 8; i++) if (bytes[i] !== PNG_SIG[i]) throw new Error('not a PNG');
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const out = [];
    let p = 8;
    while (p < bytes.length) {
        const len = dv.getUint32(p);
        const type = String.fromCharCode(bytes[p + 4], bytes[p + 5], bytes[p + 6], bytes[p + 7]);
        out.push({ type, offset: p, length: len });
        p += 12 + len;
        if (type === 'IEND') break;
    }
    return out;
}

/** Return a new PNG byte array carrying a pHYs chunk for `dpi` (replacing any existing one). */
export function injectPngPhys(bytes, dpi) {
    const chunks = pngChunks(bytes);
    const ihdr = chunks.find(c => c.type === 'IHDR');
    if (!ihdr) throw new Error('PNG has no IHDR');
    const ppm = dpiToPixelsPerMetre(dpi);
    const phys = new Uint8Array(12 + 9);
    const dv = new DataView(phys.buffer);
    dv.setUint32(0, 9);
    phys.set([0x70, 0x48, 0x59, 0x73], 4); // 'pHYs'
    dv.setUint32(8, ppm);
    dv.setUint32(12, ppm);
    phys[16] = 1; // unit: metre
    dv.setUint32(17, crc32(phys, 4, 17));

    const parts = [];
    const ihdrEnd = ihdr.offset + 12 + ihdr.length;
    parts.push(bytes.subarray(0, ihdrEnd), phys);
    // copy the rest, skipping any pre-existing pHYs
    for (const c of chunks) {
        if (c.offset < ihdrEnd || c.type === 'pHYs') continue;
        parts.push(bytes.subarray(c.offset, c.offset + 12 + c.length));
    }
    const total = parts.reduce((s, a) => s + a.length, 0);
    const out = new Uint8Array(total);
    let o = 0;
    for (const a of parts) { out.set(a, o); o += a.length; }
    return out;
}

/** Read back pHYs as {ppmX, ppmY, unit, dpiX, dpiY} or null. */
export function readPngPhys(bytes) {
    const c = pngChunks(bytes).find(x => x.type === 'pHYs');
    if (!c) return null;
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const ppmX = dv.getUint32(c.offset + 8);
    const ppmY = dv.getUint32(c.offset + 12);
    const unit = bytes[c.offset + 16];
    return { ppmX, ppmY, unit, dpiX: ppmX * 0.0254, dpiY: ppmY * 0.0254 };
}

/** PNG IHDR width/height. */
export function readPngSize(bytes) {
    const c = pngChunks(bytes).find(x => x.type === 'IHDR');
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return { width: dv.getUint32(c.offset + 8), height: dv.getUint32(c.offset + 12) };
}

/**
 * Baseline uncompressed RGB TIFF (little-endian). rgba: Uint8ClampedArray.
 * DPI is written as a RATIONAL; fractional DPI is kept to 1/1000.
 */
export function encodeTiff(rgba, width, height, dpi) {
    const pixelBytes = width * height * 3;
    const entries = 12;
    const ifdOffset = 8;
    const ifdSize = 2 + entries * 12 + 4;
    const bpsOffset = ifdOffset + ifdSize;          // 3 × SHORT
    const xresOffset = bpsOffset + 6;               // RATIONAL
    const yresOffset = xresOffset + 8;              // RATIONAL
    const dataOffset = yresOffset + 8;
    const buf = new Uint8Array(dataOffset + pixelBytes);
    const dv = new DataView(buf.buffer);
    buf[0] = 0x49; buf[1] = 0x49; dv.setUint16(2, 42, true); dv.setUint32(4, ifdOffset, true);

    let p = ifdOffset;
    dv.setUint16(p, entries, true); p += 2;
    const tag = (id, type, count, value) => {
        dv.setUint16(p, id, true); dv.setUint16(p + 2, type, true); dv.setUint32(p + 4, count, true);
        if (type === 3 && count === 1) dv.setUint16(p + 8, value, true); else dv.setUint32(p + 8, value, true);
        p += 12;
    };
    const SHORT = 3, LONG = 4, RATIONAL = 5;
    tag(256, LONG, 1, width);               // ImageWidth
    tag(257, LONG, 1, height);              // ImageLength
    tag(258, SHORT, 3, bpsOffset);          // BitsPerSample → 8,8,8
    tag(259, SHORT, 1, 1);                  // Compression: none
    tag(262, SHORT, 1, 2);                  // Photometric: RGB
    tag(273, LONG, 1, dataOffset);          // StripOffsets
    tag(277, SHORT, 1, 3);                  // SamplesPerPixel
    tag(278, LONG, 1, height);              // RowsPerStrip
    tag(279, LONG, 1, pixelBytes);          // StripByteCounts
    tag(282, RATIONAL, 1, xresOffset);      // XResolution
    tag(283, RATIONAL, 1, yresOffset);      // YResolution
    tag(296, SHORT, 1, 2);                  // ResolutionUnit: inch
    dv.setUint32(p, 0, true);               // no next IFD

    dv.setUint16(bpsOffset, 8, true); dv.setUint16(bpsOffset + 2, 8, true); dv.setUint16(bpsOffset + 4, 8, true);
    const num = Math.round(dpi * 1000);
    dv.setUint32(xresOffset, num, true); dv.setUint32(xresOffset + 4, 1000, true);
    dv.setUint32(yresOffset, num, true); dv.setUint32(yresOffset + 4, 1000, true);

    for (let i = 0, o = dataOffset; i < width * height; i++, o += 3) {
        buf[o] = rgba[i * 4]; buf[o + 1] = rgba[i * 4 + 1]; buf[o + 2] = rgba[i * 4 + 2];
    }
    return buf;
}

/** Minimal TIFF reader for the fields encodeTiff writes (tests / self-check). */
export function readTiffInfo(bytes) {
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (bytes[0] !== 0x49 || dv.getUint16(2, true) !== 42) throw new Error('not a little-endian TIFF');
    const ifd = dv.getUint32(4, true);
    const n = dv.getUint16(ifd, true);
    const info = {};
    for (let k = 0; k < n; k++) {
        const p = ifd + 2 + k * 12;
        const id = dv.getUint16(p, true), type = dv.getUint16(p + 2, true);
        const val = type === 3 ? dv.getUint16(p + 8, true) : dv.getUint32(p + 8, true);
        if (type === 5) info[id] = dv.getUint32(val, true) / dv.getUint32(val + 4, true);
        else info[id] = val;
    }
    return { width: info[256], height: info[257], xDpi: info[282], yDpi: info[283], unit: info[296], dataOffset: info[273] };
}
