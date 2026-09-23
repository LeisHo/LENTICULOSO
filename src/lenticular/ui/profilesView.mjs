// ====================================================================
// profilesView.mjs — LENS PROFILES and PRINTER PROFILES tabs
// ====================================================================
// Two separate collections with the same operations: save, load (select),
// rename, duplicate, delete, export JSON, import JSON.
// ====================================================================

import { h, clear, numberField, textField, selectField, groupedSelectField, orientationPicker, downloadBytes, toast, helpTip, fmt } from './dom.mjs';
import { makeLensProfile, makePrinterProfile, makePaperProfile } from '../core/profiles.mjs';
import { PRINTER_PRESETS, PAPER_PRESETS, LENTICULAR_SUITABILITY, epsonDriverSettingFor, thicknessUm } from '../core/presets.mjs';
import { lpiToPitchMm } from '../core/units.mjs';

export function mountLensProfiles(root, app) {
    return mountCollection(root, app, {
        store: app.lenses,
        title: 'Lens profiles',
        intro: 'A lens profile describes one physical lens sheet. "Nominal" is the seller\'s figure; "effective" is only ever what you selected from a printed test (or typed in deliberately).',
        make: makeLensProfile,
        filePrefix: 'lens',
        summary: p => [
            p.effectiveLpi != null ? `${p.effectiveLpi} LPI effective` : 'uncalibrated',
            `nominal ${p.nominalLpi}`,
            p.orientation,
        ].join(' · '),
        editor: lensEditor,
    });
}

// The PRINTER PROFILES tab holds two independent collections: printers and
// papers. Paper is its own entity rather than a text field on the printer:
// the same paper is used in many printers, and a lens calibration records
// which paper it was measured on.
export function mountPrinterProfiles(root, app) {
    const printerRoot = h('div');
    const paperRoot = h('div.paper-section');
    root.append(printerRoot, paperRoot);
    const a = mountCollection(printerRoot, app, {
        store: app.printers,
        title: 'Printer profiles',
        intro: 'A printer profile is independent of any lens: the same printer can be used with several lenses. DPI here is the resolution the image is built at and must match what the driver prints at. Start from a built-in Epson EcoTank preset, or enter your own.',
        make: p => makePrinterProfile({ dpi: app.settings.defaultDpi, ...p }),
        filePrefix: 'printer',
        summary: p => `${p.dpi} DPI${p.model ? ' · ' + p.model : ''}${p.media ? ' · ' + p.media : ''}`,
        editor: printerEditor,
        extra: printerPresetTable,
    });
    const b = mountCollection(paperRoot, app, {
        store: app.papers,
        title: 'Papers',
        intro: 'Paper matters for lenticular prints: glossy resin-coated photo paper keeps each thin strip sharp and holds its size; plain paper blurs the strips and stretches under ink, which shifts the pitch. The built-in Epson, Canon and HP papers are always available in every paper menu; add your own here.',
        make: p => makePaperProfile(p),
        filePrefix: 'paper',
        summary: p => [p.finish, p.gsm ? p.gsm + ' g/m²' : null, (LENTICULAR_SUITABILITY[p.lenticular] || '').split(' —')[0]].filter(Boolean).join(' · '),
        editor: paperEditor,
        extra: paperPresetTable,
    });
    return { refresh: () => { a.refresh(); b.refresh(); } };
}

