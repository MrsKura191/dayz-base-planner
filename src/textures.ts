import * as THREE from 'three';

// Procedural textures, so the planner ships no game art. They are modelled on
// the look of the textures the Aftermath parts use in game (weathered grey
// boards, dark warehouse planks, diamond plate, dirty concrete), not copied.
// UVs throughout the app are in metres; `tile` metres = one texture repeat.

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function makeTex(seed: number, tile: number, draw: (g: CanvasRenderingContext2D, s: number, r: () => number) => void, size = 512) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  draw(g, size, rng(seed));
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.repeat.set(1 / tile, 1 / tile);
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

function stains(g: CanvasRenderingContext2D, s: number, r: () => number, n: number, rgb: string, a: number) {
  for (let i = 0; i < n; i++) {
    const x = r() * s, y = r() * s, rad = 20 + r() * 90;
    const grad = g.createRadialGradient(x, y, 0, x, y, rad);
    grad.addColorStop(0, `rgba(${rgb},${a * (0.4 + r() * 0.6)})`);
    grad.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = grad;
    g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
}

/** Vertical boards with grain, gaps and weathering. */
function boards(base: [number, number, number], count: number, seed: number, tile: number, opts: { split?: boolean; warm?: number } = {}) {
  return makeTex(seed, tile, (g, s, r) => {
    const bw = s / count;
    for (let i = 0; i < count; i++) {
      const k = 0.78 + r() * 0.34;
      const w = opts.warm ?? 0;
      g.fillStyle = `rgb(${base[0] * k + w},${base[1] * k},${base[2] * k - w})`;
      g.fillRect(i * bw, 0, bw, s);
      // grain
      for (let j = 0; j < 18; j++) {
        const x = i * bw + r() * bw;
        g.strokeStyle = `rgba(${r() > 0.45 ? '10,9,8' : '210,205,195'},${0.04 + r() * 0.1})`;
        g.lineWidth = 0.5 + r() * 1.2;
        g.beginPath();
        g.moveTo(x, 0);
        g.bezierCurveTo(x + (r() - 0.5) * 3, s * 0.3, x + (r() - 0.5) * 3, s * 0.7, x + (r() - 0.5) * 2, s);
        g.stroke();
      }
      // board joints along the length
      if (r() > 0.55) {
        const y = r() * s;
        g.fillStyle = 'rgba(8,7,6,0.8)';
        g.fillRect(i * bw, y, bw, 2);
      }
      if (opts.split && r() > 0.7) {
        g.strokeStyle = 'rgba(5,4,3,0.85)';
        g.lineWidth = 1.5;
        const x = i * bw + bw * (0.3 + r() * 0.4);
        const y = r() * s;
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + (r() - 0.5) * 3, y + 30 + r() * 80);
        g.stroke();
      }
      if (r() > 0.75) {
        g.fillStyle = 'rgba(20,16,12,0.5)';
        g.beginPath();
        g.ellipse(i * bw + bw / 2, r() * s, 2 + r() * 2, 4 + r() * 4, 0, 0, Math.PI * 2);
        g.fill();
      }
      // dark gap between boards
      g.fillStyle = 'rgba(6,5,4,0.9)';
      g.fillRect(i * bw, 0, 2, s);
    }
    stains(g, s, r, 10, '20,22,20', 0.25);
    stains(g, s, r, 6, '150,150,140', 0.08);
    noise(g, s, r, 12000, 0.16);
  });
}

/** Weathered grey boards (walls, floors). */
export const greyBoardsTex = () => boards([84, 82, 78], 16, 7, 2.0);
/** Floor boards: same wood, a touch lighter. */
export const floorBoardsTex = () => boards([92, 89, 84], 14, 13, 2.0);
/** Dark brown warehouse planks (frames, beams, doors). */
export const darkPlanksTex = () => boards([70, 58, 48], 12, 9, 1.6, { split: true, warm: 4 });

