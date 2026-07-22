# TargetLock Implementation Status

Status date: 2026-07-23
Target: `packages/main` only
Stage: Final pilot audit of Runbook V1 Stages 1–6 + Railway deployment prep

## Final pilot audit result

The local TargetLock pilot was integration-audited end-to-end. Authoritative
drilling maths remain in `src/domain/rods.ts`. Repository boundaries, hole
lock enforcement, report honesty, and refresh persistence were verified.
Material defects found during the audit were fixed. The package is ready for
supervised field pilot use with the limitations in `docs/known-limitations.md`.

**READY FOR FIELD PILOT**

## Railway deployment preparation

`packages/main` is isolated (own lockfile; no root workspace). Railway Root
Directory is `/packages/main` with config at `/packages/main/railway.json`,
healthcheck at `/api/health`, and an optional server-side pilot access gate.
Railway hosts application code only; browser-local Runs, photos and reports are
not synchronised. See `docs/railway-deployment.md`.

## Maths authority

Single implementations remain:

| Formula | Function | File |
|---------|----------|------|
| Base R/S | `calculateBaseRodString` | `src/domain/rods.ts` |
| Current R/S | `calculateCurrentRodString` | `src/domain/rods.ts` |
| Hole depth | `calculateHoleDepth` | `src/domain/rods.ts` |
| Drilled | `calculateDrilledLength` | `src/domain/rods.ts` |

Operational lengths stay integer decimetres internally and display to one
decimal place.

## Final audit fixes

- Timeline includes local completed runs (not seed-only) with run links.
- Current Hole recovery no longer double-counts seed + local runs.
- Report loss/gain uses per-run variance, matching completion statistics.
- Handover recovery cannot open a new shift after hole lock.
- Component recovery cleans stale prepared ops instead of breaking locked reads.
- Survey media writes assert hole mutability before IndexedDB blob save.
- Operational timeline titles for component assign/correct no longer fall through
  to shared-run wording.
- Hole search covers runs, shifts, casing, bits/reamers, surveys, trays,
  completions, reports, and timeline.
- Close Shift exposes **Close as final shift** so completion can proceed.
- Stage 2 seed night rod events continue Stage 1 rod history without duplicating
  Day Shift rods (fixes `FINAL_DEPTH_RECONCILED` for DDH041).
- More menu / prototype wording cleaned for one-product pilot presentation.

## Implemented surface retained

Stages 1–6 remain: runs, shifts/handover, casing, components, surveys, trays,
completion/lock/reopen, Report Centre/Activity, Timeline, Search, Statistics
(via shift history and domain aggregates), and completed-hole list.

## Verification

Run from `packages/main`:

- [x] `npm run test` — 244 unit tests (includes health + pilot-access gate)
- [x] `npm run test:e2e` — includes `e2e/pilot-end-to-end.spec.ts` plus Stage 2–6 suites
- [x] `npm run typecheck`
- [x] `npm run lint` — scoped TargetLock lint
- [x] `npm run build`
- [x] Responsive/light-dark review at `360`, `390`, `430`, `768`, `1024` px in
  the pilot Playwright workflow
- [ ] Manual accessibility/device review: keyboard-only, screen reader, 200%
  zoom, gloves, glare, physical camera, safe-area on hardware

### Manual checks still required

- Physical tablet/phone outdoors (glare, gloves, safe-area insets)
- Screen-reader walkthrough of complete/lock/reopen
- Keyboard-only complete workflow on a hardware keyboard
- Native share sheet on Capacitor/device if packaged later

## Still deferred

See `docs/known-limitations.md`. Highlights: no auth, no sync, no cloud media,
no SMTP delivery, barrel capacity unset, TargetLock IQ deferred, inherited demo
routes outside TargetLock nav remain in the package.

## Baseline constraints

- `packages/main` is the sole implementation target.
- The seven packages remain standalone; no root workspace is introduced.
- `docs/index.html` remains untouched.
- The authoritative external product-plan file must not be modified.
