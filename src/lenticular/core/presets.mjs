// ====================================================================
// presets.mjs — built-in printer and paper presets (pure data + helpers)
// ====================================================================
// Researched 2026-09-23. Evidence per field:
//   SOURCED  — from the manufacturer page/spec sheet or a retailer
//              listing found in that research (URL in `sources`)
//   INFERRED — reasoning, not a published spec (said so in `notes`)
//   null     — not found; never filled with a guess
//
// WHY 720 DPI FOR EVERY EPSON PRESET. Epson inkjet drivers accept image
// data at 720 ppi (360 ppi in lower-quality modes) and resample anything
// else to it (SOURCED: DPReview "Epson printers and native resolution"
// threads; Jim Kasson's Epson inkjet series). For lenticular printing a
// driver resample is exactly what must NOT happen — it re-grids the
// strips and smears the pitch — so an Epson preset builds the image at
// 720 DPI. The "5760 × 1440 dpi" marketing figure is ink-droplet
// placement, not the resolution the image should be built at.
// ====================================================================

const EPSON_NATIVE_NOTE = 'Epson drivers work at 720 ppi (360 in draft/standard modes); build at 720 and print at the driver\'s High/Best quality with the matching paper type.';

/** Epson EcoTank presets. `dpi` = resolution to BUILD the image at. */
export const PRINTER_PRESETS = [
    {
        id: 'epson-et-2400', brand: 'Epson', model: 'EcoTank ET-2400', dpi: 720, nativeDpi: [360, 720],
        maxPrintResolution: '5760 × 1440 dpi', maxSheet: '8.5 × 14 in (Legal)', borderless: '4 × 6 in only',
        ink: '4-colour dye (standard EcoTank)',
        notes: EPSON_NATIVE_NOTE + ' Borderless only at 4 × 6 in.',
        sources: ['https://epson.com/For-Home/Printers/Inkjet/EcoTank-ET-2400-Wireless-Color-All-in-One-Cartridge-Free-Supertank-Printer-with-Scan-and-Copy/p/C11CJ67201'],
    },
    {
        id: 'epson-et-2800', brand: 'Epson', model: 'EcoTank ET-2800 / ET-2803', dpi: 720, nativeDpi: [360, 720],
        maxPrintResolution: '5760 × 1440 dpi', maxSheet: '8.5 × 14 in (Legal)', borderless: 'yes (photo sizes)',
        ink: '4-colour dye (standard EcoTank)',
        notes: EPSON_NATIVE_NOTE,
        sources: ['https://mediaserver.goepson.com/ImConvServlet/imconv/8c4e4113f8c005b7307586975f40d8e66ec236cf/original?assetDescr=EcoTank_ET-2800_White_Printer_Specification_Sheet_CPD-61360.pdf'],
    },
    {
        id: 'epson-et-2850', brand: 'Epson', model: 'EcoTank ET-2850', dpi: 720, nativeDpi: [360, 720],
        maxPrintResolution: '4800 × 1200 dpi', maxSheet: '8.5 × 14 in (Legal)', borderless: 'yes (photo sizes)',
        ink: '4-colour (standard EcoTank)',
        notes: EPSON_NATIVE_NOTE + ' Same engine class as the ET-2800, adds auto 2-sided.',
        sources: ['https://epson.com/For-Work/Printers/Inkjet/EcoTank-ET-2850-Wireless-Color-All-in-One-Cartridge-Free-Supertank-Printer-with-Scan%2C-Copy-and-Auto-2-sided-Printing/p/C11CJ63202'],
    },
    {
        id: 'epson-et-3850', brand: 'Epson', model: 'EcoTank ET-3850', dpi: 720, nativeDpi: [360, 720],
        maxPrintResolution: '4800 × 1200 dpi', maxSheet: '8.5 × 14 in (Legal)', borderless: 'only with specific paper types/sizes',
        ink: '4-colour (black ink type not verified)',
        notes: EPSON_NATIVE_NOTE,
        sources: ['https://epson.com/For-Work/Printers/Inkjet/EcoTank-ET-3850-Wireless-Color-All-in-One-Cartridge-Free-Supertank-Printer-with-Scanner,-Copier,-ADF-and-Ethernet/p/C11CJ61201'],
    },
    {
        id: 'epson-et-4800', brand: 'Epson', model: 'EcoTank ET-4800', dpi: 720, nativeDpi: [360, 720],
        maxPrintResolution: '5760 × 1440 dpi', maxSheet: '8.5 × 11 in (Letter/A4)', borderless: null,
        ink: '4-colour dye (standard EcoTank)',
        notes: EPSON_NATIVE_NOTE,
        sources: ['https://mediaserver.goepson.com/ImConvServlet/imconv/af25b196110b25c9e71dc3a68789e724ba826ff3/original?assetDescr=EcoTank_ET-4800_Printer_Specification_Sheet_CPD-60630R1.pdf'],
    },
    {
        id: 'epson-et-4850', brand: 'Epson', model: 'EcoTank ET-4850', dpi: 720, nativeDpi: [360, 720],
        maxPrintResolution: null, maxSheet: '8.5 × 14 in (Legal)', borderless: null,
        ink: '4-colour (black ink type not verified)',
        notes: EPSON_NATIVE_NOTE,
        sources: ['https://epson.com/For-Work/Printers/Inkjet/EcoTank-ET-4850-Wireless-Color-All-in-One-Cartridge-Free-Supertank-Printer-with-Scanner,-Copier,-Fax,-ADF-and-Ethernet/p/C11CJ60202'],
    },
    {
        id: 'epson-et-5850', brand: 'Epson', model: 'EcoTank Pro ET-5850', dpi: 720, nativeDpi: [360, 720],
        maxPrintResolution: '4800 × 2400 dpi', maxSheet: '8.5 × 14 in (Legal)', borderless: 'up to 8.5 × 14 in',
        ink: 'pigment (DURABrite)',
        notes: EPSON_NATIVE_NOTE + ' Office model with pigment ink (INFERRED, not tested: pigment can sit on glossy coatings — if prints smudge, try semi-gloss).',
        sources: ['https://epson.com/For-Work/Printers/Inkjet/EcoTank-Pro-ET-5850-All-in-One-Cartridge-Free-Supertank-Printer/p/C11CJ29201'],
    },
    {
        id: 'epson-et-8500', brand: 'Epson', model: 'EcoTank Photo ET-8500', dpi: 720, nativeDpi: [360, 720],
        maxPrintResolution: '5760 × 1440 dpi', maxSheet: '8.5 × 11 in (Letter/A4)', borderless: '4 × 6 in to 8.5 × 11 in',
        ink: '6-colour Claria ET Premium (photo)',
        notes: EPSON_NATIVE_NOTE + ' Photo model — the best-suited EcoTank for lenticular prints up to A4.',
        sources: ['https://mediaserver.goepson.com/ImConvServlet/imconv/7c77763356f8444ea6190abf8c8577bf8f365680/original?assetDescr=EcoTank-ET-8500_Printer-Specification-Sheet_CPD-59931R2-Final.pdf',
            'https://www.redrivercatalog.com/infocenter/epson-et-8550-et-8500-insiders-guide.html'],
    },
    {
        id: 'epson-et-8550', brand: 'Epson', model: 'EcoTank Photo ET-8550', dpi: 720, nativeDpi: [360, 720],
        maxPrintResolution: '5760 × 1440 dpi', maxSheet: '13 × 19 in (A3+)', borderless: '3.5 × 5 in to 13 × 19 in',
        ink: '6-colour Claria ET Premium (photo)',
        notes: EPSON_NATIVE_NOTE + ' Photo model with A3+ — prints a lens-sized A4 sheet with room to spare.',
        sources: ['https://www.bhphotovideo.com/c/product/1639048-REG/epson_c11cj21201_ecotank_et_8550_all_in_one_printer.html',
            'https://www.redrivercatalog.com/infocenter/epson-et-8550-et-8500-insiders-guide.html'],
    },
    {
        id: 'epson-et-15000', brand: 'Epson', model: 'EcoTank ET-15000', dpi: 720, nativeDpi: [360, 720],
        maxPrintResolution: '4800 × 1200 dpi', maxSheet: '13 × 19 in (A3+)', borderless: null,
        ink: '4-colour (standard EcoTank)',
        notes: EPSON_NATIVE_NOTE,
        sources: ['https://mediaserver.goepson.com/ImConvServlet/imconv/b1cddd21fa0893f3d85680baf08cc586f8e85d37/original?assetDescr=EcoTank_ET-15000_Specification_Sheet_CPD-58551R2.pdf'],
    },
];

