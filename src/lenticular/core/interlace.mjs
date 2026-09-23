// ====================================================================
// interlace.mjs — the N-frame lenticular interlacing engine (pure)
// ====================================================================
// GEOMETRY (the reasoning the rest of this file implements)
// ---------------------------------------------------------
// Work along the INTERLACE AXIS: x for vertical lenticules (the lens
// ridges run top-to-bottom, so the image changes as you move left/right),
// y for horizontal lenticules. Everything below is 1-D along that axis;
// the other axis is untouched.
//
//   ppl   = DPI / LPI                (raster pixels per lenticule, REAL)
//   pixel i covers the physical interval [i, i+1) px → [i/ppl, (i+1)/ppl)
//   in LENTICULE units (1.0 = one lens pitch).
//
//   lens coordinate  t(i) = (i + 0.5) / ppl − phase
//   lenticule index  L    = floor(t)
//   position in lens u    = t − L                     ∈ [0, 1)
//   slot             s    = floor(u × N)             (N = frames in cycle)
//
// Every pixel's slot is computed from its ABSOLUTE position, never by
// stepping "k pixels per lenticule". That is what preserves the
// accumulated phase over the whole print: at 600 DPI / 100.37 LPI there
// are 5.97788… px per lenticule, and a renderer that rounds to 6 px would
// be off by a whole lenticule after ~270 lenticules (2.7 inches), which is
// exactly the banding the calibration test is designed to reveal. Here the
// only error is sub-pixel quantisation of each slot boundary, which never
// accumulates. (This is the standard "absolute-position" approach used by
// general-purpose interlacers; see docs/INTERLACING_METHOD.md.)
//
// OPTICAL INVERSION. A lenticule is a converging cylindrical lens with the
// print at (roughly) its focal plane. A viewer to the RIGHT of the lens
// normal sees the strip on the LEFT of the lenticule, and vice versa. So
// for a viewer sweeping left→right to see frames in sequence order
// (A→B→C), slot s (counted from the lenticule's left edge) must hold
// sequence position  p = N − 1 − s.  If the physical result still looks
// reversed (the lens is flipped, or you move the print instead of your
// head), the UI's Reverse Frame Order button reverses the sequence.
//
// PHASE. `phase` is in lenticules (0…1): positive phase shifts the whole
// interlaced pattern toward +axis by phase × pitch. It is the registration
// of the pattern relative to the physical ridges, independent of pitch.
//
// BOUNDARY PIXELS. When ppl/N is not an integer, some pixels straddle two
// slots. 'nearest' gives each pixel wholly to the slot containing its
// centre (crisp, no crosstalk, ≤ ½-px boundary error). 'blend' gives it an
// area-weighted mix (exact average position, a little crosstalk).
//
// FRAME SAMPLING. What colour goes into frame f's strip under lenticule L?
// Through the lens that strip is magnified to fill the whole lenticule, so
// each frame is effectively seen at ONE sample per lenticule. 'lenticule'
// (default) uses the frame's mean over lenticule L's pixel span — a box
// pre-filter at the lens's own resolution, which suppresses the aliasing
// shimmer that fine detail otherwise produces. 'direct' copies the frame's
// pixel at the same position (sharper at the edges of the sampling
// footprint, more aliasing). Both are deterministic.
// ====================================================================

import { pixelsPerLenticule } from './units.mjs';

const WEIGHT_ONE = 256; // weights are quantised to 1/256 so blending is exact integer math

/**
 * Build the frame sequence for one lenticule cycle.
 * order: array of source-frame indices in the user's chosen order.
 * 'loop'     → [A, B, C]
 * 'pingpong' → [A, B, C, B]   (the cycle repeats, so the trailing A of
 *                              "A B C B A" is the next lenticule's A)
 */
export function buildSequence(order, mode = 'loop') {
    if (!Array.isArray(order) || order.length < 1) throw new RangeError('need at least 1 frame');
    const seq = order.slice();
    if (mode === 'pingpong' && order.length >= 3) {
        for (let i = order.length - 2; i >= 1; i--) seq.push(order[i]);
    } else if (mode !== 'loop' && mode !== 'pingpong') {
        throw new RangeError('unknown sequence mode ' + mode);
    }
    return seq;
}

