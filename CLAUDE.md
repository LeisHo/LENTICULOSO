# LENTICULOSO — Project Conventions

**Lenticular Workbench**: a local, browser-only app that calibrates a
physical lenticular lens's effective LPI through printed tests (the user
judges them through the real lens) and generates print-ready interlaced
PNG/TIFF files from 2..N images at that fractional LPI. The maths and its
evidence live in `docs/INTERLACING_METHOD.md`; read it before touching
`src/lenticular/core/`.

Built on the workspace-standard HTML scaffold: the dev panel (§12) and the
UI Layout Engine (§13), wired together. Long-form docs live in `docs/`
(`PROJECT_SUMMARY.txt`, `CODE_SUMMARY.txt`, `PROJECT_PROGRESS.md`,
`CHANGELOG.txt`, `HANDOFF.md`). This file is only a map and a list of gotchas.

## File map

- `index.html` — page shell. The dev-panel markup between the two
  `PROJECT: your own game content goes ...` markers, and the small
  `html.dev-mode` `<head>` script above it, are copied **verbatim** from
  `.claude/TEMPLATE_DEV_PANEL.html`. Everything else (the `#appStage`
  block, the two `<link>`s, the two `<script>`s) belongs to this project.
  **Script order matters — see the comment in its `<head>`.**
- `src/main.js` — the host: engine registration, the active-context
  bridge, `window.renderLenticulosoDevGroups`, and persistence. New
  features put their state and dev-panel groups here.
- `src/style.css` — the template's `<style>` block verbatim (Part 1),
  then this project's own styling and the Inspector's host-side chrome
  (Part 2). A banner comment marks the boundary.
- `src/devpanel/devPanel.js` — the template's `<script>` block verbatim,
  differing only by **one inserted line** at the template's documented
  `[JS-14]` splice point (`window.renderLenticulosoDevGroups`).
- `src/lenticular/` — **the app.** `core/` is pure maths with no DOM
  (units, interlace, calibration, profiles, encode, checks, transform),
  tested by `tests/core.test.mjs` (`node --test tests/*.test.mjs`). `ui/`
  holds the five tabs plus the canvas renderers. `app.mjs` is the shell;
  `lenticular.css` is the styling. `src/main.js` mounts it into `#appStage`.
- `tests/fixtures/interlace-golden.json` — FNV-1a hashes that lock the
  interlace output. Regenerate only on purpose (`UPDATE_GOLDEN=1`).
