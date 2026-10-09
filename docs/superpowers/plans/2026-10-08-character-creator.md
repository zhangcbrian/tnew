# Character Creator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a pick screen (12 spinning animals + 6 spinning wing shapes, Submit top-right, Random Pick) and a color screen (Body/Belly/Left wing/Right wing + Copy left → right) whose result replaces the otter in-game.

**Architecture:** Animal builders and wing builders produce procedural Three.js groups whose colorable parts share a small set of materials, so recoloring is a material color change. A single shared preview `WebGLRenderer` draws every card via scissor viewports. Two DOM overlays drive selection and hand a `CharacterChoice` to `OtterController.setCharacter()`.

**Tech Stack:** Three.js r170, TypeScript strict, Vite.

**Spec:** `docs/superpowers/specs/2026-10-08-character-creator-design.md`

## Global Constraints

- All geometry procedural; `flatShading: true` on colorable materials; no external assets.
- Exactly 12 animals: Sea Otter, Dolphin, Dog, Bunny, Fox, Bear, Penguin, Pig, Frog, Turtle, Horse, Dragon.
- Exactly 6 wings: feathered, bat, butterfly, dragon, fairy, angel.
- Submit button fixed in the top-right corner of the pick screen; disabled until animal + wing chosen.
- Random Pick below the lists; selects but does not submit.
- Characters ~1 unit tall, facing +Z, feet at y≈0 (same frame as the existing otter).
- No test runner exists in this repo; verification is `npm run build` (tsc strict) plus Playwright screenshots. Adding a test framework is out of scope.

## Review Focus

- Re-opening the pick screen via Back keeps previous selections highlighted and Submit enabled.
- Scrolling the pick screen: previews must stay aligned with their cards and never draw outside the scroll area (over the Submit button / header).
- Window resize while a menu is open: preview canvas resizes, no stretched previews.
- Swapping the character must not break walk/fly animation: animation offsets are relative to each part's rest pose, not the otter's hard-coded `0.5`.
- Menu preview renderer must stop its RAF loop when no menu is open (no wasted GPU while playing).

---

### Task 1: Animal kit + 12 animal builders

**Files:**
- Create: `src/character/animals/kit.ts`, `src/character/animals/index.ts`, `src/character/animals/land.ts`, `src/character/animals/water.ts`, `src/character/animals/fantasy.ts`
- Modify: `src/character/otter.ts` (accept materials)

**Interfaces:**
- Produces:
  ```ts
  export type AnimalId = 'otter'|'dolphin'|'dog'|'bunny'|'fox'|'bear'|'penguin'|'pig'|'frog'|'turtle'|'horse'|'dragon';
  export interface AnimalMats { body: MeshStandardMaterial; belly: MeshStandardMaterial; dark; white; accent }
  export interface AnimalDef { id: AnimalId; name: string; body: string; belly: string; wingY: number; wingX: number; build(m: AnimalMats): THREE.Group }
  export const ANIMALS: AnimalDef[];
  export function getAnimal(id: AnimalId): AnimalDef;
  export function createAnimalMats(body: string, belly: string): AnimalMats;
  ```
- Kit helpers: `part(geo, mat, pos, scale?, rot?, name?)`, `eyes(group, m, x, y, z, r)`.
- Builders name `body`, `tail`, `legFL/FR/BL/BR` where present.

- [ ] Step 1: Write `kit.ts` (materials factory + `part` + `eyes`).
- [ ] Step 2: Refactor `createOtter(m?: AnimalMats)` to use passed body/belly materials (default otter colors when omitted).
- [ ] Step 3: Write builders: land (dog, bunny, fox, bear, pig, horse), water (dolphin, penguin, frog, turtle), fantasy (dragon). Register in `index.ts` with default colors and wing anchor.
- [ ] Step 4: `npm run build` → PASS.
- [ ] Step 5: Commit `feat: add procedural animal builders`.

### Task 2: Six wing shapes with per-side colors

**Files:** Modify `src/character/wings.ts`

**Interfaces:**
- Produces:
  ```ts
  export type WingId = 'feathered'|'bat'|'butterfly'|'dragon'|'fairy'|'angel';
  export const WING_TYPES: { id: WingId; name: string; color: string }[];
  export class Wings {
    leftWing: THREE.Group; rightWing: THREE.Group;
    constructor(parent: THREE.Group, type?: WingId, anchorX?: number, anchorY?: number, left?: string, right?: string);
    setColors(left: string, right: string): void;
    update(time: number, flapIntensity: number, isFlying: boolean): void;
    dispose(): void; // removes from parent
  }
  ```
- Each side owns `main` + `accent` materials; accent = main shifted in lightness (`offsetHSL(0,0,0.15)`), so feathered keeps a multi-tone look.
- Per-shape flap params `{ speedMul, angleMul }`: feathered 1/1, bat 1/1, butterfly 1.6/0.7, dragon 0.7/1.2, fairy 2/0.6, angel 0.7/1.2.
- Fairy materials `transparent: true, opacity: 0.55`.

