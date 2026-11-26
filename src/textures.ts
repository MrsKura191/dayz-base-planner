import * as THREE from 'three';

// Procedural textures, so the planner ships no third-party art.
// UVs throughout the app are in metres; TILE metres = one texture repeat.
export const TILE = 1.5;

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function makeTex(seed: number, draw: (g: CanvasRenderingContext2D, s: number, r: () => number) => void, size = 512) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  draw(g, size, rng(seed));
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.repeat.set(1 / TILE, 1 / TILE);
  t.anisotropy = 8;
  return t;
}

function noise(g: CanvasRenderingContext2D, s: number, r: () => number, n: number, alpha: number, light = false) {
  for (let i = 0; i < n; i++) {
    const v = light ? 255 : 0;
    g.fillStyle = `rgba(${v},${v},${v},${r() * alpha})`;
    g.fillRect(r() * s, r() * s, 1 + r() * 2, 1 + r() * 2);
  }
}

/** Weathered vertical planks */
export const woodTex = (base: [number, number, number] = [92, 84, 74], seed = 7) =>
  makeTex(seed, (g, s, r) => {
    const planks = 8;
    const pw = s / planks;
    for (let i = 0; i < planks; i++) {
      const k = 0.82 + r() * 0.3;
      g.fillStyle = `rgb(${base[0] * k},${base[1] * k},${base[2] * k})`;
      g.fillRect(i * pw, 0, pw, s);
      for (let j = 0; j < 26; j++) {
        const x = i * pw + r() * pw;
        g.strokeStyle = `rgba(${r() > 0.5 ? '20,16,12' : '200,190,175'},${0.05 + r() * 0.12})`;
        g.lineWidth = 0.6 + r() * 1.4;
        g.beginPath();
        g.moveTo(x, 0);
        g.bezierCurveTo(x + (r() - 0.5) * 6, s * 0.33, x + (r() - 0.5) * 6, s * 0.66, x + (r() - 0.5) * 4, s);
        g.stroke();
      }
      if (r() > 0.5) {
        g.fillStyle = 'rgba(25,18,12,0.45)';
        g.beginPath();
        g.ellipse(i * pw + pw / 2, r() * s, 3 + r() * 3, 6 + r() * 6, 0, 0, Math.PI * 2);
        g.fill();
      }
      g.fillStyle = 'rgba(10,8,6,0.85)';
      g.fillRect(i * pw, 0, 3, s);
      g.fillStyle = 'rgba(30,30,32,0.9)';
      for (const y of [s * 0.08, s * 0.92]) g.fillRect(i * pw + pw / 2 - 2, y, 4, 4);
    }
    noise(g, s, r, 9000, 0.18);
  });

/** Grey cinder blocks in a running bond */
export const cinderTex = () =>
  makeTex(11, (g, s, r) => {
    g.fillStyle = '#8b8a85';
    g.fillRect(0, 0, s, s);
    const bw = s / 4;
    const bh = s / 8;
    for (let row = 0; row < 8; row++) {
      const off = row % 2 ? bw / 2 : 0;
      for (let col = -1; col < 5; col++) {
        const l = 52 + r() * 12;
        g.fillStyle = `hsl(40,4%,${l}%)`;
        g.fillRect(col * bw + off + 3, row * bh + 3, bw - 6, bh - 6);
      }
    }
    noise(g, s, r, 22000, 0.25);
    noise(g, s, r, 6000, 0.15, true);
  });

/** Corrugated, rusty sheet metal */
export const metalTex = () =>
  makeTex(23, (g, s, r) => {
    g.fillStyle = '#6d7276';
    g.fillRect(0, 0, s, s);
    for (let x = 0; x < s; x += 16) {
      const grad = g.createLinearGradient(x, 0, x + 16, 0);
      grad.addColorStop(0, 'rgba(255,255,255,0.10)');
      grad.addColorStop(0.5, 'rgba(0,0,0,0.22)');
      grad.addColorStop(1, 'rgba(255,255,255,0.10)');
      g.fillStyle = grad;
      g.fillRect(x, 0, 16, s);
    }
    for (let i = 0; i < 40; i++) {
      g.fillStyle = `rgba(${120 + r() * 40},${60 + r() * 20},${30},${0.08 + r() * 0.18})`;
      g.beginPath();
      g.ellipse(r() * s, r() * s, 10 + r() * 50, 6 + r() * 30, r() * 3, 0, Math.PI * 2);
      g.fill();
    }
    noise(g, s, r, 12000, 0.2);
  });

/** Bark for palisade logs */
export const barkTex = () =>
  makeTex(31, (g, s, r) => {
    g.fillStyle = '#4b3b2c';
    g.fillRect(0, 0, s, s);
    for (let i = 0; i < 500; i++) {
      g.strokeStyle = `rgba(${r() > 0.5 ? '15,10,6' : '120,100,80'},${0.15 + r() * 0.3})`;
      g.lineWidth = 1 + r() * 3;
      const x = r() * s;
      const y = r() * s;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + (r() - 0.5) * 4, y + 10 + r() * 40);
      g.stroke();
    }
  });

/** Burlap / sandbag cloth */
export const burlapTex = () =>
  makeTex(41, (g, s, r) => {
    g.fillStyle = '#a08d68';
    g.fillRect(0, 0, s, s);
    for (let y = 0; y < s; y += 4) {
      g.fillStyle = `rgba(0,0,0,${0.05 + r() * 0.08})`;
      g.fillRect(0, y, s, 1);
    }
    for (let x = 0; x < s; x += 4) {
      g.fillStyle = `rgba(255,255,255,${0.03 + r() * 0.05})`;
      g.fillRect(x, 0, 1, s);
    }
    noise(g, s, r, 8000, 0.2);
  });

/** Camouflage net with see-through holes */
export const netTex = () => {
  const t = makeTex(53, (g, s, r) => {
    g.clearRect(0, 0, s, s);
    const cols = ['#4b5a32', '#5e6b3a', '#3c4428', '#6b5e3e'];
    for (let i = 0; i < 260; i++) {
      g.fillStyle = cols[Math.floor(r() * cols.length)];
      g.beginPath();
      g.ellipse(r() * s, r() * s, 8 + r() * 26, 5 + r() * 16, r() * 3, 0, Math.PI * 2);
      g.fill();
    }
  });
  return t;
};

/** Ground: dark, slightly noisy dirt */
export const groundTex = () => {
  const t = makeTex(61, (g, s, r) => {
    g.fillStyle = '#1b2124';
    g.fillRect(0, 0, s, s);
    noise(g, s, r, 30000, 0.25);
    noise(g, s, r, 8000, 0.04, true);
  });
  t.repeat.set(1 / 6, 1 / 6);
  return t;
};