function mountCollection(root, app, cfg) {
    let selectedId = null;
    let draft = null;

    function render() {
        const list = cfg.store.list();
        if (selectedId && !list.find(p => p.id === selectedId)) selectedId = null;
        if (!draft || (draft.id !== selectedId && selectedId)) draft = selectedId ? cfg.store.get(selectedId) : null;
        clear(root);
        const fileIn = h('input', { type: 'file', accept: '.json,application/json', hidden: true });
        fileIn.addEventListener('change', async () => {
            const f = fileIn.files[0];
            if (!f) return;
            try {
                const p = cfg.store.importJSON(await f.text());
                selectedId = p.id; draft = p;
                app.emit('profiles');
                toast(`Imported "${p.name}"`, 'good');
                render();
            } catch (e) { toast('Import failed: ' + e.message, 'error'); }
            fileIn.value = '';
        });
        const newBtn = h('button.primary', { type: 'button' }, '+ New');
        newBtn.addEventListener('click', () => { draft = cfg.make({}); selectedId = null; render(); });
        const impBtn = h('button', { type: 'button' }, 'Import JSON');
        impBtn.addEventListener('click', () => fileIn.click());

        const items = h('div.prof-list', list.length ? list.map(p => {
            const b = h('button.prof-item', { type: 'button', 'aria-pressed': String(p.id === selectedId) },
                h('span.prof-name', p.name), h('span.prof-sum', cfg.summary(p)));
            b.addEventListener('click', () => { selectedId = p.id; draft = cfg.store.get(p.id); render(); });
            return b;
        }) : h('p.muted', 'None yet.'));

        root.append(
            h('div.lw-page-head', h('h1', cfg.title), h('p.lead', cfg.intro)),
            h('div.prof-layout',
                h('div.card', h('div.btn-row', newBtn, impBtn, fileIn), items),
                draft ? editorCard() : h('div.card', h('p.muted', 'Select a profile, or create a new one.'))),
        );
        if (cfg.extra) root.append(cfg.extra());
    }

    function editorCard() {
        const isSaved = !!cfg.store.get(draft.id);
        const saveBtn = h('button.primary', { type: 'button' }, isSaved ? 'Save changes' : 'Save profile');
        saveBtn.addEventListener('click', () => {
            try {
                const p = cfg.store.save(draft);
                selectedId = p.id; draft = p;
                app.emit('profiles');
                toast(`Saved "${p.name}"`, 'good');
                render();
            } catch (e) { toast(e.message, 'error'); }
        });
        const act = (label, fn, cls = '') => {
            const b = h('button' + cls, { type: 'button', disabled: !isSaved }, label);
            b.addEventListener('click', fn);
            return b;
        };
        const buttons = h('div.btn-row', saveBtn,
            act('Rename', () => {
                const name = prompt('New name', draft.name);
                if (!name) return;
                const p = cfg.store.rename(draft.id, name);
                draft = p; app.emit('profiles'); render();
            }),
            act('Duplicate', () => {
                const p = cfg.store.duplicate(draft.id);
                selectedId = p.id; draft = p; app.emit('profiles'); toast(`Duplicated as "${p.name}"`, 'good'); render();
            }),
            act('Export JSON', () => {
                downloadBytes(new TextEncoder().encode(cfg.store.exportJSON(draft.id)), `${cfg.filePrefix}-${slug(draft.name)}.json`, 'application/json');
            }),
            act('Delete', () => {
                if (!confirm(`Delete "${draft.name}"? This cannot be undone (export it first if unsure).`)) return;
                cfg.store.remove(draft.id);
                selectedId = null; draft = null; app.emit('profiles'); render();
            }, '.danger'),
        );
        return h('div.card', cfg.editor(draft, app), buttons);
    }

    render();
    app.on('profiles', () => { if (root.hidden) draft = null; });
    return { refresh: () => { draft = null; render(); } };
}

