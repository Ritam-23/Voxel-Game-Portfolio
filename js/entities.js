/* ============================================================================
   ENTITIES — heroes, held weapons, mobs, floating gems, and portal planes.
   ========================================================================== */
window.Entities = (() => {

  const SKINS = {
    he:  { skin: "#c98e5b", hair: "#3b2a1a", shirt: "#1c9c9c", pants: "#39418f", long: false },
    she: { skin: "#f2c39a", hair: "#c1651f", shirt: "#4f9a3c", pants: "#57576a", long: true },
  };
  const mat = c => new THREE.MeshLambertMaterial({ color: c });
  const box = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);

  function faceTexture(skin, eyeColor = "#33241c", mouth = "#a75b4a") {
    const cv = document.createElement("canvas"); cv.width = cv.height = 16;
    const c = cv.getContext("2d");
    c.fillStyle = skin; c.fillRect(0, 0, 16, 16);
    c.fillStyle = "#fff"; c.fillRect(3, 6, 3, 3); c.fillRect(10, 6, 3, 3);
    c.fillStyle = eyeColor; c.fillRect(4, 7, 2, 2); c.fillRect(11, 7, 2, 2);
    c.fillStyle = "#5a3a22"; c.fillRect(3, 5, 3, 1); c.fillRect(10, 5, 3, 1);
    c.fillStyle = mouth; c.fillRect(6, 11, 4, 1);
    const t = new THREE.CanvasTexture(cv);
    t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
    if (THREE.sRGBEncoding) t.encoding = THREE.sRGBEncoding;
    return t;
  }

  // friendly animal face: eyes on the head's front (+Z), optional nostrils / mouth
  function animalFace(base, opts = {}) {
    const cv = document.createElement("canvas"); cv.width = cv.height = 16;
    const c = cv.getContext("2d");
    c.fillStyle = base; c.fillRect(0, 0, 16, 16);
    const eye = opts.eye || "#1a1410";
    c.fillStyle = "#fff"; c.fillRect(3, 5, 3, 3); c.fillRect(10, 5, 3, 3);   // sclera
    c.fillStyle = eye; c.fillRect(4, 6, 2, 2); c.fillRect(11, 6, 2, 2);      // pupils
    if (opts.nostril) { c.fillStyle = opts.nostril; c.fillRect(5, 11, 2, 2); c.fillRect(9, 11, 2, 2); }
    if (opts.mouth) { c.fillStyle = opts.mouth; c.fillRect(6, 12, 4, 1); }
    const t = new THREE.CanvasTexture(cv);
    t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
    if (THREE.sRGBEncoding) t.encoding = THREE.sRGBEncoding;
    return t;
  }

  function limb(w, h, d, m, px, pivotY) {
    const g = new THREE.Group(); g.position.set(px, pivotY, 0);
    const b = box(w, h, d, m); b.position.y = -h / 2; g.add(b); return g;
  }

  /* ------------------------------- heroes ------------------------------- */
  function buildCharacter(kind) {
    const s = SKINS[kind];
    const group = new THREE.Group();
    const skinM = mat(s.skin), shirtM = mat(s.shirt), pantsM = mat(s.pants), hairM = mat(s.hair);

    const legL = limb(0.24, 0.75, 0.24, pantsM, -0.13, 0.75);
    const legR = limb(0.24, 0.75, 0.24, pantsM, 0.13, 0.75);
    const shoeL = box(0.26, 0.14, 0.3, hairM); shoeL.position.set(0, -0.34, 0.03); legL.children[0].add(shoeL);
    const shoeR = box(0.26, 0.14, 0.3, hairM); shoeR.position.set(0, -0.34, 0.03); legR.children[0].add(shoeR);

    const body = box(0.5, 0.75, 0.26, shirtM); body.position.y = 1.125;
    const armL = limb(0.22, 0.72, 0.22, shirtM, -0.37, 1.5);
    const armR = limb(0.22, 0.72, 0.22, shirtM, 0.37, 1.5);
    const handL = box(0.24, 0.18, 0.24, skinM); handL.position.set(0, -0.36, 0); armL.children[0].add(handL);
    const handR = box(0.24, 0.18, 0.24, skinM); handR.position.set(0, -0.36, 0); armR.children[0].add(handR);

    const faceM = new THREE.MeshLambertMaterial({ map: faceTexture(s.skin) });
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), [skinM, skinM, skinM, skinM, faceM, skinM]);
    head.position.y = 1.78;
    const hairTop = box(0.54, 0.14, 0.54, hairM); hairTop.position.y = 2.0; group.add(hairTop);
    const hairBack = box(0.54, 0.4, 0.12, hairM); hairBack.position.set(0, 1.85, -0.22); group.add(hairBack);
    if (s.long) { const p = box(0.34, 0.7, 0.14, hairM); p.position.set(0, 1.5, -0.24); group.add(p); }

    group.add(legL, legR, body, armL, armR, head);
    group.scale.setScalar(0.9);                       // a touch shorter — closer to Minecraft proportions
    const parts = { legL, legR, body, armL, armR, head };
    return {
      group, parts,
      update(t, moveAmount, swing) {
        const s2 = Math.sin(t * 11) * 0.6 * moveAmount;
        legL.rotation.x = s2; legR.rotation.x = -s2;
        armL.rotation.x = -s2;
        if (!swing) armR.rotation.x = s2 - 0.5;   // weapon arm bent forward, held in front
        armL.rotation.z = 0.06; armR.rotation.z = -0.06;
        head.position.y = 1.78 + Math.abs(Math.sin(t * 11)) * 0.03 * moveAmount;
      },
    };
  }

  // villager face: warm tan skin, heavy dark unibrow, calm green eyes (nose is a separate 3D box)
  function villagerFace() {
    const cv = document.createElement("canvas"); cv.width = cv.height = 16;
    const c = cv.getContext("2d");
    c.fillStyle = "#a8814f"; c.fillRect(0, 0, 16, 16);
    c.fillStyle = "#6a4f34"; c.fillRect(0, 8, 16, 8);                          // darker jaw/beard shading
    c.fillStyle = "#2e2114"; c.fillRect(2, 4, 12, 2);                          // heavy unibrow
    c.fillStyle = "#fff"; c.fillRect(3, 6, 3, 3); c.fillRect(10, 6, 3, 3);     // sclera
    c.fillStyle = "#39a35d"; c.fillRect(4, 7, 2, 2); c.fillRect(11, 7, 2, 2);  // green eyes
    c.fillStyle = "#5a4229"; c.fillRect(6, 13, 4, 1);                          // mouth line
    const t = new THREE.CanvasTexture(cv);
    t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
    if (THREE.sRGBEncoding) t.encoding = THREE.sRGBEncoding;
    return t;
  }

  // the contact greeter: a Minecraft plains-villager (brown robe, big protruding nose, arms crossed)
  function buildVillager() {
    const group = new THREE.Group();
    const robeM = mat("#7c6142"), robeD = mat("#5f4a30"), innerM = mat("#4a3826"), skinM = mat("#a8814f"), footM = mat("#4a3a28"), browM = mat("#2e2114");

    // feet peeking out beneath the robe
    const footL = box(0.22, 0.34, 0.26, footM); footL.position.set(-0.13, 0.17, 0.02);
    const footR = box(0.22, 0.34, 0.26, footM); footR.position.set(0.13, 0.17, 0.02);
    // lower robe (brown) with a darker inner garment showing down the front
    const skirt = box(0.64, 0.9, 0.44, robeM); skirt.position.y = 0.8;
    const inner = box(0.30, 0.74, 0.02, innerM); inner.position.set(0, 0.72, 0.225);
    // upper robe / chest
    const chest = box(0.56, 0.55, 0.38, robeM); chest.position.y = 1.5;
    // subtle darker robe seam down the front + a collar trim (brown, like the plains robe)
    const sashV = box(0.14, 1.05, 0.02, robeD); sashV.position.set(0, 1.24, 0.23);
    const collar = box(0.58, 0.13, 0.40, robeD); collar.position.y = 1.78;
    // crossed arms folded across the belly (signature villager pose), robe sleeves + skin hands
    const armTop = box(0.5, 0.2, 0.22, robeM); armTop.position.set(-0.02, 1.3, 0.25); armTop.rotation.z = 0.09;
    const armBot = box(0.5, 0.2, 0.22, robeM); armBot.position.set(0.02, 1.11, 0.27); armBot.rotation.z = -0.09;
    const handA = box(0.16, 0.18, 0.2, skinM); handA.position.set(0.25, 1.26, 0.28);
    const handB = box(0.16, 0.18, 0.2, skinM); handB.position.set(-0.25, 1.13, 0.3);
    // head, BIG protruding nose, bald brow ridge
    const faceM = new THREE.MeshLambertMaterial({ map: villagerFace() });
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.54, 0.5), [skinM, skinM, skinM, skinM, faceM, skinM]);
    head.position.y = 2.12;
    const nose = box(0.18, 0.34, 0.28, skinM); nose.position.set(0, 2.04, 0.34);
    const brow = box(0.52, 0.1, 0.52, browM); brow.position.y = 2.4;
    group.add(footL, footR, skirt, inner, chest, sashV, collar, armTop, armBot, handA, handB, head, nose, brow);
    const hy = head.position.y, ny = nose.position.y;
    return {
      group, parts: { head },
      update(t) { const b = Math.sin(t * 2) * 0.02; head.position.y = hy + b; nose.position.y = ny + b; }, // gentle idle breathing
    };
  }

  // a WALKING villager rig for the world roster (legs animate via the mob walk cycle).
  // Same look as the static greeter, but built to the mob contract { group, mats, legs }.
  function villagerRig() {
    const group = new THREE.Group(); const mats = [];
    const M = c => { const m = mat(c); mats.push(m); return m; };
    const robeC = "#7c6142", trimC = "#5f4a30", innerC = "#4a3826", skinC = "#a8814f", footC = "#4a3a28";
    // two legs (pivot at hip so the walk swing reads) — short, hidden under the robe hem
    const legL = limb(0.2, 0.42, 0.26, M(footC), -0.13, 0.42);
    const legR = limb(0.2, 0.42, 0.26, M(footC), 0.13, 0.42);
    // lower robe + inner garment
    const skirt = box(0.62, 0.78, 0.44, M(robeC)); skirt.position.y = 0.82; group.add(skirt);
    const inner = box(0.28, 0.66, 0.02, M(innerC)); inner.position.set(0, 0.78, 0.225); group.add(inner);
    // chest + darker robe seam + collar
    const chest = box(0.56, 0.5, 0.38, M(robeC)); chest.position.y = 1.42; group.add(chest);
    const sashV = box(0.14, 0.98, 0.02, M(trimC)); sashV.position.set(0, 1.2, 0.23); group.add(sashV);
    const collar = box(0.58, 0.13, 0.4, M(trimC)); collar.position.y = 1.68; group.add(collar);
    // crossed arms across the belly (signature villager pose)
    const armTop = box(0.5, 0.2, 0.22, M(robeC)); armTop.position.set(-0.02, 1.24, 0.25); armTop.rotation.z = 0.09; group.add(armTop);
    const armBot = box(0.5, 0.2, 0.22, M(robeC)); armBot.position.set(0.02, 1.05, 0.27); armBot.rotation.z = -0.09; group.add(armBot);
    const handA = box(0.16, 0.18, 0.2, M(skinC)); handA.position.set(0.25, 1.2, 0.28); group.add(handA);
    const handB = box(0.16, 0.18, 0.2, M(skinC)); handB.position.set(-0.25, 1.07, 0.3); group.add(handB);
    // head + BIG nose + unibrow ridge; face on +Z (front)
    const faceM = new THREE.MeshLambertMaterial({ map: villagerFace() }); mats.push(faceM);
    const skinM = M(skinC);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.54, 0.5), [skinM, skinM, skinM, skinM, faceM, skinM]);
    head.position.y = 2.0; group.add(head);
    const nose = box(0.18, 0.34, 0.28, M(skinC)); nose.position.set(0, 1.92, 0.34); group.add(nose);
    const brow = box(0.52, 0.1, 0.52, M("#2e2114")); brow.position.y = 2.28; group.add(brow);
    group.add(legL, legR);
    return { group, mats, legs: [legL, legR], walkFreq: 5, walkAmp: 0.42 };
  }

  /* ------------------------------ weapons ------------------------------- */
  function buildWeapon(kind) {
    const g = new THREE.Group();
    const wood = mat("#6b4326"), steel = mat("#d3d8e2"), steelDk = mat("#9aa1b0"), gold = mat("#f0c64a");
    if (kind === "axe") {
      const h = box(0.06, 0.82, 0.06, wood); h.position.y = 0.4; g.add(h);
      const blade = box(0.10, 0.34, 0.30, steel); blade.position.set(0.13, 0.66, 0); g.add(blade);      // wide bit
      const edge = box(0.05, 0.40, 0.36, steelDk); edge.position.set(0.20, 0.66, 0); g.add(edge);        // cutting edge
      const knob = box(0.09, 0.09, 0.09, steelDk); knob.position.set(0, 0.86, 0); g.add(knob);           // top
    } else { // sword
      const pommel = box(0.10, 0.08, 0.10, gold); pommel.position.y = 0.02; g.add(pommel);
      const handle = box(0.07, 0.22, 0.07, wood); handle.position.y = 0.16; g.add(handle);
      const guard = box(0.34, 0.07, 0.10, gold); guard.position.y = 0.30; g.add(guard);
      const blade = box(0.11, 0.58, 0.035, steel); blade.position.y = 0.62; g.add(blade);
      const fuller = box(0.03, 0.5, 0.05, steelDk); fuller.position.y = 0.60; g.add(fuller);              // center groove
      const tip = box(0.11, 0.12, 0.035, steel); tip.position.y = 0.93; tip.rotation.z = Math.PI / 4; tip.scale.set(0.7, 0.7, 1); g.add(tip);
    }
    // gripped in the fist: origin dropped to the hand, blade angled up-forward
    g.rotation.x = 1.15; g.position.set(0, -0.72, 0.16);
    return g;
  }

  function creeperFace() {
    const cv = document.createElement("canvas"); cv.width = cv.height = 16; const c = cv.getContext("2d");
    c.fillStyle = "#4f9a3c"; c.fillRect(0, 0, 16, 16);
    for (let x = 0; x < 16; x++) for (let y = 0; y < 16; y++) if (((x * 7 + y * 13) % 5) === 0) { c.fillStyle = (x + y) % 2 ? "#458c34" : "#59a846"; c.fillRect(x, y, 1, 1); }
    c.fillStyle = "#0e1a0d";
    c.fillRect(3, 4, 3, 3); c.fillRect(10, 4, 3, 3);          // eyes
    c.fillRect(6, 7, 4, 4); c.fillRect(5, 11, 2, 3); c.fillRect(9, 11, 2, 3);  // mouth
    const t = new THREE.CanvasTexture(cv); t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; if (THREE.sRGBEncoding) t.encoding = THREE.sRGBEncoding; return t;
  }
  function creeperRig() {
    const group = new THREE.Group(); const mats = [];
    const M = c => { const m = mat(c); mats.push(m); return m; };
    const green = "#4f9a3c", legC = "#3f7a30", legH = 0.32;
    const body = box(0.56, 1.0, 0.3, M(green)); body.position.y = legH + 0.5; group.add(body);
    const faceM = new THREE.MeshLambertMaterial({ map: creeperFace() }); mats.push(faceM);
    const gM = M(green);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), [gM, gM, gM, gM, faceM, gM]); head.position.y = legH + 1.0 + 0.3; group.add(head);
    const legs = [];
    [[-1, 1], [1, 1], [-1, -1], [1, -1]].forEach(([sx, sz]) => { const l = limb(0.24, legH, 0.24, M(legC), sx * 0.16, legH); l.position.z = sz * 0.12; group.add(l); legs.push(l); });
    return { group, mats, legs };
  }

  /* ------------------------------- mobs --------------------------------- */
  function quad(bodyC, headC, legC, opts = {}) {
    const group = new THREE.Group();
    const mats = [];
    const M = c => { const m = mat(c); mats.push(m); return m; };
    const bw = opts.bw || 0.7, bh = opts.bh || 0.55, bd = opts.bd || 1.0, legH = opts.legH || 0.4;
    const body = box(bw, bh, bd, M(bodyC)); body.position.y = legH + bh / 2; group.add(body);
    const headM = M(headC);
    const faceM = new THREE.MeshLambertMaterial({ map: animalFace(headC, opts.face || {}) }); mats.push(faceM);
    const head = new THREE.Mesh(new THREE.BoxGeometry(bw * 0.8, bh * 0.9, 0.5), [headM, headM, headM, headM, faceM, headM]);
    head.position.set(0, legH + bh, bd / 2 + 0.1); group.add(head);   // face on +Z (front)
    if (opts.snout) { const sn = box(0.28, 0.22, 0.12, M(opts.snout)); sn.position.set(0, legH + bh - 0.05, bd / 2 + 0.36); group.add(sn); }
    const legs = [];
    [[-1, 1], [1, 1], [-1, -1], [1, -1]].forEach(([sx, sz]) => {
      const l = limb(0.18, legH, 0.18, M(legC), sx * (bw / 2 - 0.09), legH);
      l.position.z = sz * (bd / 2 - 0.12); group.add(l); legs.push(l);
    });
    return { group, mats, legs, headMesh: head };
  }

  function biped(skinC, shirtC, legC, faceEyes) {
    const group = new THREE.Group(); const mats = [];
    const M = c => { const m = mat(c); mats.push(m); return m; };
    const legL = limb(0.22, 0.72, 0.22, M(legC), -0.12, 0.72);
    const legR = limb(0.22, 0.72, 0.22, M(legC), 0.12, 0.72);
    const body = box(0.48, 0.72, 0.26, M(shirtC)); body.position.y = 1.08; group.add(body);
    const armL = limb(0.2, 0.7, 0.2, M(skinC), -0.35, 1.44);
    const armR = limb(0.2, 0.7, 0.2, M(skinC), 0.35, 1.44);
    armL.rotation.x = -1.4; armR.rotation.x = -1.4;               // arms out front (zombie)
    const faceM = new THREE.MeshLambertMaterial({ map: faceTexture(skinC, faceEyes || "#101810", "#0c140c") });
    const skinM = M(skinC);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), [skinM, skinM, skinM, skinM, faceM, skinM]);
    head.position.y = 1.7; group.add(legL, legR, armL, armR, head);
    return { group, mats, legs: [legL, legR], arms: [armL, armR] };
  }

  function enderman() {
    const group = new THREE.Group(); const mats = [];
    const M = c => { const m = mat(c); mats.push(m); return m; };
    const black = "#141419";
    const legL = limb(0.16, 1.3, 0.16, M(black), -0.12, 1.3);
    const legR = limb(0.16, 1.3, 0.16, M(black), 0.12, 1.3);
    const body = box(0.4, 0.72, 0.22, M(black)); body.position.y = 1.66; group.add(body);
    const armL = limb(0.15, 1.2, 0.15, M(black), -0.3, 2.0);
    const armR = limb(0.15, 1.2, 0.15, M(black), 0.3, 2.0);
    const faceM = new THREE.MeshLambertMaterial({ map: faceTexture(black, "#c46bff", "#7a3ad0") });
    const skinM = M(black);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.46, 0.46), [skinM, skinM, skinM, skinM, faceM, skinM]);
    head.position.y = 2.5; group.add(legL, legR, armL, armR, head);
    return { group, mats, legs: [legL, legR] };
  }

  // spider: two body segments, 8 splayed legs, red eyes, low + fast
  function spiderRig() {
    const group = new THREE.Group(); const mats = [];
    const M = c => { const m = mat(c); mats.push(m); return m; };
    const bodyC = "#2b2320", legC = "#1f1a18", legH = 0.34;
    const ceph = box(0.42, 0.3, 0.42, M(bodyC)); ceph.position.set(0, legH + 0.15, 0.28); group.add(ceph);   // front
    const abdo = box(0.62, 0.46, 0.62, M(bodyC)); abdo.position.set(0, legH + 0.22, -0.3); group.add(abdo);  // rear
    const eyeM = new THREE.MeshBasicMaterial({ color: 0xff3b3b }); mats.push(eyeM);
    [-0.1, 0.1].forEach(ex => { const e = box(0.07, 0.07, 0.05, eyeM); e.position.set(ex, legH + 0.2, 0.5); group.add(e); });
    const legs = [];
    [-1, 1].forEach(side => [0.34, 0.12, -0.1, -0.32].forEach(lz => {
      const l = limb(0.09, legH + 0.18, 0.09, M(legC), side * 0.26, legH + 0.16);
      l.position.z = lz; l.rotation.z = side * 0.7;              // splay outward; walk swings rotation.x
      group.add(l); legs.push(l);
    }));
    return { group, mats, legs, walkFreq: 13, walkAmp: 0.35 };
  }
  // horse: tall quad with rising neck, head, mane, swaying tail
  function horseRig() {
    const group = new THREE.Group(); const mats = [];
    const M = c => { const m = mat(c); mats.push(m); return m; };
    const coat = "#6b4a2c", dark = "#4a3320", mane = "#2e2013", legH = 0.7;
    const body = box(0.6, 0.62, 1.2, M(coat)); body.position.y = legH + 0.4; group.add(body);
    const neck = box(0.34, 0.72, 0.34, M(coat)); neck.position.set(0, legH + 0.82, 0.6); neck.rotation.x = -0.5; group.add(neck);
    const head = box(0.3, 0.34, 0.58, M(coat)); head.position.set(0, legH + 1.16, 0.94); group.add(head);
    const snout = box(0.26, 0.26, 0.22, M(dark)); snout.position.set(0, legH + 1.06, 1.18); group.add(snout);
    const eyeM = new THREE.MeshLambertMaterial({ color: 0x14100c }); mats.push(eyeM);   // eyes on both cheeks
    [-1, 1].forEach(sx => { const e = box(0.05, 0.09, 0.09, eyeM); e.position.set(sx * 0.16, legH + 1.24, 1.02); group.add(e); });
    const maneB = box(0.12, 0.72, 0.34, M(mane)); maneB.position.set(0, legH + 0.86, 0.5); maneB.rotation.x = -0.5; group.add(maneB);
    const tail = new THREE.Group(); tail.position.set(0, legH + 0.56, -0.64); tail.rotation.x = 0.4; tail.userData.baseX = 0.4;
    const tailB = box(0.14, 0.6, 0.14, M(mane)); tailB.position.y = -0.3; tail.add(tailB); group.add(tail);
    const legs = [];
    [[-1, 1], [1, 1], [-1, -1], [1, -1]].forEach(([sx, sz]) => { const l = limb(0.2, legH, 0.2, M(dark), sx * 0.22, legH); l.position.z = sz * 0.46; group.add(l); legs.push(l); });
    return { group, mats, legs, tail, walkFreq: 7, walkAmp: 0.42 };
  }
  // chicken: small, beak/comb/wattle, flapping wings, 2 skinny legs
  function chickenRig() {
    const group = new THREE.Group(); const mats = [];
    const M = c => { const m = mat(c); mats.push(m); return m; };
    const bodyC = "#eeeeee", beakC = "#e6a12c", combC = "#d63b3b", legH = 0.24;
    const torso = box(0.34, 0.4, 0.46, M(bodyC)); torso.position.y = legH + 0.28; group.add(torso);
    const head = box(0.28, 0.3, 0.28, M(bodyC)); head.position.set(0, legH + 0.64, 0.14); group.add(head);
    const beak = box(0.14, 0.1, 0.16, M(beakC)); beak.position.set(0, legH + 0.6, 0.34); group.add(beak);
    const eyeM = new THREE.MeshLambertMaterial({ color: 0x14100c }); mats.push(eyeM);   // beady eyes
    [-1, 1].forEach(sx => { const e = box(0.05, 0.06, 0.06, eyeM); e.position.set(sx * 0.1, legH + 0.68, 0.27); group.add(e); });
    const comb = box(0.1, 0.12, 0.22, M(combC)); comb.position.set(0, legH + 0.82, 0.12); group.add(comb);
    const wattle = box(0.08, 0.12, 0.08, M(combC)); wattle.position.set(0, legH + 0.5, 0.3); group.add(wattle);
    const wings = [];
    [-1, 1].forEach(side => { const w = new THREE.Group(); w.position.set(side * 0.18, legH + 0.36, 0); const wb = box(0.06, 0.28, 0.4, M(bodyC)); wb.position.y = -0.1; w.add(wb); group.add(w); wings.push(w); });
    const legs = [];
    [-1, 1].forEach(side => { const l = limb(0.08, legH, 0.08, M(beakC), side * 0.1, legH); group.add(l); legs.push(l); });
    return { group, mats, legs, wings, walkFreq: 16, walkAmp: 0.6 };
  }
  // calf: a small spotted cow (reuses quad)
  function calfRig() {
    const r = quad("#8a7355", "#6b5744", "#5a4634", { bw: 0.5, bd: 0.68, bh: 0.42, legH: 0.28 });
    const spotM = new THREE.MeshLambertMaterial({ color: 0xf0ece2 }); r.mats.push(spotM);
    const bodyY = 0.28 + 0.21;
    [[0.26, 0.06, 0.08], [-0.26, -0.05, -0.12], [0.26, -0.14, 0.14]].forEach(([sx, sy, sz]) => { const s = box(0.03, 0.16, 0.18, spotM); s.position.set(sx, bodyY + sy, sz); r.group.add(s); });
    r.walkFreq = 12; r.walkAmp = 0.45;
    return r;
  }

  // approximate ground footprint radius per mob (used for body-vs-body / body-vs-player separation)
  const MOB_RAD = { pig: 0.5, cow: 0.55, sheep: 0.5, calf: 0.36, horse: 0.62, chicken: 0.28, villager: 0.36, polarbear: 0.68, spider: 0.5, zombie: 0.34, creeper: 0.4, enderman: 0.34 };
  function makeMob(type) {
    let rig, hostile = false, speed = 1.1, explodes = false;
    if (type === "pig") rig = quad("#e59aa5", "#e59aa5", "#c77f8a", { snout: "#d98793", bw: 0.7, bd: 1.0, face: { eye: "#2a1c1c", nostril: "#b5606c" } });
    else if (type === "cow") rig = quad("#5a4634", "#4a3a2b", "#3f3125", { bw: 0.8, bd: 1.1, bh: 0.6, face: { eye: "#12100e", nostril: "#2e241c" } });
    else if (type === "sheep") rig = quad("#eae6df", "#d9cfc2", "#33302c", { bw: 0.85, bd: 1.0, bh: 0.7, face: { eye: "#1a1614", mouth: "#5a5450" } });
    else if (type === "calf") { rig = calfRig(); speed = 0.95; }
    else if (type === "horse") { rig = horseRig(); speed = 0.9; }
    else if (type === "chicken") { rig = chickenRig(); speed = 1.05; }
    else if (type === "villager") { rig = villagerRig(); hostile = false; speed = 0.75; }
    else if (type === "polarbear") { rig = bearRig(); hostile = false; speed = 0.8; }
    else if (type === "spider") { rig = spiderRig(); hostile = true; speed = 1.9; }
    else if (type === "zombie") { rig = biped("#4f7a3a", "#3a5f6a", "#39418f"); hostile = true; speed = 1.7; }
    else if (type === "creeper") { rig = creeperRig(); hostile = true; speed = 1.5; explodes = true; }
    else { rig = enderman(); hostile = false; speed = 1.6; }        // enderman
    const legs = rig.legs, freq = rig.walkFreq || 9, amp = rig.walkAmp != null ? rig.walkAmp : 0.5;
    return {
      type, group: rig.group, mats: rig.mats, hostile, speed, explodes, rad: MOB_RAD[type] || 0.42,
      update(t, moveAmount) {
        const ph = t * freq, a = amp * moveAmount;
        if (legs.length === 4) { const s = Math.sin(ph) * a; legs[0].rotation.x = s; legs[1].rotation.x = -s; legs[2].rotation.x = -s; legs[3].rotation.x = s; }
        else if (legs.length === 2) { const s = Math.sin(ph) * a; legs[0].rotation.x = s; legs[1].rotation.x = -s; }
        else for (let k = 0; k < legs.length; k++) legs[k].rotation.x = Math.sin(ph + k * (Math.PI / 2)) * a;  // 8-leg diagonal wave
        if (rig.wings) { const f = 0.25 + Math.abs(Math.sin(t * 16)) * 0.7; rig.wings[0].rotation.z = f; rig.wings[1].rotation.z = -f; }
        if (rig.tail) rig.tail.rotation.x = (rig.tail.userData.baseX || 0) + Math.sin(t * 3) * 0.2;
      },
    };
  }

  /* ------------------------------ flowers ------------------------------- */
  // one texture per petal colour (drawn once, shared). Transparent background + alphaTest
  // so flowers never need depth-sorted blending — cheap even in the hundreds.
  const FLOWER_COLS = ["#e2564e", "#f2d23c", "#f2f2f2", "#e88fd0", "#7aa8ff"];
  const flowerMats = [];
  function flowerTex(col) {
    const cv = document.createElement("canvas"); cv.width = cv.height = 16;
    const c = cv.getContext("2d");
    c.clearRect(0, 0, 16, 16);
    c.fillStyle = "#2f7a34"; c.fillRect(7, 8, 2, 8);                 // stem
    c.fillStyle = "#3f9a44"; c.fillRect(4, 11, 3, 2); c.fillRect(9, 10, 3, 2); // leaves
    c.fillStyle = col;                                              // 4 petals
    c.fillRect(6, 2, 4, 4); c.fillRect(3, 4, 4, 4); c.fillRect(9, 4, 4, 4); c.fillRect(6, 6, 4, 4);
    c.fillStyle = "#f7e58a"; c.fillRect(7, 4, 2, 2);                // pistil
    const t = new THREE.CanvasTexture(cv);
    t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
    if (THREE.sRGBEncoding) t.encoding = THREE.sRGBEncoding;
    return t;
  }
  function flowerMat(ci) {
    if (!flowerMats[ci]) flowerMats[ci] = new THREE.MeshBasicMaterial({ map: flowerTex(FLOWER_COLS[ci % FLOWER_COLS.length]), transparent: true, alphaTest: 0.5, side: THREE.DoubleSide });
    return flowerMats[ci];
  }
  const FLOWER_GEO = new THREE.PlaneGeometry(0.62, 0.62);
  // a small "+" of two crossed quads standing on the ground, centred at y≈0.31 above the block top
  function makeFlower(ci) {
    const g = new THREE.Group();
    const m = flowerMat(ci);
    const a = new THREE.Mesh(FLOWER_GEO, m);
    const b = new THREE.Mesh(FLOWER_GEO, m); b.rotation.y = Math.PI / 2;
    g.add(a, b); g.position.y = 0.31;
    return g;
  }
  const FLOWER_COUNT = FLOWER_COLS.length;

  /* ------------------------------ crops -------------------------------- */
  // wheat / sprout cross-sprites for the résumé farm (same cheap alpha-tested trick as flowers)
  const CROP_MATS = [];
  function cropTex(kind) {
    const cv = document.createElement("canvas"); cv.width = cv.height = 16;
    const c = cv.getContext("2d"); c.clearRect(0, 0, 16, 16);
    if (kind === 0) {                                  // tall wheat with a golden grain head
      c.fillStyle = "#4a8a3a"; c.fillRect(5, 7, 1, 9); c.fillRect(7, 6, 1, 10); c.fillRect(10, 7, 1, 9);
      c.fillStyle = "#d9b03a"; c.fillRect(4, 2, 3, 5); c.fillRect(6, 1, 3, 6); c.fillRect(9, 2, 3, 5);
      c.fillStyle = "#f0d768"; c.fillRect(6, 2, 1, 4); c.fillRect(10, 3, 1, 3);
    } else {                                           // young green sprout
      c.fillStyle = "#3f9a36"; c.fillRect(7, 7, 2, 9);
      c.fillStyle = "#6fbf4a"; c.fillRect(4, 8, 3, 2); c.fillRect(9, 6, 3, 2); c.fillRect(6, 5, 3, 3);
    }
    const t = new THREE.CanvasTexture(cv); t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
    if (THREE.sRGBEncoding) t.encoding = THREE.sRGBEncoding; return t;
  }
  function cropMat(ci) { if (!CROP_MATS[ci]) CROP_MATS[ci] = new THREE.MeshBasicMaterial({ map: cropTex(ci), transparent: true, alphaTest: 0.5, side: THREE.DoubleSide }); return CROP_MATS[ci]; }
  const CROP_GEO = new THREE.PlaneGeometry(0.82, 0.82);
  function makeCrop(ci) { const g = new THREE.Group(); const m = cropMat(ci & 1); const a = new THREE.Mesh(CROP_GEO, m), b = new THREE.Mesh(CROP_GEO, m); b.rotation.y = Math.PI / 2; g.add(a, b); g.position.y = 0.4; return g; }

  /* --------------------- house furniture (meshes) ---------------------- */
  // Minecraft-style enchantment table: obsidian block + a floating, slowly-turning open book
  function buildEnchantTable() {
    const group = new THREE.Group();
    const base = box(0.92, 0.28, 0.92, mat("#1a1230")); base.position.y = 0.14; group.add(base);
    const block = box(0.62, 0.5, 0.62, mat("#241a3a")); block.position.y = 0.53; group.add(block);
    const book = new THREE.Group(); book.position.y = 1.06;
    const cover = mat("#7a1f2b"), page = mat("#efe6cf");
    const cL = box(0.36, 0.3, 0.04, cover); cL.position.set(-0.19, 0, -0.03); cL.rotation.y = 0.55; book.add(cL);
    const cR = box(0.36, 0.3, 0.04, cover); cR.position.set(0.19, 0, -0.03); cR.rotation.y = -0.55; book.add(cR);
    const pL = box(0.32, 0.26, 0.03, page); pL.position.set(-0.18, 0, 0.02); pL.rotation.y = 0.55; book.add(pL);
    const pR = box(0.32, 0.26, 0.03, page); pR.position.set(0.18, 0, 0.02); pR.rotation.y = -0.55; book.add(pR);
    group.add(book);
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), new THREE.MeshBasicMaterial({ color: 0xc98bff, transparent: true, opacity: 0.9 }));
    glow.position.y = 1.06; group.add(glow);
    return { group, update(t) { book.rotation.y = t * 0.7; book.position.y = 1.06 + Math.sin(t * 2) * 0.05; glow.position.y = book.position.y; glow.material.opacity = 0.6 + Math.sin(t * 4) * 0.3; } };
  }
  // Minecraft-style anvil: dark iron, wide base → waist → wide top with a horn
  function buildAnvil() {
    const group = new THREE.Group();
    const dark = mat("#33333a"), mid = mat("#42424a"), light = mat("#565660");
    const base = box(0.74, 0.2, 0.5, dark); base.position.y = 0.1; group.add(base);
    const step = box(0.58, 0.12, 0.4, mid); step.position.y = 0.26; group.add(step);
    const waist = box(0.32, 0.22, 0.28, mid); waist.position.y = 0.44; group.add(waist);
    const top = box(0.82, 0.24, 0.44, light); top.position.y = 0.66; group.add(top);
    const horn = box(0.22, 0.16, 0.34, light); horn.position.set(-0.5, 0.64, 0); group.add(horn);
    return { group };
  }
  // an openable plank door on a hinge pivot (hinge at the group origin, panel swings on +X)
  function buildDoor(w) {
    w = w || 0.94;
    const pivot = new THREE.Group();
    const woodD = mat("#7a5330"), woodL = mat("#946a3c"), iron = mat("#6b6b73");
    const panel = box(w, 2.8, 0.12, woodD); panel.position.set(w / 2, 1.4, 0); pivot.add(panel);
    [1.85, 0.95].forEach(y => { const l = box(w + 0.02, 0.09, 0.14, woodL); l.position.set(w / 2, y, 0); pivot.add(l); });
    const handle = box(0.1, 0.1, 0.16, iron); handle.position.set(w - 0.12, 1.3, 0.09); pivot.add(handle);
    let cur = 0;
    return { group: pivot, update(open) { const target = open ? -1.45 : 0; cur += (target - cur) * 0.16; pivot.rotation.y = cur; } };
  }

  /* --------------------- polar bear & fish (biome life) ---------------- */
  function bearRig() {
    const r = quad("#eef1f4", "#eef1f4", "#dfe4e9", { bw: 0.96, bd: 1.4, bh: 0.78, legH: 0.52, snout: "#0f0f12", face: { eye: "#141414", nostril: "#141414" } });
    r.walkFreq = 6; r.walkAmp = 0.32;
    return r;
  }
  // realistic little fish (swims along +X): tapered body fat at the head → slim tail, a snout, two
  // colour bands, a dorsal fin, WAVING pectoral fins, glassy eyes and a forked caudal tail on a pivot.
  // The body flexes and the tail swishes so it reads as a swimming fish. Four random colour morphs.
  const FISH_PALETTES = [
    { body: "#e8712c", bodyD: "#c65a1e", fin: "#f2894a", belly: "#f6c48a", band: "#f4efe6" },  // clownfish
    { body: "#3a7bd0", bodyD: "#2b5ea0", fin: "#5fa0e0", belly: "#bfe0f5", band: "#ffd84a" },  // blue tang
    { body: "#e8c23a", bodyD: "#c99a20", fin: "#f0d868", belly: "#f7e9a0", band: "#e87a2c" },  // goldfish
    { body: "#cf5150", bodyD: "#a53a39", fin: "#e58080", belly: "#f0b3b2", band: "#f4efe6" },  // koi red
  ];
  function buildFish() {
    const P = FISH_PALETTES[(Math.random() * FISH_PALETTES.length) | 0];
    const g = new THREE.Group();
    const bodyM = mat(P.body), bodyD = mat(P.bodyD), finM = mat(P.fin), bellyM = mat(P.belly), bandM = mat(P.band);
    const flex = new THREE.Group(); g.add(flex);                              // whole body flexes here
    const head = box(0.20, 0.21, 0.16, bodyM); head.position.x = 0.15; flex.add(head);
    const mid = box(0.22, 0.18, 0.14, bodyM); mid.position.x = -0.03; flex.add(mid);
    const rear = box(0.15, 0.11, 0.09, bodyD); rear.position.x = -0.19; flex.add(rear);
    const belly = box(0.34, 0.05, 0.11, bellyM); belly.position.set(0.0, -0.10, 0); flex.add(belly);
    const snout = box(0.06, 0.12, 0.11, bodyD); snout.position.set(0.27, -0.01, 0); flex.add(snout);   // mouth taper
    // two vertical colour bands
    const b1 = box(0.04, 0.21, 0.165, bandM); b1.position.set(0.07, 0, 0); flex.add(b1);
    const b2 = box(0.04, 0.15, 0.13, bandM); b2.position.set(-0.07, 0, 0); flex.add(b2);
    // dorsal fin (top)
    const dorsal = box(0.18, 0.11, 0.02, finM); dorsal.position.set(0.0, 0.15, 0); dorsal.rotation.z = 0.15; flex.add(dorsal);
    // paired pectoral fins on a pivot so they flutter
    const pfins = [];
    [1, -1].forEach(s => { const p = box(0.11, 0.02, 0.10, finM); p.position.set(0.08, -0.03, s * 0.09); p.rotation.x = s * 0.5; flex.add(p); pfins.push(p); });
    // eyes near the head
    [0.08, -0.08].forEach(z => {
      const w = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.055, 0.02), new THREE.MeshBasicMaterial({ color: 0xffffff })); w.position.set(0.20, 0.03, z);
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.02), new THREE.MeshBasicMaterial({ color: 0x0a0a0a })); p.position.set(0.225, 0.03, z);
      flex.add(w, p);
    });
    // forked caudal tail on its own pivot at the tail root, so it can swish
    const tail = new THREE.Group(); tail.position.x = -0.26; g.add(tail);
    const tTop = box(0.11, 0.15, 0.02, finM); tTop.position.set(-0.05, 0.07, 0); tTop.rotation.z = 0.55; tail.add(tTop);
    const tBot = box(0.11, 0.15, 0.02, finM); tBot.position.set(-0.05, -0.07, 0); tBot.rotation.z = -0.55; tail.add(tBot);
    g.scale.setScalar(1.2);
    return { group: g, update(t) { const s = Math.sin(t * 8); tail.rotation.y = s * 0.75; flex.rotation.y = s * 0.12; const pw = Math.sin(t * 10) * 0.4; pfins[0].rotation.x = 0.5 + pw; pfins[1].rotation.x = -0.5 - pw; } };
  }

  /* --------------------------- gems & shadows --------------------------- */
  function makeGem(color) {
    const g = new THREE.Group();
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.32), new THREE.MeshBasicMaterial({ color }));
    const glow = new THREE.Mesh(new THREE.OctahedronGeometry(0.5), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.18, depthWrite: false }));
    g.add(gem, glow); g.userData.gem = gem; return g;
  }

  function makeShadow(r = 0.42) {
    const m = new THREE.Mesh(new THREE.CircleGeometry(r, 20), new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0.25, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.y = 1.02; m.renderOrder = 1; return m;
  }

  /* ------------------------------ portals ------------------------------- */
  function portalTex(type) {
    const cv = document.createElement("canvas"); cv.width = cv.height = 32; const c = cv.getContext("2d");
    if (type === "nether") {
      const N = 32, TAU = Math.PI * 2;                    // periodic over N px in both axes -> seamless tiling
      for (let x = 0; x < N; x++) for (let y = 0; y < N; y++) {
        const u = x / N * TAU, v = y / N * TAU;
        const s = Math.sin(u * 2 + Math.sin(v)) + Math.sin(v * 2 + Math.cos(u)) + Math.sin((u + v) * 1.5);
        const n = (s + 3) / 6;                             // 0..1 swirl field
        const col = n < 0.34 ? "#3a0d54" : n < 0.55 ? "#6d1a9c" : n < 0.74 ? "#a233d6" : n < 0.9 ? "#c94be6" : "#e6a3f2";
        c.fillStyle = col; c.fillRect(x, y, 1, 1);
      }
      for (let i = 0; i < 26; i++) {                       // bright drifting sparkle motes
        const x = (Math.sin(i * 12.9898) * 43758.5453 % 1 + 1) % 1 * N;
        const y = (Math.sin(i * 78.233) * 43758.5453 % 1 + 1) % 1 * N;
        c.fillStyle = i % 3 ? "#f3d9ff" : "#ffffff"; c.fillRect(x | 0, y | 0, 1, 1);
      }
    } else {
      c.fillStyle = "#04060f"; c.fillRect(0, 0, 32, 32);
      for (let i = 0; i < 90; i++) { c.fillStyle = ["#ffffff", "#9fe0ff", "#6fd0c0", "#c9b6ff"][(Math.random() * 4) | 0]; c.fillRect(Math.random() * 32, Math.random() * 32, 1, 1); }
    }
    const t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
    return t;
  }

  function makePortal(type) {
    const tex = portalTex(type);
    const m = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: type === "nether" ? 0.96 : 0.92, depthWrite: false, side: THREE.DoubleSide });
    m.toneMapped = false;                                  // keep the swirl vivid
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), m);
    mesh.renderOrder = 2;
    return { mesh, tex, type };
  }

  return { buildCharacter, buildVillager, buildWeapon, makeMob, makeGem, makeShadow, makePortal, makeFlower, FLOWER_COUNT, makeCrop, buildEnchantTable, buildAnvil, buildDoor, bearRig, buildFish, SKINS };
})();
