// ====================================================================
// transform.mjs — per-frame placement into the common output frame (pure)
// ====================================================================
// Each source image is placed into the OUTPUT frame (the print, in output
// raster pixels) by: crop → fit → scale → rotate → flip → translate.
// Offsets are stored as FRACTIONS of the output frame, so the same
// alignment works at the small editor preview and the full-resolution
// export — both call frameMatrix() with their own output size.
// ====================================================================

export const DEFAULT_TRANSFORM = Object.freeze({
    x: 0,          // offset, fraction of output width  (+ = right)
    y: 0,          // offset, fraction of output height (+ = down)
    scale: 1,      // multiplier on top of the fit
    rotation: 0,   // degrees, clockwise
    fit: 'cover',  // cover | contain | stretch | none(1 source px = 1 output px)
    flipH: false,
    flipV: false,
    crop: { left: 0, top: 0, right: 0, bottom: 0 }, // fractions of the source removed from each edge
});

export function cloneTransform(t = DEFAULT_TRANSFORM) {
    return { ...t, crop: { ...(t.crop || DEFAULT_TRANSFORM.crop) } };
}

/** The source rectangle left after cropping, in source pixels. */
export function cropRect(srcW, srcH, crop) {
    const c = crop || DEFAULT_TRANSFORM.crop;
    const l = clamp01(c.left), r = clamp01(c.right), t = clamp01(c.top), b = clamp01(c.bottom);
    const sx = srcW * l;
    const sy = srcH * t;
    const sw = Math.max(1, srcW * (1 - l - r));
    const sh = Math.max(1, srcH * (1 - t - b));
    return { sx, sy, sw, sh };
}

/**
 * Affine matrix [a,b,c,d,e,f] (canvas setTransform order) mapping the
 * CROPPED source rectangle's local coordinates (0..sw, 0..sh) to output
 * pixels. Pure, so the preview and the export are provably identical up
 * to the output-size factor.
 */
export function frameMatrix(srcW, srcH, outW, outH, t) {
    const { sw, sh } = cropRect(srcW, srcH, t.crop);
    let fx, fy;
    switch (t.fit) {
        case 'contain': fx = fy = Math.min(outW / sw, outH / sh); break;
        case 'stretch': fx = outW / sw; fy = outH / sh; break;
        case 'none': fx = fy = 1; break;
        case 'cover':
        default: fx = fy = Math.max(outW / sw, outH / sh);
    }
    const sx = fx * t.scale * (t.flipH ? -1 : 1);
    const sy = fy * t.scale * (t.flipV ? -1 : 1);
    const th = (t.rotation * Math.PI) / 180;
    const cos = Math.cos(th), sin = Math.sin(th);
    // M = T(out centre + offset) · R · S · T(−source centre)
    const a = cos * sx, b = sin * sx, c = -sin * sy, d = cos * sy;
    const cx = sw / 2, cy = sh / 2;
    const e = outW / 2 + t.x * outW - (a * cx + c * cy);
    const f = outH / 2 + t.y * outH - (b * cx + d * cy);
    return [a, b, c, d, e, f];
}

export function applyMatrix(m, x, y) {
    return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

function clamp01(v) { return Math.max(0, Math.min(0.95, Number(v) || 0)); }