// ---- Paper ---------------------------------------------------------------
// What about paper matters for a lenticular print (INFERRED from the
// sources below unless marked):
//  1. COATING / FINISH — ink must stay where it is placed so each strip
//     (often 1.5–3 printer pixels wide) stays separate. Resin-coated
//     glossy photo paper holds ink in a microporous layer; plain paper
//     wicks it sideways and blurs strips into each other (ghosting).
//     SOURCED: eufymake lenticular guide ("premium glossy or resin coated
//     photo paper… regular paper absorbs too much ink, which can blur the
//     fine interlaced lines").
//  2. DIMENSIONAL STABILITY — plain paper swells where ink wets it
//     (cockle) and shrinks back unevenly; any stretch changes the
//     printed pitch, which is exactly what calibration measured. So a
//     calibration is only trustworthy on the paper it was done on.
//  3. DRIVER PAPER TYPE — the driver's media setting controls ink load
//     and print mode; it must match the paper actually loaded.
//  Thickness does NOT change the optics when the print sits behind the
//  lens (the lens focuses on its own back surface); it is recorded for
//  feeding/lamination only.
export const LENTICULAR_SUITABILITY = {
    best: 'Best — resin-coated glossy: sharpest strips, stable size',
    good: 'Good — resin-coated / semi-gloss: sharp, stable',
    fair: 'Fair — matte coated: softer strips, some ghosting',
    poor: 'Poor — plain paper: ink spreads and paper cockles',
};

