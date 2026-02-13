export class HUD {
  private el: HTMLElement;
  private blockSlots: NodeListOf<Element>;

  constructor() {
    this.el = document.getElementById('hud')!;
    this.blockSlots = document.querySelectorAll('.block-slot');
  }

  show() {
    this.el.style.opacity = '1';
  }

  hide() {
    this.el.style.opacity = '0';
  }

  updateBlockSelection(index: number) {
    this.blockSlots.forEach((slot, i) => {
      slot.classList.toggle('selected', i === index);
    });
  }
}
