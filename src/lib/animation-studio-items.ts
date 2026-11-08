// Estudio de Animación — accesorios que se pegan a una parte del personaje.
// Se pintan dentro de la parte, así giran con ella. Las "armas" son de juguete:
// colores vivos y punta naranja, nada realista.
import type { CharacterItem, PartId } from "@/lib/animation-studio-data";

export const ITEMS: { id: string; label: string; emoji: string; part: PartId; size: number; colors?: boolean }[] = [
  { id: "blaster", label: "Láser de juguete", emoji: "🔫", part: "armR", size: 95, colors: true },
  { id: "saber", label: "Espada láser", emoji: "🗡️", part: "armR", size: 150, colors: true },
  { id: "armor", label: "Peto de héroe", emoji: "🦺", part: "body", size: 125, colors: true },
  { id: "bubble", label: "Casco espacial", emoji: "👨‍🚀", part: "head", size: 175 },
  { id: "knight", label: "Casco de caballero", emoji: "⛑️", part: "head", size: 150, colors: true },
  { id: "crown", label: "Corona", emoji: "👑", part: "head", size: 80 },
  { id: "tophat", label: "Sombrero", emoji: "🎩", part: "head", size: 95 },
  { id: "cap", label: "Gorra", emoji: "🧢", part: "head", size: 100 },
  { id: "glasses", label: "Lentes", emoji: "🕶️", part: "head", size: 80 },
  { id: "shield", label: "Escudo", emoji: "🛡️", part: "armL", size: 85 },
  { id: "wand", label: "Varita", emoji: "🪄", part: "armR", size: 75 },
  { id: "headphones", label: "Audífonos", emoji: "🎧", part: "head", size: 140 },
];

export const ITEM_COLORS = ["#22d3ee", "#a3e635", "#f472b6", "#facc15", "#a78bfa", "#f87171"];

export const itemInfo = (kind: string) => ITEMS.find((i) => i.id === kind);

const outline = (ctx: CanvasRenderingContext2D) => {
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#111827";
  ctx.stroke();
};

// Dónde aparece al ponerlo: en la cabeza, el pecho o la mano (hands = punta de cada brazo)
export function placeItem(kind: string, hands: Partial<Record<PartId, [number, number]>>, id: string): CharacterItem | null {
  const info = itemInfo(kind);
  if (!info) return null;
  const at: Record<string, [number, number]> = {
    bubble: [200, 100], knight: [200, 85], crown: [200, 38], tophat: [200, 30], cap: [205, 48],
    glasses: [200, 92], headphones: [200, 95], armor: [200, 250],
  };
  const hand = hands[info.part] ?? (info.part === "armL" ? [125, 310] : [275, 310]);
  const [x, y] = at[kind] ?? hand;
  return {
    id,
    kind,
    part: info.part,
    x,
    y,
    size: info.size,
    rot: kind === "saber" ? -Math.PI / 2 : 0,
    flip: info.part === "armL" && kind !== "shield",
    color: info.colors ? ITEM_COLORS[0] : undefined,
  };
}

