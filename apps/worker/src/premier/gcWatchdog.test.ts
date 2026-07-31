import { test } from "node:test";
import assert from "node:assert/strict";
import { createGcWatchdog } from "./gcWatchdog";

/** Faux timers : on n'attend pas vraiment downMs, on déclenche à la main. */
function fakeTimers() {
  let seq = 0;
  const pending = new Map<number, () => void>();
  return {
    setTimer: (fn: () => void, _ms: number): ReturnType<typeof setTimeout> => {
      const id = ++seq;
      pending.set(id, fn);
      return id as unknown as ReturnType<typeof setTimeout>;
    },
    clearTimer: (h: ReturnType<typeof setTimeout>) => {
      pending.delete(h as unknown as number);
    },
    /** Déclenche tous les timers armés (simule l'écoulement de downMs). */
    fireAll() {
      for (const [id, fn] of [...pending]) {
        pending.delete(id);
        fn();
      }
    },
    pendingCount: () => pending.size,
  };
}

test("GC reconnecté avant le délai → pas d'abandon", () => {
  const t = fakeTimers();
  let fired = 0;
  const wd = createGcWatchdog({ downMs: 1000, onTimeout: () => fired++, ...t });
  wd.markDown();
  wd.markUp(); // reconnexion à temps
  t.fireAll();
  assert.equal(fired, 0);
  assert.equal(t.pendingCount(), 0);
});

test("GC toujours down après le délai → onTimeout appelé une fois avec downMs", () => {
  const t = fakeTimers();
  const seen: number[] = [];
  const wd = createGcWatchdog({ downMs: 300_000, onTimeout: (ms) => seen.push(ms), ...t });
  wd.markDown();
  t.fireAll();
  assert.deepEqual(seen, [300_000]);
});

test("markDown répété n'arme qu'un seul compte à rebours", () => {
  const t = fakeTimers();
  let fired = 0;
  const wd = createGcWatchdog({ downMs: 1000, onTimeout: () => fired++, ...t });
  wd.markDown();
  wd.markDown();
  assert.equal(t.pendingCount(), 1);
  t.fireAll();
  assert.equal(fired, 1);
});

test("markUp sans down actif → no-op (pas de crash, rien à annuler)", () => {
  const t = fakeTimers();
  let fired = 0;
  const wd = createGcWatchdog({ downMs: 1000, onTimeout: () => fired++, ...t });
  wd.markUp();
  t.fireAll();
  assert.equal(fired, 0);
});

test("flap down→up→down : réarme et peut abandonner au 2e down", () => {
  const t = fakeTimers();
  let fired = 0;
  const wd = createGcWatchdog({ downMs: 1000, onTimeout: () => fired++, ...t });
  wd.markDown();
  wd.markUp();
  wd.markDown();
  assert.equal(t.pendingCount(), 1);
  t.fireAll();
  assert.equal(fired, 1);
});
