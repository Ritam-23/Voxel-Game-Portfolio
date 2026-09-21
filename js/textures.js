/* ============================================================================
   TEXTURES — a procedurally-drawn 16px pixel-art atlas (Minecraft style).
   Produces one THREE.Texture + a lookup from tile-name -> atlas cell.
   ========================================================================== */
window.Textures = (() => {
  const TILE = 16;          // px per tile
  const COLS = 8;           // atlas grid
  const ROWS = 8;
  const names = [];         // ordered tile names -> index

  // small deterministic noise
  function rnd(x, y, seed) {
    let h = (x * 374761393 + y * 668265263 + seed * 2246822519) ^ 0x9e3779b9;
    h = (h ^ (h >> 13)) * 1274126177;
    return ((h ^ (h >> 16)) >>> 0) / 4294967295;
  }

  // per-tile pixel painters -------------------------------------------------
  const painters = {
    grass_top(c, s) {
      base(c, "#5aa73a");
      speckle(c, s, ["#69bd45", "#4f9a34", "#77c94f"], 0.55);
    },
    grass_side(c, s) {
      base(c, "#7c5a3a");                       // dirt
      speckle(c, s, ["#6b4c30", "#8a6742"], 0.5);
      // grassy top lip
      for (let x = 0; x < TILE; x++) {
        const h = 3 + Math.floor(rnd(x, 0, s) * 3);
        for (let y = 0; y < h; y++) px(c, x, y, y === h - 1 ? "#4f9a34" : "#5aa73a");
      }
    },
    dirt(c, s) { base(c, "#7c5a3a"); speckle(c, s, ["#6b4c30", "#8a6742", "#6f4f33"], 0.55); },
    stone(c, s) { base(c, "#8b8b8f"); speckle(c, s, ["#7c7c80", "#9a9a9e", "#828287"], 0.5); },
    cobble(c, s) {
      base(c, "#8b8b8f");
      for (let i = 0; i < 10; i++) {
        const x = Math.floor(rnd(i, 1, s) * 12), y = Math.floor(rnd(i, 2, s) * 12);
        rect(c, x, y, 3 + Math.floor(rnd(i, 3, s) * 2), 3, rnd(i, 4, s) > .5 ? "#767679" : "#9c9ca0");
      }
    },
    sand(c, s) { base(c, "#e6d59a"); speckle(c, s, ["#dcc987", "#efe0ad"], 0.5); },
    path(c, s) { base(c, "#9a8b6a"); speckle(c, s, ["#8a7c5d", "#a99a77", "#7f7254"], 0.6); },
    oak_side(c, s) {
      base(c, "#6b4f2e");
      for (let x = 0; x < TILE; x++) for (let y = 0; y < TILE; y++)
        if (rnd(x, y, s) > .7) px(c, x, y, rnd(x, y, s + 1) > .5 ? "#5a4126" : "#7c5e38");
    },
    oak_top(c, s) {
      base(c, "#a9814c");
      for (let r = 6; r > 0; r--) ring(c, 8, 8, r, r % 2 ? "#8a6a3c" : "#9a7644");
    },
    leaves(c, s) {
      base(c, "#3f8f39");
      speckle(c, s, ["#357a30", "#4aa142", "#2f6e2b", "#54b04a"], 0.7);
    },
    planks(c, s) {
      base(c, "#b58a4e");
      for (let y = 0; y < TILE; y += 4) { line(c, 0, y, TILE, y, "#8a6636"); }
      for (let y = 0; y < TILE; y += 4) for (let x = 0; x < TILE; x++)
        if (rnd(x, y, s) > .85) px(c, x, y + 1 + Math.floor(rnd(x, y, s) * 2), "#a37c45");
      line(c, 7, 0, 7, TILE, "#8a6636");
    },
    quartz(c, s) { base(c, "#eae7df"); speckle(c, s, ["#dedbd2", "#f3f1ea"], 0.4); },
    iron(c, s) { base(c, "#d8d8dc"); speckle(c, s, ["#c8c8cd", "#e6e6ea"], 0.4); rect(c, 3, 3, 10, 10, "#cfcfd4"); },
    lamp(c, s) { base(c, "#e8a13a"); for (let i = 0; i < 6; i++) rect(c, 2 + (i % 3) * 5, 2 + Math.floor(i / 3) * 7, 4, 5, "#ffcf6b"); },
    glow(c, s) { base(c, "#f2d24a"); speckle(c, s, ["#e6c33c", "#ffe27a"], 0.6); },
    diamond(c, s) { base(c, "#59c9d6"); gem(c, "#8ff0f7", "#3aa7b4"); },
    emerald(c, s) { base(c, "#2ec77e"); gem(c, "#7ff0b4", "#1c9a5c"); },
    gold(c, s) { base(c, "#f2c33f"); gem(c, "#ffe488", "#cf9d1f"); },
    redstone(c, s) { base(c, "#7a1414"); for (let i = 0; i < 8; i++) rect(c, Math.floor(rnd(i,1,s)*12), Math.floor(rnd(i,2,s)*12), 3, 3, "#e23c3c"); },
    brick(c, s) {
      base(c, "#a24b3a");
      for (let y = 0; y < TILE; y += 4) {
        line(c, 0, y, TILE, y, "#7f3a2c");
        const off = (y / 4) % 2 ? 4 : 0;
        for (let x = off; x < TILE; x += 8) line(c, x, y, x, y + 4, "#7f3a2c");
      }
    },
    glass(c, s) { base(c, "#bfe6ef"); rect(c, 1, 1, 14, 14, "#d6f0f6"); line(c, 1, 1, 14, 14, "#eafaff"); },
    obsidian(c, s) { base(c, "#160f24"); speckle(c, s, ["#20163a", "#0f0a1a", "#2c2050"], 0.5); px(c, 4, 5, "#7a5fb0"); px(c, 11, 10, "#5f4494"); },
    netherrack(c, s) { base(c, "#5a1f22"); speckle(c, s, ["#4a1a1c", "#6e2a2d", "#3f1416", "#722f31"], 0.65); },
    netherbrick(c, s) {
      base(c, "#2c161a"); speckle(c, s, ["#241216", "#361b20"], 0.4);
      for (let y = 0; y < TILE; y += 4) {                       // dark mortar courses, offset brickwork
        line(c, 0, y, TILE, y, "#160b0d");
        const off = (y / 4) % 2 ? 4 : 0;
        for (let x = off; x < TILE; x += 8) line(c, x, y, x, y + 4, "#160b0d");
      }
    },
    endstone(c, s) { base(c, "#e7e7c2"); speckle(c, s, ["#d8d8ac", "#f1f1d4", "#cccca0"], 0.5); },
    eframe(c, s) { base(c, "#cfcf9e"); rect(c, 2, 2, 12, 12, "#c2c28f"); rect(c, 4, 4, 8, 8, "#264a2c"); rect(c, 6, 6, 4, 4, "#0f2a16"); },
    snow(c, s) { base(c, "#eef6ff"); speckle(c, s, ["#e0ecf8", "#ffffff", "#d6e6f4"], 0.4); },
    darkleaves(c, s) { base(c, "#2b5f28"); speckle(c, s, ["#245322", "#317035", "#1c4a1e", "#3a7d3a"], 0.72); },
    // biome blocks: frozen lakes, desert sandstone, cactus
    ice(c, s) { base(c, "#8ec7f2"); speckle(c, s, ["#a6d6f7", "#7bb8ea", "#c2e4fb"], 0.35); line(c, 2, 4, 9, 6, "#c6e6fb"); line(c, 11, 9, 6, 13, "#b0dcf8"); },
    sandstone(c, s) {
      base(c, "#e3cf96"); speckle(c, s, ["#d8c288", "#eedda8"], 0.35);
      for (let y = 3; y < TILE; y += 5) line(c, 0, y, TILE, y, "#c7ac74");   // sedimentary courses
    },
    cactus(c, s) {
      base(c, "#3f7a3a"); speckle(c, s, ["#367030", "#4a8c44"], 0.4);
      line(c, 2, 0, 2, TILE, "#2e5f2b"); line(c, 13, 0, 13, TILE, "#2e5f2b");   // vertical ridges
      for (let y = 2; y < TILE; y += 4) { px(c, 2, y, "#dfe8a0"); px(c, 13, y, "#dfe8a0"); }  // areoles/spines
    },
    // house furniture blocks
    bookshelf(c, s) {
      base(c, "#b58a4e");
      rect(c, 0, 0, TILE, 2, "#8a6636"); rect(c, 0, 7, TILE, 2, "#8a6636"); rect(c, 0, 14, TILE, 2, "#8a6636"); // 2 shelf boards
      const cols = ["#7a1f2b", "#2b5f8a", "#2e7d4f", "#8a6a1f", "#6b2f7a", "#a0432b", "#3a3f8a"];
      for (const y0 of [2, 9]) for (let x = 1; x < 15; x += 2) { c.fillStyle = cols[(x * 3 + y0 + ((rnd(x, y0, s) * 7) | 0)) % cols.length]; c.fillRect(x, y0, 1, 5); } // book spines
    },
    crafting(c, s) {
      base(c, "#a9814c");
      for (let y = 0; y <= TILE; y += 4) line(c, 0, y, TILE, y, "#7a5a30");
      for (let x = 0; x <= TILE; x += 4) line(c, x, 0, x, TILE, "#7a5a30");     // crafting grid
      rect(c, 5, 5, 6, 6, "#8a6636"); rect(c, 6, 6, 4, 4, "#6f4f2a");           // center recess
    },
    // wool accents
    wool_orange(c) { base(c, "#e08a2b"); }, wool_blue(c) { base(c, "#3f7fd6"); },
    wool_purple(c) { base(c, "#8a4fd6"); }, wool_red(c) { base(c, "#cf4646"); },
    wool_green(c) { base(c, "#4f9a3c"); }, wool_yellow(c) { base(c, "#e6c23c"); },
    wool_white(c) { base(c, "#e9e9ea"); }, wool_black(c) { base(c, "#25252a"); },
    water(c, s) { base(c, "#2f7fd6"); speckle(c, s, ["#3f8fe0", "#2a72c4"], 0.5); },
  };

  // painter helpers (operate on a 16x16 context) ---------------------------
  let ctx0;
  function base(c, col) { c.fillStyle = col; c.fillRect(0, 0, TILE, TILE); }
  function px(c, x, y, col) { c.fillStyle = col; c.fillRect(x, y, 1, 1); }
  function rect(c, x, y, w, h, col) { c.fillStyle = col; c.fillRect(x, y, w, h); }
  function line(c, x0, y0, x1, y1, col) {
    c.strokeStyle = col; c.lineWidth = 1;
    c.beginPath(); c.moveTo(x0 + .5, y0 + .5); c.lineTo(x1 + .5, y1 + .5); c.stroke();
  }
  function ring(c, cx, cy, r, col) { c.strokeStyle = col; c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.stroke(); }
  function gem(c, light, dark) {
    c.fillStyle = light; c.fillRect(4, 3, 8, 3);
    c.fillStyle = dark; c.fillRect(3, 10, 10, 3);
    c.fillStyle = light; c.fillRect(6, 6, 2, 2);
  }
  function speckle(c, s, cols, amt) {
    for (let x = 0; x < TILE; x++) for (let y = 0; y < TILE; y++)
      if (rnd(x, y, s) < amt) px(c, x, y, cols[Math.floor(rnd(x, y, s + 7) * cols.length)]);
  }

  // build the atlas ---------------------------------------------------------
  function build() {
    const cv = document.createElement("canvas");
    cv.width = COLS * TILE; cv.height = ROWS * TILE;
    const ctx = cv.getContext("2d");
    ctx.imageSmoothingEnabled = false;

    let i = 0;
    for (const name in painters) {
      const col = i % COLS, row = Math.floor(i / COLS);
      const tc = document.createElement("canvas");
      tc.width = TILE; tc.height = TILE;
      const c = tc.getContext("2d");
      painters[name](c, i + 1);
      ctx.drawImage(tc, col * TILE, row * TILE);
      names.push(name);
      i++;
    }

    const tex = new THREE.CanvasTexture(cv);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    if (THREE.sRGBEncoding) tex.encoding = THREE.sRGBEncoding;
    return tex;
  }

  // UV rect for a tile, with a half-texel inset to avoid bleeding
  function uv(name) {
    const idx = names.indexOf(name);
    const col = idx % COLS, row = Math.floor(idx / COLS);
    const inset = 0.2 / (COLS * TILE);
    const u0 = col / COLS + inset, u1 = (col + 1) / COLS - inset;
    // atlas drawn top-down; flip V so row 0 is at the top
    const v1 = 1 - row / ROWS - inset, v0 = 1 - (row + 1) / ROWS + inset;
    return { u0, v0, u1, v1 };
  }

  return { build, uv, TILE };
})();
