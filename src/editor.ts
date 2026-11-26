import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { levelTop, MAX_LEVEL, TERRITORY_RADIUS } from './constants';
import { PARTS } from './data';
import { createGhost, createPartObject, findDoorPivots, setGhostValid, setHighlight, stepDoor } from './meshes';
import { computePlacement, validate, type Cursor, type Placement, type Verdict } from './placement';
import type { Piece, Store } from './store';
import { groundTex } from './textures';

export interface EditorEvents {
  onPreview?: (info: { part: string; verdict: Verdict | null; snapped: boolean } | null) => void;
  onSelect?: (piece: Piece | null) => void;
  onHover?: (piece: Piece | null) => void;
}

export class Editor {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: OrbitControls;
  readonly world = new THREE.Group();
  readonly ground: THREE.Mesh;
  private grid: THREE.GridHelper;
  private levelGrid: THREE.GridHelper;
  private sun: THREE.DirectionalLight;
  private ring: THREE.Group;
  private objects = new Map<number, THREE.Group>();
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();
  private mouseInside = false;
  private down: { x: number; y: number; button: number } | null = null;
  private animating = new Set<THREE.Object3D>();
  private keys = new Set<string>();
  private clock = new THREE.Clock();

  activePart: string | null = null;
  private ghost: THREE.Group | null = null;
  placement: Placement | null = null;
  verdict: Verdict | null = null;
  level = 0;
  showAll = true;
  snap = true;
  showTerritory = true;
  rotIndex = 0;
  freeYaw = 0;
  partLimit = 3000;
  selected: number | null = null;
  private hovered: number | null = null;
  /** set by the walk mode while it runs */
  frameHook: ((dt: number) => void) | null = null;

  constructor(private host: HTMLElement, private store: Store, private ev: EditorEvents = {}) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    host.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(55, 1, 0.05, 600);
    this.camera.position.set(22, 18, 26);

    const bg = new THREE.Color(0x0d1214);
    this.scene.background = bg;
    this.scene.fog = new THREE.Fog(bg, 90, 280);

    this.scene.add(new THREE.HemisphereLight(0xb9cddd, 0x2a3236, 1.35));
    this.sun = new THREE.DirectionalLight(0xfff0dc, 2.4);
    this.sun.position.set(35, 55, 20);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = sc.bottom = -45;
    sc.right = sc.top = 45;
    sc.near = 1;
    sc.far = 160;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.03;
    this.scene.add(this.sun, this.sun.target);

