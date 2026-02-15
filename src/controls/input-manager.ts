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
  private touchJoystickBaseX = 0;
  private touchJoystickBaseY = 0;
  private touchJoystickActive = false;
  private touchJoystickId: number | null = null;
  private touchJoystickZoneRect: DOMRect | null = null;
  private joystickIndicator: HTMLElement | null = null;
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
    this.joystickIndicator = document.getElementById('joystick-indicator');
    if (joystickZone) {
      joystickZone.addEventListener('touchstart', (e) => this.onTouchJoystickStart(e), { passive: false });
      joystickZone.addEventListener('touchmove', (e) => this.onTouchJoystickMove(e), { passive: false });
      joystickZone.addEventListener('touchend', (e) => this.onTouchJoystickEnd(e), { passive: false });
      joystickZone.addEventListener('touchcancel', (e) => this.onTouchJoystickEnd(e), { passive: false });
    }

    // Right half of screen for looking
    canvas.addEventListener('touchstart', (e) => this.onTouchLookStart(e), { passive: false });
    canvas.addEventListener('touchmove', (e) => this.onTouchLookMove(e), { passive: false });
    canvas.addEventListener('touchend', (e) => this.onTouchLookEnd(e), { passive: false });

    // Touch buttons
    const flyUpBtn = document.getElementById('touch-fly-up');
    const descendBtn = document.getElementById('touch-descend');
    const camBtn = document.getElementById('touch-camera');
    const pauseBtn = document.getElementById('touch-pause');
    const rocketBtn = document.getElementById('touch-rocket');
    const repelBtn = document.getElementById('touch-repel');
    const placeBtn = document.getElementById('touch-place');
    const removeBtn = document.getElementById('touch-remove');
    const cycleBtn = document.getElementById('touch-cycle');

    const bindPress = (btn: HTMLElement | null, onPress: () => void) => {
      if (!btn) return;
      btn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        onPress();
      }, { passive: false });
    };

    const bindHold = (btn: HTMLElement | null, key: string) => {
      if (!btn) return;
      btn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        this.keys.add(key);
      }, { passive: false });
      const clearKey = () => this.keys.delete(key);
      btn.addEventListener('touchend', clearKey);
      btn.addEventListener('touchcancel', clearKey);
    };

    bindHold(flyUpBtn, 'Space');
    bindHold(descendBtn, 'ShiftLeft');
    bindPress(camBtn, () => { this.toggleCamera = true; });
    bindPress(pauseBtn, () => { this.pauseToggle = true; });
    bindPress(rocketBtn, () => { this.shootRocket = true; });
    bindPress(repelBtn, () => { this.repelHumans = true; });
    bindPress(placeBtn, () => { this.placeBlock = true; });
    bindPress(removeBtn, () => { this.removeBlock = true; });
    bindPress(cycleBtn, () => { this.cycleBlockDir = 1; });
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
    const target = e.currentTarget as HTMLElement | null;
    if (target) {
      this.touchJoystickZoneRect = target.getBoundingClientRect();
      this.touchJoystickBaseX = touch.clientX - this.touchJoystickZoneRect.left;
      this.touchJoystickBaseY = touch.clientY - this.touchJoystickZoneRect.top;
      this.updateJoystickIndicator(this.touchJoystickBaseX, this.touchJoystickBaseY, true);
    }
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
        const rawDx = touch.clientX - this.touchJoystickStartX;
        const rawDy = touch.clientY - this.touchJoystickStartY;
        const dx = rawDx / 50;
        const dy = -rawDy / 50;
        this.moveDir.set(
          Math.max(-1, Math.min(1, dx)),
          Math.max(-1, Math.min(1, dy)),
        );
        const maxRadius = 40;
        const dist = Math.hypot(rawDx, rawDy);
        let clampedX = rawDx;
        let clampedY = rawDy;
        if (dist > maxRadius) {
          const scale = maxRadius / dist;
          clampedX *= scale;
          clampedY *= scale;
        }
        if (this.touchJoystickZoneRect) {
          this.updateJoystickIndicator(
            this.touchJoystickBaseX + clampedX,
            this.touchJoystickBaseY + clampedY,
            true,
          );
        }
      }
    }
  }

  private onTouchJoystickEnd(e: TouchEvent) {
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === this.touchJoystickId) {
        this.touchJoystickId = null;
        this.touchJoystickActive = false;
        this.moveDir.set(0, 0);
        this.touchJoystickZoneRect = null;
        this.updateJoystickIndicator(0, 0, false);
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

  private updateJoystickIndicator(x: number, y: number, visible: boolean) {
    if (!this.joystickIndicator) return;
    if (!visible) {
      this.joystickIndicator.style.display = 'none';
      return;
    }
    this.joystickIndicator.style.display = 'block';
    this.joystickIndicator.style.left = `${x}px`;
    this.joystickIndicator.style.top = `${y}px`;
  }
}
