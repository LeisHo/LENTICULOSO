# Lenticular Workbench — Interlacing & Calibration Method

This document records which approach the Workbench uses and why, so a
later change to the maths can be judged against the reasoning rather than
against habit. Code: `src/lenticular/core/` (pure, DOM-free, unit-tested
in `tests/core.test.mjs`).

Evidence labels: **MEASURED** (checked by an automated test or a recorded
browser run), **DERIVED** (follows from the stated geometry), **SOURCED**
(from the references at the end), **UNVERIFIED** (not yet checked against
a physical print).

---

## 1. Four quantities, never conflated

| Quantity | Symbol | Meaning | Where it lives |
|---|---|---|---|
| Lens pitch | LPI | lenticules per inch of the **physical lens**; pitch = 1/LPI in | lens profile |
| Printer resolution | DPI | raster pixels per inch **at 100 % print scale** | printer profile |
| Physical size | in / mm | size on paper | Create / calibration settings |
| Pixel size | px | raster width × height | derived: `round(size_in × DPI)` |

The raster size is the **only** rounded quantity, rounded **once**
(`units.physicalToPixels`). Pixels per lenticule, `ppl = DPI / LPI`, stays
a real number (600 / 100.37 = 5.97788…). *(MEASURED: tests 1–5.)*

---

## 2. Interlacing: absolute-position slot assignment

Along the interlace axis (x for vertical ridges, y for horizontal), pixel
`i` covers `[i, i+1)` px. In lenticule units:

```
t(i) = (i + 0.5) / ppl − phase        lens coordinate of the pixel centre
L    = floor(t)                        which lenticule
u    = t − L                           position inside it, 0 ≤ u < 1
s    = floor(u × N)                    slot, N = frames in one cycle
p    = N − 1 − s                       sequence position (optical inversion, §3)
```

Every pixel is classified from its **absolute** position. The alternative —
"k pixels per lenticule, repeat" — has to round k, and the rounding error
accumulates: at 600 DPI / 100.37 LPI, rounding 5.978 px to 6 px leaves the
pattern a whole lenticule out of step after about 270 lenticules
(2.7 in). *(DERIVED: 270 × (6 − 5.97788) ≈ 5.97 px ≈ one lenticule.)* That
drift is exactly the banding the pitch test is built to expose, so an
interlacer that rounds per lenticule would throw away the calibration.
With absolute assignment the only error is sub-pixel quantisation of each
slot boundary (≤ ½ px), and it never accumulates. *(MEASURED: test 3 checks
the last lenticule index over 3,000 px matches the exact physical count;
test 8 checks 5 frames at 1200 DPI / 100.37 LPI each get 20 % ± 1 % of
columns.)*

**Boundary pixels** (`boundary`):
- `nearest` (default) — a pixel belongs wholly to the slot containing its
  centre. Crisp, no crosstalk.
- `blend` — area-weighted mix of every slot the pixel overlaps, weights
  quantised to 1/256 that sum to exactly 256 (integer arithmetic, fully
  deterministic). The average strip position is exact, at the cost of
  slight crosstalk. *(MEASURED: blend-mode test.)*

**Frame sampling** (`sampling`): behind one lenticule, each frame's strip
is magnified across the whole lenticule, so a viewer sees **one sample per
lenticule per frame**. The frame is therefore effectively resampled to lens
resolution. `lenticule` (default) uses the mean of the frame over that
lenticule's pixel span, a box pre-filter at lens resolution. It is the
direct equivalent of the classic "resize each frame to the lenticule count,
then strip it" approach, but it never leaves the print grid. `direct`
copies the pixel at the same location (more aliasing). *(MEASURED: the
lenticule-sampling test checks the box average on a gradient.)*

Memory: frames are requested **one at a time** (`getFrame(k)` is called
once per distinct frame). The `nearest` path writes straight into the
output, and lenticule means use per-line prefix sums. Peak memory is
therefore roughly one frame plus the output, not N frames.

**Determinism:** there is no randomness and no floating-point
accumulation across pixels. `tests/fixtures/interlace-golden.json` holds
FNV-1a hashes of 4 parameter combinations (2/3/4 frames, both
orientations, both boundary modes, both sampling modes, fractional LPI,
non-zero phase). Any change to the algorithm fails that test. Regenerate
deliberately with `UPDATE_GOLDEN=1`.

## 3. Optical inversion and frame order

A lenticule is a converging cylindrical lens with the print near its focal
plane. A viewer to the **right** of the lens axis sees the strip on the
**left** of the lenticule. For a viewer moving left → right to see
A → B → C, slot 0 (the left edge) must hold the **last** sequence position:
`p = N − 1 − s`. *(DERIVED; MEASURED as a convention by tests 6, 7 and 12b.)*
This is a geometric convention, not a measurement of your lens. If the
real print plays backwards (the lens is flipped, or the print moves
instead of your head), **Reverse frame order** swaps it. *(UNVERIFIED
against a physical print.)*

Ping-pong for `[A, B, C]` is `[A, B, C, B]`. The cycle repeats every
lenticule, so the "A" that would close "A B C B A" is the next
lenticule's first strip.

## 4. Phase / registration

Pitch decides whether the pattern stays in step with the ridges across the
whole print. Phase decides where, within one ridge, the pattern starts,
and therefore which frame is seen head-on. Phase is stored separately from
pitch, in lenticules (0 ≤ φ < 1). Positive φ moves the strips toward +axis
by φ × pitch. *(MEASURED: test 12 — φ = 0.5 inverts a 2-frame pattern,
φ = 1 is the identity.)*

