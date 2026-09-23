// ====================================================================
// createView.mjs — the CREATE tab
// ====================================================================
// 1 Lens & printer → 2 Output size → 3 Frames & order → 4 Align →
// 5 Generate (real interlace at print resolution) → 6 Simulated preview →
// 7 Checklist & export (PNG with DPI metadata, TIFF).
// ====================================================================

import { h, add, clear, numberField, selectField, orientationPicker, helpTip, downloadBytes, canvasToPngBytes, toast, nextFrame, makeCanvas, fmt } from './dom.mjs';
import { buildSequence, interlaceRGBA, simulateView } from '../core/interlace.mjs';
import { pixelsPerLenticule, mmToIn, inToMm, lpiToPitchMm, PAPER_SIZES } from '../core/units.mjs';
import { checkCreateSettings, outputGeometry } from '../core/checks.mjs';
import { injectPngPhys, encodeTiff } from '../core/encode.mjs';
import { cloneTransform } from '../core/transform.mjs';
import { drawFrame, renderFrameRGBA, makeTestFrames, loadImageFile } from './frameRender.mjs';
import { printerSelect, paperSelect, suitabilityText } from './pickers.mjs';
import { projectId, sourcePrefix, formatBytes, PROJECT_VERSION } from '../core/projects.mjs';
import { resolvePrinter, resolvePaper, nativeDpiOf, driverSettingFor, printerBrandOf, thicknessUm } from '../core/presets.mjs';

const SIZE_PRESETS = [
    ['6x4l', '6 × 4 in (landscape)', 152.4, 101.6],
    ['4x6p', '4 × 6 in (portrait)', 101.6, 152.4],
    ['7x5l', '7 × 5 in (landscape)', 177.8, 127],
    ['a6l', 'A6 landscape', 148, 105],
    ['a5l', 'A5 landscape', 210, 148],
    ['a5p', 'A5 portrait', 148, 210],
    ['a4p', 'A4 portrait (full sheet)', PAPER_SIZES.A4.widthMm, PAPER_SIZES.A4.heightMm],
    ['a4l', 'A4 landscape (full sheet)', PAPER_SIZES.A4.heightMm, PAPER_SIZES.A4.widthMm],
    ['custom', 'Custom', null, null],
];
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

const DEFAULT_CREATE = {
    lensId: '', printerId: '', paperId: '',
    manualLpi: 100, manualDpi: 600, orientation: 'vertical',
    sizePreset: '6x4l', widthMm: 152.4, heightMm: 101.6, units: 'in',
    sequenceMode: 'loop', boundary: 'nearest', sampling: 'lenticule',
    useProfilePhase: false, headOn: 'middle', phaseShift: 0,
};

