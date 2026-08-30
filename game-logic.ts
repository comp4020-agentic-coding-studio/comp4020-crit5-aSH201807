// Pure state machine for "Cat vs. Laser" — no DOM, no timers of its own, so
// it's testable directly (see spec/game.test.ts) without a build step.
// main.ts is the only thing that touches window/document/AudioContext.

export type Status = "ready" | "playing" | "lost" | "won";

export const LANE_COUNT = 3;

const MAX_MISSES = 3;
const WIN_SCORE = 15;
const START_INTERVAL_MS = 1100;
const MIN_INTERVAL_MS = 450;
const INTERVAL_STEP_MS = 40;

export interface GameState {
  readonly status: Status;
  readonly score: number;
  readonly misses: number;
  readonly activeLane: number | null;
  readonly deadline: number | null;
  readonly interval: number;
}

export function createGame(): GameState {
  return {
    status: "ready",
    score: 0,
    misses: 0,
    activeLane: null,
    deadline: null,
    interval: START_INTERVAL_MS,
  };
}

function withNextPrompt(state: GameState, now: number): GameState {
  return {
    ...state,
    activeLane: Math.floor(Math.random() * LANE_COUNT),
    deadline: now + state.interval,
  };
}

function registerCatch(state: GameState, now: number): GameState {
  const score = state.score + 1;
  if (score >= WIN_SCORE) {
    return { ...state, status: "won", score, activeLane: null, deadline: null };
  }
  const interval = Math.max(MIN_INTERVAL_MS, state.interval - INTERVAL_STEP_MS);
  return withNextPrompt({ ...state, score, interval }, now);
}

function registerMiss(state: GameState, now: number): GameState {
  const misses = state.misses + 1;
  if (misses >= MAX_MISSES) {
    return { ...state, status: "lost", misses, activeLane: null, deadline: null };
  }
  return withNextPrompt({ ...state, misses }, now);
}

// Starts the game (first keypress out of "ready"), or scores a press against
// the currently active lane while "playing". Any other status ignores it.
export function press(state: GameState, lane: number, now: number): GameState {
  if (state.status === "ready") {
    return withNextPrompt({ ...state, status: "playing" }, now);
  }
  if (state.status !== "playing") {
    return state;
  }
  if (state.deadline !== null && now > state.deadline) {
    return registerMiss(state, now);
  }
  return lane === state.activeLane ? registerCatch(state, now) : registerMiss(state, now);
}

// Called every animation frame; expires a prompt nobody caught in time.
export function tick(state: GameState, now: number): GameState {
  if (state.status !== "playing" || state.deadline === null) {
    return state;
  }
  return now > state.deadline ? registerMiss(state, now) : state;
}