- `lib/ui-engine/` — vendored UI Layout Engine **v0.2.6**, byte-identical
  to `J:\CLAUDE\PROJECTS\HTML UI ENGINE\` as of 2026-09-23.
- `data/processed/ui-layout-config.json` — git-tracked layout *intent*,
  one entry per registered element. It is not resolved geometry.
- `api/save-settings.js` — the optional §12l git-tracked write-through.
  It does nothing until its env vars and the client-side secret are
  configured; `localStorage` handles saving until then.
- `scripts/active/serve.py` — the local dev server (default port 8430,
  `--open` launches the browser). It's required (see the gotchas below).
- `Start Lenticular Workbench.bat` — the double-click launcher for the
  user: runs serve.py on 8430 with `--open`.
- `data/raw/` — gitignored. Holds content inherited from projects this
  folder was copied from, kept aside rather than deleted (§11). Nothing
  live reads it.

## Untouchable systems

- **The interlace convention** (slot s holds sequence position N−1−s;
  positive phase moves strips toward +axis; absolute-position assignment,
  never per-lenticule rounding) is locked by the golden fixtures. A print
  that plays backwards is fixed with the Reverse button, not by changing
  the convention.
- **`effectiveLpi` is only ever set by the user** (a picked strip, or typed
  in deliberately). Never auto-copy `nominalLpi` into it.
- **`src/devpanel/devPanel.js` must stay a verbatim copy.** Don't fix
  dev-panel bugs here. Fix them in `.claude/TEMPLATE_DEV_PANEL.html` first
  (via `.claude/scripts/edit-template-dev-panel.js`), then re-copy its
  `<script>` block and re-apply the single splice line. The same goes for
  Part 1 of `src/style.css` and the template-derived markup in `index.html`.
- **`lib/ui-engine/*` is vendored, not authored here.** A real engine gap
  gets fixed in `HTML UI ENGINE/` (with a test and a CHANGELOG entry, based
  on this project's real code, per §13), then re-vendored. Never patch the
  vendored copy in place. Run `diff -q` against the canonical source first.

## Vocabulary

- **Tab** (dev panel) — Desktop / Mobile / Landscape.
- **Context** (UI engine) — `base` / `mobilePortrait` / `mobileLandscape`.
  `src/main.js`'s `ENGINE_CONTEXT_BY_TAB` maps between the two.
- **Splice point** — the one line inside `ensureDevPanelBuilt()` where the
  template hands control to this project's own `render*` functions.
- **LPI / pitch / DPI / ppl** — lens lenticules per inch; 1/LPI inch;
  print pixels per inch; `ppl = DPI/LPI` pixels per lenticule (a real number).
- **Slot / sequence position** — slot = strip index from a lenticule's low
  edge; sequence position = index into the frame cycle (`p = N−1−s`).
- **Phase** — pattern registration in lenticules (0–1); the lens profile's
  `phase` is the phase-test result φ_b (see the method doc §4).

## Known gotchas

The first nine were inherited from sibling projects built on the same
scaffold; the ones marked "Hit here" happened in this project.

- **`registerDevControlArray()` is required.** Without it, a control's
  "Show in Mobile/Landscape" checkbox toggles, saves and loads, but never
  creates a row, and nothing reports an error. `src/main.js`'s `addRow()`
  collects every control so the call can't be forgotten. After wiring a
  new control, **click its checkbox and confirm the row appears on the
  Mobile tab.**
- **`ctrl.tab` must be `'desktop'`** on a Desktop control. `addRow()`
  sets it for you.
- **Bump `LENTICULOSO_SETTINGS_SCHEMA_VERSION`** (top of `src/main.js`)
  after any structural dev-panel change (a renamed, split or merged group
  or row, or a changed id). Otherwise a stale save restores the old layout
  on top of the new one.
- **Bump `?v=` on both `<script>` tags** in `index.html` when their
  content changes.
- **Never blind-POST to the settings endpoint.** Always GET → merge → POST.
  The file holds several independent top-level keys, and a blind overwrite
  erases the others.
- **`vercel.json` must contain no explanatory keys.** Vercel fails the
  build on any unknown top-level property, and a failed build silently
  keeps serving the previous deployment.
- **`python -m http.server` can't serve this project.** It sends `.mjs`
  as `text/plain`. Use `scripts/active/serve.py` (or the launcher).
- **This project's port is 8430, not 8420.** 8420 is habitually occupied
  by a sibling project's (FONTSO's) server, so "open localhost:8420" silently
  showed that app's blank scaffold. The user runs the app with
  `Start Lenticular Workbench.bat`. A double-clicked `index.html` (file://)
  cannot load ES modules; the `#appStagePlaceholder` message explains this
  and must stay visible by default. (Hit here, 2026-09-23 — the user saw
  an "empty app".)
- **A local static server in the sandbox can intermittently half-deliver
  a large script.** If the dev panel loads with empty groups, retry the
  navigation before assuming the code regressed.
- **`javascript_tool` eval can't see module top-level declarations.**
  Drive the real UI, or patch a real global, to test host logic.
- **The live site commits to `main` on its own.** Every dev-panel Sync,
  profile change and saved project is a commit made by the Vercel
  function. Always `git pull --ff-only` before committing locally, or the
  push is rejected. Those data-only commits don't trigger a rebuild
  (`vercel.json` `ignoreCommand`). (Hit here, 2026-09-23.)
- **The save secret in `src/main.js` is not access control.** It is the
  workspace-shared anti-spam token (same as HANDO/CLICKO). Anyone who can
  open the site can load saved projects.
- **Native `Element.append(null)` prints "null".** In `src/lenticular/`,
  build DOM with `h()`/`add()` from `ui/dom.mjs`, which skip null/false.
  (Hit here, 2026-09-23.)
- **Calibration-sheet geometry must be computed in print pixels from DPI.**
  Mixing mm and px once overlapped the inch ruler with the 50 mm box.
  (Hit here, 2026-09-23.)
- **Every tab stays mounted (hidden panes).** A document-wide query such as
  `.orient-btn` hits the hidden Calibrate pane first; scope queries and
  tests to `[data-pane=…]`. (Hit here while testing, 2026-09-23.)

## Deliberate architecture exceptions

- **The "UI Layout" Inspector group is panel-level, not per-tab.** It
  carries its own context tabs, and it would mirror into the other tabs
  as an empty shell otherwise (the same reason "Mouse Log" is excluded).
- **Only `appStage`, `lwHeader` and `lwMain` are UI-Layout-Engine
  elements.** The Workbench's inner UI is ordinary document flow (forms,
  cards, grids), so it has no positioning intent for the engine to manage.
  Revisit if the app grows real floating/anchored UI.
- **The "Workbench Display" dev-panel group holds screen-display prefs
  only.** Print geometry (LPI/DPI/size/phase) lives in the app's own UI and
  profiles, where it is labelled, validated and saved with the work. It is
  deliberately not in the dev panel.

## Divergences from the shared template (keep this list near zero)

1. `src/devpanel/devPanel.js`: one inserted line (the splice point) plus a
   short comment explaining it.
2. `src/style.css` / `index.html`: a provenance header comment above the
   verbatim template content, and this project's own content after it.
