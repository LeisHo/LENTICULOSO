// ====================================================================
// checks.mjs — pre-export consistency checks (pure)
// ====================================================================
// Produces the print-safety checklist and any warnings. Severity:
//   'error' — export would be meaningless (blocks the Generate button)
//   'warn'  — likely a mistake; export allowed, prominently shown
//   'info'  — context worth knowing
// ====================================================================

import { pixelsPerLenticule, physicalToPixels, mmToIn } from './units.mjs';

// Common native resolutions of desktop printers' drivers. Printing a
// raster whose DPI the driver does not use natively forces the driver to
// RESAMPLE it, which smears the strips. Informational only — the user's
// printer may differ.
export const COMMON_NATIVE_DPI = [300, 360, 600, 720, 1200, 1440, 2400, 2880];

export function checkCreateSettings(s) {
    const out = [];
    const add = (level, msg) => out.push({ level, msg });

    if (!(s.lpi > 0)) add('error', 'Effective LPI is missing or not positive.');
    if (!(s.dpi > 0)) add('error', 'Printer DPI/PPI is missing or not positive.');
    if (!(s.widthMm > 0 && s.heightMm > 0)) add('error', 'Output size is missing.');
    if (!(s.frameCount >= 2)) add('error', 'Need at least 2 frames in the sequence.');
    if (out.some(o => o.level === 'error')) return out;

    const ppl = pixelsPerLenticule(s.dpi, s.lpi);
    const perFrame = ppl / s.frameCount;
    if (perFrame < 1) {
        add('error', `Only ${perFrame.toFixed(2)} printer pixels per frame per lenticule (${ppl.toFixed(3)} px/lenticule ÷ ${s.frameCount} frames). Frames cannot be separated — raise DPI or use fewer frames.`);
    } else if (perFrame < 2) {
        add('warn', `${perFrame.toFixed(2)} pixels per frame per lenticule is tight: expect ghosting. More DPI or fewer frames will look cleaner.`);
    }

    if (!s.lensCalibrated) {
        add('warn', 'The lens profile has no calibrated effective LPI — you are using a nominal/manual value. Run Calibrate first for a reliable result.');
    }
    if (s.calibratedDpi && s.calibratedDpi !== s.dpi) {
        add('warn', `The lens was calibrated at ${s.calibratedDpi} DPI but this output is ${s.dpi} DPI. Pitch is physical, so this is usually fine, but a printer that scales slightly differently at another resolution can shift the effective pitch — re-check with a test print.`);
    }
    if (s.lensOrientation && s.orientation !== s.lensOrientation) {
        add('warn', `Lens profile says ${s.lensOrientation} lenticules but output is set to ${s.orientation}.`);
    }
    if (!COMMON_NATIVE_DPI.includes(s.dpi)) {
        add('info', `${s.dpi} DPI is not a common printer-native resolution (${COMMON_NATIVE_DPI.join(', ')}). If your driver resamples, the strips blur.`);
    }
    // Printer-native resolution (e.g. Epson drivers: 720/360 ppi). A raster
    // at any other DPI gets resampled by the driver, smearing the strips.
    if (Array.isArray(s.printerNativeDpi) && s.printerNativeDpi.length && !s.printerNativeDpi.includes(s.dpi)) {
        add('warn', `This printer's driver works at ${s.printerNativeDpi.join(' / ')} DPI. At ${s.dpi} DPI the driver will resample the image and blur the strips — use ${Math.max(...s.printerNativeDpi)} DPI.`);
    }
    // Paper: coating/stability (see presets.mjs for the reasoning).
    if (s.paper) {
        if (s.paper.lenticular === 'poor') add('warn', `${s.paper.name}: plain paper absorbs ink sideways and cockles when wet — strips blur into each other and the pitch can drift. Use glossy or semi-gloss photo paper.`);
        else if (s.paper.lenticular === 'fair') add('info', `${s.paper.name}: matte paper gives softer strips than glossy photo paper; expect some ghosting.`);
    } else {
        add('info', 'No paper selected. Glossy resin-coated photo paper gives the sharpest strips.');
    }
    if (s.calibratedPaperName && s.paper && s.calibratedPaperName !== s.paper.name) {
        add('warn', `The lens was calibrated on "${s.calibratedPaperName}" but you are printing on "${s.paper.name}". Papers can stretch differently under ink, which shifts the effective pitch — re-check with a test print.`);
    }
    if (s.lensWidthMm && s.lensHeightMm) {
        const fits = (s.widthMm <= s.lensWidthMm + 0.01 && s.heightMm <= s.lensHeightMm + 0.01)
            || (s.widthMm <= s.lensHeightMm + 0.01 && s.heightMm <= s.lensWidthMm + 0.01);
        if (!fits) add('warn', `Output (${s.widthMm} × ${s.heightMm} mm) is larger than the lens sheet (${s.lensWidthMm} × ${s.lensHeightMm} mm).`);
    }
    const w = physicalToPixels(mmToIn(s.widthMm), s.dpi);
    const h = physicalToPixels(mmToIn(s.heightMm), s.dpi);
    const mp = (w * h) / 1e6;
    if (mp > 120) add('error', `${w} × ${h} px (${mp.toFixed(1)} MP) exceeds what a browser canvas can hold. Reduce size or DPI.`);
    else if (mp > 40) add('warn', `${w} × ${h} px (${mp.toFixed(1)} MP) is large: generation may take a while and use a lot of memory.`);
    return out;
}

/** Output raster size and the exact physical size that raster prints at. */
export function outputGeometry(widthMm, heightMm, dpi) {
    const w = physicalToPixels(mmToIn(widthMm), dpi);
    const h = physicalToPixels(mmToIn(heightMm), dpi);
    return { widthPx: w, heightPx: h, printedWidthMm: (w / dpi) * 25.4, printedHeightMm: (h / dpi) * 25.4 };
}
