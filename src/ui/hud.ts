export class HUD {
  private el: HTMLElement;
  private blockSlots: NodeListOf<Element>;
  private regionLabel: HTMLElement;
  private regionName = '';

  constructor() {
    this.el = document.getElementById('hud')!;
    this.regionLabel = document.getElementById('region-label')!;
    this.blockSlots = document.querySelectorAll('.block-slot');
  }

  show() {
    this.el.style.opacity = '1';
    this.regionLabel.classList.add('visible');
  }

  hide() {
    this.el.style.opacity = '0';
    this.regionLabel.classList.remove('visible');
  }

  /** Name of the landscape the player is in; briefly highlights when it changes. */
  setRegion(name: string) {
    if (name === this.regionName) return;
    this.regionName = name;
    this.regionLabel.textContent = name;
    this.regionLabel.classList.remove('changed');
    void this.regionLabel.offsetWidth; // restart the highlight animation
    this.regionLabel.classList.add('changed');
  }

  updateBlockSelection(index: number) {
    this.blockSlots.forEach((slot, i) => {
      slot.classList.toggle('selected', i === index);
    });
  }
}