export function reverseOrder(order) { return order.slice().reverse(); }

/** Slot (from the lenticule's low edge) → sequence position, with optical inversion. */
export function slotToSequencePos(slot, n) { return n - 1 - slot; }

/**
 * Per-pixel mapping along the interlace axis.
 * Returns CSR arrays: entries for pixel i are [offsets[i], offsets[i+1]),
 * each entry = (seqPos, lenticule, weight/256). Weights of a pixel sum to
 * exactly 256.
 *   start: absolute axis index of this map's pixel 0 (lets a sub-rectangle
 *          share the lens origin of the whole raster).
 */
export function buildAxisMap(axisLen, { ppl, phase = 0, n, boundary = 'nearest', start = 0 }) {
    if (!(ppl > 0)) throw new RangeError('ppl must be > 0');
    if (!(n >= 1)) throw new RangeError('n must be >= 1');
    const offsets = new Int32Array(axisLen + 1);
    const seqPos = [];
    const lent = [];
    const w = [];
    for (let i = 0; i < axisLen; i++) {
        offsets[i] = seqPos.length;
        const abs = start + i;
        if (boundary === 'blend') {
            const a = abs / ppl - phase;
            const b = (abs + 1) / ppl - phase;
            const span = b - a;
            const j0 = Math.floor(a * n);
            const j1 = Math.ceil(b * n) - 1;
            const parts = [];
            for (let j = j0; j <= j1; j++) {
                const lo = Math.max(a, j / n);
                const hi = Math.min(b, (j + 1) / n);
                if (hi > lo) parts.push([j, (hi - lo) / span]);
            }
            // Quantise so the weights sum to exactly WEIGHT_ONE; the
            // remainder goes to the largest part (deterministic).
            let sum = 0, big = 0;
            const q = parts.map(([, f], k) => {
                const v = Math.floor(f * WEIGHT_ONE);
                sum += v;
                if (f > parts[big][1]) big = k;
                return v;
            });
            q[big] += WEIGHT_ONE - sum;
            parts.forEach(([j], k) => {
                if (q[k] <= 0) return;
                const L = Math.floor(j / n);
                const s = j - L * n;
                seqPos.push(slotToSequencePos(s, n));
                lent.push(L);
                w.push(q[k]);
            });
        } else if (boundary === 'nearest') {
            const t = (abs + 0.5) / ppl - phase;
            const L = Math.floor(t);
            let s = Math.floor((t - L) * n);
            if (s >= n) s = n - 1; // float guard
            seqPos.push(slotToSequencePos(s, n));
            lent.push(L);
            w.push(WEIGHT_ONE);
        } else {
            throw new RangeError('unknown boundary mode ' + boundary);
        }
    }
    offsets[axisLen] = seqPos.length;
    return {
        offsets,
        seqPos: Int16Array.from(seqPos),
        lent: Int32Array.from(lent),
        w: Uint16Array.from(w),
    };
}

/** Pixel range [s, e) whose centres fall inside lenticule L (clamped). */
export function lenticulePixelRange(L, ppl, phase, axisLen) {
    let s = Math.ceil((L + phase) * ppl - 0.5);
    let e = Math.ceil((L + 1 + phase) * ppl - 0.5);
    s = Math.max(0, Math.min(axisLen, s));
    e = Math.max(0, Math.min(axisLen, e));
    return [s, e];
}

/**
 * Interlace N frames into one RGBA raster.
 *   width, height : output raster size (every frame is already rendered at
 *                   exactly this size — see ui/frameRender.mjs)
 *   sequence      : array of source-frame indices, one per cycle position
 *   getFrame(k)   : → Uint8ClampedArray RGBA (width*height*4) for source k.
 *                   Called ONCE per distinct k, so a caller can render
 *                   frames one at a time and never hold more than one.
 * Returns Uint8ClampedArray RGBA, alpha 255.
 */