// Pinta el accesorio en coordenadas del personaje
export function drawItem(ctx: CanvasRenderingContext2D, it: CharacterItem) {
  ctx.save();
  ctx.translate(it.x, it.y);
  ctx.rotate(it.rot);
  ctx.scale(it.flip ? -1 : 1, 1);
  const color = it.color ?? ITEM_COLORS[0];
  const k = it.size / 100;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  switch (it.kind) {
    case "blaster": {
      ctx.scale(k, k);
      // mango
      ctx.beginPath();
      ctx.roundRect(-28, -2, 18, 34, 6);
      ctx.fillStyle = "#facc15";
      ctx.fill();
      outline(ctx);
      // cuerpo
      ctx.beginPath();
      ctx.roundRect(-42, -20, 74, 28, 12);
      ctx.fillStyle = color;
      ctx.fill();
      outline(ctx);
      // aleta
      ctx.beginPath();
      ctx.moveTo(-30, -20);
      ctx.lineTo(-18, -34);
      ctx.lineTo(-4, -20);
      ctx.fillStyle = "#f472b6";
      ctx.fill();
      outline(ctx);
      // cañón y punta naranja de juguete
      ctx.beginPath();
      ctx.roundRect(28, -15, 18, 18, 5);
      ctx.fillStyle = "#e5e7eb";
      ctx.fill();
      outline(ctx);
      ctx.beginPath();
      ctx.roundRect(44, -17, 10, 22, 4);
      ctx.fillStyle = "#f97316";
      ctx.fill();
      outline(ctx);
      // lucecitas
      ["#ffffff", "#fde047", "#ffffff"].forEach((c, i) => {
        ctx.beginPath();
        ctx.arc(-26 + i * 14, -6, 4, 0, Math.PI * 2);
        ctx.fillStyle = c;
        ctx.fill();
      });
      break;
    }
    case "saber": {
      ctx.scale(k, k);
      // rayo de luz
      ctx.save();
      ctx.shadowColor = color;
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.roundRect(-18, -6, 70, 12, 6);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.restore();
      ctx.beginPath();
      ctx.roundRect(-16, -2.5, 66, 5, 3);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      // mango
      ctx.beginPath();
      ctx.roundRect(-50, -7, 34, 14, 4);
      ctx.fillStyle = "#9ca3af";
      ctx.fill();
      outline(ctx);
      ctx.fillStyle = "#111827";
      [-42, -32].forEach((x) => ctx.fillRect(x, -7, 4, 14));
      ctx.fillStyle = "#ef4444";
      ctx.fillRect(-24, -3, 5, 6);
      break;
    }
    case "armor": {
      ctx.scale(k, k);
      ctx.beginPath();
      ctx.moveTo(-50, -45);
      ctx.quadraticCurveTo(0, -60, 50, -45);
      ctx.lineTo(44, 20);
      ctx.quadraticCurveTo(0, 62, -44, 20);
      ctx.closePath();
      const g = ctx.createLinearGradient(-50, -50, 50, 50);
      g.addColorStop(0, "#ffffff");
      g.addColorStop(0.35, color);
      g.addColorStop(1, color);
      ctx.fillStyle = g;
      ctx.fill();
      outline(ctx);
      // estrella al centro
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const r = i % 2 ? 9 : 22;
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fillStyle = "#facc15";
      ctx.fill();
      outline(ctx);
      break;
    }
    case "bubble": {
      ctx.scale(k, k);
      ctx.beginPath();
      ctx.arc(0, 0, 50, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(186,230,253,0.28)";
      ctx.fill();
      ctx.lineWidth = 5;
      ctx.strokeStyle = "#e0f2fe";
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, 40, -2.6, -1.9);
      ctx.lineWidth = 6;
      ctx.strokeStyle = "rgba(255,255,255,0.9)";
      ctx.stroke();
      // antena
      ctx.beginPath();
      ctx.moveTo(0, -50);
      ctx.lineTo(0, -64);
      ctx.lineWidth = 3;
      ctx.strokeStyle = "#9ca3af";
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, -67, 5, 0, Math.PI * 2);
      ctx.fillStyle = "#ef4444";
      ctx.fill();
      // cuello del traje
      ctx.beginPath();
      ctx.ellipse(0, 50, 32, 9, 0, 0, Math.PI * 2);
      ctx.fillStyle = "#e5e7eb";
      ctx.fill();
      outline(ctx);
      break;
    }
    case "knight": {
      ctx.scale(k, k);
      ctx.beginPath();
      ctx.moveTo(-42, 30);
      ctx.lineTo(-42, -10);
      ctx.quadraticCurveTo(-42, -50, 0, -50);
      ctx.quadraticCurveTo(42, -50, 42, -10);
      ctx.lineTo(42, 30);
      ctx.lineTo(16, 30);
      ctx.lineTo(16, 0);
      ctx.lineTo(-16, 0);
      ctx.lineTo(-16, 30);
      ctx.closePath();
      ctx.fillStyle = "#cbd5e1";
      ctx.fill();
      outline(ctx);
      // penacho de color
      ctx.beginPath();
      ctx.moveTo(0, -50);
      ctx.quadraticCurveTo(20, -78, 46, -70);
      ctx.quadraticCurveTo(26, -60, 8, -48);
      ctx.fillStyle = color;
      ctx.fill();
      outline(ctx);
      break;
    }
    default: {
      const info = itemInfo(it.kind);
      if (!info) break;
      ctx.font = `${it.size}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(info.emoji, 0, it.size * 0.05);
    }
  }
  ctx.restore();
}

// Caja aproximada para tocarlo con el dedo
export function itemHit(it: CharacterItem, x: number, y: number): boolean {
  return Math.hypot(x - it.x, y - it.y) < Math.max(28, it.size * 0.55);
}
