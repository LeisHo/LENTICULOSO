// ====================================================================
// profiles.mjs — lens profiles, printer profiles, and their stores (pure)
// ====================================================================
// LENS and PRINTER are separate entities on purpose: one lens can be used
// with several printers and vice versa. A lens profile records WHICH
// printer/DPI its calibration was done with (calibratedWith) because the
// calibration result is a property of that print chain (a printer that
// scales by 0.2% shifts the apparent pitch by 0.2%) — but it does not OWN
// a printer. The Create tab combines one of each.
//
// The store takes an injected Storage-like object ({getItem,setItem}), so
// the browser uses localStorage and the tests use an in-memory stand-in.
// ====================================================================

export const PROFILE_SCHEMA_VERSION = 1;

export function newId(prefix) {
    const rnd = Math.random().toString(36).slice(2, 8);
    return prefix + '-' + Date.now().toString(36) + '-' + rnd;
}

/**
 * A lens profile. `effectiveLpi` is null until the user has actually
 * picked a result from a printed test — the seller's figure lives only in
 * `nominalLpi` and is never copied into `effectiveLpi` automatically.
 */
export function makeLensProfile(fields = {}) {
    return {
        kind: 'lens',
        schemaVersion: PROFILE_SCHEMA_VERSION,
        id: fields.id || newId('lens'),
        name: fields.name || 'Untitled lens',
        nominalLpi: num(fields.nominalLpi, 100),
        effectiveLpi: fields.effectiveLpi == null ? null : Number(fields.effectiveLpi),
        calibrationStatus: fields.calibrationStatus || (fields.effectiveLpi == null ? 'uncalibrated' : 'manual'),
        material: fields.material || '',
        thicknessUm: fields.thicknessUm == null ? null : Number(fields.thicknessUm),
        widthMm: fields.widthMm == null ? null : Number(fields.widthMm),
        heightMm: fields.heightMm == null ? null : Number(fields.heightMm),
        orientation: fields.orientation === 'horizontal' ? 'horizontal' : 'vertical',
        // Registration of the interlace relative to the ridges, in
        // lenticules (0…1). Only meaningful if the lens is placed against a
        // fixed reference (e.g. aligned to a paper corner) — see the Phase
        // Test explanation in the UI.
        phase: num(fields.phase, 0),
        calibratedWith: {
            printerProfileId: fields.calibratedWith?.printerProfileId || null,
            printerName: fields.calibratedWith?.printerName || '',
            dpi: fields.calibratedWith?.dpi == null ? null : Number(fields.calibratedWith.dpi),
            // The paper matters: its coating and dimensional stability are
            // part of the print chain the effective pitch was measured on.
            paperId: fields.calibratedWith?.paperId || null,
            paperName: fields.calibratedWith?.paperName || '',
        },
        calibrationHistory: Array.isArray(fields.calibrationHistory) ? fields.calibrationHistory.slice() : [],
        notes: fields.notes || '',
        createdAt: fields.createdAt || new Date().toISOString(),
        updatedAt: fields.updatedAt || new Date().toISOString(),
    };
}

export function makePrinterProfile(fields = {}) {
    return {
        kind: 'printer',
        schemaVersion: PROFILE_SCHEMA_VERSION,
        id: fields.id || newId('printer'),
        name: fields.name || 'Untitled printer',
        model: fields.model || '',
        dpi: num(fields.dpi, 600),
        // Set when the profile was started from a built-in preset; keeps
        // the preset's native-resolution list available for checks.
        presetId: fields.presetId || null,
        nativeDpi: Array.isArray(fields.nativeDpi) ? fields.nativeDpi.map(Number) : null,
        media: fields.media || '',
        notes: fields.notes || '',
        createdAt: fields.createdAt || new Date().toISOString(),
        updatedAt: fields.updatedAt || new Date().toISOString(),
    };
}

/** A user-defined paper (the built-in ones live in presets.mjs). */
export function makePaperProfile(fields = {}) {
    const finish = ['glossy', 'semi-gloss', 'luster', 'matte', 'plain', 'other'].includes(fields.finish) ? fields.finish : 'glossy';
    return {
        kind: 'paper',
        schemaVersion: PROFILE_SCHEMA_VERSION,
        id: fields.id || newId('paper'),
        name: fields.name || 'Untitled paper',
        brand: fields.brand || '',
        model: fields.model || '',
        finish,
        base: fields.base || '',
        gsm: fields.gsm == null || fields.gsm === '' ? null : Number(fields.gsm),
        thicknessMil: fields.thicknessMil == null || fields.thicknessMil === '' ? null : Number(fields.thicknessMil),
        lenticular: ['best', 'good', 'fair', 'poor'].includes(fields.lenticular) ? fields.lenticular : (finish === 'plain' ? 'poor' : finish === 'matte' ? 'fair' : 'good'),
        driverSetting: fields.driverSetting || null,
        presetId: fields.presetId || null,
        notes: fields.notes || '',
        createdAt: fields.createdAt || new Date().toISOString(),
        updatedAt: fields.updatedAt || new Date().toISOString(),
    };
}