export const PAPER_PRESETS = [
    // ---- Epson
    { id: 'epson-premium-glossy', brand: 'Epson', model: 'Premium Photo Paper Glossy', finish: 'glossy', base: 'resin-coated photo',
        gsm: 252, thicknessMil: 10.4, lenticular: 'best', driverSetting: 'Epson Premium Photo Paper Glossy',
        sources: ['https://epson.com/For-Home/Paper/Photo/Premium-Photo-Paper-Glossy/m/Epson%20Premium%20Photo%20Paper%20Glossy'] },
    { id: 'epson-photo-glossy', brand: 'Epson', model: 'Photo Paper Glossy (S041140 / S041141)', finish: 'glossy', base: 'photo',
        gsm: null, thicknessMil: 8.1, lenticular: 'good', driverSetting: 'Epson Photo Paper Glossy',
        sources: ['https://epson.com/For-Home/Paper/Photo/Photo-Paper-Glossy/m/S041140'] },
    { id: 'epson-premium-semigloss', brand: 'Epson', model: 'Premium Photo Paper Semi-gloss', finish: 'semi-gloss', base: 'resin-coated photo',
        gsm: 251, thicknessMil: 10.4, lenticular: 'good', driverSetting: 'Epson Premium Photo Paper Semi-Gloss',
        sources: ['https://epson.com/For-Work/Paper/Photo/Premium-Photo-Paper-Semi-gloss/m/Epson%20Premium%20Photo%20Paper%20Semi%20Gloss'] },
    { id: 'epson-presentation-matte', brand: 'Epson', model: 'Premium Presentation Paper Matte', finish: 'matte', base: 'coated matte',
        gsm: 165, thicknessMil: 9, lenticular: 'fair', driverSetting: 'Epson Premium Presentation Paper Matte',
        sources: ['https://epson.com/For-Work/Paper/Presentation/Premium-Presentation-Paper-Matte/m/Epson%20Premium%20Presentation%20Paper%20Matte'] },
    // ---- Canon
    { id: 'canon-pp201', brand: 'Canon', model: 'Photo Paper Plus Glossy II (PP-201)', finish: 'glossy', base: 'resin-coated photo',
        gsm: 265, thicknessMil: round1(0.27 / 0.0254), lenticular: 'best', driverSetting: null,
        sources: ['https://en.canon-cna.com/printers/inkjet/pixma/photo-paper/pp-201/specifications/'] },
    { id: 'canon-gp701', brand: 'Canon', model: 'Photo Paper Glossy (GP-701)', finish: 'glossy', base: 'photo',
        gsm: 200, thicknessMil: null, lenticular: 'good', driverSetting: null,
        sources: ['https://www.bhphotovideo.com/c/product/1301347-REG/canon_1433c004_glossy_photo_paper.html'] },
    { id: 'canon-sg201', brand: 'Canon', model: 'Photo Paper Plus Semi-gloss (SG-201)', finish: 'semi-gloss', base: 'resin-coated photo',
        gsm: 260, thicknessMil: 10.2, lenticular: 'good', driverSetting: null,
        sources: ['https://www.bhphotovideo.com/c/product/830262-REG/Canon_1686B063_Photo_Paper_Plus_Semi_Gloss.html'] },
    { id: 'canon-mp101', brand: 'Canon', model: 'Matte Photo Paper (MP-101)', finish: 'matte', base: 'coated matte',
        gsm: 170, thicknessMil: null, lenticular: 'fair', driverSetting: null,
        sources: ['https://en.canon-me.com/printers/inkjet/pixma/photo-paper/mp-101/specifications/'] },
    // ---- HP
    { id: 'hp-premium-plus-glossy', brand: 'HP', model: 'Premium Plus Photo Paper Glossy', finish: 'glossy', base: 'resin-coated photo',
        gsm: 280, thicknessMil: 11.5, lenticular: 'best', driverSetting: null,
        sources: ['https://www.hp.com/us-en/shop/pdp/hp-premium-plus-photo-paper--glossy-50-sheets--85-x-11-cr664a'] },
    { id: 'hp-advanced-glossy', brand: 'HP', model: 'Advanced Photo Paper Glossy', finish: 'glossy', base: 'photo',
        gsm: 250, thicknessMil: 10.5, lenticular: 'best', driverSetting: null,
        sources: ['https://support.hp.com/lv-en/document/c00406621'] },
    { id: 'hp-everyday-glossy', brand: 'HP', model: 'Everyday Photo Paper Glossy', finish: 'glossy', base: 'photo',
        gsm: 200, thicknessMil: round1(0.2 / 0.0254), lenticular: 'good', driverSetting: null,
        sources: ['https://www.hp.com/us-en/shop/pdp/hp-everyday-photo-paper--glossy--50-sheets--85-x-11-inch-q8723a'] },
    { id: 'hp-presentation-matte', brand: 'HP', model: 'Premium Presentation Paper Matte (120 g)', finish: 'matte', base: 'coated matte',
        gsm: 120, thicknessMil: null, lenticular: 'fair', driverSetting: null,
        sources: ['https://www.bhphotovideo.com/c/product/470444-REG/HP_Hewlett_Packard_Q5449A_Premium_Presentation_Paper_Matte.html'] },
    // ---- plain (text printing)
    { id: 'plain-copy', brand: 'Any', model: 'Plain copy / printer paper (75–90 g)', finish: 'plain', base: 'uncoated',
        gsm: null, thicknessMil: null, lenticular: 'poor', driverSetting: 'Plain Paper',
        sources: ['https://www.eufymake.com/blogs/printing-guides/lenticular-printing'] },
];

