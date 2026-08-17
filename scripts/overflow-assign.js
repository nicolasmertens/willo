/** Assign 1 (max 2 adjacent) overflow sides. Never both sides of one gap. */
(function (root) {
  const SIDES = ["left", "right", "top", "bottom"];
  const ADJ = {
    left: ["top", "bottom"],
    right: ["top", "bottom"],
    top: ["left", "right"],
    bottom: ["left", "right"],
  };

  function mulberry32(a) {
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffle(arr, rng) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = a[i];
      a[i] = a[j];
      a[j] = tmp;
    }
    return a;
  }

  function assignOverflow(prefsList, cols, seed) {
    const n = prefsList.length;
    const colsN = Math.max(1, cols | 0);
    const used = Array.from({ length: n }, () => new Set());
    const out = Array.from({ length: n }, () => []);
    const base = seed == null ? 20260817 : seed;

    function forbids(i, side) {
      const col = i % colsN;
      const row = Math.floor(i / colsN);
      if (side === "left" && col > 0 && used[i - 1].has("right")) return true;
      if (side === "top" && row > 0 && used[i - colsN].has("bottom")) return true;
      return false;
    }

    for (let i = 0; i < n; i++) {
      if (prefsList[i] === null) continue;
      const rng = mulberry32((base + i * 101) | 0);
      const prefs = (prefsList[i] || []).filter((s) => SIDES.indexOf(s) !== -1);
      const source = prefs.length ? prefs : SIDES;
      const pool = source.filter((s) => !forbids(i, s));
      if (!pool.length) continue;
      const first = shuffle(pool, rng)[0];
      used[i].add(first);
      out[i].push(first);
      if (rng() < 0.4) {
        const seconds = ADJ[first].filter((s) => !forbids(i, s) && (prefs.length ? prefs.indexOf(s) !== -1 : true));
        if (seconds.length) {
          const s2 = shuffle(seconds, rng)[0];
          used[i].add(s2);
          out[i].push(s2);
        }
      }
    }
    return out;
  }

  root.assignOverflow = assignOverflow;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = { assignOverflow };
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
