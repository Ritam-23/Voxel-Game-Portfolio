/* ============================================================================
   MOBS — wander/chase AI (voxel collision), player collision, creeper blasts,
   enderman teleport, weapon-kill. Mobs stay around the player in the endless world.
   ========================================================================== */
window.Mobs = (() => {
  const list = [];
  let spawnsRef = null, sceneRef = null, handlers = { onExplode: () => {}, onPlayerHit: () => {} };
  const PLAYER_SEP = 0.55;  // effective player body radius for mob separation
  let px = 0, pz = 0;
  let pvx = 0, pvz = 1;     // player's forward VIEW direction (updated each frame)
  let visibleCb = null;     // game.js supplies a frustum test so we never spawn inside the view
  const poofs = [];   // vanishing particle bursts

  const randSpawn = () => spawnsRef[(Math.random() * spawnsRef.length) | 0];
  function nearPlayer(min, max) { const a = Math.random() * Math.PI * 2, r = min + Math.random() * (max - min); return { x: px + Math.cos(a) * r, z: pz + Math.sin(a) * r }; }
  const setVisibility = fn => { visibleCb = fn; };
  // A spawn point the player CANNOT currently see, so a mob is never watched "popping into existence".
  // First guess is the rear arc (behind the view axis); each retry pushes further out and re-jitters,
  // and we verify against the real camera frustum. Falls back to straight-behind-and-far.
  function outOfSight(min, max) {
    const back = Math.atan2(-pvz, -pvx);                 // direction opposite where the player looks
    for (let i = 0; i < 16; i++) {
      const r = min + Math.random() * (max - min) + i * 2;
      const a = back + (Math.random() - 0.5) * 2.0;      // ±57° jitter within the rear arc
      const x = px + Math.cos(a) * r, z = pz + Math.sin(a) * r;
      if (!visibleCb || !visibleCb(x, z)) return { x, z };
    }
    const r = max + 12;
    return { x: px + Math.cos(back) * r, z: pz + Math.sin(back) * r };
  }
  const penPoint = h => { const a = Math.random() * Math.PI * 2, r = Math.random() * h.r * 0.8; return { x: h.x + Math.cos(a) * r, z: h.z + Math.sin(a) * r }; };

  const mobGround = (x, z) => (Voxel.surfaceY ? Voxel.surfaceY(Math.floor(x), Math.floor(z)) : 1);
  // blocked if the destination is a wall the mob can't step onto (>1 taller than here) or its body clips a block
  function blocked(x, z, fromY) {
    const g = mobGround(x, z);
    if (g - (fromY || 1) > 1.01) return true;                    // ledge/wall too tall
    return Voxel.solidAt(Math.floor(x), Math.round(g) + 1, Math.floor(z)); // head-height obstruction
  }

  function place(e, p) {
    e.x = p.x; e.z = p.z; e.dir = Math.random() * Math.PI * 2;
    e.timer = Math.random() * 3; e.flash = 0; e.fuse = 0; e.cool = 0; e.pop = 0; e.tp = 5 + Math.random() * 8;
    e.dying = false; e.dieT = 0;
    e.hp = e.type === "enderman" ? 6 : e.type === "horse" ? 5 : e.type === "spider" ? 4 : e.hostile ? 4 : 3;
    e.mats.forEach(m => { m.transparent = false; m.opacity = 1; });
    e.group.rotation.set(0, e.dir, 0); e.group.position.set(e.x, mobGround(e.x, e.z), e.z); e.group.scale.setScalar(0.05); e.group.visible = true;
  }

  // pull a representative color for the poof particles
  function mobColor(e) { const m = e.mats.find(m => m.color); return m ? m.color.getHex() : 0xffffff; }

  function poof(e) {
    if (!sceneRef) return;
    const color = mobColor(e), base = e.group.position.y;
    for (let i = 0; i < 12; i++) {
      const s = 0.1 + Math.random() * 0.14;
      const m = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), new THREE.MeshLambertMaterial({ color, transparent: true, opacity: 1 }));
      m.position.set(e.x + (Math.random() - 0.5) * 0.4, base + 0.1 + Math.random() * 0.9, e.z + (Math.random() - 0.5) * 0.4);
      const a = Math.random() * Math.PI * 2, sp = 1.5 + Math.random() * 2.2;
      m.userData = { vx: Math.cos(a) * sp, vy: 2 + Math.random() * 2.5, vz: Math.sin(a) * sp, life: 0.6 + Math.random() * 0.25, max: 0.85, floor: base };
      sceneRef.add(m); poofs.push(m);
    }
  }

  // begin the vanishing animation; the mob reappears fresh elsewhere afterwards
  function kill(e) { if (e.dying) return; e.dying = true; e.dieT = 0; e.mats.forEach(m => { m.transparent = true; }); poof(e); }

  function updatePoofs(dt) {
    for (let i = poofs.length - 1; i >= 0; i--) {
      const p = poofs[i], u = p.userData;
      u.life -= dt; u.vy -= 9 * dt;
      p.position.x += u.vx * dt; p.position.y += u.vy * dt; p.position.z += u.vz * dt;
      p.rotation.x += dt * 6; p.rotation.y += dt * 5;
      p.material.opacity = Math.max(0, u.life / u.max);
      const fl = u.floor || 1; if (p.position.y < fl) { p.position.y = fl; u.vy *= -0.4; }
      if (u.life <= 0) { sceneRef.remove(p); p.geometry.dispose(); p.material.dispose(); poofs.splice(i, 1); }
    }
  }
  const setFlash = (e, on) => e.mats.forEach(m => m.emissive && m.emissive.setHex(on ? 0x772222 : 0x000000));

  function spawn(scene, spawns) {
    spawnsRef = spawns; sceneRef = scene;
    const kinds = ["cow", "pig", "villager", "sheep", "horse", "spider", "cow", "calf", "villager", "chicken", "zombie", "cow", "sheep", "creeper", "pig", "villager", "horse", "cow", "calf", "spider", "sheep", "enderman", "pig", "chicken", "villager", "creeper", "sheep", "pig", "chicken", "zombie", "cow", "villager"];
    spawns.forEach((p, i) => { const e = Entities.makeMob(kinds[i % kinds.length]); place(e, p); scene.add(e.group); list.push(e); });
  }
  // resident farm animals: peaceful only, leashed to a home point so the pen is never empty
  function spawnPen(scene, center, radius, count) {
    if (!sceneRef) sceneRef = scene;
    const farm = ["cow", "pig", "sheep", "chicken", "calf", "pig", "sheep", "chicken"];
    for (let i = 0; i < count; i++) {
      const e = Entities.makeMob(farm[i % farm.length]);
      e.home = { x: center.x, z: center.z, r: radius };
      e.speed = Math.min(e.speed, 1.1);                     // graze slowly, stay put
      place(e, penPoint(e.home));
      scene.add(e.group); list.push(e);
    }
  }
  // resident villagers: leashed to the village square so it always feels inhabited
  function spawnVillagers(scene, center, radius, count) {
    if (!sceneRef) sceneRef = scene;
    for (let i = 0; i < count; i++) {
      const e = Entities.makeMob("villager");
      e.home = { x: center.x, z: center.z, r: radius };
      e.speed = Math.min(e.speed, 0.8);                     // amble slowly around the village
      place(e, penPoint(e.home));
      scene.add(e.group); list.push(e);
    }
  }
  function setHandlers(h) { handlers = Object.assign(handlers, h); }

  function explode(e) {
    handlers.onExplode(e.x, e.z);
    for (const o of list) { if (o === e || o.dying) continue; const d = Math.hypot(o.x - e.x, o.z - e.z); if (d < 4.5) { o.hp -= 3; o.x += (o.x - e.x) / (d || 1) * 2.2; o.z += (o.z - e.z) / (d || 1) * 2.2; o.flash = 0.3; setFlash(o, true); if (o.hp <= 0) kill(o); } }
    setFlash(e, false); place(e, outOfSight(34, 52));
  }

  function update(dt, t, player) {
    px = player.x; pz = player.z;
    if (player.vx !== undefined) { const m = Math.hypot(player.vx, player.vz); if (m > 0.001) { pvx = player.vx / m; pvz = player.vz / m; } }
    updatePoofs(dt);
    for (const e of list) {
      if (e.dying) {                                  // shrink + spin + fade, then respawn fresh
        e.dieT += dt; const k = Math.min(1, e.dieT / 0.45);
        e.group.scale.setScalar(0.1 + 0.9 * (1 - k) * (e.pop || 1));
        e.group.rotation.y += dt * 12;
        e.mats.forEach(m => { m.opacity = 1 - k; });
        if (k >= 1) place(e, e.home ? penPoint(e.home) : outOfSight(34, 54));
        continue;
      }
      if (!e.home && Math.hypot(e.x - px, e.z - pz) > 115) place(e, outOfSight(34, 55)); // penned animals never wander off
      if (e.pop < 1) { e.pop = Math.min(1, e.pop + dt * 3); e.group.scale.setScalar(0.1 + 0.9 * e.pop); }

      const dpx = px - e.x, dpz = pz - e.z, pd = Math.hypot(dpx, dpz) || 0.001;
      let moving = 1;

      if (e.type === "enderman") { e.tp -= dt; if (e.tp <= 0) { const p = outOfSight(16, 30); e.x = p.x; e.z = p.z; e.tp = 6 + Math.random() * 8; e.pop = 0; } }
      if (e.hostile && pd < 14 && pd > 1.0) e.dir = Math.atan2(dpx, dpz);
      else { e.timer -= dt; if (e.timer <= 0) { e.dir += (Math.random() - 0.5) * 2.2; e.timer = 1 + Math.random() * 3; if (Math.random() < 0.3) moving = 0; } }
      if (e.home && Math.hypot(e.x - e.home.x, e.z - e.home.z) > e.home.r) e.dir = Math.atan2(e.home.x - e.x, e.home.z - e.z); // leash: steer back into the pen

      if (e.explodes) {
        if (pd < 3.1) { e.fuse += dt; setFlash(e, Math.sin(e.fuse * 22) > 0); e.group.scale.setScalar((0.1 + 0.9 * e.pop) * (1 + Math.min(0.6, e.fuse * 0.4))); if (e.fuse >= 1.4) { explode(e); continue; } }
        else if (e.fuse > 0) { e.fuse = Math.max(0, e.fuse - dt); if (e.fuse === 0) setFlash(e, false); }
      }

      const vx = Math.sin(e.dir) * e.speed, vz = Math.cos(e.dir) * e.speed, nx = e.x + vx * dt, nz = e.z + vz * dt;
      const here = mobGround(e.x, e.z), pgap = e.rad + PLAYER_SEP;
      if (!blocked(nx, e.z, here) && Math.hypot(nx - px, e.z - pz) > pgap) e.x = nx; else e.dir += 1.6;
      if (!blocked(e.x, nz, here) && Math.hypot(e.x - px, nz - pz) > pgap) e.z = nz; else e.dir += 1.6;
      const gy = mobGround(e.x, e.z);
      e.group.position.set(e.x, e.group.position.y + (gy - e.group.position.y) * Math.min(1, dt * 10), e.z); // glide onto terrain height
      e.group.rotation.y = e.dir; e.update(t, moving);

      e.cool -= dt;
      if (e.hostile && !e.explodes && pd < 1.2 && e.cool <= 0) { handlers.onPlayerHit(e.type === "zombie" ? 8 : 5); e.cool = 0.7; }
      if (e.flash > 0 && !(e.explodes && e.fuse > 0)) { e.flash -= dt; if (e.flash <= 0) setFlash(e, false); }
    }
    separate();
  }

  // push apart any two bodies (mob↔mob, mob↔player) that ended the frame overlapping, so nothing ever
  // interpenetrates or "glitches" when they crowd. Gaps are the SUM of the two footprint radii, and a
  // few relaxation passes keep even tight clusters stable (a bigger horse doesn't get shoved into a fence).
  function separate() {
    for (let pass = 0; pass < 3; pass++) {
      for (let i = 0; i < list.length; i++) {
        const a = list[i]; if (a.dying) continue;
        const ga = mobGround(a.x, a.z);
        // mob vs mob
        for (let j = i + 1; j < list.length; j++) {
          const b = list[j]; if (b.dying) continue;
          const gap = a.rad + b.rad;
          let dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz);
          if (d < gap && d > 0.0001) {
            const push = (gap - d) / 2, ix = dx / d, iz = dz / d;
            if (!blocked(a.x - ix * push, a.z - iz * push, ga)) { a.x -= ix * push; a.z -= iz * push; }
            if (!blocked(b.x + ix * push, b.z + iz * push, mobGround(b.x, b.z))) { b.x += ix * push; b.z += iz * push; }
          } else if (d <= 0.0001) { a.x += (Math.random() - 0.5) * 0.2; a.z += (Math.random() - 0.5) * 0.2; }
        }
        // mob vs player — shove the mob out so the camera/hero never clips through it
        const pgap = a.rad + PLAYER_SEP;
        let dpx = a.x - px, dpz = a.z - pz, dp = Math.hypot(dpx, dpz);
        if (dp < pgap && dp > 0.0001) { const ix = dpx / dp, iz = dpz / dp, nx = px + ix * pgap, nz = pz + iz * pgap; if (!blocked(nx, nz, ga)) { a.x = nx; a.z = nz; } }
      }
    }
    // commit resolved positions and settle each body exactly onto its ground column (never sink in)
    for (const a of list) {
      if (a.dying) continue;
      const gy = mobGround(a.x, a.z);
      a.group.position.x = a.x; a.group.position.z = a.z;
      a.group.position.y += (gy - a.group.position.y) * 0.5;
    }
  }

  function hit(hx, hz, dirX, dirZ) {
    let any = false;
    for (const e of list) {
      if (e.dying) continue;
      const dx = e.x - hx, dz = e.z - hz, d = Math.hypot(dx, dz) || 0.001;
      if (d < 2.6 && ((dx / d) * dirX + (dz / d) * dirZ > 0.15 || d < 1.3)) {
        e.hp -= 2; e.flash = 0.25; setFlash(e, true); any = true;
        e.x += (dx / d) * 1.2; e.z += (dz / d) * 1.2; e.group.position.set(e.x, mobGround(e.x, e.z), e.z);
        if (e.hp <= 0) { setFlash(e, false); if (e.explodes) explode(e); else kill(e); }
      }
    }
    return any;
  }

  return { spawn, spawnPen, spawnVillagers, update, hit, setHandlers, setVisibility, list };
})();