export function interlaceRGBA({
    width, height, sequence, getFrame, dpi, lpi,
    phase = 0, orientation = 'vertical', boundary = 'nearest', sampling = 'lenticule',
}) {
    const n = sequence.length;
    const ppl = pixelsPerLenticule(dpi, lpi);
    const vertical = orientation === 'vertical';
    if (!vertical && orientation !== 'horizontal') throw new RangeError('orientation must be vertical|horizontal');
    const axisLen = vertical ? width : height;
    const crossLen = vertical ? height : width;
    const map = buildAxisMap(axisLen, { ppl, phase, n, boundary });

    // Pixel span of each entry's lenticule, precomputed once (it depends
    // only on the axis position, never on the cross-axis line or frame).
    const ranges = new Array(map.seqPos.length);
    for (let a = 0; a < axisLen; a++) {
        for (let e = map.offsets[a]; e < map.offsets[a + 1]; e++) {
            let [s, t] = lenticulePixelRange(map.lent[e], ppl, phase, axisLen);
            if (t <= s) { s = a; t = a + 1; } // lenticule holds no pixel centre (raster edge / sub-pixel pitch)
            ranges[e] = [s, t];
        }
    }

    // 'nearest' gives every pixel exactly one entry of weight 256, so it
    // writes straight into the output; only 'blend' needs an accumulator
    // (saves width*height*6 bytes — ~210 MB on an A4 sheet at 600 DPI).
    const direct = boundary === 'nearest';
    const out = new Uint8ClampedArray(width * height * 4);
    const acc = direct ? null : new Uint16Array(width * height * 3);
    const distinct = [...new Set(sequence)];

    for (const f of distinct) {
        const data = getFrame(f);
        if (!data || data.length !== width * height * 4) {
            throw new RangeError('frame ' + f + ' has wrong size');
        }
        const takes = new Uint8Array(n);
        sequence.forEach((k, p) => { if (k === f) takes[p] = 1; });

        // Lenticule means for 'lenticule' sampling: per cross-line prefix
        // sums along the axis, then mean over each lenticule's pixel span.
        if (sampling !== 'lenticule' && sampling !== 'direct') throw new RangeError('unknown sampling ' + sampling);
        const useMean = sampling === 'lenticule';
        // One cross-line of prefix sums at a time (O(axisLen) memory, not
        // O(width*height)): any lenticule's mean is then two lookups.
        const pre = useMean ? new Uint32Array((axisLen + 1) * 3) : null;

        for (let c = 0; c < crossLen; c++) {
            if (useMean) {
                let sr = 0, sg = 0, sb = 0;
                for (let a = 0; a < axisLen; a++) {
                    const o = (vertical ? c * width + a : a * width + c) * 4;
                    sr += data[o]; sg += data[o + 1]; sb += data[o + 2];
                    const p = (a + 1) * 3;
                    pre[p] = sr; pre[p + 1] = sg; pre[p + 2] = sb;
                }
            }
            for (let a = 0; a < axisLen; a++) {
                const px = vertical ? c * width + a : a * width + c;
                const q = px * 3;
                for (let e = map.offsets[a]; e < map.offsets[a + 1]; e++) {
                    if (!takes[map.seqPos[e]]) continue;
                    const wt = map.w[e];
                    let r, g, b;
                    if (useMean) {
                        const rg = ranges[e];
                        const s0 = rg[0] * 3, t0 = rg[1] * 3, cnt = rg[1] - rg[0];
                        r = Math.round((pre[t0] - pre[s0]) / cnt);
                        g = Math.round((pre[t0 + 1] - pre[s0 + 1]) / cnt);
                        b = Math.round((pre[t0 + 2] - pre[s0 + 2]) / cnt);
                    } else {
                        const o = px * 4;
                        r = data[o]; g = data[o + 1]; b = data[o + 2];
                    }
                    if (direct) {
                        const o = px * 4;
                        out[o] = r; out[o + 1] = g; out[o + 2] = b; out[o + 3] = 255;
                    } else {
                        acc[q] += r * wt;
                        acc[q + 1] += g * wt;
                        acc[q + 2] += b * wt;
                    }
                }
            }
        }
    }

    if (direct) return out;
    for (let px = 0, q = 0, o = 0; px < width * height; px++, q += 3, o += 4) {
        out[o] = (acc[q] + 128) >> 8;
        out[o + 1] = (acc[q + 1] + 128) >> 8;
        out[o + 2] = (acc[q + 2] + 128) >> 8;
        out[o + 3] = 255;
    }
    return out;
}

