type Tick = (deltaMs: number) => void;

/**
 * One requestAnimationFrame loop for every instance on the page.
 *
 * Twenty animated assets must not mean twenty loops. The loop stops when the
 * last subscriber leaves and while the document is hidden, and it clamps long
 * frame gaps so a background tab does not teleport every asset on return.
 */
const ticks = new Set<Tick>();
let frame = 0;
let last = 0;

function loop(now: number): void {
  frame = 0;
  const delta = last ? Math.min(now - last, 64) : 16;
  last = now;
  for (const tick of ticks) tick(delta);
  if (ticks.size > 0 && typeof document !== "undefined" && !document.hidden) {
    frame = requestAnimationFrame(loop);
  }
}

function start(): void {
  if (frame || ticks.size === 0) return;
  if (typeof document !== "undefined" && document.hidden) return;
  last = 0;
  frame = requestAnimationFrame(loop);
}

function stop(): void {
  if (!frame) return;
  cancelAnimationFrame(frame);
  frame = 0;
}

export function addTick(tick: Tick): () => void {
  ticks.add(tick);
  start();
  return () => {
    ticks.delete(tick);
    if (ticks.size === 0) stop();
  };
}

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop();
    else start();
  });
}
