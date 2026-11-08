// Estudio de Animación — efectos de caricatura (fuego, explosión…) y GIFs que pone el niño.
// Todo se pinta en el canvas, así sale también en el video.
import { emoji, seeded } from "@/lib/animation-studio-render";

export const EFFECTS: { id: string; label: string; emoji: string; once?: number }[] = [
  { id: "boom", label: "Explosión", emoji: "💥", once: 1.1 },
  { id: "fire", label: "Fuego", emoji: "🔥" },
  { id: "pow", label: "¡POW!", emoji: "🗯️", once: 1 },
  { id: "zap", label: "Rayo", emoji: "⚡" },
  { id: "smoke", label: "Humo", emoji: "💨" },
  { id: "sparkle", label: "Brillos", emoji: "✨" },
  { id: "hearts", label: "Corazones", emoji: "💖" },
  { id: "dizzy", label: "Mareado", emoji: "💫" },
  { id: "rain", label: "Lluvia", emoji: "🌧️" },
];

export const DEFAULT_EFFECT_SIZE = 200;

// GIF ya separado en cuadros
export interface GifAnim {
  frames: CanvasImageSource[];
  ends: number[]; // segundo en que termina cada cuadro
  total: number;
  w: number;
  h: number;
  thumb: string;
}

// Los de una sola vez (explosión) se acaban solos
export function effectDone(kind: string, age: number): boolean {
  const once = EFFECTS.find((e) => e.id === kind)?.once;
  return once !== undefined && age > once;
}

export function effectInfo(kind: string): { label: string; emoji: string } {
  if (kind.startsWith("gif:")) return { label: "Mi GIF", emoji: "🖼️" };
  return EFFECTS.find((e) => e.id === kind) ?? { label: "?", emoji: "❓" };
}

function spiky(ctx: CanvasRenderingContext2D, r: number, points: number, inner: number, wobble: number) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const a = (i / (points * 2)) * Math.PI * 2;
    const rr = i % 2 === 0 ? r * (1 + Math.sin(i * 7.3) * wobble) : r * inner;
    ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
}