/**
 * Fill a rectangle of an RGBA buffer with a solid-colour interlace
 * (one colour per sequence position). Used for calibration patterns.
 * The lens origin is the BUFFER's origin, not the rectangle's, so every
 * strip on a sheet shares one physical registration.
 */
export function fillInterlacedRect(buf, bufW, rect, { dpi, lpi, phase = 0, orientation = 'vertical', boundary = 'nearest', colors }) {
    const n = colors.length;
    const ppl = pixelsPerLenticule(dpi, lpi);
    const vertical = orientation === 'vertical';
    const axisStart = vertical ? rect.x : rect.y;
    const axisLen = vertical ? rect.w : rect.h;
    const map = buildAxisMap(axisLen, { ppl, phase, n, boundary, start: axisStart });
    for (let a = 0; a < axisLen; a++) {
        let r = 0, g = 0, b = 0;
        for (let e = map.offsets[a]; e < map.offsets[a + 1]; e++) {
            const col = colors[map.seqPos[e]];
            r += col[0] * map.w[e]; g += col[1] * map.w[e]; b += col[2] * map.w[e];
        }
        r = (r + 128) >> 8; g = (g + 128) >> 8; b = (b + 128) >> 8;
        const crossLen = vertical ? rect.h : rect.w;
        for (let c = 0; c < crossLen; c++) {
            const x = vertical ? rect.x + a : rect.x + c;
            const y = vertical ? rect.y + c : rect.y + a;
            const o = (y * bufW + x) * 4;
            buf[o] = r; buf[o + 1] = g; buf[o + 2] = b; buf[o + 3] = 255;
        }
    }
}

/**
 * Simulated view through an IDEAL lens of the given pitch, reading the
 * actual interlaced raster (so it verifies what was generated, not the
 * source frames). viewPos ∈ [0,1]: 0 = viewer far left, 1 = far right.
 * snap=true samples the centre of the visible slot (clean frames);
 * snap=false samples continuously (shows transitions / blend crosstalk).
 * This is NOT an optical simulation — no focal error, no crosstalk from
 * lens aberration, no viewing distance.
 */
export function simulateView({ raster, width, height, dpi, lpi, phase = 0, orientation = 'vertical', n, viewPos, outW, outH, snap = true }) {
    const ppl = pixelsPerLenticule(dpi, lpi);
    const vertical = orientation === 'vertical';
    const axisLen = vertical ? width : height;
    let u;
    if (snap) {
        const shownPos = Math.min(n - 1, Math.floor(viewPos * n));   // sequence position the viewer sees
        const slot = n - 1 - shownPos;                                // optical inversion
        u = (slot + 0.5) / n;
    } else {
        u = Math.min(0.999999, Math.max(0, 1 - viewPos));
    }
    const out = new Uint8ClampedArray(outW * outH * 4);
    for (let oy = 0; oy < outH; oy++) {
        const y = Math.min(height - 1, Math.floor((oy + 0.5) * height / outH));
        for (let ox = 0; ox < outW; ox++) {
            const x = Math.min(width - 1, Math.floor((ox + 0.5) * width / outW));
            const a = vertical ? x : y;
            const L = Math.floor((a + 0.5) / ppl - phase);
            let sa = Math.floor((L + u + phase) * ppl);
            sa = Math.max(0, Math.min(axisLen - 1, sa));
            const sx = vertical ? sa : x;
            const sy = vertical ? y : sa;
            const i = (sy * width + sx) * 4;
            const o = (oy * outW + ox) * 4;
            out[o] = raster[i]; out[o + 1] = raster[i + 1]; out[o + 2] = raster[i + 2]; out[o + 3] = 255;
        }
    }
    return out;
}

/** Deterministic 32-bit FNV-1a of a byte array — used by golden-fixture tests. */
export function fnv1a(bytes) {
    let h = 0x811c9dc5;
    for (let i = 0; i < bytes.length; i++) {
        h ^= bytes[i];
        h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(16).padStart(8, '0');
}
