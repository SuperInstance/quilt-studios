# quilt-studios SPEC — Wave-69: the morning book surface

Dialect: `studios-spec/w69` · Seal: `spec/spec_sha.json` · Gate: `tools/spec_gate.mjs`
Status: PRE-REGISTERED before implementation.

## 0. Role in the fleet

quilt-studios is the game-master surface: one engine, four rungs, the Night
Engine loop (world-craft → iterator players → dice → rewind → canon). In the
wave-69 cell economy it is the **reading room**: the place where the fleet's
cell-exchange traffic becomes legible to the principal.

## 1. Scope of wave-69 work here (deliberately small)

- **Gate + CI only.** No engine changes. The studios surface must not grow
  mechanism in this wave; it must stay loadable, lint-clean, and gated.
- `.github/workflows/ci.yml`: spec gate → eslint. That is the whole pipeline.
- The morning book (wave verdict, structural layout, state-exchange pathway
  map) ships as a fleet artifact under download/, not as app code.

## 2. Invariants

- **V1 Spec-first** — the gate runs before any other CI step; a tampered or
  missing spec refuses the entire pipeline (E_SPEC_* vocabulary, shared).
- **V2 No engine drift** — this wave touches no src/ engine file; if a future
  wave does, this SPEC must be re-sealed first (the gate enforces the order).
- **V3 Lint-clean** — `npm run lint` exits 0.

## 3. Fail-closed vocabulary

`E_SPEC_MISSING · E_SPEC_SHA_MISSING · E_SPEC_SHA_MALFORMED · E_SPEC_DIALECT ·
E_SPEC_TAMPERED`
