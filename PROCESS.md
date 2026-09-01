# Process overview

## What I built

"Cat vs. Laser" — a three-lane reflex game mapped to the left/up/right arrow
keys, with no on-screen instructions: the opening screen has to teach the first
move by itself. It ships two modes reachable from the same "ready" screen —
Survival (three misses end the round, fifteen catches win, speed ramps up per
catch) and Time Attack (a fixed 30-second round where misses don't end play and
catches accumulate as a score) — built on one shared state machine rather than
two separate game engines.

## The moments that mattered

1. **A pure state machine before any DOM.** The spec's "self-teaching" and
   "losable" lines both needed contract tests, but simulating real keyboard
   timing through a rendered page isn't practical to assert against. Instead
   of testing through the DOM, I pulled all the rules — lanes, misses, wins,
   timing — into `game-logic.ts` as functions with no DOM or timer access
   (`press`, `tick`, `createGame`), and only wired that state machine into the
   page afterwards. `pnpm check` exercises the rules directly with synthetic
   timestamps, and `main.ts` ended up as a thin renderer with exactly one place
   the rules live.
   [`03fe7bf`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-aSH201807/commit/03fe7bf0b4d697425417c3ac0762a5037381760f)

2. **Bailing out beats pausing, given the deadline.** Once Time Attack existed
   alongside Survival, I needed a way to let a player quit or reset mid-round.
   The complete version — true pause/resume with frozen timers and a countdown
   that resumes exactly where it left off — would have meant tracking paused
   offsets against both a miss-based and a clock-based mode. I chose the
   cheaper option instead: Escape, the Reset link, or the hourglass icon all
   fully abandon the round and return to "ready", with no frozen state to get
   wrong. Named against the two-day deadline, the complexity the full version
   would add wasn't worth it for a prototype no one needs to resume later.
   [`6cc698e`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-aSH201807/commit/6cc698e5f53dc6bf4d8058e9d5aa029fa41b1665)

3. **A test that stops two numbers from drifting apart.** The visible
   life-count icons (three hearts above the lanes) and the actual loss
   condition (`MAX_MISSES` in `game-logic.ts`) are two independent places that
   both say "three." Rather than trust myself to update both if the rule ever
   changed, I added a contract test asserting the rendered icon count equals
   `MAX_MISSES`, so a future change to the difficulty can't silently leave the
   display lying about how many lives are left.
   [`391432a`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-aSH201807/commit/391432aee08f363221593a0c3041a1c281a419b4)

## Before you ship

`pnpm check:evidence` verifies your citations resolve to real commits, that a
reflection entry the marker reads is in `reflections/`, and that your
`CLAUDE.md` is there --- before a marker ever opens the file. It checks that
your map is traceable, not that it is good: the marker judges whether your
small, deliberately chosen set of moments shows real judgement and reflection. A
green check is not a substitute for that curation.

Images aren't checked: unlike a citation whose SHA doesn't resolve, a broken
image is visible the moment this file is rendered on GitHub.
