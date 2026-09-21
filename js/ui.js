/* ============================================================================
   UI — screens, character select, hotbar HUD, 3D-anchored labels, panels.
   ========================================================================== */
window.UI = (() => {
  const $ = s => document.querySelector(s);
  const ORDER = ["about", "experience", "projects", "technologies", "interests", "contact", "resume"];
  const ICON = { about: "🏠", experience: "💼", projects: "🛠️", technologies: "⚙️", interests: "✨", contact: "✉️", resume: "📄" };
  const visited = new Set();
  let selectedKind = "he";
  let cbStart = null, cbClose = null;
  let panelOpen = false;

  /* ---------- EmailJS (lazy, keys optional) ---------- */
  const CK = () => (CONFIG.contact || {});
  const keysReady = () => { const k = CK(); return ["EMAILJS_SERVICE_ID", "EMAILJS_TEMPLATE_ID", "EMAILJS_PUBLIC_KEY"].every(n => k[n] && !/REPLACE/i.test(k[n])); };
  let emailjsPromise = null;
  function loadEmailJS() {
    if (window.emailjs) return Promise.resolve(window.emailjs);
    if (emailjsPromise) return emailjsPromise;
    emailjsPromise = new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js";
      s.async = true;
      s.onload = () => { try { window.emailjs.init({ publicKey: CK().EMAILJS_PUBLIC_KEY }); } catch (_) {} res(window.emailjs); };
      s.onerror = () => { emailjsPromise = null; rej(new Error("emailjs load failed")); };  // allow retry
      document.head.appendChild(s);
    });
    return emailjsPromise;
  }

  /* ---------- 2D blocky avatar for the select screen ---------- */
  function drawAvatar(canvasId, kind) {
    const cv = document.getElementById(canvasId);
    if (!cv) return;
    const ctx = cv.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const W = 120, H = 150;
    cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + "px"; cv.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, W, H);
    const s = Entities.SKINS[kind];
    const cx = W / 2;
    // shadow
    ctx.fillStyle = "rgba(0,0,0,.15)"; ctx.beginPath(); ctx.ellipse(cx, 138, 30, 7, 0, 0, 7); ctx.fill();
    // legs
    ctx.fillStyle = s.pants; ctx.fillRect(cx - 16, 96, 14, 34); ctx.fillRect(cx + 2, 96, 14, 34);
    ctx.fillStyle = s.hair; ctx.fillRect(cx - 16, 126, 14, 6); ctx.fillRect(cx + 2, 126, 14, 6);
    // body + arms
    ctx.fillStyle = s.shirt; ctx.fillRect(cx - 18, 56, 36, 42);
    ctx.fillRect(cx - 30, 56, 12, 40); ctx.fillRect(cx + 18, 56, 12, 40);
    ctx.fillStyle = s.skin; ctx.fillRect(cx - 30, 90, 12, 8); ctx.fillRect(cx + 18, 90, 12, 8);
    // head
    ctx.fillStyle = s.skin; ctx.fillRect(cx - 18, 18, 36, 38);
    // hair
    ctx.fillStyle = s.hair; ctx.fillRect(cx - 20, 12, 40, 12);
    ctx.fillRect(cx - 20, 12, 6, 30); ctx.fillRect(cx + 14, 12, 6, 30);
    if (s.long) { ctx.fillRect(cx - 20, 40, 6, 24); ctx.fillRect(cx + 14, 40, 6, 24); }
    // face
    ctx.fillStyle = "#fff"; ctx.fillRect(cx - 10, 32, 7, 7); ctx.fillRect(cx + 4, 32, 7, 7);
    ctx.fillStyle = "#33241c"; ctx.fillRect(cx - 8, 34, 4, 4); ctx.fillRect(cx + 6, 34, 4, 4);
    ctx.fillStyle = "#a75b4a"; ctx.fillRect(cx - 5, 46, 10, 3);
  }

  /* ---------- screens ---------- */
  function initScreens() {
    $("#p-name").textContent = CONFIG.profile.name;
    $("#p-role").textContent = CONFIG.profile.role;
    $("#p-tagline").textContent = CONFIG.profile.tagline;
    $("#name-he").textContent = Entities.SKINS.he ? "Steve" : "He";
    $("#name-she").textContent = "Alex";

    drawAvatar("av-he", "he");
    drawAvatar("av-she", "she");

    document.querySelectorAll(".hero-card").forEach(card => {
      card.addEventListener("click", () => {
        document.querySelectorAll(".hero-card").forEach(c => c.classList.remove("sel"));
        card.classList.add("sel");
        selectedKind = card.dataset.kind;
      });
    });

    const nb = $("#nb-name"); if (nb) nb.textContent = CONFIG.profile.name;

    // ENTER (after typing a name) → WELCOME splash → Character Select. No earth-zoom.
    $("#btn-enter").addEventListener("click", () => {
      const title = $("#screen-title"), w = $("#screen-welcome");
      if (title.classList.contains("gone")) return;      // ignore double-clicks mid-transition
      const nameEl = $("#player-name"), name = nameEl ? nameEl.value.trim() : "";
      const err = $("#name-err");
      if (!name) {                                        // require a name before entering
        if (err) err.hidden = false;
        if (nameEl) {
          nameEl.setAttribute("aria-invalid", "true");
          nameEl.classList.remove("shake"); void nameEl.offsetWidth; nameEl.classList.add("shake");
          nameEl.focus();
        }
        return;                                           // stop here — no music/globe/transition yet
      }
      if (err) err.hidden = true;
      if (nameEl) { nameEl.removeAttribute("aria-invalid"); nameEl.classList.remove("shake"); }
      if (window.Music) Music.start();                    // this click is a user gesture → start the music
      if (window.Globe && Globe.stop) Globe.stop();       // stop the little title globe (no zoom anymore)
      const sub = w.querySelector(".welcome-sub"); if (sub) sub.textContent = `Ready, ${name}? Choose your hero…`;
      w.classList.add("on");                             // WELCOME splash appears over the title
      title.classList.add("gone");                       // hard-hide the title so the name can never linger
      requestAnimationFrame(() => title.classList.remove("on"));
      setTimeout(() => {                                 // hold, then reveal character select beneath the fading splash
        $("#screen-select").classList.add("on");
        w.style.transition = "opacity .5s ease"; w.style.opacity = "0";
        setTimeout(() => { w.classList.remove("on"); w.style.opacity = ""; w.style.transition = ""; }, 520);
      }, 1500);
    });
    // START (after picking a hero) → straight into the world (welcome already shown after ENTER)
    $("#btn-start").addEventListener("click", () => {
      const sel = $("#screen-select");
      if (!sel.classList.contains("on")) return;         // guard double-clicks
      if (window.Music) Music.start();                    // ensure the music is playing as the world opens
      sel.classList.remove("on");
      $("#hud").classList.add("on");
      if (cbStart) cbStart(selectedKind);                // boot into the world (intro camera plays)
    });
    $("#screen-title").classList.add("on");
  }

  /* ---------- hotbar ---------- */
  function buildHud() {
    const bar = $("#hotbar");
    bar.innerHTML = "";
    ORDER.forEach(id => {
      const sec = CONFIG.sections[id];
      const slot = document.createElement("div");
      slot.className = "slot"; slot.dataset.id = id;
      slot.style.setProperty("--accent", sec.color);
      slot.innerHTML = `<div class="slot-ico">${ICON[id]}</div><div class="slot-label">${sec.title}</div>`;
      bar.appendChild(slot);
    });
  }

  function markVisited(id) {
    if (visited.has(id)) return;
    visited.add(id);
    const slot = document.querySelector(`.slot[data-id="${id}"]`);
    if (slot) slot.classList.add("done");
    if (visited.size === ORDER.length) {
      const b = $("#complete"); b.classList.add("on");
      setTimeout(() => b.classList.remove("on"), 5000);
    }
  }

  /* ---------- zone labels (anchored to 3D) ---------- */
  function buildLabels(zones) {
    const wrap = $("#labels");
    wrap.innerHTML = "";
    zones.forEach(z => {
      const el = document.createElement("div");
      el.className = "zone-label"; el.dataset.id = z.id;
      el.style.setProperty("--accent", z.color);
      const sec = CONFIG.sections[z.id];
      const name = sec.greeter || sec.title;                 // contact shows "💬 Wanna contact me?"
      el.innerHTML = `<span class="zl-name">${name}</span><span class="zl-key">Press <b>E</b></span>`;
      wrap.appendChild(el);
    });
  }

  function updateLabels(items) {
    items.forEach(it => {
      const el = document.querySelector(`.zone-label[data-id="${it.id}"]`);
      if (!el) return;
      if (!it.onScreen) { el.style.display = "none"; return; }
      el.style.display = "flex";
      el.style.left = it.x + "px";
      el.style.top = it.y + "px";
      el.classList.toggle("near", it.near);
    });
  }

  /* ---------- info panels ---------- */
  function panelHtml(id) {
    const sec = CONFIG.sections[id];
    const a = sec.color;
    let body = "";
    if (id === "about") {
      const stats = sec.stats ? `<div class="stats">${sec.stats.map(s => `<div class="stat"><b>${s[0]}</b><span>${s[1]}</span></div>`).join("")}</div>` : "";
      body = sec.body.map(p => `<p>${p}</p>`).join("") + stats +
        `<div class="facts">${sec.facts.map(f => `<div class="fact"><span>${f[0]}</span><b>${f[1]}</b></div>`).join("")}</div>`;
    } else if (id === "experience") {
      body = `<div class="timeline">${sec.jobs.map(j => `
        <div class="tl"><div class="tl-h"><b>${j.role}</b><span class="per">${j.period}</span></div>
        <div class="co">${j.company}</div><ul>${j.points.map(p => `<li>${p}</li>`).join("")}</ul></div>`).join("")}</div>`;
    } else if (id === "projects") {
      body = `<div class="cards">${sec.items.map(p => `
        <a class="proj" href="${p.link}" target="_blank" rel="noopener">
        <div class="pn">${p.name} <span>↗</span></div><div class="pd">${p.desc}</div>
        <div class="pt">${p.tech.map(t => `<span>${t}</span>`).join("")}</div></a>`).join("")}</div>`;
    } else if (id === "technologies") {
      body = `<div class="techgroups">${sec.groups.map(g => `
        <div class="tg"><div class="tg-l">${g.label}</div><div class="tg-i">${g.items.map(t => `<span>${t}</span>`).join("")}</div></div>`).join("")}</div>`;
    } else if (id === "interests") {
      body = `<div class="ints">${sec.items.map(i => `
        <div class="int"><div class="int-e">${i[0]}</div><div><b>${i[1]}</b><p>${i[2]}</p></div></div>`).join("")}</div>`;
    } else if (id === "contact") {
      const topics = (sec.topics || ["General"]).map(t => `<option value="${t}">${t}</option>`).join("");
      const avail = sec.availability ? `<div class="cavail">● ${sec.availability}</div>` : "";
      body = `<p class="cmsg">${sec.message}</p>${avail}
        <form class="cform" novalidate>
          <input type="checkbox" class="cf-hp" tabindex="-1" autocomplete="off" aria-hidden="true">
          <div class="cfield"><label for="cf-name">Name</label><input id="cf-name" type="text" required autocomplete="name" maxlength="80"></div>
          <div class="cfield"><label for="cf-email">Email</label><input id="cf-email" type="email" required autocomplete="email" maxlength="120"></div>
          <div class="cfield"><label for="cf-phone">Phone <span class="opt">(optional)</span></label><input id="cf-phone" type="tel" autocomplete="tel" maxlength="40"></div>
          <div class="cfield"><label for="cf-topic">Topic</label><select id="cf-topic">${topics}</select></div>
          <div class="cfield"><label for="cf-message">Message</label><textarea id="cf-message" required rows="4" maxlength="1200"></textarea></div>
          <div class="cform-err" role="alert" hidden></div>
          <button type="submit" class="cemail cf-send">Send message</button>
          <div class="cform-ok" role="status" hidden>✓ Thanks! Your message is on its way.</div>
        </form>
        <div class="socials">${sec.socials.map(s => `<a href="${s[1]}" target="_blank" rel="noopener">${s[0]}</a>`).join("")}</div>`;
    } else if (id === "resume") {
      body = `<p class="cmsg">${sec.message}</p>
        <div class="resbtns"><button class="cemail view" data-resume>👁 View Résumé</button>
        <a class="cemail dl" href="${sec.file}" download>⬇ Download</a></div>
        <ul class="reslist">${sec.highlights.map(h => `<li>${h}</li>`).join("")}</ul>`;
    }
    return `<div class="panel" style="--accent:${a}">
      <button class="p-close" aria-label="Close">✕</button>
      <div class="p-tab">${ICON[id]} ${sec.title}</div>
      <div class="p-body">${body}</div>
      <div class="p-foot">Press <kbd>Esc</kbd> or ✕ to keep exploring</div></div>`;
  }

  function openPanel(id) {
    const ov = $("#overlay");
    ov.innerHTML = panelHtml(id);
    ov.classList.add("on");
    panelOpen = true;
    markVisited(id);
    ov.querySelector(".p-close").addEventListener("click", closePanel);
    ov.addEventListener("click", bg);
    const vb = ov.querySelector("[data-resume]");
    if (vb) vb.addEventListener("click", () => openViewer(CONFIG.sections.resume.file));
    if (id === "contact") wireContactForm(ov);
    requestAnimationFrame(() => { const p = ov.querySelector(".panel"); if (p) p.classList.add("in"); });  // may be closed already
  }

  function wireContactForm(ov) {
    const form = ov.querySelector(".cform"); if (!form) return;
    const F = id => form.querySelector("#" + id);   // avoid HTMLFormElement.name shadowing
    const err = form.querySelector(".cform-err"), ok = form.querySelector(".cform-ok"), btn = form.querySelector(".cf-send"), hp = form.querySelector(".cf-hp");
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (keysReady()) loadEmailJS().catch(() => {});   // warm the SDK on open
    const showErr = m => { err.textContent = m; err.hidden = false; };
    const done = () => { form.querySelectorAll("input,select,textarea,button").forEach(e => { e.disabled = true; }); ok.hidden = false; err.hidden = true; };
    const mailtoFallback = (n, e, p, tp, msg) => {
      const sec = CONFIG.sections.contact;
      const sub = encodeURIComponent(`[Portfolio] ${tp} — ${n}`);
      const bd = encodeURIComponent(`Name: ${n}\nEmail: ${e}\nPhone: ${p || "-"}\nTopic: ${tp}\n\n${msg}`);
      window.location.href = `mailto:${sec.email}?subject=${sub}&body=${bd}`;
      done();
    };
    form.addEventListener("submit", async e => {
      e.preventDefault();
      err.hidden = true;
      if (hp && hp.checked) { done(); return; }        // honeypot ticked by a bot -> silently "succeed", send nothing
      const name = F("cf-name").value.trim(), email = F("cf-email").value.trim(), phone = F("cf-phone").value.trim(), topic = F("cf-topic").value, message = F("cf-message").value.trim();
      if (!name) return showErr("Please enter your name.");
      if (!emailRe.test(email)) return showErr("Please enter a valid email address.");
      if (!message) return showErr("Please enter a message.");
      if (!keysReady()) { mailtoFallback(name, email, phone, topic, message); return; }
      btn.disabled = true; const lbl = btn.textContent; btn.textContent = "Sending…";
      try {
        const ejs = await loadEmailJS();
        const k = CK();
        const owner = CONFIG.sections.contact.email;   // your own, authenticated address
        // Anti-spam: the message is sent FROM your own address (so it passes SPF/DKIM through your
        // mail service) — NEVER from the visitor's address (that mismatch is what lands it in spam).
        // The visitor's address goes in reply_to, so hitting "Reply" answers them directly.
        await ejs.send(k.EMAILJS_SERVICE_ID, k.EMAILJS_TEMPLATE_ID, {
          name, email, phone: phone || "—", topic, message, time: new Date().toLocaleString(),
          from_name: name + " (via Portfolio)", from_email: owner, reply_to: email,
          to_name: CONFIG.profile.name, to_email: owner,
          title: "New portfolio message — " + topic, subject: "Portfolio message from " + name + " — " + topic,
        });
        done();
      } catch (_) {
        btn.disabled = false; btn.textContent = lbl;
        showErr("Couldn't send just now — try the direct email link below.");
      }
    });
  }
  function bg(e) { if (e.target.id === "overlay") closePanel(); }
  function closePanel() {
    const ov = $("#overlay");
    ov.classList.remove("on"); ov.removeEventListener("click", bg); ov.innerHTML = "";
    panelOpen = false; if (cbClose) cbClose();
  }
  const isPanelOpen = () => panelOpen;

  /* ---------- in-page resume viewer ---------- */
  let viewerOpen = false;
  function openViewer(file) {
    closePanel();
    const v = $("#resume-viewer"), fr = $("#resume-frame"), dl = $("#rv-dl");
    if (fr) fr.src = file; if (dl) dl.href = file;
    v.classList.add("on"); viewerOpen = true;
    if (document.exitPointerLock) document.exitPointerLock();
  }
  function closeViewer() {
    const v = $("#resume-viewer"), fr = $("#resume-frame");
    if (!v || !viewerOpen) return;
    v.classList.remove("on"); if (fr) fr.src = "about:blank"; viewerOpen = false;
  }
  const isViewerOpen = () => viewerOpen;

  function init(opts) {
    cbStart = opts.onStart; cbClose = opts.onClose;
    initScreens(); buildHud();
    const rc = $("#rv-close"); if (rc) rc.addEventListener("click", closeViewer);
    const v = $("#resume-viewer"); if (v) v.addEventListener("click", e => { if (e.target.id === "resume-viewer") closeViewer(); });
  }

  return { init, buildLabels, updateLabels, openPanel, closePanel, isPanelOpen, markVisited, openViewer, closeViewer, isViewerOpen };
})();
