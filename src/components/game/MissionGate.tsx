"use client";

// Candado de misión: antes de jugar, el niño tiene que aprenderse su frase.
// Por pedacitos: escuchar → ordenar → completar; luego unir los pedazos y decirlos en voz alta.
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { type PhraseMission, cleanWord, localDay, missionWords } from "@/lib/missions";
import { playSfx, unlockAudio } from "@/lib/audio";
import { shuffleArray } from "@/lib/phrase-data";
import Confetti from "./Confetti";

type Step =
  | { kind: "listen" | "order" | "holes" | "say"; chunk: number }
  | { kind: "join" };

const noopSubscribe = () => () => {};
const doneKey = (m: PhraseMission) => `fq-mission:${m.id}:${localDay()}`;
const PASS = 0.7;

function buildSteps(m: PhraseMission): Step[] {
  const steps: Step[] = [];
  m.chunks.forEach((_, chunk) => {
    steps.push({ kind: "listen", chunk }, { kind: "order", chunk }, { kind: "holes", chunk });
  });
  steps.push({ kind: "join" });
  m.chunks.forEach((_, chunk) => steps.push({ kind: "say", chunk }));
  return steps;
}

const STEP_LABEL: Record<Step["kind"], string> = {
  listen: "👂 Escucha y lee",
  order: "🧩 Ordena las palabras",
  holes: "✏️ Completa los huecos",
  join: "🔗 Une los pedazos",
  say: "🎤 Dila sin ver",
};

// --- Audio de la frase ---

function useMissionAudio(m: PhraseMission) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const tokenRef = useRef(0);
  const [playing, setPlaying] = useState<number | null>(null);
  const [slow, setSlow] = useState(false);

  const stop = useCallback(() => {
    tokenRef.current++;
    audioRef.current?.pause();
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    setPlaying(null);
  }, []);

  const play = useCallback(
    (chunks: number[]) => {
      stop();
      const token = tokenRef.current;
      const next = (i: number) => {
        if (token !== tokenRef.current) return;
        if (i >= chunks.length) return setPlaying(null);
        const c = chunks[i];
        setPlaying(c);
        const a = audioRef.current ?? new Audio();
        audioRef.current = a;
        a.src = `${m.audioDir}/chunk-${c + 1}.mp3`;
        a.playbackRate = slow ? 0.75 : 1;
        a.onended = () => setTimeout(() => next(i + 1), 350);
        a.onerror = () => speak(m.chunks[c].text, slow, () => next(i + 1));
        a.play().catch(() => speak(m.chunks[c].text, slow, () => next(i + 1)));
      };
      next(0);
    },
    [m, slow, stop]
  );

  const playCongrats = useCallback(() => {
    stop();
    const a = audioRef.current ?? new Audio();
    audioRef.current = a;
    loadAudio(a, `${m.audioDir}/congrats.mp3`, 1);
    a.play().catch(() => {});
  }, [m, stop]);

  useEffect(() => stop, [stop]);
  return { play, stop, playing, slow, setSlow, playCongrats };
}

function loadAudio(a: HTMLAudioElement, src: string, rate: number) {
  a.src = src;
  a.playbackRate = rate;
  a.onended = null;
}

function speak(text: string, slow = false, onEnd?: () => void) {
  if (typeof window === "undefined" || !window.speechSynthesis) return onEnd?.();
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "en-US";
  u.rate = slow ? 0.7 : 0.9;
  if (onEnd) u.onend = () => onEnd();
  window.speechSynthesis.speak(u);
}

// --- Componente principal ---