/** Dirty, smooth concrete with faint block courses (cinder parts). */
export const concreteTex = () =>
  makeTex(11, 2.0, (g, s, r) => {
    g.fillStyle = '#7d7b76';
    g.fillRect(0, 0, s, s);
    stains(g, s, r, 40, '60,58,52', 0.35);
    stains(g, s, r, 20, '170,166,158', 0.18);
    stains(g, s, r, 10, '70,60,40', 0.15);
    const bw = s / 4, bh = s / 10;
    g.strokeStyle = 'rgba(30,30,28,0.22)';
    g.lineWidth = 2;
    for (let row = 0; row <= 10; row++) {
      g.beginPath();
      g.moveTo(0, row * bh);
      g.lineTo(s, row * bh);
      g.stroke();
      const off = row % 2 ? bw / 2 : 0;
      for (let col = 0; col <= 4; col++) {
        g.beginPath();
        g.moveTo(col * bw + off, row * bh);
        g.lineTo(col * bw + off, (row + 1) * bh);
        g.stroke();
      }
    }
    // rain streaks
    for (let i = 0; i < 70; i++) {
      const x = r() * s;
      g.fillStyle = `rgba(30,28,25,${0.03 + r() * 0.06})`;
      g.fillRect(x, 0, 2 + r() * 5, s * (0.2 + r() * 0.8));
    }
    noise(g, s, r, 26000, 0.22);
    noise(g, s, r, 8000, 0.12, true);
  });

/** Diamond tread plate (metal floors). */
export const treadPlateTex = () =>
  makeTex(23, 1.0, (g, s, r) => {
    g.fillStyle = '#5d5f60';
    g.fillRect(0, 0, s, s);
    const step = s / 16;
    for (let y = 0; y < 17; y++) {
      for (let x = 0; x < 17; x++) {
        const cx = x * step + (y % 2 ? step / 2 : 0);
        const cy = y * step;
        const a = (x + y) % 2 ? Math.PI / 4 : -Math.PI / 4;
        g.save();
        g.translate(cx, cy);
        g.rotate(a);
        g.fillStyle = 'rgba(160,162,160,0.35)';
        g.fillRect(-step * 0.33, -2, step * 0.66, 3);
        g.fillStyle = 'rgba(10,10,10,0.35)';
        g.fillRect(-step * 0.33, 1, step * 0.66, 2);
        g.restore();
      }
    }
    stains(g, s, r, 18, '25,25,24', 0.35);
    stains(g, s, r, 8, '110,70,40', 0.15);
    noise(g, s, r, 14000, 0.2);
  });

/** Dark weathered metal panels (doors, shutters, bars). */
export const metalPanelTex = () =>
  makeTex(29, 2.0, (g, s, r) => {
    g.fillStyle = '#4d5150';
    g.fillRect(0, 0, s, s);
    const pw = s / 6;
    for (let i = 0; i < 6; i++) {
      const k = 0.85 + r() * 0.25;
      g.fillStyle = `rgba(${90 * k},${95 * k},${92 * k},0.55)`;
      g.fillRect(i * pw + 3, 0, pw - 6, s);
      g.fillStyle = 'rgba(15,15,15,0.6)';
      g.fillRect(i * pw, 0, 3, s);
      for (const y of [s * 0.24, s * 0.5, s * 0.76]) g.fillRect(i * pw, y, pw, 3);
    }
    stains(g, s, r, 25, '20,20,18', 0.4);
    stains(g, s, r, 12, '120,70,35', 0.18);
    for (let i = 0; i < 50; i++) {
      g.fillStyle = `rgba(20,20,18,${0.05 + r() * 0.08})`;
      g.fillRect(r() * s, 0, 1 + r() * 3, s * r());
    }
    noise(g, s, r, 14000, 0.2);
  });

/** Bark for palisade logs */
export const barkTex = () =>
  makeTex(31, 1.5, (g, s, r) => {
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
  makeTex(41, 1.5, (g, s, r) => {
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
export const netTex = () =>
  makeTex(53, 1.5, (g, s, r) => {
    g.clearRect(0, 0, s, s);
    const cols = ['#4b5a32', '#5e6b3a', '#3c4428', '#6b5e3e'];
    for (let i = 0; i < 260; i++) {
      g.fillStyle = cols[Math.floor(r() * cols.length)];
      g.beginPath();
      g.ellipse(r() * s, r() * s, 8 + r() * 26, 5 + r() * 16, r() * 3, 0, Math.PI * 2);
      g.fill();
    }
  });

/** Ground: dark, slightly noisy dirt */
export const groundTex = () =>
  makeTex(61, 6, (g, s, r) => {
    g.fillStyle = '#1b2124';
    g.fillRect(0, 0, s, s);
    noise(g, s, r, 30000, 0.25);
    noise(g, s, r, 8000, 0.04, true);
  });
