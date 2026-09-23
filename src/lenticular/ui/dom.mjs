// ====================================================================
// dom.mjs — tiny DOM helpers shared by every Workbench view
// ====================================================================

/** h('div.cls#id', {attrs/props/on*}, ...children) */
export function h(tag, props, ...children) {
    const m = /^([a-z0-9]+)((?:[.#][\w-]+)*)$/i.exec(tag);
    const el = document.createElement(m ? m[1] : 'div');
    if (m && m[2]) {
        for (const part of m[2].match(/[.#][\w-]+/g)) {
            if (part[0] === '.') el.classList.add(part.slice(1)); else el.id = part.slice(1);
        }
    }
    if (props && (typeof props !== 'object' || props instanceof Node || Array.isArray(props))) {
        children.unshift(props);
        props = null;
    }
    for (const [k, v] of Object.entries(props || {})) {
        if (v == null || v === false) continue;
        if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
        else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
        else if (k in el && k !== 'list' && k !== 'form') el[k] = v;
        else el.setAttribute(k, v === true ? '' : v);
    }
    append(el, children);
    return el;
}

/** Append children, skipping null/false (native Element.append would print "null"). */
export function add(el, ...children) { append(el, children); return el; }

function append(el, children) {
    for (const c of children.flat(Infinity)) {
        if (c == null || c === false) continue;
        el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
    }
}

export function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }

// ---- "What does this mean?" explanations ---------------------------------
export const GLOSSARY = {
    lpi: ['LPI (lenses per inch)', 'How many lens ridges (lenticules) fit in one inch of your lens sheet. A seller\'s "100 LPI" is a nominal figure; the value that actually lines up with your printer, at your viewing distance, is usually slightly different — finding it is what Calibrate is for.'],
    pitch: ['Pitch', 'The width of one lens ridge: 1 ÷ LPI inches. 100 LPI = 0.01 in = 0.254 mm. "Effective" pitch is the one that matches your prints through the real lens; "nominal" is what the seller states.'],
    dpi: ['DPI / PPI', 'How many image pixels are printed per inch. This app builds the image at exactly this resolution, so it must match the resolution you print at. Use your printer\'s native value (often 600 or 720) so the driver does not resample and blur the strips.'],
    phase: ['Phase', 'Where the interlaced strips start relative to the lens ridges, as a fraction of one ridge (0–1). Pitch decides whether the pattern stays in step across the whole print; phase decides which frame you see when looking straight on. It only matters if you position the lens against a fixed reference, like a paper corner.'],
    interlacing: ['Interlacing', 'Cutting each frame into very thin strips and weaving them together, so each lens ridge sits over one strip of every frame. From each viewing angle the lens magnifies one strip set, so you see one whole frame.'],
    frames: ['Frame count', 'How many images share each lens ridge. More frames = smoother animation but thinner strips; each frame gets (DPI ÷ LPI ÷ frames) printer pixels per ridge. Below about 2 pixels each, frames start to bleed into each other.'],
    orientation: ['Lens orientation', 'Vertical: ridges run top-to-bottom, the image changes as you move side-to-side (best for flips/animation viewed with both eyes). Horizontal: ridges run left-to-right, the image changes as you tilt up/down.'],
    sampling: ['Frame sampling', 'Through the lens each frame is seen as one sample per ridge. "Lenticule average" pre-averages each frame over the ridge width (smoother, less shimmer). "Direct" copies pixels as-is (sharper edges, more aliasing).'],
    boundary: ['Boundary pixels', 'When a strip is not a whole number of pixels, some pixels straddle two frames. "Nearest" gives the pixel to one frame (crisp, no ghosting). "Blend" mixes them by area (exact position, slight ghosting).'],
};

export function helpTip(key) {
    const [title, body] = GLOSSARY[key] || [key, ''];
    return h('details.help', h('summary', { title: 'What does this mean?' }, '?'), h('div.help-body', h('strong', title), h('p', body)));
}

// ---- form fields ------------------------------------------------------------
export function numberField(label, value, { step = 'any', min, max, unit, help, onInput, id } = {}) {
    const input = h('input', { type: 'number', step, min, max, value: value ?? '', id });
    if (onInput) input.addEventListener('input', () => onInput(input.value === '' ? null : Number(input.value), input));
    return { el: h('label.field', h('span.field-label', label, help ? helpTip(help) : null), h('span.field-input', input, unit ? h('span.unit', unit) : null)), input };
}
export function textField(label, value, { onInput, placeholder } = {}) {
    const input = h('input', { type: 'text', value: value ?? '', placeholder });
    if (onInput) input.addEventListener('input', () => onInput(input.value, input));
    return { el: h('label.field', h('span.field-label', label), h('span.field-input', input)), input };
}
export function selectField(label, value, options, { onChange, help } = {}) {
    const sel = h('select', options.map(([v, text]) => h('option', { value: v, selected: String(v) === String(value) }, text)));
    if (onChange) sel.addEventListener('change', () => onChange(sel.value, sel));
    return { el: h('label.field', h('span.field-label', label, help ? helpTip(help) : null), h('span.field-input', sel)), input: sel };
}

export function orientationPicker(value, onChange) {
    const mk = (v, label) => {
        const b = h('button.orient-btn', { type: 'button', 'data-v': v, 'aria-pressed': String(value === v) },
            h('span.orient-icon.orient-' + v), label);
        b.addEventListener('click', () => {
            wrap.querySelectorAll('.orient-btn').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
            onChange(v);
        });
        return b;
    };
    const wrap = h('div.orient-picker', mk('vertical', 'Vertical ridges'), mk('horizontal', 'Horizontal ridges'));
    return h('div.field', h('span.field-label', 'Lens orientation', helpTip('orientation')), wrap);
}

// ---- downloads --------------------------------------------------------------
export function downloadBytes(bytes, filename, mime) {
    const blob = bytes instanceof Blob ? bytes : new Blob([bytes], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = h('a', { href: url, download: filename });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export function canvasToPngBytes(canvas) {
    return new Promise((resolve, reject) => canvas.toBlob(b => {
        if (!b) return reject(new Error('PNG encode failed (canvas too large?)'));
        b.arrayBuffer().then(buf => resolve(new Uint8Array(buf)), reject);
    }, 'image/png'));
}

export const nextFrame = () => new Promise(r => setTimeout(r, 0));

export function toast(msg, level = 'info') {
    let host = document.getElementById('lwToasts');
    if (!host) { host = h('div#lwToasts'); document.body.appendChild(host); }
    const t = h('div.toast.toast-' + level, msg);
    host.appendChild(t);
    setTimeout(() => t.remove(), level === 'error' ? 8000 : 4000);
}

/** A canvas-backed RGBA buffer helper. */
export function makeCanvas(w, h2) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h2;
    return c;
}

export function fmt(v, d = 3) {
    if (v == null || !Number.isFinite(v)) return '—';
    return Number(v.toFixed(d)).toString();
}
