// Git sync of the Workbench's saved data (src/lenticular/sync.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createSync, SYNC_KEYS, REMOTE_KEY } from '../src/lenticular/sync.mjs';
import { memoryStorage } from '../src/lenticular/core/profiles.mjs';

function fakeRemote(initial = null, { failGet = false, failPut = false } = {}) {
    let file = initial;
    const puts = [];
    return {
        puts,
        get file() { return file; },
        async get() { if (failGet) throw new Error('down'); return file; },
        async put(patch) { if (failPut) return false; file = { ...(file || {}), ...patch }; puts.push(patch); return true; },
    };
}
const wait = ms => new Promise(r => setTimeout(r, ms));

test('pull: git snapshot wins over an untouched browser', async () => {
    const base = memoryStorage({ 'lw.lenses': '[{"id":"old"}]' });
    const remote = fakeRemote({ devPanel: { x: 1 }, [REMOTE_KEY]: { version: 1, data: { 'lw.lenses': [{ id: 'fromGit' }], 'lw.printers': [] } } });
    const s = createSync(base, { debounceMs: 10 });
    s.attach(remote);
    assert.equal(await s.pull(), 'applied');
    assert.equal(JSON.parse(base.getItem('lw.lenses'))[0].id, 'fromGit');
    assert.equal(s.status, 'synced');
    assert.equal(remote.puts.length, 0, 'applying must not echo a write back');
});

test('pull: first run pushes existing local profiles up, keeping other keys', async () => {
    const base = memoryStorage({ 'lw.lenses': '[{"id":"mine"}]', 'lw.tab': '"create"' });
    const remote = fakeRemote({ devPanel: { keep: true } });
    const s = createSync(base, { debounceMs: 10 });
    s.attach(remote);
    assert.equal(await s.pull(), 'pushed');
    assert.deepEqual(remote.file.devPanel, { keep: true });
    assert.equal(remote.file[REMOTE_KEY].data['lw.lenses'][0].id, 'mine');
    assert.ok(!('lw.tab' in remote.file[REMOTE_KEY].data), 'ephemeral keys are not synced');
});

test('writes: only synced keys, debounced into one push', async () => {
    const base = memoryStorage();
    const remote = fakeRemote({});
    const s = createSync(base, { debounceMs: 20 });
    s.attach(remote);
    await s.pull();
    s.storage.setItem('lw.create', '{}');           // not synced
    await wait(40);
    assert.equal(remote.puts.length, 0);
    s.storage.setItem('lw.calibration', '{"minLpi":99.5}');
    s.storage.setItem('lw.calibration', '{"minLpi":99.6}');
    s.storage.setItem('lw.printers', '[]');
    await wait(60);
    assert.equal(remote.puts.length, 1, 'burst → one commit');
    assert.equal(remote.file[REMOTE_KEY].data['lw.calibration'].minLpi, 99.6);
    assert.ok(SYNC_KEYS.includes('lw.papers'));
});

test('local edits made before the pull finishes are pushed, not overwritten', async () => {
    const base = memoryStorage();
    const remote = fakeRemote({ [REMOTE_KEY]: { data: { 'lw.lenses': [{ id: 'git' }] } } });
    const s = createSync(base, { debounceMs: 1000 });
    s.storage.setItem('lw.lenses', '[{"id":"typed-just-now"}]');
    s.attach(remote);
    assert.equal(await s.pull(), 'pushed');
    assert.equal(remote.file[REMOTE_KEY].data['lw.lenses'][0].id, 'typed-just-now');
});

test('failures: unreachable git → error status, data stays local and retries', async () => {
    const base = memoryStorage({ 'lw.lenses': '[{"id":"a"}]' });
    const s1 = createSync(base, { debounceMs: 10 });
    s1.attach(fakeRemote(null, { failGet: true }));
    assert.equal(await s1.pull(), 'offline');
    assert.equal(s1.status, 'error');
    assert.equal(JSON.parse(base.getItem('lw.lenses'))[0].id, 'a');

    const remote = fakeRemote({}, { failPut: true });
    const s2 = createSync(memoryStorage(), { debounceMs: 10 });
    s2.attach(remote);
    await s2.pull();
    s2.storage.setItem('lw.papers', '[]');
    await wait(30);
    assert.equal(s2.status, 'error');
    assert.equal(await s2.flush(), false, 'still dirty, so a later flush retries');
});
