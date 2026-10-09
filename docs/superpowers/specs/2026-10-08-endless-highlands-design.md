# Endless Highlands + Solid Blocks — Design

Date: 2026-10-08
Status: Approved in chat, awaiting written-spec review

## Goal

Turn the finite 2048×2048 world (realistic center → surreal edge → cactus ring) into an
endless, natural landscape modeled on the Scottish Highlands, and make placed blocks
solid for every moving thing.

## Decisions from the conversation

- World: endless and flat (not a planet, not wrapping). Same place always looks the same.
- Look: as close as possible to the Scottish Highlands, as natural as possible.
- Surreal content removed entirely (floating shapes, crystals, mushroom trees, surreal colors).
- Cactus ring, border bounce and border fall removed.
- Blocks are solid for the player, animals and people.
- Highland cows and sheep added, but rare ("not so much").

## 1. Landscape

### Terrain shape (`getTerrainHeight(x, z)`, deterministic, unbounded)
- **Glens:** broad low valleys from a low-frequency noise field shaped so valley floors are
  wide and flat-ish and sides rise steeply (U-shaped).
- **Hills / mountains:** mid-frequency rounded hills on top, plus ridged noise to give rocky
  ridges and peaks in the high areas only.
- **Lochs:** any ground below the global water level (y = 0) is water. Glen floors dip below
  it often enough to form long lochs.
- **Spawn:** the origin sits on a gentle, dry glen floor next to a loch (flatten radius ~40,
  height clamped a little above water).
- Max height roughly 3–4× current (~100 units) so hills feel big; walk/fly speeds unchanged.

### Terrain colors (vertex colors, chosen by height + slope + noise)
| Where | Color |
|-------|-------|
| Shore just above water | grey-brown shingle |
| Low flat ground | olive moor grass, patched with rust bracken |
| Mid slopes | heather (muted purple-brown), mixed with moor grass by noise |
| Steep slopes (any height) | grey rock / scree |
| Highest peaks | patchy snow |
| Under water | dark peaty brown (seen through water) |

### Vegetation (per chunk, deterministic from chunk coords)
- Scots pine clusters in sheltered low/mid ground (low slope, below a height limit).
- Scattered silver birch on low slopes.
- Heather clumps (purple), gorse bushes (dark green + yellow) on mid slopes.
- Bracken patches, grass tufts on low ground.
- Boulders, more frequent on steep/high ground.
- Nothing below water or on steep rock.

### Sky, light, air
- Sky shader recolored to a softer, slightly hazy northern sky.
- Scene fog (light grey-blue) so distant hills fade instead of ending at a hard edge.
- Weather kept, rules no longer use surreal factor: mist and light rain more likely,
  chosen by time / random rather than by distance.

## 2. Endless world

- **Chunk streaming:** `ChunkManager` keeps chunks within the view radius of the player.
  Missing chunks are generated a few per frame (closest first); chunks beyond the radius
  plus a margin are disposed (mesh, vegetation, cached heights).
- **Vegetation streaming:** vegetation instances are created per chunk with the chunk and
  removed with it (instanced meshes per chunk, or a pooled per-type instanced mesh — plan
  decides).
- **Height cache:** `getTerrainHeightCached` keeps working; cache entries removed with chunks;
  falls back to noise when missing (already does).
- **Water:** the water plane follows the player (snapped to avoid texture swimming).
- **Loading screen:** generates only chunks near spawn, then the rest stream in during play.
- **Removed:** `cactus-border.ts`, `surreal-zone.ts`, `getSurrealFactor`, border checks in
  the controller, `HALF_WORLD`-based placement everywhere.

## 3. Animals and people

- Wildlife: red deer (from existing deer), rabbits, birds overhead, fish in lochs.
  Turtles and jellyfish removed.
- New: Highland cows (shaggy ginger, horns) and sheep (white woolly, dark face), rare —
  a small herd of 2–4 appears occasionally, not in every glen.
- People stay (as hikers), with their existing behaviour.
- **Spawning around the player:** fixed pools; anything farther than a despawn radius from
  the player is moved to a fresh valid spot in a ring around the player (land animals on dry
  ground, fish in water deeper than a threshold, cows/sheep on low gentle grass).

## 4. Solid blocks

- `BuildingSystem` exposes queries on its 1-unit block grid:
  - `isBlockAt(x, y, z): boolean`
  - `getSupportHeight(x, z, fromY): number` — top of the highest block column at (x, z) whose
    top is at or below `fromY + step`, else −Infinity.
- **Player:** treated as a box (~0.8 wide, height from character bounds ~1.2).
  - Horizontal move resolved per axis: if the new box overlaps a block, that axis's move is
    cancelled (gives sliding along walls).
  - Ground = max(terrain, block support under the box). Can land and stand on blocks, step up
    ≤ 0.5 when walking; flying up into a block's underside stops the ascent.
- **Animals and people:** before moving, check the cell at their next position at their body
  height; if blocked, don't move and pick a new heading. Ground height also uses block support
  so nothing sinks into blocks.
- Placing a block where a creature or the player currently stands is refused.

## Out of scope

- Real-world elevation data or real map locations.
- Saving placed blocks between sessions.
- Physics for blocks (they don't fall).
- Changing walk/fly speeds or controls.

## Testing

- `npm run build` passes.
- Browser (Playwright): screenshot spawn glen + loch; fly ~3000 units in one direction and
  confirm terrain keeps appearing with no edge and frame rate stays reasonable; screenshots of
  hills/heather/pines/snowy peak.
- Build a wall: walking into it stops the player; fly onto it and stand; fly up under a block
  and stop. Watch a nearby animal/person turn away from a block wall.