export function mountCreate(root, app) {
    const c = { ...DEFAULT_CREATE, manualDpi: app.settings.defaultDpi, ...readJSON(app.storage, 'lw.create') };
    const persist = () => { try { app.storage.setItem('lw.create', JSON.stringify(c)); } catch { /* ignore */ } };
    let frames = [];              // [{id, name, src, transform}]
    let selectedId = null;
    let referenceId = null;
    let ghost = true;
    let blend = 'normal';
    let clipboard = null;
    let result = null;            // {canvas, raster, sig, params}
    let viewPos = 0.5;
    let confirmations = { scale100: false, fit: false, auto: false };
    let nextId = 1;

    // ------------------------------------------------------------- derived
    function params() {
        const lens = c.lensId ? app.lenses.get(c.lensId) : null;
        const printer = resolvePrinter(c.printerId, app.printers);
        const paper = resolvePaper(c.paperId, app.papers);
        const lpi = lens ? (lens.effectiveLpi ?? lens.nominalLpi) : c.manualLpi;
        const dpi = printer ? printer.dpi : c.manualDpi;
        const sequence = frames.length ? buildSequence(frames.map((_, i) => i), c.sequenceMode) : [];
        const n = sequence.length;
        // Phase: optional profile registration (phase-test result φb: the
        // offset at which a 2-frame black strip is centred under the ridge
        // centre) converted so the chosen frame is the straight-on one,
        // plus a manual shift. See docs/INTERLACING_METHOD.md §Phase.
        let phase = 0;
        if (c.useProfilePhase && lens && n) {
            const p = c.headOn === 'first' ? 0 : Math.floor((n - 1) / 2);
            const slot = n - 1 - p;
            const uTarget = (slot + 0.5) / n;
            phase = lens.phase + 0.75 - uTarget;
        }
        phase = ((phase + (Number(c.phaseShift) || 0)) % 1 + 1) % 1;
        return {
            lens, printer, paper, lpi, dpi, sequence, n, phase,
            orientation: c.orientation,
            widthMm: c.widthMm, heightMm: c.heightMm,
            boundary: c.boundary, sampling: c.sampling,
            lensCalibrated: !!(lens && lens.effectiveLpi != null),
        };
    }
    const signature = p => JSON.stringify([p.lpi, p.dpi, p.sequence, p.phase, p.orientation, p.widthMm, p.heightMm, p.boundary, p.sampling, frames.map(f => [f.id, f.transform])]);

    // --------------------------------------------------------- saved projects
    // A saved project = generated PNG + every source image (original bytes)
    // + the Create settings, stored in the git repo (api/projects.js).
    const savedHost = h('div');
    let savedList = null;       // null = not loaded yet
    let savedError = null;
    let busy = null;            // progress text while saving/opening

    async function loadSavedList() {
        if (!app.projects) { savedError = 'Saved projects need the deployed site (git storage).'; renderSaved(); return; }
        try { savedList = await app.projects.list(); savedError = null; }
        catch (e) { savedList = null; savedError = e.message; }
        renderSaved();
    }

    function renderSaved() {
        clear(savedHost);
        const count = savedList ? savedList.length : 0;
        const body = [];
        if (busy) body.push(h('p.busy', busy));
        if (savedError) body.push(h('p.muted', savedError));
        else if (!savedList) body.push(h('p.muted', 'Loading…'));
        else if (!count) body.push(h('p.muted', 'No saved projects yet. Generate an image, then use "Save project" under the export buttons.'));
        else body.push(h('div.saved-grid', savedList.map(p => savedCard(p))));
        const refresh = h('button', { type: 'button' }, 'Refresh');
        refresh.addEventListener('click', () => { savedList = null; renderSaved(); loadSavedList(); });
        savedHost.append(h('details.card.saved-projects', { open: count > 0 || !!busy },
            h('summary', h('h2', `Saved projects${savedList ? ` (${count})` : ''}`)),
            h('p.muted.small', 'Stored in the project\'s GitHub repo: the generated image, its source images and the settings. Open one to continue where you left off.'),
            ...body, h('div.btn-row', refresh)));
    }

    function savedCard(p) {
        const open = h('button.primary', { type: 'button', disabled: !!busy }, 'Open');
        open.addEventListener('click', () => openProject(p));
        const dl = h('button', { type: 'button', disabled: !!busy }, 'Download PNG');
        dl.addEventListener('click', () => downloadSavedOutput(p));
        const del = h('button.danger', { type: 'button', disabled: !!busy }, 'Delete');
        del.addEventListener('click', async () => {
            if (!confirm(`Delete saved project "${p.name}" from the repo? (It stays in git history.)`)) return;
            busy = 'Deleting…'; renderSaved();
            try { await app.projects.remove(p.id); toast(`Deleted "${p.name}"`, 'good'); }
            catch (e) { toast('Delete failed: ' + e.message, 'error'); }
            busy = null; await loadSavedList();
        });
        return h('div.saved-card',
            p.thumbnail ? h('img.saved-thumb', { src: p.thumbnail, alt: '' }) : h('div.saved-thumb'),
            h('div.saved-meta',
                h('strong', p.name),
                h('span.muted.small', `${new Date(p.createdAt).toLocaleString()} · ${p.frameCount} frames · ${p.lpi} LPI · ${p.dpi} DPI`),
                h('span.muted.small', `${p.widthPx} × ${p.heightPx} px · ${formatBytes(p.totalBytes)}`)),
            h('div.btn-row', open, dl, del));
    }

    async function saveProject(name) {
        if (!result || !app.projects) return;
        const p = params();
        const id = projectId(name);
        const q = result.params;
        busy = 'Preparing…'; renderSaved();
        try {
            const outBlob = new Blob([injectPngPhys(await canvasToPngBytes(result.canvas), q.dpi)], { type: 'image/png' });
            const files = [];
            const sources = frames.map((f, i) => f.src.kind === 'image'
                ? { blob: f.src.file, prefix: sourcePrefix(i, f.name), frame: f }
                : { blob: null, frame: f });
            const totalPieces = app.projects.piecesFor(outBlob.size) + sources.reduce((n, s) => n + (s.blob ? app.projects.piecesFor(s.blob.size) : 0), 0);
            let done = 0;
            const tick = () => { done++; busy = `Uploading ${done} / ${totalPieces}…`; renderSaved(); };
            const outChunks = await app.projects.uploadFile(outBlob, 'output.png', tick);
            files.push(...outChunks);
            const frameEntries = [];
            for (const s of sources) {
                if (!s.blob) {
                    frameEntries.push({ kind: 'test', name: s.frame.name, index: s.frame.src.index, total: s.frame.src.total, label: s.frame.src.label });
                    continue;
                }
                const chunks = await app.projects.uploadFile(s.blob, s.prefix, tick);
                files.push(...chunks);
                frameEntries.push({ kind: 'image', name: s.frame.name, mime: s.blob.type || 'application/octet-stream', size: s.blob.size, transform: s.frame.transform, chunks });
            }
            busy = 'Committing…'; renderSaved();
            const totalBytes = outBlob.size + sources.reduce((n, s) => n + (s.blob ? s.blob.size : 0), 0);
            const manifest = {
                version: PROJECT_VERSION, id, name, createdAt: new Date().toISOString(),
                create: { ...c },
                snapshot: {
                    lens: p.lens ? { id: p.lens.id, name: p.lens.name, effectiveLpi: p.lens.effectiveLpi, nominalLpi: p.lens.nominalLpi } : null,
                    printer: p.printer ? { id: p.printer.id, name: p.printer.name, dpi: p.printer.dpi } : null,
                    paper: p.paper ? { id: p.paper.id, name: p.paper.name } : null,
                    lpi: q.lpi, dpi: q.dpi, phase: q.phase, orientation: q.orientation, sequence: q.sequence,
                },
                frames: frameEntries,
                output: { mime: 'image/png', size: outBlob.size, widthPx: q.widthPx, heightPx: q.heightPx, dpi: q.dpi, chunks: outChunks },
            };
            const indexEntry = {
                id, name, createdAt: manifest.createdAt, thumbnail: thumbnailOf(result.canvas),
                frameCount: frames.length, lpi: q.lpi, dpi: q.dpi, widthPx: q.widthPx, heightPx: q.heightPx, totalBytes,
            };
            await app.projects.commit(id, manifest, files, indexEntry);
            toast(`Saved "${name}" to the repo`, 'good');
        } catch (e) {
            toast('Save failed: ' + e.message, 'error');
        }
        busy = null;
        await loadSavedList();
    }

    async function openProject(entry) {
        busy = `Opening "${entry.name}"…`; renderSaved();
        try {
            const m = await app.projects.manifest(entry.id);
            const pieces = m.output.chunks.length + m.frames.reduce((n, f) => n + (f.chunks ? f.chunks.length : 0), 0);
            let done = 0;
            const tick = () => { done++; busy = `Downloading ${done} / ${pieces}…`; renderSaved(); };
            const loaded = [];
            for (const f of m.frames) {
                if (f.kind === 'test') {
                    const src = makeTestFrames(f.total)[f.index];
                    loaded.push({ id: nextId++, name: f.name, src, transform: cloneTransform() });
                    continue;
                }
                const blob = await app.projects.downloadFile(f.chunks, f.mime, tick);
                const file = new File([blob], f.name, { type: f.mime });
                const src = await loadImageFile(file);
                loaded.push({ id: nextId++, name: f.name, src, transform: cloneTransform(f.transform) });
            }
            const outBlob = await app.projects.downloadFile(m.output.chunks, m.output.mime, tick);
            const bmp = await createImageBitmap(outBlob);
            const canvas = makeCanvas(bmp.width, bmp.height);
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            ctx.drawImage(bmp, 0, 0);
            const raster = ctx.getImageData(0, 0, bmp.width, bmp.height).data;
            // restore settings + frames, then attach the saved output as the current result
            Object.assign(c, m.create);
            persist();
            frames = loaded;
            selectedId = frames[0]?.id ?? null;
            referenceId = frames[0]?.id ?? null;
            const p = params();
            const snap = m.snapshot;
            result = {
                canvas, raster, sig: signature(p), fromSaved: m.name,
                params: { ...p, lpi: snap.lpi, dpi: snap.dpi, phase: snap.phase, orientation: snap.orientation, sequence: snap.sequence, n: snap.sequence.length,
                    lens: snap.lens?.name, printer: snap.printer?.name, widthPx: m.output.widthPx, heightPx: m.output.heightPx },
            };
            if (p.lpi !== snap.lpi || p.dpi !== snap.dpi) {
                toast('Opened. Note: your lens/printer profiles changed since this was saved — regenerate before exporting.', 'info');
            } else {
                toast(`Opened "${m.name}"`, 'good');
            }
        } catch (e) {
            toast('Open failed: ' + e.message, 'error');
        }
        busy = null;
        renderSaved();
        renderLeft();
        renderRight();
    }

    async function downloadSavedOutput(entry) {
        busy = `Downloading "${entry.name}"…`; renderSaved();
        try {
            const m = await app.projects.manifest(entry.id);
            const blob = await app.projects.downloadFile(m.output.chunks, m.output.mime);
            downloadBytes(blob, `${entry.id}.png`, 'image/png');
        } catch (e) { toast('Download failed: ' + e.message, 'error'); }
        busy = null; renderSaved();
    }

    function thumbnailOf(canvas) {
        const s = Math.min(1, 240 / Math.max(canvas.width, canvas.height));
        const t = makeCanvas(Math.max(1, Math.round(canvas.width * s)), Math.max(1, Math.round(canvas.height * s)));
        const tctx = t.getContext('2d');
        tctx.imageSmoothingQuality = 'high';
        tctx.drawImage(canvas, 0, 0, t.width, t.height);
        return t.toDataURL('image/jpeg', 0.7);
    }

    // --------------------------------------------------------------- layout
    const left = h('div.create-left');
    const right = h('div.create-right');
    function render() {
        clear(root);
        root.append(
            h('div.lw-page-head', h('h1', 'Create a lenticular image'),
                h('p.lead', 'Choose your calibrated lens and printer, add 2 or more images, line them up, and export a print-ready interlaced PNG.')),
            savedHost,
            h('div.create-layout', left, right));
        renderSaved();
        renderLeft();
        renderRight();
    }
    function renderLeft() {
        clear(left);
        left.append(cardLensPrinter(), cardSize(), cardFrames(), cardOptions());
    }
    function renderRight() {
        clear(right);
        right.append(cardAlign(), cardGenerate());
    }
    const changed = (which = 'all') => {
        persist();
        if (which === 'all') { renderLeft(); renderRight(); } else if (which === 'right') renderRight();
    };

    // ----------------------------------------------------- 1 lens & printer
    function cardLensPrinter() {
        const p = params();
        const lenses = app.lenses.list();
        const lensSel = selectField('Lens profile', c.lensId, [['', '— manual entry —'], ...lenses.map(l => [l.id, `${l.name} — ${l.effectiveLpi != null ? l.effectiveLpi + ' LPI' : 'UNCALIBRATED (' + l.nominalLpi + ' nominal)'}`])], {
            help: 'lpi',
            onChange: v => { c.lensId = v; const l = v && app.lenses.get(v); if (l) c.orientation = l.orientation; changed(); },
        });
        const prSel = printerSelect(app, c.printerId, { label: 'Printer', noneLabel: '— manual entry —', onChange: v => { c.printerId = v; changed(); } });
        const paSel = paperSelect(app, c.paperId, { onChange: v => { c.paperId = v; changed(); } });
        return h('div.card.step',
            h('h2', h('span.step-n', '1'), 'Lens & printer'),
            lensSel.el,
            p.lens ? h('div.lens-info',
                h('span.badge.badge-' + p.lens.calibrationStatus, p.lensCalibrated ? `effective ${p.lens.effectiveLpi} LPI (${p.lens.calibrationStatus})` : 'uncalibrated — using nominal'),
                ` nominal ${p.lens.nominalLpi} · pitch ${fmt(lpiToPitchMm(p.lpi), 5)} mm`)
                : numberField('Effective LPI', c.manualLpi, { unit: 'LPI', min: 1, step: 'any', onInput: v => { if (v > 0) { c.manualLpi = v; changed('right'); } } }).el,
            prSel.el,
            p.printer ? h('p.muted.small', `${p.printer.dpi} DPI${p.printer.media ? ' · ' + p.printer.media : ''}${p.printer.notes ? ' — ' + p.printer.notes : ''}`)
                : numberField('Printer DPI / PPI', c.manualDpi, { unit: 'DPI', min: 50, onInput: v => { if (v > 0) { c.manualDpi = v; changed('right'); } } }).el,
            paSel.el,
            p.paper ? h('p.muted.small', [suitabilityText(p.paper),
                p.paper.gsm ? `${p.paper.gsm} g/m²` : null,
                thicknessUm(p.paper) ? `${thicknessUm(p.paper)} µm` : null].filter(Boolean).join(' · ')) : null,
            orientationPicker(c.orientation, v => { c.orientation = v; changed(); }),
            h('div.derived',
                row('Pixels per lenticule', `${fmt(pixelsPerLenticule(p.dpi, p.lpi), 5)} px`),
                p.n ? row('Pixels per frame strip', `${fmt(pixelsPerLenticule(p.dpi, p.lpi) / p.n, 4)} px (${p.n} frames)`) : null),
        );
    }

    // -------------------------------------------------------------- 2 size
    function cardSize() {
        const p = params();
        const inch = c.units === 'in';
        const toU = mm => inch ? Number(mmToIn(mm).toFixed(4)) : Number(mm.toFixed(3));
        const fromU = v => inch ? inToMm(v) : v;
        const wF = numberField('Width', toU(c.widthMm), { unit: c.units, min: 0.1, onInput: v => { if (v > 0) { c.widthMm = fromU(v); c.sizePreset = 'custom'; persist(); upd(); } } });
        const hF = numberField('Height', toU(c.heightMm), { unit: c.units, min: 0.1, onInput: v => { if (v > 0) { c.heightMm = fromU(v); c.sizePreset = 'custom'; persist(); upd(); } } });
        const out = h('div.derived');
        const upd = () => {
            const q = params();
            const gg = outputGeometry(c.widthMm, c.heightMm, q.dpi);
            clear(out);
            add(out,
                row('Physical size', `${fmt(c.widthMm, 2)} × ${fmt(c.heightMm, 2)} mm = ${fmt(mmToIn(c.widthMm), 3)} × ${fmt(mmToIn(c.heightMm), 3)} in`),
                row('Pixel size', `${gg.widthPx} × ${gg.heightPx} px at ${q.dpi} DPI`),
                row('Prints at exactly', `${fmt(gg.printedWidthMm, 3)} × ${fmt(gg.printedHeightMm, 3)} mm (whole pixels)`),
                row('Lenticules across', fmt((c.orientation === 'vertical' ? mmToIn(c.widthMm) : mmToIn(c.heightMm)) * q.lpi, 2)),
            );
            invalidate();
        };
        upd();
        return h('div.card.step',
            h('h2', h('span.step-n', '2'), 'Output size'),
            selectField('Size', c.sizePreset, SIZE_PRESETS.map(s => [s[0], s[1]]), {
                onChange: v => { const s = SIZE_PRESETS.find(x => x[0] === v); c.sizePreset = v; if (s && s[2]) { c.widthMm = s[2]; c.heightMm = s[3]; } changed(); },
            }).el,
            h('div.grid2', wF.el, hF.el),
            selectField('Units', c.units, [['in', 'inches'], ['mm', 'millimetres']], { onChange: v => { c.units = v; changed(); } }).el,
            out);
    }

    // ------------------------------------------------------------ 3 frames
    function cardFrames() {
        const p = params();
        const fileIn = h('input', { type: 'file', accept: 'image/*', multiple: true, hidden: true });
        fileIn.addEventListener('change', async () => {
            const files = [...fileIn.files];
            fileIn.value = '';
            for (const f of files) {
                try {
                    const src = await loadImageFile(f);
                    frames.push({ id: nextId++, name: f.name, src, transform: cloneTransform() });
                } catch (e) { toast(`Could not load ${f.name}: ${e.message}`, 'error'); }
            }
            if (!selectedId && frames.length) selectedId = frames[0].id;
            if (!referenceId && frames.length) referenceId = frames[0].id;
            changed();
        });
        const addImg = h('button.primary', { type: 'button' }, '+ Add images');
        addImg.addEventListener('click', () => fileIn.click());
        const testN = h('select', [2, 3, 4, 5, 6, 8].map(n => h('option', { value: n }, `${n} test frames`)));
        const addTest = h('button', { type: 'button' }, 'Use built-in test frames');
        addTest.addEventListener('click', () => {
            frames = makeTestFrames(Number(testN.value)).map(src => ({ id: nextId++, name: src.name, src, transform: cloneTransform() }));
            selectedId = frames[0].id; referenceId = frames[0].id;
            changed();
        });
        const rev = h('button.big-reverse', { type: 'button', disabled: frames.length < 2 }, '⇄ Reverse frame order');
        rev.addEventListener('click', () => { frames.reverse(); changed(); });

        // drag-and-drop reorder
        let dragFrom = null;
        const list = h('ol.frame-list', frames.map((f, i) => {
            const li = h('li.frame-item', { draggable: true, 'data-id': f.id, 'aria-selected': String(f.id === selectedId) },
                h('span.drag', '⠿'),
                h('span.letter', LETTERS[i] || String(i + 1)),
                thumbOf(f),
                h('span.fname', f.name),
                (() => { const b = h('button.icon', { type: 'button', title: 'Remove' }, '✕'); b.addEventListener('click', e => { e.stopPropagation(); frames = frames.filter(x => x !== f); if (selectedId === f.id) selectedId = frames[0]?.id ?? null; if (referenceId === f.id) referenceId = frames[0]?.id ?? null; changed(); }); return b; })());
            li.addEventListener('click', () => { selectedId = f.id; changed(); });
            li.addEventListener('dragstart', e => { dragFrom = i; e.dataTransfer.effectAllowed = 'move'; li.classList.add('dragging'); });
            li.addEventListener('dragend', () => li.classList.remove('dragging'));
            li.addEventListener('dragover', e => { e.preventDefault(); li.classList.add('drop-target'); });
            li.addEventListener('dragleave', () => li.classList.remove('drop-target'));
            li.addEventListener('drop', e => {
                e.preventDefault();
                if (dragFrom == null || dragFrom === i) return;
                const [m] = frames.splice(dragFrom, 1);
                frames.splice(i, 0, m);
                dragFrom = null;
                changed();
            });
            return li;
        }));
        const seqText = p.sequence.map(k => LETTERS[k] || k + 1).join(' → ');
        return h('div.card.step',
            h('h2', h('span.step-n', '3'), 'Frames & order', helpTip('frames')),
            h('div.btn-row', addImg, fileIn, testN, addTest),
            frames.length ? list : h('p.muted', 'Add 2 or more images — or use the built-in test frames (ONE, TWO, THREE…) to check your lens without photos.'),
            frames.length ? h('p.muted.small', 'Drag to reorder. A is seen first as you move from left to right (or top to bottom).') : null,
            rev,
            selectField('Sequence', c.sequenceMode, [['loop', 'Loop (A → B → C, repeat)'], ['pingpong', 'Ping-pong (A → B → C → B, repeat)']], { onChange: v => { c.sequenceMode = v; changed(); } }).el,
            p.n ? h('p.seq', h('strong', 'Under each lenticule: '), seqText, ` (${p.n} strips)`) : null,
        );
    }

    function thumbOf(f) {
        const cv = makeCanvas(48, 32);
        const ctx = cv.getContext('2d');
        if (f.src.kind === 'test') drawFrame(ctx, f.src, 48, 32);
        else drawFrame(ctx, { ...f.src, transform: { ...cloneTransform(), fit: 'contain' } }, 48, 32);
        cv.className = 'fthumb';
        return cv;
    }

    // ------------------------------------------------------ 4 interlace opts
    function cardOptions() {
        const p = params();
        return h('details.card.step',
            h('summary', h('h2', 'Advanced: interlacing & phase')),
            selectField('Frame sampling', c.sampling, [['lenticule', 'Lenticule average (recommended)'], ['direct', 'Direct pixels']], { help: 'sampling', onChange: v => { c.sampling = v; changed('right'); } }).el,
            selectField('Boundary pixels', c.boundary, [['nearest', 'Nearest (crisp)'], ['blend', 'Blend by area']], { help: 'boundary', onChange: v => { c.boundary = v; changed('right'); } }).el,
            h('div.field', h('span.field-label', 'Phase', helpTip('phase')),
                h('label.check', (() => { const cb = h('input', { type: 'checkbox', checked: c.useProfilePhase, disabled: !p.lens }); cb.addEventListener('change', () => { c.useProfilePhase = cb.checked; changed(); }); return cb; })(),
                    'Use the lens profile\'s measured phase' + (p.lens ? ` (${p.lens.phase})` : ''))),
            c.useProfilePhase ? selectField('Straight-on view shows', c.headOn, [['middle', 'the middle frame'], ['first', 'frame A']], { onChange: v => { c.headOn = v; changed('right'); } }).el : null,
            (() => {
                const f = numberField('Manual phase shift', c.phaseShift, { unit: 'lenticule', min: -1, max: 1, step: 0.01, onInput: v => { c.phaseShift = v ?? 0; persist(); rng.value = c.phaseShift; changed('right'); } });
                const rng = h('input', { type: 'range', min: -0.5, max: 0.5, step: 0.01, value: c.phaseShift });
                rng.addEventListener('input', () => { c.phaseShift = Number(rng.value); f.input.value = rng.value; persist(); renderRight(); });
                return h('div', f.el, rng);
            })(),
            h('p.muted.small', `Applied phase: ${fmt(p.phase, 4)} lenticule = ${fmt(p.phase * lpiToPitchMm(p.lpi), 4)} mm shift of the strips.`),
        );
    }

    // ------------------------------------------------------------- 5 align
    function cardAlign() {
        const sel = frames.find(f => f.id === selectedId);
        const ref = frames.find(f => f.id === referenceId);
        const ar = c.widthMm / c.heightMm;
        const maxPx = app.settings.editorMaxPx;
        const EW = ar >= 1 ? maxPx : Math.round(maxPx * ar);
        const EH = ar >= 1 ? Math.round(maxPx / ar) : maxPx;
        const cv = makeCanvas(EW, EH);
        cv.className = 'align-canvas';
        const ctx = cv.getContext('2d');
        const draw = () => {
            ctx.globalAlpha = 1;
            ctx.globalCompositeOperation = 'source-over';
            ctx.clearRect(0, 0, EW, EH);
            const useRef = ghost && ref && sel && ref !== sel;
            if (useRef) drawFrame(ctx, frameFor(ref), EW, EH);
            if (sel) {
                const off = makeCanvas(EW, EH);
                drawFrame(off.getContext('2d'), frameFor(sel), EW, EH);
                ctx.globalAlpha = useRef ? (blend === 'difference' ? 1 : app.settings.ghostOpacity / 100) : 1;
                ctx.globalCompositeOperation = useRef && blend === 'difference' ? 'difference' : 'source-over';
                ctx.drawImage(off, 0, 0);
                ctx.globalAlpha = 1;
                ctx.globalCompositeOperation = 'source-over';
            }
            // centre cross + ridge direction hint
            ctx.strokeStyle = 'rgba(255,0,128,0.6)';
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(EW / 2, 0); ctx.lineTo(EW / 2, EH); ctx.moveTo(0, EH / 2); ctx.lineTo(EW, EH / 2); ctx.stroke();
        };
        // pointer drag moves the selected frame; wheel scales it
        let drag = null;
        cv.addEventListener('pointerdown', e => {
            if (!sel || sel.src.kind === 'test') return;
            cv.setPointerCapture(e.pointerId);
            drag = { x: e.clientX, y: e.clientY, tx: sel.transform.x, ty: sel.transform.y, sw: cv.getBoundingClientRect().width, sh: cv.getBoundingClientRect().height };
        });
        cv.addEventListener('pointermove', e => {
            if (!drag) return;
            sel.transform.x = round4(drag.tx + (e.clientX - drag.x) / drag.sw);
            sel.transform.y = round4(drag.ty + (e.clientY - drag.y) / drag.sh);
            draw(); syncFields();
        });
        const end = () => { if (drag) { drag = null; invalidate(); } };
        cv.addEventListener('pointerup', end);
        cv.addEventListener('pointercancel', end);
        cv.addEventListener('wheel', e => {
            if (!sel || sel.src.kind === 'test') return;
            e.preventDefault();
            sel.transform.scale = round4(sel.transform.scale * Math.pow(1.0015, -e.deltaY));
            draw(); syncFields(); invalidate();
        }, { passive: false });

        // transform fields
        const fields = {};
        const tf = sel ? sel.transform : cloneTransform();
        const disabled = !sel || sel.src.kind === 'test';
        const setT = (k, conv = v => v) => v => { if (!sel || v == null) return; sel.transform[k] = conv(v); draw(); invalidate(); };
        fields.x = numberField('X offset', round4(tf.x * 100), { unit: '% of width', step: 0.1, onInput: setT('x', v => v / 100) });
        fields.y = numberField('Y offset', round4(tf.y * 100), { unit: '% of height', step: 0.1, onInput: setT('y', v => v / 100) });
        fields.scale = numberField('Scale', round4(tf.scale * 100), { unit: '%', step: 0.1, min: 1, onInput: setT('scale', v => v / 100) });
        fields.rotation = numberField('Rotation', tf.rotation, { unit: '°', step: 0.1, onInput: setT('rotation') });
        const cropF = ['left', 'top', 'right', 'bottom'].map(side => numberField('Crop ' + side, round4(tf.crop[side] * 100), {
            unit: '%', min: 0, max: 90, step: 0.5,
            onInput: v => { if (!sel || v == null) return; sel.transform.crop = { ...sel.transform.crop, [side]: v / 100 }; draw(); invalidate(); },
        }));
        const fitF = selectField('Fit', tf.fit, [['cover', 'Fill frame (crop overflow)'], ['contain', 'Fit inside (letterbox)'], ['stretch', 'Stretch'], ['none', 'Actual pixels']], { onChange: v => { if (sel) { sel.transform.fit = v; draw(); invalidate(); } } });
        const flip = k => { const cb = h('input', { type: 'checkbox', checked: tf[k] }); cb.addEventListener('change', () => { if (sel) { sel.transform[k] = cb.checked; draw(); invalidate(); } }); return cb; };
        function syncFields() {
            if (!sel) return;
            fields.x.input.value = round4(sel.transform.x * 100);
            fields.y.input.value = round4(sel.transform.y * 100);
            fields.scale.input.value = round4(sel.transform.scale * 100);
        }
        const btn = (label, fn, dis = disabled) => { const b = h('button', { type: 'button', disabled: dis }, label); b.addEventListener('click', fn); return b; };

        const selSel = selectField('Editing frame', selectedId ?? '', frames.map((f, i) => [f.id, `${LETTERS[i]} — ${f.name}`]), { onChange: v => { selectedId = Number(v); renderRight(); renderLeft(); } });
        const refSel = selectField('Alignment reference', referenceId ?? '', frames.map((f, i) => [f.id, `${LETTERS[i]} — ${f.name}`]), { onChange: v => { referenceId = Number(v); renderRight(); } });
        const ghostCb = h('input', { type: 'checkbox', checked: ghost });
        ghostCb.addEventListener('change', () => { ghost = ghostCb.checked; draw(); });
        const opac = h('input', { type: 'range', min: 0, max: 100, value: app.settings.ghostOpacity });
        opac.addEventListener('input', () => { app.settings.ghostOpacity = Number(opac.value); draw(); });
        opac.addEventListener('change', () => app.saveSettings());
        const blendSel = h('select', h('option', { value: 'normal', selected: blend === 'normal' }, 'Ghost (opacity)'), h('option', { value: 'difference', selected: blend === 'difference' }, 'Difference (black = aligned)'));
        blendSel.addEventListener('change', () => { blend = blendSel.value; draw(); });

        const card = h('div.card.step',
            h('h2', h('span.step-n', '4'), 'Align frames'),
            frames.length < 1 ? h('p.muted', 'Add frames first.') : h('div',
                h('div.grid2', selSel.el, refSel.el),
                h('div.align-toolbar',
                    h('label.check', ghostCb, 'Overlay reference'),
                    blendSel,
                    h('label.inline', 'Opacity ', opac)),
                h('div.align-wrap', { style: { aspectRatio: `${EW} / ${EH}` } }, cv),
                h('p.muted.small', disabled && sel ? 'Built-in test frames are generated to fit and cannot be moved.' : 'Drag the image to move it, scroll to scale. The frame outline is your print; anything outside it is cut off.'),
                h('div.grid4', fields.x.el, fields.y.el, fields.scale.el, fields.rotation.el),
                h('div.grid4', ...cropF.map(f => f.el)),
                h('div.btn-row', fitF.el,
                    h('label.check', flip('flipH'), 'Flip horizontal'),
                    h('label.check', flip('flipV'), 'Flip vertical')),
                h('div.btn-row',
                    btn('Reset transform', () => { sel.transform = cloneTransform(); renderRight(); }),
                    btn('Copy transform', () => { clipboard = cloneTransform(sel.transform); toast('Transform copied'); }),
                    btn('Paste transform', () => { if (clipboard) { sel.transform = cloneTransform(clipboard); renderRight(); } }, disabled || !clipboard),
                    btn('Apply to all frames', () => { frames.forEach(f => { if (f.src.kind !== 'test') f.transform = cloneTransform(sel.transform); }); renderRight(); toast('Applied to all frames'); }),
                ),
            ));
        for (const f of [fields.x, fields.y, fields.scale, fields.rotation, ...cropF, fitF]) f.input.disabled = disabled;
        draw();
        return card;
    }
    function frameFor(f) { return f.src.kind === 'test' ? f.src : { ...f.src, transform: f.transform }; }

    // --------------------------------------------------------- 6/7 generate
    const genHost = h('div');
    function invalidate() {
        if (result) {
            const stale = signature(params()) !== result.sig;
            genHost.querySelectorAll('[data-needs-fresh]').forEach(b => { b.disabled = stale || !allConfirmed(); });
            const s = genHost.querySelector('.stale');
            if (s) s.hidden = !stale;
        }
    }
    const allConfirmed = () => confirmations.scale100 && confirmations.fit && confirmations.auto;

    function cardGenerate() {
        clear(genHost);
        const p = params();
        const g = outputGeometry(c.widthMm, c.heightMm, p.dpi);
        const issues = checkCreateSettings({
            lpi: p.lpi, dpi: p.dpi, widthMm: c.widthMm, heightMm: c.heightMm, frameCount: p.n,
            orientation: c.orientation, lensOrientation: p.lens?.orientation, lensCalibrated: p.lensCalibrated,
            calibratedDpi: p.lens?.calibratedWith?.dpi, lensWidthMm: p.lens?.widthMm, lensHeightMm: p.lens?.heightMm,
            printerNativeDpi: nativeDpiOf(p.printer), paper: p.paper, calibratedPaperName: p.lens?.calibratedWith?.paperName || null,
        });
        const blocked = issues.some(i => i.level === 'error');
        const genBtn = h('button.primary.big', { type: 'button', disabled: blocked }, result ? 'Regenerate interlaced image' : 'Generate interlaced image');
        const status = h('span.muted');
        genBtn.addEventListener('click', async () => {
            genBtn.disabled = true;
            status.textContent = `Rendering ${p.n} strips over ${g.widthPx} × ${g.heightPx} px…`;
            await nextFrame(); await nextFrame();
            const t0 = performance.now();
            try {
                const raster = interlaceRGBA({
                    width: g.widthPx, height: g.heightPx, sequence: p.sequence,
                    // Called once per distinct frame, so only one full-size
                    // frame is ever held in memory at a time.
                    getFrame: k => renderFrameRGBA(frameFor(frames[k]), g.widthPx, g.heightPx),
                    dpi: p.dpi, lpi: p.lpi, phase: p.phase, orientation: c.orientation, boundary: c.boundary, sampling: c.sampling,
                });
                const canvas = makeCanvas(g.widthPx, g.heightPx);
                canvas.getContext('2d').putImageData(new ImageData(raster, g.widthPx, g.heightPx), 0, 0);
                result = { canvas, raster, sig: signature(p), params: { ...p, lens: p.lens?.name, printer: p.printer?.name, widthPx: g.widthPx, heightPx: g.heightPx }, ms: performance.now() - t0 };
                toast(`Interlaced ${g.widthPx} × ${g.heightPx} px in ${(result.ms / 1000).toFixed(1)} s`, 'good');
                renderRight();
            } catch (e) {
                toast('Generation failed: ' + e.message, 'error');
                genBtn.disabled = false;
                status.textContent = '';
            }
        });
        add(genHost,
            h('div.card.step',
                h('h2', h('span.step-n', '5'), 'Generate'),
                issueList(issues),
                h('div.btn-row', genBtn, status),
                result ? h('p.stale.warn', { hidden: signature(p) === result.sig }, 'Settings changed since this image was generated — regenerate before exporting.') : null),
            result ? previewCard() : null,
            result ? checklistCard(p, issues) : null,
        );
        return genHost;
    }

    function previewCard() {
        const r = result;
        const q = r.params;
        const maxPx = app.settings.previewMaxPx;
        const ar = q.widthPx / q.heightPx;
        const PW = ar >= 1 ? maxPx : Math.round(maxPx * ar);
        const PH = ar >= 1 ? Math.round(maxPx / ar) : maxPx;
        const cv = makeCanvas(PW, PH);
        cv.className = 'preview-canvas';
        const ctx = cv.getContext('2d');
        const label = h('div.view-label');
        const drawSim = () => {
            const img = simulateView({ raster: r.raster, width: q.widthPx, height: q.heightPx, dpi: q.dpi, lpi: q.lpi, phase: q.phase, orientation: q.orientation, n: q.n, viewPos, outW: PW, outH: PH, snap: app.settings.previewSnap });
            ctx.putImageData(new ImageData(img, PW, PH), 0, 0);
            if (app.settings.previewGrid) {
                const ppl = pixelsPerLenticule(q.dpi, q.lpi);
                const axisPx = q.orientation === 'vertical' ? q.widthPx : q.heightPx;
                const scale = (q.orientation === 'vertical' ? PW : PH) / axisPx;
                const step = ppl * scale;
                if (step >= 3) {
                    ctx.strokeStyle = 'rgba(255,0,0,0.35)';
                    ctx.beginPath();
                    for (let L = 0; ; L++) {
                        const pos = (L + q.phase) * step;
                        if (pos > (q.orientation === 'vertical' ? PW : PH)) break;
                        if (q.orientation === 'vertical') { ctx.moveTo(pos, 0); ctx.lineTo(pos, PH); } else { ctx.moveTo(0, pos); ctx.lineTo(PW, pos); }
                    }
                    ctx.stroke();
                }
            }
            const shown = Math.min(q.n - 1, Math.floor(viewPos * q.n));
            const k = q.sequence[shown];
            label.textContent = `Viewing position ${Math.round(viewPos * 100)}% → frame ${LETTERS[k]} (${frames[k]?.name ?? ''})`;
        };
        const slider = h('input.view-slider', { type: 'range', min: 0, max: 1, step: 0.001, value: viewPos });
        slider.addEventListener('input', () => { viewPos = Number(slider.value); drawSim(); });
        const ends = q.orientation === 'vertical' ? ['← viewer left', 'viewer right →'] : ['↑ viewer above', 'viewer below ↓'];
        const ticks = h('div.view-ticks', q.sequence.map(k => h('span', LETTERS[k])));

        // raw strips: a small crop of the real raster, magnified with no smoothing
        const zoomCv = makeCanvas(240, 120);
        zoomCv.className = 'zoom-canvas';
        const zctx = zoomCv.getContext('2d');
        zctx.imageSmoothingEnabled = false;
        const cw = 60, ch = 30;
        zctx.drawImage(r.canvas, Math.max(0, Math.floor(q.widthPx / 2 - cw / 2)), Math.max(0, Math.floor(q.heightPx / 2 - ch / 2)), cw, ch, 0, 0, 240, 120);

        const card = h('div.card.step',
            h('h2', h('span.step-n', '6'), 'Simulated preview'),
            h('p.sim-note', 'SIMULATION — an idealised lens reading the generated file. It checks frame order, count, direction and composition; it cannot reproduce the real optics (focus, ghosting, viewing distance).'),
            h('div.preview-wrap', cv),
            label,
            slider,
            h('div.view-ends', h('span', ends[0]), ticks, h('span', ends[1])),
            h('details', h('summary', 'Show the actual interlaced pixels (centre, 60 × 30 px magnified 4×)'), zoomCv,
                h('p.muted.small', `${fmt(pixelsPerLenticule(q.dpi, q.lpi), 4)} px per lenticule, ${q.n} strips each.`)),
        );
        drawSim();
        return card;
    }

    function checklistCard(p, issues) {
        const q = result.params;
        const item = (ok, label, value) => h('li' + (ok ? '.ok' : '.bad'), h('span.tick', ok ? '✓' : '!'), h('span.cl-label', label), h('span.cl-val', value));
        const confirm = (key, label) => {
            const cb = h('input', { type: 'checkbox', checked: confirmations[key] });
            cb.addEventListener('change', () => { confirmations[key] = cb.checked; invalidate(); refreshButtons(); });
            return h('li.confirm', h('label.check', cb, h('strong', label)));
        };
        const name = `lenticular_${q.n}f_${fmt(q.lpi, 4)}lpi_${q.dpi}dpi_${fmt(c.widthMm, 1)}x${fmt(c.heightMm, 1)}mm_${q.orientation}`;
        const pngBtn = h('button.primary.big', { type: 'button', 'data-needs-fresh': 1 }, 'Export PNG');
        pngBtn.addEventListener('click', async () => {
            pngBtn.disabled = true;
            try {
                const bytes = injectPngPhys(await canvasToPngBytes(result.canvas), q.dpi);
                downloadBytes(bytes, name + '.png', 'image/png');
            } catch (e) { toast(e.message, 'error'); }
            refreshButtons();
        });
        const tifBtn = h('button', { type: 'button', 'data-needs-fresh': 1 }, 'Export TIFF');
        tifBtn.addEventListener('click', () => downloadBytes(encodeTiff(result.raster, q.widthPx, q.heightPx, q.dpi), name + '.tif', 'image/tiff'));
        function refreshButtons() {
            const stale = signature(params()) !== result.sig;
            [pngBtn, tifBtn].forEach(b => { b.disabled = stale || !allConfirmed(); });
        }
        const card = h('div.card.step',
            h('h2', h('span.step-n', '7'), 'Print-safety checklist & export'),
            h('ul.checklist',
                item(!!q.lens, 'Lens profile', q.lens || 'manual entry'),
                item(p.lensCalibrated, 'Effective LPI', `${q.lpi}${p.lensCalibrated ? ' (calibrated)' : ' (NOT calibrated)'}`),
                item(!p.lens || p.lens.orientation === q.orientation, 'Lens orientation', q.orientation === 'vertical' ? 'Vertical ridges ▥' : 'Horizontal ridges ▤'),
                item(true, 'Printer DPI/PPI', `${q.dpi}${q.printer ? ' — ' + q.printer : ''}`),
                item(!!p.paper && p.paper.lenticular !== 'poor', 'Paper', p.paper ? `${p.paper.name} — ${suitabilityText(p.paper)}` : 'not specified'),
                p.paper && printerBrandOf(p.printer) ? item(true, 'Driver paper type', driverSettingFor(p.paper, printerBrandOf(p.printer)) || '—') : null,
                item(true, 'Physical output', `${fmt(c.widthMm, 2)} × ${fmt(c.heightMm, 2)} mm (${fmt(mmToIn(c.widthMm), 3)} × ${fmt(mmToIn(c.heightMm), 3)} in)`),
                item(true, 'Pixel dimensions', `${q.widthPx} × ${q.heightPx} px`),
                confirm('scale100', 'I will print at 100% / Actual Size'),
                confirm('fit', 'I have disabled Fit to Page'),
                confirm('auto', 'I have disabled automatic scaling'),
            ),
            issueList(issues.filter(i => i.level !== 'info')),
            h('div.btn-row', pngBtn, tifBtn),
            saveProjectRow(),
            h('p.muted.small', 'The PNG embeds its DPI (pHYs chunk). After printing, measure: the image should be exactly the physical size above. Place the lens with its ridges running ' + (q.orientation === 'vertical' ? 'top-to-bottom' : 'left-to-right') + '. If the sequence plays backwards, use Reverse frame order and regenerate.'),
        );
        refreshButtons();
        return card;
    }

    function saveProjectRow() {
        const nameIn = h('input', { type: 'text', placeholder: 'Project name', value: result?.fromSaved || '' });
        const btn = h('button', { type: 'button', disabled: !app.projects || !!busy }, 'Save project (image + sources) to git');
        btn.addEventListener('click', () => {
            const name = nameIn.value.trim() || `Lenticular ${new Date().toLocaleString()}`;
            saveProject(name);
        });
        return h('div.save-project',
            h('div.btn-row', nameIn, btn),
            h('p.muted.small', app.projects
                ? 'Saves this generated image, every source image (original files) and these settings to the repo, so you can open it again later from "Saved projects".'
                : 'Saving projects needs the deployed site (git storage).'));
    }

    function issueList(issues) {
        if (!issues.length) return null;
        return h('ul.issues', issues.map(i => h('li.issue-' + i.level, h('strong', i.level === 'error' ? 'Blocked: ' : i.level === 'warn' ? 'Warning: ' : 'Note: '), i.msg)));
    }

    render();
    loadSavedList();
    app.on('projects-ready', () => loadSavedList());
    app.on('profiles', () => { if (!root.hidden) render(); });
    app.on('settings', () => { if (!root.hidden) renderRight(); });
    return { refresh: render, _debug: { get frames() { return frames; }, get result() { return result; }, params } };
}

function row(k, v) { return h('div.drow', h('span.k', k), h('span.v', v)); }
function round4(v) { return Math.round(v * 10000) / 10000; }
function readJSON(storage, key) { try { return JSON.parse(storage.getItem(key) || '{}') || {}; } catch { return {}; } }
