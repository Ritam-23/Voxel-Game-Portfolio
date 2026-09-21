/* ============================================================================
   GAME — endless chunked world, day/night, cinematic intro, free-look camera,
   physics, weapons, mobs, health. Lightweight streaming.
   ========================================================================== */
(() => {
  let renderer, scene, camera, clock;
  let hero = null, shadow = null, weapon = null, greeter = null;
  const gems = [], portalsList = [], scorches = [], regenFx = [], treeFades = [];
  let zones = [], cloudGroup, cloudMat;
  let terrainMat, hemiLight, sunLight, sunMesh, moonMesh, stars;
  let moonTextures = null, moonPhaseIdx = -1;   // 8 pre-drawn phase textures, swapped once per in-game night
  let flowerGroup = null, cropGroup = null, snowPoints = null, snowGeo = null, snowPos = null;
  let cloudOpacity = 0.8, snowOpacity = 0, weatherNight = false, weatherCloudy = false, weatherSnowy = false;
  let enchantTbl = null, anvilMesh = null, houseDoor = null, houseDoorPos = null;
  const villageEnchants = [];
  const bears = [], fish = []; let critterTimer = 0;
  const treeStrikes = {};
  const chunkMats = [];

  const SKY = 0x8fd4ff;
  const FEET_Y = 1, SPEED = 4.8, GRAV = 22, JUMP = 8.4;
  const PLAYER_R = 0.46, PLAYER_H = 1.8, STEP_UP = 1.0;               // body radius (fully covers the hero's arms/hands so it never clips walls), height, auto-climb ledge
  const CORNERS = [[PLAYER_R, PLAYER_R], [PLAYER_R, -PLAYER_R], [-PLAYER_R, PLAYER_R], [-PLAYER_R, -PLAYER_R]];
  const REDUCE = matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const CS = Voxel.CS, RENDER_R = 3;
  const chunks = new Map(); const pending = []; let curCX = null, curCZ = null;

  const char = { x: 0, z: 12, y: FEET_Y, renderY: FEET_Y, vx: 0, vz: 0, vy: 0, onGround: true, yaw: 0, kbx: 0, kbz: 0 };
  const cam = { yaw: Math.PI, pitch: 0.5, dist: 5.4 };
  const player = { hp: 100, sinceHit: 99, dead: false };

  const keys = {};
  let started = false, gl = false, interactQueued = false;
  let introActive = false, introT = 0; const INTRO_DUR = REDUCE ? 0.01 : 3.8;
  let shakeAmt = 0, dayClock = 0; const DAY_LEN = 240, DAY_OFFSET = 0.34;
  let locked = false;
  const WEAPONS = ["sword", "axe"];   // sword = combat, axe = fells trees (and hits mobs when none in front)
  let weaponIdx = 0, attacking = false, attackT = 0, hitDone = false, attackReq = false;
  const touch = { moveId: null, lookId: null, ox: 0, oy: 0, lx: 0, ly: 0, mvx: 0, mvz: 0 };

  /* --------------------------- day / night --------------------------- */
  const KEYS = [
    { t: 0.00, sky: 0x070b1f, fog: 0x070b1f, tint: 0x33406a, hemi: 0.32, dir: 0.05, sun: 0x223055, star: 1.0 },
    { t: 0.15, sky: 0x24305e, fog: 0x30406a, tint: 0x5566a0, hemi: 0.45, dir: 0.15, sun: 0x4a5a9a, star: 0.7 },
    { t: 0.22, sky: 0xff9a5a, fog: 0xffb27a, tint: 0xffd7b0, hemi: 0.75, dir: 0.60, sun: 0xffb060, star: 0.15 },
    { t: 0.34, sky: 0x8fd4ff, fog: 0x9fd8f5, tint: 0xffffff, hemi: 1.05, dir: 0.80, sun: 0xfff2d6, star: 0.0 },
    { t: 0.60, sky: 0x8fd4ff, fog: 0x9fd8f5, tint: 0xffffff, hemi: 1.05, dir: 0.80, sun: 0xfff2d6, star: 0.0 },
    { t: 0.72, sky: 0xff8a4e, fog: 0xffa060, tint: 0xffcba6, hemi: 0.75, dir: 0.55, sun: 0xff8a4a, star: 0.2 },
    { t: 0.82, sky: 0x2a2f60, fog: 0x2a2f60, tint: 0x6675a5, hemi: 0.50, dir: 0.20, sun: 0x3a4680, star: 0.7 },
    { t: 1.00, sky: 0x070b1f, fog: 0x070b1f, tint: 0x33406a, hemi: 0.32, dir: 0.05, sun: 0x223055, star: 1.0 },
  ];
  const cA = new THREE.Color(), cB = new THREE.Color(), cSky = new THREE.Color(), cFog = new THREE.Color(), cTint = new THREE.Color(), cSun = new THREE.Color();
  function applyDayNight() {
    const dt = ((dayClock / DAY_LEN) + DAY_OFFSET) % 1;
    let i = 0; while (i < KEYS.length - 1 && dt > KEYS[i + 1].t) i++;
    const a = KEYS[i], b = KEYS[i + 1] || KEYS[i], f = (dt - a.t) / ((b.t - a.t) || 1);
    cSky.copy(cA.setHex(a.sky)).lerp(cB.setHex(b.sky), f);
    cFog.copy(cA.setHex(a.fog)).lerp(cB.setHex(b.fog), f);
    cTint.copy(cA.setHex(a.tint)).lerp(cB.setHex(b.tint), f);
    cSun.copy(cA.setHex(a.sun)).lerp(cB.setHex(b.sun), f);
    const hemi = a.hemi + (b.hemi - a.hemi) * f, dir = a.dir + (b.dir - a.dir) * f, star = a.star + (b.star - a.star) * f;
    scene.background.copy(cSky); scene.fog.color.copy(cFog);
    if (terrainMat) terrainMat.color.copy(cTint);
    chunkMats.forEach(m => m.color.copy(cTint));
    if (cloudMat) cloudMat.color.copy(cTint);
    hemiLight.intensity = hemi; sunLight.intensity = dir; sunLight.color.copy(cSun);
    if (stars) { stars.material.opacity = star * (weatherNight && weatherCloudy ? 0.4 : 1); stars.position.set(char.x, char.y, char.z); }
    const ang = dt * Math.PI * 2 - Math.PI / 2, sx = Math.cos(ang), sy = Math.sin(ang);
    sunLight.position.set(char.x + sx * 60, Math.max(6, sy * 60 + 20), char.z + 30);
    if (sunMesh) { sunMesh.position.set(char.x + sx * 130, char.y + sy * 130, char.z - 40); sunMesh.material.opacity = 1 - star; }
    if (moonMesh) {
      moonMesh.position.set(char.x - sx * 130, char.y - sy * 130, char.z - 40); moonMesh.material.opacity = star;
      if (camera) moonMesh.quaternion.copy(camera.quaternion);        // billboard: always face the viewer
      const idx = ((Math.floor(dayClock / DAY_LEN + DAY_OFFSET + 0.5) % 8) + 8) % 8;   // stable through each night
      if (idx !== moonPhaseIdx) { moonPhaseIdx = idx; moonMesh.material.map = moonTextures[idx]; moonMesh.material.needsUpdate = true; }
    }
  }

  /* ------------------------------ boot ------------------------------ */
  // paint the loader first, then build the (heavy) world a couple of frames later so the
  // loading bar animates instead of freezing on the synchronous world construction.
  let worldBuilt = false;
  function boot() {
    const go = () => { if (worldBuilt) return; worldBuilt = true; buildWorld(); };
    requestAnimationFrame(() => requestAnimationFrame(go));
    setTimeout(go, 150);                                 // fallback if rAF is throttled (background tab)
  }
  function buildWorld() {
    const canvas = document.getElementById("game");
    scene = new THREE.Scene(); scene.background = new THREE.Color(SKY); scene.fog = new THREE.Fog(SKY, 42, 82);
    camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.1, 500); clock = new THREE.Clock();
    hemiLight = new THREE.HemisphereLight(0xffffff, 0x6b8f3a, 1.05); scene.add(hemiLight);
    sunLight = new THREE.DirectionalLight(0xfff2d6, 0.8); sunLight.position.set(40, 70, 30); scene.add(sunLight);

    sunMesh = new THREE.Mesh(new THREE.SphereGeometry(7, 16, 16), new THREE.MeshBasicMaterial({ color: 0xfff4c4, fog: false, transparent: true }));
    moonTextures = buildMoonPhases();                                  // moon shows real phases, cycling one per night
    moonMesh = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), new THREE.MeshBasicMaterial({ map: moonTextures[0], transparent: true, fog: false, depthWrite: false }));
    scene.add(sunMesh, moonMesh);
    const sg = new THREE.BufferGeometry(), spts = [];
    for (let i = 0; i < 360; i++) { const th = Math.random() * Math.PI * 2, ph = Math.random() * Math.PI * 0.5, r = 240; spts.push(Math.cos(th) * Math.sin(ph) * r, Math.cos(ph) * r + 20, Math.sin(th) * Math.sin(ph) * r); }
    sg.setAttribute("position", new THREE.Float32BufferAttribute(spts, 3));
    stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 1.4, sizeAttenuation: false, transparent: true, opacity: 0, fog: false })); scene.add(stars);

    window.__ATLAS = Textures.build();
    const built = Voxel.buildCore();
    terrainMat = built.coreMesh.material; scene.add(built.coreMesh);
    zones = built.zones;
    zones.forEach(z => { const g = Entities.makeGem(z.color); g.position.set(z.x, z.anchorY, z.z); scene.add(g); gems.push(g); });
    // a friendly villager greeter standing at the contact zone ("Wanna contact me?")
    const cz0 = zones.find(z => z.id === "contact");
    if (cz0) {
      const c = Entities.buildVillager();
      c.group.position.set(cz0.x, Voxel.surfaceY ? Voxel.surfaceY(cz0.x, cz0.z) : 1, cz0.z);
      c.group.rotation.y = Math.atan2(-cz0.x, -cz0.z);             // face inward, toward arriving visitors
      scene.add(c.group); greeter = c;
    }
    built.portals.forEach(d => { const p = Entities.makePortal(d.type); p.mesh.scale.set(d.w, d.h, 1); if (d.horizontal) { p.mesh.rotation.x = -Math.PI / 2; p.mesh.position.set(d.x, d.y, d.z); } else p.mesh.position.set(d.x, d.y, d.z); scene.add(p.mesh); portalsList.push(p); });

    Mobs.spawn(scene, built.mobSpawns); Mobs.setHandlers({ onPlayerHit, onExplode }); Mobs.setVisibility(mobVisible);
    const iz = zones.find(z => z.id === "interests");                 // keep resident animals grazing in the farm pen
    if (iz) Mobs.spawnPen(scene, { x: iz.x, z: iz.z }, 2.5, 5);
    if (built.village) Mobs.spawnVillagers(scene, { x: built.village.x, z: built.village.z }, built.village.r, 9); // populate the village
    if (built.villageHouses) built.villageHouses.forEach(h => {      // drop showcase furniture meshes inside the cottages
      if (h.type === "library") { const e = Entities.buildEnchantTable(); e.group.position.set(h.x, 1, h.z); scene.add(e.group); villageEnchants.push(e); }
      else if (h.type === "smithy") { const a = Entities.buildAnvil(); a.group.position.set(h.x, 1, h.z); a.group.rotation.y = 0.5; scene.add(a.group); }
    });
    Voxel.setCraterHandlers({ onRegen: regenShimmer });
    buildClouds();
    buildSnow();
    if (built.coreFlowers && built.coreFlowers.length) {              // decorative flowers around the plaza
      flowerGroup = new THREE.Group();
      built.coreFlowers.forEach(f => flowerGroup.add(makeFlowerMesh(f.x, 1, f.z, f.c)));
      scene.add(flowerGroup);
    }
    if (built.coreCrops && built.coreCrops.length) {                  // wheat crops on the résumé farm
      cropGroup = new THREE.Group();
      built.coreCrops.forEach(cp => { const m = Entities.makeCrop(cp.c); m.position.set(cp.x + 0.5, 1, cp.z + 0.5); cropGroup.add(m); });
      scene.add(cropGroup);
    }
    // house furniture: enchantment table (library corner), anvil (smithy), openable door on the -Z wall
    const aboutZ = zones.find(z => z.id === "about");
    if (aboutZ) {
      const hx = aboutZ.x, hz = aboutZ.z;                                          // house center; footprint r=7
      enchantTbl = Entities.buildEnchantTable(); enchantTbl.group.position.set(hx + 4, 1, hz + 4); scene.add(enchantTbl.group);
      anvilMesh = Entities.buildAnvil(); anvilMesh.group.position.set(hx + 4, 1, hz - 4); anvilMesh.group.rotation.y = 0.5; scene.add(anvilMesh.group);
      houseDoor = Entities.buildDoor(1.95); houseDoor.group.position.set(hx - 1, 1, hz - 6.5); scene.add(houseDoor.group);
      houseDoorPos = { x: hx, z: hz - 6.5 };
    }

    UI.init({ onStart: startGame, onClose: () => {} });
    UI.buildLabels(zones);
    bindInput();
    setupName();
    if (window.Globe) Globe.start();

    try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true }); renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); if (THREE.sRGBEncoding) renderer.outputEncoding = THREE.sRGBEncoding; resize(); gl = true; }
    catch (err) { console.warn("WebGL unavailable:", err && err.message); showNoGL(); }
    animate();
    hideBoot();
  }
  function hideBoot() { const b = document.getElementById("boot"); if (!b) return; b.classList.add("gone"); setTimeout(() => b.remove(), 600); }
  function setupName() {
    try { localStorage.removeItem("voxel-name"); } catch (_) {}   // retire the old key that overwrote the owner's brand
    const saved = getVisitor();
    applyName(saved);                                             // reflect a remembered name in the navbar on load
    const ni = document.getElementById("player-name");
    if (ni) {
      ni.value = saved;
      ni.addEventListener("input", () => applyName(ni.value));
      ni.addEventListener("keydown", e => { if (e.key === "Enter") { applyName(ni.value); document.getElementById("btn-enter").click(); } });
    }
    const rb = document.getElementById("btn-reload");
    const on = document.getElementById("over-name");
    if (on) on.addEventListener("keydown", e => { if (e.key === "Enter") rb.click(); });
    if (rb) rb.addEventListener("click", () => { if (on) applyName(on.value); respawn(); });
  }

  function showNoGL() { const d = document.createElement("div"); d.id = "nogl"; d.innerHTML = "⚠️ This 3D world needs <b>WebGL</b>.<br>Please open it in Chrome, Edge, or Firefox."; document.body.appendChild(d); }

  // Pre-draw the 8 lunar phases once (tiny 32×32 pixel discs). A pixel on the visible hemisphere is lit
  // when its surface normal faces the sun: nx·sin(φ) + nz·cos(φ) > 0, with φ = π(1−2·phase). Cheap:
  // built a single time at boot, then just swapped as the night changes — no per-frame cost.
  function buildMoonPhases() {
    const N = 32, R = N / 2, texes = [];
    for (let m = 0; m < 8; m++) {
      const phi = Math.PI * (1 - 2 * (m / 8)), sinP = Math.sin(phi), cosP = Math.cos(phi);   // m: 0=new,2=first-qtr,4=full,6=last-qtr
      const cv = document.createElement("canvas"); cv.width = cv.height = N;
      const c = cv.getContext("2d"), img = c.createImageData(N, N), d = img.data;
      for (let py = 0; py < N; py++) for (let px = 0; px < N; px++) {
        const nx = (px + 0.5) / R - 1, ny = (py + 0.5) / R - 1, r2 = nx * nx + ny * ny, i = (py * N + px) * 4;
        if (r2 > 1) { d[i + 3] = 0; continue; }                                      // outside the disc → transparent
        const nz = Math.sqrt(1 - r2), lit = nx * sinP + nz * cosP > 0;
        if (lit) { const s = ((px * 7 + py * 13) % 11 < 2) ? -24 : ((px * 5 + py * 3) % 17 < 2 ? 12 : 0); d[i] = 226 + s; d[i + 1] = 231 + s; d[i + 2] = 245; d[i + 3] = 255; } // pale, faint craters
        else { d[i] = 30; d[i + 1] = 36; d[i + 2] = 60; d[i + 3] = 42; }             // faint dark side (ghostly disc)
      }
      c.putImageData(img, 0, 0);
      const t = new THREE.CanvasTexture(cv); t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
      if (THREE.sRGBEncoding) t.encoding = THREE.sRGBEncoding;
      texes.push(t);
    }
    return texes;
  }

  function buildClouds() {
    cloudGroup = new THREE.Group(); cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 });
    for (let i = 0; i < 22; i++) { const c = new THREE.Mesh(new THREE.BoxGeometry(6 + Math.random() * 12, 1.4, 6 + Math.random() * 12), cloudMat); c.position.set((Math.random() - 0.5) * 300, 40 + Math.random() * 12, (Math.random() - 0.5) * 300); cloudGroup.add(c); }
    scene.add(cloudGroup);
  }
  function buildSnow() {                                   // falling snow for snowy nights (follows the player)
    const N = 300; snowPos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { snowPos[i * 3] = (Math.random() - 0.5) * 70; snowPos[i * 3 + 1] = Math.random() * 34; snowPos[i * 3 + 2] = (Math.random() - 0.5) * 70; }
    snowGeo = new THREE.BufferGeometry(); snowGeo.setAttribute("position", new THREE.BufferAttribute(snowPos, 3));
    snowPoints = new THREE.Points(snowGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.17, transparent: true, opacity: 0, depthWrite: false }));
    snowPoints.visible = false; scene.add(snowPoints);
  }

  // ---- flowers (cheap alpha-tested cross-sprites) ----
  function makeFlowerMesh(x, y, z, c) { const f = Entities.makeFlower(c); f.position.set(x + 0.5, y, z + 0.5); return f; }

  /* ------------------------- weather (night) ------------------------- */
  function hashW(n, s) { let h = Math.imul(n ^ 0x9e3779b9, 2654435761) ^ Math.imul(s + 1, 40503); h ^= h >>> 15; h = Math.imul(h, 2246822519); h ^= h >>> 13; return (h >>> 0) / 4294967296; }
  function computeWeather() {
    const cyc = Math.floor(dayClock / DAY_LEN + DAY_OFFSET + 0.5);   // one value per night (boundary at noon, unseen)
    const phase = ((dayClock / DAY_LEN) + DAY_OFFSET) % 1;
    weatherNight = phase < 0.15 || phase > 0.80;
    weatherCloudy = hashW(cyc, 71) < 0.5;                            // ~half the nights are cloudy
    weatherSnowy = hashW(cyc, 37) < 0.34;                            // ~1/3 of nights get snow (not always)
  }
  function updateWeather(dt) {
    // clouds: full by day; at night only on cloudy nights (else fade to a clear starry sky)
    const cloudTarget = weatherNight ? (weatherCloudy ? 0.5 : 0.0) : 0.8;
    cloudOpacity += (cloudTarget - cloudOpacity) * Math.min(1, dt * 1.2);
    if (cloudMat) cloudMat.opacity = cloudOpacity;
    // snow: only on snowy nights
    const snowTarget = (weatherNight && weatherSnowy) ? 0.9 : 0.0;
    snowOpacity += (snowTarget - snowOpacity) * Math.min(1, dt * 0.8);
    if (!snowPoints) return;
    snowPoints.visible = snowOpacity > 0.01;
    snowPoints.material.opacity = snowOpacity;
    if (!snowPoints.visible) return;
    const N = snowPos.length / 3;
    for (let i = 0; i < N; i++) {
      let y = snowPos[i * 3 + 1] - dt * 6, px = snowPos[i * 3] + Math.sin((y + i) * 0.6) * dt * 0.4, pz = snowPos[i * 3 + 2];
      if (y < 0) { y += 34; px = (Math.random() - 0.5) * 70; pz = (Math.random() - 0.5) * 70; }
      snowPos[i * 3] = px; snowPos[i * 3 + 1] = y; snowPos[i * 3 + 2] = pz;
    }
    snowGeo.attributes.position.needsUpdate = true;
    snowPoints.position.set(char.x, char.y, char.z);                 // box centered on origin follows the player
  }

  /* --------------------- biome life: bears & fish -------------------- */
  const sY = (x, z) => Voxel.surfaceY(Math.floor(x), Math.floor(z));
  // is the world column (x,z) currently on-screen? Used so nothing is ever seen spawning into view.
  const _proj = new THREE.Vector3();
  function mobVisible(x, z) {
    if (!camera) return false;
    _proj.set(x, sY(x, z) + 1, z).project(camera);
    return _proj.z < 1 && _proj.x > -1.18 && _proj.x < 1.18 && _proj.y > -1.18 && _proj.y < 1.18;
  }
  function maintainCritters() {
    const inIce = Voxel.biomeAt && Voxel.biomeAt(char.x, char.z) === "ice";
    if (inIce) { while (bears.length < 3) if (!spawnBear()) break; }   // polar bears roam the cold
    else bears.forEach(b => b.retire = true);
    const w = Voxel.findWaterNear ? Voxel.findWaterNear(char.x, char.z, 22) : null;   // fish in a nearby lake
    if (w) { while (fish.length < 5) spawnFish(w); }
    else fish.forEach(f => f.retire = true);
  }
  function spawnBear() {
    let x, z, ok = false;
    for (let i = 0; i < 16; i++) {                                     // find cold ground the player can't see
      const a = Math.random() * 6.283, r = 20 + Math.random() * 18;
      x = char.x + Math.cos(a) * r; z = char.z + Math.sin(a) * r;
      if (Voxel.biomeAt(x, z) === "ice" && !mobVisible(x, z)) { ok = true; break; }
    }
    if (!ok) return false;
    const b = Entities.makeMob("polarbear");
    b.x = x; b.z = z; b.dir = Math.random() * 6.28; b.timer = 1 + Math.random() * 2; b.retire = false; b.fade = 0;
    b.group.position.set(x, sY(x, z), z); b.group.scale.setScalar(0.05); scene.add(b.group); bears.push(b); return true;
  }
  function updateBears(dt, t) {
    for (let i = bears.length - 1; i >= 0; i--) {
      const b = bears[i];
      if (b.retire) { b.fade -= dt * 1.5; if (b.fade <= 0) { scene.remove(b.group); bears.splice(i, 1); continue; } }
      else if (b.fade < 1) b.fade = Math.min(1, b.fade + dt * 1.5);
      if (Math.hypot(b.x - char.x, b.z - char.z) > 70) { scene.remove(b.group); bears.splice(i, 1); continue; }
      b.timer -= dt; if (b.timer <= 0) { b.dir += (Math.random() - 0.5) * 2; b.timer = 1.5 + Math.random() * 2.5; }
      const nx = b.x + Math.sin(b.dir) * b.speed * dt, nz = b.z + Math.cos(b.dir) * b.speed * dt;
      if (Math.abs(sY(nx, nz) - sY(b.x, b.z)) <= 1) { b.x = nx; b.z = nz; } else b.dir += 1.7;
      const gy = sY(b.x, b.z);
      b.group.position.set(b.x, b.group.position.y + (gy - b.group.position.y) * Math.min(1, dt * 8), b.z);
      b.group.rotation.y = b.dir; b.group.scale.setScalar(0.15 + 0.85 * b.fade); b.update(t, 1);
    }
  }
  function spawnFish(w) {
    const f = Entities.buildFish();
    f.mats = []; f.group.traverse(o => { if (o.material) { o.material.transparent = true; f.mats.push(o.material); } });  // cached once for the fade
    f.cx = w.x; f.cz = w.z; f.ang = Math.random() * 6.28; f.rad = 0.5 + Math.random() * 1.3; f.spd = 0.5 + Math.random() * 0.6; f.retire = false; f.fade = 0;
    f.group.position.set(w.x + 0.5, w.y - 0.12, w.z + 0.5); scene.add(f.group); fish.push(f);
  }
  function updateFish(dt, t) {
    for (let i = fish.length - 1; i >= 0; i--) {
      const f = fish[i];
      if (f.retire) { f.fade -= dt * 2; if (f.fade <= 0) { scene.remove(f.group); fish.splice(i, 1); continue; } }
      else if (f.fade < 1) f.fade = Math.min(1, f.fade + dt * 1.6);
      if (Math.hypot(f.cx - char.x, f.cz - char.z) > 42) { scene.remove(f.group); fish.splice(i, 1); continue; }
      f.ang += f.spd * dt;
      const x = f.cx + 0.5 + Math.cos(f.ang) * f.rad, z = f.cz + 0.5 + Math.sin(f.ang) * f.rad;
      const wy = Voxel.waterTopAt(Math.floor(x), Math.floor(z));
      if (wy < 0) f.rad = Math.max(0.3, f.rad - 0.06);                // steer back toward deeper water
      const y = (wy > 0 ? wy : w0(f)) - 0.14 + Math.sin(t * 3 + i) * 0.03;
      f.group.position.set(x, y, z); f.group.rotation.y = -f.ang + Math.PI / 2;
      f.group.scale.setScalar(0.15 + 0.85 * f.fade);                  // ease in from tiny
      for (let m = 0; m < f.mats.length; m++) f.mats[m].opacity = f.fade;
      f.update(t);
    }
  }
  const w0 = f => Voxel.waterTopAt(f.cx, f.cz) > 0 ? Voxel.waterTopAt(f.cx, f.cz) : 1;

  /* ------------------------------ chunks ------------------------------ */
  function updateChunks() {
    const pcx = Math.floor(char.x / CS), pcz = Math.floor(char.z / CS);
    if (pcx !== curCX || pcz !== curCZ) {
      curCX = pcx; curCZ = pcz; pending.length = 0;
      const cells = []; for (let dz = -RENDER_R; dz <= RENDER_R; dz++) for (let dx = -RENDER_R; dx <= RENDER_R; dx++) cells.push([dx, dz]);
      cells.sort((a, b) => (a[0] * a[0] + a[1] * a[1]) - (b[0] * b[0] + b[1] * b[1]));
      cells.forEach(([dx, dz]) => { const k = (pcx + dx) + "," + (pcz + dz); if (!chunks.has(k)) pending.push([pcx + dx, pcz + dz, k]); });
      for (const [k, rec] of chunks) { const c = k.split(",").map(Number); if (Math.abs(c[0] - pcx) > RENDER_R + 1 || Math.abs(c[1] - pcz) > RENDER_R + 1) { if (rec && !rec.empty) { scene.remove(rec.mesh); rec.mesh.geometry.dispose(); const mi = chunkMats.indexOf(rec.mesh.material); if (mi >= 0) chunkMats.splice(mi, 1); if (rec.flowerGroup) { scene.remove(rec.flowerGroup); rec.flowerGroup = null; } Voxel.unloadChunk(rec); } chunks.delete(k); } }
    }
    let budget = 2;
    while (budget > 0 && pending.length) { const [cx, cz, k] = pending.shift(); if (chunks.has(k)) continue; const rec = Voxel.genChunk(cx, cz); chunks.set(k, rec || { empty: true }); if (rec) { rec.mesh.material.color.copy(cTint); chunkMats.push(rec.mesh.material); scene.add(rec.mesh); if (rec.flowers && rec.flowers.length) { const fg = new THREE.Group(); rec.flowers.forEach(f => fg.add(makeFlowerMesh(f.x, f.y, f.z, f.c))); rec.flowerGroup = fg; scene.add(fg); } budget--; } }
  }

  function startGame(kind) {
    if (window.Globe) Globe.stop();
    hero = Entities.buildCharacter(kind); scene.add(hero.group);
    shadow = Entities.makeShadow(); scene.add(shadow); equipWeapon(0);
    char.x = 0; char.z = 12; char.y = FEET_Y; char.renderY = FEET_Y; char.yaw = Math.PI;
    player.hp = 100; player.dead = false; player.sinceHit = 99;
    started = true; introActive = !REDUCE; introT = 0; curCX = null;
    if (!REDUCE) document.getElementById("letterbox").classList.add("on");
    document.getElementById("navbar").classList.add("on");
    document.getElementById("hearts").classList.add("on");
    buildHearts();
  }
  function equipWeapon(i) {
    weaponIdx = (i + WEAPONS.length) % WEAPONS.length;
    if (weapon && hero) hero.parts.armR.remove(weapon);
    weapon = Entities.buildWeapon(WEAPONS[weaponIdx]);
    if (hero) hero.parts.armR.add(weapon);
    const el = document.getElementById("weapon-name"); if (el) el.textContent = WEAPONS[weaponIdx][0].toUpperCase() + WEAPONS[weaponIdx].slice(1);
  }

  /* --------------------------- name --------------------------- */
  // The visitor's own name (for a personal touch) — kept SEPARATE from the owner's brand (CONFIG.profile.name).
  function getVisitor() {
    try { const n = localStorage.getItem("voxel-visitor"); if (n && n.trim()) return n.trim(); } catch (_) {}
    return "";
  }
  function applyName(raw) {
    const name = (raw || "").trim();
    try { if (name) localStorage.setItem("voxel-visitor", name); else localStorage.removeItem("voxel-visitor"); } catch (_) {}
    const nb = document.getElementById("nb-name");
    if (nb) nb.textContent = name || CONFIG.profile.name;   // navbar greets the visitor by the name they entered
    // NOTE: the title screen #p-name always stays the owner (CONFIG.profile.name).
  }

  /* --------------------------- health --------------------------- */
  // pixel-art Minecraft heart (9x9 grid): 1=dark outline, 2=red, 3=shine highlight
  const HEART_GRID = [
    [0, 1, 1, 0, 0, 0, 1, 1, 0],
    [1, 3, 3, 1, 0, 1, 2, 2, 1],
    [1, 3, 3, 2, 1, 2, 2, 2, 1],
    [1, 3, 2, 2, 2, 2, 2, 2, 1],
    [1, 2, 2, 2, 2, 2, 2, 2, 1],
    [0, 1, 2, 2, 2, 2, 2, 1, 0],
    [0, 0, 1, 2, 2, 2, 1, 0, 0],
    [0, 0, 0, 1, 2, 1, 0, 0, 0],
    [0, 0, 0, 0, 1, 0, 0, 0, 0],
  ];
  function heartDataURL(kind) {
    const px = 6, N = 9, cv = document.createElement("canvas"); cv.width = cv.height = N * px;
    const c = cv.getContext("2d");
    const col = kind === "full" ? { 1: "#3a0a0a", 2: "#ff2b2b", 3: "#ff9b9b" } : { 1: "#241f2b", 2: "#4b4552", 3: "#5b5563" };
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const v = HEART_GRID[y][x]; if (!v) continue; c.fillStyle = col[v]; c.fillRect(x * px, y * px, px, px); }
    return cv.toDataURL();
  }
  let heartStyleDone = false;
  function initHeartStyle() {
    if (heartStyleDone) return; heartStyleDone = true;
    const s = document.createElement("style");
    s.textContent = `#hearts .heart{background-image:url(${heartDataURL("full")})}#hearts .heart.empty{background-image:url(${heartDataURL("empty")})}`;
    document.head.appendChild(s);
  }
  function buildHearts() { initHeartStyle(); const h = document.getElementById("hearts"); h.innerHTML = ""; for (let i = 0; i < 5; i++) { const s = document.createElement("span"); s.className = "heart"; h.appendChild(s); } updateHearts(); }
  function updateHearts() { const filled = Math.ceil(player.hp / 20); document.querySelectorAll("#hearts .heart").forEach((s, i) => s.classList.toggle("empty", i >= filled)); }
  function onPlayerHit(dmg) { if (player.dead || introActive) return; player.hp = Math.max(0, player.hp - dmg); player.sinceHit = 0; updateHearts(); const d = document.getElementById("dmg"); d.style.opacity = Math.min(0.6, 0.2 + dmg / 60); setTimeout(() => d.style.opacity = 0, 160); if (player.hp <= 0) die(); }
  function onExplode(x, z) { Voxel.damage(x, z, 2.8); const fl = document.getElementById("flash"); fl.style.opacity = 0.85; setTimeout(() => fl.style.opacity = 0, 200); shakeAmt = 0.7; addScorch(x, z); const d = Math.hypot(char.x - x, char.z - z); if (d < 5.5) { const k = 1 - d / 5.5, a = Math.atan2(char.x - x, char.z - z); char.kbx += Math.sin(a) * 9 * k; char.kbz += Math.cos(a) * 9 * k; onPlayerHit(40 * k); } }
  function die() {
    player.dead = true;
    if (UI.closePanel) UI.closePanel();               // close any open section panel (contact/resume/…)
    if (UI.closeViewer) UI.closeViewer();             // and the résumé viewer, if open
    const d = document.getElementById("dmg"); d.style.opacity = 0.85;
    updateHearts();                                   // show all 5 hearts empty
    if (document.exitPointerLock) document.exitPointerLock();
    setTimeout(() => {
      d.style.opacity = 0;
      const ov = document.getElementById("over-name");
      if (ov) ov.value = getVisitor();
      document.getElementById("screen-over").classList.add("on");
      if (ov) setTimeout(() => ov.focus(), 60);
    }, 900);
  }
  function respawn() {
    document.getElementById("screen-over").classList.remove("on");
    char.x = 0; char.z = 12; char.y = FEET_Y; char.renderY = FEET_Y; char.kbx = char.kbz = 0;
    cam.yaw = Math.PI; cam.pitch = 0.5;
    player.hp = 100; player.dead = false; player.sinceHit = 99;
    introActive = !REDUCE; introT = 0; curCX = null;
    if (!REDUCE) document.getElementById("letterbox").classList.add("on");
    updateHearts();
  }
  function addScorch(x, z) { const m = new THREE.Mesh(new THREE.CircleGeometry(2.4, 20), new THREE.MeshBasicMaterial({ color: 0x231409, transparent: true, opacity: 0.42, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.position.set(x, (Voxel.surfaceY ? Voxel.surfaceY(Math.floor(x), Math.floor(z)) : 1) + 0.03, z); m.renderOrder = 1; m.userData.life = 5; scene.add(m); scorches.push(m); }
  const MOTE_GEO = new THREE.BoxGeometry(0.16, 0.16, 0.16);   // shared — no per-mote geometry churn
  function regenShimmer(cx, cz, r) {                          // green motes rising as land heals
    const gy = (Voxel.surfaceY ? Voxel.surfaceY(Math.floor(cx), Math.floor(cz)) : 1);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2, rr = Math.random() * r;
      const m = new THREE.Mesh(MOTE_GEO, new THREE.MeshBasicMaterial({ color: 0x8be36b, transparent: true, opacity: 0.9, depthWrite: false }));
      m.position.set(cx + Math.cos(a) * rr, gy + 0.2 + Math.random() * 0.5, cz + Math.sin(a) * rr);
      m.userData = { life: 1.1, vy: 1.3 + Math.random() * 0.8 };
      scene.add(m); regenFx.push(m);
    }
  }
  // a short burst of coloured motes (wood chips fall, leaf/heal motes rise) — reuses the regenFx loop
  function spawnBurst(x, y, z, color, n, up) {
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(MOTE_GEO, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, depthWrite: false }));
      m.position.set(x + (Math.random() - 0.5) * 0.8, y + (Math.random() - 0.5) * 0.6, z + (Math.random() - 0.5) * 0.8);
      m.userData = { life: 0.7 + Math.random() * 0.4, vy: up ? (0.6 + Math.random()) : (-1.2 - Math.random()) };
      scene.add(m); regenFx.push(m);
    }
  }
  // smooth tree dissolve: turn every felled block (trunk + leaves) into a fading, shrinking,
  // gently-falling cube at its old spot, so the whole tree melts away instead of vanishing.
  const FADE_GEO = new THREE.BoxGeometry(0.92, 0.92, 0.92);
  function spawnTreeFade(blocks) {
    for (const b of blocks) {
      const leaf = b.b && b.b.canopy, col = leaf ? 0x3f8f39 : 0x6b4f2e;           // leaf green / oak brown
      const m = new THREE.Mesh(FADE_GEO, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 1, depthWrite: false }));
      m.position.set(b.x + 0.5, b.y + 0.5, b.z + 0.5);
      m.userData = { life: 0.55 + Math.random() * 0.3, max: 0.85, vy: -0.4 - Math.random() * 0.9, spin: (Math.random() - 0.5) * 3 };
      scene.add(m); treeFades.push(m);
    }
  }

  /* ------------------------------ input ------------------------------ */
  function bindInput() {
    addEventListener("unhandledrejection", e => { if (e.reason && e.reason.name === "SecurityError") e.preventDefault(); });
    addEventListener("resize", resize);
    addEventListener("keydown", e => {
      const el = document.activeElement;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable)) return;   // don't hijack typing / form fields
      keys[e.code] = true;
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) e.preventDefault();
      if (e.code === "KeyE" || e.code === "Enter") interactQueued = true;
      if (e.code === "KeyX" || e.code === "KeyF") attackReq = true;
      if (e.code === "Digit1") equipWeapon(0);
      if (e.code === "Digit2") equipWeapon(1);
      if (e.code === "KeyM" && window.Music) Music.toggle();                                   // mute / unmute music
      if (e.code === "Escape") {
        if (UI.isPanelOpen()) UI.closePanel(); if (UI.closeViewer) UI.closeViewer();
        if (document.exitPointerLock) document.exitPointerLock();                              // release the mouse → cursor visible
      }
    });
    addEventListener("keyup", e => { keys[e.code] = false; });

    const canvas = document.getElementById("game");
    canvas.addEventListener("mousedown", () => { if (started && !UI.isPanelOpen() && !introActive && !(UI.isViewerOpen && UI.isViewerOpen())) { try { const p = canvas.requestPointerLock && canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (_) {} } });
    document.addEventListener("pointerlockchange", () => { locked = document.pointerLockElement === canvas; });
    addEventListener("mousemove", e => { if (locked && started && !introActive) { cam.yaw -= e.movementX * 0.0028; cam.pitch = Math.max(0.08, Math.min(1.3, cam.pitch - e.movementY * 0.0028)); } });
    addEventListener("wheel", () => { if (locked && document.exitPointerLock) document.exitPointerLock(); }, { passive: true });   // scroll => cursor returns
    const obs = new MutationObserver(() => { if (UI.isPanelOpen() && document.exitPointerLock) document.exitPointerLock(); });
    obs.observe(document.getElementById("overlay"), { childList: true });
    bindTouch();
  }

  function bindTouch() {
    if ("ontouchstart" in window || navigator.maxTouchPoints > 0) document.getElementById("touch").classList.add("on");
    const stick = document.getElementById("stick"), knob = document.getElementById("knob");
    addEventListener("touchstart", e => {
      if (!started || UI.isPanelOpen()) return;
      for (const t of e.changedTouches) {
        if (t.target.closest("#jump") || t.target.closest("#act") || t.target.closest("#attack")) continue;
        if (t.clientX < innerWidth * 0.5 && touch.moveId === null) { touch.moveId = t.identifier; touch.ox = t.clientX; touch.oy = t.clientY; stick.style.display = "block"; stick.style.left = t.clientX + "px"; stick.style.top = t.clientY + "px"; }
        else if (touch.lookId === null) { touch.lookId = t.identifier; touch.lx = t.clientX; touch.ly = t.clientY; }
      }
    }, { passive: true });
    addEventListener("touchmove", e => {
      for (const t of e.changedTouches) {
        if (t.identifier === touch.moveId) { const dx = t.clientX - touch.ox, dy = t.clientY - touch.oy, mag = Math.hypot(dx, dy) || 1, cl = Math.min(mag, 46) / 46; touch.mvx = (dx / mag) * cl; touch.mvz = -(dy / mag) * cl; knob.style.left = (dx / mag * Math.min(mag, 46)) + "px"; knob.style.top = (dy / mag * Math.min(mag, 46)) + "px"; }
        else if (t.identifier === touch.lookId && !introActive) { cam.yaw -= (t.clientX - touch.lx) * 0.006; cam.pitch = Math.max(0.08, Math.min(1.3, cam.pitch - (t.clientY - touch.ly) * 0.006)); touch.lx = t.clientX; touch.ly = t.clientY; }
      }
    }, { passive: true });
    const end = e => { for (const t of e.changedTouches) { if (t.identifier === touch.moveId) { touch.moveId = null; touch.mvx = touch.mvz = 0; stick.style.display = "none"; knob.style.left = knob.style.top = "0px"; } if (t.identifier === touch.lookId) touch.lookId = null; } };
    addEventListener("touchend", end); addEventListener("touchcancel", end);
    document.getElementById("jump").addEventListener("touchstart", e => { e.preventDefault(); if (char.onGround) { char.vy = JUMP; char.onGround = false; } }, { passive: false });
    document.getElementById("act").addEventListener("touchstart", e => { e.preventDefault(); interactQueued = true; }, { passive: false });
    document.getElementById("attack").addEventListener("touchstart", e => { e.preventDefault(); attackReq = true; }, { passive: false });
  }

  /* ------------------------------ physics ------------------------------ */
  // walkable top of the column at (x,z), reachable from feet height fy (ignores overhangs like door lintels).
  function columnGround(x, z, fy) {
    const xi = Math.floor(x), zi = Math.floor(z), ceil = Math.floor(fy + STEP_UP);
    for (let y = ceil; y >= 1; y--) if (Voxel.solidAt(xi, y, zi)) return y + 1;
    return FEET_Y;
  }
  // highest ground under the 4-corner footprint (used for landing / step-up).
  function groundAt(x, z, fy) { let g = FEET_Y; for (const c of CORNERS) { const h = columnGround(x + c[0], z + c[1], fy); if (h > g) g = h; } return g; }
  // any solid block intersecting the body [feetY, feetY+PLAYER_H) at this footprint?
  function bodyBlocked(x, z, feetY) {
    const y0 = Math.floor(feetY + 0.05), y1 = Math.floor(feetY + PLAYER_H - 0.05);
    for (const c of CORNERS) { const xi = Math.floor(x + c[0]), zi = Math.floor(z + c[1]); for (let y = y0; y <= y1; y++) if (Voxel.solidAt(xi, y, zi)) return true; }
    return false;
  }
  const mobBlock = (nx, nz) => Mobs.list.some(m => !m.dead && !m.dying && Math.hypot(nx - m.x, nz - m.z) < PLAYER_R + (m.rad || 0.42));
  // try to move one axis; auto-climb <=1 block, blocked by walls, mobs, and low ceilings.
  function stepAxis(nx, nz) {
    const g = groundAt(nx, nz, char.y);
    if (g - char.y > STEP_UP + 0.001) return false;        // ledge/wall too tall to climb
    const feet = Math.max(char.y, g);                       // stand on top if stepping up
    if (bodyBlocked(nx, nz, feet)) return false;            // body would clip a wall / ceiling
    if (mobBlock(nx, nz)) return false;
    return feet;
  }
  function cameraCollide(tx, ty, tz, cx, cy, cz) {
    const dx = cx - tx, dy = cy - ty, dz = cz - tz, len = Math.hypot(dx, dy, dz) || 1, ux = dx / len, uy = dy / len, uz = dz / len; let d = len;
    for (let s = 0.5; s < len; s += 0.5) if (Voxel.solidAt(Math.floor(tx + ux * s), Math.floor(ty + uy * s), Math.floor(tz + uz * s))) { d = Math.max(1.3, s - 0.35); break; }
    return [tx + ux * d, ty + uy * d, tz + uz * d];
  }

  /* ------------------------------ update ------------------------------ */
  function update(dt) {
    const t = clock.elapsedTime, paused = UI.isPanelOpen() || (UI.isViewerOpen && UI.isViewerOpen());
    dayClock += dt; computeWeather(); applyDayNight(); updateWeather(dt); updateChunks(); Voxel.updateCraters(dt);
    player.sinceHit += dt;
    if (!player.dead && player.hp < 100 && player.sinceHit > 5) { player.hp = Math.min(100, player.hp + dt * 6); updateHearts(); }

    Mobs.update(dt, t, { x: char.x, z: char.z, vx: -Math.sin(cam.yaw), vz: -Math.cos(cam.yaw) });
    portalsList.forEach(p => { p.tex.offset.y -= dt * 0.5; p.tex.offset.x = Math.sin(t + p.mesh.position.x) * 0.02; });
    gems.forEach((g, i) => { g.userData.gem.rotation.y += dt * 1.6; g.position.y = zones[i].anchorY + Math.sin(t * 2 + i) * 0.12; });
    if (greeter) greeter.update(t, 0, false);                       // idle breathing/arm sway for the contact greeter
    if (enchantTbl) enchantTbl.update(t);                           // floating enchantment book
    for (let i = 0; i < villageEnchants.length; i++) villageEnchants[i].update(t);   // village library books
    if (houseDoor) houseDoor.update(!!houseDoorPos && Math.hypot(char.x - houseDoorPos.x, char.z - houseDoorPos.z) < 3.4); // opens as you approach
    critterTimer -= dt; if (critterTimer <= 0 && !paused && !introActive) { critterTimer = 1.2; maintainCritters(); }
    updateBears(dt, t); updateFish(dt, t);
    cloudGroup.position.x += dt * 0.8; if (cloudGroup.position.x > 150) cloudGroup.position.x = -150;
    for (let i = scorches.length - 1; i >= 0; i--) { const m = scorches[i]; m.userData.life -= dt; m.material.opacity = Math.max(0, m.userData.life / 5 * 0.5); if (m.userData.life <= 0) { scene.remove(m); scorches.splice(i, 1); } }
    for (let i = regenFx.length - 1; i >= 0; i--) { const m = regenFx[i]; m.userData.life -= dt; m.position.y += m.userData.vy * dt; m.rotation.y += dt * 4; m.material.opacity = Math.max(0, m.userData.life * 0.85); if (m.userData.life <= 0) { scene.remove(m); m.material.dispose(); regenFx.splice(i, 1); } }
    for (let i = treeFades.length - 1; i >= 0; i--) { const m = treeFades[i], u = m.userData; u.life -= dt; m.position.y += u.vy * dt; m.rotation.y += u.spin * dt; m.rotation.x += u.spin * 0.6 * dt; const k = Math.max(0, u.life / u.max); m.material.opacity = k; m.scale.setScalar(0.3 + 0.7 * k); if (u.life <= 0) { scene.remove(m); m.material.dispose(); treeFades.splice(i, 1); } }

    let moveAmount = 0;
    if (introActive) {
      introT += dt; const p = Math.min(1, introT / INTRO_DUR);
      const e = p * p * p * (p * (p * 6 - 15) + 10);        // smootherstep — no jerk at either end
      const ang = -Math.PI * 0.5 + e * (Math.PI * 1.5), rad = 26 - e * 20.6, hgt = 22 - e * 17.5, tx = char.x, ty = char.y + 1.4, tz = char.z;
      camera.position.set(tx + Math.sin(ang) * rad, ty + hgt, tz + Math.cos(ang) * rad); camera.lookAt(tx, ty + 0.2, tz);
      const fov = 82 - e * 12; if (Math.abs(camera.fov - fov) > 0.05) { camera.fov = fov; camera.updateProjectionMatrix(); } // gentle push-in
      if (p >= 1) { introActive = false; cam.yaw = ang; cam.pitch = 0.5; if (camera.fov !== 70) { camera.fov = 70; camera.updateProjectionMatrix(); } document.getElementById("letterbox").classList.remove("on"); }
    } else {
      let iz = 0, ix = 0;
      if (!paused && !player.dead) { if (keys.KeyW || keys.ArrowUp) iz += 1; if (keys.KeyS || keys.ArrowDown) iz -= 1; if (keys.KeyA || keys.ArrowLeft) ix -= 1; if (keys.KeyD || keys.ArrowRight) ix += 1; iz += touch.mvz; ix += touch.mvx; if (keys.Space && char.onGround) { char.vy = JUMP; char.onGround = false; } }
      const mag = Math.hypot(ix, iz);
      if (mag > 0.01) { const fX = -Math.sin(cam.yaw), fZ = -Math.cos(cam.yaw), rX = Math.cos(cam.yaw), rZ = -Math.sin(cam.yaw); let dx = fX * iz + rX * ix, dz = fZ * iz + rZ * ix; const dl = Math.hypot(dx, dz) || 1; dx /= dl; dz /= dl; const spd = SPEED * Math.min(1, mag); char.vx = dx * spd; char.vz = dz * spd; char.yaw = Math.atan2(dx, dz); moveAmount = Math.min(1, mag); } else { char.vx = 0; char.vz = 0; }
      // walk (each axis resolved independently so we slide along walls)
      let sx = stepAxis(char.x + char.vx * dt, char.z); if (sx !== false) { char.x += char.vx * dt; if (char.onGround) char.y = sx; }
      let sz = stepAxis(char.x, char.z + char.vz * dt); if (sz !== false) { char.z += char.vz * dt; if (char.onGround) char.y = sz; }
      // knockback (creeper blast) — also collision-resolved so we never punch through walls
      if (char.kbx || char.kbz) {
        const kx = stepAxis(char.x + char.kbx * dt, char.z); if (kx !== false) char.x += char.kbx * dt; else char.kbx = 0;
        const kz = stepAxis(char.x, char.z + char.kbz * dt); if (kz !== false) char.z += char.kbz * dt; else char.kbz = 0;
        char.kbx *= 0.86; char.kbz *= 0.86; if (Math.abs(char.kbx) < 0.1) char.kbx = 0; if (Math.abs(char.kbz) < 0.1) char.kbz = 0;
      }

      const tx = char.x, ty = char.renderY + 1.4, tz = char.z;      // camera follows the SMOOTHED height (no step pop)
      let cx = tx + cam.dist * Math.cos(cam.pitch) * Math.sin(cam.yaw), cy = ty + cam.dist * Math.sin(cam.pitch), cz = tz + cam.dist * Math.cos(cam.pitch) * Math.cos(cam.yaw);
      const cc = cameraCollide(tx, ty, tz, cx, cy, cz);
      if (shakeAmt > 0) { cc[0] += (Math.random() - 0.5) * shakeAmt; cc[1] += (Math.random() - 0.5) * shakeAmt; cc[2] += (Math.random() - 0.5) * shakeAmt; shakeAmt = Math.max(0, shakeAmt - dt * 1.5); }
      camera.position.set(cc[0], cc[1], cc[2]); camera.lookAt(tx, ty, tz);
    }

    char.vy -= GRAV * dt; char.y += char.vy * dt;
    const gy = groundAt(char.x, char.z, char.y);          // terrain height under the player right now
    if (char.vy <= 0 && char.y <= gy) { char.y = gy; char.vy = 0; char.onGround = true; } else char.onGround = false;
    // A 1-block step-up sets char.y instantly; ease the RENDERED height toward it ONLY while on the
    // ground, so a ledge reads as actually climbing up onto the higher block instead of teleporting a
    // layer up. In the air, track exactly so jumps and falls stay crisp (they're already smooth).
    if (char.onGround) { const dyR = char.y - char.renderY; char.renderY += (Math.abs(dyR) > 1.6 ? dyR : dyR * Math.min(1, dt * 11)); }
    else char.renderY = char.y;

    if (attackReq && !attacking && !paused && !introActive && !player.dead) { attacking = true; attackT = 0; hitDone = false; }
    attackReq = false;
    if (attacking) {
      attackT += dt; const ap = attackT / 0.32;
      if (hero) hero.parts.armR.rotation.x = Math.sin(Math.min(ap, 1) * Math.PI) * -1.9 + 0.2;
      if (ap >= 0.5 && !hitDone) {
        const dx = Math.sin(char.yaw), dz = Math.cos(char.yaw);
        let chopped = false;
        if (WEAPONS[weaponIdx] === "axe" && Voxel.findTree) {              // the axe fells trees (3 strikes)
          const tb = Voxel.findTree(char.x + dx * 1.3, char.z + dz * 1.3);
          if (tb) {
            chopped = true;
            const kk = tb.x + "," + tb.z, gy = Voxel.surfaceY(tb.x, tb.z);
            treeStrikes[kk] = (treeStrikes[kk] || 0) + 1;
            if (treeStrikes[kk] >= 3) { const felled = Voxel.chopTree(tb.x, tb.z); delete treeStrikes[kk]; if (felled) spawnTreeFade(felled); }
            else spawnBurst(tb.x + 0.5, gy + 1.0, tb.z + 0.5, 0x8a5a2c, 6, 0);
          }
        }
        if (!chopped) Mobs.hit(char.x + dx * 0.5, char.z + dz * 0.5, dx, dz);
        hitDone = true;
      }
      if (ap >= 1) { attacking = false; if (hero) hero.parts.armR.rotation.x = 0; }
    }

    if (hero) { hero.group.position.set(char.x, char.renderY, char.z); let d = char.yaw - hero.group.rotation.y; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; hero.group.rotation.y += d * Math.min(1, dt * 12); hero.update(t, moveAmount, attacking); hero.group.visible = !player.dead || (Math.floor(t * 8) % 2 === 0); shadow.position.set(char.x, Voxel.surfaceY(Math.floor(char.x), Math.floor(char.z)) + 0.02, char.z); }

    let near = null, nd = 4.4;
    zones.forEach(z => { const d = Math.hypot(char.x - z.x, char.z - z.z); if (d < nd) { nd = d; near = z; } });
    UI.updateLabels(zones.map(z => { const v = new THREE.Vector3(z.x, z.anchorY + 0.4, z.z).project(camera); const on = v.z < 1 && v.x > -1.2 && v.x < 1.2 && v.y > -1.2 && v.y < 1.2; return { id: z.id, onScreen: on, x: (v.x * 0.5 + 0.5) * innerWidth, y: (-v.y * 0.5 + 0.5) * innerHeight, near: near && near.id === z.id }; }));
    gems.forEach((g, i) => { const s = (near && near.id === zones[i].id) ? 1.35 : 1; g.scale.setScalar(g.scale.x + (s - g.scale.x) * 0.2); });
    if (interactQueued) { interactQueued = false; if (near && !paused && !introActive && !player.dead) UI.openPanel(near.id); }
  }

  function animate() { requestAnimationFrame(animate); const dt = Math.min(0.05, clock.getDelta()); if (started) update(dt); if (gl && renderer) renderer.render(scene, camera); }
  function resize() { if (renderer) renderer.setSize(innerWidth, innerHeight); if (camera) { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); } }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
