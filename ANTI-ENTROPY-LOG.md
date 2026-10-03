# ANTI-ENTROPY LOG — quilt-studios

Append-only. Every fault found is recorded when found and again when fixed.
The log IS the repair receipt. (Wave-69 standing rule: anti-entropy logging.)

## F1 — no CI at all (found wave-69)

- Fault: the game-master surface had no workflow; lint drift could land
  silently.
- Fix: `.github/workflows/ci.yml` — spec gate → `npm run lint`. Deliberately
  NOT a build pipeline this wave (SPEC §1: no engine drift, light touch).

## F2 — no specification-first layout (found wave-69)

- Fault: no spec/.
- Fix: `spec/SPEC.md` pre-registering this repo's deliberately small wave-69
  scope (reading-room surface; gate + CI only; no src/ engine changes), so
  any future engine edit must re-seal the spec first — the gate enforces
  the order: spec, then code.

## F3 — lint violations against the repo's own sealed spec (found wave-69)

- Fault: SPEC V3 mandates lint-clean; the tree shipped 2 errors
  (`react-hooks/set-state-in-effect` in `src/hooks/use-mobile.ts` and
  `src/components/ui/carousel.tsx`) — CI had never run lint, so the drift
  was invisible. Also: no lockfile and no install step, so the first real
  CI run failed on `eslint: not found`.
- Fix: use-mobile rewritten on `useSyncExternalStore` (the media query IS
  the external store; same observable behavior, no cascading render);
  carousel's api publish deferred one frame via rAF (same contract, no
  sync setState-in-effect); lockfile committed; CI installs deps before
  lint. The SPEC V2 no-engine-drift rule is respected: both files are UI
  hooks/components, and the fix brings the tree INTO compliance with the
  already-sealed V3 — no spec re-seal needed.
