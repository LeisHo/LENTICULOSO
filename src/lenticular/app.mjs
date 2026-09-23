// ====================================================================
// app.mjs — Lenticular Workbench shell: state, stores, navigation
// ====================================================================
// Everything runs client-side. Persistence is browser localStorage:
//   lw.lenses       lens profiles           (core/profiles.mjs)
//   lw.printers     printer profiles        (core/profiles.mjs)
//   lw.calibration  calibration session     (core/profiles.mjs)
//   lw.settings     app settings            (this file)
//   lw.create       Create-tab settings (not images — images are never
//                   persisted; they stay in memory for the session)
// ====================================================================

import { h, clear } from './ui/dom.mjs';
import {
    createProfileStore, makeLensProfile, makePrinterProfile, validateLens, validatePrinter,
    memoryStorage, loadCalibrationState, saveCalibrationState,
} from './core/profiles.mjs';
import { mountCalibrate } from './ui/calibrateView.mjs';
import { mountCreate } from './ui/createView.mjs';
import { mountLensProfiles, mountPrinterProfiles } from './ui/profilesView.mjs';
import { mountSettings } from './ui/settingsView.mjs';

export const DEFAULT_SETTINGS = {
    defaultDpi: 600,
    editorMaxPx: 720,       // alignment editor canvas longest side (screen px)
    previewMaxPx: 720,      // simulated preview longest side (screen px)
    ghostOpacity: 50,       // % for the alignment overlay
    previewGrid: false,     // draw lenticule boundaries over the simulation
    previewSnap: true,      // simulation samples slot centres (clean frames)
};

function safeStorage() {
    try {
        const k = '__lw_probe__';
        localStorage.setItem(k, '1');
        localStorage.removeItem(k);
        return localStorage;
    } catch {
        return memoryStorage(); // private mode: works, but nothing survives reload
    }
}

export function createWorkbench(root) {
    const storage = safeStorage();
    const app = {
        storage,
        persistent: storage !== undefined && typeof localStorage !== 'undefined' && storage === localStorage,
        lenses: createProfileStore(storage, 'lw.lenses', makeLensProfile, validateLens),
        printers: createProfileStore(storage, 'lw.printers', makePrinterProfile, validatePrinter),
        calibration: loadCalibrationState(storage, 'lw.calibration'),
        settings: { ...DEFAULT_SETTINGS, ...readJSON(storage, 'lw.settings') },
        saveCalibration() { saveCalibrationState(storage, 'lw.calibration', app.calibration); },
        saveSettings() { storage.setItem('lw.settings', JSON.stringify(app.settings)); emit('settings'); },
        listeners: {},
        on(evt, fn) { (app.listeners[evt] ||= []).push(fn); },
        emit,
        go,
    };
    function emit(evt, data) { (app.listeners[evt] || []).forEach(fn => fn(data)); }

    const TABS = [
        ['calibrate', 'Calibrate', mountCalibrate],
        ['create', 'Create', mountCreate],
        ['lenses', 'Lens Profiles', mountLensProfiles],
        ['printers', 'Printer Profiles', mountPrinterProfiles],
        ['settings', 'Settings', mountSettings],
    ];

    const nav = h('nav.lw-nav', { 'aria-label': 'Main' });
    const main = h('main.lw-main#lwMain');
    const header = h('header.lw-header#lwHeader',
        h('div.lw-brand', h('span.lw-logo', '▥'), h('span', 'Lenticular Workbench')),
        nav);
    clear(root);
    root.append(header, main);

    const views = {};
    const panes = {};
    const buttons = {};
    for (const [id, label, mount] of TABS) {
        const b = h('button.lw-tab', { type: 'button', 'data-tab': id }, label);
        b.addEventListener('click', () => go(id));
        nav.appendChild(b);
        buttons[id] = b;
        const pane = h('section.lw-pane', { 'data-pane': id, hidden: true });
        main.appendChild(pane);
        panes[id] = pane;
        views[id] = { mount, mounted: null };
    }

    function go(id) {
        for (const k of Object.keys(panes)) {
            panes[k].hidden = k !== id;
            buttons[k].setAttribute('aria-current', k === id ? 'page' : 'false');
        }
        const v = views[id];
        if (!v.mounted) v.mounted = v.mount(panes[id], app) || {};
        else if (v.mounted.refresh) v.mounted.refresh();
        try { storage.setItem('lw.tab', id); } catch { /* ignore */ }
        main.scrollTop = 0;
    }

    let first = 'calibrate';
    try { first = storage.getItem('lw.tab') || (app.lenses.list().some(l => l.effectiveLpi) ? 'create' : 'calibrate'); } catch { /* ignore */ }
    if (!panes[first]) first = 'calibrate';
    go(first);

    window.lenticularWorkbench = app; // for the dev panel + debugging
    return { app, header, main };
}

function readJSON(storage, key) {
    try { return JSON.parse(storage.getItem(key) || '{}') || {}; } catch { return {}; }
}
