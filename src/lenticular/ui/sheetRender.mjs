// ====================================================================
// sheetRender.mjs — draws a calibration sheet at full print resolution
// ====================================================================
// The pattern strips are written as exact pixels by the pure core
// (fillInterlacedRect); text, rulers and marks are drawn with Canvas 2D on
// top, with every length computed from DPI (never CSS/screen pixels).
// ====================================================================

import { layoutSheet } from '../core/calibration.mjs';
import { fillInterlacedRect } from '../core/interlace.mjs';
import { lpiToPitchMm } from '../core/units.mjs';
import { makeCanvas } from './dom.mjs';

const BLACK = [0, 0, 0];
const WHITE = [255, 255, 255];

/**
 * opts: { kind:'pitch'|'phase', values, decimals, widthMm, heightMm, dpi,
 *         orientation, lpi (phase sheets), title, printerName, boundary }
 * Returns { canvas, layout }.
 */
export function renderCalibrationSheet(opts) {
    const { kind, values, decimals, widthMm, heightMm, dpi, orientation } = opts;
    const layout = layoutSheet({ widthMm, heightMm, dpi, orientation, values, decimals });
    const { width: W, height: H } = layout;
    const canvas = makeCanvas(W, H);
    const ctx = canvas.getContext('2d', { willReadFrequently: false });
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, W, H);

    // 1. Pattern strips — exact pixels. One ImageData per strip keeps the
    // peak memory at one strip, not the whole sheet.
    for (const s of layout.strips) {
        const { x, y, w, h } = s.rect;
        const img = ctx.createImageData(w, h);
        // The strip keeps the SHEET's lens origin: its absolute position
        // along the interlace axis is passed through, so every strip on
        // the sheet shares one registration.
        const along = orientation === 'vertical' ? x : y;
        fillStrip(img.data, w, h, along, orientation, {
            dpi,
            lpi: kind === 'phase' ? opts.lpi : s.value,
            phase: kind === 'phase' ? s.value : 0,
            boundary: opts.boundary || 'nearest',
        });
        ctx.putImageData(img, x, y);
    }

    const pt = p => (p / 72) * dpi;              // points → print pixels
    const mm = v => (v / 25.4) * dpi;            // mm → print pixels
    const line = Math.max(1, Math.round(dpi / 300));

    // 2. Header
    const hd = layout.header;
    ctx.fillStyle = '#000';
    ctx.textBaseline = 'top';
    ctx.font = `bold ${pt(13)}px sans-serif`;
    ctx.fillText(opts.title || (kind === 'phase' ? 'Lenticular PHASE test' : 'Lenticular PITCH test'), hd.x, hd.y);
    ctx.fillStyle = '#b00000';
    ctx.font = `bold ${pt(9.5)}px sans-serif`;
    ctx.fillText('PRINT AT 100% / ACTUAL SIZE. DISABLE FIT-TO-PAGE AND AUTOMATIC SCALING.', hd.x, hd.y + pt(17));
    ctx.fillStyle = '#000';
    ctx.font = `${pt(7.5)}px sans-serif`;
    const res = 1 / layout.stripLengthIn;
    const info = [
        `Raster ${W} × ${H} px @ ${dpi} DPI = ${widthMm} × ${heightMm} mm · lenticules ${orientation} · generated ${new Date().toISOString().slice(0, 16).replace('T', ' ')}` +
            (opts.printerName ? ` · printed with: ${opts.printerName}` : ''),
        kind === 'phase'
            ? `Phase test at ${opts.lpi} LPI (pitch ${lpiToPitchMm(opts.lpi).toFixed(4)} mm). Align the lens against the paper's reference corner, look STRAIGHT ON, pick the strip that looks most solid BLACK.`
            : `Each strip = black/white pattern at the LPI shown. Correct pitch: the strip flips uniformly black↔white as you tilt, with no bands. Wrong pitch: dark/light bands along the strip.`,
        kind === 'phase'
            ? 'Only meaningful if you will place the lens the same way on your real prints.'
            : `Strip length ${layout.stripLengthIn.toFixed(2)} in → bands = length × |LPI error|; 1 band ≈ ${res.toFixed(3)} LPI error. Ticks along each strip mark inches (for counting bands). View from your intended viewing distance.`,
    ];
    info.forEach((t, k) => ctx.fillText(t, hd.x, hd.y + pt(31) + k * pt(10), hd.w));

    // 3. Rulers and physical references
    const r = layout.rulers;
    const ry = r.y + pt(6);
    const sqX = r.x + r.w - mm(52);                   // 50 mm box, right-aligned
    drawMmRuler(ctx, r.x, ry, 100, mm, pt, line);      // row 1
    // row 2: as many whole inches as fit left of the alignment guide (≤ 4)
    const inchRoomPx = sqX - mm(26) - r.x;
    drawInchRuler(ctx, r.x, ry + mm(11), Math.max(1, Math.min(4, Math.floor(inchRoomPx / dpi))), dpi, pt, line);
    // 50 mm reference box (outer width). Kept inside the ruler band: 50 × ~18 mm.
    ctx.lineWidth = line;
    ctx.strokeStyle = '#000';
    const boxH = Math.min(r.h - pt(16), mm(18));
    ctx.strokeRect(sqX + line / 2, ry + line / 2, mm(50) - line, boxH);
    ctx.font = `${pt(7)}px sans-serif`;
    ctx.fillText('50 mm (outer edge)', sqX + mm(2), ry + boxH / 2 - pt(3.5));
    // lens alignment guide parallel to the ridges
    ctx.fillRect(orientation === 'vertical' ? sqX - mm(8) : sqX - mm(40), orientation === 'vertical' ? ry : ry + boxH + pt(3),
        orientation === 'vertical' ? line * 2 : mm(30), orientation === 'vertical' ? boxH : line * 2);
    ctx.font = `${pt(6)}px sans-serif`;
    ctx.fillText('align ridges ∥', orientation === 'vertical' ? sqX - mm(24) : sqX - mm(40), orientation === 'vertical' ? ry + boxH + pt(2) : ry + boxH + pt(6));

    // 4. Strip labels + inch ticks
    for (let k = 0; k < layout.strips.length; k++) {
        const s = layout.strips[k];
        const lr = s.labelRect;
        const text = kind === 'phase'
            ? `#${k + 1}  phase ${s.label}  (${(s.value * lpiToPitchMm(opts.lpi)).toFixed(4)} mm)`
            : `#${k + 1}  ${s.label} LPI`;
        let size = pt(7.5);
        ctx.font = `bold ${size}px sans-serif`;
        const maxW = orientation === 'vertical' ? lr.w * 0.5 : lr.w - line * 2;
        const tw = ctx.measureText(orientation === 'vertical' ? text : s.label).width;
        if (tw > maxW) { size *= maxW / tw; ctx.font = `bold ${size}px sans-serif`; }
        ctx.fillStyle = '#000';
        ctx.fillText(orientation === 'vertical' ? text : s.label, lr.x + line, lr.y + Math.max(0, (lr.h - size) / 2));
        if (orientation === 'vertical') {
            // inch ticks along the strip's length, in the label band's right half
            ctx.font = `${pt(5)}px sans-serif`;
            for (let i = 1; i * dpi < s.rect.w; i++) {
                const x = s.rect.x + Math.round(i * dpi);
                ctx.fillRect(x, lr.y + lr.h * 0.45, line, lr.h * 0.55);
                if (x > lr.x + lr.w * 0.5) ctx.fillText(String(i), x + line * 2, lr.y + line);
            }
        }
    }
    return { canvas, layout };
}