function lensEditor(d) {
    const set = k => v => { d[k] = v; };
    const eff = numberField('Effective LPI (calibrated)', d.effectiveLpi, { unit: 'LPI', help: 'lpi', onInput: v => { d.effectiveLpi = v; d.calibrationStatus = v == null ? 'uncalibrated' : (d.calibrationStatus === 'uncalibrated' ? 'manual' : d.calibrationStatus); } });
    const hist = (d.calibrationHistory || []).slice().reverse();
    return h('div',
        h('div.grid2',
            textField('Name', d.name, { onInput: set('name') }).el,
            numberField('Nominal LPI (seller)', d.nominalLpi, { unit: 'LPI', onInput: set('nominalLpi') }).el,
            eff.el,
            h('div.field', h('span.field-label', 'Status'), h('span.badge.badge-' + d.calibrationStatus, statusText(d))),
            textField('Material', d.material, { onInput: set('material') }).el,
            numberField('Thickness', d.thicknessUm, { unit: 'µm', onInput: set('thicknessUm') }).el,
            numberField('Sheet width', d.widthMm, { unit: 'mm', onInput: set('widthMm') }).el,
            numberField('Sheet height', d.heightMm, { unit: 'mm', onInput: set('heightMm') }).el,
            numberField('Phase / registration', d.phase, { unit: 'lenticule', min: 0, max: 0.999, step: 0.001, help: 'phase', onInput: v => { d.phase = v ?? 0; } }).el,
            h('div.field', h('span.field-label', 'Calibrated with'), h('span', d.calibratedWith?.dpi ? `${d.calibratedWith.dpi} DPI${d.calibratedWith.printerName ? ' · ' + d.calibratedWith.printerName : ''}` : '—')),
            textField('Printer info (free text)', d.calibratedWith?.printerName, { onInput: v => { d.calibratedWith = { ...d.calibratedWith, printerName: v }; } }).el,
            numberField('Calibration DPI', d.calibratedWith?.dpi, { unit: 'DPI', onInput: v => { d.calibratedWith = { ...d.calibratedWith, dpi: v }; } }).el,
        ),
        orientationPicker(d.orientation, v => { d.orientation = v; }),
        h('label.field', h('span.field-label', 'Notes'), (() => { const t = h('textarea', { rows: 3 }, d.notes || ''); t.addEventListener('input', () => { d.notes = t.value; }); return t; })()),
        h('p.muted.small', `Pitch: nominal ${fmt(lpiToPitchMm(d.nominalLpi), 5)} mm` + (d.effectiveLpi ? ` · effective ${fmt(lpiToPitchMm(d.effectiveLpi), 5)} mm` : '')),
        hist.length ? h('details', h('summary', `Calibration history (${hist.length})`),
            h('ul.hist', hist.map(x => h('li', `${x.date.slice(0, 16).replace('T', ' ')} — ${x.stage}: ${x.selectedLpi} LPI @ ${x.dpi} DPI` +
                (x.coarse ? ` (coarse ${x.coarse.min}–${x.coarse.max} step ${x.coarse.step}` + (x.fine ? `; fine ±${x.fine.halfRange} step ${x.fine.step}` : '') + ')' : '') +
                (x.phase != null ? ` · phase ${x.phase}` : '') + (x.notes ? ` · ${x.notes}` : ''))))) : null,
        helpTip('pitch'),
    );
}

function printerEditor(d) {
    const set = k => v => { d[k] = v; };
    const fromPreset = groupedSelectField('Start from preset', d.presetId || '', [
        [null, [['', '— none —']]],
        ['Epson EcoTank', PRINTER_PRESETS.map(p => [p.id, `${p.brand} ${p.model}`])],
    ], {
        onChange: v => {
            const p = PRINTER_PRESETS.find(x => x.id === v);
            if (!p) { d.presetId = null; d.nativeDpi = null; return; }
            Object.assign(d, { presetId: p.id, nativeDpi: p.nativeDpi.slice(), dpi: p.dpi, model: `${p.brand} ${p.model}`, notes: p.notes });
            if (!d.name || d.name === 'Untitled printer') d.name = `My ${p.model}`;
            // re-render the editor so its fields show the preset's values
            const card = fromPreset.el.closest('.card');
            card.replaceChild(printerEditor(d), card.firstChild);
        },
    });
    return h('div', fromPreset.el, h('div.grid2',
        textField('Name', d.name, { onInput: set('name') }).el,
        textField('Model', d.model, { onInput: set('model'), placeholder: 'e.g. Epson ET-8550' }).el,
        numberField('DPI / PPI', d.dpi, { unit: 'DPI', min: 50, help: 'dpi', onInput: set('dpi') }).el,
        textField('Media / paper', d.media, { onInput: set('media'), placeholder: 'e.g. glossy photo paper' }).el,
        textField('Notes', d.notes, { onInput: set('notes') }).el,
    ), d.nativeDpi ? h('p.muted.small', `Driver native input resolution: ${d.nativeDpi.join(' / ')} DPI — build images at ${Math.max(...d.nativeDpi)}.`) : null);
}