function comicText(ctx: CanvasRenderingContext2D, text: string, size: number, fill: string) {
  ctx.font = `900 ${size}px "Arial Black", Impact, system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.lineWidth = size * 0.16;
  ctx.strokeStyle = "#111827";
  ctx.strokeText(text, 0, 0);
  ctx.fillStyle = fill;
  ctx.fillText(text, 0, 0);
}

function flame(ctx: CanvasRenderingContext2D, w: number, h: number, sway: number) {
  ctx.beginPath();
  ctx.moveTo(-w / 2, 0);
  ctx.bezierCurveTo(-w / 2, -h * 0.45, sway - w * 0.1, -h * 0.7, sway, -h);
  ctx.bezierCurveTo(sway + w * 0.1, -h * 0.7, w / 2, -h * 0.45, w / 2, 0);
  ctx.quadraticCurveTo(0, w * 0.35, -w / 2, 0);
  ctx.fill();
}

// Pinta el efecto con centro en (x, y); age = segundos desde que apareció
export function drawEffect(
  ctx: CanvasRenderingContext2D,
  kind: string,
  x: number,
  y: number,
  size: number,
  age: number,
  gifs?: Map<string, GifAnim>
) {
  ctx.save();
  ctx.translate(x, y);
  const s = size / 2;
  switch (kind) {
    case "boom": {
      const p = Math.min(1, age / 1.1);
      const grow = 1 - Math.pow(1 - Math.min(1, p * 2.8), 3);
      const alpha = p < 0.6 ? 1 : 1 - (p - 0.6) / 0.4;
      ctx.globalAlpha = Math.max(0, alpha);
      // humo que sale volando
      ctx.fillStyle = "#9ca3af";
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + 0.3;
        const d = s * (0.5 + p * 1.1);
        ctx.beginPath();
        ctx.arc(Math.cos(a) * d, Math.sin(a) * d, s * 0.22 * (1 - p * 0.5), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.rotate(age * 0.6);
      const layers: [string, number][] = [["#dc2626", 1], ["#f97316", 0.78], ["#facc15", 0.55], ["#fffbeb", 0.28]];
      layers.forEach(([c, k]) => {
        ctx.fillStyle = c;
        spiky(ctx, s * grow * k * 1.1, 11, 0.62, 0.18);
        ctx.fill();
      });
      ctx.rotate(-age * 0.6);
      if (p > 0.08) {
        ctx.scale(grow, grow);
        comicText(ctx, "¡BUM!", s * 0.5, "#fde047");
      }
      break;
    }
    case "pow": {
      const p = Math.min(1, age / 1);
      const pop = p < 0.2 ? p / 0.2 * 1.15 : p < 0.3 ? 1.15 - (p - 0.2) * 1.5 : 1;
      ctx.globalAlpha = p < 0.75 ? 1 : 1 - (p - 0.75) / 0.25;
      ctx.scale(pop, pop);
      ctx.rotate(-0.12);
      ctx.fillStyle = "#fef08a";
      ctx.strokeStyle = "#111827";
      ctx.lineWidth = 6;
      spiky(ctx, s, 9, 0.72, 0.12);
      ctx.fill();
      ctx.stroke();
      comicText(ctx, "¡POW!", s * 0.5, "#ef4444");
      break;
    }
    case "fire": {
      const n = 5;
      const w = size / n;
      const colors = ["#dc2626", "#f97316", "#facc15"];
      for (let i = 0; i < n; i++) {
        const fx = -s + w / 2 + i * w;
        const mid = 1 - Math.abs(i - (n - 1) / 2) / n;
        const h = size * (0.55 + mid * 0.5) * (0.85 + 0.15 * Math.sin(age * 9 + i * 1.9));
        const sway = Math.sin(age * 6 + i * 2.3) * w * 0.35;
        colors.forEach((c, j) => {
          const k = 1 - j * 0.28;
          ctx.save();
          ctx.translate(fx, s * 0.5);
          ctx.fillStyle = c;
          flame(ctx, w * 1.5 * k, h * k, sway * k);
          ctx.restore();
        });
      }
      // chispas
      for (let i = 0; i < 10; i++) {
        const ph = (age * 0.9 + seeded(i)) % 1;
        ctx.globalAlpha = 1 - ph;
        ctx.fillStyle = i % 2 ? "#fde047" : "#fb923c";
        ctx.beginPath();
        ctx.arc((seeded(i + 20) - 0.5) * size + Math.sin(age * 5 + i) * 8, s * 0.5 - ph * size * 1.3, 4, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case "zap": {
      const cycle = 0.7;
      const k = Math.floor(age / cycle);
      const on = age % cycle < 0.3;
      if (on) {
        const pts: [number, number][] = [[0, -s]];
        const steps = 6;
        for (let i = 1; i < steps; i++) pts.push([(seeded(k * 13 + i) - 0.5) * s * 0.9, -s + (i / steps) * size]);
        pts.push([(seeded(k * 7) - 0.5) * s * 0.3, s]);
        ctx.lineJoin = "miter";
        ctx.shadowColor = "#fde047";
        ctx.shadowBlur = 30;
        ctx.strokeStyle = "#facc15";
        ctx.lineWidth = size * 0.09;
        ctx.beginPath();
        pts.forEach(([px, py]) => ctx.lineTo(px, py));
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = "#fffbeb";
        ctx.lineWidth = size * 0.035;
        ctx.stroke();
      }
      break;
    }
    case "smoke": {
      for (let i = 0; i < 9; i++) {
        const ph = (age * 0.45 + i / 9) % 1;
        ctx.globalAlpha = 0.65 * (1 - ph);
        ctx.fillStyle = i % 2 ? "#d1d5db" : "#9ca3af";
        ctx.beginPath();
        ctx.arc(
          Math.sin(i * 2.1 + age) * s * 0.35,
          s * 0.6 - ph * size,
          s * (0.18 + ph * 0.35),
          0,
          Math.PI * 2
        );
        ctx.fill();
      }
      break;
    }
    case "sparkle": {
      for (let i = 0; i < 8; i++) {
        const tw = Math.max(0, Math.sin(age * 4 + i * 1.7));
        const r = s * 0.18 * tw + 2;
        ctx.save();
        ctx.translate((seeded(i) - 0.5) * size, (seeded(i + 40) - 0.5) * size);
        ctx.rotate(age + i);
        ctx.fillStyle = i % 3 === 0 ? "#fde047" : "#ffffff";
        ctx.beginPath();
        for (let j = 0; j < 8; j++) {
          const a = (j / 8) * Math.PI * 2;
          const rr = j % 2 === 0 ? r : r * 0.25;
          ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
        }
        ctx.fill();
        ctx.restore();
      }
      break;
    }
    case "hearts": {
      for (let i = 0; i < 6; i++) {
        const ph = (age * 0.4 + i / 6) % 1;
        ctx.globalAlpha = Math.min(1, (1 - ph) * 1.6);
        emoji(ctx, i % 2 ? "💖" : "❤️", (seeded(i) - 0.5) * size * 0.8 + Math.sin(age * 3 + i) * 10, s - ph * size, s * 0.35 + ph * 10);
      }
      break;
    }
    case "dizzy": {
      ctx.scale(1, 0.4);
      for (let i = 0; i < 5; i++) {
        const a = age * 3.5 + (i / 5) * Math.PI * 2;
        const behind = Math.sin(a) < 0;
        ctx.globalAlpha = behind ? 0.55 : 1;
        ctx.save();
        ctx.translate(Math.cos(a) * s, Math.sin(a) * s);
        ctx.scale(1, 2.5);
        emoji(ctx, i % 2 ? "⭐" : "💫", 0, s * 0.15, s * 0.3);
        ctx.restore();
      }
      break;
    }
    case "rain": {
      // nube y gotas debajo
      ctx.fillStyle = "#94a3b8";
      for (let i = 0; i < 10; i++) {
        const ph = (age * 1.6 + seeded(i)) % 1;
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = "#38bdf8";
        ctx.beginPath();
        ctx.ellipse((seeded(i + 9) - 0.5) * size * 0.9, -s * 0.2 + ph * size * 1.1, 3, 9, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#64748b";
      [[-0.45, -0.45, 0.32], [0, -0.6, 0.42], [0.45, -0.45, 0.32], [0, -0.35, 0.38]].forEach(([cx, cy, r]) => {
        ctx.beginPath();
        ctx.arc(cx * s, cy * s, r * s, 0, Math.PI * 2);
        ctx.fill();
      });
      break;
    }
    default: {
      if (!kind.startsWith("gif:")) break;
      const g = gifs?.get(kind.slice(4));
      if (!g || !g.frames.length) {
        emoji(ctx, "🖼️", 0, s * 0.3, s * 0.6);
        break;
      }
      const tt = g.total > 0 ? age % g.total : 0;
      let i = g.ends.findIndex((e) => e > tt);
      if (i < 0) i = g.frames.length - 1;
      const h = (size * g.h) / g.w;
      ctx.drawImage(g.frames[i], -size / 2, -h / 2, size, h);
    }
  }
  ctx.restore();
}

// ---------- GIFs del niño ----------
type DecodedFrame = { image: CanvasImageSource & { duration: number | null; close(): void } };
interface ImageDecoderLike {
  tracks: { ready: Promise<void>; selectedTrack: { frameCount: number } | null };
  decode(o: { frameIndex: number }): Promise<DecodedFrame>;
  close(): void;
}
type ImageDecoderCtor = (new (init: { data: ArrayBuffer; type: string }) => ImageDecoderLike) & {
  isTypeSupported?: (t: string) => Promise<boolean>;
};

const GIF_SIDE = 360;
const MAX_FRAMES = 150;

async function scaled(src: ImageBitmapSource, w: number, h: number): Promise<ImageBitmap> {
  const k = Math.min(1, GIF_SIDE / Math.max(w, h));
  return createImageBitmap(src, { resizeWidth: Math.max(1, Math.round(w * k)), resizeHeight: Math.max(1, Math.round(h * k)) });
}

function thumbOf(frame: CanvasImageSource, w: number, h: number): string {
  const c = document.createElement("canvas");
  const k = 96 / Math.max(w, h);
  c.width = Math.max(1, Math.round(w * k));
  c.height = Math.max(1, Math.round(h * k));
  c.getContext("2d")!.drawImage(frame, 0, 0, c.width, c.height);
  return c.toDataURL("image/png");
}

// Separa el GIF en cuadros (si la tablet no sabe, queda como imagen fija)
export async function decodeGif(blob: Blob): Promise<GifAnim> {
  const Decoder = (globalThis as unknown as { ImageDecoder?: ImageDecoderCtor }).ImageDecoder;
  if (Decoder && blob.type && (!Decoder.isTypeSupported || (await Decoder.isTypeSupported(blob.type)))) {
    try {
      const dec = new Decoder({ data: await blob.arrayBuffer(), type: blob.type });
      await dec.tracks.ready;
      const count = Math.min(MAX_FRAMES, dec.tracks.selectedTrack?.frameCount ?? 1);
      const frames: CanvasImageSource[] = [];
      const ends: number[] = [];
      let t = 0, w = 0, h = 0;
      for (let i = 0; i < count; i++) {
        const { image } = await dec.decode({ frameIndex: i });
        const vf = image as unknown as { displayWidth: number; displayHeight: number };
        w = vf.displayWidth;
        h = vf.displayHeight;
        frames.push(await scaled(image as unknown as ImageBitmapSource, w, h));
        t += Math.max(0.02, (image.duration ?? 100000) / 1e6);
        ends.push(t);
        image.close();
      }
      dec.close();
      if (frames.length) return { frames, ends, total: t, w, h, thumb: thumbOf(frames[0], w, h) };
    } catch {
      /* cae a imagen fija */
    }
  }
  const bmp = await createImageBitmap(blob);
  const one = await scaled(bmp, bmp.width, bmp.height);
  const anim = { frames: [one], ends: [1], total: 1, w: bmp.width, h: bmp.height, thumb: thumbOf(one, bmp.width, bmp.height) };
  bmp.close();
  return anim;
}
