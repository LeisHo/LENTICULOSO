// ====================================================================
// calibrateView.mjs — the CALIBRATE tab
// ====================================================================
// A strictly physical workflow: the app generates test sheets, the USER
// prints them, looks through the real lens, and reports what they saw.
// The app never claims an effective LPI the user did not select.
// ====================================================================

import { h, add, clear, numberField, selectField, textField, orientationPicker, helpTip, downloadBytes, canvasToPngBytes, toast, nextFrame, fmt } from './dom.mjs';
import { coarseCandidates, refineCandidates, phaseCandidates, decimalsOf, layoutSheet } from '../core/calibration.mjs';
import { lpiToPitchMm, pixelsPerLenticule, lpiDeltaFromBands } from '../core/units.mjs';
import { injectPngPhys, encodeTiff } from '../core/encode.mjs';
import { makeLensProfile } from '../core/profiles.mjs';
import { renderCalibrationSheet } from './sheetRender.mjs';

const SHEET_PRESETS = [
    ['a4p', 'A4 portrait, 10 mm margins (190 × 277 mm)', 190, 277],
    ['a4l', 'A4 landscape, 10 mm margins (277 × 190 mm)', 277, 190],
    ['letterp', 'Letter portrait, 10 mm margins (196 × 259 mm)', 196, 259],
    ['letterl', 'Letter landscape, 10 mm margins (259 × 196 mm)', 259, 196],
    ['custom', 'Custom', null, null],
];

