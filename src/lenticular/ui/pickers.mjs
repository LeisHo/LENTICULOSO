// ====================================================================
// pickers.mjs — shared printer / paper <select>s (saved + built-in presets)
// ====================================================================
// Every printer selection in the app offers the user's saved printer
// profiles AND the built-in Epson EcoTank presets; every paper selection
// offers saved custom papers AND the built-in Epson/Canon/HP papers. A
// preset is referenced as "preset:<id>" (see core/presets.mjs).
// ====================================================================

import { groupedSelectField } from './dom.mjs';
import { PRINTER_PRESETS, PAPER_PRESETS, LENTICULAR_SUITABILITY, PRESET_PREFIX } from '../core/presets.mjs';

export function printerSelect(app, value, { label = 'Printer', noneLabel = '— none (enter DPI) —', onChange } = {}) {
    return groupedSelectField(label, value || '', [
        [null, [['', noneLabel]]],
        ['Your printer profiles', app.printers.list().map(p => [p.id, `${p.name} — ${p.dpi} DPI`])],
        ['Presets — Epson EcoTank', PRINTER_PRESETS.map(p => [PRESET_PREFIX + p.id, `${p.brand} ${p.model} — ${p.dpi} DPI`])],
    ], { help: 'dpi', onChange });
}

const RATING = { best: '★★★', good: '★★', fair: '★', poor: '✗' };

export function paperSelect(app, value, { label = 'Paper', onChange } = {}) {
    const byBrand = b => PAPER_PRESETS.filter(p => p.brand === b)
        .map(p => [PRESET_PREFIX + p.id, `${p.model}${p.gsm ? ` · ${p.gsm} g/m²` : ''} · ${RATING[p.lenticular]}`]);
    return groupedSelectField(label, value || '', [
        [null, [['', '— not specified —']]],
        ['Your papers', app.papers.list().map(p => [p.id, `${p.name} · ${RATING[p.lenticular] || ''}`])],
        ['Epson', byBrand('Epson')],
        ['Canon', byBrand('Canon')],
        ['HP', byBrand('HP')],
        ['Plain paper', byBrand('Any')],
    ], { help: 'paper', onChange });
}

export function suitabilityText(paper) {
    return paper ? LENTICULAR_SUITABILITY[paper.lenticular] || '' : '';
}
