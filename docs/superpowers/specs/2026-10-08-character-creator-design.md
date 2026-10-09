# Character Creator — Design

Date: 2026-10-08
Status: Approved in chat, awaiting written-spec review

## Goal

Let the player build their own character before playing: pick an animal and a wing
shape from big visual lists, then color it, with a one-click way to make both wings
match. The original Winged Sea Otter stays available as one of the choices.

## Player Flow

```
Title screen ──Play Game──▶ Pick screen ──Submit──▶ Color screen ──Start──▶ Playing
                               ▲                        │
                               └─────────Back───────────┘
Game Over ──Play Again──▶ Playing (same character, no re-pick)
```

## Pick Screen (animals + wings on one screen)

- Full-screen overlay, scrollable if it does not fit.
- **Submit** button fixed in the top-right corner. Disabled until both an animal and
  a wing shape are selected.
- **Animals section:** grid of 12 cards. Each card shows the animal slowly spinning
  (no wings attached) in front of a spawn-area backdrop (green grass ground disc,
  sky-blue gradient background), with the animal's name underneath. Clicking a card
  selects it (highlighted border); only one animal can be selected.
- **Wings section:** row of 6 cards, same style, each showing one wing pair spinning.
  Only one can be selected.
- **Random Pick** button below the lists: selects a random animal and a random wing
  shape (highlighting them). It does not auto-submit.

### Animals (12)

Sea Otter (existing model), Dolphin, Dog, Bunny, Fox, Bear, Penguin, Pig, Frog,
Turtle, Horse, Dragon.

### Wing shapes (6)

| Id | Look | Flap feel |
|----|------|-----------|
| feathered | Current otter wings (layered feathers) | current behaviour |
| bat | Pointed membrane between thin bone struts | current speed |
| butterfly | Large rounded upper + lower lobes | faster, shallower flutter |
| dragon | Large, spiky trailing edge, claw at tip | slower, deeper flap |
| fairy | Thin, translucent, elongated | fast flutter |
| angel | Wide, fluffy, many large feathers | slower, deeper flap |

## Color Screen

- Large preview of the chosen animal with chosen wings, slowly spinning, same backdrop.
- Four color slots using native `<input type="color">`: **Body**, **Belly**,
  **Left wing**, **Right wing**. Defaults come from the animal's default colors and the
  wing's default color. Changing a slot updates the preview immediately.
- **Copy left → right** button: sets Right wing color = Left wing color.
- **Back** returns to the pick screen with the previous selections still highlighted.
- **Start** hides the screen and begins play.

## In-Game

- The chosen animal + wings + colors replaces the otter model. All controller behaviour
  (walk, fly, fall, rockets, repel, building, cameras) is unchanged.
- The game world keeps loading behind the title screen as today; the character is
  swapped in when Start is pressed.

## Architecture

### Character choice

```ts
interface CharacterChoice {
  animal: AnimalId;
  wings: WingId;
  colors: { body: string; belly: string; wingLeft: string; wingRight: string };
}
```

### Units

- `src/character/animals/` — one file per animal (or grouped where small), plus
  `index.ts` with a registry: `{ id, name, build(): AnimalModel, defaults: {body, belly} }`.
  - `AnimalModel` = `{ group: THREE.Group, bodyMaterial, bellyMaterial, wingAnchor: {left: Vector3, right: Vector3} }`.
  - Builders name sub-meshes `body`, `tail`, `legFL/FR/BL/BR` where they exist so the
    existing controller animation keeps working (it already tolerates missing parts).
  - Sea Otter builder wraps the existing `createOtter()`.
  - All geometry procedural, `flatShading: true`, matching the otter's scale (~1 unit tall).
- `src/character/wings.ts` — `Wings` takes a `WingId`, anchor positions and two colors;
  builds left/right groups for that shape; exposes `setColors(left, right)`; `update()`
  uses per-shape flap parameters.
- `src/character/build-character.ts` — `buildCharacter(choice)` → group with animal + wings,
  colors applied. Used by previews and the game.
- `src/ui/preview-renderer.ts` — one shared `THREE.WebGLRenderer` on a fixed full-screen
  canvas overlaying the menu. Each card registers a DOM element + small scene; each frame
  it renders every visible card into that element's rectangle using scissor/viewport.
  Avoids per-card WebGL contexts (browser cap ~16). Stops its loop when no screen is open.
- `src/ui/character-select.ts` — pick screen DOM, selection state, Random Pick, Submit.
- `src/ui/color-screen.ts` — color slots, copy button, Back/Start.
- `OtterController` — gains `setCharacter(choice)` which swaps `model` children and
  `wings` and re-caches named parts, keeping position/state.
- `game.ts` — Play Game opens the pick screen instead of starting play; Start calls
  `otter.setCharacter(choice)` then enters `playing`. Play Again keeps the choice.
- `index.html` — markup + CSS for the two new overlays.

## Out of Scope

- Saving the character between browser sessions.
- Brush painting or per-feather coloring.
- Different gameplay abilities per animal.
- Touch-specific layout beyond the grid wrapping naturally on narrow screens.

## Testing

`npm run build` must pass (type-check). Manual browser verification via Playwright:
screenshot pick screen (cards spinning, Submit disabled → enabled), Random Pick, color
screen (preview updates, Copy left → right works), in-game screenshot for several
animal/wing combos, Game Over → Play Again keeps the character.
