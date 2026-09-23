// ====================================================================
// settingsView.mjs — SETTINGS tab
// ====================================================================

import { h, clear, numberField, toast, downloadBytes } from './dom.mjs';
import { DEFAULT_CALIBRATION } from '../core/profiles.mjs';

export function mountSettings(root, app) {
    function render() {
        clear(root);
        const s = app.settings;
        const upd = k => v => { if (v != null) { s[k] = v; app.saveSettings(); } };
        const chk = (k, label) => {
            const c = h('input', { type: 'checkbox', checked: !!s[k] });
            c.addEventListener('change', () => { s[k] = c.checked; app.saveSettings(); });
            return h('label.check', c, label);
        };
        const backup = h('button', { type: 'button' }, 'Export all data (backup JSON)');
        backup.addEventListener('click', () => {
            const data = { format: 'lenticular-workbench-backup', version: 1, date: new Date().toISOString(), lenses: app.lenses.list(), printers: app.printers.list(), calibration: app.calibration, settings: app.settings };
            downloadBytes(new TextEncoder().encode(JSON.stringify(data, null, 2)), 'lenticular-workbench-backup.json', 'application/json');
        });
        const resetCal = h('button', { type: 'button' }, 'Reset calibration session to defaults');
        resetCal.addEventListener('click', () => {
            if (!confirm('Reset the calibration settings and selections? Saved lens profiles are not affected.')) return;
            Object.assign(app.calibration, DEFAULT_CALIBRATION);
            app.saveCalibration();
            toast('Calibration session reset', 'good');
        });
        root.append(
            h('div.lw-page-head', h('h1', 'Settings')),
            h('div.card',
                h('h2', 'Defaults & display'),
                h('div.grid2',
                    numberField('Default printer DPI', s.defaultDpi, { unit: 'DPI', min: 50, help: 'dpi', onInput: upd('defaultDpi') }).el,
                    numberField('Ghost overlay opacity', s.ghostOpacity, { unit: '%', min: 0, max: 100, onInput: upd('ghostOpacity') }).el,
                    numberField('Alignment editor size', s.editorMaxPx, { unit: 'screen px', min: 240, onInput: upd('editorMaxPx') }).el,
                    numberField('Preview size', s.previewMaxPx, { unit: 'screen px', min: 240, onInput: upd('previewMaxPx') }).el),
                chk('previewGrid', 'Draw lenticule boundaries on the simulated preview'),
                chk('previewSnap', 'Simulated preview shows clean frames (snap to strip centres)')),
            h('div.card',
                h('h2', 'Data'),
                h('p.muted', app.persistent ? 'Profiles and settings are stored in this browser (localStorage). Nothing is uploaded anywhere. Export backups if you clear browser data.' : 'Browser storage is unavailable (private mode?) — profiles will NOT survive a reload. Export them.'),
                h('div.btn-row', backup, resetCal)),
            h('div.card',
                h('h2', 'How the numbers work'),
                h('ul',
                    h('li', 'Pitch = 1 ÷ LPI. Printer pixels per lenticule = DPI ÷ LPI (kept fractional, never rounded).'),
                    h('li', 'Output pixels = physical size × DPI, rounded once to a whole pixel.'),
                    h('li', 'Every pixel\'s frame is chosen from its absolute position under the lens, so small pitch fractions never accumulate into drift across the print.'),
                    h('li', 'A lenticule flips the strip underneath it: the strip at the ridge\'s left edge is seen from the right. Frames are laid out so moving left → right shows them in your chosen order.'),
                    h('li', 'See docs/INTERLACING_METHOD.md in the project for the full method and references.'))),
        );
    }
    render();
    return { refresh: render };
}
