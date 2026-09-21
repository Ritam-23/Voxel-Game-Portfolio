# 🧱 Voxel Portfolio — a 3D Minecraft-style world

A real-time 3D (WebGL) portfolio you walk through in third person. A rotating
Earth on the title screen **dives** you down into a huge forested world, you
pick a hero (**Steve / He** or **Alex / She**), a **cinematic camera** sweeps in,
and you explore seven build sites:

**About · Experience (Nether portal) · Projects (End portal) · Technologies · Interests · Contact · Resume**

Built with [Three.js](https://threejs.org) — a real face-culled voxel mesher
with baked ambient occlusion, procedurally-drawn pixel textures (no downloads),
gravity/jump/collision, and third-person camera.

### Features
- ♾️ **Endless world** — flat-grass + forest **streamed in chunks** around you, so it never ends (lightweight)
- 🌍 **Real 3D Earth** on the title screen (procedural texture, clouds, atmosphere) that **dives in** on Enter
- 🌗 **Smooth day/night cycle** — day → dusk → night (stars, moon) → dawn, on a 4-min loop
- 🔥 **Nether portal** (Experience) & 🌌 **End portal** (Projects) — animated portals
- 🐷 **Mobs**: pigs, cows, sheep + hostile zombies, **endermen** (teleport) & **creepers** that **explode**
- ❤️ **5-heart health**: mobs hurt you, creeper blasts deal area damage + knockback; health regenerates
- ⚔️ **Weapons**: swing a sword / axe / pickaxe to **kill** mobs with **X** (switch with `1 2 3`)
- 🧍 Walk **right up to** any build (precise per-block collision)
- 📄 **Résumé** opens **in-page** (no new tab) and is downloadable (`assets/resume.pdf`)
- 🔎 **SEO-friendly** (meta, Open Graph, JSON-LD, crawlable text) · pixel **Geist** UI font
- 📱 Full touch controls (thumbstick + jump / attack / interact buttons)

---

## 🎮 Controls

| Action | Desktop | Mobile |
|--------|---------|--------|
| Move | `W A S D` or arrow keys | left thumbstick |
| Look around (orbit camera) | **click the world, then move the mouse** | drag right side |
| Get the cursor back | **scroll the mouse wheel** | — |
| Jump | `Space` | ⤒ button |
| Attack / kill a mob | **`X`** (or `F`) | ⚔ button |
| Switch weapon | `1` `2` `3` | — |
| Open a build | walk up + press `E` | `E` button |
| Close a panel / résumé | `Esc` or ✕ | ✕ |

> **Résumé:** replace `assets/resume.pdf` with your own file (keep the name), or
> change the path in `js/config.js` → `sections.resume.file`.


