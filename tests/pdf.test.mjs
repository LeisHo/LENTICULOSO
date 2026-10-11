import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inflateSync } from 'node:zlib';
import { encodePdfImage, rgbaToRgb } from '../src/lenticular/core/pdf.mjs';

test('rgbaToRgb drops alpha and keeps channel order', () => {
    const rgba = new Uint8Array([1, 2, 3, 255, 4, 5, 6, 0]);
    assert.deepEqual([...rgbaToRgb(rgba)], [1, 2, 3, 4, 5, 6]);
});

test('encodePdfImage writes a valid one-page PDF whose image inflates back exactly', async () => {
    const rgb = new Uint8Array([0, 0, 0, 255, 255, 255, 255, 255, 255, 0, 0, 0]);
    const pdf = await encodePdfImage({ rgb, width: 2, height: 2, dpi: 72 });
    const text = Buffer.from(pdf).toString('latin1');

    assert.ok(text.startsWith('%PDF-1.4'));
    assert.ok(text.includes('/MediaBox [0 0 2.000 2.000]'));
    assert.ok(text.includes('/Width 2 /Height 2 /ColorSpace /DeviceRGB'));
    assert.ok(text.trimEnd().endsWith('%%EOF'));

    const xrefAt = Number(/startxref\n(\d+)/.exec(text)[1]);
    assert.ok(text.slice(xrefAt).startsWith('xref'));

    const streamStart = text.indexOf('stream\n', text.indexOf('/FlateDecode')) + 'stream\n'.length;
    const streamEnd = text.indexOf('\nendstream', streamStart);
    const inflated = inflateSync(Buffer.from(pdf.subarray(streamStart, streamEnd)));
    assert.deepEqual([...inflated], [...rgb]);
});

test('encodePdfImage page size follows DPI (300 dpi, 300x150 px = 72 x 36 pt)', async () => {
    const rgb = new Uint8Array(300 * 150 * 3);
    const pdf = await encodePdfImage({ rgb, width: 300, height: 150, dpi: 300 });
    const text = Buffer.from(pdf).toString('latin1');
    assert.ok(text.includes('/MediaBox [0 0 72.000 36.000]'));
});
