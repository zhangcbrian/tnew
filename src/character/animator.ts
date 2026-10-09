import * as THREE from 'three';
import type { Rig } from './rig';
import type { Wings } from './wings';

/** What the animal is doing this frame. */
export interface Motion {
  /** Ground speed as a fraction of walking speed (0 = standing) */
  speed: number;
  flying: boolean;
  /** Vertical speed, units/s (+ = climbing) */
  climb: number;
  /** Turning speed, radians/s (+ = turning left) */
  turn: number;
}

const damp = (a: number, b: number, rate: number, dt: number) => a + (b - a) * (1 - Math.exp(-rate * dt));

/**
 * Brings a Rig to life: walk cycles per gait, breathing, blinking, glancing around,
 * ear twitches, a lagging tail, and flight posture (legs tucked, pitch, banking into turns).
 * Works on any Rig; missing parts are simply skipped.
 */
export class Animator {
  private phase = 0;
  private gaitAmount = 0; // 0 standing .. 1 walking
  private flyAmount = 0; // 0 on ground .. 1 flying
  private bank = 0;
  private pitch = 0;
  private blinkTimer = 1 + Math.random() * 3;
  private blink = 0;
  private lookTimer = 0;
  private look = new THREE.Vector2();
  private lookTarget = new THREE.Vector2();
  private earTwitch: number[];
  private tailSwing: number[];
  private rest = new Map<THREE.Object3D, { pos: THREE.Vector3; rot: THREE.Euler; scale: THREE.Vector3 }>();

  constructor(private rig: Rig, private wings: Wings | null) {
    // Remember every joint's rest pose; animation is always rest + offset.
    const joints = [rig.root, rig.body, rig.head, ...rig.tail, ...rig.ears, ...(rig.arms ?? []), ...rig.legs.flatMap((l) => [l.hip, l.knee!].filter(Boolean))];
    for (const j of joints) this.rest.set(j, { pos: j.position.clone(), rot: j.rotation.clone(), scale: j.scale.clone() });
    this.earTwitch = rig.ears.map(() => 0);
    this.tailSwing = rig.tail.map(() => 0);
  }

  private reset(j: THREE.Object3D) {
    const r = this.rest.get(j);
    if (!r) return;
    j.position.copy(r.pos);
    j.rotation.copy(r.rot);
    j.scale.copy(r.scale);
  }

