// ====================================================================
// pdf.mjs — one-page PDF holding a single RGB raster at its print size
// ====================================================================
// Pure (no DOM). FlateDecode is zlib-wrapped, which is what
// CompressionStream('deflate') produces, so no PDF library is needed.
// The page is sized from DPI: width_pt = width_px / dpi * 72.

const enc = new TextEncoder();

export function rgbaToRgb(rgba) {
    const out = new Uint8Array((rgba.length / 4) * 3);
    for (let i = 0, o = 0; i < rgba.length; i += 4) {
        out[o++] = rgba[i]; out[o++] = rgba[i + 1]; out[o++] = rgba[i + 2];
    }
    return out;
}

export async function encodePdfImage({ rgb, width, height, dpi }) {
    const wPt = (width / dpi) * 72;
    const hPt = (height / dpi) * 72;
    const imageData = await deflate(rgb);
    const content = enc.encode(`q ${wPt.toFixed(3)} 0 0 ${hPt.toFixed(3)} 0 0 cm /Im0 Do Q\n`);
    const bodies = [
        enc.encode('<< /Type /Catalog /Pages 2 0 R >>'),
        enc.encode('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'),
        enc.encode(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${wPt.toFixed(3)} ${hPt.toFixed(3)}] ` +
            '/Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>'),
        concat(enc.encode(`<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} ` +
            `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /Length ${imageData.length} >>\nstream\n`),
            imageData, enc.encode('\nendstream')),
        concat(enc.encode(`<< /Length ${content.length} >>\nstream\n`), content, enc.encode('endstream')),
    ];

    const header = enc.encode('%PDF-1.4\n');
    const parts = [header];
    let offset = header.length;
    const offsets = [];
    bodies.forEach((body, i) => {
        const head = enc.encode(`${i + 1} 0 obj\n`);
        const tail = enc.encode('\nendobj\n');
        offsets.push(offset);
        parts.push(head, body, tail);
        offset += head.length + body.length + tail.length;
    });

    let xref = `xref\n0 ${bodies.length + 1}\n0000000000 65535 f \n`;
    for (const o of offsets) xref += `${String(o).padStart(10, '0')} 00000 n \n`;
    xref += `trailer\n<< /Size ${bodies.length + 1} /Root 1 0 R >>\nstartxref\n${offset}\n%%EOF\n`;
    parts.push(enc.encode(xref));
    return concat(...parts);
}

async function deflate(bytes) {
    const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
}

function concat(...arrays) {
    const total = arrays.reduce((n, a) => n + a.length, 0);
    const out = new Uint8Array(total);
    let o = 0;
    for (const a of arrays) { out.set(a, o); o += a.length; }
    return out;
}
