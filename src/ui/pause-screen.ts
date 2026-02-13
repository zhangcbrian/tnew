export class PauseScreen {
  private el: HTMLElement;
  private btn: HTMLElement;
  private onResume: (() => void) | null = null;

  constructor() {
    this.el = document.getElementById('pause-screen')!;
    this.btn = document.getElementById('resume-btn')!;

    this.btn.addEventListener('click', () => {
      this.hide();
      this.onResume?.();
    });
  }

  show(onResume: () => void) {
    this.onResume = onResume;
    this.el.classList.add('visible');
  }

  hide() {
    this.el.classList.remove('visible');
  }
}
