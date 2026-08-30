import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { createGame, press, tick } from "../game-logic.ts";

// Contract tests for crit 5 ("A game"). These answer the published spec at
// https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/crits/05-game/
// and retire with it — they stay behind when the week does.
const DIST = resolve("dist");

function files(dir: string = DIST): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? files(path) : [path];
  });
}

const pages = files()
  .map((path) => relative(DIST, path).split(sep).join("/"))
  .filter((name) => name.endsWith(".html"))
  .map((name) => ({
    name,
    doc: new JSDOM(readFileSync(join(DIST, name), "utf8")).window.document,
  }));

describe("self-teaching: no instructions anywhere", () => {
  // "no modal, help page, or README workaround" — the opening screen alone
  // must signal the first move. A page that ships tutorial text failed this
  // whatever the game turns out to be, so this check is mechanic-agnostic.
  const forbidden = /how to play|instructions|tutorial|click here to start|press any key to begin/i;

  for (const { name, doc } of pages) {
    it(`${name} has no instructional text`, () => {
      expect(doc.body.textContent, "the opening screen must teach by itself, not by telling").not.toMatch(forbidden);
    });

    it(`${name} has no help/tutorial affordance`, () => {
      const helpEl = doc.querySelector(
        '[class*="help" i], [id*="help" i], [class*="tutorial" i], [id*="tutorial" i], dialog, [role="dialog"]',
      );
      expect(helpEl, `found a likely help/tutorial element: ${helpEl?.outerHTML}`).toBeNull();
    });
  }
});

describe("losable: play can end in a win, loss, or finish", () => {
  // Contract, not implementation: whatever the mechanic, the built game must
  // expose its outcome somewhere a test (and a screen reader) can read it.
  const home = pages.find(({ name }) => name === "index.html");

  it("exposes a game status the test suite can read", () => {
    const status = home?.doc.querySelector("[data-status]");
    expect(status, "no element with [data-status] found").toBeTruthy();
  });

  // The rest of this block tests game-logic.ts directly rather than the
  // built HTML: simulating real keyboard timing through a static DOM isn't
  // practical, and the state machine is exactly the "contract" these lines
  // are checking — the DOM only needs to reflect whatever it decides.
  it("three missed catches end the round in a loss", () => {
    let state = createGame();
    let now = 0;
    state = press(state, 1, now); // any lane starts the round

    for (let i = 0; i < 3; i++) {
      now += state.interval + 1; // let the active prompt's window lapse
      state = tick(state, now);
    }

    expect(state.status).toBe("lost");
  });

  it("pressing the wrong lane counts as a miss, not a free pass", () => {
    let state = createGame();
    state = press(state, 0, 0); // start
    const wrongLane = (state.activeLane! + 1) % 3;

    state = press(state, wrongLane, 1);

    expect(state.misses).toBe(1);
  });

  it("enough catches end the round in a win", () => {
    let state = createGame();
    let now = 0;
    state = press(state, 0, now); // start

    while (state.status === "playing") {
      now += 1;
      state = press(state, state.activeLane!, now);
    }

    expect(state.status).toBe("won");
  });
});
