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
const catEl = gameEl.querySelector<HTMLElement>(".cat")!;
const outcomeEl = document.querySelector<HTMLElement>("#outcome")!;
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

function resetToReady(): void {
  const previous = state;
  state = createGame();
  catEl.classList.remove("pounce", "startled");
  laneEls.forEach((lane) => lane.classList.remove("active", "catch", "miss"));
  timerBarEl.classList.remove("running");
  outcomeEl.textContent = "";
  render(previous);
}

function handleKey(event: KeyboardEvent): void {
  if (TERMINAL_STATUSES.includes(state.status)) {
    resetToReady();
    return;
  }

  const lane = KEY_TO_LANE[event.key];
  if (lane === undefined) return;
  event.preventDefault();

  const previous = state;
  state = press(state, lane, performance.now());
  render(previous);
}

timeAttackBtn.addEventListener("click", () => {
  if (TERMINAL_STATUSES.includes(state.status)) {
    resetToReady();
  }
  const previous = state;
  state = startTimeAttack(state, performance.now());
  render(previous);
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