export function validatePaper(p) {
    const e = [];
    if (!p.name || !String(p.name).trim()) e.push('Name is required.');
    if (p.gsm != null && !(p.gsm > 0)) e.push('Weight must be positive.');
    if (p.thicknessMil != null && !(p.thicknessMil > 0)) e.push('Thickness must be positive.');
    return e;
}

/** Validation messages for a lens profile (empty = OK). */
export function validateLens(p) {
    const e = [];
    if (!p.name || !String(p.name).trim()) e.push('Name is required.');
    if (!(p.nominalLpi > 0)) e.push('Nominal LPI must be positive.');
    if (p.effectiveLpi != null && !(p.effectiveLpi > 0)) e.push('Effective LPI must be positive.');
    if (!(p.phase >= 0 && p.phase < 1)) e.push('Phase must be in [0, 1) lenticules.');
    return e;
}

export function validatePrinter(p) {
    const e = [];
    if (!p.name || !String(p.name).trim()) e.push('Name is required.');
    if (!(p.dpi > 0)) e.push('DPI must be positive.');
    return e;
}

/**
 * Collection store for one profile kind.
 *   storage: {getItem(key), setItem(key, value)}
 *   factory: makeLensProfile | makePrinterProfile
 */
export function createProfileStore(storage, key, factory, validate) {
    function readAll() {
        try {
            const raw = storage.getItem(key);
            const arr = raw ? JSON.parse(raw) : [];
            return Array.isArray(arr) ? arr.map(p => factory(p)) : [];
        } catch {
            return [];
        }
    }
    function writeAll(list) { storage.setItem(key, JSON.stringify(list)); }

    return {
        list() { return readAll(); },
        get(id) { return readAll().find(p => p.id === id) || null; },
        save(profile) {
            const p = factory({ ...profile, updatedAt: new Date().toISOString() });
            const errs = validate(p);
            if (errs.length) throw new Error(errs.join(' '));
            const list = readAll();
            const i = list.findIndex(x => x.id === p.id);
            if (i >= 0) list[i] = p; else list.push(p);
            writeAll(list);
            return p;
        },
        rename(id, name) {
            const p = this.get(id);
            if (!p) throw new Error('No profile ' + id);
            return this.save({ ...p, name });
        },
        duplicate(id) {
            const p = this.get(id);
            if (!p) throw new Error('No profile ' + id);
            const copy = factory({ ...structuredCloneSafe(p), id: undefined, name: p.name + ' (copy)', createdAt: undefined });
            return this.save(copy);
        },
        remove(id) {
            const list = readAll();
            const next = list.filter(p => p.id !== id);
            writeAll(next);
            return next.length !== list.length;
        },
        exportJSON(id) {
            const p = this.get(id);
            if (!p) throw new Error('No profile ' + id);
            return JSON.stringify({ format: 'lenticular-workbench-profile', version: PROFILE_SCHEMA_VERSION, profile: p }, null, 2);
        },
        /** Imports one profile. A clashing id gets a fresh id, never overwrites. */
        importJSON(text) {
            let obj;
            try { obj = JSON.parse(text); } catch { throw new Error('Not valid JSON.'); }
            const raw = obj && obj.format === 'lenticular-workbench-profile' ? obj.profile : obj;
            if (!raw || typeof raw !== 'object') throw new Error('No profile found in file.');
            const expectedKind = factory({}).kind;
            if (raw.kind && raw.kind !== expectedKind) throw new Error('This is a ' + raw.kind + ' profile, not a ' + expectedKind + ' profile.');
            const clash = this.get(raw.id);
            const p = factory({ ...raw, id: clash ? undefined : raw.id });
            return this.save(p);
        },
    };
}

/** Minimal in-memory Storage (tests, and a fallback when localStorage throws). */
export function memoryStorage(seed = {}) {
    const m = new Map(Object.entries(seed));
    return {
        getItem: k => (m.has(k) ? m.get(k) : null),
        setItem: (k, v) => { m.set(k, String(v)); },
        removeItem: k => { m.delete(k); },
    };
}

function num(v, dflt) {
    const n = Number(v);
    return v == null || v === '' || !Number.isFinite(n) ? dflt : n;
}
function structuredCloneSafe(o) { return JSON.parse(JSON.stringify(o)); }

// ---- calibration session state (persisted separately from profiles) ----
export const DEFAULT_CALIBRATION = {
    nominalLpi: 100,
    minLpi: 99.5,
    maxLpi: 100.5,
    coarseStep: 0.1,
    refineHalfRange: 0.1,
    refineStep: 0.01,
    dpi: 600,
    widthMm: 190,
    heightMm: 277,
    orientation: 'vertical',
    phaseCount: 8,
    printerProfileId: null,
    paperId: null,
    coarseSelected: null,
    fineSelected: null,
    phaseSelected: null,
    bandCount: null,
};

export function loadCalibrationState(storage, key) {
    try {
        const raw = storage.getItem(key);
        return { ...DEFAULT_CALIBRATION, ...(raw ? JSON.parse(raw) : {}) };
    } catch {
        return { ...DEFAULT_CALIBRATION };
    }
}
export function saveCalibrationState(storage, key, state) {
    storage.setItem(key, JSON.stringify(state));
}
