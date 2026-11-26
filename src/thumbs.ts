import * as THREE from 'three';
import { createPartObject } from './meshes';

/** Renders a small preview image of every part, off-screen and in idle slices. */
export async function renderThumbs(ids: string[], done: (id: string, canvas: HTMLCanvasElement) => void) {
  const W = 192;
  const H = 128;
  const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  r.setPixelRatio(1);
  r.setSize(W, H);
  r.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xcfdde8, 0x2a2f33, 1.3));
  const sun = new THREE.DirectionalLight(0xfff1de, 2.2);
  sun.position.set(4, 8, 6);
  scene.add(sun);
  const cam = new THREE.PerspectiveCamera(30, W / H, 0.05, 200);
  const dir = new THREE.Vector3(1, 0.75, 1.35).normalize();

  for (const id of ids) {
    const obj = createPartObject(id);
    scene.add(obj);
    const box = new THREE.Box3().setFromObject(obj);
    const c = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3()).length();
    cam.position.copy(c).addScaledVector(dir, size * 1.55);
    cam.lookAt(c);
    r.render(scene, cam);
    // keep a 2D copy; drawImage works where canvas readback (toDataURL) is blocked
    const copy = document.createElement('canvas');
    copy.width = W;
    copy.height = H;
    copy.getContext('2d')!.drawImage(r.domElement, 0, 0);
    done(id, copy);
    scene.remove(obj);
    await new Promise((res) => setTimeout(res, 0));
  }
  r.dispose();
  r.forceContextLoss();
}
