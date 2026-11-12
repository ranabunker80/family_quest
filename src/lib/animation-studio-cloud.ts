// Respaldo en la nube del Estudio de Animación.
// La tablet sigue siendo la fuente principal (IndexedDB); cada cambio se copia a Supabase Storage
// (bucket privado `studio-backup`, carpeta = id del niño) para que nada se pierda si se borra el
// navegador o si entra desde otra tablet. Al abrir el estudio se juntan las dos copias por id.
import { createClient } from "@/lib/supabase/client";

const BUCKET = "studio-backup";
const PREFIX = "fq-animation-studio:";
const DEBOUNCE_MS = 2500;
// Lo que se respalda: personajes ("") y sus listas. Los GIF no: pesan mucho y se pueden volver a subir.
export const CLOUD_SUFFIXES = ["", ":backgrounds", ":stories", ":movies", ":frames", ":moves"];

interface WithId {
  id: string;
  updatedAt?: number;
}

function cloudPath(key: string): string | null {
  if (!key.startsWith(PREFIX)) return null;
  const rest = key.slice(PREFIX.length);
  const cut = rest.indexOf(":");
  const uid = cut < 0 ? rest : rest.slice(0, cut);
  const suffix = cut < 0 ? "" : rest.slice(cut + 1);
  if (!uid || uid === "parent-preview" || uid === "vista-previa") return null;
  if (!CLOUD_SUFFIXES.includes(suffix ? `:${suffix}` : "")) return null;
  return `${uid}/${suffix || "characters"}.json`;
}

// ---------- Blobs (voces) <-> texto ----------
function blobToDataUrl(b: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(b);
  });
}

async function encode(v: unknown): Promise<unknown> {
  if (v instanceof Blob) return { $blob: await blobToDataUrl(v) };
  if (Array.isArray(v)) return Promise.all(v.map(encode));
  if (v && typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v)) out[k] = await encode(x);
    return out;
  }
  return v;
}

async function decode(v: unknown): Promise<unknown> {
  if (Array.isArray(v)) return Promise.all(v.map(decode));
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    if (typeof o.$blob === "string") return (await fetch(o.$blob)).blob();
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(o)) out[k] = await decode(x);
    return out;
  }
  return v;
}

// ---------- Subir (con espera para juntar cambios seguidos) ----------
const pending = new Map<string, { value: unknown; timer: ReturnType<typeof setTimeout> }>();

async function upload(path: string, value: unknown) {
  try {
    const body = JSON.stringify(await encode(value));
    const { error } = await createClient()
      .storage.from(BUCKET)
      .upload(path, new Blob([body], { type: "application/json" }), { upsert: true, contentType: "application/json" });
    if (error) console.warn("[estudio] respaldo en la nube falló", error.message);
  } catch (e) {
    console.warn("[estudio] respaldo en la nube falló", e);
  }
}

export function scheduleCloudBackup(key: string, value: unknown) {
  const path = cloudPath(key);
  if (!path || !Array.isArray(value)) return;
  const prev = pending.get(path);
  if (prev) clearTimeout(prev.timer);
  const timer = setTimeout(() => {
    pending.delete(path);
    upload(path, value);
  }, DEBOUNCE_MS);
  pending.set(path, { value, timer });
}

// Si cierran la pestaña con un respaldo esperando, mandarlo ya.
if (typeof window !== "undefined") {
  window.addEventListener("pagehide", () => {
    for (const [path, p] of pending) {
      clearTimeout(p.timer);
      upload(path, p.value);
    }
    pending.clear();
  });
}

// ---------- Bajar ----------
export async function loadCloudList<T>(key: string): Promise<T[] | null> {
  const path = cloudPath(key);
  if (!path) return null;
  try {
    const { data, error } = await createClient().storage.from(BUCKET).download(path);
    if (error || !data) return null;
    const parsed = await decode(JSON.parse(await data.text()));
    return Array.isArray(parsed) ? (parsed as T[]) : null;
  } catch {
    return null;
  }
}

// Junta dos listas por id: lo que está en la tablet va primero; si los dos tienen el mismo, gana el más nuevo.
export function mergeById<T extends WithId>(local: T[], cloud: T[]): T[] {
  const out = local.slice();
  const index = new Map(out.map((x, i) => [x.id, i]));
  for (const c of cloud) {
    const i = index.get(c.id);
    if (i === undefined) {
      index.set(c.id, out.length);
      out.push(c);
    } else if ((c.updatedAt ?? 0) > (out[i].updatedAt ?? 0)) {
      out[i] = c;
    }
  }
  return out;
}

// Pedirle al navegador que no borre el estudio cuando se llena la tablet.
export function askPersistentStorage() {
  try {
    navigator.storage?.persist?.().catch(() => {});
  } catch {
    /* navegador sin soporte */
  }
}
