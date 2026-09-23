// ====================================================================
// app.mjs — Lenticular Workbench shell: state, stores, navigation
// ====================================================================
// Everything runs client-side. Persistence is browser localStorage:
//   lw.lenses       lens profiles           (core/profiles.mjs)
//   lw.printers     printer profiles        (core/profiles.mjs)
//   lw.papers       custom paper profiles   (core/profiles.mjs; built-in
//                   paper/printer presets are data in core/presets.mjs)
//   lw.calibration  calibration session     (core/profiles.mjs)
//   lw.settings     app settings            (this file)
//   lw.create       Create-tab settings (not images — images are never
//                   persisted; they stay in memory for the session)
// ====================================================================

import { h, clear } from './ui/dom.mjs';
import {
    createProfileStore, makeLensProfile, makePrinterProfile, makePaperProfile, validateLens, validatePrinter, validatePaper,
    memoryStorage, loadCalibrationState, saveCalibrationState,
} from './core/profiles.mjs';
import { mountCalibrate } from './ui/calibrateView.mjs';
import { mountCreate } from './ui/createView.mjs';
import { mountLensProfiles, mountPrinterProfiles } from './ui/profilesView.mjs';
import { mountSettings } from './ui/settingsView.mjs';
import { createSync } from './sync.mjs';
import { createProjectsClient } from './ui/projectsClient.mjs';

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
    // The app reads/writes through the sync wrapper: localStorage stays the
    // working copy, and synced keys are mirrored to git (sync.mjs) once the
    // host attaches its remote (src/main.js → attachRemote).
    const sync = createSync(safeStorage());
    const storage = sync.storage;
    const app = {
        storage,
        sync,
        projects: null,   // saved-projects client, set by attachRemote()
        persistent: storage !== undefined && typeof localStorage !== 'undefined' && storage === localStorage,
        lenses: createProfileStore(storage, 'lw.lenses', makeLensProfile, validateLens),
        printers: createProfileStore(storage, 'lw.printers', makePrinterProfile, validatePrinter),
        papers: createProfileStore(storage, 'lw.papers', makePaperProfile, validatePaper),
        calibration: loadCalibrationState(storage, 'lw.calibration'),
        settings: { ...DEFAULT_SETTINGS, ...readJSON(storage, 'lw.settings') },
        saveCalibration() { saveCalibrationState(storage, 'lw.calibration', app.calibration); },
        saveSettings() { storage.setItem('lw.settings', JSON.stringify(app.settings)); emit('settings'); },
        listeners: {},
        on(evt, fn) { (app.listeners[evt] ||= []).push(fn); },
        /** Host hook: connect the git remote, pull, and refresh if git had newer data. */
        attachRemote(remote) {
            if (remote.secret) { app.projects = createProjectsClient(remote.secret); emit('projects-ready'); }
            sync.attach(remote);
            sync.pull().then(result => {
                if (result !== 'applied') return;
                Object.assign(app.calibration, loadCalibrationState(storage, 'lw.calibration'));
                Object.assign(app.settings, { ...DEFAULT_SETTINGS, ...readJSON(storage, 'lw.settings') });
                emit('profiles');
                emit('settings');
                const current = Object.keys(panes).find(k => !panes[k].hidden);
                if (current && views[current].mounted?.refresh) views[current].mounted.refresh();
            });
        },
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
    const syncBadge = h('span.lw-sync', { title: 'Where your profiles are saved' }, 'Saved in this browser');
    const SYNC_TEXT = { local: 'Saved in this browser', loading: 'Loading from git…', synced: 'Synced to git ✓', saving: 'Saving to git…', error: 'Git sync failed — saved in this browser' };
    sync.onStatus(s => { syncBadge.textContent = SYNC_TEXT[s] || s; syncBadge.dataset.state = s; });
    const header = h('header.lw-header#lwHeader',
        h('div.lw-brand', h('span.lw-logo', '▥'), h('span', 'Lenticular Workbench')),
        nav, syncBadge);
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
