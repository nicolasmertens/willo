/** Safari-safe long-press. Fire on the timer while held. Do not wait for touchend. */
(function (root) {
  const HOLD_MS = 2000;
  const DRIFT_PX = 28;
  const MIN_TAP_MS = 65;

  function drifted(x0, y0, x1, y1, max) {
    return Math.hypot(x1 - x0, y1 - y0) > (max == null ? DRIFT_PX : max);
  }

  /**
   * Event list: {type: start|move|tick|end|cancel, t, x?, y?}
   * Hold wins if the timer elapses while still holding, even if Safari
   * later sends touchcancel / never sends touchend.
   *
   * cancel is not a lift (iOS callout/scroll/pan). Keep holding so a later
   * tick can still fire. Real lift is type:end. Drift still aborts.
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
        // iOS cancel ≠ user lift. Do not abort. A later tick may still hold.
        if (holdFired || state === "hold") return "hold";
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
    let pointerId = null;

    function wipe() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      start = null;
      pointerId = null;
    }

    function arm(x, y) {
      fired = false;
      start = { x: x, y: y, t0: Date.now() };
      timer = setTimeout(() => {
        timer = null;
        fired = true;
        if (onHold) onHold();
      }, holdMs);
    }

    function down(x, y, e) {
      if (shouldStart && !shouldStart(e)) return false;
      if (start && !fired) return false;
      if (e && e.preventDefault) e.preventDefault();
      arm(x, y);
      return true;
    }

    function move(x, y) {
      if (!start || fired) return;
      if (drifted(start.x, start.y, x, y, driftPx)) wipe();
    }

    function up(e) {
      if (fired) {
        if (e && e.preventDefault) e.preventDefault();
        wipe();
        return;
      }
      const had = !!(start && timer);
      const dur = start ? Date.now() - start.t0 : 0;
      wipe();
      if (had && dur >= MIN_TAP_MS && onTap) onTap(e);
    }

    // iOS Safari often sends pointercancel/touchcancel before 2s (callout,
    // scroll, pan). That is not a lift. Keep the timer. Real lift is
    // pointerup / touchend / mouseup. Do not wipe() here.
    function ignoreCancel() {}

    const usePointer = typeof PointerEvent !== "undefined";

    if (usePointer) {
      el.addEventListener("pointerdown", (e) => {
        if (e.isPrimary === false) return;
        if (!down(e.clientX, e.clientY, e)) return;
        pointerId = e.pointerId;
        try { if (el.setPointerCapture) el.setPointerCapture(e.pointerId); } catch (err) {}
      }, { passive: false });

      el.addEventListener("pointermove", (e) => {
        if (pointerId != null && e.pointerId !== pointerId) return;
        move(e.clientX, e.clientY);
      }, { passive: true });

      el.addEventListener("pointerup", (e) => {
        if (pointerId != null && e.pointerId !== pointerId) return;
        up(e);
      }, { passive: false });

      el.addEventListener("pointercancel", ignoreCancel, { passive: true });
    } else {
      el.addEventListener("touchstart", (e) => {
        if (e.touches && e.touches.length !== 1) {
          wipe();
          return;
        }
        const t = e.changedTouches[0];
        down(t.clientX, t.clientY, e);
      }, { passive: false });

      el.addEventListener("touchmove", (e) => {
        if (!start || fired) return;
        const t = e.changedTouches[0];
        move(t.clientX, t.clientY);
      }, { passive: true });

      el.addEventListener("touchend", (e) => {
        up(e);
      }, { passive: false });

      el.addEventListener("touchcancel", ignoreCancel, { passive: true });

      el.addEventListener("mousedown", (e) => {
        if (e.button !== 0) return;
        down(e.clientX, e.clientY, e);
      }, { passive: false });

      const mouseRoot = typeof window !== "undefined" ? window : el;
      mouseRoot.addEventListener("mousemove", (e) => {
        move(e.clientX, e.clientY);
      }, { passive: true });
      mouseRoot.addEventListener("mouseup", (e) => {
        if (e.button !== 0 && e.button !== undefined) return;
        if (!start && !fired) return;
        up(e);
      }, { passive: false });
    }
  }

  const api = { HOLD_MS, DRIFT_PX, MIN_TAP_MS, drifted, decide, attach };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.WilloHold = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
