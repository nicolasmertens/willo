/** Safari-safe long-press. Fire on the timer while held. Do not wait for touchend. */
(function (root) {
  const HOLD_MS = 1800;
  const DRIFT_PX = 28;
  const MIN_TAP_MS = 65;

  function drifted(x0, y0, x1, y1, max) {
    return Math.hypot(x1 - x0, y1 - y0) > (max == null ? DRIFT_PX : max);
  }

  /**
   * Event list: {type: start|move|tick|end|cancel, t, x?, y?}
   * Hold wins if the timer elapses while still holding, even if Safari
   * later sends touchcancel / never sends touchend.
   */
  function decide(events, holdMs, driftPx) {
    holdMs = holdMs == null ? HOLD_MS : holdMs;
    driftPx = driftPx == null ? DRIFT_PX : driftPx;
    let x0 = 0;
    let y0 = 0;
    let t0 = 0;
    let state = "idle";
    let holdFired = false;
    for (const ev of events) {
      if (ev.type === "start") {
        x0 = ev.x;
        y0 = ev.y;
        t0 = ev.t;
        state = "holding";
        holdFired = false;
      } else if (ev.type === "move") {
        if (state !== "holding") continue;
        if (drifted(x0, y0, ev.x, ev.y, driftPx)) state = "cancel";
        else if (ev.t - t0 >= holdMs) {
          holdFired = true;
          state = "hold";
        }
      } else if (ev.type === "tick") {
        if (state === "holding" && ev.t - t0 >= holdMs) {
          holdFired = true;
          state = "hold";
        }
      } else if (ev.type === "end") {
        if (holdFired || state === "hold") return "hold";
        if (state === "cancel") return "cancel";
        if (ev.t - t0 >= MIN_TAP_MS) return "tap";
        return "cancel";
      } else if (ev.type === "cancel") {
        if (holdFired || state === "hold") return "hold";
        return "cancel";
      }
    }
    if (holdFired || state === "hold") return "hold";
    return state === "holding" ? "holding" : state;
  }

  function attach(el, opts) {
    const holdMs = (opts && opts.holdMs) || HOLD_MS;
    const driftPx = (opts && opts.driftPx) || DRIFT_PX;
    const onHold = opts && opts.onHold;
    const onTap = opts && opts.onTap;
    const shouldStart = opts && opts.shouldStart;
    let timer = null;
    let start = null;
    let fired = false;

    function wipe() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      start = null;
    }

    el.addEventListener("touchstart", (e) => {
      if (shouldStart && !shouldStart(e)) return;
      if (e.touches.length !== 1) {
        wipe();
        return;
      }
      const t = e.changedTouches[0];
      e.preventDefault();
      fired = false;
      start = { x: t.clientX, y: t.clientY, t0: Date.now() };
      timer = setTimeout(() => {
        timer = null;
        fired = true;
        if (onHold) onHold();
      }, holdMs);
    }, { passive: false });

    el.addEventListener("touchmove", (e) => {
      if (!start || fired) return;
      const t = e.changedTouches[0];
      if (drifted(start.x, start.y, t.clientX, t.clientY, driftPx)) wipe();
    }, { passive: true });

    el.addEventListener("touchend", (e) => {
      if (fired) {
        e.preventDefault();
        wipe();
        return;
      }
      const had = !!(start && timer);
      const dur = start ? Date.now() - start.t0 : 0;
      wipe();
      if (had && dur >= MIN_TAP_MS && onTap) onTap(e);
    }, { passive: false });

    el.addEventListener("touchcancel", () => {
      if (!fired) wipe();
    }, { passive: true });
  }

  const api = { HOLD_MS, DRIFT_PX, MIN_TAP_MS, drifted, decide, attach };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.WilloHold = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
