import * as THREE from 'three';

export class InputManager {
  moveDir = new THREE.Vector2(); // x = left/right, y = forward/back
  mouseDelta = new THREE.Vector2();
  wantFly = false;
  wantDescend = false;
  shootRocket = false;
  repelHumans = false;
  toggleCamera = false;
  pauseToggle = false;
  placeBlock = false;
  removeBlock = false;
  cycleBlockDir = 0;
  selectBlockNum = -1;
  scrollDelta = 0;

  private keys = new Set<string>();
  private touchJoystickStartX = 0;
  private touchJoystickStartY = 0;
  private touchJoystickActive = false;
  private touchJoystickId: number | null = null;
  private touchLookId: number | null = null;
  private touchLookStartX = 0;
  private touchLookStartY = 0;
  private touchLookActive = false;

  private readonly consumedMouseDelta = new THREE.Vector2();

  constructor(private canvas: HTMLCanvasElement) {
    window.addEventListener('keydown', (e) => {
      this.keys.add(e.code);
      if (!e.repeat) {
        if (e.code === 'Escape') this.pauseToggle = true;
        if (e.code === 'KeyV') this.toggleCamera = true;
        if (e.code === 'KeyB') this.shootRocket = true;
        if (e.code === 'KeyG') this.repelHumans = true;
        if (e.code === 'KeyF') this.placeBlock = true;
        if (e.code === 'KeyR') this.removeBlock = true;
        if (e.code === 'KeyQ') this.cycleBlockDir = -1;
        if (e.code === 'KeyE') this.cycleBlockDir = 1;
        // Number keys 1-5 to select block type
        if (e.code >= 'Digit1' && e.code <= 'Digit5') {
          this.selectBlockNum = parseInt(e.code.charAt(5)) - 1;
        }
      }
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });

    window.addEventListener('mousemove', (e) => {
      // Only accumulate mouse deltas when pointer-locked; otherwise the camera will
      // drift whenever the cursor moves over the page.
      if (document.pointerLockElement === canvas) {
        this.mouseDelta.x += e.movementX;
        this.mouseDelta.y += e.movementY;
      }
    });

    window.addEventListener('wheel', (e) => {
      this.scrollDelta += e.deltaY;
    }, { passive: true });

    // Pointer lock for mouse-look (desktop).
    canvas.addEventListener('click', () => {
      // On touch devices, pointer lock is either unavailable or undesirable.
      if ((navigator as any).maxTouchPoints && (navigator as any).maxTouchPoints > 0) return;
      if (document.pointerLockElement === canvas) return;
      if (!canvas.requestPointerLock) return;
      try {
        canvas.requestPointerLock();
      } catch {
        // Ignore failures (e.g. browser/user settings).
      }
    });

    // Touch controls
    const joystickZone = document.getElementById('joystick-zone');
    if (joystickZone) {
      joystickZone.addEventListener('touchstart', (e) => this.onTouchJoystickStart(e), { passive: false });
      joystickZone.addEventListener('touchmove', (e) => this.onTouchJoystickMove(e), { passive: false });
      joystickZone.addEventListener('touchend', (e) => this.onTouchJoystickEnd(e), { passive: false });
    }

    // Right half of screen for looking
    canvas.addEventListener('touchstart', (e) => this.onTouchLookStart(e), { passive: false });
    canvas.addEventListener('touchmove', (e) => this.onTouchLookMove(e), { passive: false });
    canvas.addEventListener('touchend', (e) => this.onTouchLookEnd(e), { passive: false });

    // Touch buttons
    const jumpBtn = document.getElementById('touch-jump');
    const flyDownBtn = document.getElementById('touch-fly-down');
    const camBtn = document.getElementById('touch-camera');

    if (jumpBtn) {
      jumpBtn.addEventListener('touchstart', (e) => { e.preventDefault(); this.keys.add('Space'); });
      jumpBtn.addEventListener('touchend', () => this.keys.delete('Space'));
    }
    if (flyDownBtn) {
      flyDownBtn.addEventListener('touchstart', (e) => { e.preventDefault(); this.keys.add('ShiftLeft'); });
      flyDownBtn.addEventListener('touchend', () => this.keys.delete('ShiftLeft'));
    }
    if (camBtn) {
      camBtn.addEventListener('touchstart', (e) => { e.preventDefault(); this.toggleCamera = true; });
    }
  }

