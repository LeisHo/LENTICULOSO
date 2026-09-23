# LENTICULOSO — Project Progress

**This is a live document, not a log.** It holds only the current picture —
what's being worked on right now, what's recently done, and what's next. It
does **not** accumulate a running history of every past session; that
history already lives in `CHANGELOG.txt` (the append-only, authoritative
record — see CLAUDE.md §4a/§4). When something here is finished and no
longer relevant to understand what's current, remove it from this file
rather than leaving it to pile up. Rewrite the sections below in place at
each real update — don't append a new dated block underneath the old one.

This doc functionally doubles as a handoff document (CLAUDE.md §4c): a
brand-new AI chat with no prior context should be able to read this file
alone and know exactly where the project currently stands, and pick up the
work seamlessly from there.

--------------------------------------------------------------------------------

## Currently working on

Nothing in progress — see What's next.

## Recently completed

- Git-backed saving on https://lenticuloso.vercel.app (2026-09-23): dev
  panel, lens/printer/paper profiles, calibration and settings sync to
  `data/processed/dev-panel-settings.json`; saved projects (generated PNG +
  original sources + settings) in `data/projects/`. Verified live: sync,
  save 11.58 MB project in 6 pieces, reopen after reload, delete.
- Epson EcoTank printer presets (720 DPI) and Epson/Canon/HP paper presets.
- Lenticular Workbench v1: Calibrate / Create / profiles / settings, 35 tests.

## What's next

1. The user prints the coarse calibration sheet (A4, at the printer's native
   DPI — 720 for an Epson EcoTank preset — on the photo paper they will use,
   100% scale)
   and runs the real calibrate → refine workflow on the 100 LPI PET lens.
2. Print a 3-frame test-image interlace with the calibrated profile and
   confirm: (a) the frames switch, (b) the direction (use Reverse if not),
   (c) whether the phase test helps with repeatable lens placement.
3. Record the physical findings in docs/INTERLACING_METHOD.md (turning the
   UNVERIFIED labels into OBSERVED ones) and adjust the defaults if needed.
4. Optional: move generation into a Web Worker if large A4 outputs feel
   slow.

## Open questions / blockers

- The user said they will make the GitHub repo private (saved photos).
  The deployed site itself is still open to anyone with the URL unless
  Vercel Deployment Protection is enabled — user's call.

- Whether the optical-inversion default (A seen from the left) matches the
  user's lens and viewing habit. It can only be confirmed on a real print.