  update(dt: number, time: number, m: Motion) {
    const rig = this.rig;
    for (const j of this.rest.keys()) this.reset(j);

    this.flyAmount = damp(this.flyAmount, m.flying ? 1 : 0, 6, dt);
    const walking = m.flying ? 0 : Math.min(m.speed, 1.5);
    this.gaitAmount = damp(this.gaitAmount, walking > 0.05 ? 1 : 0, 8, dt);
    const g = this.gaitAmount * (1 - this.flyAmount);
    const fly = this.flyAmount;

    // Step frequency grows with speed; each gait has its own rhythm
    const freq = { quad: 7, biped: 9, hop: 5, swim: 4, plod: 3.5 }[rig.gait];
    this.phase += dt * freq * (0.6 + 0.6 * Math.min(walking, 1.2)) * (g > 0.01 ? 1 : 0);
    const p = this.phase;

    // ---------------- Body: breathing, bob, waddle
    const breathe = Math.sin(time * 2.2) * 0.012;
    rig.body.scale.multiplyScalar(1).set(1 + breathe, 1 + breathe * 1.2, 1 + breathe * 0.5);

    switch (rig.gait) {
      case 'quad':
      case 'plod': {
        const amp = rig.gait === 'plod' ? 0.35 : 0.55;
        rig.body.position.y += Math.abs(Math.sin(p)) * 0.025 * g;
        rig.body.rotation.z += Math.sin(p) * 0.03 * g;
        rig.head.rotation.x += Math.sin(p * 2) * 0.05 * g;
        for (const leg of rig.legs) {
          // Diagonal pairs move together: front-left with back-right
          const off = (leg.front ? 0 : Math.PI) + (leg.side < 0 ? 0 : Math.PI);
          const s = Math.sin(p + off);
          leg.hip.rotation.x += s * amp * g;
          if (leg.knee) leg.knee.rotation.x += Math.max(0, -Math.cos(p + off)) * (leg.front ? -0.6 : 0.7) * g;
        }
        break;
      }
      case 'biped': {
        // Penguin waddle: rock side to side, short steps
        rig.body.rotation.z += Math.sin(p) * 0.18 * g;
        rig.body.position.y += Math.abs(Math.sin(p)) * 0.03 * g;
        for (const leg of rig.legs) {
          leg.hip.rotation.x += Math.sin(p + (leg.side < 0 ? 0 : Math.PI)) * 0.4 * g;
          leg.hip.position.y += Math.max(0, Math.sin(p + (leg.side < 0 ? 0 : Math.PI))) * 0.03 * g;
        }
        rig.arms?.forEach((a, i) => { a.rotation.z += (i === 0 ? -1 : 1) * (0.25 + Math.sin(p) * 0.1) * g; });
        break;
      }
      case 'hop': {
        // Hop arcs: rise and land, back legs push
        const hop = Math.max(0, Math.sin(p));
        rig.root.position.y += hop * 0.22 * g;
        rig.body.rotation.x += -Math.cos(p) * 0.15 * g;
        for (const leg of rig.legs) {
          if (leg.front) leg.hip.rotation.x += -hop * 0.5 * g;
          else {
            leg.hip.rotation.x += hop * 0.6 * g;
            if (leg.knee) leg.knee.rotation.x += -hop * 0.9 * g;
          }
        }
        break;
      }
      case 'swim': {
        // Dolphin: undulate body and tail; on land it "scoots"
        const u = Math.sin(p);
        rig.body.rotation.x += u * 0.08 * g;
        rig.body.position.y += Math.cos(p) * 0.03 * g;
        rig.tail.forEach((t, i) => { t.rotation.x += Math.sin(p - (i + 1) * 0.7) * 0.35 * g; });
        rig.arms?.forEach((a, i) => { a.rotation.z += (i === 0 ? -1 : 1) * Math.sin(p) * 0.2 * g; });
        break;
      }
    }

    // ---------------- Flight posture: legs tucked, nose follows climb/dive, bank into turns
    this.pitch = damp(this.pitch, THREE.MathUtils.clamp(-m.climb * 0.03, -0.4, 0.4) * fly, 4, dt);
    this.bank = damp(this.bank, THREE.MathUtils.clamp(m.turn * 0.4, -0.65, 0.65) * fly, 4, dt);
    rig.root.rotation.x += this.pitch;
    // The animal faces +Z, so its left is +X; a left turn (turn > 0) must tip the top toward +X, i.e. negative Z roll
    rig.root.rotation.z -= this.bank;
    for (const leg of rig.legs) {
      leg.hip.rotation.x += (leg.front ? -0.7 : 0.8) * fly;
      if (leg.knee) leg.knee.rotation.x += (leg.front ? 0.9 : -0.6) * fly;
    }
    rig.root.position.y += Math.sin(time * 2.5) * 0.04 * fly; // gentle hover bob

    // ---------------- Head: glance around when idle, look into turns when flying
    this.lookTimer -= dt;
    if (this.lookTimer <= 0) {
      this.lookTimer = 2 + Math.random() * 4;
      const idle = 1 - g;
      this.lookTarget.set((Math.random() - 0.5) * 0.9 * idle, (Math.random() - 0.4) * 0.3 * idle);
    }
    const lookYaw = this.lookTarget.x * (1 - fly) + this.bank * 0.6;
    this.look.x = damp(this.look.x, lookYaw, 4, dt);
    this.look.y = damp(this.look.y, this.lookTarget.y * (1 - fly) - this.pitch * 0.5, 4, dt);
    rig.head.rotation.y += this.look.x;
    rig.head.rotation.x += -this.look.y;

    // ---------------- Blink every few seconds
    this.blinkTimer -= dt;
    if (this.blinkTimer <= 0) {
      this.blink = 0.14;
      this.blinkTimer = 2 + Math.random() * 4;
    }
    this.blink = Math.max(0, this.blink - dt);
    const lid = this.blink > 0 ? Math.sin((this.blink / 0.14) * Math.PI) : 0;
    for (const l of rig.eyelids) l.scale.y = 0.02 + lid * 0.98;

    // ---------------- Ears twitch now and then, and flatten in flight
    rig.ears.forEach((e, i) => {
      if (Math.random() < dt * 0.25) this.earTwitch[i] = 1;
      this.earTwitch[i] = Math.max(0, this.earTwitch[i] - dt * 5);
      e.rotation.z += Math.sin(this.earTwitch[i] * Math.PI * 3) * 0.25 * this.earTwitch[i] * (i === 0 ? -1 : 1);
      e.rotation.x += -0.5 * fly;
    });

    // ---------------- Tail: sways with a lag down the chain; streams out behind in flight
    const tailAmp = 0.12 + g * 0.18;
    rig.tail.forEach((t, i) => {
      const target = Math.sin(time * (g > 0.5 ? 6 : 2.2) - i * 0.6) * tailAmp - this.bank * 0.4;
      this.tailSwing[i] = damp(this.tailSwing[i], target, 10, dt);
      t.rotation.y += this.tailSwing[i];
      t.rotation.x += -0.15 * fly;
    });

    // ---------------- Wings: tucked on the ground (a little shuffle now and then), open and beating in flight
    if (this.wings) {
      const open = Math.max(fly, 0.05 + g * 0.05);
      const flap = fly * (0.6 + Math.min(1, Math.abs(m.climb) * 0.05) * 0.4);
      this.wings.animate(dt, time, open, flap);
    }
  }
}
