import * as THREE from 'three';
import { levelTop } from './constants';
import type { Editor } from './editor';

type Stance = 'stand' | 'crouch' | 'prone';
const EYE: Record<Stance, number> = { stand: 1.65, crouch: 1.05, prone: 0.45 };
const SPEED: Record<Stance, number> = { stand: 3.2, crouch: 1.7, prone: 0.8 };
const RADIUS = 0.3;
const STEP_UP = 0.65;
const GRAVITY = 18;

export interface WalkHud {
  update(state: { locked: boolean; stance: Stance; noclip: boolean; sprint: boolean; hint: string | null }): void;
  show(v: boolean): void;
}

/** First-person walk-through: pointer-lock look, WASD, gravity, stairs, doors. */
export class WalkMode {
  active = false;
  private pos = new THREE.Vector3();
  private vel = new THREE.Vector3();
  private yaw = 0;
  private pitch = 0;
  private stance: Stance = 'stand';
  private noclip = false;
  private grounded = false;
  private keys = new Set<string>();
  private eye = EYE.stand;
  private ray = new THREE.Raycaster();
  private colliders: THREE.Object3D[] = [];
  private savedCam = { pos: new THREE.Vector3(), target: new THREE.Vector3(), showAll: true };
  private hint: string | null = null;

  constructor(private ed: Editor, private hud: WalkHud, private onExit: () => void) {
    document.addEventListener('pointerlockchange', () => this.render());
    document.addEventListener('mousemove', (e) => {
      if (!this.active || document.pointerLockElement !== this.ed.renderer.domElement) return;
      this.yaw -= e.movementX * 0.0022;
      this.pitch = Math.max(-1.5, Math.min(1.5, this.pitch - e.movementY * 0.0022));
    });
    window.addEventListener('keydown', (e) => this.onKey(e, true));
    window.addEventListener('keyup', (e) => this.onKey(e, false));
    this.ed.renderer.domElement.addEventListener('click', () => {
      if (this.active && !this.locked()) this.lock();
    });
  }

  private locked() {
    return document.pointerLockElement === this.ed.renderer.domElement;
  }

  private lock() {
    // browsers refuse the lock without a user gesture; the click handler retries
    const p = this.ed.renderer.domElement.requestPointerLock() as unknown as Promise<void> | undefined;
    p?.catch?.(() => {});
  }

  enter() {
    if (this.active) return;
    const ed = this.ed;
    this.active = true;
    this.savedCam.pos.copy(ed.camera.position);
    this.savedCam.target.copy(ed.controls.target);
    this.savedCam.showAll = ed.showAll;
    ed.setActivePart(null);
    ed.select(null);
    ed.setShowAll(true);
    ed.setInteractive(false);
    this.colliders = ed.colliders();

    // spawn on the surface below the orbit target, on the active storey
    const t = ed.controls.target;
    const top = levelTop(ed.level) + 1.2;
    this.ray.set(new THREE.Vector3(t.x, top, t.z), new THREE.Vector3(0, -1, 0));
    const h = this.ray.intersectObjects(this.colliders, false)[0];
    this.pos.set(t.x, h ? h.point.y : 0, t.z);
    const d = new THREE.Vector3().subVectors(t, ed.camera.position);
    this.yaw = Math.atan2(-d.x, -d.z);
    this.pitch = 0;
    this.vel.set(0, 0, 0);
    this.stance = 'stand';
    this.eye = EYE.stand;
    this.noclip = false;
    ed.camera.fov = 70;
    ed.camera.near = 0.03;
    ed.camera.updateProjectionMatrix();
    ed.frameHook = (dt) => this.update(dt);
    this.hud.show(true);
    this.lock();
    this.render();
  }

  exit() {
    if (!this.active) return;
    const ed = this.ed;
    this.active = false;
    ed.frameHook = null;
    if (this.locked()) document.exitPointerLock();
    ed.camera.fov = 55;
    ed.camera.near = 0.05;
    ed.camera.updateProjectionMatrix();
    ed.camera.position.copy(this.savedCam.pos);
    ed.controls.target.copy(this.savedCam.target);
    ed.camera.up.set(0, 1, 0);
    ed.camera.lookAt(this.savedCam.target);
    ed.setShowAll(this.savedCam.showAll);
    ed.setInteractive(true);
    ed.closeAllDoors();
    this.keys.clear();
    this.hud.show(false);
    this.onExit();
  }

  private onKey(e: KeyboardEvent, down: boolean) {
    if (!this.active) return;
    const k = e.key.toLowerCase();
    if (down) {
      if (k === 'escape' && !this.locked()) {
        this.exit();
        return;
      }
      if (k === 'c') this.stance = this.stance === 'crouch' ? 'stand' : 'crouch';
      if (k === 'z' || k === 'y') this.stance = this.stance === 'prone' ? 'stand' : 'prone';
      if (k === 'n') {
        this.noclip = !this.noclip;
        this.vel.set(0, 0, 0);
      }
      if (k === 'f') this.useDoor();
      if (k === ' ' && this.grounded && !this.noclip) {
        if (this.stance !== 'stand') this.stance = 'stand';
        else this.vel.y = 5.2;
      }
      this.keys.add(k);
      if ([' ', 'arrowup', 'arrowdown'].includes(k)) e.preventDefault();
    } else this.keys.delete(k);
    this.render();
  }

  private useDoor() {
    const dir = new THREE.Vector3();
    this.ed.camera.getWorldDirection(dir);
    this.ray.set(this.ed.camera.position, dir);
    this.ray.far = 3;
    const hits = this.ray.intersectObjects(this.colliders, false);
    this.ray.far = Infinity;
    for (const h of hits) {
      if (this.ed.toggleDoor(h.object)) return;
      break;
    }
  }

