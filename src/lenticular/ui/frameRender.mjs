// ====================================================================
// frameRender.mjs — draws one frame into the common output frame
// ====================================================================
// The SAME function draws the small alignment-editor preview and the
// full-resolution export, differing only in output size; placement math
// is the pure frameMatrix() in core/transform.mjs.
// ====================================================================

import { frameMatrix, cropRect } from '../core/transform.mjs';
import { makeCanvas } from './dom.mjs';

/**
 * frame: { kind:'image', bitmap, width, height, transform, background }
 *     or { kind:'test', index, total, label, transform }
 */
export function drawFrame(ctx, frame, outW, outH) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = frame.background || '#ffffff';
    ctx.fillRect(0, 0, outW, outH);
    if (frame.kind === 'test') {
        drawTestFrame(ctx, frame, outW, outH);
    } else {
        const m = frameMatrix(frame.width, frame.height, outW, outH, frame.transform);
        const { sx, sy, sw, sh } = cropRect(frame.width, frame.height, frame.transform.crop);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.setTransform(m[0], m[1], m[2], m[3], m[4], m[5]);
        ctx.drawImage(frame.bitmap, sx, sy, sw, sh, 0, 0, sw, sh);
    }
    ctx.restore();
}

/** Render a frame to RGBA at exactly outW × outH. */
export function renderFrameRGBA(frame, outW, outH) {
    const c = makeCanvas(outW, outH);
    const ctx = c.getContext('2d', { willReadFrequently: true });
    drawFrame(ctx, frame, outW, outH);
    return ctx.getImageData(0, 0, outW, outH).data;
}

// ---- Built-in test frames ---------------------------------------------
const WORDS = ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE', 'TEN', 'ELEVEN', 'TWELVE'];
const HUES = [0, 210, 120, 45, 280, 170, 330, 90, 20, 250, 60, 190];

export function makeTestFrames(count) {
    return Array.from({ length: count }, (_, i) => ({
        kind: 'test',
        index: i,
        total: count,
        label: WORDS[i] || String(i + 1),
        name: `Test ${i + 1} (${WORDS[i] || i + 1})`,
        transform: null,
    }));
}

/**
 * High-contrast, unmistakable per-frame content: frame word + number, an
 * arrow whose direction rotates with the frame, a shape unique to the
 * frame, a progress bar showing i of N, and a border colour per frame.
 * Everything is drawn relative to the output size so it works at any DPI.
 */
function drawTestFrame(ctx, f, W, H) {
    const m = Math.min(W, H);
    const hue = HUES[f.index % HUES.length];
    ctx.fillStyle = `hsl(${hue} 70% 92%)`;
    ctx.fillRect(0, 0, W, H);
    // coarse checkerboard in the frame colour (shows geometry/ghosting)
    const cell = m / 8;
    ctx.fillStyle = `hsl(${hue} 60% 80%)`;
    for (let y = 0; y * cell < H; y++) for (let x = 0; x * cell < W; x++) if ((x + y + f.index) % 2 === 0) ctx.fillRect(x * cell, y * cell, cell, cell);
    // thick border
    ctx.lineWidth = m * 0.03;
    ctx.strokeStyle = `hsl(${hue} 80% 35%)`;
    ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, W - ctx.lineWidth, H - ctx.lineWidth);

    ctx.fillStyle = '#000';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // big word
    let size = m * 0.28;
    ctx.font = `900 ${size}px sans-serif`;
    const maxW = W * 0.8;
    const tw = ctx.measureText(f.label).width;
    if (tw > maxW) { size *= maxW / tw; ctx.font = `900 ${size}px sans-serif`; }
    ctx.fillText(f.label, W / 2, H * 0.42);
    // number
    ctx.font = `700 ${m * 0.12}px sans-serif`;
    ctx.fillText(`${f.index + 1} / ${f.total}`, W / 2, H * 0.62);

    // arrow rotating with the frame
    const ax = W * 0.14, ay = H * 0.2, al = m * 0.1;
    const ang = (f.index / f.total) * Math.PI * 2 - Math.PI / 2;
    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate(ang);
    ctx.fillStyle = `hsl(${hue} 80% 30%)`;
    ctx.beginPath();
    ctx.moveTo(al, 0); ctx.lineTo(-al * 0.4, al * 0.55); ctx.lineTo(-al * 0.1, 0); ctx.lineTo(-al * 0.4, -al * 0.55);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // shape unique per frame: polygon with (3 + index) sides
    const sides = 3 + (f.index % 8);
    const sx = W * 0.86, sy = H * 0.2, sr = m * 0.08;
    ctx.fillStyle = `hsl(${hue} 80% 30%)`;
    ctx.beginPath();
    for (let k = 0; k < sides; k++) {
        const a = (k / sides) * Math.PI * 2 - Math.PI / 2;
        const px = sx + Math.cos(a) * sr, py = sy + Math.sin(a) * sr;
        if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();

    // progress bar: which slot of the sequence this is
    const bw = W * 0.7, bh = m * 0.04, bx = (W - bw) / 2, by = H * 0.8;
    ctx.strokeStyle = '#000';
    ctx.lineWidth = Math.max(1, m * 0.006);
    ctx.strokeRect(bx, by, bw, bh);
    ctx.fillStyle = '#000';
    ctx.fillRect(bx + (bw / f.total) * f.index, by, bw / f.total, bh);
    ctx.textAlign = 'start';
}

/** Load a File into a frame source (ImageBitmap + natural size). */
export async function loadImageFile(file) {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    return { kind: 'image', bitmap, width: bitmap.width, height: bitmap.height, name: file.name };
}