function fillStrip(buf, w, h, axisOffset, orientation, { dpi, lpi, phase, boundary }) {
    // The pattern is constant across the cross axis, so compute ONE line
    // (indexed by absolute axis position) and replicate it. A 1-pixel-wide
    // buffer makes the horizontal case the same linear layout.
    const vertical = orientation === 'vertical';
    const axisLen = vertical ? w : h;
    const line = new Uint8ClampedArray((axisOffset + axisLen) * 4);
    fillInterlacedRect(line, vertical ? axisOffset + axisLen : 1,
        vertical ? { x: axisOffset, y: 0, w: axisLen, h: 1 } : { x: 0, y: axisOffset, w: 1, h: axisLen },
        { dpi, lpi, phase, orientation, boundary, colors: [BLACK, WHITE] });
    for (let c = 0; c < (vertical ? h : w); c++) {
        for (let a = 0; a < axisLen; a++) {
            const src = (axisOffset + a) * 4;
            const x = vertical ? a : c;
            const y = vertical ? c : a;
            const o = (y * w + x) * 4;
            buf[o] = line[src]; buf[o + 1] = line[src + 1]; buf[o + 2] = line[src + 2]; buf[o + 3] = 255;
        }
    }
}

function drawMmRuler(ctx, x0, y0, lengthMm, mm, pt, line) {
    ctx.fillStyle = '#000';
    ctx.fillRect(x0, y0, Math.round(mm(lengthMm)) + line, line);
    ctx.font = `${pt(6)}px sans-serif`;
    for (let i = 0; i <= lengthMm; i++) {
        const x = x0 + Math.round(mm(i));
        const len = i % 10 === 0 ? mm(5) : i % 5 === 0 ? mm(3.5) : mm(2);
        ctx.fillRect(x, y0, line, len);
        if (i % 10 === 0) ctx.fillText(String(i), x + line * 2, y0 + mm(3.2));
    }
    ctx.font = `bold ${pt(7)}px sans-serif`;
    ctx.fillText(`${lengthMm} mm — measure 0 → ${lengthMm}`, x0, y0 + mm(7));
}

function drawInchRuler(ctx, x0, y0, inches, dpi, pt, line) {
    if (inches < 1) inches = 1;
    ctx.fillStyle = '#000';
    ctx.fillRect(x0, y0, Math.round(inches * dpi) + line, line);
    ctx.font = `${pt(6)}px sans-serif`;
    for (let i = 0; i <= inches * 10; i++) {
        const x = x0 + Math.round((i / 10) * dpi);
        const len = i % 10 === 0 ? dpi * 0.2 : i % 5 === 0 ? dpi * 0.14 : dpi * 0.08;
        ctx.fillRect(x, y0, line, len);
        if (i % 10 === 0) ctx.fillText(i / 10 + ' in', x + line * 2, y0 + dpi * 0.13);
    }
    ctx.font = `bold ${pt(7)}px sans-serif`;
    ctx.fillText(`${inches} in (tenths)`, x0, y0 + dpi * 0.28);
}