function paperEditor(d) {
    const set = k => v => { d[k] = v; };
    const fromPreset = groupedSelectField('Start from preset', d.presetId || '', [
        [null, [['', '— none —']]],
        ...['Epson', 'Canon', 'HP', 'Any'].map(b => [b === 'Any' ? 'Plain paper' : b, PAPER_PRESETS.filter(p => p.brand === b).map(p => [p.id, p.model])]),
    ], {
        onChange: v => {
            const p = PAPER_PRESETS.find(x => x.id === v);
            if (!p) { d.presetId = null; return; }
            Object.assign(d, { presetId: p.id, brand: p.brand, model: p.model, finish: p.finish, base: p.base, gsm: p.gsm, thicknessMil: p.thicknessMil, lenticular: p.lenticular, driverSetting: p.driverSetting });
            if (!d.name || d.name === 'Untitled paper') d.name = `${p.brand} ${p.model}`;
            const card = fromPreset.el.closest('.card');
            card.replaceChild(paperEditor(d), card.firstChild);
        },
    });
    return h('div', fromPreset.el, h('div.grid2',
        textField('Name', d.name, { onInput: set('name') }).el,
        textField('Brand', d.brand, { onInput: set('brand') }).el,
        textField('Model', d.model, { onInput: set('model') }).el,
        selectField('Finish', d.finish, [['glossy', 'Glossy'], ['semi-gloss', 'Semi-gloss / satin'], ['luster', 'Luster'], ['matte', 'Matte'], ['plain', 'Plain (uncoated)'], ['other', 'Other']], { onChange: set('finish') }).el,
        numberField('Weight', d.gsm, { unit: 'g/m²', min: 1, onInput: set('gsm') }).el,
        numberField('Thickness', d.thicknessMil, { unit: 'mil', min: 0.1, step: 0.1, onInput: set('thicknessMil') }).el,
        selectField('Lenticular suitability', d.lenticular, Object.entries(LENTICULAR_SUITABILITY), { help: 'paper', onChange: set('lenticular') }).el,
        textField('Driver paper-type setting', d.driverSetting, { onInput: set('driverSetting'), placeholder: epsonDriverSettingFor(d) || 'as named in your printer driver' }).el,
        textField('Notes', d.notes, { onInput: set('notes') }).el,
    ));
}

// Reference tables of the built-in presets, with their sources.
function sourceLinks(urls) {
    return urls.map((u, i) => h('a', { href: u, target: '_blank', rel: 'noopener' }, i ? ` [${i + 1}]` : 'link'));
}

function printerPresetTable() {
    return h('details.card', h('summary', h('h2', `Built-in printer presets (${PRINTER_PRESETS.length} Epson EcoTank models)`)),
        h('p.muted.small', 'All Epson presets build images at 720 DPI: Epson drivers accept image data at 720 ppi (360 in lower-quality modes) and resample anything else, which would smear the lenticular strips. Blank cells were not found in the sources and are left blank rather than guessed.'),
        h('div.table-wrap', h('table.ref-table',
            h('thead', h('tr', ['Model', 'Build at', 'Max print res.', 'Max sheet', 'Borderless', 'Ink', 'Source'].map(t => h('th', t)))),
            h('tbody', PRINTER_PRESETS.map(p => h('tr',
                h('td', `${p.brand} ${p.model}`), h('td', `${p.dpi} DPI`), h('td', p.maxPrintResolution || ''), h('td', p.maxSheet || ''),
                h('td', p.borderless || ''), h('td', p.ink || ''), h('td', sourceLinks(p.sources))))))));
}

function paperPresetTable() {
    return h('details.card', h('summary', h('h2', `Built-in papers (${PAPER_PRESETS.length})`)),
        h('p.muted.small', 'Weights and thicknesses are the manufacturers’ published figures (blank = not found). Thickness does not affect the lens optics (the lens focuses on its own back surface) but matters for feeding and lamination. Suitability ratings are this app’s judgement from the coating type.'),
        h('div.table-wrap', h('table.ref-table',
            h('thead', h('tr', ['Brand', 'Paper', 'Finish', 'Weight', 'Thickness', 'Lenticular', 'Epson driver setting', 'Source'].map(t => h('th', t)))),
            h('tbody', PAPER_PRESETS.map(p => h('tr',
                h('td', p.brand), h('td', p.model), h('td', p.finish), h('td', p.gsm ? `${p.gsm} g/m²` : ''),
                h('td', p.thicknessMil ? `${p.thicknessMil} mil (${thicknessUm(p)} µm)` : ''),
                h('td', LENTICULAR_SUITABILITY[p.lenticular].split(' —')[0]),
                h('td', epsonDriverSettingFor(p) || ''), h('td', sourceLinks(p.sources))))))));
}

function statusText(d) {
    return { uncalibrated: 'Uncalibrated — nominal only', coarse: 'Coarse test result', fine: 'Fine test result', manual: 'Entered manually' }[d.calibrationStatus] || d.calibrationStatus;
}
function slug(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'profile'; }
