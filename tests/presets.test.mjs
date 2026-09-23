// Printer / paper presets, paper profiles, and the checks that use them.
// Run: node --test tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';

import * as S from '../src/lenticular/core/presets.mjs';
import * as P from '../src/lenticular/core/profiles.mjs';
import * as K from '../src/lenticular/core/checks.mjs';

test('printer presets: Epson/Canon/HP home models, unique ids, build at each driver native DPI, sourced', () => {
    const ids = new Set();
    const NATIVE = { Epson: [720, [360, 720]], Canon: [600, [300, 600]], HP: [600, [300, 600, 1200]] };
    for (const p of S.PRINTER_PRESETS) {
        assert.ok(!ids.has(p.id), 'duplicate id ' + p.id); ids.add(p.id);
        assert.ok(NATIVE[p.brand], 'unknown brand ' + p.brand);
        assert.equal(p.dpi, NATIVE[p.brand][0], p.id + ' build DPI');
        assert.deepEqual(p.nativeDpi, NATIVE[p.brand][1], p.id + ' native list');
        assert.ok(p.nativeDpi.includes(p.dpi));
        assert.ok(p.sources.length >= 1 && p.sources.every(u => /^https?:\/\//.test(u)));
        assert.ok(typeof p.notes === 'string' && p.notes.length > 20);
    }
    const count = b => S.PRINTER_PRESETS.filter(p => p.brand === b).length;
    assert.equal(count('Epson'), 20);
    assert.equal(count('Canon'), 10);
    assert.equal(count('HP'), 10);
    assert.deepEqual(S.PRINTER_BRANDS, ['Epson', 'Canon', 'HP']);
});

test('paper presets: Epson/Canon/HP + plain, valid fields, no guessed numbers', () => {
    const ids = S.PAPER_PRESETS.map(p => p.id);
    assert.equal(new Set(ids).size, ids.length, 'duplicate paper id');
    for (const b of ['Epson', 'Canon']) assert.equal(S.PAPER_PRESETS.filter(p => p.brand === b).length, 14, b);
    assert.equal(S.PAPER_PRESETS.filter(p => p.brand === 'HP').length, 13);
    const brands = new Set(S.PAPER_PRESETS.map(p => p.brand));
    for (const b of ['Epson', 'Canon', 'HP']) assert.ok(brands.has(b), 'missing ' + b);
    for (const p of S.PAPER_PRESETS) {
        assert.ok(['glossy', 'semi-gloss', 'luster', 'matte', 'plain'].includes(p.finish), p.id);
        assert.ok(['best', 'good', 'fair', 'poor'].includes(p.lenticular), p.id);
        assert.ok(p.gsm === null || p.gsm > 0);
        assert.ok(p.thicknessMil === null || p.thicknessMil > 0);
        assert.ok(p.sources.length >= 1);
    }
    // published figures, reproduced exactly
    const get = id => S.PAPER_PRESETS.find(p => p.id === id);
    assert.equal(get('epson-premium-glossy').gsm, 252);
    assert.equal(get('epson-premium-glossy').thicknessMil, 10.4);
    assert.equal(get('canon-pp201').gsm, 265);
    assert.equal(get('hp-advanced-glossy').thicknessMil, 10.5);
    assert.equal(get('plain-copy').lenticular, 'poor');
    assert.equal(S.thicknessUm(get('epson-premium-glossy')), 264);
});

test('resolvePrinter / resolvePaper: presets and saved profiles', () => {
    const storage = P.memoryStorage();
    const printers = P.createProfileStore(storage, 'p', P.makePrinterProfile, P.validatePrinter);
    const papers = P.createProfileStore(storage, 'q', P.makePaperProfile, P.validatePaper);
    const pr = S.resolvePrinter('preset:epson-et-8550', printers);
    assert.equal(pr.dpi, 720);
    assert.equal(pr.name, 'Epson EcoTank Photo ET-8550');
    assert.deepEqual(S.nativeDpiOf(pr), [360, 720]);
    assert.equal(S.resolvePrinter('preset:nope', printers), null);
    assert.equal(S.resolvePrinter('', printers), null);
    const saved = printers.save(P.makePrinterProfile({ name: 'Mine', dpi: 720, presetId: 'epson-et-2800', nativeDpi: [360, 720] }));
    assert.equal(S.resolvePrinter(saved.id, printers).name, 'Mine');
    assert.deepEqual(S.nativeDpiOf(printers.get(saved.id)), [360, 720]);

    const pa = S.resolvePaper('preset:canon-pp201', papers);
    assert.equal(pa.id, 'preset:canon-pp201', 'preset id must not be overwritten by the spread');
    assert.equal(pa.gsm, 265);
    const custom = papers.save(P.makePaperProfile({ name: 'Odd paper', finish: 'matte', gsm: 190 }));
    assert.equal(S.resolvePaper(custom.id, papers).lenticular, 'fair');
    assert.throws(() => papers.save(P.makePaperProfile({ name: 'Bad', gsm: -3 })), /Weight/);
});

test('driver paper-type mapping per printer brand', () => {
    const g = id => S.PAPER_PRESETS.find(p => p.id === id);
    assert.equal(S.driverSettingFor(g('canon-pt101'), 'Canon'), 'Canon Photo Paper Pro Platinum (PT-101)');
    assert.equal(S.driverSettingFor(g('epson-premium-glossy'), 'HP'), 'HP Advanced Photo Papers (closest match)');
    assert.equal(S.driverSettingFor(g('hp-multipurpose20'), 'Canon'), 'Plain Paper');
    assert.equal(S.printerBrandOf(S.resolvePrinter('preset:canon-pro-200')), 'Canon');
    assert.equal(S.printerBrandOf({ name: 'My HP ENVY' }), 'HP');
    assert.equal(S.resolvePrinter('preset:hp-envy-6055e').dpi, 600);
});

test('Epson driver paper-type mapping', () => {
    const get = id => S.PAPER_PRESETS.find(p => p.id === id);
    assert.equal(S.epsonDriverSettingFor(get('epson-premium-glossy')), 'Epson Premium Photo Paper Glossy');
    assert.match(S.epsonDriverSettingFor(get('canon-pp201')), /Premium Photo Paper Glossy \(closest match\)/);
    assert.match(S.epsonDriverSettingFor(get('hp-presentation-matte')), /Presentation Paper Matte/);
    assert.equal(S.epsonDriverSettingFor(get('plain-copy')), 'Plain Paper');
});

test('checks: native-DPI mismatch, plain paper, calibration-paper mismatch', () => {
    const glossy = S.resolvePaper('preset:epson-premium-glossy');
    const base = { lpi: 100.3, dpi: 720, widthMm: 152.4, heightMm: 101.6, frameCount: 2, lensCalibrated: true, printerNativeDpi: [360, 720], paper: glossy };
    assert.equal(K.checkCreateSettings(base).filter(c => c.level !== 'info').length, 0);
    assert.ok(K.checkCreateSettings({ ...base, dpi: 600 }).some(c => c.level === 'warn' && /720/.test(c.msg)));
    assert.ok(K.checkCreateSettings({ ...base, paper: S.resolvePaper('preset:plain-copy') }).some(c => c.level === 'warn' && /plain paper/i.test(c.msg)));
    assert.ok(K.checkCreateSettings({ ...base, calibratedPaperName: 'Canon Photo Paper Plus Glossy II (PP-201)' }).some(c => /calibrated on/.test(c.msg)));
    assert.ok(K.checkCreateSettings({ ...base, paper: null }).some(c => c.level === 'info' && /No paper/.test(c.msg)));
});

test('lens calibration records the paper; state persists paperId', () => {
    const lens = P.makeLensProfile({ name: 'L', calibratedWith: { dpi: 720, paperId: 'preset:epson-premium-glossy', paperName: 'Epson Premium Photo Paper Glossy' } });
    assert.equal(lens.calibratedWith.paperName, 'Epson Premium Photo Paper Glossy');
    const storage = P.memoryStorage();
    P.saveCalibrationState(storage, 'c', { ...P.DEFAULT_CALIBRATION, paperId: 'preset:hp-advanced-glossy' });
    assert.equal(P.loadCalibrationState(storage, 'c').paperId, 'preset:hp-advanced-glossy');
});