/**
 * Closest Epson driver "Paper Type" for a paper, when the paper itself is
 * not Epson-branded (INFERRED: match by finish; Epson drivers only list
 * Epson media names).
 */
export function epsonDriverSettingFor(paper) {
    if (!paper) return null;
    if (paper.driverSetting && paper.brand === 'Epson') return paper.driverSetting;
    switch (paper.finish) {
        case 'glossy': return 'Epson Premium Photo Paper Glossy (closest match)';
        case 'semi-gloss': case 'luster': return 'Epson Premium Photo Paper Semi-Gloss (closest match)';
        case 'matte': return 'Epson Premium Presentation Paper Matte (closest match)';
        case 'plain': return 'Plain Paper';
        default: return null;
    }
}

export function thicknessUm(paper) {
    return paper && paper.thicknessMil != null ? Math.round(paper.thicknessMil * 25.4) : null;
}

// ---- selection helpers ---------------------------------------------------
// A <select> value is either a saved profile id or "preset:<presetId>".
export const PRESET_PREFIX = 'preset:';

export function printerFromPreset(p) {
    return {
        kind: 'printer', id: PRESET_PREFIX + p.id, preset: true, presetId: p.id,
        name: `${p.brand} ${p.model}`, model: `${p.brand} ${p.model}`, dpi: p.dpi, nativeDpi: p.nativeDpi,
        media: '', notes: p.notes, brand: p.brand,
    };
}

export function paperFromPreset(p) {
    return { ...p, kind: 'paper', id: PRESET_PREFIX + p.id, preset: true, presetId: p.id, name: `${p.brand} ${p.model}` };
}

/** Resolve a select value to a printer object (saved profile or preset), or null. */
export function resolvePrinter(value, store) {
    if (!value) return null;
    if (value.startsWith(PRESET_PREFIX)) {
        const p = PRINTER_PRESETS.find(x => x.id === value.slice(PRESET_PREFIX.length));
        return p ? printerFromPreset(p) : null;
    }
    return store ? store.get(value) : null;
}

export function resolvePaper(value, store) {
    if (!value) return null;
    if (value.startsWith(PRESET_PREFIX)) {
        const p = PAPER_PRESETS.find(x => x.id === value.slice(PRESET_PREFIX.length));
        return p ? paperFromPreset(p) : null;
    }
    return store ? store.get(value) : null;
}

/** Native input resolutions for a printer object (preset or saved profile made from one). */
export function nativeDpiOf(printer) {
    if (!printer) return null;
    if (printer.nativeDpi) return printer.nativeDpi;
    const p = printer.presetId && PRINTER_PRESETS.find(x => x.id === printer.presetId);
    return p ? p.nativeDpi : null;
}

function round1(v) { return Math.round(v * 10) / 10; }
