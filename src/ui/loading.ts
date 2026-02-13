export class LoadingScreen {
  private el: HTMLElement;
  private bar: HTMLElement;
  private barContainer: HTMLElement;
  private status: HTMLElement;
  private playBtn: HTMLElement;

  constructor() {
    this.el = document.getElementById('loading-screen')!;
    this.bar = document.getElementById('loading-bar')!;
    this.barContainer = document.getElementById('loading-bar-container')!;
    this.status = document.getElementById('loading-status')!;
    this.playBtn = document.getElementById('play-btn')!;
  }

  setProgress(pct: number, message: string) {
    this.bar.style.width = `${Math.round(pct * 100)}%`;
    this.status.textContent = message;
  }

  showTitleScreen() {
    this.barContainer.style.display = 'none';
    this.status.style.display = 'none';
    this.playBtn.style.display = 'block';
  }

  onPlay(callback: () => void) {
    this.playBtn.addEventListener('click', () => {
      this.hide();
      callback();
    });
  }

  hide() {
    this.el.classList.add('hidden');
    setTimeout(() => { this.el.style.display = 'none'; }, 600);
  }
}
