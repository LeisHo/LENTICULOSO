// ====================================================================
// units.mjs — physical/raster unit conversions (pure, DOM-free)
// ====================================================================
// This app deals in four separate quantities, kept apart on purpose:
//
//   * LENS LPI        — lenticules per inch of the PHYSICAL lens sheet.
//                       pitch_in = 1 / LPI. Fractional (100.347 is valid).
//   * PRINTER DPI/PPI — raster pixels per inch the image is PRINTED at.
//                       Here "DPI" always means the raster's pixels-per-inch
//                       at 100% scale (what a print driver calls PPI), not
//                       the printer's ink-droplet resolution.
//   * PHYSICAL SIZE   — inches / millimetres on paper.
//   * PIXEL SIZE      — raster width × height in pixels.
//
// pixelSize = round(physicalSize_in × DPI). Only this final raster size is
// rounded, once. Nothing to do with the lens is rounded here or anywhere
// in the interlacer: pixels-per-lenticule stays a real number (5.978…).
// ====================================================================

export const MM_PER_INCH = 25.4;

export function mmToIn(mm) { return mm / MM_PER_INCH; }
export function inToMm(inches) { return inches * MM_PER_INCH; }

/** Physical lenticule pitch in inches. */
export function lpiToPitchInches(lpi) {
    assertPositive(lpi, 'LPI');
    return 1 / lpi;
}

/** Physical lenticule pitch in millimetres. */
export function lpiToPitchMm(lpi) {
    return lpiToPitchInches(lpi) * MM_PER_INCH;
}

/** Raster pixels under one lenticule. Deliberately NOT rounded. */
export function pixelsPerLenticule(dpi, lpi) {
    assertPositive(dpi, 'DPI');
    assertPositive(lpi, 'LPI');
    return dpi / lpi;
}

/** Raster pixels available per frame strip (the resolution budget per frame). */
export function pixelsPerFrameSlot(dpi, lpi, frameCount) {
    if (!(frameCount >= 1)) throw new RangeError('frameCount must be >= 1');
    return pixelsPerLenticule(dpi, lpi) / frameCount;
}

/**
 * Pixel dimension for a physical length at a given DPI. Rounded to the
 * nearest whole pixel ONCE — a raster cannot have a fractional width. The
 * interlacer then works in physical coordinates, so this rounding never
 * leaks into the lens geometry (see interlace.mjs).
 */
export function physicalToPixels(lengthIn, dpi) {
    assertPositive(dpi, 'DPI');
    if (!(lengthIn > 0)) throw new RangeError('length must be > 0');
    return Math.max(1, Math.round(lengthIn * dpi));
}

/** Exact physical length a raster of `px` pixels prints at, at `dpi`. */
export function pixelsToPhysicalIn(px, dpi) {
    assertPositive(dpi, 'DPI');
    return px / dpi;
}

/** Number of (possibly partial) lenticules spanning a physical length. */
export function lenticulesAcross(lengthIn, lpi) {
    return lengthIn * lpi;
}

/**
 * Pitch-test sensitivity. Printing at LPI_p under a lens of LPI_l produces
 * beat bands with a spatial frequency of |LPI_p − LPI_l| bands per inch
 * (the standard moiré beat relation). Over a strip `lengthIn` long you
 * therefore see `lengthIn × |ΔLPI|` bands. One whole band is the smallest
 * mismatch a person can reliably count, so the finest pitch step a strip
 * of this length can resolve is about 1 / lengthIn LPI.
 */
export function bandsForMismatch(lengthIn, deltaLpi) {
    return lengthIn * Math.abs(deltaLpi);
}
export function lpiResolutionForStrip(lengthIn) {
    if (!(lengthIn > 0)) throw new RangeError('length must be > 0');
    return 1 / lengthIn;
}

/** Inverse of bandsForMismatch: counted bands → |ΔLPI|. */
export function lpiDeltaFromBands(bandCount, lengthIn) {
    if (!(lengthIn > 0)) throw new RangeError('length must be > 0');
    return Math.abs(bandCount) / lengthIn;
}

/** PNG pHYs stores pixels per METRE as an integer. */
export function dpiToPixelsPerMetre(dpi) {
    return Math.round(dpi / 0.0254);
}

// Named paper sizes, in millimetres, portrait.
export const PAPER_SIZES = {
    A4: { label: 'A4 (210 × 297 mm)', widthMm: 210, heightMm: 297 },
    A5: { label: 'A5 (148 × 210 mm)', widthMm: 148, heightMm: 210 },
    A6: { label: 'A6 (105 × 148 mm)', widthMm: 105, heightMm: 148 },
    Letter: { label: 'US Letter (8.5 × 11 in)', widthMm: 215.9, heightMm: 279.4 },
    '6x4': { label: '6 × 4 in photo', widthMm: 152.4, heightMm: 101.6 },
    '7x5': { label: '7 × 5 in photo', widthMm: 177.8, heightMm: 127 },
};

function assertPositive(v, name) {
    if (!(typeof v === 'number' && Number.isFinite(v) && v > 0)) {
        throw new RangeError(name + ' must be a positive finite number (got ' + v + ')');
    }
}