- [ ] Step 1: Rewrite `wings.ts` with shape builders producing a left group; right group built by the same builder with mirrored x (`side` = -1 / +1).
- [ ] Step 2: Existing `new Wings(model)` call still compiles (defaults = feathered, otter anchor, white).
- [ ] Step 3: `npm run build` → PASS. Commit `feat: add wing shapes with per-side colors`.

### Task 3: Character assembly + controller swap

**Files:** Create `src/character/character.ts`; Modify `src/character/otter-controller.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface CharacterChoice { animal: AnimalId; wings: WingId; colors: { body: string; belly: string; wingLeft: string; wingRight: string } }
  export function defaultColors(animal: AnimalId, wings: WingId): CharacterChoice['colors'];
  export interface BuiltCharacter { group: THREE.Group; wings: Wings | null; mats: AnimalMats; }
  export function buildCharacter(animal: AnimalId, wings: WingId | null, colors: CharacterChoice['colors']): BuiltCharacter;
  export function applyColors(c: BuiltCharacter, colors): void;
  ```
- `OtterController.setCharacter(choice)`: removes old children from `model`, adds built group's children (keeps `model` object so camera/scene refs stay valid), replaces `wings`, re-caches named parts and records each part's rest `position.y` / `rotation.x`; animation uses `restY + offset` and `restRotX + offset`.

- [ ] Step 1: Implement `character.ts`.
- [ ] Step 2: Implement `setCharacter` and rest-pose-relative animation.
- [ ] Step 3: `npm run build` → PASS. Commit `feat: swap player character from a CharacterChoice`.

### Task 4: Shared preview renderer

**Files:** Create `src/ui/preview-renderer.ts`

**Interfaces:**
- Produces:
  ```ts
  export class PreviewRenderer {
    add(el: HTMLElement, object: THREE.Object3D, opts?: { distance?: number; clip?: HTMLElement }): void;
    clear(): void;            // remove all views
    start(): void; stop(): void;
  }
  export const previewRenderer: PreviewRenderer; // singleton, lazy canvas
  ```
- Fixed full-viewport canvas, `pointer-events:none`, `z-index: 120` (above menu overlays at 110), alpha clear each frame. Each view: own scene with hemi + directional light, a green grass disc (`CylinderGeometry(1.4,1.4,0.1,16)`, color `#5a9e3a`), the object on a pivot rotating `0.6 rad/s`. Camera `PerspectiveCamera(35)` looking at object center. Rect = `el.getBoundingClientRect()` intersected with `clip` rect; skip if empty. Uses `setScissorTest(true)`, `setViewport/ setScissor` with y flipped.

- [ ] Step 1: Implement. `npm run build` → PASS. Commit `feat: add shared preview renderer`.

### Task 5: Pick screen + color screen + game wiring

**Files:** Create `src/ui/character-select.ts`, `src/ui/color-screen.ts`; Modify `index.html`, `src/game.ts`

**Interfaces:**
- `CharacterSelect.open(prev?: {animal, wings}, onSubmit: (animal, wings) => void)`; `close()`.
- `ColorScreen.open(animal, wings, onBack: () => void, onStart: (choice: CharacterChoice) => void)`; `close()`.
- `game.ts`: Play Game → `characterSelect.open(...)`; submit → `colorScreen.open(...)`; Back → `characterSelect.open(prevSelection, ...)`; Start → `otter.setCharacter(choice)`, `state='playing'`, `hud.show()`.
- Markup: `#character-select` (header with title + `#cs-submit` fixed top-right, `#cs-scroll` with `#cs-animals` grid, `#cs-wings` grid, `#cs-random`), `#color-screen` (`#color-preview`, four `<input type="color">`, `#copy-wings`, `#color-back`, `#color-start`). Card backgrounds: sky gradient `linear-gradient(#87ceeb, #cfeffd)`.

- [ ] Step 1: Markup + CSS in `index.html`.
- [ ] Step 2: `character-select.ts` (cards, selection highlight, Submit disabled state, Random Pick scrolls chosen cards into view).
- [ ] Step 3: `color-screen.ts` (live preview recolor, Copy left → right updates the right input and preview).
- [ ] Step 4: Wire into `game.ts`.
- [ ] Step 5: `npm run build` → PASS. Commit `feat: character pick and color screens`.

### Task 6: Browser verification

- [ ] Playwright at 1440×900: title → Play Game → pick screen screenshot (Submit disabled). Random Pick → Submit enabled. Scroll and confirm previews clipped. Submit → color screen; change Left wing, Copy left → right, confirm right input value equals left. Back → selections preserved. Start → in-game screenshot (third-person) shows chosen animal/wings/colors and flying works (hold Space).
- [ ] Repeat in-game check for at least 3 other animal/wing combos.
- [ ] Narrow viewport (390×844) screenshot of pick screen: no horizontal scroll.
- [ ] Fix anything found; final `npm run build`; commit.
