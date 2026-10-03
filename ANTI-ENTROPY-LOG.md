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
