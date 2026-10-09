# Polished Player Animal — Design

Date: 2026-10-08
Status: Approved in chat ("D", style "A", "yes, build it")

## Goal
Make the player's animal (12 animals, 6 wing types) look and move like a polished, smooth,
toy-like "hero" character, while the world stays low-poly. More GPU is fine for the avatar.

## Design

### Rig (shared by all animals)
Every builder returns a `Rig`: `root` (faces +Z, feet at y=0, ~1 unit tall), `body` (torso pivot),
`head` (head pivot), `legs[]` (hip pivot + optional knee pivot, side, front/back), `tail[]`
(pivot chain), `ears[]`, `eyelids[]` (scaled to blink), `gait` (`quad` | `biped` | `hop` |
`swim` | `plod`), `wingAnchor`, plus the colorable materials. Joints are plain Object3D pivots
(no skinning).

### Shapes
Smooth shading, high segment counts (≈ 20–60k triangles per animal). Toolkit: ellipsoids,
lathe-profiled torsos/heads/necks, capsules, variable-radius sweeps along curves (tails, horns,
necks), cupped ears. Per-animal details: otter whiskers/round face, fox white-tipped brush tail,
horse mane/hooves, penguin flippers, frog wide mouth + bulging eyes, turtle patterned shell,
dolphin smooth body + fluke, dragon horns/spines/ridges, bear round ears, pig snout, dog floppy
ears, bunny long ears + cotton tail.

### Materials
- Fur/skin: `MeshPhysicalMaterial` with sheen (soft rim), roughness ≈ 0.8, smooth shading.
- Baked soft shading: vertex-color multiplier (darker underneath, under chin, toward feet),
  so any customized body/belly color still works.
- Eyes: sclera, colored iris, pupil, white catch-light, clear-coat cornea; eyelids in body color.
- Nose, claws, hooves, horns: their own glossy materials.

### Animation (`Animator`)
Inputs per frame: dt, ground speed (0..1+), flying, vertical speed, turn rate.
- `quad`: diagonal-pair walk cycle, hip swing + knee bend on lift, body bob/roll, head counter-bob.
- `biped` (penguin): alternating steps with side-to-side waddle roll.
- `hop` (frog): hop arcs while moving, back legs extend.
- `swim` (dolphin): body + tail undulation.
- `plod` (turtle): slow, low quad cycle with head bob.
- Idle: breathing, blinking every 2–6 s, glancing around, random ear twitches, tail sway with lag.
- Flying: legs tucked, body pitches with climb/dive, banks into turns.

### Wings
Jointed (shoulder + wrist) so they fold against the body on the ground and sweep open to fly.
Feathered/angel: layered coverts + long primaries. Bat/dragon: curved membranes between bones.
Butterfly: patterned gradients, fold upward. Fairy: translucent with iridescent sheen.
Left/right colors and Copy left→right unchanged.

### Unchanged
Pick screen, colors, gameplay, controls, collision box. Pick/color screen previews use the new
models (with idle animation).

## Testing
`npm run build`; close-up screenshots of all 12 animals and 6 wings; in-game walk/idle/fly/turn/
land; frame rate stays smooth.