export default function MissionGate({
  mission,
  previewMode = false,
  gameName,
  children,
}: {
  mission: PhraseMission | null;
  previewMode?: boolean;
  gameName: string;
  children: ReactNode;
}) {
  // ¿Ya la cumplió hoy? (null mientras no hay navegador)
  const doneToday = useSyncExternalStore(
    noopSubscribe,
    () => {
      if (!mission || previewMode) return false;
      try {
        return localStorage.getItem(doneKey(mission)) === "1";
      } catch {
        return false;
      }
    },
    () => null
  );
  const [phase, setStatus] = useState<"locked" | "playing" | "won" | "open" | null>(null);
  const status = !mission ? "open" : phase ?? (doneToday === null ? "checking" : doneToday ? "open" : "locked");
  const steps = useMemo(() => (mission ? buildSteps(mission) : []), [mission]);
  const [stepIdx, setStepIdx] = useState(0);

  if (!mission || status === "open") return <>{children}</>;
  if (status === "checking") return null;

  const finish = () => {
    if (!previewMode) {
      try {
        localStorage.setItem(doneKey(mission), "1");
      } catch {}
    }
    setStatus("won");
  };

  return (
    <MissionShell mission={mission}>
      {(audio) =>
        status === "locked" ? (
          <LockScreen mission={mission} gameName={gameName} audio={audio} onStart={() => { unlockAudio(); setStatus("playing"); }} />
        ) : status === "won" ? (
          <WinScreen mission={mission} audio={audio} gameName={gameName} onPlay={() => setStatus("open")} />
        ) : (
          <StepRunner
            key={stepIdx}
            mission={mission}
            step={steps[stepIdx]}
            index={stepIdx}
            total={steps.length}
            audio={audio}
            onNext={() => {
              audio.stop();
              if (stepIdx + 1 >= steps.length) finish();
              else setStepIdx(stepIdx + 1);
            }}
          />
        )
      }
    </MissionShell>
  );
}

type MissionAudio = ReturnType<typeof useMissionAudio>;

function MissionShell({ mission, children }: { mission: PhraseMission; children: (audio: MissionAudio) => ReactNode }) {
  const audio = useMissionAudio(mission);
  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto px-2 pb-8 min-h-full flex flex-col">{children(audio)}</div>
      <style>{`
        @keyframes mg-shake { 0%,100% { transform: translateX(0); } 25% { transform: translateX(-8px); } 75% { transform: translateX(8px); } }
        .mg-shake { animation: mg-shake 0.35s ease-in-out; }
        @keyframes mg-pop { from { opacity: 0; transform: scale(0.9) translateY(10px); } to { opacity: 1; transform: none; } }
        .mg-pop { animation: mg-pop 0.35s ease-out; }
      `}</style>
    </div>
  );
}

// --- Pantalla de candado ---

function LockScreen({ mission, gameName, audio, onStart }: { mission: PhraseMission; gameName: string; audio: MissionAudio; onStart: () => void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center gap-5 py-4 mg-pop">
      <div className="text-7xl">🔒</div>
      <div>
        <h1 className="text-3xl lg:text-4xl font-black text-white">¡Misión especial, {mission.kidName}!</h1>
        <p className="text-lg text-white/80 mt-2">
          Si quieres seguir jugando <b className="text-yellow-300">{gameName}</b>, primero tienes que cumplir esta misión:
        </p>
      </div>
      <div className="w-full bg-amber-50 text-slate-800 rounded-3xl p-5 shadow-2xl border-4 border-amber-300 text-left rotate-[-0.5deg]">
        <p className="text-sm font-black text-amber-700 uppercase tracking-wider mb-2">🎯 Apréndete tu frase para la escuela</p>
        <p className="text-xl lg:text-2xl font-bold leading-snug">
          {mission.chunks.map((c, i) => (
            <span key={i} className={audio.playing === i ? "bg-yellow-300 rounded" : ""}>{c.text} </span>
          ))}
        </p>
      </div>
      <div className="flex flex-wrap gap-3 justify-center">
        <button
          onClick={() => { unlockAudio(); audio.play(mission.chunks.map((_, i) => i)); }}
          className="bg-white/10 hover:bg-white/20 text-white font-bold text-lg px-6 rounded-2xl min-h-[56px] active:scale-95 transition-all"
        >
          🔊 Escuchar mi frase
        </button>
        <button
          onClick={onStart}
          className="bg-gradient-to-r from-yellow-400 to-orange-500 text-black font-black text-xl px-10 rounded-2xl min-h-[56px] shadow-xl active:scale-95 hover:scale-105 transition-all"
        >
          ¡Acepto la misión! 🚀
        </button>
      </div>
      <p className="text-sm text-white/50">La vas a aprender por pedacitos. Al final la dices en voz alta sin verla.</p>
    </div>
  );
}

