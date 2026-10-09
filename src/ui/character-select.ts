import { ANIMALS, type AnimalId } from '../character/animals';
import { WING_TYPES, type WingId } from '../character/wings';
import { buildCharacter, defaultColors } from '../character/character';
import { previewRenderer } from './preview-renderer';

export interface Selection {
  animal: AnimalId;
  wings: WingId;
}

/** Pick screen: a grid of spinning animals and a grid of spinning wing shapes. */
export class CharacterSelect {
  private el = document.getElementById('character-select')!;
  private scroll = document.getElementById('cs-scroll')!;
  private animalGrid = document.getElementById('cs-animals')!;
  private wingGrid = document.getElementById('cs-wings')!;
  private submitBtn = document.getElementById('cs-submit') as HTMLButtonElement;
  private animal: AnimalId | null = null;
  private wings: WingId | null = null;
  private animalCards = new Map<AnimalId, HTMLElement>();
  private wingCards = new Map<WingId, HTMLElement>();
  private onSubmit: ((s: Selection) => void) | null = null;

  constructor() {
    for (const a of ANIMALS) {
      this.animalCards.set(a.id, this.makeCard(this.animalGrid, a.name, () => this.selectAnimal(a.id)));
    }
    for (const w of WING_TYPES) {
      this.wingCards.set(w.id, this.makeCard(this.wingGrid, w.name, () => this.selectWings(w.id)));
    }

    document.getElementById('cs-random')!.addEventListener('click', () => {
      const a = ANIMALS[Math.floor(Math.random() * ANIMALS.length)].id;
      const w = WING_TYPES[Math.floor(Math.random() * WING_TYPES.length)].id;
      this.selectAnimal(a);
      this.selectWings(w);
    });

    this.submitBtn.addEventListener('click', () => {
      if (!this.animal || !this.wings) return;
      const selection = { animal: this.animal, wings: this.wings };
      this.close();
      this.onSubmit?.(selection);
    });
  }

  open(onSubmit: (s: Selection) => void) {
    this.onSubmit = onSubmit;
    this.el.classList.add('visible');

    // Previews are rebuilt on each open; the renderer is shared with the color screen.
    previewRenderer.clear();
    for (const a of ANIMALS) {
      const built = buildCharacter(a.id, null, defaultColors(a.id, 'feathered'));
      previewRenderer.add(this.viewOf(this.animalCards.get(a.id)!), built.group, this.scroll);
    }
    for (const w of WING_TYPES) {
      const built = buildCharacter('otter', w.id, defaultColors('otter', w.id));
      // Show only the wings, spread as if flying.
      built.group.children.slice().forEach((c) => {
        if (c !== built.wings!.leftWing && c !== built.wings!.rightWing) c.visible = false;
      });
      built.wings!.update(0, 0, true);
      previewRenderer.add(this.viewOf(this.wingCards.get(w.id)!), built.group, this.scroll);
    }
    previewRenderer.start();
  }

  close() {
    this.el.classList.remove('visible');
    previewRenderer.stop();
  }

  private makeCard(grid: HTMLElement, name: string, onClick: () => void): HTMLElement {
    const card = document.createElement('button');
    card.className = 'card';
    card.innerHTML = '<span class="card-view"></span><span class="card-name"></span>';
    card.querySelector('.card-name')!.textContent = name;
    card.addEventListener('click', onClick);
    grid.appendChild(card);
    return card;
  }

  private viewOf(card: HTMLElement): HTMLElement {
    return card.querySelector('.card-view') as HTMLElement;
  }

  private selectAnimal(id: AnimalId) {
    this.animal = id;
    this.highlight(this.animalCards, id);
    this.updateSubmit();
  }

  private selectWings(id: WingId) {
    this.wings = id;
    this.highlight(this.wingCards, id);
    this.updateSubmit();
  }

  private highlight<K>(cards: Map<K, HTMLElement>, id: K) {
    for (const [key, card] of cards) card.classList.toggle('selected', key === id);
    cards.get(id)!.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  private updateSubmit() {
    this.submitBtn.disabled = !(this.animal && this.wings);
  }
}