    this.ground = new THREE.Mesh(
      new THREE.PlaneGeometry(600, 600).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ map: groundTex(), roughness: 1 }),
    );
    (this.ground.geometry.attributes.uv as THREE.BufferAttribute).array.forEach((_, i, a) => ((a as Float32Array)[i] *= 600));
    this.ground.receiveShadow = true;
    this.ground.userData.ground = true;
    this.scene.add(this.ground);

    this.grid = new THREE.GridHelper(240, 80, 0x2b3a3f, 0x1d272b);
    this.grid.position.y = 0.01;
    this.scene.add(this.grid);
    this.levelGrid = new THREE.GridHelper(60, 20, 0xb98a3e, 0x3a3226);
    (this.levelGrid.material as THREE.Material).transparent = true;
    (this.levelGrid.material as THREE.Material).opacity = 0.35;
    this.levelGrid.visible = false;
    this.scene.add(this.levelGrid);

    this.ring = this.makeRing();
    this.scene.add(this.ring);
    this.scene.add(this.world);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.12;
    this.controls.maxPolarAngle = Math.PI * 0.495;
    this.controls.minDistance = 2;
    this.controls.maxDistance = 220;
    this.controls.target.set(0, 1, 0);
    this.updateMouseButtons();

    const el = this.renderer.domElement;
    el.addEventListener('pointermove', (e) => this.onMove(e));
    el.addEventListener('pointerdown', (e) => {
      this.down = { x: e.clientX, y: e.clientY, button: e.button };
    });
    el.addEventListener('pointerup', (e) => this.onUp(e));
    el.addEventListener('pointerleave', () => {
      this.mouseInside = false;
      if (this.ghost) this.ghost.visible = false;
      this.setHover(null);
    });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', (e) => {
      if (!(e.target as HTMLElement)?.closest?.('input,textarea,select')) this.keys.add(e.key.toLowerCase());
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => this.keys.clear());

    new ResizeObserver(() => this.resize()).observe(host);
    this.resize();
    store.on(() => this.sync());
    this.sync();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  // ----------------------------------------------------------------- setup
  private makeRing() {
    const g = new THREE.Group();
    const R = TERRITORY_RADIUS;
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(R - 0.12, R + 0.12, 160).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xe9a84a, transparent: true, opacity: 0.85, depthWrite: false }),
    );
    const disk = new THREE.Mesh(
      new THREE.CircleGeometry(R, 160).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xe9a84a, transparent: true, opacity: 0.035, depthWrite: false }),
    );
    ring.position.y = 0.04;
    disk.position.y = 0.03;
    g.add(ring, disk);
    g.visible = false;
    return g;
  }

  private resize() {
    const w = this.host.clientWidth || 1;
    const h = this.host.clientHeight || 1;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private updateMouseButtons() {
    this.controls.mouseButtons = {
      LEFT: (this.activePart ? -1 : THREE.MOUSE.ROTATE) as THREE.MOUSE,
      MIDDLE: THREE.MOUSE.PAN,
      RIGHT: THREE.MOUSE.ROTATE,
    };
  }

  // ------------------------------------------------------------- syncing
  private sync() {
    const pieces = this.store.pieces;
    for (const [id, obj] of this.objects) {
      if (!pieces.has(id)) {
        this.world.remove(obj);
        this.objects.delete(id);
        if (this.selected === id) this.select(null);
        if (this.hovered === id) this.hovered = null;
      }
    }
    for (const p of pieces.values()) {
      if (this.objects.has(p.id)) continue;
      const obj = createPartObject(p.t);
      obj.position.set(p.x, p.y, p.z);
      obj.rotation.y = p.r;
      obj.userData.pieceId = p.id;
      obj.traverse((o) => (o.userData.pieceId = p.id));
      this.objects.set(p.id, obj);
      this.world.add(obj);
    }
    this.applyVisibility();
    this.updateRing();
    this.refreshPreview();
  }

  applyVisibility() {
    for (const [id, obj] of this.objects) {
      const p = this.store.pieces.get(id)!;
      obj.visible = this.showAll || p.l <= this.level;
    }
    this.levelGrid.visible = this.level > 0;
    this.levelGrid.position.y = levelTop(this.level) + 0.01;
  }

  private updateRing() {
    const pole = this.store.all().find((p) => PARTS[p.t].kind === 'plotpole');
    if (this.activePart === 'plot_pole' && this.placement) {
      this.ring.visible = true;
      this.ring.position.set(this.placement.x, 0, this.placement.z);
    } else if (pole && this.showTerritory) {
      this.ring.visible = true;
      this.ring.position.set(pole.x, 0, pole.z);
    } else this.ring.visible = false;
  }

  // ------------------------------------------------------------ public API
  setLevel(l: number) {
    this.level = Math.max(0, Math.min(MAX_LEVEL, l));
    this.applyVisibility();
    this.refreshPreview();
  }

  setShowAll(v: boolean) {
    this.showAll = v;
    this.applyVisibility();
  }

  setActivePart(id: string | null) {
    if (this.ghost) {
      this.scene.remove(this.ghost);
      this.ghost = null;
    }
    this.activePart = id;
    this.placement = null;
    this.rotIndex = 0;
    if (id) {
      this.select(null);
      this.ghost = createGhost(id);
      this.ghost.visible = false;
      this.scene.add(this.ghost);
    }
    this.updateMouseButtons();
    this.refreshPreview();
    this.updateRing();
  }

  rotate(dir: 1 | -1, big = false) {
    this.rotIndex += dir;
    this.freeYaw += dir * (big ? Math.PI / 2 : Math.PI / 12);
    this.refreshPreview();
  }

  toggleSnap() {
    this.snap = !this.snap;
    this.refreshPreview();
    return this.snap;
  }

  setTerritoryVisible(v: boolean) {
    this.showTerritory = v;
    this.updateRing();
  }

  deleteSelected() {
    if (this.selected != null) this.store.remove([this.selected]);
  }

  select(id: number | null) {
    if (this.selected != null) {
      const o = this.objects.get(this.selected);
      if (o) setHighlight(o, false);
    }
    this.selected = id;
    if (id != null) {
      const o = this.objects.get(id);
      if (o) setHighlight(o, true, 0x7a4a00);
    }
    this.ev.onSelect?.(id != null ? this.store.pieces.get(id) ?? null : null);
  }

  frameAll() {
    const box = new THREE.Box3();
    for (const o of this.objects.values()) box.expandByObject(o);
    if (box.isEmpty()) {
      this.controls.target.set(0, 1, 0);
      this.camera.position.set(22, 18, 26);
      return;
    }
    const c = box.getCenter(new THREE.Vector3());
    const r = Math.max(8, box.getSize(new THREE.Vector3()).length() * 0.75);
    const dir = this.camera.position.clone().sub(this.controls.target).normalize();
    this.controls.target.copy(c);
    this.camera.position.copy(c).addScaledVector(dir, r * 1.4);
  }

  screenshot(): string {
    this.renderer.render(this.scene, this.camera);
    return this.renderer.domElement.toDataURL('image/png');
  }

  /** All meshes the walking player collides with. */
  colliders(): THREE.Object3D[] {
    const out: THREE.Object3D[] = [this.ground];
    for (const obj of this.objects.values()) {
      if (!obj.visible) continue;
      obj.traverse((o) => {
        if ((o as THREE.Mesh).isMesh && !o.userData.noCollide) out.push(o);
      });
    }
    return out;
  }

  toggleDoor(obj: THREE.Object3D) {
    let root: THREE.Object3D | null = obj;
    while (root && root.parent !== this.world) root = root.parent;
    if (!root) return false;
    const pivots = findDoorPivots(root);
    if (!pivots.length) return false;
    const open = pivots[0].userData.door.target < 0.5;
    for (const p of pivots) {
      p.userData.door.target = open ? 1 : 0;
      this.animating.add(p);
    }
    return true;
  }

  closeAllDoors() {
    for (const obj of this.objects.values()) {
      for (const p of findDoorPivots(obj)) {
        p.userData.door.target = 0;
        this.animating.add(p);
      }
    }
  }

  setInteractive(on: boolean) {
    this.controls.enabled = on;
    if (!on && this.ghost) this.ghost.visible = false;
  }

  // ---------------------------------------------------------- interaction
  private ndc(e: PointerEvent) {
    const r = this.renderer.domElement.getBoundingClientRect();
    this.mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  }

  private onMove(e: PointerEvent) {
    if (this.frameHook) return;
    this.ndc(e);
    this.mouseInside = true;
    if (this.activePart) this.refreshPreview();
    else if (!this.down) this.setHover(this.pick());
  }

  private onUp(e: PointerEvent) {
    const d = this.down;
    this.down = null;
    if (this.frameHook || !d || d.button !== e.button) return;
    if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 5) return;
    if (e.button === 0) {
      if (this.activePart) this.place();
      else this.select(this.pick());
    } else if (e.button === 2 && this.activePart) {
      this.setActivePart(null);
      this.ev.onPreview?.(null);
    }
  }

  private visibleChain(o: THREE.Object3D) {
    for (let p: THREE.Object3D | null = o; p; p = p.parent) if (!p.visible) return false;
    return true;
  }

  private intersectWorld() {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    return this.raycaster
      .intersectObject(this.world, true)
      .filter((h) => ((h.object as THREE.Mesh).material as THREE.Material).visible !== false && this.visibleChain(h.object));
  }

  private pick(): number | null {
    const h = this.intersectWorld()[0];
    return h ? (h.object.userData.pieceId as number) ?? null : null;
  }

  private setHover(id: number | null) {
    if (id === this.hovered) return;
    if (this.hovered != null && this.hovered !== this.selected) {
      const o = this.objects.get(this.hovered);
      if (o) setHighlight(o, false);
    }
    this.hovered = id;
    if (id != null && id !== this.selected) {
      const o = this.objects.get(id);
      if (o) setHighlight(o, true, 0x2a2010);
    }
    this.renderer.domElement.style.cursor = id != null ? 'pointer' : '';
    this.ev.onHover?.(id != null ? this.store.pieces.get(id) ?? null : null);
  }

  private cursor(): Cursor {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const def = PARTS[this.activePart!];
    const planeY = def.kind === 'palisade' || def.kind === 'plotpole' ? 0 : levelTop(this.level);
    const pt = new THREE.Vector3();
    const hitPlane = this.raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -planeY), pt);
    let hit: Cursor['hit'] = null;
    const hits = [...this.intersectWorld(), ...this.raycaster.intersectObject(this.ground)].sort((a, b) => a.distance - b.distance);
    for (const h of hits) {
      if (!h.face) continue;
      const n = h.face.normal.clone().transformDirection(h.object.matrixWorld);
      if (n.y > 0.6) {
        hit = { x: h.point.x, y: h.point.y, z: h.point.z };
        break;
      }
    }
    return { plane: hitPlane ? { x: pt.x, z: pt.z } : null, hit };
  }

  refreshPreview() {
    if (!this.activePart || !this.ghost) return;
    if (!this.mouseInside) {
      this.ghost.visible = false;
      return;
    }
    const def = PARTS[this.activePart];
    const pl = computePlacement(def, this.cursor(), {
      pieces: this.store.all(), level: this.level, rotIndex: this.rotIndex, freeYaw: this.freeYaw, snap: this.snap,
    });
    this.placement = pl;
    if (!pl) {
      this.ghost.visible = false;
      this.verdict = null;
      this.ev.onPreview?.({ part: this.activePart, verdict: null, snapped: false });
      this.updateRing();
      return;
    }
    this.ghost.visible = true;
    this.ghost.position.set(pl.x, pl.y, pl.z);
    this.ghost.rotation.y = pl.r;
    this.verdict = validate(def, pl, this.store.all(), this.partLimit);
    setGhostValid(this.ghost, this.verdict.ok);
    this.ev.onPreview?.({ part: this.activePart, verdict: this.verdict, snapped: pl.snapped });
    this.updateRing();
  }

  private place() {
    if (!this.activePart || !this.placement || !this.verdict) return;
    if (!this.verdict.ok) return;
    const { x, y, z, r, l } = this.placement;
    this.store.add({ t: this.activePart, x, y, z, r, l });
  }

  // --------------------------------------------------------------- loop
  private frame() {
    const dt = Math.min(0.05, this.clock.getDelta());
    if (this.frameHook) this.frameHook(dt);
    else {
      this.keyboardPan(dt);
      this.controls.update();
    }
    for (const p of this.animating) if (!stepDoor(p, dt)) this.animating.delete(p);
    const t = this.frameHook ? this.camera.position : this.controls.target;
    this.sun.position.set(t.x + 35, 55, t.z + 20);
    this.sun.target.position.set(t.x, 0, t.z);
    this.renderer.render(this.scene, this.camera);
  }

  private keyboardPan(dt: number) {
    const k = this.keys;
    if (k.has('control') || k.has('meta')) return;
    let f = 0;
    let s = 0;
    if (k.has('w') || k.has('arrowup')) f += 1;
    if (k.has('s') || k.has('arrowdown')) f -= 1;
    if (k.has('d') || k.has('arrowright')) s += 1;
    if (k.has('a') || k.has('arrowleft')) s -= 1;
    if (!f && !s) return;
    const dist = this.camera.position.distanceTo(this.controls.target);
    const speed = Math.max(6, dist * 0.9) * dt * (k.has('shift') ? 2.5 : 1);
    const fwd = new THREE.Vector3();
    this.camera.getWorldDirection(fwd);
    fwd.y = 0;
    fwd.normalize();
    const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0));
    const move = fwd.multiplyScalar(f * speed).addScaledVector(right, s * speed);
    this.controls.target.add(move);
    this.camera.position.add(move);
    if (this.activePart) this.refreshPreview();
  }
}
