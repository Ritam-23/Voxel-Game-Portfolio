/* ============================================================================
   VOXEL — a never-ending world: a fixed CORE (plaza, paths, 7 builds, portals)
   plus infinite CHUNKS streamed around the player. Beyond the flat core the
   terrain rises into hills/mountains and dips into shallow lakes (value noise).
   Collision is per-block via solidAt(); surfaceY() gives the walkable top of a
   column. damage()/updateCraters() carve + heal creeper craters.
   ========================================================================== */
window.Voxel = (() => {
  const CS = 24;                    // chunk size (blocks)
  const CORE_R = 70;                // designed area radius (kept flat)
  const ZONE_R = 42;                // how far the 7 points sit from spawn

  const B = {
    GRASS: { top: "grass_top", bottom: "dirt", side: "grass_side" }, DIRT: { all: "dirt" },
    STONE: { all: "stone" }, COBBLE: { all: "cobble" }, PATH: { all: "path" },
    SAND: { all: "sand" }, SNOW: { all: "snow" }, WATER: { all: "water", liquid: true },
    ICE: { all: "ice" }, SANDSTONE: { all: "sandstone" }, CACTUS: { all: "cactus" },
    BOOKSHELF: { all: "bookshelf" }, CRAFTING: { all: "crafting" },
    LOG: { top: "oak_top", bottom: "oak_top", side: "oak_side" }, LEAVES: { all: "leaves", canopy: true }, DLEAVES: { all: "darkleaves", canopy: true },
    PLANKS: { all: "planks" }, QUARTZ: { all: "quartz" }, IRON: { all: "iron" }, LAMP: { all: "lamp" }, GLOW: { all: "glow" },
    DIAMOND: { all: "diamond" }, EMERALD: { all: "emerald" }, GOLD: { all: "gold" }, REDSTONE: { all: "redstone" },
    BRICK: { all: "brick" }, GLASS: { all: "glass" }, OBSIDIAN: { all: "obsidian" },
    NETHERRACK: { all: "netherrack" }, NETHERBRICK: { all: "netherbrick" },
    ENDSTONE: { all: "endstone" }, EFRAME: { all: "eframe" },
    W_RED: { all: "wool_red" }, W_YELLOW: { all: "wool_yellow" }, W_PURPLE: { all: "wool_purple" },
    W_WHITE: { all: "wool_white" }, W_BLUE: { all: "wool_blue" },
  };

  const map = new Map();
  const key = (x, y, z) => x + "," + y + "," + z;
  const set = (x, y, z, b) => { if (b) map.set(key(x, y, z), b); else map.delete(key(x, y, z)); };
  const setK = (x, y, z, b, keys) => { set(x, y, z, b); if (keys) keys.add(key(x, y, z)); };
  const get = (x, y, z) => map.get(key(x, y, z));
  const solid = (x, y, z) => { const b = map.get(key(x, y, z)); return !!b && !b.liquid; };
  const liquidAt = (x, y, z) => { const b = map.get(key(x, y, z)); return !!b && !!b.liquid; };

  // feet-rest Y for a column = highest solid block + 1 (skips water & leaf canopy). Flat ground => 1.
  const SURF_MAX = 32;              // probe ceiling — above tallest terrain(≈14) + tree trunk(≈6)
  function surfaceY(x, z) {
    const xi = Math.floor(x), zi = Math.floor(z);
    for (let y = SURF_MAX; y >= 1; y--) { const b = map.get(key(xi, y, zi)); if (b && !b.liquid && !b.canopy) return y + 1; }
    return 1;
  }

  // top surface Y of the water in a column (for swimming fish), or -1 if it's dry
  function waterTopAt(x, z) {
    const xi = Math.floor(x), zi = Math.floor(z);
    for (let y = SURF_MAX; y >= 0; y--) { const b = map.get(key(xi, y, zi)); if (b && b.liquid) return y + 1; }
    return -1;
  }
  // find a nearby water column (coarse ring sample) — returns {x,z,y} surface, or null
  function findWaterNear(cx, cz, r) {
    cx = Math.floor(cx); cz = Math.floor(cz);
    for (let ring = 2; ring <= r; ring += 2) for (let a = 0; a < 8; a++) {
      const x = cx + Math.round(Math.cos(a / 8 * 6.2832) * ring), z = cz + Math.round(Math.sin(a / 8 * 6.2832) * ring);
      const wy = waterTopAt(x, z); if (wy > 0) return { x, z, y: wy };
    }
    return null;
  }

  const loaded = new Map();         // "cx,cz" -> chunk rec (registered in genChunk, cleared in unloadChunk)
  let coreRec = null;               // { mesh, keys:Set, core:true } — the fixed core, never unloads
  const craters = [];               // active craters awaiting heal
  let onRegenCb = null;             // optional shimmer hook into game.js

  const zones = [], portals = [], mobSpawns = [], zoneCenters = [], decoCrops = [], villageSites = [];
  const nearZone = (x, z, d) => zoneCenters.some(c => Math.hypot(x - c.x, z - c.z) < d);
  const nearVillage = (x, z) => villageSites.some(v => Math.hypot(x - v.x, z - v.z) < v.r);
  function hash(x, z, s = 0) { let h = (x * 374761393 + z * 668265263 + s * 2246822519) ^ 0x9e3779b9; h = (h ^ (h >> 13)) * 1274126177; return ((h ^ (h >> 16)) >>> 0) / 4294967295; }

  /* --------------------------- terrain noise -------------------------- */
  function vnoise(x, z, freq, seed) {   // smooth bilerp value noise over the integer hash lattice
    const fx = x * freq, fz = z * freq, x0 = Math.floor(fx), z0 = Math.floor(fz), tx = fx - x0, tz = fz - z0;
    const sx = tx * tx * (3 - 2 * tx), sz = tz * tz * (3 - 2 * tz);
    const a = hash(x0, z0, seed) + (hash(x0 + 1, z0, seed) - hash(x0, z0, seed)) * sx;
    const b = hash(x0, z0 + 1, seed) + (hash(x0 + 1, z0 + 1, seed) - hash(x0, z0 + 1, seed)) * sx;
    return a + (b - a) * sz;
  }
  const TERR_BLEND = 20, TERR_MAX = 14, MOUNT_MAX = 14;
  // occasional mountains: a low-freq high band, ramped in past the terrain blend (no ring cliff) and
  // smoothstepped so slopes stay gentle (~≤1 block/step) and remain climbable with the 1-block step-up.
  function mountainAt(x, z) {
    const d = Math.sqrt(x * x + z * z);
    const rb = (d - CORE_R - TERR_BLEND) / 30; if (rb <= 0) return 0;   // keep the plaza & near-ring flat
    const m = vnoise(x, z, 1 / 190, 33); if (m < 0.33) return 0;        // only the high band rises to peaks
    let t = (m - 0.33) / 0.17; t = t * t * (3 - 2 * t);                 // gentle, climbable ramp
    return Math.round(t * MOUNT_MAX * Math.min(1, rb));
  }
  function heightAt(x, z) {
    const d = Math.sqrt(x * x + z * z);
    if (d <= CORE_R + 1) return 0;                                   // core is flat & owned elsewhere
    const t = Math.min(1, (d - CORE_R) / TERR_BLEND), blend = t * t * (3 - 2 * t); // smoothstep ring
    let e = vnoise(x, z, 1 / 48, 1) * 0.6 + vnoise(x, z, 1 / 22, 2) * 0.3 + vnoise(x, z, 1 / 11, 3) * 0.1;
    e = Math.pow(e, 1.35);                                           // valleys flatter, peaks sharper
    return Math.round(e * TERR_MAX * blend) + mountainAt(x, z);
  }
  // Water physics: the water surface must sit AT or BELOW the surrounding land everywhere
  // (still water can't stand higher than its shore or it would spill). Instead of one global
  // plane, the water level VARIES by region on a very slow noise field — so where the land is
  // generally low the water sits low, and where the land is higher the water can sit higher.
  // Within any single pond the field is essentially flat (a pond has one level). Then a
  // column is underwater only where its terrain bed dips below that local level inside a lake
  // basin, and any dry shore below the level is raised to it so water never overtops the bank.
  const SEA_BASE = 1, SEA_VAR = 2;                                 // low, shallow waterline (1..3) — shores stay low & flush
  const seaLevelAt = (x, z) => SEA_BASE + Math.round(vnoise(x, z, 1 / 95, 12) * SEA_VAR);
  function basinAt(x, z) {                                          // low-freq mask: regions where lakes may form
    if (Math.sqrt(x * x + z * z) <= CORE_R + 8) return false;       // never near the core plaza
    return vnoise(x, z, 1 / 40, 7) < 0.30;
  }
  const waterAt = (x, z, h) => basinAt(x, z) && h < seaLevelAt(x, z);   // this column's bed sits below its local waterline
  const isWaterCol = (x, z) => waterAt(x, z, heightAt(x, z));
  // highest waterline among the 4 neighbours touching (x,z), or -1 if none. Used so any dry land
  // below an adjacent lake's surface is raised to it — the water can never overtop its bank.
  function adjWaterLevel(x, z) {
    let m = -1;
    if (isWaterCol(x + 1, z)) m = Math.max(m, seaLevelAt(x + 1, z));
    if (isWaterCol(x - 1, z)) m = Math.max(m, seaLevelAt(x - 1, z));
    if (isWaterCol(x, z + 1)) m = Math.max(m, seaLevelAt(x, z + 1));
    if (isWaterCol(x, z - 1)) m = Math.max(m, seaLevelAt(x, z - 1));
    return m;
  }

  /* ------------------------------ biomes ------------------------------ */
  // Large, widely-spaced biome regions on a very-low-freq field. Desert sits in the low band
  // and ice in the high band, separated by the whole mid-range — so they are always far apart
  // with a broad "normal" buffer between them (smooth transitions, never adjacent). A little
  // hash dither stipples the borders so the surface change is gradual, not a razor line.
  function biomeAt(x, z) {
    if (Math.sqrt(x * x + z * z) <= CORE_R + 30) return "normal";   // keep the spawn area classic green
    const v = vnoise(x, z, 1 / 220, 21) + (hash(x, z, 31) * 0.1 - 0.025);   // field ∈ [0,0.5); ±0.025 border dither
    if (v < 0.10) return "desert";                                  // low tail (~8%)
    if (v > 0.39) return "ice";                                     // high tail (~8%), far from desert
    return "normal";                                               // wide buffer between them
  }
  const logNear2 = (x, z, by) => solid(x - 1, by + 1, z) || solid(x + 1, by + 1, z) || solid(x, by + 1, z - 1) || solid(x, by + 1, z + 1) || solid(x, by + 1, z);

  /* ------------------------------- CORE ------------------------------- */
  function buildCore() {
    map.clear(); loaded.clear(); coreRec = null; craters.length = 0;
    [zones, portals, mobSpawns, zoneCenters, decoCrops, villageSites].forEach(a => a.length = 0);
    for (let x = -CORE_R; x <= CORE_R; x++) for (let z = -CORE_R; z <= CORE_R; z++)
      if (x * x + z * z <= CORE_R * CORE_R) set(x, 0, z, B.GRASS);

    for (let x = -5; x <= 5; x++) for (let z = -5; z <= 5; z++) if (x * x + z * z <= 28) set(x, 0, z, (x + z) % 2 ? B.STONE : B.COBBLE);
    buildFountain(0, 0);

    const specs = [
      { id: "about", accent: "#f0a441", build: buildHouse },
      { id: "experience", accent: "#4aa3ff", build: buildNetherPortal },
      { id: "projects", accent: "#b06bff", build: buildEndPortal },
      { id: "technologies", accent: "#ff5d5d", build: buildServer },
      { id: "interests", accent: "#2ec77e", build: buildGarden },
      { id: "contact", accent: "#ff7a2f", build: buildBeacon },
      { id: "resume", accent: "#17b3a3", build: buildResume },
    ];
    specs.forEach((s, i) => { const a = (i / specs.length) * Math.PI * 2; zoneCenters.push({ x: Math.round(Math.sin(a) * ZONE_R), z: Math.round(Math.cos(a) * ZONE_R) }); });
    specs.forEach((s, i) => { const { x: cx, z: cz } = zoneCenters[i]; carvePath(0, 0, cx, cz); const topY = s.build(cx, cz); zones.push({ id: s.id, x: cx, z: cz, color: s.accent, anchorY: topY + 1.6 }); });

    // a neighbouring VILLAGE (6 furnished cottages + well + lamps), a short walk from the house at (0,42)
    const VILL = { x: 20, z: 50, r: 10 };
    const villageHouses = buildVillage(VILL.x, VILL.z);
    carvePath(0, 0, VILL.x, VILL.z);                                 // a lane out to it from the plaza

    // sparse core trees (kept light) — kept clear of zones AND the village
    for (let x = -CORE_R; x <= CORE_R; x += 1) for (let z = -CORE_R; z <= CORE_R; z += 1) {
      if (x * x + z * z > CORE_R * CORE_R || get(x, 0, z) !== B.GRASS || nearZone(x, z, 9) || nearVillage(x, z)) continue;
      if (Math.abs(x) < 10 && Math.abs(z) < 10) continue;
      if (hash(x, z, 5) < 0.02 && x % 2 === 0 && z % 2 === 0 && !logNear(x, z)) plantTree(x, z, hash(x, z, 6) < 0.34, null);
    }
    for (let i = 0; i < 26; i++) mobSpawns.push(randomField());

    // a few flowers scattered on the core grass (built as sprites by game.js)
    const coreFlowers = [];
    for (let x = -CORE_R; x <= CORE_R; x++) for (let z = -CORE_R; z <= CORE_R; z++) {
      if (x * x + z * z > 58 * 58 || get(x, 0, z) !== B.GRASS || nearZone(x, z, 4) || solid(x, 1, z)) continue;
      if (hash(x, z, 17) < 0.004) coreFlowers.push({ x, z, c: (hash(x, z, 9) * 10) | 0 });  // hash ∈ [0,0.5)
    }

    const coreKeys = new Set(map.keys());          // includes plaza, builds, paths, core trees, village
    coreRec = { mesh: buildGeometry(coreKeys), keys: coreKeys, core: true };
    return { coreMesh: coreRec.mesh, zones, portals, mobSpawns, coreFlowers, coreCrops: decoCrops, village: VILL, villageHouses };
  }

  const logNear = (x, z) => solid(x - 1, 1, z) || solid(x + 1, 1, z) || solid(x, 1, z - 1) || solid(x, 1, z + 1) || solid(x, 1, z);

  function randomField() {
    for (let i = 0; i < 60; i++) { const x = (Math.random() * 100 - 50) | 0, z = (Math.random() * 100 - 50) | 0; if (get(x, 0, z) === B.GRASS && !solid(x, 1, z) && !nearZone(x, z, 7) && x * x + z * z > 100) return { x, z }; }
    return { x: 12, z: 12 };
  }

  function carvePath(x0, z0, x1, z1) {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(z1 - z0)) * 2;
    for (let i = 0; i <= steps; i++) { const t = i / steps, x = Math.round(x0 + (x1 - x0) * t), z = Math.round(z0 + (z1 - z0) * t); for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) if (get(x + dx, 0, z + dz) === B.GRASS) set(x + dx, 0, z + dz, B.PATH); }
  }

  /* ------------------------------- builds ----------------------------- */
  function walls(cx, cz, r, h, block, floor) {
    for (let y = 1; y <= h; y++) for (let x = cx - r; x <= cx + r; x++) for (let z = cz - r; z <= cz + r; z++) if (x === cx - r || x === cx + r || z === cz - r || z === cz + r) set(x, y, z, block);
    if (floor) for (let x = cx - r; x <= cx + r; x++) for (let z = cz - r; z <= cz + r; z++) set(x, 0, z, floor);
  }
  function buildFountain(cx, cz) { for (let x = cx - 1; x <= cx + 1; x++) for (let z = cz - 1; z <= cz + 1; z++) set(x, 1, z, B.QUARTZ); set(cx, 2, cz, B.QUARTZ); set(cx, 3, cz, B.GLASS); return 3; }
  function buildHouse(cx, cz) {
    const r = 7, H = 6;                                             // 15x15 footprint, 6-tall walls — a proper big house
    walls(cx, cz, r, H, B.PLANKS, B.PLANKS);                        // plank walls + plank floor
    for (let y = 1; y <= H; y++) [[-r, -r], [r, -r], [-r, r], [r, r]].forEach(([dx, dz]) => set(cx + dx, y, cz + dz, B.LOG)); // corner posts
    // doorway on the -Z wall (faces the spawn, so it greets you on arrival) — 2 wide, 3 tall
    for (let dx = 0; dx <= 1; dx++) for (let y = 1; y <= 3; y++) set(cx - 1 + dx, y, cz - r, null);
    // big glass windows, 2 wide, centered on each wall (y=3..4)
    for (const [ax, az, nx, nz] of [[cx, cz - r, 1, 0], [cx, cz + r, 1, 0], [cx - r, cz, 0, 1], [cx + r, cz, 0, 1]])
      for (let d = -2; d <= 2; d++) for (let y = 3; y <= 4; y++) { const x = ax + nx * d, z = az + nz * d; if (get(x, y, z) === B.PLANKS) set(x, y, z, B.GLASS); }

    // ================= organised interior (center stays open to walk) =================
    // -- sleeping corner (back-left, +Z / -X): bed + a bedside chest --
    set(cx - 5, 1, cz + r - 1, B.W_WHITE); set(cx - 4, 1, cz + r - 1, B.W_WHITE);   // pillows
    for (let dz = 2; dz <= 4; dz++) { set(cx - 5, 1, cz + r - dz, B.W_RED); set(cx - 4, 1, cz + r - dz, B.W_RED); } // mattress
    set(cx - 6, 1, cz + r - 1, B.CRAFTING);                                          // bedside table
    // -- library / enchanting corner (back-right, +Z / +X): enchant table (mesh) ringed by bookshelves --
    for (let z = cz + 2; z <= cz + r - 1; z++) { set(cx + r - 1, 1, z, B.BOOKSHELF); set(cx + r - 1, 2, z, B.BOOKSHELF); } // bookshelf wall along +X
    for (let x = cx + 2; x <= cx + r - 2; x++) { set(x, 1, cz + r - 1, B.BOOKSHELF); set(x, 2, cz + r - 1, B.BOOKSHELF); } // bookshelf wall along +Z
    // -- smithing corner (front-right, -Z / +X): anvil (mesh) + a crafting table --
    set(cx + r - 1, 1, cz - r + 2, B.CRAFTING);                                      // workbench beside the anvil
    // -- lighting: four ceiling lamps for an evenly-lit, tidy room --
    [[-4, -4], [4, -4], [-4, 4], [4, 4]].forEach(([dx, dz]) => set(cx + dx, H, cz + dz, B.GLOW));

    let peak = H;
    for (let layer = 0; layer <= r; layer++) {                      // stepped brick roof (pyramid)
      const rr = r - layer, y = H + 1 + layer;
      for (let x = cx - rr; x <= cx + rr; x++) for (let z = cz - rr; z <= cz + rr; z++) set(x, y, z, B.BRICK);
      peak = y; if (rr === 0) break;
    }
    for (let y = H + 1; y <= H + 4; y++) set(cx + r - 1, y, cz - r + 1, B.COBBLE);   // chimney
    return peak;
  }
  function buildServer(cx, cz) {
    for (let x = cx - 1; x <= cx + 1; x++) for (let z = cz - 1; z <= cz + 1; z++) set(x, 0, z, B.STONE);
    for (let dx = -1; dx <= 1; dx += 2) for (let y = 1; y <= 3; y++) set(cx + dx, y, cz, B.IRON);
    set(cx, 1, cz, B.REDSTONE); set(cx, 2, cz, B.LAMP); set(cx, 3, cz, B.REDSTONE); set(cx - 1, 4, cz, B.LAMP); set(cx + 1, 4, cz, B.LAMP); set(cx, 4, cz, B.W_RED); return 4;
  }
  function buildGarden(cx, cz) {
    // ---- animal farm: a barn + a fenced pen with hay & a water trough ----
    const bx = cx - 2, bz = cz - 2;                                 // barn sits in one corner
    walls(bx, bz, 1, 3, B.PLANKS, B.PLANKS);                        // small 3x3 barn
    set(bx, 1, bz + 1, null); set(bx, 2, bz + 1, null);             // barn door
    for (let x = bx - 1; x <= bx + 1; x++) for (let z = bz - 1; z <= bz + 1; z++) set(x, 4, z, B.BRICK); // barn roof
    set(bx, 5, bz, B.BRICK);
    // low pen fence (1 tall) so wandering animals can hop in/out through it; gate on the front edge
    const pr = 3;
    for (let x = cx - pr; x <= cx + pr; x++) { set(x, 1, cz - pr, B.LOG); if (x !== cx) set(x, 1, cz + pr, B.LOG); }
    for (let z = cz - pr; z <= cz + pr; z++) { set(cx - pr, 1, z, B.LOG); set(cx + pr, 1, z, B.LOG); }
    // hay bales + a flush water trough inside the pen
    set(cx + 1, 1, cz + 1, B.W_YELLOW); set(cx + 2, 1, cz + 1, B.W_YELLOW); set(cx + 1, 2, cz + 1, B.W_YELLOW);
    set(cx - 1, 0, cz + 1, B.WATER);                                // trough, sunk flush with the ground
    set(cx, 2, cz, B.LAMP);                                         // a light so the farm reads at night
    return 5;
  }
  function buildBeacon(cx, cz) { return 2.4; }   // contact: no structure — only the greeter person stands here (gem floats low above them)
  function buildResume(cx, cz) {
    const r = 3;                                                    // 7x7 farm plot
    for (let x = cx - r; x <= cx + r; x++) for (let z = cz - r; z <= cz + r; z++) set(x, 0, z, B.DIRT);  // tilled soil
    // water irrigation channels down two furrows (flush with the ground, so crops look hydrated)
    for (let z = cz - r + 1; z <= cz + r - 1; z++) { set(cx - 2, 0, z, B.WATER); set(cx + 2, 0, z, B.WATER); }
    // log fence, front-center (-Z) left open as the gate you walk in through
    for (let x = cx - r; x <= cx + r; x++) { set(x, 1, cz + r, B.LOG); if (x !== cx) set(x, 1, cz - r, B.LOG); }
    for (let z = cz - r; z <= cz + r; z++) { set(cx - r, 1, z, B.LOG); set(cx + r, 1, z, B.LOG); }
    // leafy wheat crops (cross-sprites placed by game.js) on every tilled row beside the water
    for (let x = cx - r + 1; x <= cx + r - 1; x++) for (let z = cz - r + 1; z <= cz + r - 1; z++) {
      if (x === cx - 2 || x === cx + 2) continue;                   // the water furrows
      if (x === cx && z === cz) continue;                          // the podium tile
      decoCrops.push({ x, z, c: (x + z - cx - cz) & 1 });          // alternating tall wheat / young sprout
    }
    // central résumé podium
    set(cx, 1, cz, B.QUARTZ); set(cx, 2, cz, B.GOLD); set(cx, 3, cz, B.GLOW);
    // a scarecrow post in a corner
    set(cx - r + 1, 1, cz + r - 1, B.LOG); set(cx - r + 1, 2, cz + r - 1, B.W_YELLOW);
    return 4;
  }
  // a Minecraft cottage: framed walls, a 2-wide door, glass windows, a stepped roof, and a FURNISHED
  // interior by type — "smithy" (crafting bench, cobble furnace, iron/ore = tools), "library"
  // (bookshelves; an enchant-table mesh is added by game.js), or "home" (bed + shelf + table).
  function buildCottage(cx, cz, wall, roof, doorSide, type) {
    const r = 2, H = 3;
    walls(cx, cz, r, H, wall, B.PLANKS);                             // walls + plank floor
    for (let y = 1; y <= H; y++) [[-r, -r], [r, -r], [-r, r], [r, r]].forEach(([dx, dz]) => set(cx + dx, y, cz + dz, B.LOG)); // corner posts
    const dc = { "-z": [[-1, -r], [0, -r]], "+z": [[-1, r], [0, r]], "-x": [[-r, -1], [-r, 0]], "+x": [[r, -1], [r, 0]] }[doorSide];
    dc.forEach(([dx, dz]) => { set(cx + dx, 1, cz + dz, null); set(cx + dx, 2, cz + dz, null); });   // 2-wide, 2-tall doorway (fits the player)
    [["-z", cx, cz - r], ["+z", cx, cz + r], ["-x", cx - r, cz], ["+x", cx + r, cz]].forEach(([side, wx, wz]) => { if (side !== doorSide && get(wx, 2, wz) === wall) set(wx, 2, wz, B.GLASS); }); // a window per non-door wall
    for (let layer = 0; layer <= r; layer++) { const rr = r - layer, y = H + 1 + layer; for (let x = cx - rr; x <= cx + rr; x++) for (let z = cz - rr; z <= cz + rr; z++) set(x, y, z, roof); if (rr === 0) break; } // stepped pyramid roof
    set(cx, H, cz, B.GLOW);                                          // interior light
    // furnishings, placed toward the back (never the door-front row): cell(depth,side), depth 1=back row
    const bk = { "-z": [0, 1], "+z": [0, -1], "-x": [1, 0], "+x": [-1, 0] }[doorSide], sd = bk[0] === 0 ? [1, 0] : [0, 1];
    const cell = (m, n) => [cx + bk[0] * m + sd[0] * n, cz + bk[1] * m + sd[1] * n];
    const put = (m, n, b, b2) => { const [x, z] = cell(m, n); set(x, 1, z, b); if (b2) set(x, 2, z, b2); };
    if (type === "smithy") { put(1, -1, B.CRAFTING); put(1, 0, B.COBBLE, B.COBBLE); put(1, 1, B.IRON); put(0, 1, B.REDSTONE); }        // tools + furnace stack (anvil mesh at center via game.js)
    else if (type === "library") { [[1, -1], [1, 0], [1, 1], [0, 1], [0, -1]].forEach(([m, n]) => put(m, n, B.BOOKSHELF, B.BOOKSHELF)); } // shelves (enchant-table mesh at center via game.js)
    else { put(1, -1, B.W_WHITE); put(1, 0, B.W_RED); put(1, 1, B.BOOKSHELF); put(0, 1, B.CRAFTING); }                                  // home: bed + shelf + table
  }
  // the village: six furnished cottages in two rows around a central well, lamp posts, and dirt lanes.
  // Returns the house list ({x,z,type}) so game.js can drop enchant-table / anvil meshes inside.
  function buildVillage(vx, vz) {
    villageSites.push({ x: vx, z: vz, r: 14 });
    const houses = [];
    const add = (dx, dz, wall, roof, door, type) => { buildCottage(vx + dx, vz + dz, wall, roof, door, type); houses.push({ x: vx + dx, z: vz + dz, type }); };
    add(-8, -7, B.PLANKS, B.BRICK, "+z", "smithy");                  // front row — doors face the well
    add(0, -7, B.COBBLE, B.PLANKS, "+z", "home");
    add(8, -7, B.PLANKS, B.DLEAVES, "+z", "library");
    add(-8, 7, B.COBBLE, B.BRICK, "-z", "home");                     // back row
    add(0, 7, B.PLANKS, B.PLANKS, "-z", "library");
    add(8, 7, B.COBBLE, B.DLEAVES, "-z", "smithy");
    // central well: cobble rim + water, four log posts, a plank canopy
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) set(vx + dx, 1, vz + dz, (dx === 0 && dz === 0) ? B.WATER : B.COBBLE);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([dx, dz]) => { set(vx + dx, 2, vz + dz, B.LOG); set(vx + dx, 3, vz + dz, B.LOG); });
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) set(vx + dx, 4, vz + dz, B.PLANKS);
    // glowing lamp posts at the inner corners (clear of houses, well and the main lane)
    [[-4, -4], [4, -4], [-4, 4], [4, 4]].forEach(([dx, dz]) => { set(vx + dx, 1, vz + dz, B.LOG); set(vx + dx, 2, vz + dz, B.LOG); set(vx + dx, 3, vz + dz, B.GLOW); });
    // a couple of hay bales for a lived-in farm feel
    set(vx - 5, 1, vz, B.W_YELLOW); set(vx - 5, 2, vz, B.W_YELLOW); set(vx + 5, 1, vz, B.W_YELLOW);
    // dirt lanes: a wide central path + spurs to each house row
    for (let x = vx - 12; x <= vx + 12; x++) for (let dz = -1; dz <= 1; dz++) if (get(x, 0, vz + dz) === B.GRASS) set(x, 0, vz + dz, B.PATH);
    [-8, 0, 8].forEach(hx => { for (let z = vz - 6; z <= vz + 6; z++) if (get(vx + hx, 0, z) === B.GRASS) set(vx + hx, 0, z, B.PATH); });
    return houses;
  }
  function buildNetherPortal(cx, cz) {
    // --- base platform: nether-brick border + netherrack fill, flush at y=0 (no step-up) ---
    for (let x = cx - 3; x <= cx + 3; x++) for (let z = cz - 2; z <= cz + 2; z++) {
      const edge = (x === cx - 3 || x === cx + 3 || z === cz - 2 || z === cz + 2);
      set(x, 0, z, edge ? B.NETHERBRICK : B.NETHERRACK);
    }
    // --- obsidian frame (faces +/-Z): 4 wide x 5 tall outer, true 2x3 opening centered on cx ---
    const L = cx - 2, R = cx + 1;                              // side-pillar columns
    for (let y = 1; y <= 5; y++) { set(L, y, cz, B.OBSIDIAN); set(R, y, cz, B.OBSIDIAN); } // pillars + corners
    for (let x = L; x <= R; x++) { set(x, 1, cz, B.OBSIDIAN); set(x, 5, cz, B.OBSIDIAN); } // bottom + top bars
    // opening columns cx-1,cx at y=2..4 are intentionally left empty
    // --- glowstone accents: two 2-tall glowing posts flanking the frame ---
    for (let y = 1; y <= 2; y++) { set(cx - 3, y, cz, B.GLOW); set(cx + 2, y, cz, B.GLOW); }
    // --- swirling plane fills the opening exactly: x in [cx-1,cx+1], y in [2,5] ---
    portals.push({ type: "nether", x: cx, y: 3.5, z: cz, w: 2, h: 3, horizontal: false });
    return 6;                                                  // gem anchor sits clear above the lintel
  }
  function buildEndPortal(cx, cz) {
    for (let x = cx - 2; x <= cx + 2; x++) for (let z = cz - 2; z <= cz + 2; z++) { set(x, 0, z, B.ENDSTONE); if (x === cx - 2 || x === cx + 2 || z === cz - 2 || z === cz + 2) set(x, 1, z, B.EFRAME); }
    portals.push({ type: "end", x: cx, y: 1.12, z: cz, w: 3, h: 3, horizontal: true });
    return 3;
  }

  /* ------------------------------- trees ------------------------------ */
  function plantTree(x, z, spruce, keys, baseY = 0) {
    const h = spruce ? 6 : 5, leaf = spruce ? B.DLEAVES : B.LEAVES, b = baseY;
    for (let y = 1; y <= h; y++) setK(x, b + y, z, B.LOG, keys);
    if (spruce) {
      for (let ly = 3; ly <= h + 1; ly++) { const rad = Math.max(1, h + 1 - ly); for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) if (Math.abs(dx) + Math.abs(dz) <= rad && !solid(x + dx, b + ly, z + dz)) setK(x + dx, b + ly, z + dz, leaf, keys); }
      setK(x, b + h + 2, z, leaf, keys);
    } else {
      for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) { if (Math.abs(dx) === 2 && Math.abs(dz) === 2) continue; if (!solid(x + dx, b + h, z + dz)) setK(x + dx, b + h, z + dz, leaf, keys); }
      for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) { if (!solid(x + dx, b + h - 1, z + dz)) setK(x + dx, b + h - 1, z + dz, leaf, keys); if (!solid(x + dx, b + h + 1, z + dz)) setK(x + dx, b + h + 1, z + dz, leaf, keys); }
      setK(x, b + h + 2, z, leaf, keys);
    }
  }

  /* ------------------------------ CHUNKS ------------------------------ */
  function genChunk(ccx, ccz) {
    const keys = new Set(), flowers = [], x0 = ccx * CS, z0 = ccz * CS;
    for (let x = x0; x < x0 + CS; x++) for (let z = z0; z < z0 + CS; z++) {
      if (x * x + z * z <= (CORE_R + 1) * (CORE_R + 1)) continue;    // core owns this column
      if (solid(x, 0, z)) continue;                                 // already generated (stable on reload)
      const h = heightAt(x, z), sea = seaLevelAt(x, z), biome = biomeAt(x, z);
      const water = waterAt(x, z, h);
      const awSea = water ? -1 : adjWaterLevel(x, z);                  // tallest neighbouring waterline
      const shore = !water && awSea >= 0 && h < awSea;                 // dry land below it -> raised bank
      // ---- surface block for this column's terrain top ----
      let top;
      if (water || shore) top = (biome === "ice") ? B.SNOW : B.SAND;   // lake bed / bank
      else if (biome === "desert") top = B.SAND;
      else if (biome === "ice") top = B.SNOW;
      else if (h >= 11) top = B.SNOW;
      else if (h >= 8 && vnoise(x, z, 1 / 7, 4) > 0.62) top = B.STONE;
      else top = B.GRASS;
      // ---- fill the column ----
      if (h === 0 && !water && !shore && top === B.GRASS) {
        setK(x, 0, z, B.GRASS, keys);                               // flat blend ring: seamless with the core plaza
      } else {
        const sub = (biome === "desert") ? B.SANDSTONE : B.DIRT;
        for (let y = 0; y <= h; y++)
          setK(x, y, z, y === h ? top : (y >= h - 2 ? sub : B.STONE), keys);
      }
      // ---- water (flat local surface) / frozen top / raised shore bank ----
      if (water) {
        for (let y = h + 1; y <= sea; y++)
          setK(x, y, z, (biome === "ice" && y === sea) ? B.ICE : B.WATER, keys); // freeze the top block in ice biome
      } else if (shore) {
        const bank = (biome === "ice") ? B.SNOW : B.SAND;
        for (let y = h + 1; y <= awSea; y++) setK(x, y, z, bank, keys);          // lift the bank to the adjacent waterline
      }
      // ---- decoration (biome-specific), never on water / shore ----
      if (!water && !shore) {
        const r = hash(x, z, 11);
        if (biome === "desert") {                                   // sparse cactus, no trees/flowers
          if (r < 0.012 && x % 2 === 0 && z % 2 === 0 && !logNear2(x, z, h)) {
            const ch = 2 + ((hash(x, z, 8) * 2) | 0);
            for (let y = 1; y <= ch; y++) setK(x, h + y, z, B.CACTUS, keys);
          }
        } else if (biome === "ice") {                               // spruce only, no flowers on the snow
          if (h < 10 && r < 0.02 && x % 2 === 0 && z % 2 === 0 && !logNear2(x, z, h)) plantTree(x, z, true, keys, h);
        } else if (h < 8 && top === B.GRASS) {                      // classic grassland: trees + a few flowers
          if (r < 0.03 && x % 2 === 0 && z % 2 === 0 && !logNear2(x, z, h)) plantTree(x, z, hash(x, z, 6) < 0.35, keys, h);
          else if (hash(x, z, 17) < 0.008) flowers.push({ x, y: h + 1, z, c: (hash(x, z, 9) * 10) | 0 });  // hash ∈ [0,0.5)
        }
      }
    }
    if (!keys.size) return null;
    const rec = { mesh: buildGeometry(keys), keys, cx: ccx, cz: ccz, flowers };
    loaded.set(ccx + "," + ccz, rec);
    return rec;
  }
  function unloadChunk(rec) {
    if (!rec) return;
    if (rec.keys) rec.keys.forEach(k => map.delete(k));
    if (rec.cx !== undefined) loaded.delete(rec.cx + "," + rec.cz);
  }

  /* --------------------- craters (destroy + heal) --------------------- */
  // which mesh owns a column: the core inside CORE_R, else the loaded chunk (or undefined if unloaded)
  function regionFor(x, z) {
    if (x * x + z * z <= CORE_R * CORE_R) return coreRec;
    return loaded.get(Math.floor(x / CS) + "," + Math.floor(z / CS));
  }
  function markNbr(x, z, dirty) { const r = regionFor(x, z); if (r) dirty.add(r); }

  function removeBlock(x, y, z, removed, dirty) {
    const b = get(x, y, z);
    if (!b || b.liquid) return;                    // nothing there, or water (never destroy/collide water)
    const rec = regionFor(x, z);
    if (!rec) return;                              // column's chunk not loaded -> leave to genChunk
    removed.push({ x, y, z, b });
    set(x, y, z, null);
    rec.keys.delete(key(x, y, z));
    dirty.add(rec);
    markNbr(x + 1, z, dirty); markNbr(x - 1, z, dirty);   // horizontal neighbors may live in another mesh
    markNbr(x, z + 1, dirty); markNbr(x, z - 1, dirty);   // (crater straddling core<->chunk boundary)
  }

  // natural ground the blast may scorch — structures, water and leaves are left untouched
  const GROUND_SCORCH = new Set([B.GRASS, B.PATH, B.DIRT, B.SAND, B.SNOW, B.STONE, B.COBBLE, B.SANDSTONE]);
  // A creeper blast SCORCHES the surface brown instead of carving a bowl: it recolours each column's
  // TOP block to dirt in place, so no hole opens, the underground / void is never exposed, water never
  // spills, and tree trunks stay put (no floating canopies). The scorch heals back after a while.
  function damage(wx, wz, r) {
    r = r || 2.8;
    const cx = Math.floor(wx), cz = Math.floor(wz), rr = r * r, ri = Math.ceil(r);
    const changed = [], dirty = new Set();
    for (let dx = -ri; dx <= ri; dx++) for (let dz = -ri; dz <= ri; dz++) {
      if (dx * dx + dz * dz > rr) continue;
      const x = cx + dx, z = cz + dz;
      const top = surfaceY(x, z) - 1;              // y of this column's highest solid block
      if (top < 0) continue;
      const b = get(x, top, z);
      if (!b || b.liquid || b.canopy || b === B.DIRT || !GROUND_SCORCH.has(b)) continue; // skip water/leaves/structures/already-scorched
      const rec = regionFor(x, z); if (!rec) continue;   // column's chunk not loaded -> leave it
      changed.push({ x, y: top, z, b });           // remember the original block to restore on heal
      set(x, top, z, B.DIRT);                       // recolour the surface brown — block stays, no hole
      dirty.add(rec);
    }
    if (!changed.length) return;
    dirty.forEach(rebuild);                        // one re-mesh per affected region
    craters.push({ blocks: changed, t: 0, life: 12 + Math.random() * 6, cx, cz, r });
  }

  // heal expired craters (call from the game loop). Idempotent + streaming-safe.
  function updateCraters(dt) {
    for (let i = craters.length - 1; i >= 0; i--) {
      const c = craters[i]; c.t += dt;
      if (c.t < c.life) continue;
      const dirty = new Set();
      for (const b of c.blocks) {
        const rec = regionFor(b.x, b.z);
        if (!rec) continue;                        // chunk unloaded -> genChunk will restore it on reload
        if (get(b.x, b.y, b.z) !== B.DIRT) continue; // regenerated or changed since -> already restored
        set(b.x, b.y, b.z, b.b);                   // restore the original surface (grass / path / sand…)
        dirty.add(rec);
      }
      dirty.forEach(rebuild);
      if (onRegenCb) onRegenCb(c.cx, c.cz, c.r);
      craters.splice(i, 1);
    }
  }
  function setCraterHandlers(h) { onRegenCb = h && h.onRegen; }

  /* ------------------------ chopping trees (axe) ---------------------- */
  // true tree = a LOG trunk crowned by a leaf canopy (so house posts / fences, which are bare
  // LOG, are never choppable). Returns the trunk-top y if it's a tree, else -1.
  function trunkTopIfTree(x, z) {
    let base = -1;
    for (let y = 1; y <= SURF_MAX; y++) { if (map.get(key(x, y, z)) === B.LOG) { base = y; break; } }
    if (base < 0) return -1;
    let topY = base;
    for (let y = base; y <= SURF_MAX; y++) { if (map.get(key(x, y, z)) === B.LOG) topY = y; else break; }
    for (let dy = -1; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
      const b = map.get(key(x + dx, topY + dy, z + dz));
      if (b && b.canopy) return topY;
    }
    return -1;
  }
  // nearest tree trunk to a world point (within ~2.5 blocks) — returns its column, or null.
  function findTree(wx, wz) {
    const cx = Math.floor(wx), cz = Math.floor(wz);
    let best = null, bestD = 6.25;
    for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
      const x = cx + dx, z = cz + dz;
      if (trunkTopIfTree(x, z) < 0) continue;
      const d = (wx - (x + 0.5)) ** 2 + (wz - (z + 0.5)) ** 2;
      if (d < bestD) { bestD = d; best = { x, z }; }
    }
    return best;
  }
  // fell the whole tree at a column: trunk + its ENTIRE connected leaf canopy (flood-filled so no
  // stray leaves are left floating, whatever the canopy shape). No regrowth. Returns the removed
  // blocks [{x,y,z,b}] so the caller can animate a smooth dissolve, or null if there was no tree.
  function chopTree(x, z) {
    let base = -1;
    for (let y = 1; y <= SURF_MAX; y++) { if (map.get(key(x, y, z)) === B.LOG) { base = y; break; } }
    if (base < 0) return null;
    let topY = base;
    for (let y = base; y <= SURF_MAX; y++) { if (map.get(key(x, y, z)) === B.LOG) topY = y; else break; }
    const removed = [], dirty = new Set();
    for (let y = base; y <= topY; y++) removeBlock(x, y, z, removed, dirty);        // trunk
    // flood-fill every connected canopy block near the crown; bounded so a neighbouring tree is never eaten
    const seen = new Set(), stack = [];
    const push = (ax, ay, az) => { const k = key(ax, ay, az); if (seen.has(k)) return; seen.add(k); stack.push([ax, ay, az]); };
    for (let dy = -1; dy <= 3; dy++) for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) push(x + dx, topY + dy, z + dz);
    while (stack.length) {
      const [ax, ay, az] = stack.pop();
      if (ay < 1 || ay > topY + 4 || Math.abs(ax - x) > 5 || Math.abs(az - z) > 5) continue;
      const b = map.get(key(ax, ay, az));
      if (!b || !b.canopy) continue;
      removeBlock(ax, ay, az, removed, dirty);
      for (let ddx = -1; ddx <= 1; ddx++) for (let ddy = -1; ddy <= 1; ddy++) for (let ddz = -1; ddz <= 1; ddz++)
        if (ddx || ddy || ddz) push(ax + ddx, ay + ddy, az + ddz);
    }
    dirty.forEach(rebuild);
    return removed.length ? removed : null;
  }

  /* ------------------------------ mesher ------------------------------ */
  const FACES = [
    { n: [0, 1, 0], t1: [0, 0, 1], t2: [1, 0, 0], f: "top", s: 1.00 },
    { n: [0, -1, 0], t1: [1, 0, 0], t2: [0, 0, 1], f: "bottom", s: 0.50 },
    { n: [1, 0, 0], t1: [0, 1, 0], t2: [0, 0, 1], f: "side", s: 0.62 },
    { n: [-1, 0, 0], t1: [0, 0, 1], t2: [0, 1, 0], f: "side", s: 0.62 },
    { n: [0, 0, 1], t1: [1, 0, 0], t2: [0, 1, 0], f: "side", s: 0.82 },
    { n: [0, 0, -1], t1: [0, 1, 0], t2: [1, 0, 0], f: "side", s: 0.82 },
  ];
  const AO = [0.45, 0.70, 0.86, 1.0], CORN = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  const tileFor = (def, f) => def.all || def[f] || def.side;

  function buildBufferGeometry(keys) {
    const pos = [], col = [], uv = [], idx = []; let v = 0;
    for (const k of keys) {
      const def = map.get(k); if (!def) continue;
      const p = k.split(",").map(Number), x = p[0], y = p[1], z = p[2];
      for (const F of FACES) {
        if (def === B.GRASS && y === 0 && F.f !== "top") continue;         // flat ground => top only (seamless, light)
        if (def.liquid) {
          // render water as full blocks: draw every face not hidden by a solid OR by neighbouring water
          if (solid(x + F.n[0], y + F.n[1], z + F.n[2]) || liquidAt(x + F.n[0], y + F.n[1], z + F.n[2])) continue;
        } else {
          if (F.f === "bottom" && y <= 0) continue;
          if (solid(x + F.n[0], y + F.n[1], z + F.n[2])) continue;
        }
        const rect = Textures.uv(tileFor(def, F.f));
        const yb = 0;                                                      // water fills the full block volume (no floating layer)
        for (let c = 0; c < 4; c++) {
          const sa = CORN[c][0], sb = CORN[c][1];
          pos.push(x + 0.5 + F.n[0] * 0.5 + F.t1[0] * (sa * 0.5) + F.t2[0] * (sb * 0.5), y + 0.5 + F.n[1] * 0.5 + F.t1[1] * (sa * 0.5) + F.t2[1] * (sb * 0.5) + yb, z + 0.5 + F.n[2] * 0.5 + F.t1[2] * (sa * 0.5) + F.t2[2] * (sb * 0.5));
          const s1 = solid(x + F.n[0] + F.t1[0] * sa, y + F.n[1] + F.t1[1] * sa, z + F.n[2] + F.t1[2] * sa);
          const s2 = solid(x + F.n[0] + F.t2[0] * sb, y + F.n[1] + F.t2[1] * sb, z + F.n[2] + F.t2[2] * sb);
          const co = solid(x + F.n[0] + F.t1[0] * sa + F.t2[0] * sb, y + F.n[1] + F.t1[1] * sa + F.t2[1] * sb, z + F.n[2] + F.t1[2] * sa + F.t2[2] * sb);
          const ao = (s1 && s2) ? 0 : 3 - ((s1 ? 1 : 0) + (s2 ? 1 : 0) + (co ? 1 : 0));
          const b = F.s * AO[ao]; col.push(b, b, b);
          uv.push((sa + 1) / 2 ? rect.u1 : rect.u0, (sb + 1) / 2 ? rect.v1 : rect.v0);
        }
        idx.push(v, v + 1, v + 2, v, v + 2, v + 3); v += 4;
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    return g;
  }
  function buildGeometry(keys) {
    return new THREE.Mesh(buildBufferGeometry(keys), new THREE.MeshBasicMaterial({ map: window.__ATLAS, vertexColors: true, side: THREE.DoubleSide }));
  }
  function rebuild(rec) {                          // swap geometry, keep the same Mesh + material
    if (!rec || !rec.mesh) return;
    const g = buildBufferGeometry(rec.keys);
    rec.mesh.geometry.dispose();
    rec.mesh.geometry = g;
  }

  return { buildCore, genChunk, unloadChunk, solidAt: solid, surfaceY, damage, updateCraters, setCraterHandlers, rebuild, findTree, chopTree, biomeAt, waterTopAt, findWaterNear, CS, CORE_R };
})();
