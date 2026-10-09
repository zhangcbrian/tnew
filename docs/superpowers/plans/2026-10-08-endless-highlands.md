# Endless Highlands + Solid Blocks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the finite surreal world with an endless, streamed Scottish-Highlands landscape and make placed blocks solid for player, animals and people.

**Architecture:** Terrain height/color stay pure functions of (x, z) using seeded noise. `ChunkManager` streams chunks around the player and tells `Vegetation` to fill/free per-chunk slots in pooled `InstancedMesh`es. Animals and people live in fixed pools recycled into a ring around the player. `BuildingSystem` owns a block-grid query API used by every mover.

**Tech Stack:** Three.js r170, TypeScript strict, Vite, simplex-noise 4.

**Spec:** `docs/superpowers/specs/2026-10-08-endless-highlands-design.md`

## Global Constraints

- Endless: no `HALF_WORLD`/`WORLD_SIZE` bounds anywhere at runtime; no border.
- Surreal content removed: `surreal-zone.ts`, `cactus-border.ts`, `getSurrealFactor`, mushroom trees, turtles, jellyfish.
- Water level y = 0 everywhere (water plane follows player).
- Deterministic world: seeded noise + per-chunk seeded RNG (same seed every load).
- Highland cows and sheep are rare: herds of 2–4, pools of ≤ 8 cows / ≤ 12 sheep.
- Walk/fly speeds and controls unchanged. Flat shading / procedural geometry as before.
- Verification: `npm run build` per task, Playwright at the end (no test runner in repo).

## Review Focus

- Long flight in one direction (≥ 3000 units): chunks keep appearing ahead, old ones are freed (memory/draw calls bounded), no hitches from generating too many chunks in one frame.
- Height cache eviction: anything querying heights for a freed chunk falls back to noise, never reads stale/undefined data.
- Player squeezed between blocks or a block placed overlapping the player: must not get stuck inside or launched; placement on an occupied cell is refused.
- Recycled animals/people must never respawn inside water (land types), on land (fish), or inside blocks.
- Rider stack / flee / drowning people must not be recycled mid-state in a way that breaks `riderStack` indices.

---

### Task 1: Highland terrain function, colors, sky and fog

**Files:** Modify `src/utils/noise.ts`, `src/world/terrain.ts`, `src/world/skybox.ts`, `src/game.ts` (fog, sky follows camera)

**Interfaces:**
- `noise.ts`: noise seeded with fixed seed via mulberry32 (`createNoise2D(mulberry32(SEED))`); export `mulberry32(seed): () => number` and `hash2(x, z): number` (int hash for per-chunk RNG).
- `terrain.ts` exports: `CHUNK_SIZE` (64), `WATER_LEVEL` (0), `getTerrainHeight(x,z)`, `getTerrainSlope(x,z)` (0 flat .. 1 vertical, from finite differences), `getTerrainHeightCached(x,z)`, `createTerrainChunk(cx,cz)`, `forgetChunkHeights(cx,cz)`. Removes `WORLD_SIZE`, `HALF_WORLD`, `getSurrealFactor`.
- Height: `glen = smoothstep(-0.35, 0.45, octave(x,z,3,.5,2,0.0016))` (0 = valley floor, 1 = upland); `hills = octave(x,z,4,.5,2,0.006)`; `ridge = ridgedNoise(x,z,0.004)^2`; `h = -6 + glen*(28 + hills*22) + glen^2 * ridge * 55 + detail*2`. Spawn: within r<40 blend to 3, smoothstep 40→120.
- Colors by height + slope + noise: underwater peat `#3b3226`, shingle `#8a8272` (h<1.2), moor grass `#7a8450` / bracken `#9a6a34` (low), heather `#6e4b5c` mixed with grass (mid), rock `#7d7d80` (slope>0.45 or ridge), snow `#eef0f4` patchy above 75.
- Sky: top `#5f8fc2`, bottom `#c9d6e0`; sky mesh position copies camera each frame. Fog `#b9c7d2`, near 140, far 520.

- [ ] Implement; `npx tsc --noEmit` passes except call sites fixed in Task 2. Commit with Task 2.

### Task 2: Chunk streaming, water follow, remove border/surreal

**Files:** Rewrite `src/world/chunk-manager.ts`; modify `src/world/water.ts`, `src/game.ts`, `src/character/otter-controller.ts`; delete `src/world/surreal-zone.ts`, `src/world/cactus-border.ts`.

**Interfaces:**
- `ChunkManager`: `constructor(onLoad: (cx,cz)=>void, onUnload: (cx,cz)=>void)`; `update(px, pz, budget = 2)` loads up to `budget` missing chunks within `LOAD_RADIUS` (ceil(500/64)=8) nearest-first and unloads chunks beyond `LOAD_RADIUS + 2` (dispose geometry/material, `forgetChunkHeights`, call `onUnload`); `preload(px,pz,radius,budget)` returns progress 0..1 for loading screen; `nearbyMeshes(px,pz): THREE.Mesh[]` (3×3).
- `Water`: plane 1400×1400; `update(time, px, pz)` snaps position to 64-unit grid.
- Game loading: phase 0 preloads radius 5 around spawn (budget 6/frame) then creates other systems; vegetation is created *before* chunk manager starts so callbacks work. Loop: `chunkManager.update(px,pz)`. Remove surreal/cactus usage; loading messages updated.
- Otter controller: remove `isOutsideBorder` bounce.

- [ ] Implement; `npm run build` passes; commit `feat: endless streamed Highland terrain`.

### Task 3: Per-chunk Highland vegetation

**Files:** Rewrite `src/world/vegetation.ts`.

