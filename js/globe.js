/* ============================================================================
   GLOBE — a small standalone 3D Earth for the title screen (own tiny renderer).
   Falls back silently to the CSS globe if WebGL is unavailable.
   ========================================================================== */
window.Globe = (() => {
  let renderer, scene, camera, earth, clouds, atmo, raf, active = false, zooming = false, zt = 0, zoomCb = null, last = 0;
  let intro = false, it = 0;                               // arrival "grow-in" of the little planet
  const REDUCE = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const ZOOM_DUR = 1.8;                                    // seconds — time-based so it's frame-rate independent
  const INTRO_DUR = 1.2;                                   // grow-in on first appearance
  const smoother = p => p * p * p * (p * (p * 6 - 15) + 10);   // smootherstep: eased in AND out
  const setScale = s => { earth.scale.setScalar(s); clouds.scale.setScalar(s); atmo.scale.setScalar(s); };
  const setFwd = z => { earth.position.z = z; clouds.position.z = z; atmo.position.z = z; };

  function texEarth() {
    const c = document.createElement("canvas"); c.width = 512; c.height = 256; const g = c.getContext("2d");
    const grd = g.createLinearGradient(0, 0, 0, 256);
    grd.addColorStop(0, "#0b3b6b"); grd.addColorStop(0.5, "#1660aa"); grd.addColorStop(1, "#0b3b6b");
    g.fillStyle = grd; g.fillRect(0, 0, 512, 256);
    const greens = ["#2f7d32", "#3f8e3f", "#5a9e4a", "#6f8f37", "#8a6b3a", "#347a3a"];
    for (let i = 0; i < 30; i++) {
      g.fillStyle = greens[i % greens.length];
      g.beginPath();
      g.ellipse(Math.random() * 512, 36 + Math.random() * 184, 10 + Math.random() * 46, 7 + Math.random() * 28, Math.random(), 0, 7);
      g.fill();
    }
    g.fillStyle = "#eef6ff"; g.fillRect(0, 0, 512, 16); g.fillRect(0, 240, 512, 16);
    for (let i = 0; i < 2600; i++) { g.fillStyle = "rgba(255,255,255,0.04)"; g.fillRect(Math.random() * 512, Math.random() * 256, 1, 1); }
    const t = new THREE.CanvasTexture(c); if (THREE.sRGBEncoding) t.encoding = THREE.sRGBEncoding; return t;
  }
  function texClouds() {
    const c = document.createElement("canvas"); c.width = 512; c.height = 256; const g = c.getContext("2d");
    g.clearRect(0, 0, 512, 256);
    for (let i = 0; i < 26; i++) { g.fillStyle = "rgba(255,255,255," + (0.25 + Math.random() * 0.5) + ")"; g.beginPath(); g.ellipse(Math.random() * 512, Math.random() * 256, 14 + Math.random() * 40, 6 + Math.random() * 16, 0, 0, 7); g.fill(); }
    const t = new THREE.CanvasTexture(c); return t;
  }

  function start() {
    const canvas = document.getElementById("earth-canvas");
    if (!canvas) return;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    } catch (e) { canvas.style.display = "none"; return; }               // keep CSS fallback
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100); camera.position.z = 3.1;
    scene.add(new THREE.AmbientLight(0xffffff, 0.95));
    const dl = new THREE.DirectionalLight(0xffffff, 0.8); dl.position.set(3, 2, 4); scene.add(dl);
    earth = new THREE.Mesh(new THREE.SphereGeometry(1, 36, 28), new THREE.MeshLambertMaterial({ map: texEarth() }));
    clouds = new THREE.Mesh(new THREE.SphereGeometry(1.02, 28, 22), new THREE.MeshLambertMaterial({ map: texClouds(), transparent: true }));
    atmo = new THREE.Mesh(new THREE.SphereGeometry(1.16, 24, 18), new THREE.MeshBasicMaterial({ color: 0x6fb0ff, transparent: true, opacity: 0.16, side: THREE.BackSide }));
    earth.rotation.z = 0.4; clouds.rotation.z = 0.4;
    scene.add(earth, clouds, atmo);
    const css = document.getElementById("globe"); if (css) css.style.display = "none";
    intro = !REDUCE; it = 0; setScale(intro ? 0.2 : 1);   // planet grows in on arrival (skipped for reduced-motion)
    active = true; size(); addEventListener("resize", size); loop();
  }

  function size() {
    if (!renderer) return;
    const canvas = renderer.domElement, w = canvas.clientWidth || 220, h = canvas.clientHeight || 220;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  }

  function loop(now) {
    raf = requestAnimationFrame(loop); if (!active) return;
    // time-based dt (seconds), clamped so a tab-switch or slow frame can't jump the animation
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016; last = now;
    let spin = 0.16 * (REDUCE ? 0.35 : 1);                              // idle rotation (radians/sec)
    if (intro && !zooming) {                                            // arrival: the planet grows in while spinning
      it += dt; const p = Math.min(1, it / INTRO_DUR), e = smoother(p);
      setScale(0.2 + e * 0.8);
      spin = 0.16 + (1 - e) * 1.0;                                      // a touch faster as it settles, then idle
      if (p >= 1) intro = false;
    }
    if (zooming) {
      zt += dt; const p = Math.min(1, zt / ZOOM_DUR), e = smoother(p);   // eased-in-and-out dive
      setScale(1 + e * 1.7);                                            // the planet GROWS as it comes forward
      setFwd(e * 1.8);                                                  // and surges toward the viewer (into the front)
      camera.position.z = 3.1 - e * 2.2;                               // camera dollies in to meet it
      earth.rotation.z = 0.4 + e * 0.7;                                 // gentle roll as it dives
      spin = 0.16 + e * 2.4;                                            // rotation ACCELERATES smoothly while zooming in
      if (p >= 1) { zooming = false; if (zoomCb) { const cb = zoomCb; zoomCb = null; cb(); } }
    }
    earth.rotation.y += spin * dt; clouds.rotation.y += spin * 1.25 * dt;
    renderer.render(scene, camera);
  }

  function zoom(cb) {
    if (!active) { setTimeout(cb, REDUCE ? 200 : 1400); return; }
    // blow the canvas up to fullscreen so the sphere fills the view (no raster upscaling)
    const canvas = renderer.domElement;
    canvas.style.position = "fixed"; canvas.style.left = "0"; canvas.style.top = "0";
    canvas.style.width = "100vw"; canvas.style.height = "100vh"; canvas.style.zIndex = "61";
    canvas.style.transition = "opacity .4s ease"; canvas.style.pointerEvents = "none";
    requestAnimationFrame(size);
    intro = false; setScale(1); setFwd(0);                 // start the dive from the settled resting planet
    zooming = true; zt = 0;
    zoomCb = () => {
      // soft fade to the screen underneath, then drop the canvas (no hard cut / flash)
      canvas.style.opacity = "0";
      if (cb) cb();
      setTimeout(() => { canvas.style.display = "none"; stop(); }, 420);
    };
    if (REDUCE) { zt = ZOOM_DUR; }                         // skip the long dive for reduced-motion users
  }
  function stop() { active = false; if (raf) cancelAnimationFrame(raf); }

  return { start, zoom, stop };
})();