**Phase test (Calibrate, step 6).** Strips at the calibrated LPI, each
shifted by k/K of a ridge. With the lens pushed against a fixed reference
(e.g. a paper corner), the user picks the strip that looks most solid
black when viewed straight on. With black = sequence position 0 = slot 1 =
u ∈ [0.5, 1), that strip's φ_b places u = 0.75 under the ridge centre, so
the lens offset is `c = φ_b + 0.25`. *(DERIVED.)*

**Using it (Create → Advanced).** To show sequence position p head-on,
the target is `u = (N − 1 − p + 0.5) / N`, and the applied phase is
`φ = φ_b + 0.75 − u (mod 1)`, plus an optional manual shift. The default
head-on frame is the middle of the sequence.

Why this is not automatic: the head-on view depends on where the lens
physically sits relative to the print, which changes every time the lens
is placed by hand. The registration is only meaningful if placement is
repeatable, so it is opt-in, and a manual phase slider is always
available. *(UNVERIFIED against a physical print.)*

## 5. Pitch calibration

Each candidate strip is a 2-frame black/white interlace at that candidate
LPI. The lens and the printed pattern are two gratings; their mismatch
produces beat bands at

```
bands per inch = |LPI_candidate − LPI_lens|      →   bands on a strip = length_in × |ΔLPI|
```

A matched strip flips uniformly black↔white as you tilt; a mismatched one
shows bands, more of them the further off it is. The user, looking through
the physical lens, is the instrument. The app never infers an effective
LPI: `effectiveLpi` stays `null` until the user selects a strip.
*(SOURCED: Triaxes' pitch-test description — the correct band shows "no
waves", coarse 0.1 then fine 0.01 LPI passes, view from the intended
distance, align with a line perpendicular to the bands.)*

**Honest resolution.** A strip L inches long shows less than one band
for a pitch error below 1/L LPI. The app reports this, and warns when
neighbouring candidates differ by less than ¼ band (`step × L < 0.25`),
advising the user to pick the **middle of the run** of clean strips
instead. An A4 portrait sheet with 10 mm margins gives 7.18 in strips
(≈ 0.139 LPI per band). A4 landscape gives ~10.9 in (≈ 0.092 LPI).
*(MEASURED: the layout test; values shown in the app.)*

**Effective vs mechanical pitch.** The pitch that looks best depends on
viewing distance and on the printer's actual scaling, so it is usually not
the seller's mechanical pitch. That is why the result is stored as a
property of *this lens with this print chain* (`calibratedWith`: printer
and DPI) and why Create warns when the output DPI differs from the
calibration DPI. *(SOURCED: Triaxes — the best pitch depends on viewing distance.)*

**Physical scale check.** Every sheet carries a 100 mm ruler, a 4 in
ruler in tenths, a 50 mm reference box, and the warning *PRINT AT 100% /
ACTUAL SIZE. DISABLE FIT-TO-PAGE AND AUTOMATIC SCALING.* A printer that
scales by 0.3 % shifts the apparent pitch by 0.3 LPI at 100 LPI (DERIVED),
which is larger than a fine step, so the rulers must be checked before the
pitch is judged.

## 6. Output files

- **PNG** (primary): the canvas's own lossless PNG plus an inserted
  `pHYs` chunk (pixels per metre, unit = metre) so print software can
  size it correctly. 600 DPI is stored as 23,622 px/m (0.0254 m/in; reads
  back as 599.9988 DPI, the chunk's integer limit). *(MEASURED: test 13 and
  the browser run — the exported 3600 × 2400 PNG matched an independent
  re-computation byte for byte: 0 differing bytes.)*
- **TIFF**: baseline uncompressed RGB, little-endian,
  XResolution/YResolution as rationals (DPI × 1000 / 1000), unit = inch.
  *(MEASURED: test 13b.)*
- **No PDF**: the deliverable is the raster. Wrapping it in a PDF would
  add another layer that can rescale it.

## 7. Simulated preview

`simulateView()` reads the **generated raster**, not the source frames.
For a viewing position it samples each lenticule at the slot that position
would see (optical inversion applied) and stretches it across the
lenticule. So it verifies the frame order, count, direction and
composition of the actual file. It is an ideal lens: no focal error, no
lens crosstalk, no viewing distance. The UI labels it as a simulation.
*(MEASURED: test 12b, both orientations at 100.37 LPI, > 97 % of pixels
show the expected frame.)*

## References

- Triaxes, *Lenticular pitch test* — https://triaxes.com/docs/Pitch-test-en/Description.html
- ViCGI, *Lenticular software / pitch testing* — https://www.vicgi.com/lenticular-software.html
- Found in the search but NOT read, listed only for follow-up:
  US 7,593,132 *Method for calibrating printing of lenticular images to lenticular media*
  (https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/7593132) and
  US 7,033,090 *Lenticular-printing calibration targets*
  (https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/7033090).
- 3D Stereoscopic Photography, *Lenticular interlacing* — http://3dstereophoto.blogspot.com/2014/08/lenticulars-lenticular-interlacing.html
- prewk/lenticular-interlacer (open source; takes LPI/DPI/orientation — its README does not document how it handles fractional pixels per lens, so it was not used as a model) — https://github.com/prewk/lenticular-interlacer
