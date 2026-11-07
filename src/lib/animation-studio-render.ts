// Estudio de Animación — dibujo, guardado y escenario compartidos por el estudio y las historias.
// Solo navegador (usa canvas e IndexedDB).
import {
  CHAR_W,
  CHAR_H,
  PARTS,
  REST_POSE,
  type PartId,
  type Stroke,
  type CharacterParts,
  type SavedCharacter,
  type PartImage,
  type Mouth,
  type Pose,
  type SceneId,
} from "@/lib/animation-studio-data";

export const RES = 2; // resolución interna del dibujo (nitidez en tablet)
export const STAGE_W = 960;
export const STAGE_H = 600;
export const GROUND_Y = 560;
export const CHAR_SCALE = 0.85;
export const HIP: [number, number] = [200, 330];
export const FEET_Y = 500;

export const PHOTO_MAX = 1200; // la foto se reduce a este lado máximo antes de recortar
export const CUTOUT_MAX = 512; // tamaño máximo del recorte guardado
export const OTHER_SIDE: Partial<Record<PartId, PartId>> = { armL: "armR", armR: "armL", legL: "legR", legR: "legL" };

export const PART_BY_ID = Object.fromEntries(PARTS.map((p) => [p.id, p])) as Record<PartId, (typeof PARTS)[number]>;

// ---------- Guardado local (solo en esta tablet; IndexedDB porque las fotos pesan) ----------
export const DB_NAME = "fq-animation-studio";
export const DB_STORE = "characters";