  update() {
    // Keyboard input
    this.moveDir.set(0, 0);

    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) this.moveDir.y += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) this.moveDir.y -= 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) this.moveDir.x -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) this.moveDir.x += 1;

    if (this.moveDir.lengthSq() > 0) this.moveDir.normalize();

    this.wantFly = this.keys.has('Space');
    this.wantDescend = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
  }

  consumeMouseDelta(out?: THREE.Vector2): THREE.Vector2 {
    const target = out ?? this.consumedMouseDelta;
    target.copy(this.mouseDelta);
    this.mouseDelta.set(0, 0);
    return target;
  }

  consumeScrollDelta(): number {
    const d = this.scrollDelta;
    this.scrollDelta = 0;
    return d;
  }

  consumePauseToggle(): boolean {
    const v = this.pauseToggle;
    this.pauseToggle = false;
    return v;
  }

  consumeToggleCamera(): boolean {
    const v = this.toggleCamera;
    this.toggleCamera = false;
    return v;
  }

  consumeShootRocket(): boolean {
    const v = this.shootRocket;
    this.shootRocket = false;
    return v;
  }

  consumeRepelHumans(): boolean {
    const v = this.repelHumans;
    this.repelHumans = false;
    return v;
  }

  consumePlaceBlock(): boolean {
    const v = this.placeBlock;
    this.placeBlock = false;
    return v;
  }

  consumeRemoveBlock(): boolean {
    const v = this.removeBlock;
    this.removeBlock = false;
    return v;
  }

  consumeCycleBlock(): number {
    const v = this.cycleBlockDir;
    this.cycleBlockDir = 0;
    return v;
  }

  consumeSelectBlock(): number {
    const v = this.selectBlockNum;
    this.selectBlockNum = -1;
    return v;
  }

  private onTouchJoystickStart(e: TouchEvent) {
    e.preventDefault();
    const touch = e.changedTouches[0];
    this.touchJoystickId = touch.identifier;
    this.touchJoystickStartX = touch.clientX;
    this.touchJoystickStartY = touch.clientY;
    this.touchJoystickActive = true;
  }

  private onTouchJoystickMove(e: TouchEvent) {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === this.touchJoystickId && this.touchJoystickActive) {
        const dx = (touch.clientX - this.touchJoystickStartX) / 50;
        const dy = -(touch.clientY - this.touchJoystickStartY) / 50;
        this.moveDir.set(
          Math.max(-1, Math.min(1, dx)),
          Math.max(-1, Math.min(1, dy)),
        );
      }
    }
  }

  private onTouchJoystickEnd(e: TouchEvent) {
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === this.touchJoystickId) {
        this.touchJoystickId = null;
        this.touchJoystickActive = false;
        this.moveDir.set(0, 0);
      }
    }
  }

  private onTouchLookStart(e: TouchEvent) {
    const touch = e.changedTouches[0];
    if (touch.clientX > window.innerWidth * 0.4) {
      this.touchLookId = touch.identifier;
      this.touchLookStartX = touch.clientX;
      this.touchLookStartY = touch.clientY;
      this.touchLookActive = true;
    }
  }

  private onTouchLookMove(e: TouchEvent) {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === this.touchLookId && this.touchLookActive) {
        this.mouseDelta.x += (touch.clientX - this.touchLookStartX) * 0.5;
        this.mouseDelta.y += (touch.clientY - this.touchLookStartY) * 0.5;
        this.touchLookStartX = touch.clientX;
        this.touchLookStartY = touch.clientY;
      }
    }
  }

  private onTouchLookEnd(e: TouchEvent) {
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === this.touchLookId) {
        this.touchLookId = null;
        this.touchLookActive = false;
      }
    }
  }
}
