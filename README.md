# LENTICULOSO — Lenticular Workbench

A local, browser-only app for lenticular printing. It **calibrates** the
real effective pitch (LPI) of a physical lens sheet through printed tests
that you judge with your own eyes, and it **creates** print-ready
interlaced PNG/TIFF files from 2 or more images using that calibrated,
fractional LPI. All image processing runs client-side; nothing is uploaded.

See `docs/PROJECT_SUMMARY.txt` for the current state and
`docs/PROJECT_PROGRESS.md` for what's being worked on right now. The maths
and its sources are in `docs/INTERLACING_METHOD.md`. This README stays a
short pointer, not a duplicate of either.

## How to run it

**Double-click `Start Lenticular Workbench.bat`** in the project folder. It
starts the local server on port **8430** and opens your browser at
<http://localhost:8430/index.html>. Keep its window open while you work.
It needs Python 3 on PATH. There is no build step and no other dependency.

Or, from a terminal:

```bash
python scripts/active/serve.py 8430 --open
```

**Opening `index.html` directly does not work.** Browsers block the app's
JavaScript modules on `file://` pages, so you get a page with only a "did
not start" message. `python -m http.server` doesn't work either (it serves
`.mjs` with the wrong MIME type). Port 8430 is this project's own: 8420 is
often taken by a sibling project's server, which would show you a
different app.

Automated tests (Node 20+, no packages):

```bash
node --test tests/*.test.mjs
```

The dev panel shows on `localhost`, `127.0.0.1`, or with `?dev=1`. Press
**D** to hide/show it.

## The workflow

**First time — Calibrate:** enter the seller's LPI → generate the coarse
sheet → download the PNG and print it at **100% / Actual Size** → check the
rulers → lay the lens on it and tilt → click the cleanest strip → refine
(finer sheet) → optionally run the phase test → save as a lens profile.

**Every project — Create:** pick your lens and printer profiles → set the
output size → add 2+ images (or the built-in ONE/TWO/THREE test frames) →
align them (drag, scale, rotate, crop, flip; ghost/difference overlay) →
set the order (drag, **Reverse frame order**, loop or ping-pong) →
Generate → check the simulated preview → tick the print-safety checklist →
export the PNG → print at 100%.

## Project structure

```
LENTICULOSO/
├── index.html                 page shell + dev-panel markup (verbatim from the template)
├── src/
│   ├── main.js                host: UI-engine registration, dev-panel groups, persistence
│   ├── style.css              dev-panel CSS (verbatim) + scaffold styles
│   ├── devpanel/devPanel.js   shared dev-panel engine (verbatim — see CLAUDE.md)
│   └── lenticular/            THE APP
│       ├── app.mjs            shell: tabs, stores, settings
│       ├── lenticular.css     app styling
│       ├── core/              pure maths, no DOM (unit-tested)
│       └── ui/                the five tabs + canvas renderers
├── lib/ui-engine/             vendored UI Layout Engine v0.2.6
├── tests/                     node --test suite + golden fixtures
├── data/processed/            ui-layout-config.json (layout intent)
├── data/raw/                  inherited material from the copied project (gitignored)
├── docs/                      summaries, progress, changelog, handoff, method
├── scripts/active/serve.py    local dev server
└── api/save-settings.js       optional git-tracked dev-panel settings (inert until configured)
```

## Saving to git (deployed site)

On the Vercel deployment (<https://lenticuloso.vercel.app>), with
`GITHUB_TOKEN` and `DEV_PANEL_SAVE_SECRET` set in the Vercel project:

- **Dev panel** Sync / Set Default save to `data/processed/dev-panel-settings.json`.
- **Profiles** (lens, printer, paper), the calibration session and app
  settings save to the same file automatically (header shows the state).
- **Saved projects** (Create → "Save project") store the generated PNG,
  the original source images and the settings in `data/projects/<id>/`.

`GITHUB_REPO` defaults to `LeisHo/LENTICULOSO`. Locally, without a token,
everything still works in browser storage and the header says so.

**Privacy:** the save secret is in the page source (as in HANDO), so it only
stops casual spam. Anyone who can open the site can open saved projects.
Making the repo private hides the files on GitHub; to hide the site too,
enable Vercel Deployment Protection (password or Vercel login).

## Known limitations

See `docs/PROJECT_SUMMARY.txt`'s Known Limitations section.

## Roadmap

See `docs/PROJECT_PROGRESS.md` for what's next and `docs/CHANGELOG.txt` for
the history.
