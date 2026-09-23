// ====================================================================
// sync.mjs — mirrors the Workbench's saved data into the git-tracked
// settings file (data/processed/dev-panel-settings.json, top-level key
// "workbench"), through the host's GET→merge→POST queue (src/main.js).
// ====================================================================
// localStorage stays the working copy (instant, offline-safe); git is the
// shared, durable copy that every device/browser loads on startup.
//
//   startup: pull()  — if git has a workbench snapshot, it wins (it is the
//            copy every device shares), UNLESS the user already changed
//            something locally during this page load (dirty), in which
//            case local is pushed instead of being overwritten.
//            If git has none yet but this browser has data, it is pushed
//            up once (first-run migration of existing local profiles).
//   writes:  every setItem() of a synced key marks dirty and schedules a
//            debounced push (bursts of typing become one commit).
//
// Synced keys: lens profiles, printer profiles, papers, the calibration
// session and app settings. NOT synced: lw.create (in-progress Create
// layout) and lw.tab (UI position) — ephemeral per-session state.
// ====================================================================

export const SYNC_KEYS = ['lw.lenses', 'lw.printers', 'lw.papers', 'lw.calibration', 'lw.settings'];
export const REMOTE_KEY = 'workbench';

export function snapshotFrom(storage) {
    const data = {};
    for (const k of SYNC_KEYS) {
        const raw = storage.getItem(k);
        if (raw != null) { try { data[k] = JSON.parse(raw); } catch { /* skip corrupt */ } }
    }
    return { version: 1, savedAt: new Date().toISOString(), data };
}

export function hasData(snapshot) {
    return !!snapshot && !!snapshot.data && Object.keys(snapshot.data).length > 0;
}

/**
 * base: a Storage ({getItem,setItem,removeItem}).
 * remote: {get(): Promise<settings|null>, put(patch): Promise<boolean>}
 * Returns { storage (wrapped), pull(), flush(), status, onStatus(fn) }.
 */
export function createSync(base, { debounceMs = 2500 } = {}) {
    let remote = null;
    let dirty = false;
    let timer = null;
    let status = 'local';       // local | loading | synced | saving | error
    const listeners = [];
    const setStatus = s => { status = s; listeners.forEach(fn => fn(s)); };

    const storage = {
        getItem: k => base.getItem(k),
        removeItem: k => { base.removeItem?.(k); if (SYNC_KEYS.includes(k)) schedule(); },
        setItem: (k, v) => { base.setItem(k, v); if (SYNC_KEYS.includes(k)) schedule(); },
    };

    function schedule() {
        dirty = true;
        if (!remote) return;
        clearTimeout(timer);
        timer = setTimeout(() => { flush(); }, debounceMs);
    }

    async function flush() {
        clearTimeout(timer);
        if (!remote || !dirty) return true;
        dirty = false;
        setStatus('saving');
        const ok = await remote.put({ [REMOTE_KEY]: snapshotFrom(base) });
        if (!ok) dirty = true;
        setStatus(ok ? 'synced' : 'error');
        return ok;
    }

    /** Returns 'applied' | 'pushed' | 'kept' | 'offline'. */
    async function pull() {
        if (!remote) return 'offline';
        setStatus('loading');
        let settings;
        try { settings = await remote.get(); } catch { setStatus('error'); return 'offline'; }
        const snap = settings && settings[REMOTE_KEY];
        if (dirty) { await flush(); return 'pushed'; }
        if (hasData(snap)) {
            for (const k of SYNC_KEYS) {
                if (k in snap.data) base.setItem(k, JSON.stringify(snap.data[k]));
            }
            setStatus('synced');
            return 'applied';
        }
        if (hasData(snapshotFrom(base))) { dirty = true; await flush(); return 'pushed'; }
        setStatus('synced');
        return 'kept';
    }
    return {
        storage,
        attach(r) { remote = r; if (dirty) schedule(); },
        pull,
        flush,
        get status() { return status; },
        onStatus(fn) { listeners.push(fn); },
    };
}
