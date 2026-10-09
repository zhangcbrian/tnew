# Performance Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cut GPU work (plants, terrain, resolution) and remove main-thread generation stutter.

**Architecture:** Workers produce per-chunk typed arrays; main thread builds LOD terrain meshes and feeds plant data into 4×4-chunk tiles of culled, LOD'd instanced meshes; renderer resolution adapts to frame time.

**Tech Stack:** Three.js r170, TypeScript, Vite module workers.

**Spec:** `docs/superpowers/specs/2026-10-08-performance-design.md`

## Global Constraints
- Same world (seeded) and same look up close. Height cache stays full resolution.
- Tile = 4×4 chunks; cover ≤ 110 u; near trees ≤ 180 u; terrain LOD 32/16/8 at 200/350.
- Pixel ratio cap 1.5; dynamic scale 0.6–1.0.
- No test runner: `npm run build` + Playwright measurements vs baseline.

## Review Focus
- Chunk results arriving after the chunk was unloaded (player moved on) must be dropped.
- Tiles must update when any of their chunks load/unload; no stale plants left behind.
- Skirts must hide cracks between LOD levels and at region borders.
- Worker and main thread must produce identical heights (cache vs worker-built mesh).
- Loading screen must still finish; title-screen streaming keeps working.

---

### Task 1: Worker chunk generation
Files: create `src/world/chunk-gen.ts` (pure: `generateChunk(cx, cz) → ChunkData` with heights/normals/colors/plants), `src/world/chunk-worker.ts`, `src/world/chunk-workers.ts` (pool); modify `terrain.ts` (`storeChunkHeights`, mesh build from data), `chunk-manager.ts` (async requests, drop stale), `vegetation.ts` (accept plant data).
- [ ] Implement; build; commit `perf: build land in web workers`.

### Task 2: Plant tiles with LOD + culling
Files: `src/world/biomes/plants.ts` (far geometries, `cover` flag), biome plant lists, `src/world/vegetation.ts` (tiles), `game.ts` (`vegetation.update(camera)`).
- [ ] Implement; build; commit `perf: draw only nearby plants in detail`.

### Task 3: Terrain LOD with skirts
Files: `terrain.ts` (`buildChunkGeometry(data, step)` with skirts), `chunk-manager.ts` (LOD per chunk on player chunk change).
- [ ] Implement; build; commit `perf: simpler terrain in the distance`.

### Task 4: Adaptive resolution
Files: `game.ts` (pixel ratio cap 1.5, dynamic scale).
- [ ] Implement; build; commit `perf: resolution adapts to frame time`.

### Task 5: Measure + verify
- [ ] Same measurements as baseline; screenshots; fix; commit.
