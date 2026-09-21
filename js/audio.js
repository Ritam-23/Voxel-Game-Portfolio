/* ============================================================================
   MUSIC — looping background track (assets/music.mp3). It must PLAY on every visit
   and keep playing unless the visitor mutes it (the choice is remembered).
   Browsers forbid audible autoplay until the first user gesture, so we retry on
   EVERY gesture (pointer/key/touch/click) until playback actually begins, and the
   ENTER / START buttons call start() explicitly. Lazy: the file isn't fetched
   until the first play attempt, so it never blocks the world booting.
   ========================================================================== */
window.Music = (() => {
  const SRC = "assets/music.mp3";
  const VOL = 0.4;                                      // gentle background level
  const KEY = "voxel-music-muted";                     // fresh key: a stale mute from earlier builds can't silence it
  let audio = null, muted = false, raf = 0, suspended = false;
  try { muted = localStorage.getItem(KEY) === "1"; } catch (_) {}

  function ensure() {
    if (audio) return audio;
    audio = new Audio();
    audio.src = SRC; audio.loop = true; audio.preload = "none"; audio.volume = 0;
    audio.addEventListener("ended", () => { if (!muted) audio.play().catch(() => {}); });   // loop safety
    return audio;
  }
  function fadeTo(target, ms) {
    if (!audio) return;
    cancelAnimationFrame(raf);
    const from = audio.volume, t0 = performance.now();
    const step = now => {
      const k = Math.min(1, (now - t0) / ms);
      audio.volume = from + (target - from) * k;
      if (k < 1) raf = requestAnimationFrame(step); else if (target === 0 && audio) audio.pause();
    };
    raf = requestAnimationFrame(step);
  }
  // Start (or resume) playback unless muted. Safe to call as often as we like: it no-ops while
  // already playing, and quietly ignores a blocked attempt so the next gesture can succeed.
  function ensurePlaying() {
    if (muted) return;
    ensure();
    if (!audio.paused) return;                          // already playing
    const p = audio.play();
    if (p && p.then) p.then(() => fadeTo(VOL, 1400)).catch(() => {});
    else fadeTo(VOL, 1400);
  }
  const start = ensurePlaying;                          // explicit entry point for the ENTER/START buttons
  const isPlaying = () => !!audio && !audio.paused;
  // Stop sound the instant the page leaves the foreground (tab switch, back, close, in-app browser
  // dismiss). Pause HARD & immediately — no fade — because the browser may freeze JS right after,
  // leaving a fade half-done and audio still playing. `suspended` marks that WE paused it (vs a real
  // user mute) so we can resume once the page comes back and the visitor hadn't muted.
  function suspend() {
    if (!audio || audio.paused) return;
    cancelAnimationFrame(raf);
    audio.pause();
    audio.volume = 0;
    suspended = true;
  }
  function resume() {
    if (!suspended) return;
    suspended = false;
    ensurePlaying();                                    // no-ops if muted
  }
  function setMuted(m) {
    muted = m;
    try { localStorage.setItem(KEY, m ? "1" : "0"); } catch (_) {}
    if (m) fadeTo(0, 300); else ensurePlaying();
    updateBtn();
  }
  // Clicking the button is itself a user gesture Chrome always honours, so make it DO THE RIGHT THING:
  // muted → unmute & play; playing → mute; unmuted-but-blocked-by-autoplay → just start it (never mute).
  function toggle() {
    if (muted) setMuted(false);
    else if (isPlaying()) setMuted(true);
    else ensurePlaying();
  }
  function updateBtn() {
    const b = document.getElementById("mute");
    if (!b) return;
    b.textContent = muted ? "🔇" : "🎵";
    b.title = muted ? "Music off — click to play" : "Music on — click to mute";
    b.setAttribute("aria-label", muted ? "Unmute music" : "Mute music");
    b.classList.toggle("off", muted);
  }

  function init() {
    try { localStorage.removeItem("voxel-muted"); } catch (_) {}   // retire the old key so past mutes don't linger
    updateBtn();
    const b = document.getElementById("mute");
    if (b) b.addEventListener("click", e => { e.stopPropagation(); toggle(); });
    // retry on EVERY gesture until it's actually playing (kept attached — cheap no-op once playing)
    const kick = () => ensurePlaying();
    ["pointerdown", "keydown", "touchstart", "click"].forEach(ev => addEventListener(ev, kick, { passive: true }));
    // Silence when the page leaves the foreground; pick it back up when it returns.
    // These cover every device/exit path: tab switch & lock (visibilitychange), navigation/close
    // and bfcache stash (pagehide), phone/OS tab freeze (freeze), and blur for stubborn in-app
    // browsers (WhatsApp/Instagram) that don't reliably fire visibilitychange on dismiss.
    document.addEventListener("visibilitychange", () => { document.hidden ? suspend() : resume(); });
    addEventListener("pagehide", suspend);
    addEventListener("freeze", suspend);
    addEventListener("blur", () => { if (document.hidden) suspend(); });
    addEventListener("pageshow", resume);               // returning from bfcache
    addEventListener("focus", resume);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();

  return { start, toggle, setMuted, isMuted: () => muted };
})();
