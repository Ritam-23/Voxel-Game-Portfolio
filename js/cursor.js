/* ============================================================================
   CURSOR — a blocky, pixel-art mouse pointer applied across the whole site,
   to match the voxel theme. Drawn pixel-by-pixel on a canvas (so it's truly
   pixelated at any DPI) and injected as a CSS cursor with !important so it
   overrides the default arrow everywhere. Text fields keep the I-beam.
   ========================================================================== */
(() => {
  // classic arrow bitmap — b = black outline, w = white fill, . = transparent
  const ART = [
    "b...........",
    "bb..........",
    "bwb.........",
    "bwwb........",
    "bwwwb.......",
    "bwwwwb......",
    "bwwwwwb.....",
    "bwwwwwwb....",
    "bwwwwwwwb...",
    "bwwwwwwwwb..",
    "bwwwwwwwwwb.",
    "bwwwwwwbbbbb",
    "bwwbwwb.....",
    "bwb.bwwb....",
    "bb..bwwb....",
    "b....bwwb...",
    ".....bwwb...",
    "......bwwb..",
    "......bb....",
  ];
  const S = 2;                                          // pixel size (chunky)
  const W = ART[0].length * S, H = ART.length * S;

  function dataURI() {
    const cv = document.createElement("canvas");
    cv.width = W; cv.height = H;
    const c = cv.getContext("2d");
    c.imageSmoothingEnabled = false;
    for (let y = 0; y < ART.length; y++) {
      const row = ART[y];
      for (let x = 0; x < row.length; x++) {
        const ch = row[x];
        if (ch === ".") continue;
        c.fillStyle = ch === "b" ? "#1a1a24" : "#ffffff";
        c.fillRect(x * S, y * S, S, S);
      }
    }
    try { return cv.toDataURL("image/png"); } catch (_) { return null; }
  }

  function apply() {
    const uri = dataURI();
    if (!uri) return;
    const st = document.createElement("style");
    // hotspot at the arrow tip (0,0); fall back to auto if the image is rejected
    st.textContent =
      `*, *::before, *::after { cursor: url("${uri}") 0 0, auto !important; }\n` +
      `input, textarea, [contenteditable="true"] { cursor: text !important; }`;
    document.head.appendChild(st);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", apply); else apply();
})();
