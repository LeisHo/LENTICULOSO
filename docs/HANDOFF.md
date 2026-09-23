# LENTICULOSO — Handoff Notes

## Current State

Lenticular Workbench v1 is built and runs locally
(double-click `Start Lenticular Workbench.bat`, or `python scripts/active/serve.py 8430 --open`). Every feature in
the original brief is implemented and browser-tested. `node --test
tests/*.test.mjs` shows 21/21 passing. Nothing is deployed, and nothing has
been checked on a physical print yet.

## Known Issues

None currently open. Known limitations (main-thread generation, conventions
not yet checked on paper) are in docs/PROJECT_SUMMARY.txt.

## Architecture Notes

- `src/lenticular/core/` is pure and is the only place maths lives. Change
  it together with its tests; the golden fixtures will fail on any
  interlace change (intended — regenerate with `UPDATE_GOLDEN=1` only on
  purpose).
- The frame/slot convention is p = N−1−s (optical inversion). Don't "fix"
  a reversed print by changing it — that is what Reverse frame order is for.
- `effectiveLpi` must never be auto-filled from `nominalLpi`.
- Read docs/INTERLACING_METHOD.md before touching the interlacer.

## Next Steps

See docs/PROJECT_PROGRESS.md "What's next" — physical verification first.
