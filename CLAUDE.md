# Winged Sea Otter Explorer

A 3D browser game built with Three.js and TypeScript where the player controls a winged sea otter exploring a procedurally generated world that transitions from realistic terrain to surreal landscapes at its edges.

## Quick Start

```bash
npm run dev      # Start Vite dev server at http://localhost:5173
npm run build    # Type-check (tsc) + production build
npm run preview  # Preview production build
```

## Tech Stack

- **Three.js** (r170) - 3D rendering, all geometry is procedural (no external models/assets)
- **TypeScript** - strict mode enabled
- **Vite** - bundler, ES2020 target
- **simplex-noise** - terrain and vegetation placement

## Architecture

Entry point: `src/main.ts` instantiates `Game`. The `Game` class (`src/game.ts`) owns the render loop, scene graph, and all subsystems.

### Directory Layout

```
src/
├── main.ts                    # Entry point
├── game.ts                    # Game loop, scene setup, system orchestration
├── character/
│   ├── otter.ts               # Procedural otter mesh (createOtter())
│   ├── otter-controller.ts    # Movement, state machine, animation
│   ├── wings.ts               # Wing mesh + flap animation
│   └── rockets.ts             # Rocket projectile system
├── camera/
│   ├── camera-system.ts       # Camera mode manager (toggle V key)
│   ├── third-person.ts        # Orbit camera with mouse/scroll control
│   └── first-person.ts        # FPS camera attached to otter head
├── controls/
│   └── input-manager.ts       # Keyboard, mouse, touch input handling
├── world/
│   ├── terrain.ts             # Height function, vertex coloring, chunk mesh creation
│   ├── chunk-manager.ts       # Chunk generation/visibility management
│   ├── water.ts               # Water plane with gentle bob animation
│   ├── vegetation.ts          # Instanced trees, bushes, rocks, grass
│   ├── surreal-zone.ts        # Floating shapes + crystals in outer zones
│   ├── cactus-border.ts       # Cactus ring boundary + isOutsideBorder()
│   └── skybox.ts              # Procedural sky shader with sun glow
├── ui/
│   ├── loading.ts             # Loading screen progress bar
│   ├── game-over.ts           # Game over overlay + play again button
│   └── hud.ts                 # Controls hint overlay
└── utils/
    ├── noise.ts               # octaveNoise(), ridgedNoise() wrappers
    └── math-helpers.ts        # lerp, clamp, smoothstep, inverseLerp
```

### Key Systems

**Game Loop** (`game.ts`): Uses `requestAnimationFrame` with delta time capped (~80ms). Has a phased loading sequence (terrain batches -> vegetation -> surreal zone -> cacti -> ready) before entering the main update loop.

**Terrain** (`world/terrain.ts`): 2048x2048 world divided into 64x64 chunks. Height is simplex noise with octaves; center is flattened for spawn. `getSurrealFactor(x, z)` returns 0-1 based on distance from center, used to blend realistic/surreal colors and control object placement. Runtime movement/AI use `getTerrainHeightCached()` which samples a cached heightfield built during chunk generation.

**Otter State Machine** (`character/otter-controller.ts`): States are `IDLE | WALK | FLY | FALL | GAME_OVER`. Movement is camera-relative. Flying ascends/descends with Space/Shift. Crossing the cactus border triggers `FALL` -> `GAME_OVER` after 1.5s.

**Input** (`controls/input-manager.ts`): Keyboard (WASD/arrows + Space/Shift/V/B), mouse look/orbit via pointer lock (click canvas to lock), scroll zoom, and touch controls (virtual joystick + buttons). Uses consume pattern for one-shot events (camera toggle, rocket shoot).

**Instanced Rendering**: Vegetation, surreal objects, and cacti all use `THREE.InstancedMesh` with per-instance colors for performance.

**Procedural Sky** (`world/skybox.ts`): Custom `ShaderMaterial` on an inverted sphere with gradient + sun glow effect.

## Controls

| Key | Action |
|-----|--------|
| WASD / Arrows | Move |
| Space (hold) | Fly / ascend |
| Shift (hold) | Descend while flying |
| V | Toggle third-person / first-person camera |
| B | Shoot rocket |
| Mouse | Orbit camera (3rd person) / Look (1st person) |
| Scroll | Zoom in/out (3rd person) |

Touch controls are shown on `pointer: coarse` devices.

## Conventions

- All 3D models are procedural geometry (no .glb/.gltf files)
- Classes expose a `group` or `mesh` property for scene graph attachment
- Subsystems are updated from the game loop with `update(dt)` or `update(time)`
- UI elements are defined in `index.html` with CSS, manipulated via DOM in `src/ui/`
- Flat shading (`flatShading: true`) is used throughout for a low-poly aesthetic
- Physics is simple custom code (no physics engine): gravity, terrain snapping, velocity lerping

## World Zones

The world has concentric zones controlled by `getSurrealFactor()`:
- **Center** (0-40%): Flat spawn area with realistic grass/dirt/rock terrain
- **Mid** (40-60%): Transition zone, colors begin shifting
- **Outer** (60-90%): Surreal zone with floating shapes, crystals, mushroom trees, vibrant colors
- **Border** (~92%): Cactus ring boundary; crossing it triggers fall + game over

## Important Constants

| Constant | File | Value | Purpose |
|----------|------|-------|---------|
| `WORLD_SIZE` | terrain.ts | 2048 | Total world extent |
| `CHUNK_SIZE` | terrain.ts | 64 | Terrain chunk dimensions |
| `BORDER_RADIUS` | cactus-border.ts | ~942 | Cactus ring radius |
| `VIEW_DISTANCE` | chunk-manager.ts | 500 | Chunk visibility range |
| `WALK_SPEED` | otter-controller.ts | 8 | Ground movement speed |
| `FLY_SPEED` | otter-controller.ts | 15 | Flying movement speed |
| `MAX_ROCKETS` | rockets.ts | 20 | Max simultaneous rockets |
