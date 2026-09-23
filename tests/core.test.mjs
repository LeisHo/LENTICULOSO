// Automated tests for the Lenticular Workbench mathematical core.
// Run: node --test tests/   (from the project root)
import test from 'node:test';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

import * as U from '../src/lenticular/core/units.mjs';
import * as I from '../src/lenticular/core/interlace.mjs';
import * as C from '../src/lenticular/core/calibration.mjs';
import * as P from '../src/lenticular/core/profiles.mjs';
import * as E from '../src/lenticular/core/encode.mjs';
import * as K from '../src/lenticular/core/checks.mjs';
import * as T from '../src/lenticular/core/transform.mjs';

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} ≉ ${b}`);

// Solid-colour frame helper: frame k is filled with value COLORS[k].
const COLORS = [[255, 0, 0], [0, 255, 0], [0, 0, 255], [255, 255, 0], [0, 255, 255], [255, 0, 255]];
function solidFrames(w, h, count) {
    return Array.from({ length: count }, (_, k) => {
        const d = new Uint8ClampedArray(w * h * 4);
        for (let i = 0; i < w * h; i++) d.set([...COLORS[k], 255], i * 4);
        return d;
    });
}
function colorIndexAt(out, w, x, y) {
    const o = (y * w + x) * 4;
    return COLORS.findIndex(c => c[0] === out[o] && c[1] === out[o + 1] && c[2] === out[o + 2]);
}

// ---- 1. LPI → physical pitch -------------------------------------------
test('1. LPI → physical pitch', () => {
    near(U.lpiToPitchInches(100), 0.01);
    near(U.lpiToPitchMm(100), 0.254);
    near(U.lpiToPitchInches(100.347), 1 / 100.347);
    assert.throws(() => U.lpiToPitchInches(0));
    assert.throws(() => U.lpiToPitchInches(-5));
});

// ---- 2. DPI + LPI → pixels per lenticule --------------------------------
test('2. DPI + LPI → pixels per lenticule', () => {
    near(U.pixelsPerLenticule(600, 100), 6);
    near(U.pixelsPerLenticule(720, 60), 12);
    near(U.pixelsPerFrameSlot(600, 100, 3), 2);
});

// ---- 3. Fractional LPI handling ------------------------------------------
test('3. fractional LPI is never rounded', () => {
    const ppl = U.pixelsPerLenticule(600, 100.37);
    near(ppl, 600 / 100.37);
    assert.notEqual(ppl, 6);
    // 100.27 and 100.00 give different interlaces over a wide raster
    const w = 3000;
    const a = I.buildAxisMap(w, { ppl: 600 / 100.27, n: 2 });
    const b = I.buildAxisMap(w, { ppl: 600 / 100.0, n: 2 });
    let diff = 0;
    for (let i = 0; i < w; i++) if (a.seqPos[i] !== b.seqPos[i]) diff++;
    assert.ok(diff > 100, 'expected the two pitches to diverge, got ' + diff);
    // Accumulated phase: the lenticule index at the far end matches the
    // exact physical count, not count-of-rounded-lenticules.
    const last = I.buildAxisMap(w, { ppl: 600 / 100.37, n: 2 }).lent[w - 1];
    assert.equal(last, Math.floor((w - 0.5) * 100.37 / 600));
});

// ---- 4 & 5. Output sizes and DPI values -----------------------------------
test('4/5. output sizes and DPI → raster size', () => {
    assert.equal(U.physicalToPixels(6, 600), 3600);
    assert.equal(U.physicalToPixels(4, 600), 2400);
    assert.equal(U.physicalToPixels(6, 720), 4320);
    assert.equal(U.physicalToPixels(U.mmToIn(210), 600), 4961);
    assert.equal(U.physicalToPixels(U.mmToIn(297), 600), 7016);
    assert.equal(U.physicalToPixels(U.mmToIn(210), 300), 2480);
    const g = K.outputGeometry(152.4, 101.6, 600);
    assert.equal(g.widthPx, 3600); assert.equal(g.heightPx, 2400);
    near(g.printedWidthMm, 152.4, 1e-9);
});

// ---- 6. 2-frame interlacing (hand-verifiable) ------------------------------
test('6. 2-frame interlace: 600 DPI / 100 LPI → 3 px per strip, optically inverted', () => {
    const w = 24, h = 2;
    const frames = solidFrames(w, h, 2);
    const out = I.interlaceRGBA({ width: w, height: h, sequence: [0, 1], getFrame: k => frames[k], dpi: 600, lpi: 100, sampling: 'direct' });
    // 6 px per lenticule; slot 0 (left 3 px) holds sequence pos N-1-0 = 1 (frame B)
    const row = Array.from({ length: w }, (_, x) => colorIndexAt(out, w, x, 0));
    assert.deepEqual(row, [1,1,1,0,0,0, 1,1,1,0,0,0, 1,1,1,0,0,0, 1,1,1,0,0,0]);
    // every row identical for vertical lenticules
    const row1 = Array.from({ length: w }, (_, x) => colorIndexAt(out, w, x, 1));
    assert.deepEqual(row1, row);
});

// ---- 7. 3-frame interlacing ------------------------------------------------
test('7. 3-frame interlace: 2 px per strip, order C B A under each lenticule', () => {
    const w = 12, h = 1;
    const frames = solidFrames(w, h, 3);
    const out = I.interlaceRGBA({ width: w, height: h, sequence: [0, 1, 2], getFrame: k => frames[k], dpi: 600, lpi: 100, sampling: 'direct' });
    const row = Array.from({ length: w }, (_, x) => colorIndexAt(out, w, x, 0));
    assert.deepEqual(row, [2,2,1,1,0,0, 2,2,1,1,0,0]);
});

// ---- 8. N-frame -----------------------------------------------------------
test('8. N-frame (N=5, fractional ppl) uses every frame in equal proportion', () => {
    const w = 3000, h = 1;
    const frames = solidFrames(w, h, 5);
    const out = I.interlaceRGBA({ width: w, height: h, sequence: [0,1,2,3,4], getFrame: k => frames[k], dpi: 1200, lpi: 100.37, sampling: 'direct' });
    const counts = [0,0,0,0,0];
    for (let x = 0; x < w; x++) counts[colorIndexAt(out, w, x, 0)]++;
    for (const c of counts) near(c / w, 0.2, 0.01);
    // ping-pong sequence builder
    assert.deepEqual(I.buildSequence([0,1,2], 'pingpong'), [0,1,2,1]);
    assert.deepEqual(I.buildSequence([0,1,2,3,4], 'pingpong'), [0,1,2,3,4,3,2,1]);
    assert.deepEqual(I.buildSequence([0,1], 'pingpong'), [0,1]);
    assert.deepEqual(I.buildSequence([3,1,2], 'loop'), [3,1,2]);
});

// ---- 9 & 10. Orientation ---------------------------------------------------
test('9/10. vertical interlaces along x; horizontal along y', () => {
    const w = 6, h = 6;
    const frames = solidFrames(w, h, 2);
    const v = I.interlaceRGBA({ width: w, height: h, sequence: [0, 1], getFrame: k => frames[k], dpi: 600, lpi: 100, orientation: 'vertical', sampling: 'direct' });
    const hz = I.interlaceRGBA({ width: w, height: h, sequence: [0, 1], getFrame: k => frames[k], dpi: 600, lpi: 100, orientation: 'horizontal', sampling: 'direct' });
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        assert.equal(colorIndexAt(v, w, x, y), x < 3 ? 1 : 0);
        assert.equal(colorIndexAt(hz, w, x, y), y < 3 ? 1 : 0);
    }
});

// ---- 11. Frame reversal ----------------------------------------------------
test('11. reversing the order swaps the strips', () => {
    const w = 12, h = 1;
    const frames = solidFrames(w, h, 3);
    const order = [0, 1, 2];
    const rev = I.reverseOrder(order);
    assert.deepEqual(rev, [2, 1, 0]);
    const a = I.interlaceRGBA({ width: w, height: h, sequence: order, getFrame: k => frames[k], dpi: 600, lpi: 100, sampling: 'direct' });
    const b = I.interlaceRGBA({ width: w, height: h, sequence: rev, getFrame: k => frames[k], dpi: 600, lpi: 100, sampling: 'direct' });
    const ra = Array.from({ length: w }, (_, x) => colorIndexAt(a, w, x, 0));
    const rb = Array.from({ length: w }, (_, x) => colorIndexAt(b, w, x, 0));
    assert.deepEqual(rb, ra.map(k => 2 - k));
});

// ---- 12. Phase ------------------------------------------------------------
test('12. phase shifts the pattern by phase × pitch toward +axis', () => {
    const w = 24;
    const base = I.buildAxisMap(w, { ppl: 6, n: 2, phase: 0 });
    const half = I.buildAxisMap(w, { ppl: 6, n: 2, phase: 0.5 });
    const quarter = I.buildAxisMap(w, { ppl: 6, n: 2, phase: 0.25 });
    // phase 0.5 = one strip (3 px): the pattern is exactly inverted
    for (let i = 0; i < w; i++) assert.equal(half.seqPos[i], 1 - base.seqPos[i]);
    // phase 0.25 = 1.5 px shift right: frame-B strip moves from [0,3) to
    // [1.5,4.5), i.e. pixel centres 1.5, 2.5, 3.5 → pixels 1..3.
    assert.deepEqual(Array.from(quarter.seqPos.slice(0, 12)), [0,1,1,1,0,0,0,1,1,1,0,0]);
    // full lenticule phase = identity
    const full = I.buildAxisMap(w, { ppl: 6, n: 2, phase: 1 });
    assert.deepEqual(Array.from(full.seqPos), Array.from(base.seqPos));
});

test('12b. simulated view reads the generated raster: left→right shows A→B→C', () => {
    const w = 120, h = 4;
    const frames = solidFrames(w, h, 3);
    for (const orientation of ['vertical', 'horizontal']) {
        const W = orientation === 'vertical' ? w : h, H = orientation === 'vertical' ? h : w;
        const fr = solidFrames(W, H, 3);
        const raster = I.interlaceRGBA({ width: W, height: H, sequence: [0, 1, 2], getFrame: k => fr[k], dpi: 600, lpi: 100.37, orientation });
        [[0.1, 0], [0.5, 1], [0.9, 2]].forEach(([pos, expect]) => {
            const view = I.simulateView({ raster, width: W, height: H, dpi: 600, lpi: 100.37, orientation, n: 3, viewPos: pos, outW: W, outH: H });
            let hits = 0;
            for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (colorIndexAt(view, W, x, y) === expect) hits++;
            assert.ok(hits / (W * H) > 0.97, `${orientation} view ${pos}: ${hits}/${W * H}`);
        });
    }
    void frames;
});

test('blend mode: weights sum to 256 and straddling pixels mix', () => {
    const map = I.buildAxisMap(500, { ppl: 600 / 100.37, n: 3, boundary: 'blend' });
    for (let i = 0; i < 500; i++) {
        let s = 0;
        for (let e = map.offsets[i]; e < map.offsets[i + 1]; e++) s += map.w[e];
        assert.equal(s, 256);
    }
    assert.ok(map.seqPos.length > 500, 'some pixels should straddle a slot boundary');
});

test('lenticule sampling: a uniform frame stays uniform; a gradient is box-averaged per lenticule', () => {
    const w = 60, h = 1;
    const grad = new Uint8ClampedArray(w * 4);
    for (let x = 0; x < w; x++) grad.set([x * 4, x * 4, x * 4, 255], x * 4);
    const out = I.interlaceRGBA({ width: w, height: h, sequence: [0, 0], getFrame: () => grad, dpi: 600, lpi: 100, sampling: 'lenticule' });
    // lenticule 0 = px 0..5 → mean of 0,4,..,20 = 10
    for (let x = 0; x < 6; x++) assert.equal(out[x * 4], 10);
    for (let x = 6; x < 12; x++) assert.equal(out[x * 4], 34);
});

// ---- Golden fixtures (detect ANY change to the interlacing algorithm) ------
const FIXTURE = new URL('./fixtures/interlace-golden.json', import.meta.url);
function goldenCases() {
    const cases = {};
    const w = 257, h = 13;
    const frames = Array.from({ length: 4 }, (_, k) => {
        const d = new Uint8ClampedArray(w * h * 4);
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
            const o = (y * w + x) * 4;
            d[o] = (x * 7 + k * 60) & 255; d[o + 1] = (y * 19 + k * 90) & 255; d[o + 2] = ((x ^ y) * 3 + k * 30) & 255; d[o + 3] = 255;
        }
        return d;
    });
    const variants = [
        { sequence: [0, 1], dpi: 600, lpi: 100, orientation: 'vertical', boundary: 'nearest', sampling: 'direct', phase: 0 },
        { sequence: [0, 1, 2], dpi: 600, lpi: 100.37, orientation: 'vertical', boundary: 'nearest', sampling: 'lenticule', phase: 0.3 },
        { sequence: [0, 1, 2, 3], dpi: 720, lpi: 99.83, orientation: 'horizontal', boundary: 'blend', sampling: 'lenticule', phase: 0.125 },
        { sequence: [0, 1, 2, 1], dpi: 1200, lpi: 100.347, orientation: 'vertical', boundary: 'blend', sampling: 'direct', phase: 0 },
    ];
    variants.forEach((v, k) => {
        const out = I.interlaceRGBA({ width: w, height: h, getFrame: i => frames[i], ...v });
        cases['case' + k + ':' + JSON.stringify(v)] = I.fnv1a(out);
    });
    return cases;
}
test('golden fixtures: interlace output is deterministic and unchanged', () => {
    const now = goldenCases();
    assert.deepEqual(goldenCases(), now, 'non-deterministic output');
    if (process.env.UPDATE_GOLDEN || !existsSync(FIXTURE)) {
        writeFileSync(FIXTURE, JSON.stringify(now, null, 2) + '\n');
        return;
    }
    const expected = JSON.parse(readFileSync(FIXTURE, 'utf8'));
    assert.deepEqual(now, expected, 'interlace output changed — if intentional, rerun with UPDATE_GOLDEN=1');
});

// ---- 13. Export dimensions / encoders -------------------------------------
function tinyPng(w, h) {
    const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    const chunk = (type, data) => {
        const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
        const td = Buffer.concat([Buffer.from(type), data]);
        const crc = Buffer.alloc(4); crc.writeUInt32BE(E.crc32(td));
        return Buffer.concat([len, td, crc]);
    };
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
    const raw = Buffer.alloc((w * 3 + 1) * h);
    return new Uint8Array(Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
}
test('13. PNG export carries exact pixel size and pHYs DPI', () => {
    const png = tinyPng(3600, 2);
    const out = E.injectPngPhys(png, 600);
    assert.deepEqual(E.readPngSize(out), { width: 3600, height: 2 });
    const phys = E.readPngPhys(out);
    assert.equal(phys.unit, 1);
    assert.equal(phys.ppmX, 23622);
    near(phys.dpiX, 600, 0.01);
    // chunk order: IHDR, pHYs, IDAT, IEND, and CRCs valid (zlib re-inflates)
    assert.deepEqual(E.pngChunks(out).map(c => c.type), ['IHDR', 'pHYs', 'IDAT', 'IEND']);
    const again = E.injectPngPhys(out, 720);
    assert.equal(E.pngChunks(again).filter(c => c.type === 'pHYs').length, 1);
    near(E.readPngPhys(again).dpiX, 720, 0.02);
});
test('13b. TIFF export: size, resolution, pixel data', () => {
    const w = 5, h = 3;
    const rgba = new Uint8ClampedArray(w * h * 4).map((_, i) => i % 251);
    const tif = E.encodeTiff(rgba, w, h, 600);
    const info = E.readTiffInfo(tif);
    assert.equal(info.width, 5); assert.equal(info.height, 3);
    assert.equal(info.xDpi, 600); assert.equal(info.unit, 2);
    assert.equal(tif[info.dataOffset], rgba[0]);
    assert.equal(tif[info.dataOffset + 3], rgba[4]);
    assert.equal(tif.length, info.dataOffset + w * h * 3);
});

// ---- 14. Profile save/load -------------------------------------------------
test('14. lens + printer profiles: save, load, rename, duplicate, delete, export, import', () => {
    const storage = P.memoryStorage();
    const lenses = P.createProfileStore(storage, 'lw.lenses', P.makeLensProfile, P.validateLens);
    const printers = P.createProfileStore(storage, 'lw.printers', P.makePrinterProfile, P.validatePrinter);

    const lens = lenses.save(P.makeLensProfile({ name: 'My 100 LPI PET Lens', nominalLpi: 100, material: 'PET', thicknessUm: 450 }));
    assert.equal(lens.effectiveLpi, null, 'nominal must not be copied into effective');
    assert.equal(lens.calibrationStatus, 'uncalibrated');
    const cal = lenses.save({ ...lens, effectiveLpi: 100.347, calibrationStatus: 'fine' });
    assert.equal(lenses.get(lens.id).effectiveLpi, 100.347);
    assert.equal(cal.nominalLpi, 100);

    lenses.rename(lens.id, 'Renamed');
    assert.equal(lenses.get(lens.id).name, 'Renamed');
    const dup = lenses.duplicate(lens.id);
    assert.notEqual(dup.id, lens.id);
    assert.equal(lenses.list().length, 2);

    const json = lenses.exportJSON(lens.id);
    const imported = lenses.importJSON(json); // id clash → new id, never overwrite
    assert.notEqual(imported.id, lens.id);
    assert.equal(imported.effectiveLpi, 100.347);
    assert.equal(lenses.list().length, 3);
    assert.throws(() => printers.importJSON(json), /lens profile/);

    assert.ok(lenses.remove(dup.id));
    assert.equal(lenses.list().length, 2);

    const pr = printers.save(P.makePrinterProfile({ name: 'Inkjet', dpi: 720 }));
    assert.equal(printers.get(pr.id).dpi, 720);
    // separate entities, separate keys
    assert.equal(JSON.parse(storage.getItem('lw.printers')).length, 1);
    assert.throws(() => lenses.save({ ...lens, phase: 1.5 }), /Phase/);
});

// ---- 15. Calibration value persistence ------------------------------------
test('15. calibration state persists and candidates are exact decimals', () => {
    const storage = P.memoryStorage();
    const s0 = P.loadCalibrationState(storage, 'lw.cal');
    assert.equal(s0.nominalLpi, 100); assert.equal(s0.minLpi, 99.5); assert.equal(s0.maxLpi, 100.5); assert.equal(s0.coarseStep, 0.1);
    P.saveCalibrationState(storage, 'lw.cal', { ...s0, coarseSelected: 100.3, fineSelected: 100.347 });
    const s1 = P.loadCalibrationState(storage, 'lw.cal');
    assert.equal(s1.coarseSelected, 100.3); assert.equal(s1.fineSelected, 100.347);

    const coarse = C.coarseCandidates(99.5, 100.5, 0.1);
    assert.equal(coarse.length, 11);
    assert.equal(coarse[0], 99.5); assert.equal(coarse[10], 100.5); assert.equal(coarse[8], 100.3);
    const fine = C.refineCandidates(100.3, 0.1, 0.01);
    assert.equal(fine.length, 21);
    assert.equal(fine[0], 100.2); assert.equal(fine[20], 100.4); assert.equal(fine[7], 100.27);
    const finer = C.refineCandidates(100.34, 0.01, 0.001);
    assert.ok(finer.includes(100.347));
    assert.deepEqual(C.phaseCandidates(4), [0, 0.25, 0.5, 0.75]);
});

test('calibration sheet layout + resolution honesty', () => {
    const lay = C.layoutSheet({ widthMm: 190, heightMm: 277, dpi: 600, orientation: 'vertical', values: C.coarseCandidates(99.5, 100.5, 0.1), decimals: 1 });
    assert.equal(lay.width, 4488); assert.equal(lay.height, 6543);
    assert.equal(lay.strips.length, 11);
    for (const s of lay.strips) assert.equal(s.rect.w, lay.area.w);
    near(C.calibrationResolution({ stripLengthIn: lay.stripLengthIn }), 1 / lay.stripLengthIn);
    near(U.bandsForMismatch(10, 0.1), 1);
    near(U.lpiDeltaFromBands(2, 8), 0.25);
    const lh = C.layoutSheet({ widthMm: 190, heightMm: 277, dpi: 600, orientation: 'horizontal', values: [1, 2, 3], decimals: 0 });
    for (const s of lh.strips) assert.ok(s.rect.h > s.rect.w);
    // pattern fill on a sheet buffer shares the sheet's lens origin
    const buf = new Uint8ClampedArray(20 * 2 * 4);
    I.fillInterlacedRect(buf, 20, { x: 2, y: 0, w: 12, h: 2 }, { dpi: 600, lpi: 100, colors: [[0, 0, 0], [255, 255, 255]] });
    // absolute px 2 is in slot 0 → seqPos 1 → white; px 3..5 black (slot1→pos0)
    assert.equal(buf[2 * 4], 255); assert.equal(buf[3 * 4], 0); assert.equal(buf[6 * 4], 255);
});

test('checks: flags uncalibrated lens, too many frames, orientation mismatch', () => {
    const base = { lpi: 100, dpi: 600, widthMm: 152.4, heightMm: 101.6, frameCount: 2, lensCalibrated: true };
    assert.equal(K.checkCreateSettings(base).filter(c => c.level !== 'info').length, 0);
    assert.ok(K.checkCreateSettings({ ...base, lensCalibrated: false }).some(c => c.level === 'warn'));
    assert.ok(K.checkCreateSettings({ ...base, frameCount: 7 }).some(c => c.level === 'error'));
    assert.ok(K.checkCreateSettings({ ...base, lensOrientation: 'horizontal', orientation: 'vertical' }).some(c => /lenticules/.test(c.msg)));
});

test('transform: cover fit centres the image; offsets are fractions of output', () => {
    const t = T.cloneTransform();
    const m = T.frameMatrix(1000, 500, 600, 400, t);
    // cover: scale = max(0.6, 0.8) = 0.8 → source centre maps to output centre
    const [cx, cy] = T.applyMatrix(m, 500, 250);
    near(cx, 300); near(cy, 200);
    near(m[0], 0.8);
    const m2 = T.frameMatrix(1000, 500, 600, 400, { ...t, x: 0.1, flipH: true, rotation: 90 });
    const [cx2, cy2] = T.applyMatrix(m2, 500, 250);
    near(cx2, 360); near(cy2, 200);
});
