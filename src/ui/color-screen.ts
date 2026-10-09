import type { AnimalId } from '../character/animals';
import type { WingId } from '../character/wings';
import {
  applyColors, buildCharacter, defaultColors, type BuiltCharacter, type CharacterChoice, type CharacterColors,
} from '../character/character';
import { previewRenderer } from './preview-renderer';
import { Animator } from '../character/animator';

/** Color screen: four color slots, a live spinning preview, and a button that copies the left wing to the right. */
export class ColorScreen {
  private el = document.getElementById('color-screen')!;
  private preview = document.getElementById('color-preview')!;
  private scroll = document.getElementById('color-scroll')!;
  private inputs: Record<keyof CharacterColors, HTMLInputElement> = {
    body: document.getElementById('color-body') as HTMLInputElement,
    belly: document.getElementById('color-belly') as HTMLInputElement,
    wingLeft: document.getElementById('color-wing-left') as HTMLInputElement,
    wingRight: document.getElementById('color-wing-right') as HTMLInputElement,
  };
  private built: BuiltCharacter | null = null;
  private animal: AnimalId = 'otter';
  private wings: WingId = 'feathered';
  private onBack: (() => void) | null = null;
  private onStart: ((c: CharacterChoice) => void) | null = null;

  constructor() {
    for (const input of Object.values(this.inputs)) {
      input.addEventListener('input', () => this.refresh());
    }
    document.getElementById('copy-wings')!.addEventListener('click', () => {
      this.inputs.wingRight.value = this.inputs.wingLeft.value;
      this.refresh();
    });
    document.getElementById('color-back')!.addEventListener('click', () => {
      this.close();
      this.onBack?.();
    });
    document.getElementById('color-start')!.addEventListener('click', () => {
      const choice = { animal: this.animal, wings: this.wings, colors: this.colors() };
      this.close();
      this.onStart?.(choice);
    });
  }

  /** Re-opening with the same animal and wings (after Back) keeps the colors picked before. */
  open(animal: AnimalId, wings: WingId, onBack: () => void, onStart: (c: CharacterChoice) => void) {
    const same = this.built !== null && animal === this.animal && wings === this.wings;
    const start = same ? this.colors() : defaultColors(animal, wings);
    this.animal = animal;
    this.wings = wings;
    this.onBack = onBack;
    this.onStart = onStart;

    for (const key of Object.keys(this.inputs) as (keyof CharacterColors)[]) {
      this.inputs[key].value = start[key];
    }

    this.built = buildCharacter(animal, wings, start);
    this.built.wings!.pose(0.85); // spread, so both wing colors show
    const animator = new Animator(this.built.rig, null);
    this.el.classList.add('visible');
    previewRenderer.clear();
    previewRenderer.add(this.preview, this.built.group, this.scroll,
      (dt, t) => animator.update(dt, t, { speed: 0, flying: false, climb: 0, turn: 0 }));
    previewRenderer.start();
  }

  close() {
    this.el.classList.remove('visible');
    previewRenderer.stop();
  }

  private colors(): CharacterColors {
    return {
      body: this.inputs.body.value,
      belly: this.inputs.belly.value,
      wingLeft: this.inputs.wingLeft.value,
      wingRight: this.inputs.wingRight.value,
    };
  }

  private refresh() {
    if (this.built) applyColors(this.built, this.colors());
  }
}
