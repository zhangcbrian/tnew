# Performance Pass — Design

Date: 2026-10-08
Status: Approved in chat ("yes, build it" to recommendations #1–4)

## Baseline (measured, 1440×900 window at pixel ratio 2 = 2880×1800, Apple GPU)

| Metric | Value |
|---|---|
| GPU frame (render + 1-px readback), Highlands spawn / Amazon | 9.43 ms / 11.95 ms |
| Empty-scene floor (clear + MSAA resolve + readback) | 5.78 ms |
| Triangles per frame, spawn / Amazon | 3.58 M / 4.12 M (plants ≈ 3.3 M) |
| Draw calls | 154 |
| Terrain chunk build on main thread, interior / region corner | 2.31 ms / 6.63 ms (2 per frame) |
| Worst frame while flying 300 u/s | 18.5 ms |
| Game logic (all systems) | < 0.3 ms |

## Goals

1. Plants: only draw what can be seen, simpler far away.
2. No main-thread stutter from building land.
3. Fewer terrain triangles in the distance, without cracks.
4. Resolution that adapts to the device.

Gameplay, world look up close, and determinism stay the same.

## Design

### 1. Plant tiles + level of detail
- Plants are grouped into **tiles of 4×4 chunks (256 units)**. Each (tile, plant type) is its own
  `InstancedMesh` sized exactly, with a real bounding sphere, so Three.js frustum-culls tiles behind
  or beside the camera (main renderer and shadow pass).
- Each plant type has a **near** geometry (today's) and a **far** geometry (≈ 10–40 triangles).
  Ground cover (grass, heather, bracken, big leaves, wildflowers, tall grass, tussock, shrubs) has
  no far version — it is only drawn when the tile's nearest point is within **110 units**.
  Trees/rocks use near geometry within **180 units**, far beyond.
- Only near tiles cast shadows.
- Chunks still own their plant data (matrices + tints); tiles are rebuilt from their chunks when a
  chunk loads/unloads (a few tiles per frame at most).

### 2. Terrain + plant generation in Web Workers
- A small worker pool (2–3 module workers) builds chunk data: heights on a padded 35×35 grid
  (normals from the grid — ≈ 4× less noise work than today), vertex colors, and plant placements
  (matrices + tints per plant type). Results come back as transferable typed arrays.
- The main thread only turns arrays into GPU geometry and fills the height cache — no noise work.
- Determinism unchanged (same seeded noise in every worker).
- Loading screen waits for the spawn area as now (progress = chunks ready).

### 3. Terrain level of detail with skirts
- Chunk mesh resolution by distance from the player: 32×32 within 200 units, 16×16 to 350,
  8×8 beyond. Built from the stored full-resolution arrays (no worker round trip when LOD changes).
- Each chunk has a **skirt** (an edge strip dropped 4 units) so neighbors at different detail never
  show cracks.
- Gameplay height cache always uses full resolution.

### 4. Adaptive resolution
- Pixel ratio capped at **1.5** (was 2).
- Dynamic resolution: if the smoothed frame time stays above 19 ms for 2 s, render scale drops
  by 0.1 (min 0.6); after 8 s of steady frames under 17.5 ms it rises again (max 1.0).

## Out of scope
Quality presets, shadow-map scheduling, floating origin (recommendations #5–7).

## Testing
- `npm run build` passes.
- Re-run the same browser measurements as the baseline; report before/after.
- Visual: screenshots near and far (no cracks, no obvious plant popping), all gameplay still works
  (walking on terrain, blocks, landscapes, label).