export function mountCalibrate(root, app) {
    const st = app.calibration;
    const save = () => app.saveCalibration();
    const sheets = { coarse: null, fine: null, phase: null };

    function effectiveResult() {
        if (st.fineSelected != null) return { value: st.fineSelected, stage: 'fine' };
        if (st.coarseSelected != null) return { value: st.coarseSelected, stage: 'coarse' };
        return null;
    }

    function render() {
        clear(root);
        root.append(
            h('div.lw-page-head',
                h('h1', 'Calibrate your lens'),
                h('p.lead', 'Find the ', h('strong', 'effective'), ' pitch of your real lens sheet with your real printer. The seller\'s LPI is only a starting estimate — this process prints test patterns, and ', h('strong', 'you'), ' are the measuring instrument: you look through the lens and pick what looks best.')),
            resultBanner(),
            stepSettings(),
            stepGenerate('coarse'),
            stepInspect(),
            stepSelect('coarse'),
            stepRefine(),
            stepPhase(),
            stepSave(),
        );
    }

    // ---------------------------------------------------------------- result
    function resultBanner() {
        const r = effectiveResult();
        return h('div.result-banner',
            h('div.result-cell', h('span.k', 'Nominal (seller)'), h('span.v', `${st.nominalLpi} LPI`), h('span.s', 'a claim, not a measurement')),
            h('div.result-cell' + (r ? '.good' : ''), h('span.k', 'Effective (your test)'),
                h('span.v', r ? `${r.value} LPI` : 'not yet measured'),
                h('span.s', r ? (r.stage === 'fine' ? 'selected from a FINE printed test' : 'selected from a COARSE printed test — refine it') : 'print a test and pick the best strip')),
            h('div.result-cell', h('span.k', 'Phase'), h('span.v', st.phaseSelected == null ? '—' : String(st.phaseSelected)), h('span.s', 'optional')),
        );
    }

    // ------------------------------------------------------------- 1 settings
    function stepSettings() {
        const printers = app.printers.list();
        const derived = h('div.derived');
        const updateDerived = () => {
            clear(derived);
            let lay = null, cands = null, err = null;
            try {
                cands = coarseCandidates(st.minLpi, st.maxLpi, st.coarseStep);
                lay = layoutSheet({ widthMm: st.widthMm, heightMm: st.heightMm, dpi: st.dpi, orientation: st.orientation, values: cands, decimals: decimalsOf(st.coarseStep) });
            } catch (e) { err = e.message; }
            add(derived,
                row('Nominal pitch', `${fmt(lpiToPitchMm(st.nominalLpi), 5)} mm (${fmt(1 / st.nominalLpi, 6)} in)`),
                row('Printer pixels per lenticule', `${fmt(pixelsPerLenticule(st.dpi, st.nominalLpi), 4)} px at nominal (fractional is fine — nothing is rounded)`),
                cands ? row('Candidates', `${cands.length}: ${cands[0]} … ${cands[cands.length - 1]} LPI`) : null,
                lay ? row('Sheet raster', `${lay.width} × ${lay.height} px @ ${st.dpi} DPI = ${st.widthMm} × ${st.heightMm} mm`) : null,
                lay ? row('Strip length / resolution', `${fmt(lay.stripLengthIn, 2)} in → one visible band ≈ ${fmt(1 / lay.stripLengthIn, 3)} LPI of error`) : null,
                err ? h('p.warn', err) : null,
            );
        };
        const upd = (k) => (v) => { if (v != null) { st[k] = v; save(); updateDerived(); } };
        const commit = f => { f.input.addEventListener('change', () => { sheets.coarse = null; render(); }); return f.el; };
        const preset = SHEET_PRESETS.find(p => p[2] === st.widthMm && p[3] === st.heightMm)?.[0] || 'custom';
        const wF = numberField('Test output width', st.widthMm, { unit: 'mm', min: 20, onInput: upd('widthMm') });
        const hF = numberField('Test output height', st.heightMm, { unit: 'mm', min: 20, onInput: upd('heightMm') });
        const card = h('div.card.step',
            h('h2', h('span.step-n', '1'), 'Test settings'),
            h('p.muted', 'Defaults suit a 100 LPI lens. They are editable because every lens and printer is different.'),
            h('div.grid2',
                numberField('Nominal LPI (seller)', st.nominalLpi, { unit: 'LPI', help: 'lpi', onInput: upd('nominalLpi') }).el,
                printerOrDpi(printers),
                commit(numberField('Minimum test LPI', st.minLpi, { unit: 'LPI', onInput: upd('minLpi') })),
                commit(numberField('Maximum test LPI', st.maxLpi, { unit: 'LPI', onInput: upd('maxLpi') })),
                commit(numberField('Coarse increment', st.coarseStep, { unit: 'LPI', min: 0.0001, onInput: upd('coarseStep') })),
                selectField('Sheet size', preset, SHEET_PRESETS.map(p => [p[0], p[1]]), {
                    onChange: v => {
                        const p = SHEET_PRESETS.find(x => x[0] === v);
                        if (p && p[2]) { st.widthMm = p[2]; st.heightMm = p[3]; wF.input.value = p[2]; hF.input.value = p[3]; save(); updateDerived(); }
                    },
                }).el,
                wF.el, hF.el,
            ),
            orientationPicker(st.orientation, v => { st.orientation = v; save(); updateDerived(); }),
            h('p.muted.small', 'For the most precise test, make the sheet LONG along the direction the pattern varies: landscape for vertical ridges. Longer strips show smaller pitch errors.'),
            derived,
        );
        updateDerived();
        return card;

        function printerOrDpi(list) {
            const wrap = h('div');
            const dpiF = numberField('Printer DPI / PPI', st.dpi, { unit: 'DPI', min: 50, help: 'dpi', onInput: v => { if (v) { st.dpi = v; st.printerProfileId = null; sel.input.value = ''; save(); updateDerived(); } } });
            const sel = selectField('Printer profile', st.printerProfileId || '', [['', '— none (enter DPI) —'], ...list.map(p => [p.id, `${p.name} (${p.dpi} DPI)`])], {
                onChange: v => {
                    st.printerProfileId = v || null;
                    const p = v && app.printers.get(v);
                    if (p) { st.dpi = p.dpi; dpiF.input.value = p.dpi; }
                    save(); updateDerived();
                },
            });
            wrap.append(sel.el, dpiF.el);
            return wrap;
        }
    }

    // ------------------------------------------------------------- 2 generate
    function stepGenerate(kind) {
        const box = h('div.sheet-out');
        const btn = h('button.primary', { type: 'button' }, kind === 'coarse' ? 'Generate coarse calibration sheet' : kind === 'fine' ? 'Generate fine calibration sheet' : 'Generate phase test sheet');
        btn.addEventListener('click', async () => {
            btn.disabled = true;
            btn.textContent = 'Rendering…';
            await nextFrame();
            try {
                sheets[kind] = buildSheet(kind);
                showSheet(box, kind);
            } catch (e) {
                toast(e.message, 'error');
            } finally {
                btn.disabled = false;
                btn.textContent = 'Regenerate';
            }
        });
        const card = kind === 'coarse'
            ? h('div.card.step', h('h2', h('span.step-n', '2'), 'Generate & print the calibration sheet'), printWarning(), btn, box)
            : h('div', btn, box);
        if (sheets[kind]) showSheet(box, kind);
        return card;
    }

    function buildSheet(kind) {
        const printer = st.printerProfileId && app.printers.get(st.printerProfileId);
        let values, decimals, lpi;
        if (kind === 'coarse') {
            values = coarseCandidates(st.minLpi, st.maxLpi, st.coarseStep);
            decimals = Math.max(decimalsOf(st.coarseStep), decimalsOf(st.minLpi));
        } else if (kind === 'fine') {
            if (st.coarseSelected == null) throw new Error('Select a coarse result first.');
            values = refineCandidates(st.coarseSelected, st.refineHalfRange, st.refineStep);
            decimals = Math.max(decimalsOf(st.refineStep), decimalsOf(st.coarseSelected));
        } else {
            const r = effectiveResult();
            if (!r) throw new Error('Find the pitch first — phase is only meaningful at the correct pitch.');
            lpi = r.value;
            values = phaseCandidates(st.phaseCount);
            decimals = 3;
        }
        const { canvas, layout } = renderCalibrationSheet({
            kind: kind === 'phase' ? 'phase' : 'pitch', values, decimals, lpi,
            widthMm: st.widthMm, heightMm: st.heightMm, dpi: st.dpi, orientation: st.orientation,
            printerName: printer ? printer.name : '',
            title: kind === 'coarse' ? 'Lenticular PITCH test — COARSE' : kind === 'fine' ? `Lenticular PITCH test — FINE around ${st.coarseSelected}` : undefined,
        });
        return { canvas, layout, values, decimals, kind, dpi: st.dpi };
    }

    function showSheet(box, kind) {
        const s = sheets[kind];
        clear(box);
        const thumb = document.createElement('canvas');
        const scale = Math.min(1, 560 / s.canvas.width, 700 / s.canvas.height);
        thumb.width = Math.round(s.canvas.width * scale);
        thumb.height = Math.round(s.canvas.height * scale);
        const tctx = thumb.getContext('2d');
        tctx.imageSmoothingQuality = 'high';
        tctx.drawImage(s.canvas, 0, 0, thumb.width, thumb.height);
        const name = `lenticular-${kind}-test_${s.values[0]}-${s.values[s.values.length - 1]}_${s.dpi}dpi_${st.widthMm}x${st.heightMm}mm`;
        const png = h('button.primary', { type: 'button' }, 'Download PNG (for printing)');
        png.addEventListener('click', async () => {
            const bytes = injectPngPhys(await canvasToPngBytes(s.canvas), s.dpi);
            downloadBytes(bytes, name + '.png', 'image/png');
        });
        const tif = h('button', { type: 'button' }, 'Download TIFF');
        tif.addEventListener('click', () => {
            const data = s.canvas.getContext('2d').getImageData(0, 0, s.canvas.width, s.canvas.height).data;
            downloadBytes(encodeTiff(data, s.canvas.width, s.canvas.height, s.dpi), name + '.tif', 'image/tiff');
        });
        add(box,
            h('div.sheet-meta',
                h('p', h('strong', `${s.values.length} strips`), ` · ${s.canvas.width} × ${s.canvas.height} px at ${s.dpi} DPI = ${fmt(s.canvas.width / s.dpi * 25.4, 1)} × ${fmt(s.canvas.height / s.dpi * 25.4, 1)} mm`),
                h('p.muted.small', 'The on-screen thumbnail is downscaled and will show false moiré — judge only the PRINT. The file embeds its DPI so print software can size it correctly.'),
                h('div.btn-row', png, tif)),
            h('div.thumb-wrap', thumb),
        );
    }

    // -------------------------------------------------------------- 3 inspect
    function stepInspect() {
        return h('div.card.step',
            h('h2', h('span.step-n', '3'), 'Print, place the lens, inspect'),
            h('ol.howto',
                h('li', h('strong', 'Print at 100% / Actual Size'), ' — turn OFF "Fit to page", "Scale to fit", "Shrink oversized pages" and any borderless expansion. Print from software that honours the image DPI (e.g. GIMP, Photoshop, IrfanView "print size from DPI"), not a photo viewer that fills the page.'),
                h('li', h('strong', 'Measure the rulers'), ' with a real ruler. If 100 mm on paper is not 100 mm, the printer scaled the page — fix the print settings and reprint before judging anything.'),
                h('li', h('strong', 'Place the lens'), ' ridges-side up, smooth side on the print, ridges parallel to the "align ridges ∥" line. Hold it flat.'),
                h('li', h('strong', 'Tilt or move your head'), ' at the distance you will view your finished prints. Watch each strip.'),
                h('li', 'The ', h('strong', 'correct'), ' pitch: the whole strip turns black, then white, all at once — uniform, no waves. ', h('strong', 'Wrong'), ' pitches: dark/light bands along the strip. The further off, the more bands.'),
                h('li', 'If the best strip is at the very end of the range, the true value may be outside it — widen the range and print again.'),
            ),
        );
    }

    // --------------------------------------------------------------- select
    function stepSelect(kind) {
        const key = kind === 'coarse' ? 'coarseSelected' : 'fineSelected';
        const values = kind === 'coarse'
            ? safe(() => coarseCandidates(st.minLpi, st.maxLpi, st.coarseStep), [])
            : st.coarseSelected != null ? safe(() => refineCandidates(st.coarseSelected, st.refineHalfRange, st.refineStep), []) : [];
        const d = kind === 'coarse' ? Math.max(decimalsOf(st.coarseStep), decimalsOf(st.minLpi)) : Math.max(decimalsOf(st.refineStep), decimalsOf(st.coarseSelected ?? 0));
        const list = h('div.cand-list');
        values.forEach((v, i) => {
            const b = h('button.cand', { type: 'button', 'aria-pressed': String(st[key] === v) }, h('span.cand-n', '#' + (i + 1)), v.toFixed(d));
            b.addEventListener('click', () => {
                st[key] = v;
                if (kind === 'coarse') st.fineSelected = null;
                save();
                render();
            });
            list.appendChild(b);
        });
        const edge = st[key] != null && values.length && (st[key] === values[0] || st[key] === values[values.length - 1]);
        const content = [
            h('p.muted', 'Click the strip number that looked cleanest — fewest bands, most uniform flip.'),
            list,
            edge ? h('p.warn', 'You picked the edge of the range: the true value may lie beyond it. Consider widening the range and reprinting.') : null,
            bandHelper(kind, values),
        ];
        if (kind === 'coarse') return h('div.card.step', h('h2', h('span.step-n', '4'), 'Select the cleanest strip'), ...content);
        return h('div', ...content);
    }

    function bandHelper(kind, values) {
        const lay = sheets[kind]?.layout || safe(() => layoutSheet({ widthMm: st.widthMm, heightMm: st.heightMm, dpi: st.dpi, orientation: st.orientation, values: values.length ? values : [st.nominalLpi], decimals: 2 }), null);
        if (!lay) return null;
        const out = h('span.band-out');
        const f = numberField('Optional: bands you can still count along your chosen strip', st.bandCount, {
            min: 0, step: 0.5,
            onInput: v => {
                st.bandCount = v; save();
                out.textContent = v == null ? '' : `→ your pick is within about ±${fmt(lpiDeltaFromBands(v, lay.stripLengthIn), 4)} LPI of the lens (${fmt(lay.stripLengthIn, 2)} in strip). Compare the neighbours to see which side.`;
            },
        });
        return h('div.band-helper', f.el, out);
    }

    // --------------------------------------------------------------- refine
    function stepRefine() {
        const lay = safe(() => layoutSheet({ widthMm: st.widthMm, heightMm: st.heightMm, dpi: st.dpi, orientation: st.orientation, values: [1], decimals: 0 }), null);
        const res = lay ? 1 / lay.stripLengthIn : null;
        const warn = h('div');
        const check = () => {
            clear(warn);
            if (lay && st.refineStep * lay.stripLengthIn < 0.25) {
                const frac = st.refineStep * lay.stripLengthIn;
                warn.append(h('p.warn', `Neighbouring strips differ by only ${fmt(frac, 3)} of a band over this ${fmt(lay.stripLengthIn, 2)} in strip (one full band ≈ ${fmt(res, 3)} LPI). Single strips will look alike: pick the MIDDLE of the run of cleanest strips, or use a longer (landscape) sheet or a coarser step.`));
            }
            let n = 0;
            try { n = st.coarseSelected != null ? refineCandidates(st.coarseSelected, st.refineHalfRange, st.refineStep).length : 0; } catch (e) { warn.append(h('p.warn', e.message)); }
            if (n) warn.append(h('p.muted.small', `${n} fine candidates.`));
        };
        const upd = k => v => { if (v != null && v > 0) { st[k] = v; save(); check(); } };
        const rangeF = numberField('Refine range (±)', st.refineHalfRange, { unit: 'LPI', min: 0.0001, onInput: upd('refineHalfRange') });
        const stepF = numberField('Refine step', st.refineStep, { unit: 'LPI', min: 0.0001, onInput: upd('refineStep') });
        // 'change' = committed (Enter / blur): rebuild so the candidate list matches.
        [rangeF, stepF].forEach(f => f.input.addEventListener('change', () => { sheets.fine = null; render(); }));
        const disabled = st.coarseSelected == null;
        const card = h('div.card.step' + (disabled ? '.disabled' : ''),
            h('h2', h('span.step-n', '5'), 'Refine'),
            disabled ? h('p.muted', 'Select a coarse result first.') : h('p', `Centred on your coarse pick of `, h('strong', `${st.coarseSelected} LPI`), '. Print this second sheet and pick again.'),
            h('div.grid2', rangeF.el, stepF.el),
            warn,
            disabled ? null : stepGenerate('fine'),
            disabled ? null : stepSelect('fine'),
            disabled ? null : h('p.muted.small', 'You can refine again: pick a fine result, set it as the new centre with a smaller step, and print again. Any decimal precision is allowed.'),
            disabled || st.fineSelected == null ? null : (() => {
                const b = h('button', { type: 'button' }, `Use ${st.fineSelected} as the new centre and refine again`);
                b.addEventListener('click', () => { st.coarseSelected = st.fineSelected; st.fineSelected = null; st.refineHalfRange = roundNice(st.refineHalfRange / 5); st.refineStep = roundNice(st.refineStep / 5); save(); sheets.fine = null; render(); });
                return b;
            })(),
        );
        check();
        return card;
    }

    // ---------------------------------------------------------------- phase
    function stepPhase() {
        const r = effectiveResult();
        const list = h('div.cand-list');
        if (r) {
            phaseCandidates(st.phaseCount).forEach((v, i) => {
                const b = h('button.cand', { type: 'button', 'aria-pressed': String(st.phaseSelected === v) }, h('span.cand-n', '#' + (i + 1)), v.toFixed(3));
                b.addEventListener('click', () => { st.phaseSelected = v; save(); render(); });
                list.appendChild(b);
            });
        }
        return h('details.card.step' + (r ? '' : '.disabled'), { open: st.phaseSelected != null },
            h('summary', h('h2', h('span.step-n', '6'), 'Optional: phase / registration test', helpTip('phase'))),
            h('p', 'Pitch decides whether the pattern stays in step across the print. ', h('strong', 'Phase'), ' decides which frame you see when looking straight on. It depends on exactly where the lens sits on the paper, so it is only worth measuring if you will always place the lens the same way (e.g. pushed into the same paper corner).'),
            h('p.muted', 'The sheet prints the same pitch several times, each strip shifted by a fraction of a ridge. Place the lens against your reference corner, look straight on, and pick the strip that looks most solid BLACK. Without a phase measurement, the Create tab still lets you shift phase manually.'),
            r ? h('div', numberField('Number of phase strips', st.phaseCount, { min: 2, max: 32, step: 1, onInput: v => { if (v >= 2 && v <= 32) { st.phaseCount = Math.round(v); save(); } } }).el, stepGenerate('phase'), list,
                st.phaseSelected != null ? (() => { const b = h('button', { type: 'button' }, 'Clear phase'); b.addEventListener('click', () => { st.phaseSelected = null; save(); render(); }); return b; })() : null)
                : h('p.muted', 'Find the pitch first.'),
        );
    }

    // ----------------------------------------------------------------- save
    function stepSave() {
        const r = effectiveResult();
        const lenses = app.lenses.list();
        let target = lenses.length ? lenses[0].id : '__new';
        const nameF = textField('New profile name', `My ${st.nominalLpi} LPI lens`);
        const matF = textField('Material', 'PET');
        const thickF = numberField('Thickness', 450, { unit: 'µm' });
        const wF = numberField('Lens sheet width', 210, { unit: 'mm' });
        const hF = numberField('Lens sheet height', 297, { unit: 'mm' });
        const notesF = textField('Calibration notes', '', { placeholder: 'e.g. viewed at 50 cm, Epson ET-8550, matte paper' });
        const newBox = h('div.grid2', nameF.el, matF.el, thickF.el, wF.el, hF.el);
        const sel = selectField('Save into', target, [...lenses.map(l => [l.id, `${l.name} (${l.effectiveLpi ?? 'uncalibrated'})`]), ['__new', '+ New lens profile']], {
            onChange: v => { target = v; newBox.hidden = v !== '__new'; },
        });
        newBox.hidden = target !== '__new';
        const btn = h('button.primary', { type: 'button', disabled: !r }, r ? `Save ${r.value} LPI to lens profile` : 'Nothing measured yet');
        btn.addEventListener('click', () => {
            const printer = st.printerProfileId && app.printers.get(st.printerProfileId);
            const history = {
                date: new Date().toISOString(),
                stage: r.stage,
                selectedLpi: r.value,
                coarse: { min: st.minLpi, max: st.maxLpi, step: st.coarseStep, selected: st.coarseSelected },
                fine: st.fineSelected != null ? { halfRange: st.refineHalfRange, step: st.refineStep, selected: st.fineSelected } : null,
                phase: st.phaseSelected,
                bandCount: st.bandCount,
                dpi: st.dpi, sheetMm: [st.widthMm, st.heightMm], orientation: st.orientation,
                printerProfileId: printer?.id || null, notes: notesF.input.value,
            };
            const base = target === '__new'
                ? makeLensProfile({ name: nameF.input.value || 'My lens', nominalLpi: st.nominalLpi, material: matF.input.value, thicknessUm: Number(thickF.input.value) || null, widthMm: Number(wF.input.value) || null, heightMm: Number(hF.input.value) || null })
                : app.lenses.get(target);
            const saved = app.lenses.save({
                ...base,
                nominalLpi: st.nominalLpi,
                effectiveLpi: r.value,
                calibrationStatus: r.stage,
                orientation: st.orientation,
                phase: st.phaseSelected ?? base.phase ?? 0,
                calibratedWith: { printerProfileId: printer?.id || null, printerName: printer?.name || '', dpi: st.dpi },
                calibrationHistory: [...(base.calibrationHistory || []), history],
                notes: [base.notes, notesF.input.value].filter(Boolean).join('\n'),
            });
            app.emit('profiles');
            toast(`Saved "${saved.name}": effective ${saved.effectiveLpi} LPI`, 'good');
            render();
        });
        return h('div.card.step' + (r ? '' : '.disabled'),
            h('h2', h('span.step-n', '7'), 'Save as a lens profile'),
            r ? h('p', 'Stores the nominal ', h('strong', `${st.nominalLpi}`), ' and your measured ', h('strong', `${r.value} LPI`), ` (${r.stage}), the orientation, DPI and printer used, and the full test history.`) : h('p.muted', 'Select a result from a printed test first.'),
            sel.el, newBox, notesF.el, btn);
    }

    render();
    app.on('profiles', () => { if (!root.hidden) render(); });
    return { refresh: render };
}

function printWarning() {
    return h('div.print-warning', '⚠ PRINT AT 100% / ACTUAL SIZE. DISABLE FIT-TO-PAGE AND AUTOMATIC SCALING.');
}
function row(k, v) { return h('div.drow', h('span.k', k), h('span.v', v)); }
function safe(fn, dflt) { try { return fn(); } catch { return dflt; } }
function roundNice(v) { return Number(v.toPrecision(2)); }