// --- Pantalla de victoria ---

function WinScreen({ mission, audio, gameName, onPlay }: { mission: PhraseMission; audio: MissionAudio; gameName: string; onPlay: () => void }) {
  useEffect(() => {
    playSfx("success");
    const t = setTimeout(() => audio.playCongrats(), 600);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center gap-5 py-4 mg-pop relative">
      <Confetti />
      <div className="text-7xl">🏆</div>
      <h1 className="text-3xl lg:text-4xl font-black text-white">¡Misión cumplida, {mission.kidName}!</h1>
      <p className="text-lg text-white/80">Ya te sabes tu frase. ¡Mañana la vas a decir increíble!</p>
      <div className="w-full bg-white/10 rounded-3xl p-4 text-left text-lg text-white/90 leading-snug">
        {mission.chunks.map((c, i) => (
          <span key={i} className={audio.playing === i ? "text-yellow-300" : ""}>{c.text} </span>
        ))}
      </div>
      <div className="flex flex-wrap gap-3 justify-center">
        <button onClick={() => audio.play(mission.chunks.map((_, i) => i))} className="bg-white/10 hover:bg-white/20 text-white font-bold text-lg px-6 rounded-2xl min-h-[56px] active:scale-95 transition-all">
          🔊 Escucharla otra vez
        </button>
        <button onClick={onPlay} className="bg-gradient-to-r from-emerald-400 to-teal-500 text-black font-black text-xl px-10 rounded-2xl min-h-[56px] shadow-xl active:scale-95 hover:scale-105 transition-all">
          🎬 ¡A jugar {gameName}!
        </button>
      </div>
    </div>
  );
}

// --- Encabezado de cada paso ---

function StepRunner({ mission, step, index, total, audio, onNext }: { mission: PhraseMission; step: Step; index: number; total: number; audio: MissionAudio; onNext: () => void }) {
  const piece = step.kind === "join" ? null : step.chunk;
  return (
    <div className="flex-1 flex flex-col gap-4 py-2">
      <div className="flex items-center gap-3">
        <div className="flex-1 h-3 bg-white/10 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-yellow-400 to-orange-500 transition-all" style={{ width: `${(index / total) * 100}%` }} />
        </div>
        <span className="text-sm font-bold text-white/60 whitespace-nowrap">{index + 1} / {total}</span>
      </div>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-2xl font-black text-white">{STEP_LABEL[step.kind]}</h2>
        <div className="flex items-center gap-2">
          {piece !== null && <span className="text-sm font-bold text-amber-300 bg-amber-300/10 px-3 py-1 rounded-full">Pedazo {piece + 1} de {mission.chunks.length}</span>}
          <button
            onClick={() => audio.setSlow(!audio.slow)}
            className={`text-sm font-bold px-3 rounded-full min-h-[40px] ${audio.slow ? "bg-sky-400 text-black" : "bg-white/10 text-white/70"}`}
            title="Velocidad de la voz"
          >
            {audio.slow ? "🐢 Lento" : "🐇 Normal"}
          </button>
        </div>
      </div>
      {step.kind === "listen" && <ListenStep mission={mission} chunk={step.chunk} audio={audio} onNext={onNext} />}
      {step.kind === "order" && <OrderStep mission={mission} chunk={step.chunk} audio={audio} onNext={onNext} />}
      {step.kind === "holes" && <HolesStep mission={mission} chunk={step.chunk} audio={audio} onNext={onNext} />}
      {step.kind === "join" && <JoinStep mission={mission} audio={audio} onNext={onNext} />}
      {step.kind === "say" && <SayStep mission={mission} chunk={step.chunk} audio={audio} onNext={onNext} />}
    </div>
  );
}

function NextButton({ onClick, label = "Siguiente ➡" }: { onClick: () => void; label?: string }) {
  return (
    <div className="text-center mg-pop">
      <div className="text-5xl mb-2">✅</div>
      <button onClick={onClick} className="bg-white text-black font-black text-xl px-12 rounded-2xl min-h-[56px] shadow-xl active:scale-95 hover:scale-105 transition-all">
        {label}
      </button>
    </div>
  );
}

function Meaning({ text }: { text: string }) {
  return <p className="text-base text-white/60">🇲🇽 Quiere decir: <i>{text}</i></p>;
}

// --- 1. Escuchar y leer ---

function ListenStep({ mission, chunk, audio, onNext }: { mission: PhraseMission; chunk: number; audio: MissionAudio; onNext: () => void }) {
  const [heard, setHeard] = useState(0);
  const c = mission.chunks[chunk];
  const listen = () => {
    audio.play([chunk]);
    setHeard((h) => h + 1);
  };
  useEffect(() => {
    const t = setTimeout(listen, 300);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-5 text-center">
      <p className="text-white/70">Escúchala y repítela en voz alta 2 veces.</p>
      <div className={`w-full rounded-3xl p-6 text-2xl lg:text-3xl font-bold leading-snug transition-colors ${audio.playing === chunk ? "bg-yellow-300 text-black" : "bg-white/10 text-white"}`}>
        {missionWords(c.text).map((w, i) => (
          <button key={i} onClick={() => speak(w, audio.slow)} className="hover:underline decoration-dotted mr-2">{w}</button>
        ))}
      </div>
      <Meaning text={c.es} />
      <p className="text-xs text-white/40">Toca una palabra para oírla sola.</p>
      <button onClick={listen} className="bg-sky-500/20 text-sky-200 font-bold text-lg px-6 rounded-2xl min-h-[56px] active:scale-95 transition-all">🔊 Escuchar otra vez</button>
      {heard >= 2 ? <NextButton onClick={onNext} label="Ya la repetí ➡" /> : <p className="text-sm text-white/50">Escúchala una vez más para seguir.</p>}
    </div>
  );
}

// --- 2. Ordenar palabras ---

function OrderStep({ mission, chunk, audio, onNext }: { mission: PhraseMission; chunk: number; audio: MissionAudio; onNext: () => void }) {
  const words = useMemo(() => missionWords(mission.chunks[chunk].text), [mission, chunk]);
  const [bank] = useState(() => shuffleArray(words.map((w, i) => ({ w, i }))));
  const [placed, setPlaced] = useState<number[]>([]);
  const [shake, setShake] = useState<number | null>(null);
  const done = placed.length === words.length;

  const tap = (i: number) => {
    if (done || placed.includes(i)) return;
    // palabras repetidas cuentan igual
    const expected = words[placed.length];
    const target = cleanWord(words[i]) === cleanWord(expected) ? placed.length : i;
    if (target === placed.length) {
      const next = [...placed, i];
      setPlaced(next);
      speak(words[i], audio.slow);
      if (next.length === words.length) {
        playSfx("success");
        setTimeout(() => audio.play([chunk]), 400);
      }
    } else {
      playSfx("error");
      setShake(i);
      setTimeout(() => setShake(null), 400);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6">
      <p className="text-white/70 text-center">Toca las palabras en el orden correcto.</p>
      <div className="flex flex-wrap gap-2 justify-center min-h-[56px]">
        {words.map((w, i) => (
          <span key={i} className={`px-3 py-2 rounded-xl text-xl font-bold border-2 min-w-[48px] text-center ${i < placed.length ? "border-teal-400 bg-teal-400/20 text-teal-200" : "border-dashed border-white/20 text-white/20"}`}>
            {i < placed.length ? words[placed[i]] : "?"}
          </span>
        ))}
      </div>
      {!done && (
        <div className="flex flex-wrap gap-3 justify-center">
          {bank.map(({ w, i }) => (
            <button
              key={i}
              onClick={() => tap(i)}
              disabled={placed.includes(i)}
              className={`px-5 rounded-full text-xl font-bold min-h-[56px] transition-all ${placed.includes(i) ? "bg-white/5 text-white/15" : "bg-white/15 text-white hover:bg-white/25 active:scale-95"} ${shake === i ? "mg-shake bg-red-500/40" : ""}`}
            >
              {w}
            </button>
          ))}
        </div>
      )}
      <div className="flex gap-3">
        <button onClick={() => audio.play([chunk])} className="bg-sky-500/20 text-sky-200 font-bold px-5 rounded-2xl min-h-[56px] active:scale-95">🔊 Pista</button>
      </div>
      {done && <NextButton onClick={onNext} />}
    </div>
  );
}

// --- 3. Completar huecos ---

function pickHoles(words: string[]): number[] {
  const idx = words.map((_, i) => i).filter((i) => cleanWord(words[i]).length > 3);
  const pool = idx.length >= 2 ? idx : words.map((_, i) => i);
  const n = Math.max(2, Math.ceil(words.length * 0.4));
  return shuffleArray(pool).slice(0, Math.min(n, pool.length)).sort((a, b) => a - b);
}

function HolesStep({ mission, chunk, audio, onNext }: { mission: PhraseMission; chunk: number; audio: MissionAudio; onNext: () => void }) {
  const words = useMemo(() => missionWords(mission.chunks[chunk].text), [mission, chunk]);
  const [holes] = useState(() => pickHoles(words));
  const [bank] = useState(() => {
    const correct = holes.map((i) => words[i]);
    const own = new Set(words.map(cleanWord));
    const others = mission.chunks.flatMap((c, j) => (j === chunk ? [] : missionWords(c.text))).filter((w) => cleanWord(w).length > 3 && !own.has(cleanWord(w)));
    const distract = shuffleArray([...new Set(others)]).slice(0, 2);
    return shuffleArray([...correct, ...distract].map((w, k) => ({ w, k })));
  });
  const [filled, setFilled] = useState(0);
  const [used, setUsed] = useState<number[]>([]);
  const [shake, setShake] = useState<number | null>(null);
  const done = filled === holes.length;

  const tap = (w: string, k: number) => {
    if (done || used.includes(k)) return;
    if (cleanWord(w) === cleanWord(words[holes[filled]])) {
      setUsed([...used, k]);
      setFilled(filled + 1);
      speak(w, audio.slow);
      if (filled + 1 === holes.length) {
        playSfx("success");
        setTimeout(() => audio.play([chunk]), 400);
      }
    } else {
      playSfx("error");
      setShake(k);
      setTimeout(() => setShake(null), 400);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6">
      <p className="text-white/70 text-center">¿Qué palabra va en el hueco amarillo?</p>
      <div className="flex flex-wrap gap-x-2 gap-y-3 justify-center items-center text-2xl font-bold">
        {words.map((w, i) => {
          const h = holes.indexOf(i);
          if (h === -1) return <span key={i} className="text-white">{w}</span>;
          const ok = h < filled;
          return (
            <span key={i} className={`px-3 py-1 rounded-xl border-2 min-w-[80px] text-center ${ok ? "border-teal-400 bg-teal-400/20 text-teal-200" : h === filled ? "border-yellow-400 bg-yellow-400/15 text-yellow-300" : "border-dashed border-white/25 text-white/25"}`}>
              {ok ? w : "____"}
            </span>
          );
        })}
      </div>
      {!done && (
        <div className="flex flex-wrap gap-3 justify-center">
          {bank.map(({ w, k }) => (
            <button
              key={k}
              onClick={() => tap(w, k)}
              disabled={used.includes(k)}
              className={`px-5 rounded-full text-xl font-bold min-h-[56px] transition-all ${used.includes(k) ? "bg-white/5 text-white/15" : "bg-white/15 text-white hover:bg-white/25 active:scale-95"} ${shake === k ? "mg-shake bg-red-500/40" : ""}`}
            >
              {w}
            </button>
          ))}
        </div>
      )}
      <button onClick={() => audio.play([chunk])} className="bg-sky-500/20 text-sky-200 font-bold px-5 rounded-2xl min-h-[56px] active:scale-95">🔊 Pista</button>
      {done && <NextButton onClick={onNext} />}
    </div>
  );
}

// --- 4. Unir los pedazos ---

function JoinStep({ mission, audio, onNext }: { mission: PhraseMission; audio: MissionAudio; onNext: () => void }) {
  const [bank] = useState(() => {
    let s = shuffleArray(mission.chunks.map((_, i) => i));
    if (s.every((v, i) => v === i)) s = [...s.slice(1), s[0]];
    return s;
  });
  const [placed, setPlaced] = useState<number[]>([]);
  const [shake, setShake] = useState<number | null>(null);
  const done = placed.length === mission.chunks.length;

  const tap = (i: number) => {
    if (done || placed.includes(i)) return;
    if (i === placed.length) {
      const next = [...placed, i];
      setPlaced(next);
      if (next.length === mission.chunks.length) {
        playSfx("success");
        setTimeout(() => audio.play(mission.chunks.map((_, j) => j)), 400);
      }
    } else {
      playSfx("error");
      setShake(i);
      setTimeout(() => setShake(null), 400);
    }
  };

  return (
    <div className="flex-1 flex flex-col gap-5">
      <p className="text-white/70 text-center">Toca los pedazos en orden para armar tu frase completa.</p>
      <div className="flex flex-col gap-2">
        {mission.chunks.map((_, i) => (
          <div key={i} className={`rounded-2xl px-4 py-3 text-lg font-bold min-h-[56px] flex items-center border-2 ${i < placed.length ? (audio.playing === i ? "bg-yellow-300 text-black border-yellow-300" : "bg-teal-400/15 border-teal-400 text-teal-100") : "border-dashed border-white/20 text-white/25"}`}>
            {i < placed.length ? mission.chunks[i].text : `${i + 1}. ?`}
          </div>
        ))}
      </div>
      {!done && (
        <div className="flex flex-col gap-2">
          {bank.filter((i) => !placed.includes(i)).map((i) => (
            <button
              key={i}
              onClick={() => tap(i)}
              className={`text-left bg-white/15 hover:bg-white/25 text-white rounded-2xl px-4 py-3 text-lg font-bold min-h-[56px] active:scale-[0.98] transition-all ${shake === i ? "mg-shake bg-red-500/40" : ""}`}
            >
              {mission.chunks[i].text}
            </button>
          ))}
        </div>
      )}
      {done && <NextButton onClick={onNext} />}
    </div>
  );
}

// --- 5. Decirla en voz alta sin verla ---

type RecResultEvent = { results: ArrayLike<ArrayLike<{ transcript: string }>> };
type Rec = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: RecResultEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};
type RecCtor = new () => Rec;

function getRecognition(): RecCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecCtor; webkitSpeechRecognition?: RecCtor };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

// Cuántas palabras de la frase dijo en orden (subsecuencia común más larga)
function matchWords(target: string[], heard: string[]): boolean[] {
  const n = target.length;
  const m = heard.length;
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      dp[i][j] = target[i] === heard[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const hit = new Array(n).fill(false);
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (target[i] === heard[j]) { hit[i] = true; i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
    else j++;
  }
  return hit;
}

function SayStep({ mission, chunk, audio, onNext }: { mission: PhraseMission; chunk: number; audio: MissionAudio; onNext: () => void }) {
  const c = mission.chunks[chunk];
  const words = useMemo(() => missionWords(c.text), [c]);
  const target = useMemo(() => words.map(cleanWord), [words]);
  const [Recognition] = useState(getRecognition);
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState("");
  const [hits, setHits] = useState<boolean[] | null>(null);
  const [tries, setTries] = useState(0);
  const [noMic, setNoMic] = useState(!Recognition);
  const recRef = useRef<Rec | null>(null);
  const heardRef = useRef("");

  const passed = hits ? hits.filter(Boolean).length / hits.length >= PASS : false;

  const evaluate = useCallback(() => {
    const said = heardRef.current.split(/\s+/).map(cleanWord).filter(Boolean);
    const h = matchWords(target, said);
    setHits(h);
    setTries((t) => t + 1);
    if (h.filter(Boolean).length / h.length >= PASS) {
      playSfx("success");
      setTimeout(() => audio.play([chunk]), 500);
    } else playSfx("error");
  }, [target, audio, chunk]);

  const start = () => {
    if (!Recognition) return;
    audio.stop();
    setHits(null);
    heardRef.current = "";
    setHeard("");
    const r = new Recognition();
    r.lang = "en-US";
    r.continuous = true;
    r.interimResults = true;
    r.maxAlternatives = 1;
    r.onresult = (e) => {
      let text = "";
      for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript + " ";
      heardRef.current = text;
      setHeard(text);
    };
    r.onerror = (e) => {
      // "no-speech"/"aborted" solo es que no habló; lo demás es que la tablet no puede escuchar
      if (e.error !== "no-speech" && e.error !== "aborted") setNoMic(true);
    };
    r.onend = () => {
      setListening(false);
      recRef.current = null;
      if (heardRef.current.trim()) evaluate();
    };
    try {
      r.start();
      recRef.current = r;
      setListening(true);
    } catch {
      setNoMic(true);
    }
  };

  const stop = () => recRef.current?.stop();
  useEffect(() => () => recRef.current?.stop(), []);

  const showWords = hits !== null;

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-5 text-center">
      <p className="text-white/70">Dila en inglés <b>sin verla</b>. Esta es la pista:</p>
      <Meaning text={c.es} />
      <div className="flex flex-wrap gap-x-2 gap-y-2 justify-center text-2xl font-bold min-h-[48px]">
        {words.map((w, i) => {
          const color = hits ? (hits[i] ? "text-teal-300" : "text-red-400 underline decoration-wavy") : "text-white";
          return (
            <span key={i} className={showWords ? color : "text-white/40"}>
              {showWords || i === 0 ? w : "•".repeat(Math.min(cleanWord(w).length, 6))}
            </span>
          );
        })}
      </div>

      {passed ? (
        <NextButton onClick={onNext} label={chunk === mission.chunks.length - 1 ? "¡Terminar misión! 🏁" : "Siguiente ➡"} />
      ) : noMic ? (
        <div className="flex flex-col items-center gap-3 bg-white/5 rounded-3xl p-5">
          <p className="text-white/80">🎙️ Esta tablet no me deja escucharte.<br />Dísela en voz alta a alguien de tu familia, sin verla.</p>
          <button onClick={onNext} className="bg-white text-black font-black text-lg px-8 rounded-2xl min-h-[56px] active:scale-95">✅ Ya la dije completa</button>
        </div>
      ) : (
        <>
          {listening ? (
            <button onClick={stop} className="bg-red-500 text-white font-black text-xl px-10 rounded-full min-h-[64px] shadow-xl animate-pulse active:scale-95">
              ⏹ Ya terminé
            </button>
          ) : (
            <button onClick={start} className="bg-gradient-to-r from-pink-500 to-orange-400 text-white font-black text-xl px-10 rounded-full min-h-[64px] shadow-xl active:scale-95 hover:scale-105 transition-all">
              🎤 {tries ? "Intentar otra vez" : "Decirla"}
            </button>
          )}
          {listening && <p className="text-white/60 text-sm min-h-[20px]">Te escucho… {heard && <i className="text-white/80">«{heard.trim()}»</i>}</p>}
          {hits && !passed && (
            <p className="text-amber-300 font-bold">
              ¡Casi! Dijiste {hits.filter(Boolean).length} de {hits.length} palabras. Las rojas te faltaron.
            </p>
          )}
          <div className="flex gap-3 flex-wrap justify-center">
            <button onClick={() => audio.play([chunk])} className="bg-sky-500/20 text-sky-200 font-bold px-5 rounded-2xl min-h-[56px] active:scale-95">🔊 Escucharla</button>
          </div>
        </>
      )}
    </div>
  );
}
