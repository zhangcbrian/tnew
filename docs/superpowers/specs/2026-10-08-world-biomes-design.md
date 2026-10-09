# World of Landscapes (Biomes) — Design

Date: 2026-10-08
Status: Approved in chat ("yes, build it")

## Goal

Make the endless world a patchwork of real-world landscapes. Each landscape region is
50 × 50 miles; regions tile forever. Most regions look Highland-like; about one in three is
something very different (desert, rainforest, ...), arranged randomly — a "chaos" world.

## Decisions from the conversation

- Region size: real 50 miles = **80,467 units** (1 unit ≈ 1 m). No speed boost.
- Ten landscapes:
  - Highland-like (≈ 2/3 of regions): Scottish Highlands, Norwegian Fjords, Irish Countryside,
    Swiss Alps, New Zealand Hills.
  - Very different (≈ 1/3): Sahara Desert, Amazon Rainforest, American Southwest,
    African Savanna, Arctic Tundra.
- Spawn region (0, 0) is always the Scottish Highlands (start feels the same as today).
- Region borders blend over ~800 units (half a mile) — heights, colors, plants mix.
- On-screen label shows the current landscape name.

## Design

### Regions
- `regionOf(x, z) = (round(x / R), round(z / R))`, R = 80,467. Region (0,0) is centered on spawn.
- `biomeOfRegion(rx, rz)`: (0,0) → Highlands; else seeded hash: `h % 3 === 0` → one of the 5
  exotic biomes, else one of the 5 Highland-like biomes. Deterministic.
- `biomeWeights(x, z)`: 1–4 (biome, weight) pairs. Inside a region weight 1. Within 400 units
  of an edge, the two (or four at corners) regions mix with smoothstep weights, 50/50 on the line.

### Biome definition (one object per landscape)
- `height(x, z)`, `color(x, z, h, slope, out)`, `plants: PlantType[]`, `animals: species ids`,
  `climate: { skyTop, skyBottom, fog, fogNear, fogFar, water, rain: 0..1, snow: boolean }`.
- Terrain height/color = weighted blend of biome heights/colors (spawn flattening kept).

| Landscape | Shape | Colors | Plants | Animals |
|---|---|---|---|---|
| Highlands | as today | heather/moor/rock/snow | pine, birch, heather, gorse, bracken, boulder, grass | red deer, rabbit, bird, fish, Highland cow, sheep |
| Fjords | high steep mountains, deep inlets far below water | dark green, grey rock, snow | spruce, birch, boulder, grass | red deer, eagle, fish, sheep |
| Ireland | gentle rolling hills, small loughs | vivid green | oak, hawthorn bush, grass, stone | sheep (common), rabbit, bird, dairy cow |
| Alps | green valley meadows + very tall snowy peaks | meadow green, rock, snow | spruce, wildflowers, boulder | brown cow, goat, bird |
| New Zealand | bright rolling hills, lakes | bright green, golden tussock | tree fern, round tree, tussock | sheep (common), bird, fish |
| Sahara | dunes, rocky outcrops, rare oasis (water + palms) | gold sand, ochre rock | palm (oasis), dry shrub, rock | camel, bird (vulture) |
| Amazon | low, flat, rivers | deep greens, mud banks | kapok giant, jungle tree, big-leaf understory | parrot, capybara, fish |
| Southwest | stepped mesas, canyons | red/orange rock, sand | saguaro, sagebrush, juniper, red boulder | pronghorn, jackrabbit, hawk |
| Savanna | flat golden plains, kopje rocks, rare waterhole | golden grass, red earth | acacia, tall grass, termite mound | zebra, giraffe, elephant, bird |
| Arctic | flat snowy plains, frozen-looking lakes | snow, ice blue, grey rock | low shrub, snowy rock, dwarf spruce | reindeer, arctic fox, white bird |

### Systems
- **Vegetation:** every plant type has its own instance pool; a chunk only takes a slot in a
  type's pool when it places at least one of that type; each pool draws only up to its highest
  used slot (deserts don't pay for pines).
- **Animals:** each species lists its biomes; it only spawns where that biome dominates.
- **Climate:** each frame, blend the climate of `biomeWeights(player)` → sky colors, fog,
  water color, weather (rain chance, snow).
- **HUD:** `#region-label` at top center shows the dominant landscape name; fades on change.

## Out of scope
- Speed boost. Real-world map data. Per-biome people. Float precision beyond ~±500,000 units
  (far regions may show slight jitter of small objects).

## Testing
- `npm run build` passes.
- Browser: teleport into each of the ten landscapes (region centers found by searching the
  region hash), screenshot each; screenshot a blended border; fps stays reasonable; label updates.
