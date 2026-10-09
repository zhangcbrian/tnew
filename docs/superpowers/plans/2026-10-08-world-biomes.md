# World of Landscapes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ten real-world landscapes in 50-mile regions tiling an endless world, blended at borders, each with its own terrain, plants, animals and climate, plus an on-screen region label.

**Architecture:** A `biomes/` module owns the region grid, per-biome definitions and border weights. Terrain, vegetation, animals, sky/fog/water/weather all ask it what's where. Pure functions of (x, z) keep the world deterministic.

**Tech Stack:** Three.js r170, TypeScript strict, Vite.

**Spec:** `docs/superpowers/specs/2026-10-08-world-biomes-design.md`

## Global Constraints

- REGION_SIZE = 80467; border blend half-width 400 units; region (0,0) = Highlands.
- ~1/3 regions exotic via `hash2(rx, rz) % 3 === 0`.
- Highlands look at spawn unchanged from current game.
- No test runner: verify with `npm run build` and Playwright.

## Review Focus

- Border blending continuity: height must be continuous across region edges and corners (no cliffs/seams), including at the 4-region corners.
- Vegetation pools: a chunk that places zero of a type must not hold a slot of that type; all slots freed on unload; draw counts shrink when far-region chunks unload.
- Animals: species never spawn outside their biomes; a region with no valid species just has none (no busy-loop).
- Performance in border zones (up to 4 biome evaluations per height sample) — chunk build time must stay a few ms.
- Climate blending when crossing a border: sky/fog/water change smoothly, no flashing.

---

### Task 1: Biome core + terrain
Files: create `src/world/biomes/index.ts` (types, registry, `regionOf`, `biomeOfRegion`, `biomeWeights`, `dominantBiome`, `blendClimate`), `src/world/biomes/temperate.ts`, `src/world/biomes/exotic.ts`, `src/world/biomes/plants.ts` (plant geometry library + `PlantType`); modify `src/world/terrain.ts` (height/color = weighted biome blend).
- [ ] Implement; build passes; commit `feat: ten landscape biomes in 50-mile regions`.

### Task 2: Per-type vegetation pools
Files: modify `src/world/vegetation.ts` to iterate all biome plant types, choose biome per candidate point by weight, per-type slot pools with draw count = highest used slot.
- [ ] Implement; build passes; commit `feat: plants for every landscape`.

### Task 3: Animals per biome
Files: modify `src/world/animals.ts`: species gain `biomes: BiomeId[]` + `color`; new geometries camel, zebra (striped parts), giraffe, elephant; recolors for reindeer, arctic fox, parrot, capybara, pronghorn, jackrabbit, goat, dairy/brown cow, eagle/vulture/hawk.
- [ ] Implement; build passes; commit `feat: animals that belong to each landscape`.

### Task 4: Climate + label
Files: modify `src/world/skybox.ts` (`setColors`), `src/world/water.ts` (`setColor`), `src/world/weather.ts` (`update(..., climate)`), `src/game.ts` (blend climate each frame, fog), `index.html` + `src/ui/hud.ts` (`#region-label`, `setRegion(name)`).
- [ ] Implement; build passes; commit `feat: sky, weather and a label for each landscape`.

### Task 5: Browser verification
- [ ] Teleport to each of the ten biomes (search region hash), screenshot; border screenshot; fps; label text. Fix, commit.
