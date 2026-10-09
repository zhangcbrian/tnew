# Polished Avatar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Smooth, detailed, animated player animals and jointed wings.

**Architecture:** `character/rig.ts` (Rig type, smooth-shape toolkit, materials, shading bake) → per-animal builders returning a Rig → `character/animator.ts` drives any Rig by gait → `wings.ts` jointed wings with fold/flap → controller and previews use Animator.

**Tech Stack:** Three.js r170 (MeshPhysicalMaterial sheen/clearcoat/iridescence), TypeScript.

**Spec:** `docs/superpowers/specs/2026-10-08-polished-avatar-design.md`

## Global Constraints
- Rig root faces +Z, feet at y = 0, ~1 unit tall; collision box unchanged.
- `buildCharacter(animal, wings, colors)` and `applyColors` keep their signatures.
- Body/belly/wing colors stay customizable.
- No test runner: build + Playwright screenshots/frame timing.

## Review Focus
- Every animal's rig has the parts the animator touches (or the animator tolerates missing ones).
- Recoloring after build (color screen) updates every body/belly part, including eyelids/ears.
- Preview screens: 18 detailed models spinning + animating must stay smooth and be disposed.
- Wing fold/flap transitions are continuous (no snapping) on takeoff/landing.
- Turning while flying banks smoothly; heading wraparound (±π) doesn't cause a spin.

---

### Task 1: Rig toolkit + materials (`src/character/rig.ts`)
### Task 2: Twelve animal builders (`src/character/animals/*.ts`, `index.ts`)
### Task 3: Animator (`src/character/animator.ts`) + controller integration
### Task 4: Jointed wings (`src/character/wings.ts`)
### Task 5: Previews animate; screenshots; frame timing; fix; commit
