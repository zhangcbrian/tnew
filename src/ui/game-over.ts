export class GameOverScreen {
  private el: HTMLElement;
  private btn: HTMLElement;
  private onPlayAgain: (() => void) | null = null;

  constructor() {
    this.el = document.getElementById('game-over-screen')!;
    this.btn = document.getElementById('play-again-btn')!;

    this.btn.addEventListener('click', () => {
      this.hide();
      this.onPlayAgain?.();
    });
  }

  show(onPlayAgain: () => void) {
    this.onPlayAgain = onPlayAgain;
    this.el.classList.add('visible');
  }

  hide() {
    this.el.classList.remove('visible');
  }
}
