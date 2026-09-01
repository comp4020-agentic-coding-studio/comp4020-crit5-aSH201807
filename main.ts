import {
  createGame,
  press,
  startTimeAttack,
  tick,
  TIME_ATTACK_DURATION_MS,
  type GameState,
} from "./game-logic.ts";

const gameEl = document.querySelector<HTMLElement>("#game")!;
const laneEls = Array.from(gameEl.querySelectorAll<HTMLElement>(".lane"));
const lifeEls = Array.from(gameEl.querySelectorAll<HTMLElement>(".life"));
const catEl = gameEl.querySelector<HTMLElement>(".cat")!;
const outcomeEl = document.querySelector<HTMLElement>("#outcome")!;
const resetLink = document.querySelector<HTMLAnchorElement>("#reset")!;
const timeAttackBtn = document.querySelector<HTMLButtonElement>(".mode-timeattack")!;
const timerBarEl = document.querySelector<HTMLElement>("#timer-bar")!;
const scoreEl = document.querySelector<HTMLElement>("#score")!;

const KEY_TO_LANE: Record<string, number> = {
  ArrowLeft: 0,
  ArrowUp: 1,
  ArrowRight: 2,
};

let state: GameState = createGame();
let audioCtx: AudioContext | undefined;

// Browsers refuse to make sound before a user gesture, so the AudioContext
// is created lazily on the first keypress rather than at page load.
function tone(frequency: number, durationMs: number): void {
  audioCtx ??= new AudioContext();
  const oscillator = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  oscillator.frequency.value = frequency;
  oscillator.connect(gain);
  gain.connect(audioCtx.destination);
  gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + durationMs / 1000);
  oscillator.start();
  oscillator.stop(audioCtx.currentTime + durationMs / 1000);
}

function flash(lane: HTMLElement, kind: "catch" | "miss"): void {
  lane.classList.add(kind);
  lane.addEventListener("animationend", () => lane.classList.remove(kind), { once: true });
}

function render(previous: GameState): void {
  gameEl.dataset.status = state.status;
  gameEl.dataset.mode = state.mode;

  if (state.mode === "timeAttack") {
    scoreEl.textContent = String(state.score);
  } else {
    lifeEls.forEach((life, index) => life.classList.toggle("lost", index < state.misses));
  }

  if (previous.status === "ready" && state.status === "playing" && state.mode === "timeAttack") {
    timerBarEl.style.setProperty("--round-duration", `${TIME_ATTACK_DURATION_MS}ms`);
    timerBarEl.classList.remove("running");
    void timerBarEl.offsetWidth; // reflow, so re-adding the class restarts the animation
    timerBarEl.classList.add("running");
  }

  laneEls.forEach((lane, index) => {
    const active = state.status === "playing" && state.activeLane === index;
    lane.classList.toggle("active", active);
    if (active) {
      lane.style.setProperty("--duration", `${state.interval}ms`);
    }
  });

  // The lane that was active a moment ago is the one that just resolved,
  // whether by a matching press, a wrong press, or the timer running out.
  const resolvedLane = previous.activeLane !== null ? laneEls[previous.activeLane] : null;

  if (state.score > previous.score) {
    catEl.classList.add("pounce");
    tone(660, 120);
    if (resolvedLane) flash(resolvedLane, "catch");
  } else if (state.misses > previous.misses) {
    catEl.classList.add("startled");
    tone(220, 150);
    if (resolvedLane) flash(resolvedLane, "miss");
  }

  if (state.status === "lost" && previous.status !== "lost") {
    outcomeEl.textContent = "Game over.";
    tone(120, 400);
  }
  if (state.status === "won" && previous.status !== "won") {
    outcomeEl.textContent = "You win!";
    tone(880, 300);
  }
  if (state.status === "finished" && previous.status !== "finished") {
    outcomeEl.textContent = `Caught ${state.score}.`;
    tone(440, 250);
  }
}

catEl.addEventListener("animationend", () => catEl.classList.remove("pounce", "startled"));

const TERMINAL_STATUSES: GameState["status"][] = ["lost", "won", "finished"];

// Shared by a full bail-out and a terminal-state restart: wipes whatever a
// finished round left on screen (flashes, the timer bar, the result text)
// so the next render starts from a clean slate.
function clearRoundVisuals(): void {
  catEl.classList.remove("pounce", "startled");
  laneEls.forEach((lane) => lane.classList.remove("active", "catch", "miss"));
  timerBarEl.classList.remove("running");
  outcomeEl.textContent = "";
}

function resetToReady(): void {
  const previous = state;
  state = createGame();
  clearRoundVisuals();
  render(previous);
}

function handleKey(event: KeyboardEvent): void {
  // A round in progress doesn't have to run to completion — Escape bails
  // out to "ready" from anywhere, same as the reset link.
  if (event.key === "Escape" && state.status !== "ready") {
    resetToReady();
    return;
  }

  const lane = KEY_TO_LANE[event.key];
  if (lane === undefined) return;
  event.preventDefault();

  const previous = state;
  // The same key that ends a round also starts the next one — otherwise the
  // first press after a win/loss/finish silently resets and does nothing
  // visible, and a second press is needed to actually start playing again.
  if (TERMINAL_STATUSES.includes(state.status)) {
    state = createGame();
    clearRoundVisuals();
  }
  state = press(state, lane, performance.now());
  render(previous);
}

timeAttackBtn.addEventListener("click", () => {
  if (state.status !== "ready") {
    resetToReady();
  }
  const previous = state;
  state = startTimeAttack(state, performance.now());
  render(previous);
});

resetLink.addEventListener("click", (event) => {
  event.preventDefault();
  resetToReady();
});

function loop(now: number): void {
  const previous = state;
  state = tick(state, now);
  if (state !== previous) render(previous);
  requestAnimationFrame(loop);
}

document.addEventListener("keydown", handleKey);
gameEl.focus();
requestAnimationFrame(loop);

// Decorative depth-of-field on the background layers (see .bg-layer in
// styles.css) — skipped entirely for anyone who's asked for less motion.
if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  const root = document.documentElement;
  let latestX = 0;
  let latestY = 0;
  let queued = false;

  document.addEventListener("mousemove", (event) => {
    latestX = event.clientX;
    latestY = event.clientY;
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      root.style.setProperty("--mx", String(latestX / window.innerWidth - 0.5));
      root.style.setProperty("--my", String(latestY / window.innerHeight - 0.5));
    });
  });
}
