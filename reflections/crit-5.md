# Crit 5 reflection

**What was the breakthrough that moved the work forward?**

The breakthrough was deciding not to test the game through the page at all.
"A game" that has to teach itself and be losable sounds like something you can
only verify by clicking around, but simulating real keyboard timing against a
rendered DOM isn't practical. Pulling every rule — lanes, misses, timing, win
and loss — into a plain state machine (`game-logic.ts`) with no DOM or timers
let me assert the contract directly with synthetic timestamps, and freed the
actual page code to just be a thin renderer over whatever the state machine
decided. Everything after that — a second mode, a life-count display, letting
the player bail out mid-round — was just a new caller of the same functions,
not a new set of rules to keep in sync.

**What did this work change about who I want to be as a developer?**

I noticed myself defaulting to the more complete version of a feature first —
true pause/resume with frozen timers, rather than "just reset" — and having to
talk myself down once the actual cost was named against the deadline. I want to
get better at asking "what does this actually need to do" before reaching for
the general solution, especially under time pressure. I also liked writing a
test that ties two independent-looking numbers (the life icons and
`MAX_MISSES`) together so they can't quietly drift apart — that felt like the
first time a test I wrote was protecting a *future* mistake, not just today's
one, and I want more of my tests to do that.