**Interfaces:**
- `Vegetation`: `group`; `addChunk(cx,cz)`; `removeChunk(cx,cz)`.
- Types (geometry, color, per-chunk max K): Scots pine (tall bare red-brown trunk + flat dark canopy layers, `#2f4a2c`, 28), birch (white trunk, light canopy `#7d9a48`, 8), heather clump (`#7b4f73`, 30), gorse (dark green + yellow tint, 10), bracken (`#9a6a34`, 24), boulder (`#7f7f84`, 12), grass tuft (`#8a9353`, 40).
- Pool: `SLOTS = (2*(8+2)+1)^2 = 441` chunk slots; each type one `InstancedMesh(geo, mat, SLOTS*K)`, `count = SLOTS*K`, unused instances zero-scale matrix, `frustumCulled = false`. Slot free-list; `addChunk` takes a slot, fills with seeded RNG `mulberry32(hash2(cx,cz))`, writes matrices+colors, marks needsUpdate (use `addUpdateRange` on the slot range). `removeChunk` zero-scales slot range and frees it.
- Placement rules (per candidate point): skip if h < 0.6 or slope > 0.45; pines where `octave(x,z,2,.5,2,0.01) > 0.25` and h < 45 (clusters); birch h < 30, slope < 0.3, sparse; heather h 8–70; gorse h 2–35; bracken h 1–30, low slope; boulders any dry h, more when slope > 0.3 or h > 50 (allow slope up to 0.7); grass h 0.6–40.

- [ ] Implement; build passes; commit `feat: per-chunk Highland vegetation`.

### Task 4: Wildlife, people and weather in an endless world

**Files:** Modify `src/world/animals.ts`, `src/world/people.ts`, `src/world/weather.ts`.

**Interfaces:**
- Animals: pools deer 40 (red-deer color `#8a4b2a`), rabbit 50, birds 30 (grey/brown), fish 50, cow 8, sheep 12. New geometries: Highland cow (boxy shaggy body, long fringe, wide horns, ginger `#b5651d`), sheep (round woolly body `#eeeae0`, dark face/legs). Turtles/jellyfish removed.
- Recycle rule each update: if dist to player > 420 → respawn at random angle, radius 120–380 from player at a valid spot (land: h ≥ 0.8 & slope < 0.4; fish: h ≤ -1.5, y between floor+0.4 and -0.8; birds: ground+10..35; cow/sheep: h 1–30, slope < 0.25, herd of 2–4 placed together, herd spawn only 15% chance per check, else stay hidden at y=-9999 scale 0). 
- `update(dt, time, playerPos, blocks: BlockQuery)` — see Task 5 for BlockQuery.
- People: remove `HALF_WORLD` bounds and `getSurrealFactor`; initial placement in ring around origin; WANDER/IDLE/DEAD people farther than 420 recycled to ring around player (DEAD → reset to WANDER, scale restored). RIDING/FLEE/DROWNING/CHASE never recycled.
- Weather: `intensity` from slow noise of time (`smoothstep(0.35, 0.75, octave(time*0.02, 7.3))`), snow only when player y > 60 (else rain).

- [ ] Implement; build passes; commit `feat: Highland wildlife and people around the player`.

### Task 5: Solid blocks

**Files:** Modify `src/world/building.ts`, `src/character/otter-controller.ts`, `src/world/animals.ts`, `src/world/people.ts`, `src/game.ts`.

**Interfaces:**
- `export interface BlockQuery { isSolid(x: number, y: number, z: number): boolean; supportHeight(x: number, z: number, maxY: number): number; boxHits(minX,minY,minZ,maxX,maxY,maxZ): boolean }` implemented by `BuildingSystem` over integer cells (block centered on integer coords, spans ±0.5).
  - `supportHeight`: highest block top (`cy + 0.5`) in column at (round x, round z) with top ≤ maxY; `-Infinity` if none.
- `BuildingSystem.updatePreview(camera, playerPos, ground: THREE.Object3D[])` raycasts terrain meshes (from `chunkManager.nearbyMeshes`) + blocks; placement on terrain hit: cell = snap(hit.point + normal*0.5). Remove 5000² ground plane.
- `placeBlock(occupied: (minX..maxZ) => boolean)` refuses when the target cell box intersects player box or any creature within 1 unit (game passes a checker that tests player box + `animals.isNear(x,y,z)` + `people.isNear(x,y,z)`).
- Player (`OtterController.update(..., blocks)`): half-width 0.4, height 1.2. Per-axis horizontal move: try x, if `boxHits` revert x and zero vx; then z. Ground = max(terrainH, supportHeight(x±0.4, z±0.4 corners max, y + 0.5)) — walking snaps up to ≤0.5 step; FLY: if moving up and box would hit a block, clamp flyHeight; landing on a block top when descending lands (state → WALK/IDLE).
- Animals (land types, cows, sheep) and people (WANDER/CHASE): after computing next x/z, if `isSolid(nx, y+0.5, nz)` → don't move, heading += π·(0.5..1). Ground y = max(terrain, supportHeight(x,z,y+0.6)).

- [ ] Implement; build passes; commit `feat: placed blocks are solid for everyone`.

### Task 6: Browser verification

- [ ] Spawn screenshot (glen + loch). Fly ~3000 units straight (teleport via repeated input or evaluate) — terrain present, chunk count bounded (log `chunkManager` size), fps reasonable. Screenshots of heather hills / pines / peak.
- [ ] Build a 3-high wall in front of player; hold W into it — position stops; fly onto it and land; stand.
- [ ] Watch an animal/person meet a wall (spawn wall in their path via evaluate) — they turn.
- [ ] Fix findings; final build; commit.