  private blocked(from: THREE.Vector3, dir: THREE.Vector3, dist: number) {
    const heights = this.stance === 'prone' ? [0.25] : this.stance === 'crouch' ? [0.45, 0.9] : [0.75, 1.5];
    for (const hgt of heights) {
      this.ray.set(new THREE.Vector3(from.x, from.y + hgt, from.z), dir);
      this.ray.far = dist + RADIUS;
      const hits = this.ray.intersectObjects(this.colliders, false);
      for (const h of hits) {
        if (!h.face) continue;
        const n = h.face.normal.clone().transformDirection(h.object.matrixWorld);
        if (Math.abs(n.y) > 0.55) continue; // walkable slope (stairs ramp)
        this.ray.far = Infinity;
        return true;
      }
    }
    // ceiling: would the head end up inside a floor slab above?
    const head = EYE[this.stance] + 0.1;
    const dest = new THREE.Vector3(from.x + dir.x * (dist + RADIUS * 0.5), from.y + 0.35, from.z + dir.z * (dist + RADIUS * 0.5));
    this.ray.set(dest, new THREE.Vector3(0, 1, 0));
    this.ray.far = head - 0.35;
    const up = this.ray.intersectObjects(this.colliders, false);
    this.ray.far = Infinity;
    for (const h of up) {
      if (!h.face) continue;
      const n = h.face.normal.clone().transformDirection(h.object.matrixWorld);
      if (n.y < -0.5) return true;
    }
    return false;
  }

  /** Stop upward motion when the head hits a ceiling. */
  private ceiling() {
    this.ray.set(new THREE.Vector3(this.pos.x, this.pos.y + 0.35, this.pos.z), new THREE.Vector3(0, 1, 0));
    this.ray.far = EYE[this.stance] + 0.1 - 0.35;
    const hit = this.ray.intersectObjects(this.colliders, false).some((h) => h.face && h.face.normal.clone().transformDirection(h.object.matrixWorld).y < -0.5);
    this.ray.far = Infinity;
    return hit;
  }

  private update(dt: number) {
    const k = this.keys;
    const sprint = k.has('shift') && this.stance === 'stand';
    let f = 0;
    let s = 0;
    if (k.has('w') || k.has('arrowup')) f += 1;
    if (k.has('s') || k.has('arrowdown')) f -= 1;
    if (k.has('d') || k.has('arrowright')) s += 1;
    if (k.has('a') || k.has('arrowleft')) s -= 1;
    const fwd = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const wish = fwd.multiplyScalar(f).addScaledVector(right, s);
    if (wish.lengthSq() > 0) wish.normalize();

    if (this.noclip) {
      const look = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));
      const v = new THREE.Vector3().addScaledVector(look, f).addScaledVector(right, s);
      if (k.has(' ')) v.y += 1;
      if (k.has('c') || k.has('control')) v.y -= 1;
      this.pos.addScaledVector(v, dt * (sprint ? 16 : 7));
    } else {
      const speed = SPEED[this.stance] * (sprint ? 1.9 : 1);
      const step = wish.multiplyScalar(speed * dt);
      for (const axis of ['x', 'z'] as const) {
        const d = step[axis];
        if (!d) continue;
        const dir = new THREE.Vector3(axis === 'x' ? Math.sign(d) : 0, 0, axis === 'z' ? Math.sign(d) : 0);
        if (!this.blocked(this.pos, dir, Math.abs(d))) this.pos[axis] += d;
      }
      this.vel.y -= GRAVITY * dt;
      if (this.vel.y > 0 && this.ceiling()) this.vel.y = 0;
      this.pos.y += this.vel.y * dt;
      // ground probe from just above the step height
      this.ray.set(new THREE.Vector3(this.pos.x, this.pos.y + STEP_UP + Math.max(0, -this.vel.y * dt), this.pos.z), new THREE.Vector3(0, -1, 0));
      const g = this.ray.intersectObjects(this.colliders, false)[0];
      this.grounded = false;
      if (g && g.point.y >= this.pos.y - 0.05 && this.vel.y <= 0) {
        this.pos.y = g.point.y;
        this.vel.y = 0;
        this.grounded = true;
      }
      if (this.pos.y < -20) this.pos.set(this.pos.x, 0, this.pos.z);
    }

    this.eye += (EYE[this.stance] - this.eye) * Math.min(1, dt * 10);
    const cam = this.ed.camera;
    cam.position.set(this.pos.x, this.pos.y + this.eye, this.pos.z);
    cam.rotation.set(this.pitch, this.yaw, 0, 'YXZ');

    // contextual hint: looking at a door?
    const dir = new THREE.Vector3();
    cam.getWorldDirection(dir);
    this.ray.set(cam.position, dir);
    this.ray.far = 3;
    const h = this.ray.intersectObjects(this.colliders, false)[0];
    this.ray.far = Infinity;
    let hint: string | null = null;
    if (h) {
      for (let o: THREE.Object3D | null = h.object; o; o = o.parent) {
        if (o.userData.door) {
          hint = o.userData.door.target > 0.5 ? 'F – Tür schließen' : 'F – Tür öffnen';
          break;
        }
      }
    }
    if (hint !== this.hint) {
      this.hint = hint;
      this.render();
    }
  }

  private render() {
    if (!this.active) return;
    this.hud.update({
      locked: this.locked(), stance: this.stance, noclip: this.noclip,
      sprint: this.keys.has('shift'), hint: this.hint,
    });
  }
}
