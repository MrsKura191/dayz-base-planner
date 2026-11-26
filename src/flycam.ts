/**
 * Free camera for building, like a noclip: look with the mouse, fly with
 * WASD, Space up and Ctrl/C down. Nothing orbits a fixed point.
 */
import * as THREE from 'three';

const LOOK = 0.0032; // radians per pixel
const PITCH_MAX = Math.PI / 2 - 0.01;

export class FlyCam {
  yaw = 0;
  pitch = 0;
  enabled = true;
  /** metres per second at normal speed */
  speed = 9;
  /** left drag looks around only when this allows it (not while placing) */
  leftLooks: () => boolean = () => true;
  private drag: { button: number; moved: boolean } | null = null;

  constructor(
    readonly camera: THREE.PerspectiveCamera,
    readonly dom: HTMLElement,
    readonly keys: Set<string>,
  ) {
    camera.rotation.order = 'YXZ';
    dom.addEventListener('pointerdown', (e) => {
      if (!this.enabled) return;
      if (e.button === 0 && !this.leftLooks()) return;
      if (e.button > 2) return;
      this.drag = { button: e.button, moved: false };
      dom.setPointerCapture(e.pointerId);
    });
    dom.addEventListener('pointermove', (e) => {
      const d = this.drag;
      if (!d || !this.enabled) return;
      d.moved = true;
      if (d.button === 1) {
        // middle: slide sideways and up/down
        const s = 0.02 * this.fast();
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
        camera.position.addScaledVector(right, -e.movementX * s);
        camera.position.y += e.movementY * s;
      } else {
        this.yaw -= e.movementX * LOOK;
        this.pitch = THREE.MathUtils.clamp(this.pitch - e.movementY * LOOK, -PITCH_MAX, PITCH_MAX);
        this.apply();
      }
    });
    const end = () => (this.drag = null);
    dom.addEventListener('pointerup', end);
    dom.addEventListener('pointercancel', end);
    dom.addEventListener(
      'wheel',
      (e) => {
        if (!this.enabled) return;
        e.preventDefault();
        const step = Math.sign(e.deltaY) * -1.5 * this.fast();
        camera.position.addScaledVector(this.forward(), step);
      },
      { passive: false },
    );
  }

  private fast() {
    return this.keys.has('shift') ? 3 : this.keys.has('alt') ? 0.3 : 1;
  }

  forward() {
    return new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
  }

  apply() {
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }

  /** Turn to look at a point from where the camera is. */
  lookAt(p: THREE.Vector3) {
    const d = p.clone().sub(this.camera.position);
    if (d.lengthSq() < 1e-6) return;
    this.yaw = Math.atan2(-d.x, -d.z);
    this.pitch = Math.atan2(d.y, Math.hypot(d.x, d.z));
    this.apply();
  }

  /** The point the camera looks at: where the view meets the ground or the given height, else 20 m ahead. */
  focus(y = 0) {
    const f = this.forward();
    const pos = this.camera.position;
    if (f.y < -0.05 && pos.y > y) {
      const t = (y - pos.y) / f.y;
      if (t < 150) return pos.clone().addScaledVector(f, t);
    }
    const p = pos.clone().addScaledVector(f, 20);
    p.y = Math.max(p.y, y);
    return p;
  }

  update(dt: number) {
    if (!this.enabled) return false;
    const k = this.keys;
    // Ctrl only counts as "down" on its own, not as part of a shortcut
    const ctrlDown = (k.has('control') || k.has('meta')) && ![...k].some((x) => x.length === 1 && !'wasd '.includes(x));
    const f = (k.has('w') ? 1 : 0) - (k.has('s') ? 1 : 0);
    const s = (k.has('d') ? 1 : 0) - (k.has('a') ? 1 : 0);
    const u = (k.has(' ') ? 1 : 0) - (k.has('c') || ctrlDown ? 1 : 0);
    if (!f && !s && !u) return false;
    const v = this.speed * this.fast() * dt;
    const fwd = this.forward();
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
    this.camera.position.addScaledVector(fwd, f * v).addScaledVector(right, s * v);
    this.camera.position.y += u * v;
    return true;
  }
}