export function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(DB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function idbGet<T>(key: string, fallback: T): Promise<T> {
  try {
    const db = await openDb();
    return await new Promise((resolve) => {
      const req = db.transaction(DB_STORE).objectStore(DB_STORE).get(key);
      req.onsuccess = () => resolve((req.result as T | undefined) ?? fallback);
      req.onerror = () => resolve(fallback);
    });
  } catch {
    return fallback;
  }
}

export async function idbPut(key: string, value: unknown): Promise<boolean> {
  try {
    const db = await openDb();
    return await new Promise((resolve) => {
      const tx = db.transaction(DB_STORE, "readwrite");
      tx.objectStore(DB_STORE).put(value, key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
      tx.onabort = () => resolve(false);
    });
  } catch {
    return false;
  }
}

export const loadCharacters = (key: string) => idbGet<SavedCharacter[]>(key, []);
export const storeCharacters = (key: string, list: SavedCharacter[]) => idbPut(key, list);

// ---------- Fotos de dibujos ----------
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export async function fileToCanvas(file: File): Promise<HTMLCanvasElement> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const k = Math.min(1, PHOTO_MAX / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement("canvas");
    c.width = Math.round(img.naturalWidth * k);
    c.height = Math.round(img.naturalHeight * k);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    return c;
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Recorta la foto por el contorno que trazó el niño y quita el papel blanco.
export function makeCutout(src: HTMLCanvasElement, lasso: number[], removePaper: boolean): string | null {
  let minX = 0, minY = 0, maxX = src.width, maxY = src.height;
  const clip = lasso.length >= 6;
  if (clip) {
    minX = Infinity; minY = Infinity; maxX = -Infinity; maxY = -Infinity;
    for (let i = 0; i < lasso.length; i += 2) {
      minX = Math.min(minX, lasso[i]); maxX = Math.max(maxX, lasso[i]);
      minY = Math.min(minY, lasso[i + 1]); maxY = Math.max(maxY, lasso[i + 1]);
    }
    minX = Math.max(0, Math.floor(minX)); minY = Math.max(0, Math.floor(minY));
    maxX = Math.min(src.width, Math.ceil(maxX)); maxY = Math.min(src.height, Math.ceil(maxY));
  }
  const bw = maxX - minX, bh = maxY - minY;
  if (bw < 8 || bh < 8) return null;
  const k = Math.min(1, CUTOUT_MAX / Math.max(bw, bh));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(bw * k));
  c.height = Math.max(1, Math.round(bh * k));
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.scale(k, k);
  ctx.translate(-minX, -minY);
  if (clip) {
    ctx.beginPath();
    ctx.moveTo(lasso[0], lasso[1]);
    for (let i = 2; i < lasso.length; i += 2) ctx.lineTo(lasso[i], lasso[i + 1]);
    ctx.closePath();
    ctx.clip();
  }
  ctx.drawImage(src, 0, 0);
  if (removePaper) {
    const data = ctx.getImageData(0, 0, c.width, c.height);
    const d = data.data;
    // El papel = lo más claro y menos colorido del recorte (percentil 90 de luz)
    const lums: number[] = [];
    for (let i = 0; i < d.length; i += 16) if (d[i + 3] > 0) lums.push((d[i] + d[i + 1] + d[i + 2]) / 3);
    lums.sort((a, b) => a - b);
    const paper = lums.length ? lums[Math.floor(lums.length * 0.9)] : 255;
    const lo = paper * 0.78, hi = paper * 0.9;
    const W = c.width, H = c.height;
    // t = qué tanto parece papel (0 = dibujo, 1 = papel)
    const paperness = new Float32Array(W * H);
    for (let j = 0; j < W * H; j++) {
      const i = j * 4;
      if (d[i + 3] === 0) continue;
      const mx = Math.max(d[i], d[i + 1], d[i + 2]);
      const mn = Math.min(d[i], d[i + 1], d[i + 2]);
      if (mx - mn > 45) continue; // tiene color: es dibujo
      const l = (d[i] + d[i + 1] + d[i + 2]) / 3;
      paperness[j] = Math.min(1, Math.max(0, (l - lo) / (hi - lo)));
    }
    // Solo se quita el papel conectado con la orilla del recorte; lo blanco
    // encerrado por el dibujo (ojos, dientes) se queda.
    const seen = new Uint8Array(W * H);
    const queue: number[] = [];
    const seed = (j: number) => {
      if (!seen[j] && paperness[j] > 0) {
        seen[j] = 1;
        queue.push(j);
      }
    };
    for (let j = 0; j < W * H; j++) {
      if (paperness[j] === 0) continue;
      const x = j % W, y = (j / W) | 0;
      const edge =
        x === 0 || y === 0 || x === W - 1 || y === H - 1 ||
        d[(j - 1) * 4 + 3] === 0 || d[(j + 1) * 4 + 3] === 0 ||
        d[(j - W) * 4 + 3] === 0 || d[(j + W) * 4 + 3] === 0;
      if (edge) seed(j);
    }
    // Si la orilla del recorte casi no es papel (foto de una cara o de un muñeco), no se quita nada
    let border = 0;
    for (let j = 0; j < W * H; j++) {
      if (d[j * 4 + 3] === 0) continue;
      const x = j % W, y = (j / W) | 0;
      if (x === 0 || y === 0 || x === W - 1 || y === H - 1 ||
        d[(j - 1) * 4 + 3] === 0 || d[(j + 1) * 4 + 3] === 0 ||
        d[(j - W) * 4 + 3] === 0 || d[(j + W) * 4 + 3] === 0) border++;
    }
    if (queue.length < border * 0.5) queue.length = 0;
    while (queue.length) {
      const j = queue.pop()!;
      const x = j % W;
      if (x > 0) seed(j - 1);
      if (x < W - 1) seed(j + 1);
      if (j >= W) seed(j - W);
      if (j < W * (H - 1)) seed(j + W);
    }
    for (let j = 0; j < W * H; j++) {
      if (seen[j]) d[j * 4 + 3] = Math.round(d[j * 4 + 3] * (1 - paperness[j]));
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.putImageData(data, 0, 0);
  }
  return c.toDataURL("image/png");
}

// Coloca el recorte dentro de la guía de la parte, sin deformarlo
export function fitInGuide(part: PartId, iw: number, ih: number): Omit<PartImage, "src"> {
  const g = PART_BY_ID[part].guide;
  const box = g.kind === "circle"
    ? { cx: g.cx, cy: g.cy, w: g.r * 2, h: g.r * 2 }
    : { cx: g.x + g.w / 2, cy: g.y + g.h / 2, w: g.w, h: g.h };
  const k = Math.min((box.w * 1.15) / iw, (box.h * 1.15) / ih);
  return { x: box.cx, y: box.cy, w: iw * k, h: ih * k, rot: 0, flip: false };
}

export type LoadedImage = { p: PartImage; el: HTMLImageElement };
export type LoadedImages = Partial<Record<PartId, LoadedImage>>;

// ---------- Dibujo ----------
export function strokeSegment(ctx: CanvasRenderingContext2D, s: Stroke, from: number) {
  ctx.save();
  ctx.globalCompositeOperation = s.color === "erase" ? "destination-out" : "source-over";
  ctx.strokeStyle = s.color === "erase" ? "#000" : s.color;
  ctx.fillStyle = ctx.strokeStyle;
  ctx.lineWidth = s.size;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const pts = s.pts;
  if (pts.length === 2) {
    ctx.beginPath();
    ctx.arc(pts[0], pts[1], s.size / 2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    const start = Math.max(0, from - 2);
    ctx.beginPath();
    ctx.moveTo(pts[start], pts[start + 1]);
    for (let i = start + 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.stroke();
  }
  ctx.restore();
}

export function newPartCanvas(): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = CHAR_W * RES;
  c.height = CHAR_H * RES;
  return c;
}

export function renderPart(canvas: HTMLCanvasElement, strokes: Stroke[], image?: LoadedImage) {
  const ctx = canvas.getContext("2d")!;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(RES, 0, 0, RES, 0, 0);
  if (image) {
    const { p, el } = image;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.scale(p.flip ? -1 : 1, 1);
    ctx.drawImage(el, -p.w / 2, -p.h / 2, p.w, p.h);
    ctx.restore();
  }
  for (const s of strokes) strokeSegment(ctx, s, 0);
}

export type Caches = Record<PartId, HTMLCanvasElement>;

export function buildCaches(parts: CharacterParts, images: LoadedImages = {}): Caches {
  const caches = {} as Caches;
  for (const p of PARTS) {
    caches[p.id] = newPartCanvas();
    renderPart(caches[p.id], parts[p.id], images[p.id]);
  }
  return caches;
}

export function drawMouth(ctx: CanvasRenderingContext2D, m: Mouth, open: number) {
  const w = m.w;
  const o = Math.max(0, Math.min(1, open));
  const h = w * (0.08 + o * 0.55);
  ctx.save();
  ctx.translate(m.x, m.y);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  const ellipse = (rx: number, ry: number) => {
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, Math.max(1, ry), 0, 0, Math.PI * 2);
  };
  if (o < 0.06 && m.style !== "lips") {
    // boca cerrada
    ctx.strokeStyle = m.style === "monster" ? "#14532d" : "#1f2937";
    ctx.lineWidth = Math.max(3, w * 0.07);
    ctx.beginPath();
    ctx.moveTo(-w / 2, 0);
    ctx.quadraticCurveTo(0, m.style === "smile" ? w * 0.28 : w * 0.16, w / 2, 0);
    ctx.stroke();
    ctx.restore();
    return;
  }
  switch (m.style) {
    case "toon": {
      ellipse(w / 2, h);
      ctx.fillStyle = "#4c0519";
      ctx.fill();
      ctx.save();
      ctx.clip();
      ctx.fillStyle = "#fb7185";
      ctx.beginPath();
      ctx.ellipse(0, h * 0.75, w * 0.3, h * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ellipse(w / 2, h);
      ctx.strokeStyle = "#111827";
      ctx.lineWidth = Math.max(3, w * 0.06);
      ctx.stroke();
      break;
    }
    case "smile": {
      const top = -h * 0.35;
      ctx.beginPath();
      ctx.moveTo(-w / 2, top);
      ctx.lineTo(w / 2, top);
      ctx.ellipse(0, top, w / 2, h * 1.3 + w * 0.1, 0, 0, Math.PI);
      ctx.closePath();
      ctx.fillStyle = "#450a0a";
      ctx.fill();
      ctx.save();
      ctx.clip();
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(-w / 2, top, w, w * 0.12);
      ctx.restore();
      ctx.strokeStyle = "#111827";
      ctx.lineWidth = Math.max(3, w * 0.06);
      ctx.stroke();
      break;
    }
    case "monster": {
      ellipse(w / 2, h);
      ctx.fillStyle = "#1a0505";
      ctx.fill();
      ctx.save();
      ctx.clip();
      ctx.fillStyle = "#fefce8";
      const n = 5;
      const tooth = w / n;
      for (let i = 0; i < n; i++) {
        const x = -w / 2 + i * tooth;
        ctx.beginPath();
        ctx.moveTo(x, -h);
        ctx.lineTo(x + tooth, -h);
        ctx.lineTo(x + tooth / 2, -h + Math.max(6, h * 0.5));
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(x, h);
        ctx.lineTo(x + tooth, h);
        ctx.lineTo(x + tooth / 2, h - Math.max(6, h * 0.5));
        ctx.fill();
      }
      ctx.restore();
      ellipse(w / 2, h);
      ctx.strokeStyle = "#14532d";
      ctx.lineWidth = Math.max(4, w * 0.08);
      ctx.stroke();
      break;
    }
    case "lips": {
      const lip = Math.max(5, w * 0.16);
      if (o >= 0.06) {
        ellipse(w / 2, h);
        ctx.fillStyle = "#3f0a14";
        ctx.fill();
      }
      ctx.fillStyle = "#e11d48";
      ctx.strokeStyle = "#881337";
      ctx.lineWidth = 2;
      // labio de arriba
      ctx.beginPath();
      ctx.moveTo(-w / 2 - lip * 0.3, 0);
      ctx.quadraticCurveTo(-w / 4, -h - lip * 1.2, 0, -h - lip * 0.4);
      ctx.quadraticCurveTo(w / 4, -h - lip * 1.2, w / 2 + lip * 0.3, 0);
      ctx.quadraticCurveTo(0, -h + lip * 0.2, -w / 2 - lip * 0.3, 0);
      ctx.fill();
      ctx.stroke();
      // labio de abajo
      ctx.beginPath();
      ctx.moveTo(-w / 2 - lip * 0.3, 0);
      ctx.quadraticCurveTo(0, h + lip * 1.6, w / 2 + lip * 0.3, 0);
      ctx.quadraticCurveTo(0, h - lip * 0.2, -w / 2 - lip * 0.3, 0);
      ctx.fill();
      ctx.stroke();
      break;
    }
  }
  ctx.restore();
}

export function drawCharacter(
  ctx: CanvasRenderingContext2D,
  caches: Caches,
  pose: Pose,
  hipX: number,
  hipY: number,
  scale: number,
  mouth: Mouth | null = null,
  mouthOpen = 0
) {
  const limb = (id: PartId, angle: number) => {
    const [px, py] = PART_BY_ID[id].pivot;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(angle);
    ctx.translate(-px, -py);
    ctx.drawImage(caches[id], 0, 0, CHAR_W, CHAR_H);
    ctx.restore();
  };
  ctx.save();
  // Aplastado/estirado desde los pies
  const feet = (FEET_Y - HIP[1]) * scale;
  ctx.translate(hipX + pose.x, hipY + pose.y + feet);
  ctx.scale(1, pose.squash);
  ctx.translate(0, -feet);
  ctx.rotate(pose.rot);
  ctx.scale(scale * pose.scaleX, scale);
  ctx.translate(-HIP[0], -HIP[1]);
  limb("legL", pose.legL);
  limb("legR", pose.legR);
  ctx.save();
  ctx.translate(HIP[0], HIP[1]);
  ctx.rotate(pose.body);
  ctx.translate(-HIP[0], -HIP[1]);
  ctx.drawImage(caches.body, 0, 0, CHAR_W, CHAR_H);
  limb("armL", pose.armL);
  limb("armR", pose.armR);
  const [nx, ny] = PART_BY_ID.head.pivot;
  ctx.save();
  ctx.translate(nx, ny);
  ctx.rotate(pose.head);
  ctx.translate(-nx, -ny);
  ctx.drawImage(caches.head, 0, 0, CHAR_W, CHAR_H);
  if (mouth) drawMouth(ctx, mouth, mouthOpen);
  ctx.restore();
  ctx.restore();
  ctx.restore();
}

export function makeThumbnail(caches: Caches, mouth: Mouth | null): string {
  const c = document.createElement("canvas");
  c.width = 200;
  c.height = 260;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#fffdf7";
  ctx.fillRect(0, 0, c.width, c.height);
  drawCharacter(ctx, caches, REST_POSE, 100, HIP[1] * 0.5, 0.5, mouth, 0);
  return c.toDataURL("image/png");
}

// ---------- Escenarios ----------
export function seeded(i: number) {
  const x = Math.sin(i * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

export function emoji(ctx: CanvasRenderingContext2D, e: string, x: number, y: number, size: number) {
  ctx.font = `${size}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.fillText(e, x, y);
}

// scene = id de un escenario prehecho, o "bg:<id>" para un fondo que puso el niño
export function drawScene(
  ctx: CanvasRenderingContext2D,
  scene: string,
  t: number,
  backgrounds?: Map<string, HTMLImageElement>
) {
  const W = STAGE_W;
  const H = STAGE_H;
  if (scene.startsWith("bg:")) {
    const img = backgrounds?.get(scene.slice(3));
    if (img) ctx.drawImage(img, 0, 0, W, H);
    else {
      ctx.fillStyle = "#1e1b4b";
      ctx.fillRect(0, 0, W, H);
    }
    return;
  }
  const grad = (stops: string[], y0 = 0, y1 = H) => {
    const g = ctx.createLinearGradient(0, y0, 0, y1);
    stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c));
    return g;
  };
  ctx.save();
  switch (scene as SceneId) {
    case "park": {
      ctx.fillStyle = grad(["#38bdf8", "#e0f2fe"]);
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#fde047";
      ctx.beginPath();
      ctx.arc(840, 90, 50, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      for (let i = 0; i < 3; i++) {
        const cx = ((t * 15 + i * 340) % (W + 200)) - 100;
        const cy = 80 + i * 45;
        ctx.beginPath();
        ctx.ellipse(cx, cy, 60, 22, 0, 0, Math.PI * 2);
        ctx.ellipse(cx + 35, cy - 12, 40, 20, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = "#86efac";
      ctx.beginPath();
      ctx.ellipse(200, GROUND_Y, 380, 120, 0, Math.PI, 0);
      ctx.ellipse(760, GROUND_Y, 420, 90, 0, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = "#4ade80";
      ctx.fillRect(0, GROUND_Y - 10, W, H);
      emoji(ctx, "🌳", 90, GROUND_Y, 130);
      emoji(ctx, "🌳", 880, GROUND_Y, 110);
      emoji(ctx, "🌼", 250, GROUND_Y + 30, 30);
      emoji(ctx, "🌷", 700, GROUND_Y + 32, 30);
      break;
    }
    case "space": {
      ctx.fillStyle = grad(["#020617", "#1e1b4b"]);
      ctx.fillRect(0, 0, W, H);
      for (let i = 0; i < 90; i++) {
        const tw = 0.5 + 0.5 * Math.sin(t * 3 + i);
        ctx.fillStyle = `rgba(255,255,255,${0.3 + tw * 0.7})`;
        ctx.fillRect(seeded(i) * W, seeded(i + 100) * (GROUND_Y - 40), 2.5, 2.5);
      }
      ctx.save();
      ctx.translate(790, 150);
      ctx.fillStyle = "#f59e0b";
      ctx.beginPath();
      ctx.arc(0, 0, 60, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#fde68a";
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.ellipse(0, 0, 100, 22, -0.3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      emoji(ctx, "🚀", 140 + Math.sin(t * 0.7) * 40, 200 + Math.cos(t * 0.9) * 30, 70);
      ctx.fillStyle = "#9ca3af";
      ctx.beginPath();
      ctx.ellipse(W / 2, H + 380, 900, 440, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#6b7280";
      [[180, 575, 40], [620, 585, 28], [820, 570, 22]].forEach(([x, y, r]) => {
        ctx.beginPath();
        ctx.ellipse(x, y, r, r * 0.35, 0, 0, Math.PI * 2);
        ctx.fill();
      });
      break;
    }
    case "beach": {
      ctx.fillStyle = grad(["#7dd3fc", "#fef3c7"], 0, 380);
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#fb923c";
      ctx.beginPath();
      ctx.arc(160, 120, 55, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#0ea5e9";
      ctx.beginPath();
      ctx.moveTo(0, 380);
      for (let x = 0; x <= W; x += 20) ctx.lineTo(x, 380 + Math.sin(x / 40 + t * 2) * 6);
      ctx.lineTo(W, 490);
      ctx.lineTo(0, 490);
      ctx.fill();
      ctx.fillStyle = "#fcd34d";
      ctx.beginPath();
      ctx.moveTo(0, 480);
      for (let x = 0; x <= W; x += 20) ctx.lineTo(x, 480 + Math.sin(x / 30 + t * 2.5) * 5);
      ctx.lineTo(W, H);
      ctx.lineTo(0, H);
      ctx.fill();
      emoji(ctx, "🌴", 860, GROUND_Y + 10, 170);
      emoji(ctx, "⛵", 300 + ((t * 20) % 700), 395, 50);
      emoji(ctx, "🐚", 120, GROUND_Y + 30, 34);
      break;
    }
    case "disco": {
      ctx.fillStyle = grad(["#1a0b2e", "#3b0764"]);
      ctx.fillRect(0, 0, W, H);
      const colors = ["#f472b6", "#60a5fa", "#facc15", "#34d399"];
      ctx.globalCompositeOperation = "lighter";
      colors.forEach((c, i) => {
        const a = Math.sin(t * 1.2 + i * 1.7) * 0.5;
        ctx.save();
        ctx.translate(W / 2, 40);
        ctx.rotate(a);
        ctx.fillStyle = c + "33";
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-90, GROUND_Y);
        ctx.lineTo(90, GROUND_Y);
        ctx.fill();
        ctx.restore();
      });
      ctx.globalCompositeOperation = "source-over";
      const tile = 60;
      for (let x = 0; x < W; x += tile) {
        for (let y = GROUND_Y - 20; y < H; y += tile / 2) {
          const k = (Math.floor(x / tile) + Math.floor(y / (tile / 2)) + Math.floor(t * 3)) % colors.length;
          ctx.fillStyle = colors[k] + "aa";
          ctx.fillRect(x + 1, y + 1, tile - 2, tile / 2 - 2);
        }
      }
      emoji(ctx, "🪩", W / 2, 110, 80);
      break;
    }
    case "jungle": {
      ctx.fillStyle = grad(["#14532d", "#4d7c0f"]);
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "rgba(253,224,71,0.15)";
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(200 + i * 200, 0);
        ctx.lineTo(140 + i * 200, GROUND_Y);
        ctx.lineTo(220 + i * 200, GROUND_Y);
        ctx.fill();
      }
      ctx.fillStyle = "#166534";
      ctx.fillRect(0, GROUND_Y - 10, W, H);
      emoji(ctx, "🌴", 80, GROUND_Y + 10, 180);
      emoji(ctx, "🌴", 900, GROUND_Y + 10, 160);
      emoji(ctx, "🌿", 300, GROUND_Y + 15, 70);
      emoji(ctx, "🌿", 660, GROUND_Y + 15, 70);
      emoji(ctx, "🐒", 850, 230 + Math.sin(t * 2) * 15, 60);
      emoji(ctx, "🦜", 120 + ((t * 60) % 800), 120 + Math.sin(t * 4) * 20, 50);
      break;
    }
  }
  ctx.restore();
}

// Qué tan fuerte suena ahora (0..1) → qué tanto se abre la boca
export function loudness(an: AnalyserNode, buf: Float32Array<ArrayBuffer>): number {
  an.getFloatTimeDomainData(buf);
  let sum = 0;
  for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
  const rms = Math.sqrt(sum / buf.length);
  return Math.max(0, Math.min(1, (rms - 0.015) * 7));
}

export function blendPose(cur: Pose, target: Pose, k: number): Pose {
  const out = { ...target };
  (["x", "y", "squash", "body", "head", "armL", "armR", "legL", "legR"] as const).forEach((key) => {
    out[key] = cur[key] + (target[key] - cur[key]) * k;
  });
  return out;
}

// Foto → fondo del escenario (recorte tipo "cover" a 960×600)
export async function photoToBackground(file: File): Promise<string> {
  const src = await fileToCanvas(file);
  const c = document.createElement("canvas");
  c.width = STAGE_W;
  c.height = STAGE_H;
  const k = Math.max(STAGE_W / src.width, STAGE_H / src.height);
  const w = src.width * k, h = src.height * k;
  c.getContext("2d")!.drawImage(src, (STAGE_W - w) / 2, (STAGE_H - h) / 2, w, h);
  return c.toDataURL("image/jpeg", 0.85);
}

// Dónde va cada personaje cuando hay varios en el escenario
export function castLayout(n: number): { xs: number[]; scale: number } {
  if (n <= 1) return { xs: [STAGE_W / 2], scale: CHAR_SCALE };
  if (n === 2) return { xs: [STAGE_W * 0.3, STAGE_W * 0.7], scale: 0.62 };
  return { xs: [STAGE_W * 0.18, STAGE_W * 0.5, STAGE_W * 0.82], scale: 0.52 };
}

// Lo que hace falta para pintar un personaje guardado
export interface CharacterRuntime {
  caches: Caches;
  mouth: Mouth | null;
  name: string;
}

export async function prepareCharacter(c: SavedCharacter): Promise<{ runtime: CharacterRuntime; images: LoadedImages }> {
  const images: LoadedImages = {};
  await Promise.all(
    Object.entries(c.images ?? {}).map(async ([id, p]) => {
      try {
        images[id as PartId] = { p: { ...p }, el: await loadImage(p.src) };
      } catch {
        /* una foto dañada no impide abrir el resto */
      }
    })
  );
  return {
    runtime: { caches: buildCaches(c.parts, images), mouth: c.mouth ? { ...c.mouth } : null, name: c.name },
    images,
  };
}
