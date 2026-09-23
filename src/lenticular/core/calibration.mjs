// ====================================================================
// calibration.mjs — pitch/phase test candidates and sheet layout (pure)
// ====================================================================
// HOW THE PITCH TEST WORKS (and why it is physical, not computed)
// ---------------------------------------------------------------
// Each candidate strip is a 2-frame black/white interlace printed at one
// candidate LPI. Under a lens whose TRUE pitch equals that candidate, every
// lenticule sits over the same black/white split, so the whole strip looks
// one uniform tone that flips black↔white at once as you tilt. Under any
// other pitch the split drifts lenticule by lenticule, so the strip shows
// dark/light BANDS whose count across the strip is
//
//     bands = strip_length_in × |LPI_candidate − LPI_lens|
//
// (the moiré beat between two gratings). The best candidate is the one with
// the fewest/widest bands — ideally none. Only a person looking through the
// real lens can make that observation; the app never infers it.
//
// That relation also sets the test's honest resolution: a strip L inches
// long cannot distinguish two pitches closer than about 1/L LPI, because
// the difference produces less than one band. calibrationResolution()
// reports this, and the UI warns when a refine step is finer than it.
//
// Each strip also carries 1-inch tick marks along its length, so a user can
// COUNT bands and convert that to a pitch error (units.lpiDeltaFromBands).
// ====================================================================

import { lpiResolutionForStrip, mmToIn } from './units.mjs';

/** Number of decimals in a step like 0.1 / 0.01 / 0.005 (for labels). */
export function decimalsOf(step) {
    const s = String(step);
    if (s.includes('e-')) return parseInt(s.split('e-')[1], 10);
    const i = s.indexOf('.');
    return i < 0 ? 0 : s.length - i - 1;
}

/** Round to a fixed number of decimals without binary drift (100.3 not 100.30000000000001). */
export function roundTo(v, decimals) {
    return Number(v.toFixed(Math.min(12, decimals)));
}

/**
 * Candidate LPIs from min to max inclusive in `step` increments. Computed
 * as min + k × step (never by repeated addition), so 99.5 + 10×0.1 is
 * exactly 100.5, not 100.49999999999997.
 */
export function coarseCandidates(minLpi, maxLpi, step) {
    if (!(step > 0)) throw new RangeError('step must be > 0');
    if (!(maxLpi >= minLpi)) throw new RangeError('max must be >= min');
    if (!(minLpi > 0)) throw new RangeError('min must be > 0');
    const d = Math.max(decimalsOf(step), decimalsOf(minLpi));
    const count = Math.floor((maxLpi - minLpi) / step + 1e-9) + 1;
    if (count > 60) throw new RangeError('too many candidates (' + count + ') for one sheet — widen the step or narrow the range');
    const out = [];
    for (let k = 0; k < count; k++) out.push(roundTo(minLpi + k * step, d));
    return out;
}

/** Fine candidates centred on a selected value: centre ± halfRange in `step`. */
export function refineCandidates(center, halfRange, step) {
    const d = Math.max(decimalsOf(step), decimalsOf(center));
    return coarseCandidates(roundTo(center - halfRange, d), roundTo(center + halfRange, d), step);
}

/** Phase candidates 0, 1/K, … (K−1)/K lenticules. */
export function phaseCandidates(count) {
    if (!(count >= 2 && count <= 32)) throw new RangeError('phase count must be 2..32');
    return Array.from({ length: count }, (_, k) => roundTo(k / count, 4));
}

export function formatLpi(v, decimals) { return v.toFixed(decimals); }

/**
 * The finest LPI difference a strip of this length can show as at least
 * one band. Strip length is the sheet extent ALONG the interlace axis.
 */
export function calibrationResolution({ stripLengthIn }) {
    return lpiResolutionForStrip(stripLengthIn);
}

/**
 * Pixel layout of a calibration sheet. Every length is derived from the
 * physical size and DPI; nothing is in screen pixels.
 *   kind: 'pitch' | 'phase'
 * Returns { width, height, header, rulers, strips: [{value, label, rect, labelRect}] }.
 * Vertical lenticules → strips run horizontally (full width), stacked.
 * Horizontal lenticules → strips run vertically (full height), side by side.
 */
export function layoutSheet({ widthMm, heightMm, dpi, orientation, values, decimals }) {
    const W = Math.round(mmToIn(widthMm) * dpi);
    const H = Math.round(mmToIn(heightMm) * dpi);
    const inch = dpi;
    const margin = Math.round(0.15 * inch);
    const headerH = Math.round(0.95 * inch);
    const rulerH = Math.round(1.0 * inch);  // two ruler rows (100 mm, inches) + 50 mm box
    const labelH = Math.round(0.16 * inch);
    const gap = Math.round(0.06 * inch);

    const header = { x: margin, y: margin, w: W - 2 * margin, h: headerH };
    const rulers = { x: margin, y: margin + headerH, w: W - 2 * margin, h: rulerH };
    const area = {
        x: margin,
        y: margin + headerH + rulerH + gap,
        w: W - 2 * margin,
        h: H - (margin + headerH + rulerH + gap) - margin,
    };
    if (area.h < inch * 0.5 || area.w < inch * 1) throw new RangeError('sheet too small for a calibration test');

    const n = values.length;
    const strips = [];
    if (orientation === 'vertical') {
        const slot = (area.h - gap * (n - 1)) / n;
        const stripH = Math.floor(slot - labelH);
        if (stripH < Math.round(0.12 * inch)) throw new RangeError('too many candidates for this sheet height');
        values.forEach((v, k) => {
            const y0 = Math.round(area.y + k * (slot + gap));
            strips.push({
                value: v,
                label: typeof v === 'number' ? v.toFixed(decimals) : String(v),
                labelRect: { x: area.x, y: y0, w: area.w, h: labelH },
                rect: { x: area.x, y: y0 + labelH, w: area.w, h: stripH },
            });
        });
    } else if (orientation === 'horizontal') {
        const slot = (area.w - gap * (n - 1)) / n;
        const stripW = Math.floor(slot);
        if (stripW < Math.round(0.12 * inch)) throw new RangeError('too many candidates for this sheet width');
        values.forEach((v, k) => {
            const x0 = Math.round(area.x + k * (slot + gap));
            strips.push({
                value: v,
                label: typeof v === 'number' ? v.toFixed(decimals) : String(v),
                labelRect: { x: x0, y: area.y, w: stripW, h: labelH },
                rect: { x: x0, y: area.y + labelH, w: stripW, h: area.h - labelH },
            });
        });
    } else {
        throw new RangeError('orientation must be vertical|horizontal');
    }
    const stripLengthPx = orientation === 'vertical' ? area.w : area.h - labelH;
    return { width: W, height: H, header, rulers, area, strips, stripLengthIn: stripLengthPx / dpi };
}
