# Design Notes — the brainstorm (seeds, not specs)

Which concepts fit which rungs, and where the ah-ha moments live. Every entry is
an invitation to argue with, iterate on, and grow into something better.

## Rung-by-rung mapping

### Rung 1 — Seed Garden · littlest hands (~4–8) · sandbox
- **Fit:** The four atoms — cell, hook, hop, drop — become living things you plant, poke and befriend. Nothing can fail. Poking is the whole curriculum.
- **Ah-ha:** "Numbers LIVE in things, and friendships make numbers move." A four-year-old who has wiggled a hooked pod has already understood reactive state.
- **Seeds ahead:** a melody garden where hooks hum; a night mode where cells glow like fireflies; drops as seed packets to swap with a friend across the table.

### Rung 2 — Melon-Sandbox · curious kids (~8–12) · puzzles on top of sandbox tools
- **Fit:** Random worlds + random brains (three visible op slots between sense and act). The agent fails hilariously; the player rewires, rewinds, replays. Break-on-purpose challenge cards teach by inversion.
- **Ah-ha:** "The creature isn't dumb — its WIRING is." Debugging reframed as the game itself, and the sense→hop→act strip lights up every beat so the behavior is never magic.
- **Seeds ahead:** two agents sharing one melon; brains that drift (a hop that mutates each run); replay-the-best-run as a "greatest scene" you can rewind granularly.

### Rung 3 — Quilt Composer · students (~12+) · GarageBand / FruityLoops tier
- **Fit:** Track lanes are cells; the patch bay wires hops (echo / double / invert) between them; patterns save as drops — nested, bootable units. WebAudio transport makes the values audible.
- **Ah-ha:** "A composition is a computation." Dashed cells show values arriving through a hop instead of living in the lane — dataflow stops being a diagram and becomes a groove.
- **Seeds ahead:** record-and-overdub; per-step orchestrator consults ("the composer asks for a fill"); export drops that other students' sessions can boot.

### Rung 4 — Pong X-Ray · professionals & pros-at-heart · simulation
- **Fit:** A real game at 60fps; below the fold the same run as live cells — BALL·X, BALL·Y, HUMAN·IN lighting on keypress, PLAN·AI deciding. The call economy is the lesson: consults cost, every consult teaches the table, calls decelerate as confidence climbs. Repeated misses wake THE DECOMPOSER — the slow big agent — which adjusts the wiring and sleeps.
- **Ah-ha:** "Watch the calls fall." The moment a professional sees the quilt need less and less from outside — internalization as a visible curve — the whole architecture pitch collapses into one screen.
- **Seeds ahead:** demo-mode streaming from real runs (JEV via server routes, Cloudflare tiny agents as the fast layer, Moth pulses for placement, the decomposer on a real slower model); replay-to-stable-point scrubbing over the run log.

## Cross-rung ideas — where the rungs share one spine

### The dungeon
A ttrpg-shaped run where the party IS a quilt: each character a cell, each bond a
hook, the GM a decomposer who only speaks when the party is stuck. Younger players
feel a story; professionals recognize orchestrated agents with receipts. One skin,
two audiences, exactly as erised intends.

### Platonic randomness as the dice
Every "generate me something cool" in every rung rolls the same honest dice — pure
geometric randomness — so kids trust the generator and pros can cite the seed.
Randomness is the shared mortar between all four rungs.

### The scroll is the syllabus
Every studio is simulation-first at the top and functional quilt layers below the
fold. Play first, then scroll into truth. The format itself teaches: nothing here
is a mockup — every glowing cell is the real value of the thing you were just
playing with.

### Play-tests → play-throughs → demo-mode
The ladder doubles as our own pipeline: we play-test cells in the garden, play
through wirings in the sandbox, compose in the studio, and the pro rung streams
real runs. The demo site is not ABOUT the pipeline — it IS the pipeline, gamified,
with real conceptual work-product leaving every session.

## The one-engine claim

All four rungs run the same QuiltEngine — cells that hold, hooks that link, hops
that transform, layers that sequence, an orchestrator that asks and a decomposer
that untangles. Only the skin changes per age. That is the geometric-truth bet:
the essence of the toolkit is independent of its use-case, the way DNA is a
toolkit with variations. If a concept cannot be skinned down to a garden toy or up
to a pro simulation, we do not yet understand it — and the ladder tells us which
rung to rethink.

## Open engineering seams

- The run log in Pong X-Ray is the seed of the rewindable-run ledger: stable
  points, granular rewind, states adjusted along the way, and the *why* of each
  adjustment decomposed into new cells so future runs need no adjustment.
- `QuiltEngine.consult()` is the exact seam where a real JEV orchestrator call
  (server-side, keyed) replaces the local coach — same interface, real spend,
  receipts appended to the same feed.
- Drops in the composer are the smallest "saved-state bootable system": a full
  wiring + state, folded to a chip, bootable elsewhere. The garden journal is the
  same idea for concepts.
